---
title: "El padrón que nadie sabe quién actualiza"
level: 3
role: synthesis
domain: municipio
D1: 2
D2: 2
D3: 3
D4: 1
D5: 2
D6: 1
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que responder tres cosas por separado: quién es el dueño del padrón, qué clase de dato viaja por cada conexión que dejás, y qué sobrevive si esta noche se reinicia todo."
lambda: 0.5
constraints:
  - metric: contribuyentes en el padrón
    operator: ">="
    value: 84000
    unit: contribuyentes
  - metric: años que la boleta debe poder reconstruirse
    operator: ">="
    value: 10
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "la base de trabajo de cobranzas se levantó para una campaña de regularización en 2022 y quedó. No tiene respaldo: si se pierde, se pierde entera y con ella las direcciones que cobranzas corrigió a mano durante tres años."
    discoveryPath: "probá el diseño tal como viene: el motor lo rechaza y nombra la base. Un dato regulado apoyado en algo que nadie puede restaurar no es un riesgo pendiente, es un incumplimiento vigente."
  - fact: "la caché de vecinos la agregó cobranzas para que el listado de deudores abriera rápido. Adentro hay nombre, documento y domicilio de los 84.000."
    discoveryPath: "el motor también rechaza esa conexión. Es la misma regla del nivel: el lugar donde puede vivir un dato lo decide la clase de dato, no la pantalla que querías acelerar."
  - fact: "las dos conexiones que llegan a la base del padrón son de dos equipos distintos que no se hablan desde la reestructuración de 2023."
    discoveryPath: "mirá cuántas flechas entran a la base del padrón en el lienzo. La pregunta que ordena todo el ejercicio es cuál de los dos servicios es el dueño del padrón, y la respuesta la da el enunciado: el que lo publica y responde por él."
  - fact: "en la boleta de junio 1.900 vecinos figuraron con domicilio viejo. El padrón tenía el domicilio nuevo."
    discoveryPath: "es lo que pasa cuando dos servicios escriben la misma fila con criterios distintos. No hay error que buscar en los registros: hay dos verdades y ninguna autoridad que decida cuál vale."
