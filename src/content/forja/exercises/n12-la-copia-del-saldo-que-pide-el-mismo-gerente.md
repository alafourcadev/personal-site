---
title: "La copia del saldo que pide el mismo gerente"
level: 12
role: counter-trap
domain: retail
D1: 4
D2: 3
D3: 3
D4: 4
D5: 2
D6: 2
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 5
aiBudget: "libre para el diseño. La decisión no: es la misma pregunta del catálogo con la respuesta al revés, y el único que puede sostener por qué la respuesta cambió sos vos. Si lo resolvés preguntando 'qué se hizo la vez pasada', ya perdiste el criterio."
lambda: 4.0
constraints:
  - metric: disponibilidad declarada del emisor de la tarjeta de beneficios
    operator: "<="
    value: 97
    unit: por ciento
  - metric: comercios adheridos donde el mismo cliente puede gastar el saldo
    operator: ">="
    value: 3400
    unit: comercios
  - metric: plazo del emisor para responder un contracargo con la evidencia de la autorización
    operator: "<="
    value: 45
    unit: días
  - metric: presupuesto operativo del equipo de comercio electrónico
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "el saldo de la tarjeta de beneficios se consume en 3.400 comercios adheridos que no son de la cadena. Entre dos refrescos de la copia, el mismo cliente pudo haber gastado el saldo entero en otro lado y tu sistema no vio nada."
    discoveryPath: "está en la segunda restricción. Es la misma pregunta del ejercicio anterior, qué puede cambiar este dato sin que yo lo vea, y acá la respuesta no es 'nada': son 3.400 comercios."
  - fact: "el sincronizador que ya está armado corre cada quince minutos. En el piloto de diciembre autorizó 214 consumos contra saldo que ya no existía; el emisor los rechazó después y la cadena los absorbió como pérdida."
    discoveryPath: "la copia y el sincronizador vienen en el lienzo, funcionando. Ese es el punto: el diseño que trae este ejercicio es la respuesta correcta del ejercicio anterior, aplicada donde no va."
  - fact: "el emisor da 45 días para responder un contracargo, y lo que pide es la evidencia de la autorización: qué se preguntó, qué contestó y cuándo. Si el cobro se resolvió contra una copia local, esa evidencia no existe."
    discoveryPath: "está en la tercera restricción. Sacar la copia sin dejar constancia de cada intento cambia un problema por otro: dejás de autorizar de más y perdés la forma de defender los cobros correctos."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tienda
      type: web-client
      label: Tienda
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      props: { authn: "sí", rateLimit: "sí" }
      position: { x: 445, y: 190 }
    - id: checkout
      type: service
      label: Servicio de cobro
      zone: private
      role: checkout-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 520 }
    - id: copia
      type: database
      label: Copia local de saldos
      zone: restricted
      role: balance-copy
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: sincronizador
      type: worker
      label: Sincronizador de saldos
      zone: private
      given: true
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 410 }
    - id: emisor
      type: external-provider
      label: Emisor de la tarjeta de beneficios
      zone: dmz
      role: balance-issuer
      given: true
      props: { availability: "97.0", slaMinutes: "120" }
      position: { x: 445, y: 300 }
    - id: pedidos
      type: database
      label: Base de pedidos
      zone: restricted
      role: order-record
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 520 }
    - id: archivo
      type: object-storage
      label: Archivo de autorizaciones
      zone: private
      role: auth-archive
      given: true
      props: { durability: "99.999999999", access: "signed" }
      position: { x: 805, y: 630 }
  edges:
    - id: comprador-tienda
      from: { node: comprador }
      to: { node: tienda }
      dataClass: public
    - id: tienda-gw
      from: { node: tienda }
      to: { node: gw }
      dataClass: personal
    - id: gw-checkout
      from: { node: gw }
      to: { node: checkout }
      dataClass: personal
    - id: checkout-copia
      from: { node: checkout }
      to: { node: copia }
      dataClass: regulated
    - id: checkout-pedidos
      from: { node: checkout }
      to: { node: pedidos }
      dataClass: personal
    - id: sincronizador-emisor
      from: { node: sincronizador }
      to: { node: emisor }
      dataClass: regulated
    - id: sincronizador-copia
      from: { node: sincronizador }
      to: { node: copia }
      dataClass: regulated
