---
title: "La tienda que todavía no vendió nada"
level: 4
role: greenfield
domain: comercio
D1: 1
D2: 2
D3: 2
D4: 1
D5: 2
D6: 1
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [3]
budget:
  opsUnits: 7
aiBudget: 'libre. Va a proponerte una cola apenas leas la palabra "tercero", y va a acertar. Lo que no va a resolver por vos es cuántas colas, porque eso depende de si los dos destinos se caen juntos o por separado, y ese dato está en el enunciado, no en su entrenamiento.'
lambda: 0.5
constraints:
  - metric: compras que esperan la respuesta del proveedor de facturación
    operator: "="
    value: 0
    unit: compras
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: el proveedor de facturación contesta entre 4 y 40 segundos, y se cae dos veces por semana durante unos veinte minutos.
    discoveryPath: 'la consigna te da los dos números del tercero. Uno dice cuánto tarda cuando anda y el otro dice cuánto está sin andar. Si esa pieza está adentro del pedido de compra, esos dos números pasan a ser los de tu tienda.'
  - fact: el proveedor de correo y el de facturación son empresas distintas, con caídas que no coinciden.
    discoveryPath: 'la consigna nombra dos terceros y aclara que son dos proveedores separados. Preguntate qué pasa con el segundo cuando el primero está caído, y fijate si tu diseño hace que eso pase o lo impide.'
startingDesign:
  nodes: []
  edges: []
guarantees:
  - id: g-tercero-por-cola
    label: al tercero se le habla a través de una cola, no dentro del pedido de compra
    weight: 2
    predicate:
      op: path
      from:
        type: [service]
      to:
        type: [external-provider]
      via:
        type: [queue]
    whyMissing: no hay ningún camino desde un servicio hasta un proveedor externo que pase por una cola. O el tercero no está, o se le está hablando en el momento de la compra.
    consequence: 'la disponibilidad del tercero pasa a ser la tuya. Cuando el proveedor de facturación tarda cuarenta segundos, tarda cuarenta segundos tu botón de comprar; cuando está caído veinte minutos, tu tienda no vende durante veinte minutos.'
  - id: g-cola-con-consumidor
    label: toda cola del diseño tiene quien la vacíe
    weight: 1
    predicate:
      op: ruleSilent
      rule: orphan-queue
    whyMissing: hay al menos una cola sin ningún consumidor conectado.
    consequence: los mensajes se acumulan hasta llenar la retención y después se descartan en silencio. El sistema parece andar perfecto hasta el día que alguien pregunta por una factura que nunca salió.
  - id: g-fallo-tiene-destino
    label: un mensaje que falla siempre tiene adónde ir
    weight: 2
    predicate:
      op: ruleSilent
      rule: queue-without-dlq
    whyMissing: hay una cola de entrega al menos una vez sin una cola de mensajes fallidos configurada.
    consequence: 'un mensaje que falla siempre bloquea al resto o se pierde sin ruido. En una tienda de dos personas nadie lo va a ver hasta que un cliente reclame la factura, y para entonces atrás hay cien más iguales.'
  - id: g-venta-queda-escrita
    label: la venta queda escrita antes de que salga nada hacia afuera
    weight: 2
    predicate:
      op: path
      from:
        type: [service]
      to:
        type: [database]
    whyMissing: no hay ningún camino desde un servicio hasta una base de datos. La compra existe en el aire mientras alguien la procesa.
    consequence: 'sacar el trámite del pedido solo es seguro si lo que se sacó quedó anotado primero. Si la venta no está escrita y el proceso se cae, no hay a qué volver: el cliente pagó y del lado de la tienda no pasó nada.'
rubric:
  - dimension: el tercero no está adentro del pedido de compra
    signal:
      kind: predicate
      guaranteeId: g-tercero-por-cola
  - dimension: lo que falla tiene adónde ir
    signal:
      kind: predicate
      guaranteeId: g-fallo-tiene-destino
  - dimension: la venta queda escrita
    signal:
      kind: predicate
      guaranteeId: g-venta-queda-escrita
