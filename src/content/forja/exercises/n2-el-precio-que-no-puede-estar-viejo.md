---
title: "El precio que no puede estar viejo"
level: 2
role: tradeoff
domain: precios
tradeoffPairId: n2-precio-en-el-checkout
D1: 1
D2: 2
D3: 2
D4: 1
D5: 1
D6: 1
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, cuántos segundos de precio viejo es capaz de tolerar este negocio y de dónde sacaste ese número."
lambda: 0.5
constraints:
  - metric: desfase tolerado entre el precio publicado y el precio cobrado
    operator: "<="
    value: 0
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: el precio de una butaca cambia hasta 40 veces por minuto en los diez minutos previos al partido. La copia que hoy usa el checkout se actualiza cada 15 segundos.
    discoveryPath: "compará las dos frecuencias. Una copia que se refresca cada 15 segundos sobre un dato que cambia 40 veces por minuto no está atrasada a veces: está atrasada casi siempre."
  - fact: en los últimos tres meses la diferencia entre el precio mostrado y el precio real costó 61.000 dólares en reclamos y reintegros, todos por butacas vendidas por debajo del precio vigente.
    discoveryPath: "el reclamo no aparece en el diagrama, pero la pieza que lo produce sí: es el almacenamiento intermedio del que el checkout lee el precio en vez de preguntárselo a su dueño."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Sitio de venta de entradas
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
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: checkoutdb
      type: database
      label: Base de ventas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: precios
      type: service
      label: Servicio de precios
      zone: private
      role: pricing-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: preciosdb
      type: database
      label: Base de precios
      zone: restricted
      role: price-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
    - id: eventos
      type: stream
      label: Registro de cambios de precio
      zone: private
      given: true
      props: { retention: "7d", partitions: "3" }
      position: { x: 805, y: 520 }
    - id: copiador
      type: worker
      label: Copiador de precios
      zone: private
      given: true
      position: { x: 445, y: 520 }
  edges:
    - id: comprador-web
      from: { node: comprador }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-checkout
      from: { node: gw }
      to: { node: checkout }
      dataClass: personal
    - id: checkout-checkoutdb
      from: { node: checkout }
      to: { node: checkoutdb }
      dataClass: personal
    - id: gw-precios
      from: { node: gw }
      to: { node: precios }
      dataClass: public
    - id: precios-preciosdb
      from: { node: precios }
      to: { node: preciosdb }
      dataClass: public
    - id: precios-eventos
      from: { node: precios }
      to: { node: eventos }
      dataClass: public
    - id: eventos-copiador
      from: { node: eventos }
      to: { node: copiador }
      dataClass: public
    - id: copiador-checkoutdb
      from: { node: copiador }
      to: { node: checkoutdb }
      dataClass: public
guarantees:
  - id: g-live-price-read
    label: el checkout lee el precio del dueño del precio, sin copia en el medio
    weight: 2
    predicate:
      op: path
      from:
        role: checkout-service
      to:
        role: price-db
      via:
        role: pricing-service
      forbid:
        type: [queue, stream, cache, object-storage]
    whyMissing: no hay ningún camino desde el servicio de checkout hasta la base de precios que atraviese el servicio de precios sin pasar antes por una cola, un registro de eventos, un almacenamiento en memoria o un archivo.
    consequence: "el checkout cobra el precio que tenía la copia, no el que rige. En diez minutos de reventa eso son 61.000 dólares de diferencia y una fila de reclamos que el equipo de atención resuelve a mano, uno por uno."
  - id: g-no-price-buffer
    label: ningún servicio deja el precio en un intermediario
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [service]
      to:
        type: [queue, stream]
    whyMissing: hay un servicio que publica en una cola o en un registro de eventos, y en este negocio ese intermediario es exactamente lo que separa el precio publicado del precio vigente.
    consequence: "un intermediario no atrasa el dato sólo cuando falla: lo atrasa siempre, por diseño. Mantenerlo mientras se promete precio exacto es prometer algo que la forma del sistema no puede cumplir."
  - id: g-pricing-owns-its-store
    label: la base de precios la sigue escribiendo el servicio de precios
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: price-db
        - op: covered
          target:
            role: price-db
          by:
            role: pricing-service
    whyMissing: la base de precios no existe, o no está conectada al servicio de precios.
    consequence: si el precio deja de tener un dueño único, "el precio vigente" pasa a ser una opinión. Y en una venta de entradas, dos opiniones distintas son dos importes cobrados por la misma butaca.
