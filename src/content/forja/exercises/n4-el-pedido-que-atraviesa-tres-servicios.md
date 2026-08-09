---
title: "El pedido que atraviesa tres servicios antes de contestar"
level: 4
role: core
domain: logistica
D1: 1
D2: 1
D3: 2
D4: 1
D5: 2
D6: 1
D7: 2
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que decir cuál de los tres saltos dejaste síncrono y por qué ese sí y los otros no."
lambda: 0.5
constraints:
  - metric: tiempo aceptable de respuesta al operador que carga el pedido
    operator: "<="
    value: 2
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: cada uno de los tres servicios está disponible el 99,9% del tiempo, pero encadenados en línea la disponibilidad se multiplica y da 99,7%. De 8 horas de caída al año se pasa a 26, sin que ninguno de los tres se haya "caído".
    discoveryPath: dejá los tres servicios encadenados uno detrás del otro y probá tu respuesta. El motor marca la cadena síncrona profunda y explica la cuenta de la disponibilidad multiplicada.
  - fact: el depósito no necesita enterarse del pedido en el mismo segundo. La primera preparación sale recién en el turno siguiente, entre 20 minutos y 4 horas después.
    discoveryPath: "leé el pedido del área de operaciones en el enunciado: dice qué tiene que estar resuelto antes de contestarle al operador y qué puede resolverse después. Lo que puede esperar es lo que podés sacar de la cadena."
startingDesign:
  nodes:
    - id: operador
      type: actor
      label: Operador de mostrador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de carga
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: pedidos
      type: service
      label: Servicio de pedidos
      zone: private
      role: orders-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: billing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: deposito
      type: service
      label: Servicio de depósito
      zone: private
      role: warehouse-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
  edges:
    - id: operador-portal
      from: { node: operador }
      to: { node: portal }
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
    - id: gw-pedidos
      from: { node: gw }
      to: { node: pedidos }
    - id: pedidos-facturacion
      from: { node: pedidos }
      to: { node: facturacion }
      dataClass: personal
    - id: facturacion-deposito
      from: { node: facturacion }
      to: { node: deposito }
      dataClass: personal
guarantees:
  - id: g-no-sync-chain
    label: la respuesta al operador no depende de tres servicios encadenados en línea
    weight: 2
    predicate:
      op: ruleSilent
      rule: sync-chain-depth
    whyMissing: hay tres o más servicios encadenados uno detrás del otro, cada uno esperando al siguiente antes de contestar.
    consequence: la disponibilidad se multiplica. Tres servicios al 99,9% dan 99,7%, y una demora del último se le cobra al operador que está frente al cliente en el mostrador.
  - id: g-billing-reached
    label: el pedido sigue llegando a facturación
    weight: 1
    predicate:
      op: path
      from:
        role: orders-service
      to:
        role: billing-service
    whyMissing: no hay ningún camino desde el servicio de pedidos hasta el de facturación.
    consequence: cortar la cadena borrando un tramo no es resolverla. Un pedido sin factura es un pedido que el área comercial va a reclamar a mano, uno por uno.
  - id: g-warehouse-reached
    label: el pedido sigue llegando al depósito
    weight: 2
    predicate:
      op: path
      from:
        role: orders-service
      to:
        role: warehouse-service
    whyMissing: no hay ningún camino desde el servicio de pedidos hasta el de depósito.
    consequence: un pedido que nunca llega al depósito no se prepara ni se despacha. El cliente ve la confirmación en pantalla y la mercadería nunca sale.
  - id: g-observability
    label: el servicio de pedidos está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: orders-service
      by:
        type: [observability]
    whyMissing: el servicio de pedidos no está conectado a ningún componente de observabilidad.
    consequence: si el tramo que sacaste de la cadena deja de avanzar, nadie lo ve. El tiempo de detección pasa a ser el tiempo que tarda alguien en enojarse.
rubric:
  - dimension: la respuesta al operador dejó de depender de la cadena completa
    signal:
      kind: predicate
      guaranteeId: g-no-sync-chain
  - dimension: el pedido sigue llegando al depósito por algún camino
    signal:
      kind: predicate
      guaranteeId: g-warehouse-reached
  - dimension: el equipo se entera antes que el cliente
    signal:
      kind: predicate
      guaranteeId: g-observability
