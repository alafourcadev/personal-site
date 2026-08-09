---
title: "El cobro que tres áreas quieren distinto"
level: 12
role: synthesis
domain: pagos
D1: 4
D2: 4
D3: 4
D4: 3
D5: 4
D6: 4
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 7
aiBudget: "libre. Es el último ejercicio del juego, así que la regla de siempre se vuelve literal: si no podés explicar cada pieza de tu diseño diciendo qué problema resuelve, a quién le sacaste algo y qué aceptaste perder, no terminaste el ejercicio aunque el motor te dé 100."
lambda: 4.0
constraints:
  - metric: operaciones de cobro en el pico de fin de mes
    operator: ">="
    value: 4800
    unit: operaciones/minuto
  - metric: tiempo máximo entre que el comercio cobra y el cliente ve la aprobación
    operator: "<="
    value: 2
    unit: segundos
  - metric: disponibilidad declarada de la red de tarjetas
    operator: "<="
    value: 99
    unit: por ciento
  - metric: retención exigida para la evidencia de un contracargo
    operator: ">="
    value: 24
    unit: meses
  - metric: presupuesto operativo del equipo de pagos
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "el equipo de pagos son cuatro personas con guardia rotativa y sostienen siete piezas. Es el mismo número desde hace dos años y las tres áreas que piden algo lo saben."
    discoveryPath: "sumá una octava pieza y probá tu respuesta. Con este acantilado de presupuesto, una pieza de más te deja abajo del puntaje de un diseño que no cumple casi nada."
  - fact: "la solución obvia es una pieza por pedido: una para despersonalizar hacia el modelo, otra para amortiguar la red de tarjetas, otra para archivar la evidencia. Son tres piezas y tenés una."
    discoveryPath: "mirá qué tienen en común los tres pedidos: los tres ocurren después de que el cobro se aprobó y ninguno está en el camino del cliente. Una sola pieza puede hacer los tres trabajos, y defender esa decisión, que parece un atajo y no lo es, es el ejercicio."
  - fact: "el 1 % de indisponibilidad de la red de tarjetas son unos tres días y medio al año, y no llegan repartidos: llegan en ventanas de veinte minutos, casi siempre a fin de mes."
    discoveryPath: "está en la tercera restricción, cruzada con la primera. Veinte minutos a 4.800 operaciones por minuto son 96.000 cobros, y sin una pieza durable en el medio son 96.000 cobros que no ocurrieron."
  - fact: "el archivo de evidencia de contracargos existe y está vacío. El área de riesgo lo pidió hace un año y nadie escribió nunca en él."
    discoveryPath: "está en el lienzo desde el principio, sin ninguna conexión entrante. Un destino que nadie usa no gana ningún contracargo."
