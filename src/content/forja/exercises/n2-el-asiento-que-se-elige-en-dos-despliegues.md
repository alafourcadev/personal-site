---
title: "El asiento que se elige en dos despliegues"
level: 2
role: core
domain: transporte
D1: 1
D2: 2
D3: 2
D4: 1
D5: 1
D6: 2
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué dos piezas de este sistema no pueden cambiar por separado, y cuál es la única que sí."
lambda: 0.5
constraints:
  - metric: pasajes vendidos por día
    operator: ">="
    value: 3100
    unit: pasajes/día
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: los cuatro últimos cambios de producto tocaron venta de pasajes y mapa de asientos al mismo tiempo. Fueron butaca cama, asiento contiguo para acompañante, bloqueo de la fila de emergencia y descuento por asiento de pasillo. Ninguno tocó sólo uno.
    discoveryPath: "hacé la lista de los últimos cambios del negocio y anotá al lado qué piezas hubo que tocar. Si la misma pareja aparece en todas las filas, no son dos piezas que colaboran: es una pieza con una frontera de más en el medio."
  - fact: el servicio de equipaje guarda su propia copia del viaje, con origen, destino y horario, y esa copia queda vieja cuando la empresa reprograma una salida por corte de ruta.
    discoveryPath: "buscá dos almacenamientos que guarden el mismo hecho. Uno de los dos va a estar viejo y nadie va a saber cuál, porque los dos responden con la misma seguridad."
  - fact: el cobro con tarjeta lo audita la marca de la tarjeta. El almacenamiento del cobro no puede compartir dueño con nada más, y la auditoría exige que la venta llegue al dato del cobro a través del servicio que responde por él.
    discoveryPath: "preguntate cuál de todas estas fronteras existe porque alguien de afuera la exige. Esa es la única que no se decide por comodidad del equipo, y por lo tanto la única que no se puede borrar para entrar en presupuesto."
startingDesign:
  nodes:
    - id: pasajero
      type: actor
      label: Pasajero
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la empresa
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: ventas
      type: service
      label: Servicio de venta de pasajes
      zone: private
      role: ticket-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: ventasdb
      type: database
      label: Base de pasajes
      zone: restricted
      role: ticket-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: asientos
      type: service
      label: Servicio de mapa de asientos
      zone: private
      role: seat-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: asientosdb
      type: database
      label: Base de asientos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: equipaje
      type: service
      label: Servicio de equipaje
      zone: private
      role: baggage-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: equipajedb
      type: database
      label: Base de equipaje
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
    - id: pagos
      type: service
      label: Servicio de cobros
      zone: private
      role: payment-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 630 }
    - id: pagosdb
      type: database
      label: Base de cobros
      zone: restricted
      role: payment-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 740 }
  edges:
    - id: pasajero-app
      from: { node: pasajero }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-ventas
      from: { node: gw }
      to: { node: ventas }
      dataClass: personal
    - id: ventas-ventasdb
      from: { node: ventas }
      to: { node: ventasdb }
      dataClass: personal
    - id: ventas-asientos
      from: { node: ventas }
      to: { node: asientos }
      dataClass: personal
    - id: asientos-asientosdb
      from: { node: asientos }
      to: { node: asientosdb }
      dataClass: personal
    - id: gw-equipaje
      from: { node: gw }
      to: { node: equipaje }
      dataClass: personal
    - id: equipaje-equipajedb
      from: { node: equipaje }
      to: { node: equipajedb }
      dataClass: personal
    - id: ventas-pagos
      from: { node: ventas }
      to: { node: pagos }
      dataClass: regulated
    - id: pagos-pagosdb
      from: { node: pagos }
      to: { node: pagosdb }
      dataClass: regulated
