---
title: "El colegio que atrasó a los otros trescientos nueve"
level: 8
role: core
domain: educacion
D1: 3
D2: 2
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [7]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que explicar por qué una única cola compartida convierte el tamaño de un cliente en un problema de todos los demás, y qué cambia cuando esa cola deja de ser una sola."
lambda: 0.5
constraints:
  - metric: colegios sobre la misma plataforma
    operator: ">="
    value: 310
    unit: colegios
  - metric: demora aceptable entre subir las notas y verlas publicadas
    operator: "<="
    value: 15
    unit: minutos
hiddenFacts:
  - fact: "el importador valida cada nota contra el histórico del alumno, y esa validación la hace consultando la base directamente. La consulta busca por documento del alumno, no por colegio."
    discoveryPath: "es la razón por la que una de las garantías prohíbe la conexión directa entre el importador y la base. Un alumno que cambió de colegio tiene dos legajos con el mismo documento; la validación toma el primero que encuentra."
  - fact: "el colegio grande sube sus notas en un único archivo de 300.000 filas, siempre el mismo día. Los otros 309 suben entre 200 y 4.000 filas cada uno, repartidos en toda la semana."
    discoveryPath: "mirá la restricción de demora contra el tamaño del archivo más grande. Una cola única y ordenada procesa el archivo grande completo antes de tocar el siguiente: la demora del último de la cola es la suma de todos los que están adelante."
  - fact: "una cola de mensajes común es una sola secuencia ordenada: el que llegó primero sale primero, para todos. Un registro de eventos se divide en tramos que avanzan en paralelo, y sólo se ordena dentro de cada tramo."
    discoveryPath: "es la diferencia entre los dos componentes de infraestructura que pueden llevar los pedidos de importación. El motor la conoce: uno declara en cuántos tramos se divide, el otro no tiene el concepto."
startingDesign:
  nodes:
    - id: docente
      type: actor
      label: Docente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del colegio
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
      label: Servicio de notas
      zone: private
      role: grades-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: cola
      type: queue
      label: Cola de importaciones
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
      position: { x: 805, y: 520 }
    - id: importador
      type: worker
      label: Importador de notas
      zone: private
      role: import-worker
      given: true
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de notas
      zone: restricted
      role: grades-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: docente-portal
      from: { node: docente }
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
    - id: notas-base
      from: { node: notas }
      to: { node: base }
      dataClass: personal
    - id: notas-cola
      from: { node: notas }
      to: { node: cola }
      dataClass: personal
    - id: cola-importador
      from: { node: cola }
      to: { node: importador }
      dataClass: personal
    - id: importador-base
      from: { node: importador }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-partitioned-intake
    label: los pedidos de importación viajan por un registro de eventos dividido en tramos, no por una única cola compartida
    weight: 2
    predicate:
      op: exists
      node:
        type: [stream]
        propEquals: { partitions: "3" }
    whyMissing: los pedidos de importación entran por una única cola ordenada, donde el que llegó primero se procesa completo antes de que empiece el siguiente.
    consequence: "el archivo de 300.000 filas del colegio más grande se procesa entero antes de que se toque el de un colegio de 90 alumnos. La demora que sufre el último no depende de su propio tamaño: depende del tamaño del que estaba adelante."
  - id: g-intake-through-stream
    label: el servicio de notas le entrega el trabajo al importador por ese registro
    weight: 2
    predicate:
      op: path
      from:
        role: grades-service
      to:
        role: import-worker
      via:
        type: [stream]
    whyMissing: no hay ningún camino desde el servicio de notas hasta el importador que pase por un registro de eventos dividido en tramos.
    consequence: el registro nuevo no sirve de nada si el trabajo sigue entrando por otro lado. Un componente que existe pero no está en el camino es una pieza más para operar y cero problemas resueltos.
  - id: g-no-direct-scan
    label: el importador no abre ninguna consulta propia contra la base de notas
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: import-worker
      to:
        role: grades-store
    whyMissing: sigue existiendo una conexión directa entre el importador y la base de notas.
    consequence: el importador busca por documento del alumno. Un alumno que cambió de colegio tiene dos legajos con el mismo documento, y la validación toma el que encuentra primero. La nota se valida contra el historial de otro colegio y nadie ve un error.
  - id: g-grades-still-stored
    label: la nota importada sigue quedando guardada
    weight: 1
    predicate:
      op: path
      from:
        role: grades-service
      to:
        role: grades-store
    whyMissing: no queda ningún camino desde el servicio de notas hasta la base de notas.
    consequence: cortar la escritura también hace desaparecer la fuga, y deja al colegio sin boletín. Aislar es separar el acceso, no dejar de guardar.