startingDesign:
  nodes:
    - id: comercio
      type: actor
      label: Comercio
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: caja
      type: mobile-client
      label: Terminal de cobro
      zone: public
      given: true
      props: { connectivity: "intermittent", offlineCapable: "no" }
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      props: { authn: "sí", rateLimit: "sí" }
      position: { x: 445, y: 190 }
    - id: pagos
      type: service
      label: Servicio de pagos
      zone: private
      role: payments-service
      given: true
      props: { criticality: "high", replicas: "3", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: libro
      type: database
      label: Libro de liquidaciones
      zone: restricted
      role: settlement-ledger
      given: true
      props: { backup: "cada hora", consistency: "strong" }
      position: { x: 805, y: 520 }
    - id: modelo
      type: ai-model
      label: Modelo de riesgo de fraude
      zone: private
      role: scoring-model
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
    - id: red
      type: external-provider
      label: Red de tarjetas
      zone: dmz
      role: card-network
      given: true
      props: { availability: "99.0", slaMinutes: "20" }
      position: { x: 445, y: 300 }
    - id: evidencia
      type: object-storage
      label: Archivo de evidencia de contracargos
      zone: private
      role: dispute-archive
      given: true
      props: { durability: "99.999999999", access: "signed" }
      position: { x: 805, y: 410 }
  edges:
    - id: comercio-caja
      from: { node: comercio }
      to: { node: caja }
      dataClass: personal
    - id: caja-gw
      from: { node: caja }
      to: { node: gw }
      dataClass: personal
    - id: gw-pagos
      from: { node: gw }
      to: { node: pagos }
      dataClass: personal
    - id: pagos-libro
      from: { node: pagos }
      to: { node: libro }
      dataClass: regulated
    - id: pagos-modelo
      from: { node: pagos }
      to: { node: modelo }
      dataClass: personal
    - id: pagos-red
      from: { node: pagos }
      to: { node: red }
      dataClass: personal
guarantees:
  - id: g-model-isolated
    label: entre el servicio de pagos y el modelo de riesgo hay una pieza tuya
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            role: payments-service
          to:
            role: scoring-model
        - op: edgeAbsent
          from:
            role: payments-service
          to:
            role: scoring-model
    whyMissing: "o el servicio de pagos le habla directo al modelo de riesgo, o ya no hay camino hasta el modelo. Desconectarlo no es la respuesta: el fraude que ese modelo detecta son 1,4 millones de pesos por mes."
    consequence: "el modelo está alojado por un tercero. Sin una pieza propia en el medio, lo que sale es la operación de cobro completa: nombre, tarjeta, comercio y monto. Con esa pieza, lo que sale es lo que decidiste que salga, y esa decisión se lee en el diseño en vez de estar en la cabeza de quien escribió el código."
  - id: g-network-durable
    label: el cobro no depende de que la red de tarjetas esté disponible en ese instante
    weight: 3
    predicate:
      op: all
      of:
        - op: noVolatileCut
          from:
            role: payments-service
          to:
            role: card-network
        - op: edgeAbsent
          from:
            role: payments-service
          to:
            role: card-network
    whyMissing: "el servicio de pagos le habla directo a la red de tarjetas, o el camino hasta la red no atraviesa ninguna pieza que sobreviva a un reinicio."
    consequence: "el 1 % de indisponibilidad de la red son unos tres días y medio al año que no llegan repartidos: llegan en ventanas de veinte minutos, casi siempre a fin de mes. Veinte minutos a 4.800 operaciones por minuto son 96.000 cobros que, sin una pieza durable en el medio, no ocurrieron y nadie puede reintentar."
  - id: g-dispute-archived
    label: cada operación deja evidencia archivada para el contracargo que llega dentro de dos años
    weight: 2
    predicate:
      op: path
      from:
        role: payments-service
      to:
        role: dispute-archive
    whyMissing: no hay ningún camino desde el servicio de pagos hasta el archivo de evidencia de contracargos.
    consequence: "un contracargo se pierde por no poder demostrar la operación, no por haberla hecho mal. El archivo existe hace un año y está vacío: hoy cada contracargo se responde con lo que alguien se acuerde y con una consulta al libro, que guarda el estado final y no lo que pasó."
  - id: g-services-observed
    label: todos los servicios reportan lo que les pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: "hay dos terceros en este sistema, la red de tarjetas y el modelo de riesgo, y los dos fallan cuando quieren. Sin medición propia, la conversación con cada uno es tu impresión contra su panel, y la que pierde esa conversación siempre es la que no tiene números."
rubric:
  - dimension: el dato personal no cruza la frontera del proveedor del modelo
    signal:
      kind: predicate
      guaranteeId: g-model-isolated
  - dimension: la caída de la red de tarjetas no es una caída del cobro
    signal:
      kind: predicate
      guaranteeId: g-network-durable
  - dimension: el contracargo de dentro de dos años se puede responder
    signal:
      kind: predicate
      guaranteeId: g-dispute-archived
  - dimension: la falla de los terceros se mide desde tu lado
    signal:
      kind: predicate
      guaranteeId: g-services-observed
  - dimension: el diseño entra en el presupuesto operativo del equipo de pagos
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 7
      unit: unidades operativas
referenceSolutions:
  - label: una cola y un despachador que hace los tres trabajos
    contextInversion: "un solo proceso de fondo detrás de una cola se defiende cuando los tres pedidos ocurren en el mismo momento del ciclo de vida de la operación: después de aprobado el cobro, fuera del camino del cliente. El despachador recorta lo que va al modelo, presenta a la red y escribe la evidencia, y las tres cosas comparten el mismo reintento y el mismo lugar donde mirar cuando algo falla. Va a haber alguien en la mesa que diga que esto es una pieza que hace demasiado, y hay que responderle con el número: tres piezas separadas son diez unidades operativas para un equipo que sostiene siete, así que la alternativa a esta pieza no son tres piezas prolijas, es no hacer dos de las tres cosas. Lo que aceptás a cambio: un cambio en cualquiera de los tres trabajos toca el mismo componente, y el día que uno de los tres necesite escalar por su cuenta, esta decisión se vuelve la que hay que deshacer."
    design:
      nodes:
        - id: comercio
          type: actor
          label: Comercio
          zone: public
        - id: caja
          type: mobile-client
          label: Terminal de cobro
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: payments-service
          props: { criticality: "high", replicas: "3", idempotent: "sí" }
        - id: libro
          type: database
          label: Libro de liquidaciones
          zone: restricted
          role: settlement-ledger
          props: { backup: "cada hora", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de operaciones aprobadas
          zone: private
          props: { delivery: "at-least-once", dlq: "no", ordering: "no" }
        - id: despachador
          type: worker
          label: Despachador de operaciones
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: modelo
          type: ai-model
          label: Modelo de riesgo de fraude
          zone: private
          role: scoring-model
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: red
          type: external-provider
          label: Red de tarjetas
          zone: dmz
          role: card-network
          props: { availability: "99.0", slaMinutes: "20" }
        - id: evidencia
          type: object-storage
          label: Archivo de evidencia de contracargos
          zone: private
          role: dispute-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comercio-caja
          from: { node: comercio }
          to: { node: caja }
          dataClass: personal
        - id: caja-gw
          from: { node: caja }
          to: { node: gw }
          dataClass: personal
        - id: gw-pagos
          from: { node: gw }
          to: { node: pagos }
          dataClass: personal
        - id: pagos-libro
          from: { node: pagos }
          to: { node: libro }
          dataClass: regulated
        - id: pagos-cola
          from: { node: pagos }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-red
          from: { node: despachador }
          to: { node: red }
          dataClass: personal
        - id: despachador-modelo
          from: { node: despachador }
          to: { node: modelo }
          dataClass: public
        - id: despachador-evidencia
          from: { node: despachador }
          to: { node: evidencia }
          dataClass: regulated
        - id: pagos-monitoreo
          from: { node: pagos }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: registro releíble, servicio despachador y evidencia escrita por pagos
    contextInversion: "esta variante se defiende cuando el área de riesgo necesita que la evidencia quede asentada aunque el despacho falle: la escribe el propio servicio de pagos en el momento de aprobar, así que existe incluso si la red de tarjetas está caída y la operación queda pendiente. El registro releíble suma que un contracargo viejo se puede reconstruir releyendo la ventana completa en vez de consultando el estado final, y que el despachador sea un servicio permite que el área de riesgo pregunte por el estado de una operación sin llamar a nadie. Lo que aceptás a cambio: la evidencia se escribe en el camino del cliente, así que una lentitud del archivo ahora sí es una lentitud del cobro, y con dos segundos de presupuesto eso hay que vigilarlo desde el primer día."
    design:
      nodes:
        - id: comercio
          type: actor
          label: Comercio
          zone: public
        - id: caja
          type: mobile-client
          label: Terminal de cobro
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: payments-service
          props: { criticality: "high", replicas: "3", idempotent: "sí" }
        - id: libro
          type: database
          label: Libro de liquidaciones
          zone: restricted
          role: settlement-ledger
          props: { backup: "cada hora", consistency: "strong" }
        - id: operaciones
          type: stream
          label: Registro de operaciones aprobadas
          zone: private
          props: { retention: "7d", partitions: "12", ordering: "sí" }
        - id: despachador
          type: service
          label: Servicio despachador
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: Modelo de riesgo de fraude
          zone: private
          role: scoring-model
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: red
          type: external-provider
          label: Red de tarjetas
          zone: dmz
          role: card-network
          props: { availability: "99.0", slaMinutes: "20" }
        - id: evidencia
          type: object-storage
          label: Archivo de evidencia de contracargos
          zone: private
          role: dispute-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comercio-caja
          from: { node: comercio }
          to: { node: caja }
          dataClass: personal
        - id: caja-gw
          from: { node: caja }
          to: { node: gw }
          dataClass: personal
        - id: gw-pagos
          from: { node: gw }
          to: { node: pagos }
          dataClass: personal
        - id: pagos-libro
          from: { node: pagos }
          to: { node: libro }
          dataClass: regulated
        - id: pagos-evidencia
          from: { node: pagos }
          to: { node: evidencia }
          dataClass: regulated
        - id: pagos-operaciones
          from: { node: pagos }
          to: { node: operaciones }
          dataClass: personal
        - id: operaciones-despachador
          from: { node: operaciones }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-red
          from: { node: despachador }
          to: { node: red }
          dataClass: personal
        - id: despachador-modelo
          from: { node: despachador }
          to: { node: modelo }
          dataClass: public
        - id: pagos-monitoreo
          from: { node: pagos }
          to: { node: monitoreo }
          dataClass: public
        - id: despachador-monitoreo
          from: { node: despachador }
          to: { node: monitoreo }
          dataClass: public
        - id: operaciones-monitoreo
          from: { node: operaciones }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Último ejercicio del juego. Una procesadora de pagos: **4.800 operaciones
por minuto** en el pico de fin de mes, dos segundos de presupuesto entre que
el comercio cobra y el cliente ve la aprobación.

Hay tres áreas en la reunión y cada una pide una cosa razonable.

**Riesgo** quiere que el modelo de detección de fraude siga funcionando,
porque son 1,4 millones de pesos por mes que hoy no se pierden. Hoy ese
modelo, alojado por un tercero, recibe la operación completa: nombre,
tarjeta, comercio, monto.

**Operaciones** quiere que la red de tarjetas deje de tirar abajo el cobro.
La red declara **99 %** de disponibilidad, que suena bien hasta que mirás
cómo llega ese 1 %: en ventanas de veinte minutos, casi siempre a fin de
mes. Veinte minutos a 4.800 operaciones por minuto son **96.000 cobros**.

**Legal** quiere el archivo de evidencia de contracargos que pidió hace un
año. El archivo existe. Está vacío. Hoy cada contracargo se responde con lo
que alguien se acuerde.

Las tres tienen razón, y la respuesta obvia, una pieza para cada pedido, son
tres piezas. El equipo de pagos son **cuatro personas con guardia rotativa**
y sostiene **siete**, el mismo número desde hace dos años. Tenés una pieza,
no tres.

Lo que hay que ver es qué tienen en común los tres pedidos: los tres ocurren
**después** de que el cobro se aprobó, y ninguno está en el camino del
cliente. Una sola pieza puede hacer los tres trabajos. Alguien en la mesa va
a decir que eso es una pieza que hace demasiado, y va a tener un punto: la
diferencia entre un atajo y una decisión es si podés decir en voz alta qué
perdés con ella.

**Armá el sistema** para que entre el servicio de pagos y el modelo de
riesgo haya una pieza tuya, para que el cobro no dependa de que la red de
tarjetas esté disponible en ese instante, para que cada operación deje
evidencia archivada, y para que todos los servicios reporten lo que les
pasa. Sin pasar de siete piezas.

Terminás el juego cuando podés decir, de cada pieza de tu diseño, qué
problema resuelve, a quién le sacaste algo y qué aceptaste perder a cambio.