guarantees:
  - id: g-seat-not-a-hop
    label: elegir el asiento no es una llamada entre dos despliegues
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: ticket-service
      to:
        role: seat-service
    whyMissing: sigue habiendo una conexión desde el servicio de venta de pasajes hasta el servicio de mapa de asientos, y por lo tanto sigue habiendo dos despliegues coordinados por cada cambio de producto.
    consequence: "vender un pasaje y elegir la butaca son el mismo acto para el pasajero y para el negocio: cambian juntos siempre. Partidos, cada cambio cuesta dos pull requests, dos pruebas y una ventana de despliegue en la que alguien mira cuál de los dos quedó atrás."
  - id: g-ticket-owner
    label: el pasaje conserva su almacenamiento y su dueño
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [database]
            role: ticket-db
        - op: covered
          target:
            role: ticket-db
          by:
            role: ticket-service
    whyMissing: la base de pasajes no existe, o no está conectada al servicio de venta de pasajes.
    consequence: juntar responsabilidades no es borrar hasta entrar en presupuesto. Si desaparece el almacenamiento del pasaje, la empresa deja de saber quién viaja, que es lo único que este sistema existe para saber.
  - id: g-passenger-still-buys
    label: el pasajero sigue llegando al servicio de venta
    weight: 2
    predicate:
      op: path
      from:
        type: [actor]
      to:
        role: ticket-service
    whyMissing: no hay ningún camino desde el pasajero hasta el servicio de venta de pasajes.
    consequence: "un sistema que entra en presupuesto porque ya nadie puede comprar no resolvió el problema: lo canceló. La puerta por la que entra la gente es parte del sistema, no un adorno del diagrama."
  - id: g-payment-through-owner
    label: la venta llega al dato del cobro a través de quien responde por él
    weight: 2
    predicate:
      op: path
      from:
        role: ticket-service
      to:
        role: payment-db
      via:
        role: payment-service
    whyMissing: no hay ningún camino desde el servicio de venta de pasajes hasta la base de cobros que atraviese el servicio de cobros.
    consequence: "esta frontera no la puso el equipo por comodidad: la exige la marca de la tarjeta, y en una auditoría hay que poder mostrar qué pieza tocó el dato del cobro y cuándo. Una frontera que existe porque alguien de afuera la exige no se borra para entrar en presupuesto: se borran las otras."
rubric:
  - dimension: lo que cambia siempre junto deja de estar partido
    signal:
      kind: predicate
      guaranteeId: g-seat-not-a-hop
  - dimension: el pasaje conserva un dueño explícito después de consolidar
    signal:
      kind: predicate
      guaranteeId: g-ticket-owner
  - dimension: la frontera que exige un tercero sobrevive al recorte
    signal:
      kind: predicate
      guaranteeId: g-payment-through-owner
