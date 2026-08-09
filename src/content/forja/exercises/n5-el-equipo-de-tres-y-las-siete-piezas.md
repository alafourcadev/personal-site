---
title: "El equipo de tres y las siete piezas"
level: 5
role: core
domain: soporte
D1: 1
D2: 3
D3: 3
D4: 1
D5: 2
D6: 3
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que nombrar la pieza que sacaste y decir qué se pierde al sacarla. Una respuesta que sólo agrega no resolvió este ejercicio."
lambda: 0.5
constraints:
  - metric: tickets abiertos por día
    operator: ">="
    value: 1900
    unit: tickets/día
  - metric: personas que operan el sistema
    operator: "="
    value: 3
    unit: personas
hiddenFacts:
  - fact: la caché de la lista de tickets ahorra 180 milisegundos en una pantalla que el agente abre una vez por sesión. Nadie midió nunca si alguien lo nota.
    discoveryPath: "es la pieza con el ratio peor de todo el sistema: cuesta lo mismo operar que la base y compra el ahorro más chico. Si tenés que sacar una, empezá midiendo qué compra cada una."
  - fact: el servicio de avisos no hace nada más que traducir un ticket a un mensaje y pasárselo al proveedor. No guarda estado y no lo llama nadie más.
    discoveryPath: "abrí el camino que recorre un aviso y contá cuántas piezas lo tocan sin cambiar nada. Un intermediario que sólo reenvía es una pieza que se puede plegar sobre la que ya tenés."
startingDesign:
  nodes:
    - id: usuario
      type: actor
      label: Usuario
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
      position: { x: 445, y: 520 }
    - id: cachelista
      type: cache
      label: Caché de la lista de tickets
      zone: private
      given: true
      props: { ttl: "300", eviction: "lru" }
      position: { x: 805, y: 630 }
    - id: cola
      type: queue
      label: Cola de avisos
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 410 }
    - id: despachador
      type: worker
      label: Despachador de avisos
      zone: private
      given: true
      position: { x: 445, y: 410 }
    - id: avisos
      type: service
      label: Servicio de avisos
      zone: private
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 630 }
    - id: basetickets
      type: database
      label: Base de tickets
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: proveedor
      type: external-provider
      label: Proveedor de mensajería
      zone: dmz
      role: notifier
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: usuario-portal
      from: { node: usuario }
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
    - id: tickets-cachelista
      from: { node: tickets }
      to: { node: cachelista }
      dataClass: public
    - id: tickets-basetickets
      from: { node: tickets }
      to: { node: basetickets }
      dataClass: personal
    - id: tickets-cola
      from: { node: tickets }
      to: { node: cola }
      dataClass: personal
    - id: cola-despachador
      from: { node: cola }
      to: { node: despachador }
      dataClass: personal
    - id: despachador-avisos
      from: { node: despachador }
      to: { node: avisos }
      dataClass: personal
    - id: avisos-proveedor
      from: { node: avisos }
      to: { node: proveedor }
      dataClass: personal
guarantees:
  - id: g-services-observed
    label: todos los servicios del sistema reportan lo que les pasa
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: la detección funciona a medias, que en operación es igual que no funcionar. El incidente que te rompe el trimestre siempre empieza en la pieza que no estabas mirando.
  - id: g-buffer-observed
    label: alguien mira cuánto trabajo se está acumulando
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza donde se acumulan los avisos pendientes no está conectada a ningún componente de monitoreo.
    consequence: los avisos se acumulan y el sistema no se queja. Los agentes atienden tickets normalmente mientras los usuarios no reciben ninguna respuesta.
  - id: g-notice-durable
    label: el aviso al usuario sobrevive a un reinicio del servicio de tickets
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: ticket-service
      to:
        role: notifier
    whyMissing: no hay ninguna pieza durable entre el servicio de tickets y el proveedor de mensajería. Si el proceso se reinicia después de guardar el ticket y antes de mandar el aviso, ese aviso no existe en ningún lado.
    consequence: el ticket queda abierto y el usuario nunca se entera de que lo abrieron. Vuelve a escribir, se duplica el ticket, y el equipo atiende el mismo problema dos veces.
rubric:
  - dimension: la cobertura de señal es completa, no parcial
    signal:
      kind: predicate
      guaranteeId: g-services-observed
  - dimension: la acumulación de avisos pendientes es visible
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
  - dimension: el aviso sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-notice-durable
