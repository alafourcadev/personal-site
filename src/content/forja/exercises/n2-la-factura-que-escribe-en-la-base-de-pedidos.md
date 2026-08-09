---
title: "La factura que escribe en la base de pedidos"
level: 2
role: calibration
domain: facturacion
D1: 0
D2: 1
D3: 1
D4: 1
D5: 1
D6: 0
D7: 0
D8: 0
D9: 1
prerequisiteLevels: [1]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, quién es el dueño de la base de pedidos y cómo se enteró de que un pedido ya se facturó."
lambda: 0.5
constraints:
  - metric: pedidos facturados por día hábil
    operator: ">="
    value: 3400
    unit: pedidos/día
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: la marca "facturado" que escribe facturación es una columna de la tabla de pedidos. El equipo de pedidos no sabe que alguien más la escribe.
    discoveryPath: "seguí la conexión que sale del servicio de facturación y termina en la base de pedidos: es la única flecha del diagrama que cruza de un equipo al otro sin pasar por nadie."
  - fact: el mes pasado el equipo de pedidos renombró esa columna en una migración de quince minutos. Facturación estuvo rota nueve horas y nadie relacionó las dos cosas.
    discoveryPath: "preguntate qué pasa con cada flecha del diagrama si el dueño del destino cambia algo. Una flecha que entra a una base ajena no tiene contrato: tiene suerte."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Tienda online
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
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: pedidosdb
      type: database
      label: Base de pedidos
      zone: restricted
      role: orders-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: billing-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: facturaciondb
      type: database
      label: Base de facturación
      zone: restricted
      role: billing-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: cliente-web
      from: { node: cliente }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-pedidos
      from: { node: gw }
      to: { node: pedidos }
      dataClass: personal
    - id: pedidos-pedidosdb
      from: { node: pedidos }
      to: { node: pedidosdb }
      dataClass: personal
    - id: gw-facturacion
      from: { node: gw }
      to: { node: facturacion }
      dataClass: personal
    - id: facturacion-facturaciondb
      from: { node: facturacion }
      to: { node: facturaciondb }
      dataClass: personal
    - id: facturacion-pedidosdb
      from: { node: facturacion }
      to: { node: pedidosdb }
      dataClass: personal
guarantees:
  - id: g-no-cross-write
    label: facturación no escribe dentro de la base de pedidos
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: billing-service
      to:
        role: orders-db
    whyMissing: hay una conexión que sale del servicio de facturación y entra directo a la base de pedidos, sin pasar por el servicio que es dueño de esos datos.
    consequence: la forma de la tabla de pedidos deja de ser una decisión del equipo de pedidos. Cualquier cambio de columna se convierte en una coordinación entre dos equipos, y el que se olvida de avisar rompe al otro en producción.
  - id: g-through-owner
    label: el pedido se marca como facturado a través de su dueño
    weight: 2
    predicate:
      op: path
      from:
        role: billing-service
      to:
        role: orders-db
      via:
        role: orders-service
    whyMissing: no hay ningún camino desde el servicio de facturación hasta la base de pedidos que atraviese el servicio de pedidos.
    consequence: si facturación deja de poder escribir la marca, el pedido queda facturado en un sistema y sin facturar en el otro. Nadie tiene la versión buena, porque nadie es el dueño.
  - id: g-billing-owns-its-store
    label: facturación sigue teniendo su propio almacenamiento
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: billing-db
        - op: covered
          target:
            role: billing-db
          by:
            role: billing-service
    whyMissing: la base de facturación no existe o no está conectada al servicio de facturación.
    consequence: "un equipo que no es dueño de ningún dato no es un límite: es una capa de paso. El día que necesite guardar algo va a guardarlo en la base de otro, que es exactamente el problema que estamos sacando."
rubric:
  - dimension: ningún equipo escribe dentro del almacenamiento de otro
    signal:
      kind: predicate
      guaranteeId: g-no-cross-write
  - dimension: el cambio de estado de un pedido pasa por el dueño del pedido
    signal:
      kind: predicate
      guaranteeId: g-through-owner
  - dimension: cada equipo conserva el dato del que es dueño
    signal:
      kind: predicate
      guaranteeId: g-billing-owns-its-store
