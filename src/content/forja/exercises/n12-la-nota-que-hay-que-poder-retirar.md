---
title: "La nota que hay que poder retirar de todos lados"
level: 12
role: tradeoff
domain: medios
tradeoffPairId: liderazgo-la-pieza-que-se-defiende
D1: 2
D2: 4
D3: 3
D4: 4
D5: 3
D6: 3
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 6
aiBudget: "libre. Lo que no delegues es la conversación con el director periodístico: te va a decir que este diseño es más lento, y va a tener razón. Tenés que poder decirle cuánto más lento y a cambio de qué."
lambda: 3.0
constraints:
  - metric: tiempo máximo aceptable entre publicar y que la nota esté visible
    operator: "<="
    value: 10
    unit: minutos
  - metric: plazo judicial para retirar una publicación cuando llega una medida cautelar
    operator: "<="
    value: 24
    unit: horas
  - metric: presupuesto operativo de la redacción
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "en la investigación anterior el medio recibió una medida cautelar y tardó nueve días en poder demostrar qué versión exacta había estado publicada cada día. La nota se había editado catorce veces y nadie guardó las versiones intermedias."
    discoveryPath: "es la razón por la que acá el camino de publicación tiene que atravesar un intermediario en vez de esquivarlo: lo que pasa por el intermediario deja rastro, lo que sale directo del servicio no."
  - fact: "el director periodístico viene del ejercicio anterior de este par y trae su conclusión: publicar directo. En una primicia tenía razón. Acá no, y la diferencia no es de opinión: es que el valor de esta nota no vence en 40 segundos."
    discoveryPath: "compará las dos garantías principales de los dos ejercicios del par. Son incompatibles a propósito, y el que cambia no es el diseño correcto: es el contexto."
  - fact: "un intermediario que nadie mira se llena en silencio y descarta lo que no entra en su retención. El día que eso pase, la nota no se publica y nadie recibe un error."
    discoveryPath: "hay una garantía específica para eso. Un intermediario sin nadie mirándolo no es una protección: es un lugar donde las cosas desaparecen sin ruido."
startingDesign:
  nodes:
    - id: lector
      type: actor
      label: Lector
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: sitio
      type: web-client
      label: Sitio del medio
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: redaccion
      type: service
      label: Servicio de publicación
      zone: private
      role: publishing-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: notas
      type: database
      label: Base de notas
      zone: restricted
      role: story-store
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: borde
      type: cdn
      label: Red de distribución
      zone: dmz
      role: edge
      given: true
      props: { cacheControl: "public, max-age=60" }
      position: { x: 805, y: 190 }
  edges:
    - id: lector-sitio
      from: { node: lector }
      to: { node: sitio }
      dataClass: public
    - id: sitio-gw
      from: { node: sitio }
      to: { node: gw }
      dataClass: public
    - id: gw-redaccion
      from: { node: gw }
      to: { node: redaccion }
      dataClass: public
    - id: redaccion-notas
      from: { node: redaccion }
      to: { node: notas }
      dataClass: public
    - id: redaccion-borde
      from: { node: redaccion }
      to: { node: borde }
      dataClass: public
