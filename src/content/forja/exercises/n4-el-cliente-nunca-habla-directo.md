---
title: "El cliente nunca habla directo con el servicio"
level: 4
role: calibration
domain: onboarding
D1: 1
D2: 0
D3: 2
D4: 0
D5: 2
D6: 0
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [3]
budget:
  opsUnits: 4
aiBudget: libre. Este ejercicio enseña vocabulario, no hay nada que la IA pueda hacer mal acá.
lambda: 0.5
constraints:
  - metric: componentes mínimos en la respuesta
    operator: ">="
    value: 3
    unit: componentes
hiddenFacts:
  - fact: el motor rechaza cualquier conexión directa entre un cliente y un servicio, sin excepción.
    discoveryPath: intentá conectar el cliente directo al servicio. El motor te va a decir exactamente por qué no puede aceptar esa conexión, antes incluso de que termines de armar el diseño.
startingDesign:
  nodes:
    - id: mc
      type: mobile-client
      label: Cliente móvil
      zone: public
      given: true
      position: { x: 445, y: 80 }
  edges: []
guarantees:
  - id: g-no-direct
    label: el cliente nunca llama directo al servicio
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [mobile-client]
      to:
        type: [service]
    whyMissing: hay una conexión directa entre el cliente y el servicio.
    consequence: el servicio queda expuesto a una red que no controlás. Cualquiera que hable el protocolo correcto puede llamarlo.
  - id: g-through-gateway
    label: el cliente llega al servicio a través de la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [mobile-client]
      to:
        type: [service]
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el cliente hasta el servicio que pase por la puerta de entrada.
    consequence: sin puerta de entrada no hay autenticación ni límite de tasa antes de que el pedido llegue al servicio.
rubric:
  - dimension: usa la puerta de entrada en vez de conectar directo
    signal:
      kind: predicate
      guaranteeId: g-through-gateway
referenceSolutions:
  - label: un cliente móvil
    contextInversion: un único cliente, sin variantes. No hay contexto que invierta la elección acá; la puerta de entrada siempre va en el medio.
    design:
      nodes:
        - id: mc
          type: mobile-client
          label: Cliente móvil
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: svc
          type: service
          label: Servicio
          zone: private
      edges:
        - id: mc-gw
          from: { node: mc }
          to: { node: gw }
        - id: gw-svc
          from: { node: gw }
          to: { node: svc }
  - label: cliente móvil y cliente web, ambos por la misma puerta
    contextInversion: dos clientes en vez de uno. La topología cambia, la regla de fondo no.
    design:
      nodes:
        - id: mc
          type: mobile-client
          label: Cliente móvil
          zone: public
        - id: wc
          type: web-client
          label: Cliente web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: svc
          type: service
          label: Servicio
          zone: private
      edges:
        - id: mc-gw
          from: { node: mc }
          to: { node: gw }
        - id: wc-gw
          from: { node: wc }
          to: { node: gw }
        - id: gw-svc
          from: { node: gw }
          to: { node: svc }
status: PILOT
---

Un cliente (móvil o web) necesita hablar con un servicio interno. No hay
negocio todavía en este ejercicio. Es la mecánica de nivel 4: cómo se
conecta lo público con lo privado.

**Armá el sistema con dos reglas: nunca conectes el cliente directo al
servicio, y hacelo pasar siempre por una puerta de entrada.**

El motor te avisa apenas intentás la conexión directa. No hace falta que
termines de armar el diseño para ver por qué está mal. Esa es la idea: acá
no se evalúa criterio, se aprende el gesto y el vocabulario que vas a usar
en el resto del nivel.
