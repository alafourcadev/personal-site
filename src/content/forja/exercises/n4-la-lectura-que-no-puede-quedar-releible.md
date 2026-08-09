---
title: "La lectura que no puede quedar releíble"
level: 4
role: tradeoff
domain: energia
tradeoffPairId: energia-lectura-de-medidores
D1: 2
D2: 2
D3: 2
D4: 1
D5: 2
D6: 1
D7: 2
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 7
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá una entrega que se consume y se borra le gana a un registro releíble."
lambda: 0.5
constraints:
  - metric: retención máxima del dato del titular fuera del sistema de medición
    operator: "<="
    value: 0
    unit: días
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: el mensaje que sale hacia el impresor lleva el número de documento y el domicilio del titular, porque son los datos que van impresos en la boleta.
    discoveryPath: "mirá qué clase de dato viaja en la conexión hacia el impresor. No es la lectura sola: es la lectura con el titular pegado, y eso cambia qué se puede dejar guardado y por cuánto tiempo."
  - fact: "el contrato con el impresor tercerizado incluye una cláusula de minimización de datos: el dato del titular se entrega para imprimir y no puede quedar disponible para ninguna lectura posterior."
    discoveryPath: es la razón por la que un registro de eventos con retención de días no sirve acá, aunque sea la pieza que resolvió el ejercicio anterior. Un consumidor nuevo que aparezca dentro de la ventana de retención puede leer todo lo que pasó.
startingDesign:
  nodes:
    - id: telemedicion
      type: external-party
      label: Empresa de telemedición
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 80 }
    - id: medicion
      type: service
      label: Servicio de medición
      zone: private
      role: metering-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 190 }
    - id: impresor
      type: external-provider
      label: Impresor tercerizado
      zone: dmz
      role: print-operator
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: telemedicion-gw
      from: { node: telemedicion }
      to: { node: gw }
    - id: gw-medicion
      from: { node: gw }
      to: { node: medicion }
    - id: medicion-impresor
      from: { node: medicion }
      to: { node: impresor }
      dataClass: personal
guarantees:
  - id: g-no-replayable-log
    label: el dato del titular no queda en ningún registro releíble
    weight: 1
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [stream]
    whyMissing: hay un registro de eventos en el diseño, y un registro de eventos guarda cada mensaje durante toda su ventana de retención.
    consequence: cualquier consumidor que se conecte dentro de esa ventana puede leer el documento y el domicilio de todos los titulares facturados en el período. La cláusula de minimización del contrato deja de cumplirse el día que alguien suma un lector, no el día que lo diseñaste.
  - id: g-durable-handoff
    label: la entrega al impresor sobrevive a un reinicio del servicio de medición
    weight: 3
    predicate:
      op: noVolatileCut
      from:
        role: metering-service
      to:
        role: print-operator
    whyMissing: no hay ningún componente durable entre el servicio de medición y el impresor tercerizado.
    consequence: si el proceso de medición se reinicia mientras espera al impresor, esa boleta no se imprime y nadie se entera. El titular la reclama seis semanas después, cuando le llega el aviso de corte por falta de pago de una factura que nunca recibió.
  - id: g-not-blocking
    label: la medición no espera al impresor para seguir trabajando
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: metering-service
      to:
        role: print-operator
    whyMissing: hay una conexión directa entre el servicio de medición y el impresor tercerizado.
    consequence: el impresor procesa por lotes y responde entre 4 y 40 segundos. Con esa llamada en línea, la ingesta de lecturas avanza al ritmo de una imprenta.
  - id: g-observability
    label: el servicio de medición está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: metering-service
      by:
        type: [observability]
    whyMissing: el servicio de medición no está conectado a ningún componente de observabilidad.
    consequence: si las entregas al impresor dejan de salir, la primera señal es un reclamo por una boleta que nunca llegó.
rubric:
  - dimension: no queda ningún registro releíble con el dato del titular
    signal:
      kind: predicate
      guaranteeId: g-no-replayable-log
  - dimension: la entrega al impresor sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-durable-handoff
