---
title: "La copia del catálogo que pide comercial"
level: 12
role: trap
domain: retail
D1: 4
D2: 3
D3: 3
D4: 3
D5: 3
D6: 3
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 7
aiBudget: "libre. Y una advertencia que vale para esta hora: preguntarle a un modelo si conviene duplicar la fuente de verdad de un tercero devuelve la regla general, que es no. La regla general es correcta y este caso está del otro lado de ella. La pregunta útil no es si se copia, es qué puede cambiar el dato sin que vos lo veas."
lambda: 4.0
constraints:
  - metric: disponibilidad declarada del proveedor mayorista que publica el catálogo
    operator: "<="
    value: 95
    unit: por ciento
  - metric: veces por día que el proveedor publica una lista de precios nueva
    operator: "<="
    value: 1
    unit: publicaciones
  - metric: tiempo máximo de respuesta acordado para armar un carrito
    operator: "<="
    value: 800
    unit: milisegundos
  - metric: presupuesto operativo del equipo de comercio electrónico
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "el proveedor publica la lista de precios una sola vez por día, a las 06:00. Entre dos publicaciones el precio no puede cambiar por ninguna acción de nadie: no hay compras de terceros, no hay ajustes intradiarios, no hay reglas que se disparen solas."
    discoveryPath: "está en las restricciones, y es el dato que decide todo el ejercicio. Preguntate qué evento, fuera de tu sistema, podría cambiar un precio entre las 06:00 de hoy y las 06:00 de mañana. Si no existe ninguno, una copia tuya no puede quedar desactualizada sin que vos lo sepas."
  - fact: "el proveedor declara 95 % de disponibilidad. Son unos dieciocho días al año, y el año pasado once de esos días cayeron en horario comercial. Cada uno de esos días el carrito no se pudo armar."
    discoveryPath: "está en las restricciones. Multiplicá: dieciocho días al año de un tercero puestos dentro del camino de la compra son dieciocho días al año sin poder vender."
  - fact: "el arquitecto anterior dejó escrito que copiar el catálogo era 'duplicar la fuente de verdad de un tercero' y bloqueó el pedido dos veces. Su regla es correcta en general y no distingue qué dato cambia por fuera y cuál no."
    discoveryPath: "es la tensión del ejercicio. La base de catálogo que ves vacía en el lienzo se creó para esto y quedó sin conectar por esa decisión."
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
      label: Servicio de compra
      zone: private
      role: checkout-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: proveedor
      type: external-provider
      label: Proveedor mayorista
      zone: dmz
      role: price-provider
      given: true
      props: { availability: "95.0", slaMinutes: "480" }
      position: { x: 445, y: 300 }
    - id: pedidos
      type: database
      label: Base de pedidos
      zone: restricted
      role: order-record
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 520 }
    - id: catalogo
      type: database
      label: Base de catálogo
      zone: restricted
      role: price-catalog
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
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
    - id: checkout-proveedor
      from: { node: checkout }
      to: { node: proveedor }
      dataClass: public
    - id: checkout-pedidos
      from: { node: checkout }
      to: { node: pedidos }
      dataClass: personal
guarantees:
  - id: g-local-catalog
    label: la compra lee el precio de una copia propia y no le pregunta al proveedor en el momento
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            role: checkout-service
          to:
            role: price-catalog
        - op: edgeAbsent
          from:
            role: checkout-service
          to:
            type: [external-provider]
    whyMissing: "o el servicio de compra le sigue preguntando al proveedor en el momento, o no hay camino desde el servicio de compra hasta la base de catálogo."
    consequence: "el proveedor declara 95 %: dieciocho días al año, once de ellos en horario comercial el año pasado. Cada uno de esos días el carrito no se pudo armar. Poner la disponibilidad de un tercero dentro del camino de la compra es aceptar su peor día como tu peor día, sin haberlo negociado."
  - id: g-refresh-offline
    label: la copia la refresca un proceso de fondo tuyo, que es el único que habla con el proveedor
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [worker]
          to:
            role: price-provider
        - op: path
          from:
            type: [worker]
          to:
            role: price-catalog
    whyMissing: no hay un proceso de fondo que hable con el proveedor y escriba la base de catálogo.
    consequence: "una copia que nadie refresca es peor que no tenerla: sirve precios viejos con la misma seguridad que servía los buenos. Y si el que refresca es el mismo camino de la compra, no ganaste nada: volviste a depender del proveedor en el momento, ahora con una base más que operar."
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
    consequence: "una copia local convierte una caída del proveedor en algo que no se nota, y eso es exactamente el riesgo: si el refresco de las 06:00 falla cuatro días seguidos, la tienda sigue vendiendo con precios de la semana pasada y nadie se entera hasta que cierra el mes."
rubric:
  - dimension: la venta deja de depender del peor día de un tercero
    signal:
      kind: predicate
      guaranteeId: g-local-catalog
  - dimension: la copia tiene un dueño y una forma declarada de envejecer
    signal:
      kind: predicate
      guaranteeId: g-refresh-offline
  - dimension: el silencio del refresco es visible antes del cierre de mes
    signal:
      kind: predicate
      guaranteeId: g-observed
  - dimension: el diseño entra en el presupuesto del equipo de comercio electrónico
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 7
      unit: unidades operativas