guarantees:
  - id: g-buffered-publish
    label: la publicación atraviesa un intermediario que deja rastro de cada versión
    weight: 3
    predicate:
      op: path
      from:
        role: publishing-service
      to:
        role: edge
      via:
        type: [queue, stream]
    whyMissing: no hay un camino desde el servicio de publicación hasta la red de distribución que pase por una cola o por un registro de eventos.
    consequence: "cuando llegó la medida cautelar de la investigación anterior, el medio tardó nueve días en demostrar qué versión había estado publicada cada día. La nota se había editado catorce veces y no quedó rastro de ninguna. Lo que sale directo del servicio no deja huella; lo que pasa por el intermediario, sí."
  - id: g-no-shortcut
    label: el servicio de publicación no tiene ningún atajo hacia la salida
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: publishing-service
      to:
        type: [cdn, object-storage]
    whyMissing: el servicio de publicación escribe directo en la red de distribución o en un almacén de páginas, salteando el camino que deja rastro.
    consequence: "un atajo que existe se usa, y se usa justo el día del apuro. Con un solo camino de salida, 'qué se publicó' tiene una única respuesta; con dos, tenés que reconstruir cuál de los dos se usó cada vez, que es exactamente lo que costó nueve días."
  - id: g-buffer-observed
    label: alguien mira cuánto se acumula en ese intermediario
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: el intermediario del camino de publicación no está conectado a ningún componente de monitoreo.
    consequence: "se llena en silencio y descarta lo que no entra en su retención. El día que pase, la nota no se publica y nadie recibe un error: el sistema parece funcionar hasta que alguien pregunta por qué no está la nota."
  - id: g-story-store
    label: la nota sigue guardándose en la base de notas
    weight: 1
    predicate:
      op: path
      from:
        role: publishing-service
      to:
        role: story-store
    whyMissing: no quedó ningún camino desde el servicio de publicación hasta la base de notas.
    consequence: "el rastro del camino de publicación cuenta qué se publicó y cuándo. La base cuenta qué dice la nota hoy. Las dos cosas hacen falta: sin la primera no podés demostrar el pasado, sin la segunda no podés editar el presente."
rubric:
  - dimension: cada versión publicada deja rastro
    signal:
      kind: predicate
      guaranteeId: g-buffered-publish
  - dimension: existe un solo camino de salida y por eso una sola respuesta
    signal:
      kind: predicate
      guaranteeId: g-no-shortcut
  - dimension: el intermediario no se llena en silencio
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
  - dimension: el original sigue siendo editable
    signal:
      kind: predicate
      guaranteeId: g-story-store
