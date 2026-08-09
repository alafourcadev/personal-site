---
title: "El checkout completo, con presupuesto ajustado"
level: 4
role: synthesis
domain: pagos
D1: 2
D2: 2
D3: 3
D4: 2
D5: 2
D6: 2
D7: 1
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 5
aiBudget: "libre, pero el presupuesto es real, cada unidad operativa de más te cuesta puntos, no sólo prolijidad."
lambda: 1.0
constraints:
  - metric: presupuesto operativo (techo duro, no una meta)
    operator: "<="
    value: 5
    unit: unidades operativas
  - metric: tiempo aceptable de confirmación de compra
    operator: "<="
    value: 2
    unit: segundos
hiddenFacts:
  - fact: "el equipo que va a operar este sistema es de dos personas. Cinco unidades operativas es lo máximo que pueden sostener sin guardia rotativa. No es lo mismo que cinco cajas en el lienzo: hay piezas que no cuestan ninguna unidad."
    discoveryPath: pasate del presupuesto declarado y probá tu respuesta. El motor te muestra exactamente cuántos puntos perdiste por sobrepasarlo, no sólo que "está mal".
  - fact: el proveedor de email de este ejercicio tiene el mismo comportamiento errático que en "El pago que espera al email". No es un problema nuevo, es el mismo, ahora con menos margen para resolverlo.
    discoveryPath: es la razón por la que no alcanza con resolver un solo hallazgo. Hay que resolver los tres, con las mismas cinco unidades operativas.
startingDesign:
  nodes:
    - id: comprador
      type: mobile-client
      label: Cliente móvil
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: checkout
      type: service
      label: Servicio de checkout
      zone: private
      role: checkout-service
      given: true
      props: { criticality: "high", replicas: "1" }
      position: { x: 445, y: 300 }
    - id: proveedor
      type: external-provider
      label: Proveedor de email
      zone: dmz
      role: email-sent
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: comprador-gw
      from: { node: comprador }
      to: { node: gw }
    - id: gw-checkout
      from: { node: gw }
      to: { node: checkout }
    - id: checkout-proveedor
      from: { node: checkout }
      to: { node: proveedor }
      dataClass: personal
guarantees:
  - id: g-no-direct
    label: el cliente nunca llama directo al servicio de checkout
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [mobile-client, web-client]
      to:
        type: [service]
    whyMissing: hay una conexión directa entre un cliente y un servicio.
    consequence: el servicio queda expuesto a una red que no controlás.
  - id: g-no-volatile-cut
    label: la confirmación de compra no depende de que el email salga primero
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: checkout-service
      to:
        role: email-sent
    whyMissing: no hay ningún componente durable entre el checkout y el envío del email de confirmación.
    consequence: un reinicio del proceso de checkout en el momento exacto en que espera al proveedor de email pierde la confirmación de compra.
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
    consequence: el tiempo de detección de un problema pasa a ser el tiempo que tarda alguien en enojarse.
rubric:
  - dimension: el cliente siempre pasa por la puerta de entrada
    signal:
      kind: predicate
      guaranteeId: g-no-direct
  - dimension: la confirmación de compra sobrevive a un reinicio del proceso
    signal:
      kind: predicate
      guaranteeId: g-no-volatile-cut
  - dimension: el equipo se entera de un fallo antes que el cliente
    signal:
      kind: predicate
      guaranteeId: g-observability
  - dimension: el diseño respeta el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: cola, cinco unidades operativas exactas
    contextInversion: la variante más ajustada al presupuesto. Cada pieza cumple una función, ninguna es redundante; es la elección cuando el equipo no tiene margen para una sexta unidad operativa.
    design:
      nodes:
        - id: comprador
          type: mobile-client
          label: Cliente móvil
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
          props: { criticality: "high", replicas: "1" }
        - id: cola
          type: queue
          label: Cola de confirmaciones
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: procesador
          type: worker
          label: Procesador de confirmaciones
          zone: private
        - id: proveedor
          type: external-provider
          label: Proveedor de email
          zone: dmz
          role: email-sent
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-gw
          from: { node: comprador }
          to: { node: gw }
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
        - id: checkout-cola
          from: { node: checkout }
          to: { node: cola }
          dataClass: personal
        - id: cola-procesador
          from: { node: cola }
          to: { node: procesador }
        - id: procesador-proveedor
          from: { node: procesador }
          to: { node: proveedor }
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
  - label: registro de eventos, cinco unidades operativas exactas
    contextInversion: mismo presupuesto, mismo resultado. Un registro de eventos en vez de una cola tiene sentido si el equipo ya tiene otro consumidor leyendo el mismo evento de compra en otro sistema.
    design:
      nodes:
        - id: comprador
          type: web-client
          label: Cliente web
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
          props: { criticality: "high", replicas: "1" }
        - id: eventos
          type: stream
          label: Registro de compras
          zone: private
          props: { retention: "3d", partitions: "1" }
        - id: procesador
          type: worker
          label: Procesador de confirmaciones
          zone: private
        - id: proveedor
          type: external-provider
          label: Proveedor de email
          zone: dmz
          role: email-sent
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-gw
          from: { node: comprador }
          to: { node: gw }
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
        - id: checkout-eventos
          from: { node: checkout }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-procesador
          from: { node: eventos }
          to: { node: procesador }
        - id: procesador-proveedor
          from: { node: procesador }
          to: { node: proveedor }
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
status: PILOT
---

Cerrás el nivel con el mismo problema del primer ejercicio de este
nivel: un checkout que no puede perder la confirmación de compra ni
depender de que el cliente hable directo con el servicio. Pero esta vez
con las tres reglas juntas, **y un presupuesto real**: el equipo que va a
operar este sistema son **dos personas**. Cinco unidades operativas es lo
máximo que pueden sostener sin poner a alguien de guardia las 24 horas.

No es una meta de prolijidad. Es un techo duro. El motor te va a mostrar
exactamente cuántos puntos perdiste por cada unidad operativa de más, no
sólo que "el diseño es grande".

**Armá el sistema** que cumple las tres reglas del nivel (cliente siempre
por la puerta de entrada, confirmación de compra que sobrevive a un
reinicio, y un equipo que se entera antes que el cliente) usando como
máximo **cinco unidades operativas**. No son cinco cajas en el lienzo: hay
piezas que no cuestan ninguna unidad, y el total lo ves mientras armás.
