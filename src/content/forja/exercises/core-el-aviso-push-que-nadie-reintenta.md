---
title: "El aviso push que nadie vuelve a intentar"
level: 4
role: core
domain: notificaciones
D1: 1
D2: 0
D3: 2
D4: 1
D5: 2
D6: 1
D7: 1
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 8
aiBudget: libre — pero explicá qué pasa concretamente con un aviso que falla, no sólo que "está resuelto".
lambda: 0.5
constraints:
  - metric: avisos push enviados por hora en pico
    operator: ">="
    value: 5000
    unit: avisos/hora
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: opsUnits
hiddenFacts:
  - fact: el proveedor de push rechaza entre el 2% y el 6% de los envíos por token vencido o app desinstalada — un porcentaje chico, pero a 5000/hora son cientos por hora.
    discoveryPath: dejá la cola sin marcar `dlq` y probá tu respuesta — el motor te marca el hallazgo con la palabra exacta que describe qué le pasa a esos avisos.
  - fact: hoy, cuando un aviso falla, simplemente desaparece — nadie lo reintenta ni lo revisa.
    discoveryPath: es la misma pregunta que el hallazgo de la cola sin destino para fallos responde — leé la consecuencia, no sólo el título.
startingDesign:
  nodes:
    - id: app
      type: mobile-client
      label: App
      zone: public
      given: true
      position: { x: 28, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 388, y: 80 }
    - id: notif
      type: service
      label: Servicio de notificaciones
      zone: private
      given: true
      props: { criticality: "medium" }
      position: { x: 388, y: 190 }
    - id: cola
      type: queue
      label: Cola de avisos push
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 748, y: 80 }
    - id: proveedor
      type: external-provider
      label: Proveedor de push
      zone: dmz
      given: true
      position: { x: 388, y: 300 }
  edges:
    - id: app-gw
      from: { node: app }
      to: { node: gw }
    - id: gw-notif
      from: { node: gw }
      to: { node: notif }
    - id: notif-cola
      from: { node: notif }
      to: { node: cola }
guarantees:
  - id: g-queue-exists
    label: los avisos pasan por una cola, no se envían en el momento
    weight: 1
    predicate:
      op: exists
      node:
        type: [queue]
    whyMissing: no hay ninguna cola en el diseño — los avisos se estarían enviando en el momento, sin desacoplar el pico de tráfico.
    consequence: un pico de avisos satura al servicio que los genera, y un proveedor lento arrastra a todo lo demás con él.
  - id: g-consumed
    label: la cola tiene quien la vacíe
    weight: 1
    predicate:
      op: ruleSilent
      rule: orphan-queue
    whyMissing: la cola no tiene ningún consumidor conectado.
    consequence: los avisos se acumulan hasta llenar la retención y después se descartan — el sistema parece funcionar hasta que falta un aviso.
  - id: g-has-dlq
    label: un aviso que falla siempre tiene un destino
    weight: 2
    predicate:
      op: ruleSilent
      rule: queue-without-dlq
    whyMissing: la cola no tiene una cola de mensajes fallidos configurada.
    consequence: un aviso que falla siempre bloquea o se pierde en silencio — con un solo responsable de guardia, nadie lo va a ver hasta que un usuario reclame.
rubric:
  - dimension: el tráfico en pico no llega directo al proveedor de push
    signal:
      kind: predicate
      guaranteeId: g-queue-exists
  - dimension: un aviso fallido tiene un destino, no desaparece
    signal:
      kind: predicate
      guaranteeId: g-has-dlq
referenceSolutions:
  - label: cola con DLQ, un solo cliente de entrada
    contextInversion: la variante más simple — un solo origen de avisos, suficiente si el sistema todavía tiene un único cliente emitiendo notificaciones.
    design:
      nodes:
        - id: app
          type: mobile-client
          label: App
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: notif
          type: service
          label: Servicio de notificaciones
          zone: private
          props: { criticality: "medium" }
        - id: cola
          type: queue
          label: Cola de avisos push
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: enviador
          type: worker
          label: Enviador de avisos
          zone: private
        - id: proveedor
          type: external-provider
          label: Proveedor de push
          zone: dmz
      edges:
        - id: app-gw
          from: { node: app }
          to: { node: gw }
        - id: gw-notif
          from: { node: gw }
          to: { node: notif }
        - id: notif-cola
          from: { node: notif }
          to: { node: cola }
        - id: cola-enviador
          from: { node: cola }
          to: { node: enviador }
        - id: enviador-proveedor
          from: { node: enviador }
          to: { node: proveedor }
  - label: cola con DLQ, más el monitoreo del enviador
    contextInversion: cuando el volumen crece, saber que el enviador está vivo importa tanto como que la cola exista — esta variante suma observabilidad sobre el propio worker.
    design:
      nodes:
        - id: app
          type: mobile-client
          label: App
          zone: public
        - id: web
          type: web-client
          label: Panel web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: notif
          type: service
          label: Servicio de notificaciones
          zone: private
          props: { criticality: "medium" }
        - id: cola
          type: queue
          label: Cola de avisos push
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: enviador
          type: worker
          label: Enviador de avisos
          zone: private
        - id: proveedor
          type: external-provider
          label: Proveedor de push
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: app-gw
          from: { node: app }
          to: { node: gw }
        - id: web-gw
          from: { node: web }
          to: { node: gw }
        - id: gw-notif
          from: { node: gw }
          to: { node: notif }
        - id: notif-cola
          from: { node: notif }
          to: { node: cola }
        - id: cola-enviador
          from: { node: cola }
          to: { node: enviador }
        - id: enviador-proveedor
          from: { node: enviador }
          to: { node: proveedor }
        - id: enviador-obs
          from: { node: enviador }
          to: { node: obs }
status: PILOT
---

Una app manda notificaciones push a sus usuarios: ofertas, recordatorios,
alertas de cuenta. En horario pico salen unas **5000 por hora**. El
proveedor de push rechaza entre el 2% y el 6% de los envíos — un token
vencido, una app desinstalada, un error transitorio del lado del
proveedor. A ese volumen, son cientos de avisos por hora que fallan.

Hoy, cuando un envío falla, **simplemente desaparece**. Nadie lo reintenta,
nadie lo revisa, nadie sabe cuántos se perdieron esta semana.

El equipo tiene **8 unidades operativas** de presupuesto y no está pidiendo
una solución perfecta — está pidiendo una donde un aviso que falla **tenga
un destino conocido**, en vez de la nada actual.

**Armá el sistema** para que el envío no dependa de que el servicio que
genera los avisos espere al proveedor, y para que un aviso fallido nunca
desaparezca sin dejar rastro.
