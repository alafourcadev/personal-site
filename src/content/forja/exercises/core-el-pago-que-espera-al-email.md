---
title: "El pago que espera al email"
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
aiBudget: libre — pero explicá en tus propias palabras por qué tu camino nunca pierde la confirmación.
lambda: 0.5
constraints:
  - metric: tiempo aceptable de confirmación de compra al comprador
    operator: "<="
    value: 2
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: opsUnits
hiddenFacts:
  - fact: el proveedor de email a veces tarda 8 segundos en responder, y a veces está caído directamente.
    discoveryPath: si conectás el servicio de pagos directo al proveedor de email sin nada durable en el medio, el motor marca la conexión como un salto sin testigo durable en cuanto probás la respuesta — no hace falta esperar los 8 segundos reales para verlo.
  - fact: nadie mira el servicio de pagos en producción hoy — la primera señal de un problema es un reclamo de un comprador.
    discoveryPath: dejá el servicio de pagos sin conectar a observabilidad y probá tu respuesta — el motor te lo va a marcar como hallazgo, no como bloqueante.
startingDesign:
  nodes:
    - id: cliente
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
    - id: pagos
      type: service
      label: Servicio de pagos
      zone: private
      role: payment-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 388, y: 300 }
    - id: proveedor
      type: external-provider
      label: Proveedor de email
      zone: dmz
      role: email-sent
      given: true
      position: { x: 388, y: 410 }
  edges:
    - id: cliente-web
      from: { node: cliente }
      to: { node: web }
    - id: web-gw
      from: { node: web }
      to: { node: gw }
    - id: gw-pagos
      from: { node: gw }
      to: { node: pagos }
    - id: pagos-proveedor
      from: { node: pagos }
      to: { node: proveedor }
      dataClass: personal
guarantees:
  - id: g-no-volatile-cut
    label: la confirmación de compra no depende de que el email salga primero
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: payment-service
      to:
        role: email-sent
    whyMissing: no hay ningún componente durable entre el servicio de pagos y el envío del email — si el proceso se reinicia en el medio, el aviso desaparece con él.
    consequence: un comprador puede pagar y nunca recibir el comprobante, sin que nadie se entere hasta que reclame.
  - id: g-observability
    label: el servicio de pagos está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: payment-service
      by:
        type: [observability]
    whyMissing: el servicio de pagos no está conectado a ningún componente de observabilidad.
    consequence: el tiempo de detección de un problema pasa a ser el tiempo que tarda alguien en enojarse.
rubric:
  - dimension: la confirmación de compra sobrevive a un reinicio del proceso
    signal:
      kind: predicate
      guaranteeId: g-no-volatile-cut
  - dimension: el equipo se entera de un fallo antes que el cliente
    signal:
      kind: predicate
      guaranteeId: g-observability
referenceSolutions:
  - label: cola con destino para los fallos
    contextInversion: la cola es la elección clásica cuando el equipo ya opera colas y quiere un componente conocido, con el costo de una pieza más para monitorear.
    design:
      nodes:
        - id: cliente
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
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: payment-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de avisos de compra
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: procesador
          type: worker
          label: Procesador de avisos
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
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
        - id: web-gw
          from: { node: web }
          to: { node: gw }
        - id: gw-pagos
          from: { node: gw }
          to: { node: pagos }
        - id: pagos-cola
          from: { node: pagos }
          to: { node: cola }
          dataClass: personal
        - id: cola-procesador
          from: { node: cola }
          to: { node: procesador }
        - id: procesador-proveedor
          from: { node: procesador }
          to: { node: proveedor }
        - id: pagos-obs
          from: { node: pagos }
          to: { node: obs }
  - label: stream de eventos de compra
    contextInversion: un stream tiene sentido cuando el equipo ya tiene otros consumidores que necesitan leer el mismo evento de compra (analítica, facturación) — un evento por su naturaleza se puede releer, una cola normalmente no.
    design:
      nodes:
        - id: cliente
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
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: payment-service
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Stream de compras
          zone: private
          props: { retention: "7d", partitions: "3" }
        - id: procesador
          type: worker
          label: Procesador de avisos
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
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
        - id: web-gw
          from: { node: web }
          to: { node: gw }
        - id: gw-pagos
          from: { node: gw }
          to: { node: pagos }
        - id: pagos-eventos
          from: { node: pagos }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-procesador
          from: { node: eventos }
          to: { node: procesador }
        - id: procesador-proveedor
          from: { node: procesador }
          to: { node: proveedor }
        - id: pagos-obs
          from: { node: pagos }
          to: { node: obs }
status: PILOT
---

Una tienda online. Cuando alguien compra, el servicio de pagos **espera**
a que el proveedor de email confirme el envío del comprobante antes de
decir "compra confirmada". El proveedor a veces tarda 8 segundos. A veces
se cae directamente.

El equipo procesa entre 400 y 900 compras por hora en horario pico. El
presupuesto operativo del equipo es de **8 unidades operativas**: cada
pieza nueva del sistema — una cola, un worker, un componente de monitoreo —
cuenta contra ese número, y por encima de él el equipo deja de poder
sostener lo que armó.

El dueño de producto pide una sola cosa, sin excepciones: **la compra se
tiene que confirmar siempre**, incluso si el proveedor de email está caído
en ese momento. Y el equipo de soporte pide la otra mitad: cuando algo
falla, que se entere alguien del equipo antes que el cliente que reclama.

**Rearmá el sistema** para que ninguna de las dos cosas dependa de que el
proveedor de email responda rápido, ni de que el proceso de pagos siga
vivo el tiempo suficiente para reintentar él solo.
