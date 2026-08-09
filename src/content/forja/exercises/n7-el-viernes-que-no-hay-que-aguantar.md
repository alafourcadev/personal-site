---
title: "El viernes que no hay que aguantar"
level: 7
role: core
domain: retail
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 4
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que separar el tráfico que hay que aguantar del que no hay que aguantar. Una respuesta que trata a los dos igual no leyó el problema."
lambda: 3.0
constraints:
  - metric: visitas al catálogo durante los 40 minutos de la oferta
    operator: ">="
    value: 1200000
    unit: visitas
  - metric: compras cerradas durante esos mismos 40 minutos
    operator: "<="
    value: 9000
    unit: compras
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "de 1.200.000 visitas al catálogo, 9.000 terminan en compra. El 99,25 % del tráfico del pico es gente mirando precios."
    discoveryPath: "compará los dos números que el negocio ya te dio. El tráfico que hay que aguantar y el tráfico que hay que atender no son el mismo tráfico, y no se resuelven con la misma pieza."
  - fact: "los precios de la oferta se cargan la noche anterior y no cambian durante los 40 minutos. El catálogo del viernes es, literalmente, un archivo."
    discoveryPath: "preguntá cuándo cambia el dato que estás sirviendo. Si no cambia durante el pico, no hace falta calcularlo durante el pico."
  - fact: "el sistema ya está una unidad operativa por encima de lo que el equipo puede sostener. La caché de catálogo entró el año pasado como solución al mismo problema y no alcanzó."
    discoveryPath: "sumá las unidades operativas del diseño que te entregan y compará con el presupuesto declarado. Empezás debiendo, no empatado."
