---
title: "El precio que se cobra"
level: 6
role: tradeoff
domain: retail
tradeoffPairId: resiliencia-el-precio-cuando-el-motor-no-contesta
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 1
D7: 3
D8: 1
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir qué ve el comprador cuando el motor de precios no contesta, y qué queda escrito de esa compra que no se pudo cerrar."
lambda: 0.5
constraints:
  - metric: checkouts por hora en horario pico
    operator: ">="
    value: 1800
    unit: checkouts/hora
  - metric: diferencia máxima admisible entre el precio cobrado y el precio vigente
    operator: "<="
    value: 0
    unit: pesos
  - metric: pedidos cobrados con precio viejo en el incidente de abril
    operator: ">="
    value: 1200
    unit: pedidos
hiddenFacts:
  - fact: "en abril el motor de precios estuvo 50 minutos sin responder. El checkout siguió cobrando con la copia y cerró 1.200 pedidos a precios de una promoción que había terminado el día anterior. La diferencia se pagó entera."
    discoveryPath: "seguí de dónde sale el número que el checkout cobra. Si puede salir de una copia, entonces en algún momento va a salir de una copia vieja, y ese momento va a ser justo cuando el motor no conteste."
  - fact: "el equipo ya tiene la copia armada porque la vidriera la usa y le funciona bien. La tentación es reusarla en el checkout: es la misma copia, del mismo motor, del mismo precio."
    discoveryPath: "la copia es la misma; lo que cambia es qué se hace con el número. Preguntate qué compromete cada lectura: mostrar un precio no obliga a nada, cobrarlo sí."
  - fact: "un checkout que no puede cerrar no es una venta perdida si el carrito queda registrado: el equipo comercial recupera entre el 20 y el 30 % de esos carritos con un aviso al día siguiente."
    discoveryPath: "degradar rechazando no es lo mismo que degradar perdiendo. Fijate qué pasa con el intento fallido si el checkout simplemente devuelve un error y no escribe nada durable."
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
      label: Checkout web
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
      role: storefront-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: copia
      type: cache
      label: Copia de precios de vidriera
      zone: private
      given: true
      position: { x: 805, y: 410 }
    - id: motor
      type: external-provider
      label: Motor de precios del ERP
      zone: dmz
      role: price-source
      given: true
      position: { x: 445, y: 410 }
    - id: recuperacion
      type: external-provider
      label: Plataforma de recuperación de carritos
      zone: dmz
      role: sales-recovery
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
    - id: checkout-copia
      from: { node: checkout }
      to: { node: copia }
      dataClass: public
    - id: checkout-motor
      from: { node: checkout }
      to: { node: motor }
      dataClass: public
guarantees:
  - id: g-precio-de-la-fuente
    label: el precio que se cobra sale del motor
    weight: 2
    predicate:
      op: path
      from:
        role: storefront-service
      to:
        role: price-source
    whyMissing: no hay ningún camino desde el servicio de checkout hasta el motor de precios. Sin la fuente, el checkout cobra lo que tenga a mano, y lo que tiene a mano no es el precio vigente.
    consequence: se cobra un número que nadie puede defender. Cuando el cliente reclama, o cuando reclama defensa del consumidor, no hay forma de mostrar de dónde salió ese importe.
  - id: g-sin-copia-en-el-cobro
    label: ninguna pieza del cobro lee una copia de precios
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [cache]
    whyMissing: hay una pieza del camino de cobro que lee una copia de precios. Mientras exista ese camino, en algún momento el importe va a salir de ahí, y va a ser exactamente cuando el motor no conteste.
    consequence: "abril: 50 minutos sin motor, 1.200 pedidos cobrados con una promoción que había terminado el día anterior, y la diferencia pagada entera. La copia no falló; hizo exactamente lo que una copia hace."
  - id: g-carrito-no-se-pierde
    label: el checkout que no pudo cerrar queda registrado de forma durable para recuperarlo
    weight: 1
    predicate:
      op: noVolatileCut
      from:
        role: storefront-service
      to:
        role: sales-recovery
    whyMissing: no hay ninguna pieza durable entre el servicio de checkout y la plataforma de recuperación de carritos. El intento fallido existe sólo mientras dura el pedido que lo produjo.
    consequence: "rechazar está bien; perder no. Sin registro durable, los 1.800 checkouts por hora que no se pudieron cerrar desaparecen sin dejar rastro, y con ellos el 20 a 30 % que el equipo comercial recupera al día siguiente."
rubric:
  - dimension: el número que compromete dinero sale de la fuente, no de una copia
    signal:
      kind: predicate
      guaranteeId: g-precio-de-la-fuente
  - dimension: la copia se saca del camino, no se le ajusta el tiempo de vida
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-en-el-cobro
  - dimension: degradar rechazando no es lo mismo que degradar perdiendo
    signal:
      kind: predicate
      guaranteeId: g-carrito-no-se-pierde