rubric:
  - dimension: el tamaño de un cliente deja de decidir la demora de los demás
    signal:
      kind: predicate
      guaranteeId: g-partitioned-intake
  - dimension: el camino nuevo es el camino real, no una pieza al costado
    signal:
      kind: predicate
      guaranteeId: g-intake-through-stream
  - dimension: nadie consulta el almacén compartido sin saber de qué colegio pregunta
    signal:
      kind: predicate
      guaranteeId: g-no-direct-scan
  - dimension: la nota sigue llegando al boletín
    signal:
      kind: predicate
      guaranteeId: g-grades-still-stored
referenceSolutions:
  - label: el importador le pide la validación al servicio de notas
    contextInversion: "hacer que el importador vuelva a entrar por el servicio de notas es lo correcto cuando ese servicio ya es la única puerta de escritura y el equipo quiere una sola implementación de la regla \"toda consulta lleva el colegio\": cero piezas nuevas. El costo es que la importación masiva y las consultas de los docentes compiten por el mismo servicio, y a las 20:00 de un cierre de trimestre eso se nota."
    design:
      nodes:
        - id: docente
          type: actor
          label: Docente
          zone: public
        - id: portal
          type: web-client
          label: Portal del colegio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: notas
          type: service
          label: Servicio de notas
          zone: private
          role: grades-service
          props: { criticality: "high", replicas: "2" }
        - id: flujo
          type: stream
          label: Registro de importaciones
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: importador
          type: worker
          label: Importador de notas
          zone: private
          role: import-worker
        - id: base
          type: database
          label: Base de notas
          zone: restricted
          role: grades-store
          props: { backup: "diario" }
      edges:
        - id: docente-portal
          from: { node: docente }
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
        - id: notas-base
          from: { node: notas }
          to: { node: base }
          dataClass: personal
        - id: notas-flujo
          from: { node: notas }
          to: { node: flujo }
          dataClass: personal
        - id: flujo-importador
          from: { node: flujo }
          to: { node: importador }
          dataClass: personal
        - id: importador-notas
          from: { node: importador }
          to: { node: notas }
          dataClass: personal
  - label: un servicio de escritura aparte, dueño único de la base
    contextInversion: "separar un servicio de escritura conviene cuando la importación masiva no puede robarle capacidad a los docentes que están consultando en ese mismo momento: la carga de escritura se escala y se pausa sola, sin tocar el servicio que atiende el portal. Se paga con una pieza más para operar y con que la regla del colegio ahora vive en dos servicios, que es exactamente el tipo de cosa que se desincroniza."
    design:
      nodes:
        - id: docente
          type: actor
          label: Docente
          zone: public
        - id: portal
          type: web-client
          label: Portal del colegio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: notas
          type: service
          label: Servicio de notas
          zone: private
          role: grades-service
          props: { criticality: "high", replicas: "2" }
        - id: flujo
          type: stream
          label: Registro de importaciones
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: importador
          type: worker
          label: Importador de notas
          zone: private
          role: import-worker
        - id: escritor
          type: service
          label: Servicio de escritura de notas
          zone: private
        - id: base
          type: database
          label: Base de notas
          zone: restricted
          role: grades-store
          props: { backup: "diario" }
      edges:
        - id: docente-portal
          from: { node: docente }
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
        - id: notas-escritor
          from: { node: notas }
          to: { node: escritor }
          dataClass: personal
        - id: escritor-base
          from: { node: escritor }
          to: { node: base }
          dataClass: personal
        - id: notas-flujo
          from: { node: notas }
          to: { node: flujo }
          dataClass: personal
        - id: flujo-importador
          from: { node: flujo }
          to: { node: importador }
          dataClass: personal
        - id: importador-escritor
          from: { node: importador }
          to: { node: escritor }
          dataClass: personal
status: PILOT
---

Una plataforma de gestión escolar que usan **310 colegios**. Todos escriben
en la misma base de notas. El docente sube un archivo con las notas de su
curso, el archivo entra en una cola de importaciones, y un importador lo
procesa.

El colegio más grande tiene **14.000 alumnos** y sube todo el trimestre en
un único archivo de **300.000 filas**, siempre el mismo día. Los otros 309
suben entre 200 y 4.000 filas cada uno, repartidos en la semana.

El 7 de julio, ese archivo entró a la cola a las 18:40. Los 46 colegios que
subieron después esperaron **seis horas y veinte minutos**. Ninguno de ellos
había subido más de 3.000 filas. La plataforma promete quince minutos.

Nadie tocó un servidor: la cola es una sola secuencia ordenada, y el que
llegó primero se procesa completo antes de que empiece el siguiente.

Hay un segundo problema, y este no lo vio nadie. El importador valida cada
nota contra el historial del alumno consultando la base directamente, y esa
consulta busca por documento. Una alumna que cambió de colegio en marzo
tiene dos legajos con el mismo documento. La validación tomó el primero que
encontró.

El equipo tiene **7 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que el tamaño de un colegio deje de decidir la
demora de los otros 309, y para que nadie pueda consultar el almacén
compartido sin saber de qué colegio está preguntando.