startingDesign:
  nodes:
    - id: comprador
      type: mobile-client
      label: App del comprador
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: catalogo
      type: service
      label: Servicio de catálogo
      zone: private
      role: catalogo-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: checkout
      type: service
      label: Servicio de compra
      zone: private
      role: checkout-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: productos
      type: database
      label: Base de productos y precios
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: pedidos
      type: database
      label: Base de pedidos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
    - id: cachecatalogo
      type: cache
      label: Caché de catálogo
      zone: private
      given: true
      props: { ttl: "300", eviction: "lru" }
      position: { x: 805, y: 190 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: comprador-gw
      from: { node: comprador }
      to: { node: gw }
      dataClass: personal
    - id: gw-catalogo
      from: { node: gw }
      to: { node: catalogo }
      dataClass: public
    - id: gw-checkout
      from: { node: gw }
      to: { node: checkout }
      dataClass: personal
    - id: catalogo-productos
      from: { node: catalogo }
      to: { node: productos }
      dataClass: public
    - id: catalogo-cachecatalogo
      from: { node: catalogo }
      to: { node: cachecatalogo }
      dataClass: public
    - id: checkout-pedidos
      from: { node: checkout }
      to: { node: pedidos }
      dataClass: personal
    - id: checkout-obs
      from: { node: checkout }
      to: { node: obs }
      dataClass: public
    - id: catalogo-obs
      from: { node: catalogo }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-catalogo-en-distribucion
    label: el catálogo de la oferta llega a una red de distribución
    weight: 2
    predicate:
      op: path
      from:
        role: catalogo-service
      to:
        type: [cdn]
    whyMissing: lo que arma el servicio de catálogo no llega a ninguna red de distribución, así que cada una de las visitas termina dentro de tu infraestructura.
    consequence: "1.200.000 visitas contra un servicio que también sostiene la base de precios. Lo primero que se cae no es el catálogo: es la base, y con la base se cae la compra, que era lo único que dejaba dinero."
  - id: g-compra-viva
    label: el comprador todavía puede comprar
    weight: 2
    predicate:
      op: path
      from:
        type: [mobile-client, web-client]
      to:
        role: checkout-service
    whyMissing: no hay ningún camino desde la app del comprador hasta el servicio de compra.
    consequence: "aguantar el pico apagando la compra es aguantar el pico sin vender. Las 9.000 compras son la razón por la que existe el viernes; las 1.200.000 visitas son sólo su costo."
  - id: g-datos-vivos
    label: el catálogo y la compra siguen apoyados en datos que persisten
    weight: 1
    predicate:
      op: all
      of:
        - op: path
          from:
            role: catalogo-service
          to:
            type: [database]
        - op: path
          from:
            role: checkout-service
          to:
            type: [database]
    whyMissing: el servicio de catálogo o el servicio de compra dejó de llegar a alguna base.
    consequence: "bajar el consumo borrando una base es bajar el consumo borrando el negocio. Un pedido que no se escribe en ningún lado es un pedido que no existe cuando el comprador pregunta por él el lunes."
  - id: g-sin-cache-caliente
    label: ninguna pieza tuya guarda una copia del catálogo en memoria
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [cache]
    whyMissing: hay un componente leyendo o escribiendo una caché de catálogo.
    consequence: "una vez que la red de distribución responde por vos, la caché queda cubriendo un tráfico que ya no llega. Es una unidad operativa que pagás todos los días del año para un problema que existe cuarenta minutos, y que además ya no existe."
rubric:
  - dimension: el tráfico que no deja dinero no entra a tu infraestructura
    signal:
      kind: predicate
      guaranteeId: g-catalogo-en-distribucion
  - dimension: el camino que sí deja dinero sigue abierto
    signal:
      kind: predicate
      guaranteeId: g-compra-viva
  - dimension: recortaste piezas, no datos
    signal:
      kind: predicate
      guaranteeId: g-datos-vivos
  - dimension: no queda ninguna pieza cubriendo un problema que ya resolviste
    signal:
      kind: predicate
      guaranteeId: g-sin-cache-caliente
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: la red de distribución le pide el catálogo al servicio
    contextInversion: "que la red de distribución pida la página al servicio cuando le vence la copia es lo correcto cuando los precios pueden cambiar sin aviso: si el área comercial baja un precio a las 20:14, la corrección se propaga sola al vencer la copia. Se paga con que el servicio sigue recibiendo tráfico, poco pero real, durante todo el pico, y con que si el servicio se cae justo cuando vence una copia, esa página se cae con él."
    design:
      nodes:
        - id: comprador
          type: mobile-client
          label: App del comprador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: catalogo
          type: service
          label: Servicio de catálogo
          zone: private
          role: catalogo-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: checkout
          type: service
          label: Servicio de compra
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: productos
          type: database
          label: Base de productos y precios
          zone: restricted
          props: { backup: "diario" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-gw
          from: { node: comprador }
          to: { node: gw }
          dataClass: personal
        - id: gw-catalogo
          from: { node: gw }
          to: { node: catalogo }
          dataClass: public
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: catalogo-productos
          from: { node: catalogo }
          to: { node: productos }
          dataClass: public
        - id: catalogo-distribucion
          from: { node: catalogo }
          to: { node: distribucion }
          dataClass: public
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
          dataClass: public
        - id: catalogo-obs
          from: { node: catalogo }
          to: { node: obs }
          dataClass: public
  - label: el catálogo se publica la noche anterior en un almacén de objetos
    contextInversion: "publicar el catálogo entero como archivos la noche anterior es lo correcto cuando el precio de la oferta está congelado por acuerdo comercial: durante los cuarenta minutos, el servicio de catálogo puede estar apagado y nadie lo nota, porque nadie lo llama. Es la única variante donde el pico de lectura tiene cero relación con tu infraestructura. Se paga con que corregir un precio mal cargado deja de ser un cambio en la base y pasa a ser una republicación, y con que hay una ventana entre la publicación y la oferta donde el catálogo publicado y la base no dicen lo mismo."
    design:
      nodes:
        - id: comprador
          type: mobile-client
          label: App del comprador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: catalogo
          type: service
          label: Servicio de catálogo
          zone: private
          role: catalogo-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: checkout
          type: service
          label: Servicio de compra
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: productos
          type: database
          label: Base de productos y precios
          zone: restricted
          props: { backup: "diario" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: publicado
          type: object-storage
          label: Catálogo publicado
          zone: private
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-gw
          from: { node: comprador }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: catalogo-productos
          from: { node: catalogo }
          to: { node: productos }
          dataClass: public
        - id: catalogo-publicado
          from: { node: catalogo }
          to: { node: publicado }
          dataClass: public
        - id: publicado-distribucion
          from: { node: publicado }
          to: { node: distribucion }
          dataClass: public
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-obs
          from: { node: checkout }
          to: { node: obs }
          dataClass: public
        - id: catalogo-obs
          from: { node: catalogo }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Una tienda de electrodomésticos hace una oferta relámpago de cuarenta
minutos. El año pasado, en esos cuarenta minutos, entraron **1.200.000
visitas al catálogo** y se cerraron **9.000 compras**.

El sitio estuvo caído once minutos. No se cayó el catálogo primero: se cayó
la base, y con la base se cayeron también las compras. Nadie sabe cuántas.

El equipo llega a la reunión de este año con la propuesta de siempre: más
máquinas para el catálogo. Y con un problema que no había el año pasado: el
sistema ya tiene **siete unidades operativas y el presupuesto es seis**. La
caché de catálogo entró el año pasado exactamente para esto y no alcanzó.

Antes de agregar nada, mirá los dos números del negocio otra vez. De cada
133 visitas, una compra. **El tráfico que hay que aguantar y el tráfico que
deja dinero no son el mismo tráfico**, y no tienen por qué resolverse con la
misma pieza. El precio de la oferta, además, se carga la noche anterior y no
se toca durante los cuarenta minutos.

**Rearmá el sistema para que el pico de lectura no llegue a tu
infraestructura, sin pasarte de seis unidades operativas y sin apagar la
compra.** Vas a tener que sacar algo: empezás debiendo una unidad.
