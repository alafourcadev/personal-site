---
title: "El precio que no puede tumbar la venta"
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
  opsUnits: 8
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, cuánto vale un carrito perdido y cuánto vale un precio de hace dos minutos. Si no podés poner los dos números, todavía no decidiste nada."
lambda: 0.5
constraints:
  - metric: desfase tolerado entre el precio de lista y el precio cobrado
    operator: "<="
    value: 300
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: el precio de un artículo de almacén cambia en promedio una vez cada nueve días, y siempre por una revisión programada, nunca en vivo.
    discoveryPath: "compará la frecuencia de cambio del precio con la frecuencia de las compras. Si el dato cambia cada nueve días y se lee 30.000 veces por día, leerlo del dueño en cada lectura es pagar disponibilidad por algo que casi nunca cambia."
  - fact: el servicio de precios corre el recálculo de márgenes todos los martes a las 6 y durante ese recálculo responde entre 4 y 30 segundos.
    discoveryPath: "seguí la flecha que sale del checkout hacia precios y preguntate qué le pasa al comprador cuando el destino tarda 30 segundos. Todo lo que esté detrás de esa flecha hereda el peor martes del mes."
  - fact: el martes 12 el recálculo se trabó 22 minutos. Se perdieron 1.900 carritos, con un ticket promedio de 34 dólares.
    discoveryPath: "la cuenta está en el enunciado. Comparala con el costo de que alguien pague el precio de hace dos minutos en vez del de ahora."
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
      label: Tienda de almacén
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
      label: Base del checkout
      zone: restricted
      role: checkout-db
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
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
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
    - id: gw-precios
      from: { node: gw }
      to: { node: precios }
      dataClass: public
    - id: precios-preciosdb
      from: { node: precios }
      to: { node: preciosdb }
      dataClass: public
guarantees:
  - id: g-checkout-independiente
    label: el checkout no llama al servicio de precios
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: checkout-service
      to:
        role: pricing-service
    whyMissing: hay una conexión que sale del servicio de checkout y entra al servicio de precios.
    consequence: "mientras esa llamada exista, la venta hereda el peor minuto de precios. El martes 12 fueron 22 minutos de recálculo trabado y 1.900 carritos perdidos: nadie compró, y el precio que no pudieron cobrar era el mismo de hacía nueve días."
  - id: g-price-copy-arrives
    label: el cambio de precio llega al almacenamiento del checkout por un intermediario
    weight: 2
    predicate:
      op: path
      from:
        role: pricing-service
      to:
        role: checkout-db
      via:
        type: [queue, stream]
    whyMissing: no hay ningún camino desde el servicio de precios hasta el almacenamiento del checkout que pase por una cola o por un registro de eventos.
    consequence: "sin ese camino el checkout se queda con precios que nadie actualiza nunca. Cortar la llamada sin poner por dónde llega el cambio no desacopla: rompe. El intermediario es lo que permite que precios publique a su ritmo y el checkout consuma al suyo."
  - id: g-checkout-reads-its-own
    label: el checkout resuelve el precio contra su propio almacenamiento
    weight: 1
    predicate:
      op: path
      from:
        role: checkout-service
      to:
        role: checkout-db
      forbid:
        role: pricing-service
    whyMissing: no hay ningún camino desde el servicio de checkout hasta su propio almacenamiento que no atraviese el servicio de precios.
    consequence: si para leer su propia copia el checkout tiene que pasar por precios, la copia no le sirve de nada. La independencia se mide en el peor momento del otro, no en el mejor.
rubric:
  - dimension: la venta sigue funcionando cuando precios no responde
    signal:
      kind: predicate
      guaranteeId: g-checkout-independiente
  - dimension: la copia del precio se mantiene al día por un camino explícito
    signal:
      kind: predicate
      guaranteeId: g-price-copy-arrives
  - dimension: el checkout resuelve la compra con lo que ya tiene
    signal:
      kind: predicate
      guaranteeId: g-checkout-reads-its-own
referenceSolutions:
  - label: los cambios de precio se copian al almacenamiento del checkout
    contextInversion: "la copia propia es lo correcto exactamente acá: el precio cambia una vez cada nueve días y se lee 30.000 veces por día, así que pagar disponibilidad de precios en cada lectura es pagar de más. Se acepta que el precio pueda estar hasta unos minutos atrás, que es menos de lo que cambia el dato. En una venta de entradas con precio que se mueve 40 veces por minuto, esta misma decisión sería la equivocada."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Tienda de almacén
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
          label: Base del checkout
          zone: restricted
          role: checkout-db
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
          props: { backup: "diario" }
        - id: eventos
          type: stream
          label: Registro de cambios de precio
          zone: private
          props: { retention: "7d", partitions: "3" }
        - id: copiador
          type: worker
          label: Copiador de precios
          zone: private
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
  - label: el cambio de precio se lo aplica el propio checkout
    contextInversion: "hacer que el cambio entre por el servicio dueño del almacenamiento conviene cuando aplicar un precio nuevo tiene reglas propias del checkout, como redondeos, promociones vigentes o artículos con precio congelado por contrato, y no querés esa lógica repetida en un proceso aparte. Se paga con que el checkout recibe carga de escritura además de la de venta, y con que un pico de cambios de precio compite con las compras."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Tienda de almacén
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
          label: Base del checkout
          zone: restricted
          role: checkout-db
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
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de cambios de precio
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: aplicador
          type: worker
          label: Aplicador de cambios de precio
          zone: private
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
        - id: precios-cola
          from: { node: precios }
          to: { node: cola }
          dataClass: public
        - id: cola-aplicador
          from: { node: cola }
          to: { node: aplicador }
          dataClass: public
        - id: aplicador-checkout
          from: { node: aplicador }
          to: { node: checkout }
          dataClass: public
status: PILOT
---

Una tienda de almacén en línea. **30.000 compras por día**, 60.000 artículos
publicados. El precio de un artículo cambia en promedio **una vez cada nueve
días**, y siempre por una revisión programada: nadie mueve precios en vivo.

Hoy el checkout le pregunta el precio al servicio de precios en cada compra.
Es la forma correcta cuando el dato tiene que ser exacto al segundo. Acá el
dato cambia una vez cada nueve días.

Todos los martes a las 6 de la mañana, precios corre el recálculo de márgenes
y durante ese rato responde entre 4 y 30 segundos. El **martes 12** el
recálculo se trabó **22 minutos**. En esos 22 minutos se perdieron **1.900
carritos** con un ticket promedio de 34 dólares. El precio que el sistema no
pudo consultar era, para casi todos esos artículos, el mismo de hacía nueve
días.

El dueño de producto pone el número sobre la mesa: acepta que se cobre un
precio de **hasta cinco minutos atrás**. No acepta perder una venta porque
precios esté ocupado.

El equipo tiene **8 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que la venta no dependa de que precios responda, y
para que el cambio de precio siga llegando por un camino que alguien pueda
señalar en el diagrama.
