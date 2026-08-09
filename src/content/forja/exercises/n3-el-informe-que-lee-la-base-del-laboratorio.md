---
title: "El informe que lee la base del laboratorio"
level: 3
role: core
domain: salud
D1: 2
D2: 2
D3: 3
D4: 1
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir quién es el dueño del resultado clínico y por qué una lectura directa a la base de otro equipo es una dependencia aunque nadie escriba nada."
lambda: 0.5
constraints:
  - metric: estudios procesados por día
    operator: ">="
    value: 12000
    unit: estudios
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "el trabajo de estadística consulta la base de resultados a las dos de la mañana, que es exactamente la hora en la que el laboratorio carga los estudios de la guardia. El mes pasado bloqueó esa carga durante cuarenta minutos."
    discoveryPath: "seguí la flecha que sale del trabajo de estadística en el lienzo y fijate en dónde termina. Una lectura que no le pide permiso a nadie no es una lectura gratis: compite por la misma base con quien está escribiendo."
  - fact: "en febrero el equipo de resultados cambió qué significa el campo de estado. No avisaron porque no sabían que alguien más lo leía. El informe del ministerio contó 3.100 estudios dos veces durante seis semanas."
    discoveryPath: "es la consecuencia de leer la base de otro. Un servicio publica un contrato y puede cambiar lo de adentro; una base no publica nada, así que cambiar lo de adentro rompe a quien la lea sin que aparezca un solo error."
  - fact: "estadística sólo necesita conteos, pero al leer la fila entera se lleva nombre, documento y diagnóstico de cada paciente. La conexión al ministerio hoy declara dato personal por eso."
    discoveryPath: "mirá qué clase de dato viaja hoy hacia el ministerio. Un informe agregado no debería llevar a nadie adentro; el que lo lleva es el que lee la fila completa porque le resultaba más fácil."
  - fact: "no hay ninguna copia del informe que se mandó. Cuando el ministerio discute un número, el equipo vuelve a correr el trabajo y le da otro, porque la base cambió desde entonces."
    discoveryPath: "buscá en el lienzo dónde queda guardado lo que salió. No está: el informe se genera y se manda, y no queda rastro de qué decía."