guarantees:
  - id: g-live-balance
    label: el cobro le pregunta el saldo al emisor y nadie lee una copia local
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            role: checkout-service
          to:
            role: balance-issuer
        - op: edgeAbsent
          from:
            type: [service, worker]
          to:
            role: balance-copy
    whyMissing: "o no hay camino desde el servicio de cobro hasta el emisor, o todavía queda alguien leyendo o escribiendo la copia local de saldos."
    consequence: "el mismo saldo se gasta en 3.400 comercios que no son tuyos. Entre dos refrescos, el cliente pudo haberlo consumido entero sin que tu sistema viera nada, y autorizar contra esa copia es autorizar consumos que no existen. En el piloto de diciembre fueron 214, y los pagó la cadena."
  - id: g-auth-archived
    label: cada intento de autorización queda archivado con lo que se preguntó y lo que contestó
    weight: 2
    predicate:
      op: path
      from:
        role: checkout-service
      to:
        role: auth-archive
    whyMissing: no hay ningún camino desde el servicio de cobro hasta el archivo de autorizaciones.
    consequence: "el emisor da 45 días para responder un contracargo y lo que pide es la evidencia del intento: qué se preguntó, qué contestó y cuándo. Sin ese archivo, cada contracargo se pierde por no poder contestarlo, y se pierden también los cobros que estaban bien hechos."
  - id: g-observed
    label: todos los servicios reportan lo que les pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: "el emisor declara 97 %: unos once días al año en los que va a rechazar o tardar. Sin medirlo desde tu lado, la conversación del próximo contrato es tu impresión contra su panel, y la decisión de cuánto tiempo esperarlo antes de rechazar una compra se toma sin ningún número."
rubric:
  - dimension: el saldo se pregunta a quien lo mueve, no a una copia
    signal:
      kind: predicate
      guaranteeId: g-live-balance
  - dimension: el cobro correcto se puede defender 45 días después
    signal:
      kind: predicate
      guaranteeId: g-auth-archived
  - dimension: el comportamiento del emisor es un número tuyo, no una impresión
    signal:
      kind: predicate
      guaranteeId: g-observed
  - dimension: el diseño entra en el presupuesto del equipo de comercio electrónico
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: el cobro pregunta y archiva
    contextInversion: "que el propio servicio de cobro hable con el emisor y archive el intento se defiende cuando la autorización es una sola llamada y una sola decisión: se pregunta, contesta, se cobra o no se cobra. Meter una pieza intermedia para eso agrega un salto y una cosa más para operar sin cambiar ninguna respuesta, y con cinco unidades de presupuesto eso pesa. Al gerente comercial le decís que su pedido es el mismo de la vez pasada y que la respuesta cambió por una sola razón, que él puede verificar sin saber de arquitectura: el precio del catálogo lo mueve una sola persona una vez por día y vos la ves; el saldo lo mueven 3.400 comercios y no ves ninguno. Lo que aceptás a cambio: los once días al año del emisor son once días con compras rechazadas, y esa es una pérdida real que hay que poner en la mesa en vez de esconderla detrás de una copia."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: tienda
          type: web-client
          label: Tienda
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: checkout
          type: service
          label: Servicio de cobro
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          role: order-record
          props: { backup: "diario", consistency: "strong" }
        - id: emisor
          type: external-provider
          label: Emisor de la tarjeta de beneficios
          zone: dmz
          role: balance-issuer
          props: { availability: "97.0", slaMinutes: "120" }
        - id: archivo
          type: object-storage
          label: Archivo de autorizaciones
          zone: private
          role: auth-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-tienda
          from: { node: comprador }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: checkout-emisor
          from: { node: checkout }
          to: { node: emisor }
          dataClass: regulated
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-archivo
          from: { node: checkout }
          to: { node: archivo }
          dataClass: regulated
        - id: checkout-monitoreo
          from: { node: checkout }
          to: { node: monitoreo }
          dataClass: public
  - label: un servicio de autorización propio
    contextInversion: "separar la autorización en un servicio propio se defiende cuando el emisor no es uno solo: la cadena ya firmó con un segundo programa de beneficios y hay un tercero en negociación, cada uno con su formato, su tiempo de espera y su forma de decir que no. Con esa lógica en un servicio, agregar un emisor es un cambio en un lugar; sin él, es un cambio en el servicio de cobro cada vez, que es el que no querés tocar. Al gerente comercial le llevás el mismo argumento sobre la copia y le agregás que el segundo programa entra sin frenar la tienda. Lo que aceptás a cambio: una unidad operativa más de las cinco que tenés, un salto de red en el camino del cobro, y que la caída de ese servicio sea una caída del cobro entero, no de un emisor."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: tienda
          type: web-client
          label: Tienda
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: checkout
          type: service
          label: Servicio de cobro
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: autorizacion
          type: service
          label: Servicio de autorización
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          role: order-record
          props: { backup: "diario", consistency: "strong" }
        - id: emisor
          type: external-provider
          label: Emisor de la tarjeta de beneficios
          zone: dmz
          role: balance-issuer
          props: { availability: "97.0", slaMinutes: "120" }
        - id: archivo
          type: object-storage
          label: Archivo de autorizaciones
          zone: private
          role: auth-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-tienda
          from: { node: comprador }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: checkout-autorizacion
          from: { node: checkout }
          to: { node: autorizacion }
          dataClass: regulated
        - id: autorizacion-emisor
          from: { node: autorizacion }
          to: { node: emisor }
          dataClass: regulated
        - id: autorizacion-archivo
          from: { node: autorizacion }
          to: { node: archivo }
          dataClass: regulated
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-monitoreo
          from: { node: checkout }
          to: { node: monitoreo }
          dataClass: public
        - id: autorizacion-monitoreo
          from: { node: autorizacion }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

