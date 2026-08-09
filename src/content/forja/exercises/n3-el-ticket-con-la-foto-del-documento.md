---
title: "El ticket con la foto del documento"
level: 3
role: calibration
domain: soporte
D1: 0
D2: 1
D3: 2
D4: 0
D5: 2
D6: 0
D7: 0
D8: 0
D9: 1
prerequisiteLevels: [2]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué le pasa a la foto del documento cuando la caché se reinicia un domingo a la madrugada."
lambda: 0.5
constraints:
  - metric: tickets con adjunto por día
    operator: ">="
    value: 600
    unit: tickets
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "la caché de adjuntos descarta lo que no se pidió en cinco minutos, y se vacía entero cada vez que el proceso se reinicia. No es una falla de la caché: es exactamente para lo que sirve."
    discoveryPath: "dejá la foto del documento entrando a la caché y probá tu respuesta: el motor rechaza el diseño entero y te explica por qué un dato personal no puede tener como única casa un almacenamiento que se borra."
  - fact: "la base de tickets ya existe y está paga desde febrero. Nadie la conectó porque la caché 'andaba bien'."
    discoveryPath: "está en el lienzo desde que abrís el ejercicio, sin ninguna conexión. Que una pieza esté suelta no significa que sobre: significa que alguien la puso y no terminó el trabajo."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente que reclama
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de soporte
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: tickets
      type: service
      label: Servicio de tickets
      zone: private
      role: ticket-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: memoria
      type: cache
      label: Caché de adjuntos
      zone: private
      given: true
      position: { x: 805, y: 300 }
    - id: basetickets
      type: database
      label: Base de tickets (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: cliente-portal
      from: { node: cliente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-tickets
      from: { node: gw }
      to: { node: tickets }
      dataClass: personal
    - id: tickets-memoria
      from: { node: tickets }
      to: { node: memoria }
      dataClass: personal
guarantees:
  - id: g-adjunto-durable
    label: el ticket y su adjunto quedan guardados en un lugar que sobrevive a un reinicio
    weight: 2
    predicate:
      op: path
      from:
        role: ticket-service
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de tickets hasta una base de datos, así que el único lugar donde hoy existe la foto del documento es un almacenamiento que se vacía solo.
    consequence: el lunes a la mañana el agente abre el ticket y el adjunto no está. El cliente tiene que volver a sacar la foto de su documento y mandarla de nuevo, y esa es la segunda vez que un dato personal viaja sin necesidad.
  - id: g-nada-personal-en-cache
    label: el dato personal del cliente no viaja hacia un almacenamiento volátil
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: ticket-service
      to:
        type: [cache]
    whyMissing: el servicio de tickets sigue mandando la foto del documento a la caché de adjuntos.
    consequence: un almacenamiento volátil no promete conservar nada y no tiene por qué prometerlo. Si el dato personal está ahí y en ningún otro lado, la obligación de conservarlo la incumpliste sin enterarte.
rubric:
  - dimension: el adjunto del cliente existe después de un reinicio
    signal:
      kind: predicate
      guaranteeId: g-adjunto-durable
  - dimension: la clase de dato decide dónde puede vivir
    signal:
      kind: predicate
      guaranteeId: g-nada-personal-en-cache
referenceSolutions:
  - label: la base guarda el ticket y su adjunto
    contextInversion: "guardar todo en la base es lo correcto cuando los adjuntos son livianos y pocos, una foto por ticket y seiscientos tickets por día, porque no agrega ninguna pieza nueva para operar y el ticket y su adjunto se borran juntos el día que hay que borrarlos. Se paga con una base que crece con archivos binarios, que es la razón por la que a los diez mil adjuntos por día esta decisión se revisa."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente que reclama
          zone: public
        - id: portal
          type: web-client
          label: Portal de soporte
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tickets
          type: service
          label: Servicio de tickets
          zone: private
          role: ticket-service
          props: { criticality: "high", replicas: "2" }
        - id: basetickets
          type: database
          label: Base de tickets (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-tickets
          from: { node: gw }
          to: { node: tickets }
          dataClass: personal
        - id: tickets-base
          from: { node: tickets }
          to: { node: basetickets }
          dataClass: personal
  - label: el archivo de objetos guarda la foto y la base guarda el ticket
    contextInversion: "separar el archivo del registro conviene cuando el adjunto pesa y se lee poco: el almacenamiento de objetos no suma carga operativa, la base queda liviana y el respaldo de la base sigue tardando lo mismo. Se paga con dos lugares donde puede quedar el rastro de un cliente, y eso significa que el día que hay que borrar un dato personal hay que acordarse de los dos."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente que reclama
          zone: public
        - id: portal
          type: web-client
          label: Portal de soporte
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tickets
          type: service
          label: Servicio de tickets
          zone: private
          role: ticket-service
          props: { criticality: "high", replicas: "2" }
        - id: basetickets
          type: database
          label: Base de tickets (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de adjuntos
          zone: private
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-tickets
          from: { node: gw }
          to: { node: tickets }
          dataClass: personal
        - id: tickets-base
          from: { node: tickets }
          to: { node: basetickets }
          dataClass: personal
        - id: tickets-archivo
          from: { node: tickets }
          to: { node: archivo }
          dataClass: personal
status: PILOT
---

Una mesa de ayuda de una empresa de servicios. Cuando un cliente reclama un
cobro, el portal le pide una **foto de su documento** para verificar la
identidad. Son unos **600 tickets con adjunto por día**.

El servicio de tickets guarda esa foto en una caché de adjuntos. Lo hicieron
así hace dos años porque era lo que había a mano y porque abrir el ticket
quedaba rapidísimo. Funciona: el agente abre el reclamo y ve la foto al
instante.

El **lunes 3** el proceso se reinició por una actualización de rutina. Esa
mañana **41 tickets abiertos** aparecieron sin adjunto. Soporte le escribió a
41 personas para pedirles otra vez la foto de su documento. Nueve
contestaron.

La base de tickets existe, está paga desde febrero y hace respaldo todos los
días. Está en el lienzo, sin una sola conexión.

**Rearmá el sistema** para que la foto del documento quede en un lugar que
sobreviva a un reinicio, y para que el dato personal del cliente deje de tener
como única casa un almacenamiento cuyo trabajo es olvidar.