startingDesign:
  nodes:
    - id: paciente
      type: actor
      label: Paciente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del paciente
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: resultados
      type: service
      label: Servicio de resultados
      zone: private
      role: lab-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: estadistica
      type: worker
      label: Trabajo de estadística sanitaria
      zone: private
      role: stats-service
      given: true
      position: { x: 445, y: 520 }
    - id: baseresultados
      type: database
      label: Base de resultados (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: ministerio
      type: external-provider
      label: Portal del ministerio
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: paciente-portal
      from: { node: paciente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-resultados
      from: { node: gw }
      to: { node: resultados }
      dataClass: personal
    - id: resultados-base
      from: { node: resultados }
      to: { node: baseresultados }
      dataClass: regulated
    - id: estadistica-base
      from: { node: estadistica }
      to: { node: baseresultados }
      dataClass: regulated
    - id: estadistica-ministerio
      from: { node: estadistica }
      to: { node: ministerio }
      dataClass: personal
guarantees:
  - id: g-sin-lectura-directa
    label: estadística no lee la base de resultados por su cuenta
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: stats-service
      to:
        type: [database]
    whyMissing: el trabajo de estadística sigue teniendo una conexión directa con una base de datos.
    consequence: "leer la base de otro equipo es depender de su forma interna sin que exista un acuerdo. El día que ellos cambian una columna no aparece ningún error: aparece un número distinto, seis semanas después, en un informe que ya se mandó."
  - id: g-por-el-dueno
    label: lo que estadística usa le llega desde el dueño del resultado
    weight: 2
    predicate:
      op: any
      of:
        - op: path
          from:
            role: stats-service
          to:
            type: [database]
          via:
            role: lab-service
        - op: path
          from:
            role: lab-service
          to:
            role: stats-service
    whyMissing: no hay ninguna vía entre estadística y el resultado que pase por el servicio que es dueño del resultado, ni pidiéndoselo ni recibiéndolo de él.
    consequence: "borrar la conexión directa y no poner nada en su lugar deja al ministerio sin informe. Que el dato tenga dueño no significa que los demás dejen de necesitarlo: significa que se lo piden a él, o que él se los manda."
  - id: g-informe-archivado
    label: el informe sigue llegando al ministerio y queda archivado tal como salió
    weight: 1
    predicate:
      op: all
      of:
        - op: path
          from:
            role: stats-service
          to:
            type: [object-storage]
        - op: path
          from:
            role: stats-service
          to:
            type: [external-provider]
    whyMissing: falta uno de los dos caminos. O estadística no llega a un almacenamiento de objetos, y entonces el informe se genera, se manda y desaparece; o no llega hasta el ministerio, y entonces directamente no se manda.
    consequence: cuando el ministerio discute un número no hay con qué contestarle. Volver a correr el trabajo devuelve otro resultado porque la base cambió desde entonces, y eso no es una prueba de nada. Y dejar de mandarlo no es una solución al problema de qué se manda.
  - id: g-resultado-conservado
    label: el resultado clínico sigue viviendo en una base que se puede restaurar
    weight: 1
    predicate:
      op: path
      from:
        role: lab-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde el servicio de resultados hasta una base con respaldo configurado.
    consequence: "sacar la lectura de estadística no puede costar el lugar donde el resultado existe. El paciente entra al portal a ver un análisis de hace tres meses; el que tiene que seguir teniéndolo es el dueño del dato."
rubric:
  - dimension: nadie lee la base de un equipo ajeno
    signal:
      kind: predicate
      guaranteeId: g-sin-lectura-directa
  - dimension: cortar la lectura directa no deja al ministerio sin informe
    signal:
      kind: predicate
      guaranteeId: g-por-el-dueno
  - dimension: lo que salió del sistema queda registrado
    signal:
      kind: predicate
      guaranteeId: g-informe-archivado
  - dimension: el dueño del dato sigue conservándolo
    signal:
      kind: predicate
      guaranteeId: g-resultado-conservado
referenceSolutions:
  - label: estadística le pide los conteos al servicio de resultados
    contextInversion: "pedirle al dueño en el momento es lo correcto cuando el informe se arma una vez por mes y tiene que reflejar el cierre exacto de ese mes: el servicio de resultados decide qué expone y qué no, así que puede devolver conteos sin devolver pacientes, y el día que cambia su forma interna el contrato sigue siendo el mismo. Se paga con que una caída del servicio de resultados frena el cierre, y con una consulta pesada que corre contra el servicio que atiende a los pacientes."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal del paciente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: resultados
          type: service
          label: Servicio de resultados
          zone: private
          role: lab-service
          props: { criticality: "high", replicas: "2" }
        - id: estadistica
          type: worker
          label: Trabajo de estadística sanitaria
          zone: private
          role: stats-service
        - id: baseresultados
          type: database
          label: Base de resultados (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de informes enviados
          zone: private
        - id: ministerio
          type: external-provider
          label: Portal del ministerio
          zone: dmz
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-resultados
          from: { node: gw }
          to: { node: resultados }
          dataClass: personal
        - id: resultados-base
          from: { node: resultados }
          to: { node: baseresultados }
          dataClass: regulated
        - id: estadistica-resultados
          from: { node: estadistica }
          to: { node: resultados }
          dataClass: public
        - id: estadistica-archivo
          from: { node: estadistica }
          to: { node: archivo }
          dataClass: public
        - id: estadistica-ministerio
          from: { node: estadistica }
          to: { node: ministerio }
          dataClass: public
  - label: el laboratorio publica el conteo del día y estadística lo acumula
    contextInversion: "que el dueño publique y estadística acumule conviene cuando el informe tiene que estar disponible todos los días y no puede depender de una consulta pesada contra el servicio que atiende a los pacientes: el laboratorio decide qué publica, que es un conteo por estudio sin pacientes adentro, y estadística arma el mes con lo que fue llegando. Se paga con una pieza más para operar y con una ventana en la que el conteo del día todavía no llegó."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal del paciente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: resultados
          type: service
          label: Servicio de resultados
          zone: private
          role: lab-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de conteos publicados
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: estadistica
          type: worker
          label: Trabajo de estadística sanitaria
          zone: private
          role: stats-service
        - id: baseresultados
          type: database
          label: Base de resultados (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de informes enviados
          zone: private
        - id: ministerio
          type: external-provider
          label: Portal del ministerio
          zone: dmz
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-resultados
          from: { node: gw }
          to: { node: resultados }
          dataClass: personal
        - id: resultados-base
          from: { node: resultados }
          to: { node: baseresultados }
          dataClass: regulated
        - id: resultados-cola
          from: { node: resultados }
          to: { node: cola }
          dataClass: public
        - id: cola-estadistica
          from: { node: cola }
          to: { node: estadistica }
          dataClass: public
        - id: estadistica-archivo
          from: { node: estadistica }
          to: { node: archivo }
          dataClass: public
        - id: estadistica-ministerio
          from: { node: estadistica }
          to: { node: ministerio }
          dataClass: public
status: PILOT
---

Una red de laboratorios que procesa **12.000 estudios por día**. El servicio de
resultados es el dueño del resultado clínico: lo carga el bioquímico, lo firma,
lo publica en el portal del paciente.

Epidemiología necesita un informe mensual para el ministerio: cuántos estudios
de cada tipo, cuántos positivos, por zona. Armaron un trabajo que corre todas
las noches y **consulta la base de resultados directamente**. La razón fue
buena y la dijeron con estas palabras: *"es sólo lectura, no le molesta a
nadie"*.

Le molesta a alguien. El trabajo corre a las dos de la mañana, que es la hora en
que el laboratorio carga los estudios de la guardia. El mes pasado bloqueó esa
carga **cuarenta minutos**.

Y hay algo peor, porque no hace ruido. En febrero el equipo de resultados
cambió qué significa el campo de estado. No avisaron: no sabían que alguien más
lo leía. El informe del ministerio contó **3.100 estudios dos veces durante
seis semanas**. No hubo error, no hubo alerta, no hubo nada que investigar:
hubo un número distinto.

Dos detalles más. Estadística sólo necesita conteos, pero al leer la fila
entera se lleva **nombre, documento y diagnóstico** de cada paciente, y eso es
lo que hoy viaja hacia el ministerio. Y del informe que se manda **no queda
ninguna copia**: cuando el ministerio discute un número, el equipo vuelve a
correr el trabajo y le da otro, porque la base cambió desde entonces.

El equipo tiene **5 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que estadística deje de leer la base de un equipo
ajeno sin dejar al ministerio sin informe, y para que lo que salió del sistema
quede registrado tal como salió.
