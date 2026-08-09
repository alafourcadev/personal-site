---
title: "El informe que entra a dos bases"
level: 2
role: core
domain: educacion
D1: 1
D2: 1
D3: 2
D4: 1
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 8
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué se rompe cuando el dueño de un dato cambia la forma de su tabla y hay alguien leyéndola sin que él lo sepa."
lambda: 0.5
constraints:
  - metric: informes de rendimiento emitidos por ciclo
    operator: ">="
    value: 11000
    unit: informes/ciclo
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: el equipo de notas cambió el tipo de la columna de calificación de entero a decimal para poder registrar 7,5. El cambio duró cuatro minutos y nadie del equipo de informes se enteró hasta que un decano reclamó.
    discoveryPath: "seguí cada flecha que termina en un almacenamiento y preguntate quién es el dueño de esa flecha. Si una flecha entra a un almacenamiento desde una pieza que no es su dueño, la forma interna de esa tabla ya es un contrato entre dos equipos y nadie lo firmó."
  - fact: informes lee la base de notas en el momento en que alguien abre el reporte, pero el dato que muestra es del ciclo cerrado. Nada de lo que consulta cambió en los últimos cuatro meses.
    discoveryPath: "compará cada cuánto cambia el dato que informes consulta con cada cuánto informes lo consulta. Cuando esas dos frecuencias no se parecen, la pregunta ya no es cómo leer sino cuándo recibir."
  - fact: la ley de protección de datos académicos obliga a que el dueño del legajo pueda decir quién consultó una calificación. Hoy las consultas de informes no quedan registradas en ningún lado porque no pasan por notas.
    discoveryPath: "preguntate quién puede responder 'quién leyó esto'. Sólo lo puede responder la pieza por la que pasa la lectura. Una lectura que esquiva al dueño es una lectura que no existe para el registro."
startingDesign:
  nodes:
    - id: alumno
      type: actor
      label: Estudiante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal académico
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: notas
      type: service
      label: Servicio de calificaciones
      zone: private
      role: grades-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: notasdb
      type: database
      label: Base de calificaciones
      zone: restricted
      role: grades-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: inscripciones
      type: service
      label: Servicio de inscripciones
      zone: private
      role: enrollment-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: inscripcionesdb
      type: database
      label: Base de inscripciones
      zone: restricted
      role: enrollment-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: informes
      type: service
      label: Servicio de informes
      zone: private
      role: reporting-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: informesdb
      type: database
      label: Base de informes
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
  edges:
    - id: alumno-portal
      from: { node: alumno }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-notas
      from: { node: gw }
      to: { node: notas }
      dataClass: personal
    - id: notas-notasdb
      from: { node: notas }
      to: { node: notasdb }
      dataClass: personal
    - id: gw-inscripciones
      from: { node: gw }
      to: { node: inscripciones }
      dataClass: personal
    - id: inscripciones-inscripcionesdb
      from: { node: inscripciones }
      to: { node: inscripcionesdb }
      dataClass: personal
    - id: gw-informes
      from: { node: gw }
      to: { node: informes }
      dataClass: personal
    - id: informes-informesdb
      from: { node: informes }
      to: { node: informesdb }
      dataClass: personal
    - id: informes-notasdb
      from: { node: informes }
      to: { node: notasdb }
      dataClass: personal
    - id: informes-inscripcionesdb
      from: { node: informes }
      to: { node: inscripcionesdb }
      dataClass: personal