La misma cadena de ferreterías. El mismo gerente comercial. Tres meses
después.

La copia del catálogo funcionó: la tienda no volvió a quedarse sin poder
armar un carrito, y el sincronizador de las 06:00 no falló ni una vez. Con
ese antecedente sobre la mesa, el gerente pide lo siguiente, y lo pide con
la misma frase que le funcionó: **guardá una copia del saldo de la tarjeta
de beneficios**.

El pedido es razonable en todos los aspectos visibles. El emisor de la
tarjeta declara **97 % de disponibilidad**, o sea unos once días al año en los que
el cobro con beneficios falla; el volumen es alto, y la solución que se
aplicó al catálogo está ahí al lado, andando. De hecho **ya está armada**:
la copia local, el sincronizador cada quince minutos, todo conectado. Este
sistema es la respuesta correcta del problema anterior, puesta acá.

Hacé la misma pregunta que la vez pasada: **¿qué puede cambiar este dato sin
que yo lo vea?**

El saldo de esa tarjeta se gasta en **3.400 comercios adheridos** que no son
de la cadena. Entre dos refrescos, el mismo cliente pudo haberlo consumido
entero en una farmacia, en una estación de servicio y en un supermercado, y
tu sistema no vio ninguna de las tres cosas. En el piloto de diciembre esto
ya pasó: **214 consumos autorizados contra saldo que no existía**,
rechazados después por el emisor y absorbidos por la cadena.

Así que esta vez el no se sostiene, y se sostiene con el mismo criterio con
el que la vez pasada se dijo que sí. No es "depende": es una pregunta con
respuesta distinta porque el dato es distinto. Eso es lo que tenés que poder
decir en la reunión, porque el gerente va a llegar con el acta de la reunión
anterior en la mano y va a tener razón en que le dijiste que sí.

Hay una cosa más que sacar la copia no resuelve. El emisor da **45 días**
para responder un contracargo y lo que pide es la evidencia del intento:
qué se preguntó, qué contestó y cuándo. Si el cobro se resolvió contra una
copia, esa evidencia nunca existió.

El **archivo de autorizaciones** está en el lienzo, sin una sola conexión. Se
creó cuando se firmó el convenio con el emisor y nunca recibió un registro.

El equipo de comercio electrónico sostiene **cinco piezas**.

**Armá el sistema** para que el cobro le pregunte el saldo al emisor y nadie
lea una copia local, para que cada intento de autorización quede archivado,
y para que todos los servicios reporten lo que les pasa.
