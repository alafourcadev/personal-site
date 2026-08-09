---
title: "La señal que tiene que llegar ya"
level: 5
role: tradeoff
domain: marketplace
tradeoffPairId: operacion-camino-de-la-senal
D1: 2
D2: 3
D3: 2
D4: 1
D5: 2
D6: 1
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 6
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá la señal va derecho al monitoreo y no pasa por ningún buffer intermedio."
lambda: 0.5
constraints:
  - metric: tiempo aceptable entre que el checkout se rompe y la guardia lo ve
    operator: "<="
    value: 60
    unit: segundos
  - metric: compras perdidas por minuto de checkout caído, en horario pico
    operator: ">="
    value: 210
    unit: compras/minuto
hiddenFacts:
  - fact: "en el incidente de octubre la señal sí se generó: quedó encolada detrás de 1,4 millones de mensajes en la misma cola que se había tapado, y llegó al tablero 26 minutos después de que la guardia ya estuviera trabajando."
    discoveryPath: "poné un buffer entre el checkout y el monitoreo y preguntate qué pasa con ese buffer cuando el sistema se degrada. La señal comparte destino con lo que está fallando."
  - fact: la guardia no mira el tablero. El tablero la despierta. Un aviso que llega tarde no es un aviso, es una crónica.
    discoveryPath: "es la razón por la que este ejercicio mide el camino de la señal y no su completitud. Acá una señal incompleta a tiempo vale más que una señal perfecta tarde."
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
    - id: checkout
      type: service
      label: Servicio de checkout
      zone: private
      role: checkout-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: pedidos
      type: database
      label: Base de pedidos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
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
    - id: checkout-pedidos
      from: { node: checkout }
      to: { node: pedidos }
      dataClass: personal
guarantees:
  - id: g-direct-signal
    label: la señal del checkout llega al monitoreo sin pasar por ningún almacenamiento intermedio
    weight: 2
    predicate:
      op: path
      from:
        role: checkout-service
      to:
        type: [observability]
      forbid:
        type: [queue, stream, database, object-storage]
    whyMissing: no hay un camino desde el servicio de checkout hasta un componente de monitoreo que no atraviese una cola, un registro de eventos, una base o un archivo.
    consequence: "la señal llega cuando el intermediario la deja pasar, y el intermediario se tapa justo cuando el sistema se degrada. El aviso deja de ser un aviso: llega después de que la guardia ya se enteró por otro lado."
  - id: g-no-buffer
    label: ningún servicio mete un buffer entre el hecho y el aviso
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [service]
      to:
        type: [queue, stream]
    whyMissing: hay un servicio que publica en una cola o en un registro de eventos, y en este ejercicio ese buffer está en el camino de la señal.
    consequence: en octubre la señal se generó y quedó encolada detrás de 1,4 millones de mensajes en la misma cola que se había tapado. Un aviso que comparte destino con lo que está fallando llega justo cuando ya no sirve.
rubric:
  - dimension: la señal llega al monitoreo por un camino que no depende de un intermediario que se pueda tapar
    signal:
      kind: predicate
      guaranteeId: g-direct-signal
  - dimension: no hay buffer compartido entre el hecho y el aviso
    signal:
      kind: predicate
      guaranteeId: g-no-buffer
referenceSolutions:
  - label: el checkout empuja su señal al monitoreo
    contextInversion: "empujar directo es lo correcto cuando el servicio es uno solo y el equipo lo controla entero: cero piezas intermedias, cero latencia agregada, y el aviso sale del mismo proceso que vivió el problema. El costo es que si el componente de monitoreo no está disponible en ese instante, esa señal se pierde y no hay dónde recuperarla. Es exactamente el precio que este contexto acepta pagar."
    design:
      nodes:
        - id: comprador
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
        - id: checkout
          type: service
          label: Servicio de checkout
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
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
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-monitoreo
          from: { node: checkout }
          to: { node: monitoreo }
          dataClass: public
        - id: gw-monitoreo
          from: { node: gw }
          to: { node: monitoreo }
          dataClass: public
  - label: un recolector al lado del checkout
    contextInversion: "un recolector intermedio conviene cuando hay muchos servicios que reportar y no querés que cada uno conozca la dirección del monitoreo ni su formato: el recolector traduce, agrega y reintenta, y sigue siendo un salto en memoria sin nada durable en el medio, así que la señal no se encola. Se paga con una unidad operativa más y con una pieza extra que también se puede caer."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: app
          type: mobile-client
          label: App de compras
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
          props: { criticality: "high", replicas: "2" }
        - id: recolector
          type: service
          label: Recolector de señales
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-app
          from: { node: comprador }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-recolector
          from: { node: checkout }
          to: { node: recolector }
          dataClass: public
        - id: recolector-monitoreo
          from: { node: recolector }
          to: { node: monitoreo }
          dataClass: public
        - id: gw-monitoreo
          from: { node: gw }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Un marketplace con **210 compras por minuto en horario pico**. Cada minuto
que el checkout está caído son 210 compras que no ocurren, y el equipo lo
mide en plata todos los meses.

La guardia es una persona, rota semanalmente, y **no mira el tablero**: el
tablero la despierta. El acuerdo interno es de **60 segundos** entre que el
checkout se rompe y suena el teléfono.

En octubre eso falló de una manera que vale la pena entender. El checkout
empezó a devolver error a las 21:14. La señal **sí se generó**: el equipo
la había mandado a una cola, junto con los eventos de negocio, para no
perder ninguna. Pero esa misma cola era la que se había tapado. La señal
quedó encolada detrás de **1,4 millones de mensajes** y llegó al tablero a
las 21:40, veintiséis minutos después de que la guardia ya estuviera
trabajando porque un vendedor la llamó por teléfono.

Esa es la trampa: **el buffer que protege tu señal la hace compartir
destino con lo que estás vigilando**. Cuando el sistema se degrada, la
señal se degrada con él.

Acá el equipo acepta el precio de la otra decisión, y lo acepta con los
ojos abiertos: si el monitoreo no está disponible en el instante en que la
señal sale, esa señal se pierde y no hay dónde recuperarla. **Vale la
pena**, porque el valor de esta señal vence en 60 segundos y a los 26
minutos ya no vale nada.

**Armá el sistema** para que la señal del checkout llegue al monitoreo sin
pasar por ninguna pieza que se pueda tapar, y sin que ningún servicio meta
un buffer entre el hecho y el aviso.
