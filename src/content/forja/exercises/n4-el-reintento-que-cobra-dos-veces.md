---
title: "El reintento que cobra dos veces"
level: 4
role: core
domain: pagos
D1: 1
D2: 1
D3: 2
D4: 1
D5: 1
D6: 1
D7: 2
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 8
aiBudget: libre.
lambda: 0.5
constraints:
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: en una red inestable el cliente reintenta automáticamente cuando no recibe respuesta a tiempo.
    discoveryPath: el motor marca el hallazgo de reintentos sin idempotencia apenas conectás un cliente intermitente a un servicio que no declara ser idempotente.
startingDesign:
  nodes:
    - id: cliente
      type: mobile-client
      label: Cliente móvil
      zone: public
      given: true
      props: { connectivity: "intermittent" }
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: pagos
      type: service
      label: Servicio de pagos
      zone: private
      role: payment-service
      given: true
      props: { idempotent: "no" }
      position: { x: 445, y: 300 }
  edges:
    - id: cliente-gw
      from: { node: cliente }
      to: { node: gw }
    - id: gw-pagos
      from: { node: gw }
      to: { node: pagos }
guarantees:
  - id: g-idempotent
    label: el servicio de pagos es idempotente ante reintentos
    weight: 2
    predicate:
      op: ruleSilent
      rule: intermittent-client-without-idempotency
    whyMissing: hay un cliente de conectividad intermitente llegando a un servicio que no declara ser idempotente.
    consequence: cada reintento del cliente se procesa como un cobro nuevo. Salen cobros duplicados, sin que el cliente haya hecho nada raro.
  - id: g-payment-still-there
    label: el cobro se sigue atendiendo
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: payment-service
        - op: path
          from:
            type: [api-gateway]
          to:
            role: payment-service
    whyMissing: el servicio de pagos desapareció del diseño, o ya no se llega a él desde la puerta de entrada.
    consequence: "sin el servicio de pagos no hay reintento duplicado porque no hay cobro. Borrar la pieza que molesta calla el problema en el dibujo y lo deja entero en el negocio."
rubric:
  - dimension: un reintento del cliente no genera un cobro duplicado
    signal:
      kind: predicate
      guaranteeId: g-idempotent
  - dimension: el cobro sigue existiendo después del arreglo
    signal:
      kind: predicate
      guaranteeId: g-payment-still-there
referenceSolutions:
  - label: servicio de pagos idempotente
    contextInversion: borrador. Todavía no tiene una segunda solución estructuralmente distinta ni la validación de idempotencia completa; no se publica hasta pasar por PILOT.
    design:
      nodes:
        - id: cliente
          type: mobile-client
          label: Cliente móvil
          zone: public
          props: { connectivity: "intermittent" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: payment-service
          props: { idempotent: "sí" }
      edges:
        - id: cliente-gw
          from: { node: cliente }
          to: { node: gw }
        - id: gw-pagos
          from: { node: gw }
          to: { node: pagos }
  - label: variante mínima, sólo cambia el tipo de cliente
    contextInversion: borrador. Variante provisoria mientras se define un segundo enfoque genuinamente distinto.
    design:
      nodes:
        - id: cliente
          type: web-client
          label: Cliente web
          zone: public
          props: { connectivity: "intermittent" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: payment-service
          props: { idempotent: "sí" }
      edges:
        - id: cliente-gw
          from: { node: cliente }
          to: { node: gw }
        - id: gw-pagos
          from: { node: gw }
          to: { node: pagos }
status: DRAFT
---

Borrador. Todavía no está listo para jugarse. Un cliente con conectividad
intermitente reintenta un pago cuando no recibe respuesta a tiempo; el
servicio de pagos tiene que poder recibir ese reintento sin cobrar dos
veces.