referenceSolutions:
  - label: una sola venta, con el mapa de asientos y el equipaje adentro
    contextInversion: "juntarlo todo menos el cobro es lo correcto en un equipo de tres personas que hoy paga dos despliegues coordinados por cada cambio de producto: el pasaje, la butaca y el bulto son partes del mismo acto de venta y se mueven juntos en cada campaña. Se paga con que el mostrador de equipaje comparte destino de despliegue con la venta, así que un error en el pesaje de bultos ahora puede frenar una publicación de tarifas."
    design:
      nodes:
        - id: pasajero
          type: actor
          label: Pasajero
          zone: public
        - id: app
          type: mobile-client
          label: App de la empresa
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de venta de pasajes
          zone: private
          role: ticket-service
          props: { criticality: "medium", replicas: "2" }
        - id: ventasdb
          type: database
          label: Base de pasajes
          zone: restricted
          role: ticket-db
          props: { backup: "diario" }
        - id: pagos
          type: service
          label: Servicio de cobros
          zone: private
          role: payment-service
          props: { criticality: "medium", replicas: "2" }
        - id: pagosdb
          type: database
          label: Base de cobros
          zone: restricted
          role: payment-db
          props: { backup: "diario" }
      edges:
        - id: pasajero-app
          from: { node: pasajero }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: ventas-ventasdb
          from: { node: ventas }
          to: { node: ventasdb }
          dataClass: personal
        - id: ventas-pagos
          from: { node: ventas }
          to: { node: pagos }
          dataClass: regulated
        - id: pagos-pagosdb
          from: { node: pagos }
          to: { node: pagosdb }
          dataClass: regulated
  - label: el equipaje sigue siendo su propia pieza, pero sin almacenamiento propio
    contextInversion: "dejar el equipaje aparte conviene cuando el mostrador tiene su propio ritmo: opera en terminal, con lectores de código y personal que no es el de venta, y sus incidencias no pueden competir con la venta en hora pico. Eso sí, sin darle almacenamiento: el viaje lo sigue teniendo un solo dueño y la copia que se desincronizaba cuando se reprograma una salida desaparece. Se paga con la unidad operativa de esa pieza y con una llamada entre despliegues donde antes había una consulta local."
    design:
      nodes:
        - id: pasajero
          type: actor
          label: Pasajero
          zone: public
        - id: app
          type: mobile-client
          label: App de la empresa
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de venta de pasajes
          zone: private
          role: ticket-service
          props: { criticality: "medium", replicas: "2" }
        - id: ventasdb
          type: database
          label: Base de pasajes
          zone: restricted
          role: ticket-db
          props: { backup: "diario" }
        - id: equipaje
          type: service
          label: Servicio de equipaje
          zone: private
          role: baggage-service
          props: { criticality: "medium", replicas: "2" }
        - id: pagos
          type: service
          label: Servicio de cobros
          zone: private
          role: payment-service
          props: { criticality: "medium", replicas: "2" }
        - id: pagosdb
          type: database
          label: Base de cobros
          zone: restricted
          role: payment-db
          props: { backup: "diario" }
      edges:
        - id: pasajero-app
          from: { node: pasajero }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: ventas-ventasdb
          from: { node: ventas }
          to: { node: ventasdb }
          dataClass: personal
        - id: gw-equipaje
          from: { node: gw }
          to: { node: equipaje }
          dataClass: personal
        - id: equipaje-ventas
          from: { node: equipaje }
          to: { node: ventas }
          dataClass: personal
        - id: ventas-pagos
          from: { node: ventas }
          to: { node: pagos }
          dataClass: regulated
        - id: pagos-pagosdb
          from: { node: pagos }
          to: { node: pagosdb }
          dataClass: regulated
status: PILOT
---

Una empresa de ómnibus de larga distancia vende **3.100 pasajes por día**.
Hace tres años el sistema era uno solo. Alguien propuso separarlo por
responsabilidades y quedó partido en cuatro: venta de pasajes, mapa de
asientos, equipaje y cobros. Cada uno con su base de datos.

Los cuatro últimos cambios de producto tocaron **venta y asientos al mismo
tiempo**: butaca cama, asiento contiguo para el acompañante, bloqueo de la fila
de emergencia y descuento por asiento de pasillo. Ninguno tocó sólo uno.
Cada uno costó dos pull requests, dos despliegues coordinados y una tarde de
alguien revisando cuál de los dos había quedado atrás.

Equipaje guarda su propia copia del viaje: origen, destino y horario. Cuando la
empresa reprograma una salida por corte de ruta, la copia queda vieja hasta la
próxima sincronización, y el mostrador de la terminal despacha bultos contra un
horario que ya no existe.

Cobros es otra cosa. El cobro con tarjeta lo **audita la marca de la tarjeta**,
y la auditoría pide poder mostrar qué pieza tocó el dato del cobro y cuándo. Esa
frontera no la eligió el equipo.

El equipo son **tres personas** y su capacidad real es de **6 unidades
operativas**. Hoy el sistema usa **9**. No es una opinión: es la cantidad de
piezas que hay que actualizar, monitorear y respaldar cada semana.

**Rearmá el sistema** para que lo que siempre cambia junto viva junto, para que
el pasaje tenga un solo dueño, y para que el dato del cobro se siga alcanzando
sólo por el suyo. Vas a tener que **sacar piezas**, no agregarlas.
