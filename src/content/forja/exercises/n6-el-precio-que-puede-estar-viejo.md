---
title: "El precio que puede estar viejo"
level: 6
role: tradeoff
domain: retail
tradeoffPairId: resiliencia-el-precio-cuando-el-motor-no-contesta
D1: 2
D2: 3
D3: 2
D4: 1
D5: 2
D6: 1
D7: 3
D8: 1
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir cuántos minutos de precio viejo acepta este contexto y por qué eso es más barato que una vidriera vacía."
lambda: 0.5
constraints:
  - metric: visitas al catálogo por hora en horario pico
    operator: ">="
    value: 74000
    unit: visitas/hora
  - metric: veces por día que un precio cambia en el motor del ERP
    operator: "<="
    value: 40
    unit: cambios/día
  - metric: minutos de precio desactualizado que el negocio acepta en la vidriera
    operator: "<="
    value: 30
    unit: minutos
hiddenFacts:
  - fact: "el motor de precios del ERP corre en el mismo servidor que la facturación, y a fin de mes se pone lento por el cierre contable. Los tres últimos días del mes su tiempo de respuesta se multiplica por veinte."
    discoveryPath: "preguntate cuándo se degrada la pieza de la que dependés. Acá se degrada justo en los días de más venta, y el catálogo la consulta en cada visita."
  - fact: "de los 61.000 artículos del catálogo, cambian de precio menos de 40 por día. El 99,9 % de las consultas devuelven el mismo número que hace una semana."
    discoveryPath: "compará la frecuencia con que se lee un dato contra la frecuencia con que cambia. Si la diferencia es de cuatro órdenes de magnitud, preguntar cada vez es pagar el peor caso para el caso más raro."
  - fact: "un precio de vidriera desactualizado no obliga a nada: al llegar al checkout el precio se vuelve a calcular, y ahí sí sale del motor. La vidriera informa, el checkout compromete."
    discoveryPath: "está en el enunciado y es lo que hace admisible la copia acá. Fijate qué pasa con el mismo problema cuando el número que se muestra es el que se cobra."
startingDesign:
  nodes:
    - id: visitante
      type: actor
      label: Visitante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Catálogo web
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: vidriera
      type: service
      label: Servicio de catálogo
      zone: private
      role: storefront-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: motor
      type: external-provider
      label: Motor de precios del ERP
      zone: dmz
      role: price-source
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: visitante-web
      from: { node: visitante }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: public
    - id: gw-vidriera
      from: { node: gw }
      to: { node: vidriera }
      dataClass: public
    - id: vidriera-motor
      from: { node: vidriera }
      to: { node: motor }
      dataClass: public
guarantees:
  - id: g-copia-de-precios
    label: el catálogo puede responder con el último precio conocido sin preguntarle al motor
    weight: 2
    predicate:
      op: path
      from:
        role: storefront-service
      to:
        type: [cache]
    whyMissing: el servicio de catálogo no llega a ninguna copia de precios. Lo único que sabe de un precio es lo que el motor del ERP le acaba de contestar.
    consequence: "los tres últimos días del mes, cuando el motor se pone veinte veces más lento por el cierre contable, la vidriera se pone veinte veces más lenta con él. 74.000 visitas por hora mirando un cargador."
  - id: g-motor-sigue-alimentando
    label: la copia se sigue alimentando del motor de precios
    weight: 2
    predicate:
      op: path
      from:
        type: [service, worker]
      to:
        role: price-source
    whyMissing: ninguna pieza del sistema llega al motor de precios, así que la copia no tiene de dónde actualizarse.
    consequence: los cambios de precio del día nunca llegan a la vidriera. Una copia que nadie refresca deja de estar treinta minutos vieja y pasa a estar semanas vieja, que es otra cosa y ya no es admisible.
  - id: g-copia-en-el-camino
    label: la copia está en el camino del pedido, no al costado
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [cache]
    whyMissing: la copia existe pero el pedido que entra por la puerta no llega hasta ella. Quedó colgada de una pieza que no atiende visitas.
    consequence: tener la copia y no servir desde ella es pagar por una contingencia que nunca se usa. La vidriera se sigue cayendo con el motor y el diagrama dice que no.