referenceSolutions:
  - label: una sola cola para todo lo que puede esperar
    contextInversion: 'una sola cola gana mientras los dos destinos fallen juntos o casi nunca. Una retención que configurar, un destino de fallos que mirar, un solo número que decir si alguien pregunta cuánto hay pendiente. Se paga el día que el proveedor de facturación tarda cuarenta segundos y el correo, que anda perfecto, espera atrás.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: tienda
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de ventas
          zone: private
        - id: registro
          type: database
          label: Registro de ventas
          zone: restricted
          props: { backup: "diario" }
        - id: pendientes
          type: queue
          label: Cola de trámites pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachante
          type: worker
          label: Despachante de trámites
          zone: private
        - id: facturacion
          type: external-provider
          label: Proveedor de facturación
          zone: dmz
        - id: correo
          type: external-provider
          label: Proveedor de correo
          zone: dmz
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: ventas-registro
          from: { node: ventas }
          to: { node: registro }
          dataClass: personal
        - id: ventas-pendientes
          from: { node: ventas }
          to: { node: pendientes }
          dataClass: personal
        - id: pendientes-despachante
          from: { node: pendientes }
          to: { node: despachante }
          dataClass: personal
        - id: despachante-facturacion
          from: { node: despachante }
          to: { node: facturacion }
          dataClass: personal
        - id: despachante-correo
          from: { node: despachante }
          to: { node: correo }
          dataClass: personal
  - label: una cola por destino, un solo despachante
    contextInversion: 'una cola por destino gana cuando los dos terceros se caen por separado, que es el caso acá: son dos empresas distintas. La factura que el proveedor no contesta deja de frenar el mail del cliente, y el pendiente de cada destino se mide solo. Se paga con dos retenciones que configurar, dos destinos de fallo que mirar, y un despachante que ahora tiene dos motivos para estar ocupado.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: tienda
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de ventas
          zone: private
        - id: registro
          type: database
          label: Registro de ventas
          zone: restricted
          props: { backup: "diario" }
        - id: colafactura
          type: queue
          label: Cola de facturación
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: colaaviso
          type: queue
          label: Cola de avisos al cliente
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachante
          type: worker
          label: Despachante de trámites
          zone: private
        - id: facturacion
          type: external-provider
          label: Proveedor de facturación
          zone: dmz
        - id: correo
          type: external-provider
          label: Proveedor de correo
          zone: dmz
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: ventas-registro
          from: { node: ventas }
          to: { node: registro }
          dataClass: personal
        - id: ventas-colafactura
          from: { node: ventas }
          to: { node: colafactura }
          dataClass: personal
        - id: ventas-colaaviso
          from: { node: ventas }
          to: { node: colaaviso }
          dataClass: personal
        - id: colafactura-despachante
          from: { node: colafactura }
          to: { node: despachante }
          dataClass: personal
        - id: colaaviso-despachante
          from: { node: colaaviso }
          to: { node: despachante }
          dataClass: personal
        - id: despachante-facturacion
          from: { node: despachante }
          to: { node: facturacion }
          dataClass: personal
        - id: despachante-correo
          from: { node: despachante }
          to: { node: correo }
          dataClass: personal
status: PILOT
---

Una tienda de instrumentos musicales abre el mes que viene. Todavía no vendió
nada y todavía no hay nada construido: el lienzo está vacío porque el sistema
no existe.

Cuando alguien compra, tienen que pasar tres cosas. La venta queda registrada.
Sale la factura, que la emite un proveedor externo. Y le llega un mail al
cliente, que manda otro proveedor, de otra empresa.

Los números de esos terceros están medidos y son estos. El proveedor de
facturación contesta **entre 4 y 40 segundos**, y se cae unas dos veces por
semana durante veinte minutos. El de correo anda casi siempre, y cuando falla no
falla al mismo tiempo que el otro.

**Nadie te va a decir cuántas piezas armar.** Los ejercicios de este nivel te
mostraron un sistema con el tercero adentro del pedido y te pidieron sacarlo. Acá
el sistema no existe todavía, así que la pregunta cambia: qué piezas creás, y
cuántas.

Y hay alguien pidiendo lo contrario, con un argumento correcto.

El contador quiere que la factura salga en el mismo momento de la compra. Su
razón no es capricho: la numeración de comprobantes es correlativa y tiene que
poder explicarse ante una inspección. Si la venta se confirma y la factura sale
después, existe una ventana en la que el cliente pagó y el comprobante todavía
no está. Eso es real y hay que poder responderlo.

También es real que meter al proveedor adentro del pedido le regala a la tienda
los cuarenta segundos y los veinte minutos de otra empresa. Una tienda que no
vende dos veces por semana porque un tercero está caído tiene un problema peor
que un comprobante demorado.

Elegí. Y cuando elijas, decí en voz alta qué le queda al contador de su
argumento, porque no se le cae entero.