guarantees:
  - id: g-no-grade-peek
    label: informes no entra a la base de calificaciones
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: reporting-service
      to:
        role: grades-db
    whyMissing: hay una conexión que sale del servicio de informes y entra directo a la base de calificaciones.
    consequence: "mientras esa flecha exista, el equipo de calificaciones no puede cambiar una columna sin romper a otro equipo, y no se entera de que lo rompió: se entera el decano que abre el reporte. Además, la lectura no queda registrada en ningún lado, y la ley obliga al dueño del legajo a poder decir quién consultó una nota."
  - id: g-no-enrollment-peek
    label: informes no entra a la base de inscripciones
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: reporting-service
      to:
        role: enrollment-db
    whyMissing: hay una conexión que sale del servicio de informes y entra directo a la base de inscripciones.
    consequence: "es la misma deuda que con calificaciones, sólo que con otro equipo. Dos atajos no son un atajo el doble de grande: son dos equipos que ya no pueden cambiar su almacenamiento sin avisar, y ninguno de los dos sabe a quién avisar."
  - id: g-report-still-gets-grades
    label: el informe sigue recibiendo la calificación, a través de su dueño
    weight: 2
    predicate:
      op: any
      of:
        - op: path
          from:
            role: reporting-service
          to:
            role: grades-db
          via:
            role: grades-service
        - op: path
          from:
            role: grades-service
          to:
            role: reporting-service
    whyMissing: no hay ningún camino entre el servicio de informes y la calificación que pase por el servicio de calificaciones. Ni informes pidiéndosela, ni calificaciones enviándosela.
    consequence: "cortar el atajo sin dejar un camino no arregla nada: deja once mil informes por ciclo sin la nota que son. El límite se respeta atravesándolo por la puerta, no tapiando la puerta."
  - id: g-enrollment-owner
    label: la inscripción sigue teniendo dueño y almacenamiento
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [database]
            role: enrollment-db
        - op: covered
          target:
            role: enrollment-db
          by:
            role: enrollment-service
    whyMissing: la base de inscripciones no existe, o no está conectada al servicio de inscripciones.
    consequence: "la forma barata de que nadie lea mal un dato es borrar el dato. Una universidad sin registro de inscripciones no tiene un problema de límites resuelto: no tiene universidad."
rubric:
  - dimension: ningún equipo lee dentro del almacenamiento de otro
    signal:
      kind: predicate
      guaranteeId: g-no-grade-peek
  - dimension: el dato ajeno se sigue alcanzando por su dueño
    signal:
      kind: predicate
      guaranteeId: g-report-still-gets-grades
  - dimension: cada dato conserva un dueño explícito
    signal:
      kind: predicate
      guaranteeId: g-enrollment-owner