rubric:
  - dimension: el precio cobrado es el precio vigente en ese instante
    signal:
      kind: predicate
      guaranteeId: g-live-price-read
  - dimension: no hay intermediarios entre el dato y quien lo consume
    signal:
      kind: predicate
      guaranteeId: g-no-price-buffer
  - dimension: el precio conserva un dueño único
    signal:
      kind: predicate
      guaranteeId: g-pricing-owns-its-store
referenceSolutions:
  - label: el checkout le pregunta al servicio de precios en el momento
    contextInversion: "preguntar en el momento es lo correcto exactamente acá: el precio cambia 40 veces por minuto y el negocio no tolera un solo segundo de desfase, así que la única fuente aceptable es el dueño del dato. Se paga con que la venta depende de que precios esté respondiendo: si precios se cae, no se vende. En un negocio que tolerara un precio de hace 15 segundos, esta decisión sería la equivocada."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Sitio de venta de entradas
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
          props: { criticality: "medium", replicas: "2" }
        - id: checkoutdb
          type: database
          label: Base de ventas
          zone: restricted
          props: { backup: "diario" }
        - id: precios
          type: service
          label: Servicio de precios
          zone: private
          role: pricing-service
          props: { criticality: "medium", replicas: "2" }
        - id: preciosdb
          type: database
          label: Base de precios
          zone: restricted
          role: price-db
          props: { backup: "diario" }
      edges:
        - id: comprador-web
          from: { node: comprador }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: checkout-checkoutdb
          from: { node: checkout }
          to: { node: checkoutdb }
          dataClass: personal
        - id: checkout-precios
          from: { node: checkout }
          to: { node: precios }
          dataClass: public
        - id: precios-preciosdb
          from: { node: precios }
          to: { node: preciosdb }
          dataClass: public
  - label: una pieza de venta que habla con precios y el checkout sólo cobra
    contextInversion: "poner la conversación con precios en una pieza de venta conviene cuando hay más de un canal que necesita el precio vigente, como el sitio, la taquilla y los revendedores autorizados, y no querés que cada uno arme su propia llamada. El precio sigue viniendo del dueño en el instante de la venta; lo que cambia es quién es responsable de pedirlo. Se paga con una unidad operativa más y con un salto extra en el camino de la compra."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Sitio de venta de entradas
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
          props: { criticality: "medium", replicas: "2" }
        - id: checkoutdb
          type: database
          label: Base de ventas
          zone: restricted
          props: { backup: "diario" }
        - id: venta
          type: service
          label: Servicio de venta
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: precios
          type: service
          label: Servicio de precios
          zone: private
          role: pricing-service
          props: { criticality: "medium", replicas: "2" }
        - id: preciosdb
          type: database
          label: Base de precios
          zone: restricted
          role: price-db
          props: { backup: "diario" }
      edges:
        - id: comprador-web
          from: { node: comprador }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: checkout-checkoutdb
          from: { node: checkout }
          to: { node: checkoutdb }
          dataClass: personal
        - id: checkout-venta
          from: { node: checkout }
          to: { node: venta }
          dataClass: public
        - id: venta-precios
          from: { node: venta }
          to: { node: precios }
          dataClass: public
        - id: precios-preciosdb
          from: { node: precios }
          to: { node: preciosdb }
          dataClass: public
status: PILOT
---

Venta de entradas para partidos. En los **diez minutos previos** al comienzo,
el precio de una butaca cambia hasta **40 veces por minuto**: se mueve con la
demanda, con las butacas liberadas y con el precio que ponen los revendedores
autorizados.

El sistema de hoy hace lo que parece razonable. El servicio de precios publica
cada cambio, un proceso lo copia, y el checkout lee la copia. La copia se
refresca **cada 15 segundos**.

En tres meses, la diferencia entre el precio que el comprador vio y el precio
que regía costó **61.000 dólares** en reintegros y reclamos, siempre para el
mismo lado: butacas vendidas por debajo del precio vigente, porque la copia
iba atrás.

El dueño de producto es explícito y el contrato con los clubes lo respalda:
**el precio cobrado tiene que ser el precio vigente en ese instante**. Cero
segundos de desfase. Si precios está caído, prefiere no vender antes que
vender mal.

El equipo tiene **7 unidades operativas** y hoy usa 7.

**Rearmá el sistema** para que el precio que se cobra venga de quien es dueño
del precio, sin nada en el medio que pueda tener una versión distinta.
