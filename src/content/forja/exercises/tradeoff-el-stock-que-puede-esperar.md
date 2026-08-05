---
title: "El stock que puede esperar"
level: 4
role: tradeoff
domain: checkout
tradeoffPairId: checkout-consulta-de-stock
D1: 2
D2: 2
D3: 2
D4: 1
D5: 1
D6: 2
D7: 2
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 8
aiBudget: libre — pero la respuesta tiene que explicar por qué acá conviene una cola, no una llamada directa.
lambda: 0.5
constraints:
  - metric: descuentos de stock por Black Friday, pico
    operator: ">="
    value: 12000
    unit: descuentos/hora
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: opsUnits
hiddenFacts:
  - fact: el servicio de inventario soporta cómodamente 600 llamadas síncronas por hora — 20 veces menos que el pico de Black Friday.
    discoveryPath: es la cuenta que explica por qué la misma llamada directa que funcionaba en el ejercicio anterior acá tumba al servicio de inventario.
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 28, y: 80 }
    - id: web
      type: web-client
      label: Tienda online
      zone: public
      given: true
      position: { x: 388, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 388, y: 190 }
    - id: checkout
      type: service
      label: Servicio de checkout
      zone: private
      role: checkout-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 388, y: 300 }
    - id: inventario
      type: service
      label: Servicio de inventario
      zone: private
      role: inventory-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 388, y: 410 }
  edges:
    - id: comprador-web
      from: { node: comprador }
      to: { node: web }
    - id: web-gw
      from: { node: web }
      to: { node: gw }
    - id: gw-checkout
      from: { node: gw }
      to: { node: checkout }
guarantees:
  - id: g-decoupled
    label: el checkout avisa a inventario sin depender de que responda al toque
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: checkout-service
      to:
        role: inventory-service
    whyMissing: no hay ningún componente durable entre el checkout y el aviso a inventario — si el checkout llama directo y algo se reinicia en el medio, el descuento de stock se pierde.
    consequence: en el pico de Black Friday, una llamada directa satura al servicio de inventario y arrastra al checkout con él — o, si se pierde el aviso, el stock queda mal contado hasta la próxima auditoría.
  - id: g-observability
    label: el checkout está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: checkout-service
      by:
        type: [observability]
    whyMissing: el servicio de checkout no está conectado a ningún componente de observabilidad.
    consequence: si el descuento de stock empieza a acumularse sin procesar, el equipo se entera por una auditoría de stock, días después.
rubric:
  - dimension: el aviso de descuento de stock sobrevive a un reinicio del checkout
    signal:
      kind: predicate
      guaranteeId: g-decoupled
referenceSolutions:
  - label: cola de descuentos de stock
    contextInversion: la elección clásica cuando el equipo ya opera colas y el volumen es alto pero no necesita procesarse en un orden estricto.
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: checkout
          type: service
          label: Servicio de checkout
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de descuentos de stock
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: actualizador
          type: worker
          label: Actualizador de inventario
          zone: private
        - id: inventario
          type: service
          label: Servicio de inventario
          zone: private
          role: inventory-service
          props: { criticality: "high", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-web
          from: { node: comprador }
          to: { node: web }
        - id: web-gw
          from: { node: web }
          to: { node: gw }
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
        - id: checkout-cola
          from: { node: checkout }
          to: { node: cola }
        - id: cola-actualizador
          from: { node: cola }
          to: { node: actualizador }
        - id: actualizador-inventario
          from: { node: actualizador }
          to: { node: inventario }
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
  - label: stream de eventos de venta
    contextInversion: un stream conviene cuando otro sistema (analítica de demanda, reposición automática) también necesita leer el mismo evento de venta, no sólo inventario.
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: app
          type: mobile-client
          label: App de compras
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: checkout
          type: service
          label: Servicio de checkout
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Stream de ventas
          zone: private
          props: { retention: "7d", partitions: "6" }
        - id: actualizador
          type: worker
          label: Actualizador de inventario
          zone: private
        - id: inventario
          type: service
          label: Servicio de inventario
          zone: private
          role: inventory-service
          props: { criticality: "high", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-app
          from: { node: comprador }
          to: { node: app }
        - id: app-gw
          from: { node: app }
          to: { node: gw }
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
        - id: checkout-eventos
          from: { node: checkout }
          to: { node: eventos }
        - id: eventos-actualizador
          from: { node: eventos }
          to: { node: actualizador }
        - id: actualizador-inventario
          from: { node: actualizador }
          to: { node: inventario }
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
status: PILOT
---

El mismo checkout, el mismo servicio de inventario que el ejercicio
anterior. Pero ahora es **Black Friday**: el pico llega a **12.000
descuentos de stock por hora** — 20 veces el volumen normal, y 20 veces más
de lo que el servicio de inventario aguanta si cada uno le llega como una
llamada síncrona.

Esta vez el checkout **no necesita saber el resultado al instante**: el
descuento de stock se puede procesar un segundo después, dos segundos
después, no cambia la experiencia del comprador — la compra ya se
confirmó con otro chequeo, este paso sólo actualiza el conteo.

**Armá el sistema** para que el aviso de descuento de stock no dependa de
que el servicio de inventario responda al toque, y sobreviva aunque el
checkout se reinicie en el medio.