referenceSolutions:
  - label: una cola de entrega, consumida y vaciada
    contextInversion: "es la variante mínima y la correcta mientras el impresor sea el único destinatario. Una cola entrega el mensaje una vez y lo saca de circulación: el dato del titular vive lo que tarda el envío, no lo que dure una ventana de retención."
    design:
      nodes:
        - id: telemedicion
          type: external-party
          label: Empresa de telemedición
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: medicion
          type: service
          label: Servicio de medición
          zone: private
          role: metering-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de boletas por imprimir
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: entregador
          type: worker
          label: Entregador al impresor
          zone: private
        - id: impresor
          type: external-provider
          label: Impresor tercerizado
          zone: dmz
          role: print-operator
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: telemedicion-gw
          from: { node: telemedicion }
          to: { node: gw }
        - id: gw-medicion
          from: { node: gw }
          to: { node: medicion }
        - id: medicion-cola
          from: { node: medicion }
          to: { node: cola }
          dataClass: personal
        - id: cola-entregador
          from: { node: cola }
          to: { node: entregador }
        - id: entregador-impresor
          from: { node: entregador }
          to: { node: impresor }
          dataClass: personal
        - id: medicion-obs
          from: { node: medicion }
          to: { node: obs }
  - label: la cola arranca después de facturar
    contextInversion: "conviene cuando lo que va a la imprenta no es la lectura sino la boleta ya calculada: el mensaje encolado lleva el importe final y no hay que recalcular nada del otro lado. El costo es un salto síncrono más antes del punto durable: si facturación se cae, la lectura queda en medición y no llega a la cola."
    design:
      nodes:
        - id: telemedicion
          type: external-party
          label: Empresa de telemedición
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: medicion
          type: service
          label: Servicio de medición
          zone: private
          role: metering-service
          props: { criticality: "high", replicas: "2" }
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de boletas por imprimir
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: entregador
          type: worker
          label: Entregador al impresor
          zone: private
        - id: impresor
          type: external-provider
          label: Impresor tercerizado
          zone: dmz
          role: print-operator
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: telemedicion-gw
          from: { node: telemedicion }
          to: { node: gw }
        - id: gw-medicion
          from: { node: gw }
          to: { node: medicion }
        - id: medicion-facturacion
          from: { node: medicion }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-cola
          from: { node: facturacion }
          to: { node: cola }
          dataClass: personal
        - id: cola-entregador
          from: { node: cola }
          to: { node: entregador }
        - id: entregador-impresor
          from: { node: entregador }
          to: { node: impresor }
          dataClass: personal
        - id: medicion-obs
          from: { node: medicion }
          to: { node: obs }
status: PILOT
---

La misma distribuidora eléctrica, el mismo servicio de medición. Pero el
paso que hay que resolver es otro: la boleta impresa. Un **impresor
tercerizado** recibe cada boleta, la imprime y la despacha por correo.

El mensaje que sale hacia el impresor no es la lectura sola: lleva el
**número de documento y el domicilio del titular**, porque son los datos
que van impresos. Y el contrato con el tercerizado tiene una cláusula de
minimización de datos: ese dato se entrega para imprimir y **no puede
quedar disponible para ninguna lectura posterior**. Un registro de eventos
con retención de días, que es la pieza que resolvió el problema del ejercicio
anterior, acá abre exactamente el agujero que la cláusula prohíbe: el
consumidor que alguien conecte el mes que viene puede leer todo lo que pasó
en la ventana.

El impresor, además, procesa por lotes: responde entre **4 y 40 segundos**.
Hoy el servicio de medición lo llama en línea y espera.

Hay un destinatario, uno solo, y no va a haber otro: la imprenta es la
imprenta.

El presupuesto operativo es de **7 unidades operativas**.

**Rearmá el sistema** para que la entrega al impresor sobreviva a un
reinicio del servicio de medición, sin que el dato del titular quede en
ningún lado desde donde se pueda volver a leer.