referenceSolutions:
  - label: sacar la caché para poder mirar el resto
    contextInversion: "sacar la caché es lo correcto cuando lo que compra es chico y medible: 180 milisegundos en una pantalla que se abre una vez por sesión. Se paga con una consulta más a la base en cada listado, que a 1.900 tickets por día la base absorbe sin despeinarse. Conservás los dos servicios separados, así que el equipo que mantiene los avisos puede desplegar sin tocar el servicio de tickets."
    design:
      nodes:
        - id: usuario
          type: actor
          label: Usuario
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
        - id: cola
          type: queue
          label: Cola de avisos
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachador
          type: worker
          label: Despachador de avisos
          zone: private
        - id: avisos
          type: service
          label: Servicio de avisos
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: basetickets
          type: database
          label: Base de tickets
          zone: restricted
          props: { backup: "diario" }
        - id: proveedor
          type: external-provider
          label: Proveedor de mensajería
          zone: dmz
          role: notifier
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: usuario-portal
          from: { node: usuario }
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
        - id: tickets-basetickets
          from: { node: tickets }
          to: { node: basetickets }
          dataClass: personal
        - id: tickets-cola
          from: { node: tickets }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-avisos
          from: { node: despachador }
          to: { node: avisos }
          dataClass: personal
        - id: avisos-proveedor
          from: { node: avisos }
          to: { node: proveedor }
          dataClass: personal
        - id: tickets-monitoreo
          from: { node: tickets }
          to: { node: monitoreo }
          dataClass: public
        - id: avisos-monitoreo
          from: { node: avisos }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: plegar el servicio de avisos sobre el despachador
    contextInversion: "sacar el servicio de avisos es lo correcto cuando ese servicio no guarda estado, no lo llama nadie más y sólo traduce un ticket en un mensaje: el despachador ya está ahí y puede hacer esa traducción sin una pieza intermedia. Conservás la caché, que en un catálogo de tickets muy leído sí paga. Se pierde el límite de despliegue independiente entre avisos y el resto, y una falla del proveedor de mensajería ahora se ve en el mismo proceso que consume la cola."
    design:
      nodes:
        - id: usuario
          type: actor
          label: Usuario
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
        - id: cachelista
          type: cache
          label: Caché de la lista de tickets
          zone: private
          props: { ttl: "300", eviction: "lru" }
        - id: cola
          type: queue
          label: Cola de avisos
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachador
          type: worker
          label: Despachador de avisos
          zone: private
        - id: basetickets
          type: database
          label: Base de tickets
          zone: restricted
          props: { backup: "diario" }
        - id: proveedor
          type: external-provider
          label: Proveedor de mensajería
          zone: dmz
          role: notifier
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: usuario-portal
          from: { node: usuario }
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
        - id: tickets-cachelista
          from: { node: tickets }
          to: { node: cachelista }
          dataClass: public
        - id: tickets-basetickets
          from: { node: tickets }
          to: { node: basetickets }
          dataClass: personal
        - id: tickets-cola
          from: { node: tickets }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-proveedor
          from: { node: despachador }
          to: { node: proveedor }
          dataClass: personal
        - id: tickets-monitoreo
          from: { node: tickets }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: despachador-monitoreo
          from: { node: despachador }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una plataforma de soporte interno abre **1.900 tickets por día**. La operan
**tres personas**, y esas tres personas también escriben el producto.

El sistema, hoy, tiene siete piezas que hay que mantener despiertas: la
puerta de entrada, el servicio de tickets, la caché de la lista, la cola de
avisos, el despachador, el servicio de avisos y la base. **Siete unidades
operativas, y el presupuesto del equipo es exactamente siete.**

No hay ninguna señal. Cero. Cuando algo falla, el primer aviso es un
mensaje en el canal de la empresa que dice "che, ¿soporte anda?".

El equipo quiere monitoreo. Un componente de monitoreo cuesta **una unidad
operativa más**, y eso los pone en ocho sobre un presupuesto de siete. El
gerente fue claro y tiene razón: no van a contratar a nadie, y un sistema
que las tres personas no pueden sostener es un sistema que se degrada solo,
tenga el diagrama que tenga.

Así que el ejercicio no es "agregá monitoreo". Es este:

**Hacé entrar la señal dentro del presupuesto que ya tenés.** Algo tiene
que salir para que algo pueda entrar. Los tres pedidos no se negocian: que
todos los servicios reporten, que la acumulación de avisos pendientes sea
visible, y que el aviso al usuario sobreviva a un reinicio del servicio de
tickets.

Mirá cada pieza y preguntate qué compra y a qué precio. Después sacá la que
pierde esa cuenta.