referenceSolutions:
  - label: cola de carritos sin cerrar
    contextInversion: "una cola es lo correcto cuando el carrito sin cerrar tiene un solo destino, el aviso de recuperación, y lo único que importa es que ninguno se pierda: se toma una vez, se reintenta si la plataforma de recuperación no está, y el rezago se ve como profundidad de cola. Es la topología con menos piezas y la que menos cosas promete. El costo es que si mañana el equipo de datos quiere analizar por qué se caen los checkouts, esos mensajes ya se consumieron."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Checkout web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: checkout
          type: service
          label: Servicio de checkout
          zone: private
          role: storefront-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de carritos sin cerrar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachador
          type: worker
          label: Despachador de recuperación
          zone: private
        - id: motor
          type: external-provider
          label: Motor de precios del ERP
          zone: dmz
          role: price-source
        - id: recuperacion
          type: external-provider
          label: Plataforma de recuperación de carritos
          zone: dmz
          role: sales-recovery
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
        - id: checkout-motor
          from: { node: checkout }
          to: { node: motor }
          dataClass: public
        - id: checkout-cola
          from: { node: checkout }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-recuperacion
          from: { node: despachador }
          to: { node: recuperacion }
          dataClass: personal
  - label: registro de intentos fallidos, con su propia base
    contextInversion: "un registro de eventos con una base detrás conviene cuando el intento fallido no es sólo un carrito que recuperar sino evidencia: cuántos checkouts se cayeron, en qué minutos y con qué error. Después de un incidente como el de abril, poder reconstruir la ventana entera vale más que la pieza que cuesta. Se paga con dos unidades operativas más, todo el margen del presupuesto, y con un registro que hay que dimensionar y retener."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Checkout web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: checkout
          type: service
          label: Servicio de checkout
          zone: private
          role: storefront-service
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: stream
          label: Registro de intentos de checkout
          zone: private
          props: { retention: "30d", partitions: "3" }
        - id: despachador
          type: worker
          label: Despachador de recuperación
          zone: private
        - id: base
          type: database
          label: Base de carritos sin cerrar
          zone: restricted
          props: { backup: "diario" }
        - id: motor
          type: external-provider
          label: Motor de precios del ERP
          zone: dmz
          role: price-source
        - id: recuperacion
          type: external-provider
          label: Plataforma de recuperación de carritos
          zone: dmz
          role: sales-recovery
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
        - id: checkout-motor
          from: { node: checkout }
          to: { node: motor }
          dataClass: public
        - id: checkout-registro
          from: { node: checkout }
          to: { node: registro }
          dataClass: personal
        - id: registro-despachador
          from: { node: registro }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-base
          from: { node: despachador }
          to: { node: base }
          dataClass: personal
        - id: despachador-recuperacion
          from: { node: despachador }
          to: { node: recuperacion }
          dataClass: personal
status: PILOT
---

La misma tienda, la misma copia de precios, el mismo motor del ERP. Un metro
más adelante en el recorrido del comprador: **el checkout**.

Acá el precio no informa. Se cobra. **1.800 checkouts por hora** en horario
pico, y cada uno termina en un importe que la tienda tiene que poder
defender.

El equipo reusó la copia que la vidriera usa. Tiene sentido: es la misma
copia, del mismo motor, del mismo precio. Y funcionó bien hasta abril.

En abril el motor estuvo **50 minutos** sin responder. El checkout no se cayó:
siguió cobrando con la copia. Cerró **1.200 pedidos** a precios de una
promoción que había terminado el día anterior. La diferencia la pagó la
tienda, entera, y el reclamo de defensa del consumidor sigue abierto.

La copia no falló. Hizo exactamente lo que hace una copia: devolvió el último
valor que conocía.

Acá la degradación correcta es la otra: **si el motor no contesta, el checkout
no cierra**. Pero el gerente comercial marca el límite de eso: *"Que no cobre
mal, de acuerdo. Que no me pierda el carrito, eso no."* Entre el 20 y el 30 %
de los carritos sin cerrar se recuperan con un aviso al día siguiente,
siempre que alguien haya anotado que existieron.

Ese aviso lo manda la **plataforma de recuperación de carritos**, que la tienda
contrató en febrero. Está en el lienzo, sin una sola conexión: hoy nadie le
cuenta qué carrito quedó abierto.

El equipo tiene **5 unidades operativas** y hoy usa 3.

**Rearmá el checkout** para que el importe salga siempre del motor y ninguna
pieza del cobro lea una copia. Y resolvé la otra mitad de lo que pide el
gerente: el intento que no se pudo cerrar tiene que terminar en la plataforma
de recuperación, y tiene que llegar aunque el checkout se reinicie en el medio.
