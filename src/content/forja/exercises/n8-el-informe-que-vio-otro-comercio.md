---
title: "El informe que vio otro comercio"
level: 8
role: calibration
domain: comercio
D1: 2
D2: 2
D3: 3
D4: 1
D5: 2
D6: 2
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué componente del diseño final sabe de quién es cada fila, y por qué ningún otro puede saberlo."
lambda: 0.5
constraints:
  - metric: comercios sobre la misma base
    operator: ">="
    value: 240
    unit: comercios
  - metric: filas de otro comercio toleradas en un informe
    operator: "="
    value: 0
    unit: filas
hiddenFacts:
  - fact: "el filtro por comercio existe, pero está escrito en el servicio de informes: es una condición más dentro de una consulta que arma texto. Nadie lo probó nunca con dos comercios a la vez."
    discoveryPath: "es la razón por la que la garantía pide que el informe llegue a los datos PASANDO POR el servicio de facturación, y no que el servicio de informes filtre bien. Un filtro que vive en el que pregunta se puede olvidar; una puerta por la que hay que pasar, no."
  - fact: "el servicio de facturación ya recibe el comercio en cada pedido y lo usa en todas sus consultas. Es el único componente del sistema que hoy no puede equivocarse de dueño."
    discoveryPath: "mirá qué entra por la puerta de entrada y qué componente lo consume. El servicio de informes recibe un rango de fechas; el de facturación recibe además de quién es la sesión."
startingDesign:
  nodes:
    - id: comerciante
      type: actor
      label: Comerciante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: panel
      type: web-client
      label: Panel del comercio
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: tenant-scope
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: informes
      type: service
      label: Servicio de informes
      zone: private
      role: reporting-service
      given: true
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de ventas
      zone: restricted
      role: tenant-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: comerciante-panel
      from: { node: comerciante }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-facturacion
      from: { node: gw }
      to: { node: facturacion }
      dataClass: personal
    - id: gw-informes
      from: { node: gw }
      to: { node: informes }
      dataClass: personal
    - id: facturacion-base
      from: { node: facturacion }
      to: { node: base }
      dataClass: personal
    - id: informes-base
      from: { node: informes }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-report-through-scope
    label: el informe llega a los datos pasando por el servicio que sabe de quién son
    weight: 2
    predicate:
      op: path
      from:
        role: reporting-service
      to:
        role: tenant-store
      via:
        role: tenant-scope
    whyMissing: el servicio de informes llega a la base de ventas por su cuenta, sin pasar por el servicio de facturación, que es el único que recibe de qué comercio es cada pedido.
    consequence: el informe se arma con una consulta que alguien escribió a mano. El día que esa consulta cambie (una columna nueva, un reporte nuevo, otra persona) el filtro por comercio depende de que quien la escriba se acuerde.
  - id: g-no-direct-report-query
    label: no queda ninguna consulta directa del servicio de informes contra la base
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: reporting-service
      to:
        role: tenant-store
    whyMissing: sigue existiendo una conexión directa entre el servicio de informes y la base de ventas.
    consequence: mientras esa conexión exista, el camino correcto es opcional. Alcanza con que una consulta nueva use el atajo para que el aislamiento vuelva a depender de la memoria de quien la escribió.
  - id: g-merchant-still-reads
    label: el comercio sigue llegando a sus propios datos
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: tenant-store
    whyMissing: no queda ningún camino desde la puerta de entrada hasta la base de ventas.
    consequence: cortar el acceso también arregla la fuga, y deja al comercio sin poder facturar. Aislar no es dejar de servir.
rubric:
  - dimension: el informe pasa por el componente que conoce al dueño del dato
    signal:
      kind: predicate
      guaranteeId: g-report-through-scope
  - dimension: el atajo que hacía posible la fuga ya no existe
    signal:
      kind: predicate
      guaranteeId: g-no-direct-report-query
  - dimension: el comercio sigue trabajando
    signal:
      kind: predicate
      guaranteeId: g-merchant-still-reads
referenceSolutions:
  - label: el informe le pide los datos al servicio de facturación
    contextInversion: "pedirle los datos al servicio de facturación en el momento es lo correcto cuando el informe es chico y se mira de a uno: cero piezas nuevas que operar y el número que ve el comerciante es el de este segundo. El costo es que un informe pesado se cobra sobre el mismo servicio que está cobrando tarjetas."
    design:
      nodes:
        - id: comerciante
          type: actor
          label: Comerciante
          zone: public
        - id: panel
          type: web-client
          label: Panel del comercio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: tenant-scope
          props: { criticality: "high", replicas: "2" }
        - id: informes
          type: service
          label: Servicio de informes
          zone: private
          role: reporting-service
        - id: base
          type: database
          label: Base de ventas
          zone: restricted
          role: tenant-store
          props: { backup: "diario" }
      edges:
        - id: comerciante-panel
          from: { node: comerciante }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: gw-informes
          from: { node: gw }
          to: { node: informes }
          dataClass: personal
        - id: informes-facturacion
          from: { node: informes }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-base
          from: { node: facturacion }
          to: { node: base }
          dataClass: personal
  - label: el informe se encarga por una cola y lo arma el servicio de facturación
    contextInversion: "encargar el informe y esperarlo conviene cuando el reporte es el cierre de mes de 240 comercios el mismo día: el pedido queda anotado, el servicio de facturación lo arma cuando puede, y el pico no cae sobre el camino por el que se cobra. Se paga con una pieza más para operar y con que el comerciante ya no ve el número al instante."
    design:
      nodes:
        - id: comerciante
          type: actor
          label: Comerciante
          zone: public
        - id: panel
          type: web-client
          label: Panel del comercio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: tenant-scope
          props: { criticality: "high", replicas: "2" }
        - id: informes
          type: service
          label: Servicio de informes
          zone: private
          role: reporting-service
        - id: pedidos
          type: queue
          label: Cola de informes pedidos
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: base
          type: database
          label: Base de ventas
          zone: restricted
          role: tenant-store
          props: { backup: "diario" }
      edges:
        - id: comerciante-panel
          from: { node: comerciante }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: gw-informes
          from: { node: gw }
          to: { node: informes }
          dataClass: personal
        - id: informes-pedidos
          from: { node: informes }
          to: { node: pedidos }
          dataClass: personal
        - id: pedidos-facturacion
          from: { node: pedidos }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-base
          from: { node: facturacion }
          to: { node: base }
          dataClass: personal
status: PILOT
---

Un sistema de facturación que usan **240 comercios**. Todos sobre la misma
base de ventas. Cada comercio entra a su panel, factura, y ve sus números.

El trimestre pasado se agregó un servicio de informes: arma el resumen
mensual de cada comercio consultando la base directamente. Es rápido y no
molesta a nadie.

El 3 de marzo, un comercio de electrodomésticos descargó su resumen de
febrero y encontró **dieciocho ventas que no eran suyas**. Eran de una
farmacia. Mismo día, mismos importes, otro dueño.

La consulta del informe sí tenía un filtro por comercio. Alguien lo había
escrito. Y alguien, tres semanas antes, había agregado una columna nueva
al resumen y reescrito la consulta sin él.

El servicio de facturación no puede cometer ese error: recibe de qué
comercio es cada pedido y lo usa en todas sus consultas, porque sin eso no
sabría a quién cobrarle. El servicio de informes recibe un rango de fechas.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que el informe no pueda llegar a los datos sin
pasar por el componente que sabe de quién son, y para que el atajo que hizo
posible la fuga deje de existir, sin dejar al comercio sin acceso a lo
suyo.