referenceSolutions:
  - label: el informe le pregunta a cada dueño en el momento
    contextInversion: "preguntarle a cada dueño en el momento es lo correcto cuando el informe tiene que reflejar lo que hay ahora, como en una revisión de acta, un recurso de un estudiante o una consulta de secretaría en pleno cierre, y cuando el dueño necesita saber quién leyó qué, porque la lectura le pasa por encima y él la registra. Se paga con que emitir un informe depende de que calificaciones e inscripciones estén respondiendo: si una de las dos está lenta, el informe está lento."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Estudiante
          zone: public
        - id: portal
          type: web-client
          label: Portal académico
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: notas
          type: service
          label: Servicio de calificaciones
          zone: private
          role: grades-service
          props: { criticality: "medium", replicas: "2" }
        - id: notasdb
          type: database
          label: Base de calificaciones
          zone: restricted
          role: grades-db
          props: { backup: "diario" }
        - id: inscripciones
          type: service
          label: Servicio de inscripciones
          zone: private
          role: enrollment-service
          props: { criticality: "medium", replicas: "2" }
        - id: inscripcionesdb
          type: database
          label: Base de inscripciones
          zone: restricted
          role: enrollment-db
          props: { backup: "diario" }
        - id: informes
          type: service
          label: Servicio de informes
          zone: private
          role: reporting-service
          props: { criticality: "medium", replicas: "2" }
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-notas
          from: { node: gw }
          to: { node: notas }
          dataClass: personal
        - id: notas-notasdb
          from: { node: notas }
          to: { node: notasdb }
          dataClass: personal
        - id: gw-inscripciones
          from: { node: gw }
          to: { node: inscripciones }
          dataClass: personal
        - id: inscripciones-inscripcionesdb
          from: { node: inscripciones }
          to: { node: inscripcionesdb }
          dataClass: personal
        - id: gw-informes
          from: { node: gw }
          to: { node: informes }
          dataClass: personal
        - id: informes-notas
          from: { node: informes }
          to: { node: notas }
          dataClass: personal
        - id: informes-inscripciones
          from: { node: informes }
          to: { node: inscripciones }
          dataClass: personal
  - label: cada dueño publica su cambio y el informe se arma aparte
    contextInversion: "invertir el sentido para que el dueño publique en vez de que el informe pregunte conviene cuando el dato que el informe usa es de ciclos cerrados y no cambia hace meses, y cuando once mil informes por ciclo no pueden depender de que dos servicios académicos estén disponibles a las nueve de la mañana del día de cierre. El límite se sigue respetando: la calificación sale de su dueño, con la forma que su dueño publica, no con la forma de su tabla. Se paga con una pieza más que operar y con que el informe muestra el dato de la última publicación, no el de este segundo."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Estudiante
          zone: public
        - id: portal
          type: web-client
          label: Portal académico
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: notas
          type: service
          label: Servicio de calificaciones
          zone: private
          role: grades-service
          props: { criticality: "medium", replicas: "2" }
        - id: notasdb
          type: database
          label: Base de calificaciones
          zone: restricted
          role: grades-db
          props: { backup: "diario" }
        - id: inscripciones
          type: service
          label: Servicio de inscripciones
          zone: private
          role: enrollment-service
          props: { criticality: "medium", replicas: "2" }
        - id: inscripcionesdb
          type: database
          label: Base de inscripciones
          zone: restricted
          role: enrollment-db
          props: { backup: "diario" }
        - id: publicaciones
          type: stream
          label: Registro de publicaciones académicas
          zone: private
          props: { retention: "30d", partitions: "3" }
        - id: informes
          type: worker
          label: Armador de informes
          zone: private
          role: reporting-service
          props: { idempotent: "sí" }
        - id: informesdb
          type: database
          label: Base de informes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-notas
          from: { node: gw }
          to: { node: notas }
          dataClass: personal
        - id: notas-notasdb
          from: { node: notas }
          to: { node: notasdb }
          dataClass: personal
        - id: gw-inscripciones
          from: { node: gw }
          to: { node: inscripciones }
          dataClass: personal
        - id: inscripciones-inscripcionesdb
          from: { node: inscripciones }
          to: { node: inscripcionesdb }
          dataClass: personal
        - id: notas-publicaciones
          from: { node: notas }
          to: { node: publicaciones }
          dataClass: personal
        - id: inscripciones-publicaciones
          from: { node: inscripciones }
          to: { node: publicaciones }
          dataClass: personal
        - id: publicaciones-informes
          from: { node: publicaciones }
          to: { node: informes }
          dataClass: personal
        - id: informes-informesdb
          from: { node: informes }
          to: { node: informesdb }
          dataClass: personal
status: PILOT
---

Una universidad emite **11.000 informes de rendimiento por ciclo**: uno por
estudiante, más los consolidados que piden las cinco facultades y el
ministerio.

Tres equipos. Calificaciones, que es dueño del acta. Inscripciones, que es
dueño de quién cursa qué. E informes, que arma el reporte.

Cuando se armó informes, la forma más corta de conseguir los datos fue
**conectarse a las dos bases**. Nadie discutió: eran dos cadenas de conexión en
un archivo de configuración, y el reporte salió esa misma semana.

En marzo, calificaciones cambió el tipo de la columna de nota de entero a
decimal, para poder registrar un 7,5. La migración duró **cuatro minutos**.
Informes estuvo **seis días** truncando todas las notas al entero de abajo, y
nadie lo notó hasta que un decano preguntó por qué su facultad había bajado el
promedio. El equipo de calificaciones no hizo nada mal: cambió su propia tabla.
El problema es que su tabla, sin que nadie lo firmara, era el contrato entre
dos equipos.

Hay una segunda deuda, y esta tiene multa. La ley de datos académicos obliga a
que el dueño del legajo pueda decir **quién consultó una calificación y
cuándo**. Hoy hay dos lecturas por informe que el servicio de calificaciones ni
sabe que existen.

Un dato más, por si cambia tu respuesta: lo que informes consulta es de
**ciclos cerrados**. Nada de eso cambió en los últimos cuatro meses.

El equipo tiene **8 unidades operativas** y hoy usa 7.

**Rearmá el sistema** para que ningún equipo lea dentro del almacenamiento de
otro, y para que el informe siga teniendo la nota: pidiéndosela a su dueño o
recibiéndola de él, pero nunca sacándosela.