referenceSolutions:
  - label: facturación le pide al servicio de pedidos que marque el pedido
    contextInversion: "la llamada directa entre los dos servicios es lo correcto cuando el volumen es bajo y el equipo quiere saber en el acto si la marca se aplicó: se entera del error en la misma operación, sin ninguna pieza nueva que operar. Se paga con que facturar depende de que pedidos esté arriba en ese momento."
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
        - id: pedidos
          type: service
          label: Servicio de pedidos
          zone: private
          role: orders-service
          props: { criticality: "medium", replicas: "2" }
        - id: pedidosdb
          type: database
          label: Base de pedidos
          zone: restricted
          role: orders-db
          props: { backup: "diario" }
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "medium", replicas: "2" }
        - id: facturaciondb
          type: database
          label: Base de facturación
          zone: restricted
          role: billing-db
          props: { backup: "diario" }
      edges:
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
          dataClass: personal
        - id: pedidos-pedidosdb
          from: { node: pedidos }
          to: { node: pedidosdb }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-facturaciondb
          from: { node: facturacion }
          to: { node: facturaciondb }
          dataClass: personal
        - id: facturacion-pedidos
          from: { node: facturacion }
          to: { node: pedidos }
          dataClass: personal
  - label: facturación deja el aviso y el equipo de pedidos lo aplica
    contextInversion: "el aviso encolado conviene cuando facturar no puede quedarse esperando a que pedidos responda, como en los cierres de mes con miles de comprobantes en una hora, o cuando los dos equipos despliegan en ventanas distintas. Se paga con dos piezas más para operar y con que la marca llega unos segundos después, no en el mismo instante."
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
        - id: pedidos
          type: service
          label: Servicio de pedidos
          zone: private
          role: orders-service
          props: { criticality: "medium", replicas: "2" }
        - id: pedidosdb
          type: database
          label: Base de pedidos
          zone: restricted
          role: orders-db
          props: { backup: "diario" }
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "medium", replicas: "2" }
        - id: facturaciondb
          type: database
          label: Base de facturación
          zone: restricted
          role: billing-db
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de pedidos facturados
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: actualizador
          type: worker
          label: Aplicador de marcas de facturación
          zone: private
      edges:
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
          dataClass: personal
        - id: pedidos-pedidosdb
          from: { node: pedidos }
          to: { node: pedidosdb }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-facturaciondb
          from: { node: facturacion }
          to: { node: facturaciondb }
          dataClass: personal
        - id: facturacion-cola
          from: { node: facturacion }
          to: { node: cola }
          dataClass: personal
        - id: cola-actualizador
          from: { node: cola }
          to: { node: actualizador }
          dataClass: personal
        - id: actualizador-pedidos
          from: { node: actualizador }
          to: { node: pedidos }
          dataClass: personal
status: PILOT
---

Una tienda que despacha **3.400 pedidos facturados por día hábil**. Hay dos
equipos: uno mantiene los pedidos, otro mantiene la facturación. Cada uno
tiene su propia base de datos y su propio despliegue.

Cuando facturación emite el comprobante, tiene que dejar el pedido marcado
como *facturado*. Y lo hace de la forma más corta posible: **abre la base de
pedidos y escribe la columna**. Funciona. Funcionó dos años.

El mes pasado el equipo de pedidos renombró esa columna en una migración de
quince minutos. Nadie del otro lado se enteró, porque no había nada que
avisara. Facturación estuvo **nueve horas** escribiendo en una columna que ya
no existía, y el error apareció recién en la conciliación del cierre.

Ninguno de los dos equipos hizo nada mal. El problema es dónde está puesto el
límite: hoy la forma interna de una tabla es parte del contrato entre dos
equipos, y **nadie firmó ese contrato**.

**Rearmá el sistema** para que el pedido lo siga escribiendo el equipo que es
dueño del pedido, y para que facturación pueda cambiar su base sin pedirle
permiso a nadie. El equipo tiene **7 unidades operativas** y hoy usa 5.