referenceSolutions:
  - label: sólo el tramo del depósito sale de la cadena
    contextInversion: es la elección correcta cuando la factura tiene que estar emitida antes de contestarle al operador por un requisito fiscal, no por una preferencia, y lo único que puede esperar es la preparación en el depósito. Cortás un solo salto y dejás el otro en línea, con una pieza nueva en vez de dos.
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de mostrador
          zone: public
        - id: portal
          type: web-client
          label: Portal de carga
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: pedidos
          type: service
          label: Servicio de pedidos
          zone: private
          role: orders-service
          props: { criticality: "high", replicas: "2" }
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de órdenes de preparación
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: preparador
          type: worker
          label: Despachador de órdenes
          zone: private
        - id: deposito
          type: service
          label: Servicio de depósito
          zone: private
          role: warehouse-service
          props: { criticality: "medium", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: operador-portal
          from: { node: operador }
          to: { node: portal }
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
        - id: pedidos-facturacion
          from: { node: pedidos }
          to: { node: facturacion }
          dataClass: personal
        - id: pedidos-cola
          from: { node: pedidos }
          to: { node: cola }
          dataClass: personal
        - id: cola-preparador
          from: { node: cola }
          to: { node: preparador }
        - id: preparador-deposito
          from: { node: preparador }
          to: { node: deposito }
        - id: pedidos-obs
          from: { node: pedidos }
          to: { node: obs }
  - label: un registro de pedidos aceptados que cada área lee por su cuenta
    contextInversion: conviene cuando ni la factura ni la preparación tienen que estar resueltas para contestarle al operador, y además hay un tercer interesado a la vista (analítica de demanda, reposición) que va a querer leer el mismo hecho sin que pedidos tenga que enterarse. Cuesta una pieza más que la otra variante y a cambio ninguna de las dos áreas puede frenar la respuesta.
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de mostrador
          zone: public
        - id: portal
          type: web-client
          label: Portal de carga
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: pedidos
          type: service
          label: Servicio de pedidos
          zone: private
          role: orders-service
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Registro de pedidos aceptados
          zone: private
          props: { retention: "7d", partitions: "3" }
        - id: facturador
          type: worker
          label: Emisor de facturas
          zone: private
        - id: preparador
          type: worker
          label: Despachador de órdenes
          zone: private
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: deposito
          type: service
          label: Servicio de depósito
          zone: private
          role: warehouse-service
          props: { criticality: "medium", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: operador-portal
          from: { node: operador }
          to: { node: portal }
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
        - id: pedidos-eventos
          from: { node: pedidos }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-facturador
          from: { node: eventos }
          to: { node: facturador }
        - id: eventos-preparador
          from: { node: eventos }
          to: { node: preparador }
        - id: facturador-facturacion
          from: { node: facturador }
          to: { node: facturacion }
        - id: preparador-deposito
          from: { node: preparador }
          to: { node: deposito }
        - id: pedidos-obs
          from: { node: pedidos }
          to: { node: obs }
status: PILOT
---

Una distribuidora de repuestos. El operador carga un pedido en el mostrador
y espera la confirmación en pantalla, con el cliente enfrente. Hoy esa
confirmación recorre tres servicios en línea: **pedidos** llama a
**facturación**, facturación llama a **depósito**, y recién cuando el
último contesta el operador ve "pedido confirmado".

Los tres servicios están al **99,9%** de disponibilidad, medido, cada uno.
El equipo de plataforma se enteró de algo incómodo mirando el número
completo: encadenados, la disponibilidad se multiplica y da **99,7%**, que
son 26 horas de caída al año en vez de 8. Ninguno de los tres estuvo "caído".

El área de operaciones aclara qué tiene que estar resuelto **antes** de
contestarle al operador y qué no: la preparación en el depósito no empieza
hasta el turno siguiente, entre 20 minutos y 4 horas después, así que el
depósito no necesita enterarse en el mismo segundo. Lo que sí tiene que
llegar, tarde o temprano, es todo: un pedido sin factura y un pedido que
nunca llegó al depósito son dos llamados de reclamo distintos.

El presupuesto operativo del equipo es de **8 unidades operativas**.

**Rearmá el sistema** para que la respuesta al operador deje de depender de
los tres servicios encadenados, sin que ninguna de las dos áreas deje de
recibir su pedido.