referenceSolutions:
  - label: cola de publicaciones y publicador de fondo
    contextInversion: "la cola con un publicador de fondo se defiende cuando lo que importa es que cada publicación quede asentada y ordenada antes de existir en la calle: el mensaje entra, el publicador escribe la página, la red la sirve, y en el medio quedó registrada la operación. Al director periodístico le decís el número exacto: entre 40 segundos y 4 minutos más de demora, en una nota cuyo valor no vence en 40 segundos sino en el juicio de dentro de dos años. Lo que aceptás a cambio: la publicación deja de ser inmediata, el editor ya no ve el resultado de su botón en el momento, y va a preguntar todos los días si la nota salió."
    design:
      nodes:
        - id: lector
          type: actor
          label: Lector
          zone: public
        - id: sitio
          type: web-client
          label: Sitio del medio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: redaccion
          type: service
          label: Servicio de publicación
          zone: private
          role: publishing-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: notas
          type: database
          label: Base de notas
          zone: restricted
          role: story-store
          props: { backup: "diario", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de publicaciones
          zone: private
          props: { delivery: "at-least-once", dlq: "no", ordering: "no" }
        - id: publicador
          type: worker
          label: Publicador de fondo
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: estatico
          type: object-storage
          label: Almacén de páginas
          zone: private
          props: { durability: "99.999999999", access: "signed" }
        - id: borde
          type: cdn
          label: Red de distribución
          zone: dmz
          role: edge
          props: { cacheControl: "public, max-age=60" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-sitio
          from: { node: lector }
          to: { node: sitio }
          dataClass: public
        - id: sitio-gw
          from: { node: sitio }
          to: { node: gw }
          dataClass: public
        - id: gw-redaccion
          from: { node: gw }
          to: { node: redaccion }
          dataClass: public
        - id: redaccion-notas
          from: { node: redaccion }
          to: { node: notas }
          dataClass: public
        - id: redaccion-cola
          from: { node: redaccion }
          to: { node: cola }
          dataClass: public
        - id: cola-publicador
          from: { node: cola }
          to: { node: publicador }
          dataClass: public
        - id: publicador-estatico
          from: { node: publicador }
          to: { node: estatico }
          dataClass: public
        - id: estatico-borde
          from: { node: estatico }
          to: { node: borde }
          dataClass: public
        - id: redaccion-monitoreo
          from: { node: redaccion }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: registro releíble de versiones y servicio de publicación
    contextInversion: "el registro releíble se defiende cuando la pregunta futura no es sólo qué se publicó sino en qué orden y con qué contenido exacto en cada momento: un registro con orden y retención te deja reconstruir la línea de tiempo completa de las catorce ediciones, que es literalmente lo que pidió el juzgado. Que el consumidor sea un servicio y no un proceso de fondo agrega que el equipo legal puede consultar el estado de una publicación sin pedirle nada a nadie. Lo que aceptás a cambio: el registro guarda todo lo que pasó durante su retención, incluidas versiones que el medio preferiría no conservar, y esa retención es una decisión que el área legal va a querer discutir."
    design:
      nodes:
        - id: lector
          type: actor
          label: Lector
          zone: public
        - id: sitio
          type: web-client
          label: Sitio del medio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: redaccion
          type: service
          label: Servicio de publicación
          zone: private
          role: publishing-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: notas
          type: database
          label: Base de notas
          zone: restricted
          role: story-store
          props: { backup: "diario", consistency: "strong" }
        - id: versiones
          type: stream
          label: Registro de versiones publicadas
          zone: private
          props: { retention: "90d", partitions: "3", ordering: "sí" }
        - id: publicador
          type: service
          label: Servicio de publicación al borde
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: borde
          type: cdn
          label: Red de distribución
          zone: dmz
          role: edge
          props: { cacheControl: "public, max-age=60" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-sitio
          from: { node: lector }
          to: { node: sitio }
          dataClass: public
        - id: sitio-gw
          from: { node: sitio }
          to: { node: gw }
          dataClass: public
        - id: gw-redaccion
          from: { node: gw }
          to: { node: redaccion }
          dataClass: public
        - id: redaccion-notas
          from: { node: redaccion }
          to: { node: notas }
          dataClass: public
        - id: redaccion-versiones
          from: { node: redaccion }
          to: { node: versiones }
          dataClass: public
        - id: versiones-publicador
          from: { node: versiones }
          to: { node: publicador }
          dataClass: public
        - id: publicador-borde
          from: { node: publicador }
          to: { node: borde }
          dataClass: public
        - id: redaccion-monitoreo
          from: { node: redaccion }
          to: { node: monitoreo }
          dataClass: public
        - id: versiones-monitoreo
          from: { node: versiones }
          to: { node: monitoreo }
          dataClass: public
        - id: publicador-monitoreo
          from: { node: publicador }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

El mismo medio, el mismo servicio de publicación. Pero esta nota no compite
con nadie: es una investigación de ocho meses sobre contrataciones públicas,
con tres personas nombradas y sus abogados ya avisados.

Acá **nadie llega segundo**. Lo que sí llega, con alta probabilidad, es una
medida cautelar. El plazo judicial para retirar una publicación es de **24
horas**, y la pregunta que viene después no es si la retiraste: es **qué
versión exacta estuvo publicada cada día**.

La vez anterior el medio tardó **nueve días** en poder responder eso. La
nota se había editado catorce veces durante la semana y nadie guardó las
versiones intermedias. Nueve días de un equipo de tres personas
reconstruyendo desde capturas de pantalla y desde la memoria de la red de
distribución.

El director periodístico viene del cierre de la semana pasada con una
conclusión aprendida y correcta, *publicar directo, sin intermediarios*, y
la trae a esta reunión. En una primicia tenía razón. Acá no, y la diferencia
no es de criterio: es que **el valor de esta nota no vence en 40 segundos**.
Vence en el juicio de dentro de dos años. Diez minutos de demora no cuestan
nada; no poder demostrar qué se publicó cuesta el juicio.

Esa es la conversación que vas a tener que sostener: no le vas a decir que
se equivocó, le vas a decir dónde termina lo que aprendió.

La redacción sostiene **seis piezas** para este sistema.

**Armá el sistema** para que la publicación atraviese un intermediario que
deje rastro de cada versión, para que el servicio de publicación no tenga
ningún atajo hacia la salida, para que alguien mire cuánto se acumula en ese
intermediario, y para que la nota se siga guardando en la base.