startingDesign:
  nodes:
    - id: vecino
      type: actor
      label: Vecino
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del vecino
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: padron
      type: service
      label: Servicio de padrón
      zone: private
      role: registry-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: cobranzas
      type: service
      label: Servicio de cobranzas
      zone: private
      role: billing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: basepadron
      type: database
      label: Base del padrón (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: basetrabajo
      type: database
      label: Base de trabajo de cobranzas (sin respaldo)
      zone: restricted
      given: true
      props: { backup: "none" }
      position: { x: 805, y: 520 }
    - id: cachevecinos
      type: cache
      label: Caché de vecinos
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: vecino-portal
      from: { node: vecino }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-padron
      from: { node: gw }
      to: { node: padron }
      dataClass: personal
    - id: gw-cobranzas
      from: { node: gw }
      to: { node: cobranzas }
      dataClass: personal
    - id: padron-basepadron
      from: { node: padron }
      to: { node: basepadron }
      dataClass: regulated
    - id: cobranzas-basepadron
      from: { node: cobranzas }
      to: { node: basepadron }
      dataClass: regulated
    - id: cobranzas-basetrabajo
      from: { node: cobranzas }
      to: { node: basetrabajo }
      dataClass: regulated
    - id: cobranzas-cachevecinos
      from: { node: cobranzas }
      to: { node: cachevecinos }
      dataClass: personal
guarantees:
  - id: g-un-solo-dueno
    label: cobranzas no escribe en ninguna base del padrón por su cuenta
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: billing-service
      to:
        type: [database]
    whyMissing: el servicio de cobranzas sigue teniendo conexión directa con al menos una base de datos.
    consequence: "dos servicios escribiendo el domicilio de la misma persona son dos verdades sin árbitro. En junio eso fueron 1.900 boletas al domicilio viejo, y no hubo nada que investigar: las dos escrituras hicieron lo que cada equipo había definido."
  - id: g-por-el-dueno
    label: lo que cobranzas necesita del padrón llega a través del padrón
    weight: 2
    predicate:
      op: path
      from:
        role: billing-service
      to:
        type: [database]
      via:
        role: registry-service
    whyMissing: no hay ningún camino desde el servicio de cobranzas hasta una base que pase por el servicio de padrón.
    consequence: "cortar las conexiones de cobranzas y no dejarle vía deja al municipio sin poder emitir boletas. Tener un dueño del dato no significa que los demás dejen de necesitarlo: significa que se lo piden a él."
  - id: g-sin-copia-volatil
    label: el dato personal del vecino no se copia a un almacenamiento volátil
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: billing-service
      to:
        type: [cache]
    whyMissing: el servicio de cobranzas sigue copiando nombre, documento y domicilio de los 84.000 vecinos a una caché.
    consequence: el dato personal termina en una pieza que nadie respalda, nadie audita y nadie borra cuando un vecino pide que lo borren. Y como se vacía sola, el día que alguien la necesite como fuente ya no está.
  - id: g-padron-respaldado
    label: el padrón vive en una base que se puede restaurar
    weight: 2
    predicate:
      op: path
      from:
        role: registry-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde el servicio de padrón hasta una base con respaldo configurado.
    consequence: "la boleta hay que poder reconstruirla diez años. Sin una copia que alguien pueda restaurar, esa obligación es una afirmación sin respaldo: cierta hasta el día que hay que probarla."
rubric:
  - dimension: el padrón tiene un dueño y una sola escritura
    signal:
      kind: predicate
      guaranteeId: g-un-solo-dueno
  - dimension: quitar la escritura directa no deja al municipio sin emitir
    signal:
      kind: predicate
      guaranteeId: g-por-el-dueno
  - dimension: la clase de dato decide dónde puede haber una copia
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-volatil
  - dimension: lo que hay que conservar se apoya en algo restaurable
    signal:
      kind: predicate
      guaranteeId: g-padron-respaldado
referenceSolutions:
  - label: cobranzas le pide el dato al padrón cuando emite
    contextInversion: "pedirle al padrón en el momento de emitir es lo correcto cuando la emisión es un proceso mensual acotado y el domicilio tiene que ser el del día de la emisión: cobranzas no guarda nada del vecino, así que no hay una segunda copia que envejezca ni que haya que borrar cuando alguien lo pide. Se paga con que una caída del padrón frena la emisión de boletas."
    design:
      nodes:
        - id: vecino
          type: actor
          label: Vecino
          zone: public
        - id: portal
          type: web-client
          label: Portal del vecino
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: padron
          type: service
          label: Servicio de padrón
          zone: private
          role: registry-service
          props: { criticality: "high", replicas: "2" }
        - id: cobranzas
          type: service
          label: Servicio de cobranzas
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: basepadron
          type: database
          label: Base del padrón (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: vecino-portal
          from: { node: vecino }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-padron
          from: { node: gw }
          to: { node: padron }
          dataClass: personal
        - id: gw-cobranzas
          from: { node: gw }
          to: { node: cobranzas }
          dataClass: personal
        - id: cobranzas-padron
          from: { node: cobranzas }
          to: { node: padron }
          dataClass: regulated
        - id: padron-basepadron
          from: { node: padron }
          to: { node: basepadron }
          dataClass: regulated
  - label: cobranzas deja sus correcciones en una cola y el padrón las aplica
    contextInversion: "dejar la corrección y seguir conviene cuando cobranzas corrige domicilios de a miles después de una campaña y el padrón no puede absorber ese golpe en el momento: la campaña termina cuando termina, el padrón aplica a su ritmo, y una caída del padrón no frena a los inspectores que están cargando en la calle. Se paga con una ventana en la que la corrección está aceptada y todavía no publicada, y con una pieza más para operar."
    design:
      nodes:
        - id: vecino
          type: actor
          label: Vecino
          zone: public
        - id: portal
          type: web-client
          label: Portal del vecino
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: padron
          type: service
          label: Servicio de padrón
          zone: private
          role: registry-service
          props: { criticality: "high", replicas: "2" }
        - id: cobranzas
          type: service
          label: Servicio de cobranzas
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de correcciones de padrón
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: basepadron
          type: database
          label: Base del padrón (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de boletas emitidas
          zone: private
      edges:
        - id: vecino-portal
          from: { node: vecino }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-padron
          from: { node: gw }
          to: { node: padron }
          dataClass: personal
        - id: gw-cobranzas
          from: { node: gw }
          to: { node: cobranzas }
          dataClass: personal
        - id: cobranzas-cola
          from: { node: cobranzas }
          to: { node: cola }
          dataClass: regulated
        - id: cola-padron
          from: { node: cola }
          to: { node: padron }
          dataClass: regulated
        - id: padron-basepadron
          from: { node: padron }
          to: { node: basepadron }
          dataClass: regulated
        - id: cobranzas-archivo
          from: { node: cobranzas }
          to: { node: archivo }
          dataClass: regulated
status: PILOT
---

Un municipio con **84.000 contribuyentes**. Dos sistemas, dos equipos que no
se hablan desde la reestructuración de 2023, y una sola base del padrón que
los dos escriben.

El servicio de padrón publica el domicilio, el titular y la partida. El
servicio de cobranzas corrige el domicilio cuando el cartero devuelve una
boleta, y lo escribe **en la misma base**. Los dos equipos definieron qué
significa "domicilio válido" por su cuenta, y ninguno de los dos sabe que el
otro lo definió.

En la boleta de junio, **1.900 vecinos** figuraron con el domicilio viejo. El
padrón tenía el nuevo. No hubo error que investigar: hubo dos verdades y
ninguna autoridad que decidiera cuál vale.

Cobranzas tiene además dos piezas propias. Una **base de trabajo** que se
levantó en 2022 para una campaña de regularización y quedó, sin respaldo, con
tres años de correcciones hechas a mano adentro. Y una **caché de vecinos**,
puesto para que el listado de deudores abriera rápido, con nombre, documento
y domicilio de los 84.000.

La ordenanza obliga a poder reconstruir cualquier boleta durante **diez
años**.

El equipo tiene **6 unidades operativas** y hoy usa 6.

**Rearmá el sistema** respondiendo las tres preguntas del nivel a la vez:
quién es el dueño del padrón y cómo le piden el dato los demás sin dejar de
poder emitir; qué clase de dato viaja por cada conexión que dejás en pie; y
qué de todo esto sigue existiendo si esta noche se reinicia todo.
