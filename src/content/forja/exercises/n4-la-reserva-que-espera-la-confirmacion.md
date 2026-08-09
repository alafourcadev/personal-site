---
title: "La reserva que espera la confirmación del hotel"
level: 4
role: core
domain: reservas
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
aiBudget: libre, pero explicá en tus propias palabras por qué tu camino nunca pierde la confirmación.
lambda: 0.5
constraints:
  - metric: tiempo aceptable de confirmación al huésped
    operator: "<="
    value: 3
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: el sistema del hotel confirma la disponibilidad entre 2 y 12 segundos después de recibir el pedido, y una vez por semana no responde nada durante minutos.
    discoveryPath: probá una respuesta que conecte el servicio de reservas directo al sistema del hotel sin nada durable en el medio. El motor marca el salto sin testigo durable de inmediato.
  - fact: hoy nadie del equipo de reservas mira si el servicio sigue vivo. Se enteran por el hotel, no por sus propias métricas.
    discoveryPath: dejá el servicio de reservas sin conectar a observabilidad y probá tu respuesta.
startingDesign:
  nodes:
    - id: huesped
      type: actor
      label: Huésped
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de reservas
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: reservas
      type: service
      label: Servicio de reservas
      zone: private
      role: booking-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: hotel
      type: external-provider
      label: Sistema del hotel
      zone: dmz
      role: confirmation-sent
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: huesped-app
      from: { node: huesped }
      to: { node: app }
    - id: app-gw
      from: { node: app }
      to: { node: gw }
    - id: gw-reservas
      from: { node: gw }
      to: { node: reservas }
    - id: reservas-hotel
      from: { node: reservas }
      to: { node: hotel }
      dataClass: personal
guarantees:
  - id: g-no-volatile-cut
    label: la reserva no depende de que el hotel confirme al toque
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: booking-service
      to:
        role: confirmation-sent
    whyMissing: no hay ningún componente durable entre el servicio de reservas y la confirmación del hotel.
    consequence: si el proceso de reservas se reinicia mientras espera al hotel, el pedido de reserva desaparece con él y el huésped nunca sabe qué pasó.
  - id: g-observability
    label: el servicio de reservas está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: booking-service
      by:
        type: [observability]
    whyMissing: el servicio de reservas no está conectado a ningún componente de observabilidad.
    consequence: el equipo se entera de una caída por un huésped enojado en recepción, no por una alerta.
rubric:
  - dimension: la reserva sobrevive a un reinicio del proceso mientras espera al hotel
    signal:
      kind: predicate
      guaranteeId: g-no-volatile-cut
  - dimension: el equipo se entera de un fallo antes que el huésped
    signal:
      kind: predicate
      guaranteeId: g-observability
referenceSolutions:
  - label: cola con destino para los fallos
    contextInversion: la cola es la elección clásica cuando el equipo ya opera colas. Es una pieza más para monitorear, a cambio de un componente conocido.
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: app
          type: mobile-client
          label: App de reservas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reservas
          type: service
          label: Servicio de reservas
          zone: private
          role: booking-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de pedidos de reserva
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: procesador
          type: worker
          label: Procesador de reservas
          zone: private
        - id: hotel
          type: external-provider
          label: Sistema del hotel
          zone: dmz
          role: confirmation-sent
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: huesped-app
          from: { node: huesped }
          to: { node: app }
        - id: app-gw
          from: { node: app }
          to: { node: gw }
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
        - id: reservas-cola
          from: { node: reservas }
          to: { node: cola }
          dataClass: personal
        - id: cola-procesador
          from: { node: cola }
          to: { node: procesador }
        - id: procesador-hotel
          from: { node: procesador }
          to: { node: hotel }
        - id: reservas-obs
          from: { node: reservas }
          to: { node: obs }
  - label: registro de eventos de reserva
    contextInversion: un registro de eventos tiene sentido cuando otro sistema (facturación, analítica de ocupación) también necesita leer el mismo evento de pedido de reserva.
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: app
          type: mobile-client
          label: App de reservas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reservas
          type: service
          label: Servicio de reservas
          zone: private
          role: booking-service
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Registro de pedidos de reserva
          zone: private
          props: { retention: "7d", partitions: "3" }
        - id: procesador
          type: worker
          label: Procesador de reservas
          zone: private
        - id: hotel
          type: external-provider
          label: Sistema del hotel
          zone: dmz
          role: confirmation-sent
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: huesped-app
          from: { node: huesped }
          to: { node: app }
        - id: app-gw
          from: { node: app }
          to: { node: gw }
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
        - id: reservas-eventos
          from: { node: reservas }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-procesador
          from: { node: eventos }
          to: { node: procesador }
        - id: procesador-hotel
          from: { node: procesador }
          to: { node: hotel }
        - id: reservas-obs
          from: { node: reservas }
          to: { node: obs }
status: PILOT
---

Una app de reservas de hotel. Cuando un huésped pide una habitación, el
servicio de reservas **espera** a que el sistema del hotel confirme la
disponibilidad antes de decir "reserva confirmada". El hotel responde entre
2 y 12 segundos. Una vez por semana, directamente no responde nada durante
varios minutos. Es un sistema viejo, mantenido por un proveedor externo
que no está bajo tu control.

El equipo procesa unas 300 reservas por hora en temporada alta. El
presupuesto operativo es de **8 unidades operativas**.

El área comercial pide una sola cosa: **la reserva se tiene que confirmar
siempre**, incluso si el hotel tarda o no responde. El equipo de soporte
pide la otra mitad: enterarse de una caída antes que el huésped en el
mostrador del hotel.

**Rearmá el sistema** para que ninguna de las dos cosas dependa de que el
sistema del hotel responda rápido, ni de que el proceso de reservas siga
vivo el tiempo suficiente para reintentar él solo.