referenceSolutions:
  - label: copia propia y sincronizador de fondo
    contextInversion: "la copia leída directo por el servicio de compra se defiende cuando el precio es un dato y nada más: se busca por código, se muestra, se cobra. No hay reglas, no hay conversión de moneda, no hay promociones que dependan del carrito. En ese caso una pieza intermedia es un salto de red y una cosa más para operar sin nada a cambio. Al gerente comercial le decís que sí, y le decís por qué se puede decir que sí acá: el precio cambia una vez por día, a las 06:00, y sólo cuando el proveedor lo publica. Nada fuera de tu sistema puede moverlo entre dos publicaciones, así que tu copia no puede estar desactualizada sin que vos lo veas. Lo que aceptás a cambio: sos dueño de un dato que no es tuyo, y el día que el proveedor cambie el formato de su lista, el que rompe es tu sincronizador a las 06:03 de la mañana."
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
          label: Servicio de compra
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: catalogo
          type: database
          label: Base de catálogo
          zone: restricted
          role: price-catalog
          props: { backup: "diario", consistency: "strong" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          role: order-record
          props: { backup: "diario", consistency: "strong" }
        - id: sincronizador
          type: worker
          label: Sincronizador de catálogo
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: proveedor
          type: external-provider
          label: Proveedor mayorista
          zone: dmz
          role: price-provider
          props: { availability: "95.0", slaMinutes: "480" }
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
        - id: checkout-catalogo
          from: { node: checkout }
          to: { node: catalogo }
          dataClass: public
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: sincronizador-proveedor
          from: { node: sincronizador }
          to: { node: proveedor }
          dataClass: public
        - id: sincronizador-catalogo
          from: { node: sincronizador }
          to: { node: catalogo }
          dataClass: public
        - id: checkout-monitoreo
          from: { node: checkout }
          to: { node: monitoreo }
          dataClass: public
        - id: sincronizador-monitoreo
          from: { node: sincronizador }
          to: { node: monitoreo }
          dataClass: public
  - label: un servicio de precios propio delante de la copia
    contextInversion: "poner un servicio de precios delante de la copia se defiende cuando el precio final no es el precio de la lista: la cadena vende en tres países, aplica un margen por categoría y corre promociones que dependen del carrito completo. Esa lógica vive en algún lado, y si no vive en un servicio propio termina repartida entre el servicio de compra y consultas escritas a mano contra la base. Además desacopla el formato del proveedor del formato que consume la tienda, que es el que se rompe cuando el proveedor cambia su lista. Al gerente comercial le decís lo mismo sobre la copia, y le agregás que su equipo de pricing va a poder cambiar un margen sin abrir un ticket al equipo de comercio electrónico. Lo que aceptás a cambio: una pieza más para operar, un salto de red en el camino del carrito, y una regla que ahora es de alguien, y ese alguien tiene que existir."
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
          label: Servicio de compra
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: precios
          type: service
          label: Servicio de precios
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: catalogo
          type: database
          label: Base de catálogo
          zone: restricted
          role: price-catalog
          props: { backup: "diario", consistency: "strong" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          role: order-record
          props: { backup: "diario", consistency: "strong" }
        - id: sincronizador
          type: worker
          label: Sincronizador de catálogo
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: proveedor
          type: external-provider
          label: Proveedor mayorista
          zone: dmz
          role: price-provider
          props: { availability: "95.0", slaMinutes: "480" }
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
        - id: checkout-precios
          from: { node: checkout }
          to: { node: precios }
          dataClass: public
        - id: precios-catalogo
          from: { node: precios }
          to: { node: catalogo }
          dataClass: public
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: sincronizador-proveedor
          from: { node: sincronizador }
          to: { node: proveedor }
          dataClass: public
        - id: sincronizador-catalogo
          from: { node: sincronizador }
          to: { node: catalogo }
          dataClass: public
        - id: checkout-monitoreo
          from: { node: checkout }
          to: { node: monitoreo }
          dataClass: public
        - id: precios-monitoreo
          from: { node: precios }
          to: { node: monitoreo }
          dataClass: public
        - id: sincronizador-monitoreo
          from: { node: sincronizador }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una cadena de ferreterías con tienda en línea. **11.000 pedidos por mes**.
El catálogo no es de la cadena: lo publica un **proveedor mayorista**, que
es también quien despacha. Hoy, cada vez que alguien arma un carrito, el
servicio de compra le pregunta el precio al proveedor.

El proveedor declara **95 % de disponibilidad**. El año pasado eso fueron
dieciocho días, once de ellos en horario comercial. Once días sin poder
armar un carrito.

El gerente comercial viene pidiendo lo mismo desde hace un año y medio:
**guardá una copia del catálogo de tu lado**. Lo pidió dos veces y las dos
se lo rechazaron. El arquitecto anterior dejó la razón por escrito y la
razón es una regla que cualquiera reconoce: no se duplica la fuente de
verdad de un tercero, porque una copia envejece y nadie sabe cuánto.

Es una buena regla. Es la que aprendiste, es la que vas a repetir en la
mayoría de los casos, y acá hay que ver si aplica antes de repetirla.

El dato que decide es este, y está en la mesa desde el principio: **el
proveedor publica la lista una sola vez por día, a las 06:00**. Entre dos
publicaciones no hay nada (ninguna compra de un tercero, ningún ajuste
intradiario, ninguna regla automática) que pueda mover un precio. El precio
no cambia por fuera de lo que vos ves cambiar.

La pregunta correcta nunca fue *"¿se copia el dato de un tercero?"*. Fue
*"¿qué puede cambiar este dato sin que yo lo vea?"*. Cuando la respuesta es
"nada", la regla general no aplica, y sostenerla igual cuesta once días de
venta al año.

La base de catálogo está en el lienzo, vacía: se creó para esto y quedó sin
conectar. El equipo de comercio electrónico sostiene **siete piezas**.

**Armá el sistema** para que la compra lea el precio de una copia propia y
no le pregunte al proveedor en el momento, para que esa copia la refresque
un proceso de fondo tuyo que sea el único que habla con el proveedor, y para
que todos los servicios reporten lo que les pasa.
