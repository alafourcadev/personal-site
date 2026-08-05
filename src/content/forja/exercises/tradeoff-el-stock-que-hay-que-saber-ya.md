---
title: "El stock que hay que saber ya"
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
aiBudget: libre — pero la respuesta tiene que explicar por qué acá conviene una llamada directa, no una cola.
lambda: 0.5
constraints:
  - metric: tiempo aceptable para saber si hay stock, antes de cobrar
    operator: "<="
    value: 300
    unit: ms
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: opsUnits
hiddenFacts:
  - fact: si el checkout cobra antes de confirmar el stock, un producto que se agotó hace 10 segundos genera un reembolso manual y un cliente enojado.
    discoveryPath: es la razón por la que el checkout necesita la respuesta de inventario ANTES de seguir, no en algún momento después.
guarantees:
  - id: g-immediate-answer
    label: el checkout sabe si hay stock antes de seguir, no en algún momento después
    weight: 2
    predicate:
      op: path
      from:
        role: checkout-service
      to:
        role: inventory-service
      forbid:
        type: [queue, stream]
    whyMissing: no hay un camino directo (sin cola ni stream en el medio) desde el checkout hasta el inventario.
    consequence: el checkout puede cobrar sin saber si el producto todavía existe en stock — el reembolso se resuelve después, pero el cliente ya vivió el error.
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
    consequence: si la consulta de stock empieza a fallar, el equipo se entera por el volumen de reclamos, no por una alerta.
rubric:
  - dimension: el checkout obtiene la respuesta de stock antes de continuar
    signal:
      kind: predicate
      guaranteeId: g-immediate-answer
referenceSolutions:
  - label: llamada directa a inventario
    contextInversion: la variante mínima — un solo salto síncrono, suficiente cuando el checkout sólo necesita esa respuesta y nada más.
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
        - id: checkout-inventario
          from: { node: checkout }
          to: { node: inventario }
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
  - label: llamada directa, con un chequeo de precio en el medio
    contextInversion: cuando el checkout también necesita el precio vigente en el mismo instante — sigue siendo síncrono de punta a punta, un salto más.
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
        - id: precios
          type: service
          label: Servicio de precios
          zone: private
          props: { criticality: "medium", replicas: "1" }
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
        - id: checkout-precios
          from: { node: checkout }
          to: { node: precios }
        - id: precios-inventario
          from: { node: precios }
          to: { node: inventario }
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
status: PILOT
---

El checkout de una tienda online necesita saber, **en el instante en que el
comprador confirma la compra**, si el producto todavía tiene stock. La
regla del negocio es simple: nunca cobrar un producto que ya se agotó.

El equipo midió el costo de equivocarse: cuando el checkout cobra sin
confirmar stock primero, el resultado es un reembolso manual y un correo
de disculpas — pasa unas 40 veces por semana en el volumen actual, y cada
uno le cuesta al equipo de soporte una conversación incómoda.

**El comprador no tolera más de 300 milisegundos de demora** antes de ver
la confirmación — es el límite que el equipo de producto midió antes de
que la tasa de abandono del carrito empiece a subir.

**Armá el sistema** para que el checkout tenga la respuesta de inventario
antes de seguir adelante, no en algún momento después.