rubric:
  - dimension: la vidriera responde con un número viejo antes que con un error
    signal:
      kind: predicate
      guaranteeId: g-copia-de-precios
  - dimension: la copia tiene una fuente y una edad acotada
    signal:
      kind: predicate
      guaranteeId: g-motor-sigue-alimentando
  - dimension: la contingencia está en el camino real del pedido
    signal:
      kind: predicate
      guaranteeId: g-copia-en-el-camino
referenceSolutions:
  - label: el catálogo mantiene su propia copia
    contextInversion: "que el mismo servicio lea la copia y la refresque cuando encuentra un precio vencido es lo correcto cuando el catálogo es largo y desparejo: se pagan sólo los artículos que alguien mira, y un artículo que nadie consulta nunca cuesta nada. Es la topología con menos piezas. El costo es que la primera visita a un artículo frío sigue esperando al motor, y en el cierre contable esa primera visita es lenta."
    design:
      nodes:
        - id: visitante
          type: actor
          label: Visitante
          zone: public
        - id: web
          type: web-client
          label: Catálogo web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: vidriera
          type: service
          label: Servicio de catálogo
          zone: private
          role: storefront-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Copia de precios de vidriera
          zone: private
        - id: motor
          type: external-provider
          label: Motor de precios del ERP
          zone: dmz
          role: price-source
      edges:
        - id: visitante-web
          from: { node: visitante }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: public
        - id: gw-vidriera
          from: { node: gw }
          to: { node: vidriera }
          dataClass: public
        - id: vidriera-copia
          from: { node: vidriera }
          to: { node: copia }
          dataClass: public
        - id: vidriera-motor
          from: { node: vidriera }
          to: { node: motor }
          dataClass: public

  - label: un refrescador aparte mantiene la copia caliente
    contextInversion: "una pieza dedicada a refrescar conviene cuando ninguna visita puede pagar la lentitud del motor, ni siquiera la primera: el refrescador recorre el catálogo a su ritmo, y el servicio que atiende nunca sale a la red externa. Además, si el motor está caído tres horas, el que se traba es el refrescador y la vidriera ni se entera. Se paga con una pieza más para operar y con precios de artículos que nadie mira refrescándose igual."
    design:
      nodes:
        - id: visitante
          type: actor
          label: Visitante
          zone: public
        - id: web
          type: web-client
          label: Catálogo web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: vidriera
          type: service
          label: Servicio de catálogo
          zone: private
          role: storefront-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Copia de precios de vidriera
          zone: private
        - id: refrescador
          type: worker
          label: Refrescador de precios
          zone: private
        - id: motor
          type: external-provider
          label: Motor de precios del ERP
          zone: dmz
          role: price-source
      edges:
        - id: visitante-web
          from: { node: visitante }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: public
        - id: gw-vidriera
          from: { node: gw }
          to: { node: vidriera }
          dataClass: public
        - id: vidriera-copia
          from: { node: vidriera }
          to: { node: copia }
          dataClass: public
        - id: vidriera-refrescador
          from: { node: vidriera }
          to: { node: refrescador }
          dataClass: public
        - id: refrescador-motor
          from: { node: refrescador }
          to: { node: motor }
          dataClass: public
        - id: refrescador-copia
          from: { node: refrescador }
          to: { node: copia }
          dataClass: public
status: PILOT
---

Una tienda con **61.000 artículos** y **74.000 visitas por hora** al catálogo
en horario pico. Cada vez que alguien abre la página de un producto, el
servicio de catálogo le pregunta el precio al motor del ERP.

El motor del ERP corre en el mismo servidor que la facturación. Los **tres
últimos días del mes**, con el cierre contable encima, su tiempo de respuesta
se multiplica por veinte. Que son, casualmente, tres de los días de más
venta.

Mientras tanto: de esos 61.000 artículos, cambian de precio **menos de 40 por
día**. El 99,9 % de las consultas devuelven el mismo número que hace una
semana.

Y hay una cosa más, que es la que decide este ejercicio: en la vidriera el
precio **informa**. Cuando el visitante llega al checkout, el precio se vuelve
a calcular y ahí sí sale del motor. Un número de vidriera desactualizado no
compromete a nadie.

La directora comercial pone el límite en una frase: *"Prefiero un precio de
hace media hora antes que una página que no carga. Media hora, no más."*

El equipo tiene **5 unidades operativas** y hoy usa 2.

**Rearmá el catálogo** para que pueda responder con el último precio conocido
cuando el motor del ERP está lento o caído, y para que esa copia se siga
actualizando dentro de la ventana que el negocio acepta.
