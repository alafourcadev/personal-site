---
title: "El motor de siniestros que corre a oscuras"
level: 11
role: core
domain: seguros
D1: 2
D2: 3
D3: 3
D4: 4
D5: 4
D6: 3
D7: 3
D8: 1
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 9
aiBudget: "libre, pero la respuesta tiene que explicar qué tiene que pasar para que el motor nuevo deje de correr a oscuras y empiece a pagar de verdad."
lambda: 0.5
constraints:
  - metric: siniestros liquidados por día
    operator: ">="
    value: 9500
    unit: siniestros/día
  - metric: diferencia máxima tolerada entre lo que liquida el motor viejo y lo que liquidaría el nuevo, antes del corte
    operator: "<="
    value: 0.5
    unit: por ciento de los casos
hiddenFacts:
  - fact: "el motor nuevo se probó con 4.000 siniestros históricos y acertó en todos. Los siniestros históricos son los que ya se cerraron sin discusión: los casos difíciles nunca llegaron al banco de pruebas."
    discoveryPath: "es la razón por la que este ejercicio no se resuelve con más pruebas antes del corte. El único juego de datos que contiene los casos difíciles es el tráfico real, y la única forma de dárselo al motor nuevo sin arriesgar plata es que corra sin que su resultado le llegue a nadie."
  - fact: la liquidación mueve dinero. Un resultado del motor nuevo que se escriba por error en el expediente que paga no se detecta hasta la conciliación bancaria del mes siguiente.
    discoveryPath: "conectá el motor nuevo al expediente que paga y preguntate quién notaría la diferencia el mismo día. Nadie: los dos motores escriben resultados con la misma forma, y sólo el importe cambia."
  - fact: la primera versión de esta prueba hizo que el servicio de recepción llamara a los dos motores antes de contestar. El día que el motor nuevo se colgó, la recepción de siniestros se frenó entera.
    discoveryPath: "conectá la recepción directo a un motor y contá cuántas piezas tienen que estar arriba para que un siniestro entre. Una prueba que puede tirar abajo lo que está probando no es una prueba: es un despliegue con otro nombre."
startingDesign:
  nodes:
    - id: asegurado
      type: actor
      label: Asegurado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de denuncias
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: recepcion
      type: service
      label: Recepción de siniestros
      zone: private
      role: intake-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: cola
      type: queue
      label: Cola de liquidación
      zone: private
      role: legacy-channel
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 410 }
    - id: motorviejo
      type: worker
      label: Motor de liquidación (viejo)
      zone: private
      role: legacy-worker
      given: true
      position: { x: 445, y: 520 }
    - id: motornuevo
      type: worker
      label: Motor de liquidación (nuevo)
      zone: private
      role: new-worker
      given: true
      position: { x: 445, y: 630 }
    - id: expediente
      type: database
      label: Expediente de liquidación
      zone: restricted
      role: claims-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 640 }
    - id: comparacion
      type: database
      label: Base de resultados en sombra
      zone: restricted
      role: shadow-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 750 }
  edges:
    - id: asegurado-app
      from: { node: asegurado }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-recepcion
      from: { node: gw }
      to: { node: recepcion }
      dataClass: personal
    - id: recepcion-cola
      from: { node: recepcion }
      to: { node: cola }
      dataClass: personal
    - id: cola-motorviejo
      from: { node: cola }
      to: { node: motorviejo }
      dataClass: personal
    - id: motorviejo-expediente
      from: { node: motorviejo }
      to: { node: expediente }
      dataClass: personal
guarantees:
  - id: g-legacy-lane
    label: la vía que paga sigue entera y sigue pasando por su cola de siempre
    weight: 1
    predicate:
      op: path
      from:
        role: intake-service
      to:
        role: legacy-worker
      via:
        role: legacy-channel
    whyMissing: no hay un camino desde la recepción de siniestros hasta el motor viejo que pase por la cola de liquidación de siempre.
    consequence: "la vía que mueve dinero es la única que no se puede tocar mientras se prueba la otra. Cualquier cambio en su recorrido, una pieza nueva en el medio o un cambio de cola, convierte la prueba del motor nuevo en un cambio del motor viejo, que es justo lo que no se quería arriesgar."
  - id: g-shadow-lane
    label: el motor nuevo recibe los mismos siniestros por una pieza durable
    weight: 3
    predicate:
      op: noVolatileCut
      from:
        role: intake-service
      to:
        role: new-worker
    whyMissing: no hay ningún camino con una pieza durable en el medio entre la recepción de siniestros y el motor nuevo. O no le llega nada, o le llega por una llamada directa.
    consequence: "si la recepción llama al motor nuevo para contestar, la disponibilidad del motor nuevo pasa a ser la de la recepción: el día que el motor nuevo se cuelga, la denuncia de siniestro no entra. Una prueba que puede tirar abajo lo que está probando no es una prueba."
  - id: g-shadow-isolated
    label: el motor nuevo no escribe en el expediente que paga
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: new-worker
      to:
        role: claims-store
    whyMissing: el motor nuevo escribe en el expediente de liquidación, que es el que se usa para pagar.
    consequence: "los dos motores escriben resultados con la misma forma y sólo cambia el importe. Un resultado del motor nuevo que se cuele en el expediente que paga no lo ve nadie el mismo día: aparece en la conciliación bancaria del mes siguiente, con la plata ya girada."
  - id: g-legacy-lane-writes
    label: el motor viejo sigue escribiendo el expediente que paga
    weight: 1
    predicate:
      op: path
      from:
        role: legacy-worker
      to:
        role: claims-store
    whyMissing: el motor viejo no llega al expediente de liquidación, así que la vía que paga dejó de pagar.
    consequence: "mientras el motor nuevo está a prueba, el que liquida sigue siendo el viejo. Si su resultado no llega al expediente, la compañía dejó de liquidar siniestros para probar un reemplazo, que es el peor orden posible de las dos cosas."
  - id: g-both-motors-watched
    label: los dos motores están observados por separado
    weight: 2
    predicate:
      op: covered
      target:
        type: [worker]
      by:
        type: [observability]
    whyMissing: hay motores de liquidación sin ninguna conexión a un componente de monitoreo.
    consequence: "correr en sombra sin medir no prueba nada: el motor nuevo puede estar fallando el 40 % de los casos, o no estar recibiendo siniestros en absoluto, y las dos cosas se ven igual desde afuera. Sin señal por motor, el corte se decide con una sensación."
rubric:
  - dimension: la vía que mueve dinero no se toca mientras se prueba la otra
    signal:
      kind: predicate
      guaranteeId: g-legacy-lane
  - dimension: el motor a prueba no puede frenar la recepción de siniestros
    signal:
      kind: predicate
      guaranteeId: g-shadow-lane
  - dimension: el resultado en prueba no puede llegar a pagar
    signal:
      kind: predicate
      guaranteeId: g-shadow-isolated
  - dimension: la compañía sigue liquidando durante toda la prueba
    signal:
      kind: predicate
      guaranteeId: g-legacy-lane-writes
  - dimension: hay con qué decidir el corte además de una sensación
    signal:
      kind: predicate
      guaranteeId: g-both-motors-watched
referenceSolutions:
  - label: dos vías desde la recepción
    contextInversion: "abrir una segunda vía desde la recepción conviene cuando lo que querés probar es el motor entero, desde el siniestro crudo: el motor nuevo ve exactamente lo mismo que vio el viejo, sin pasar por su interpretación, así que una diferencia en el resultado es una diferencia del motor y no del camino. Se paga con una pieza de mensajería más que operar y con la recepción convertida en productora de dos vías que hay que mantener en paridad."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: app
          type: mobile-client
          label: App de denuncias
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: recepcion
          type: service
          label: Recepción de siniestros
          zone: private
          role: intake-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de liquidación
          zone: private
          role: legacy-channel
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: motorviejo
          type: worker
          label: Motor de liquidación (viejo)
          zone: private
          role: legacy-worker
        - id: registro
          type: stream
          label: Registro de siniestros en sombra
          zone: private
          props: { retention: "7d", partitions: "6" }
        - id: motornuevo
          type: worker
          label: Motor de liquidación (nuevo)
          zone: private
          role: new-worker
        - id: expediente
          type: database
          label: Expediente de liquidación
          zone: restricted
          role: claims-store
          props: { backup: "diario" }
        - id: comparacion
          type: database
          label: Base de resultados en sombra
          zone: restricted
          role: shadow-store
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: asegurado-app
          from: { node: asegurado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-recepcion
          from: { node: gw }
          to: { node: recepcion }
          dataClass: personal
        - id: recepcion-cola
          from: { node: recepcion }
          to: { node: cola }
          dataClass: personal
        - id: cola-motorviejo
          from: { node: cola }
          to: { node: motorviejo }
          dataClass: personal
        - id: motorviejo-expediente
          from: { node: motorviejo }
          to: { node: expediente }
          dataClass: personal
        - id: recepcion-registro
          from: { node: recepcion }
          to: { node: registro }
          dataClass: personal
        - id: registro-motornuevo
          from: { node: registro }
          to: { node: motornuevo }
          dataClass: personal
        - id: motornuevo-comparacion
          from: { node: motornuevo }
          to: { node: comparacion }
          dataClass: personal
        - id: motorviejo-monitoreo
          from: { node: motorviejo }
          to: { node: monitoreo }
          dataClass: public
        - id: motornuevo-monitoreo
          from: { node: motornuevo }
          to: { node: monitoreo }
          dataClass: public
  - label: la sombra cuelga de lo que el motor viejo ya procesó
    contextInversion: "colgar la sombra de lo que el motor viejo ya procesó conviene cuando lo que querés comparar es el resultado, caso por caso, contra el que efectivamente se pagó: cada evento trae el siniestro y lo que el viejo decidió, así que la comparación es local y no hay que reconciliar dos vías que pueden desincronizarse. El precio es que el motor nuevo sólo ve los siniestros que el viejo pudo procesar (si el viejo rechaza un caso raro, el nuevo nunca lo ve) y que la recepción y el motor viejo quedan en el camino de la prueba."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: web
          type: web-client
          label: Portal de denuncias
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: recepcion
          type: service
          label: Recepción de siniestros
          zone: private
          role: intake-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de liquidación
          zone: private
          role: legacy-channel
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: motorviejo
          type: worker
          label: Motor de liquidación (viejo)
          zone: private
          role: legacy-worker
        - id: registro
          type: stream
          label: Registro de liquidaciones
          zone: private
          props: { retention: "7d", partitions: "6" }
        - id: motornuevo
          type: worker
          label: Motor de liquidación (nuevo)
          zone: private
          role: new-worker
        - id: expediente
          type: database
          label: Expediente de liquidación
          zone: restricted
          role: claims-store
          props: { backup: "diario" }
        - id: comparacion
          type: database
          label: Base de resultados en sombra
          zone: restricted
          role: shadow-store
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: asegurado-web
          from: { node: asegurado }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-recepcion
          from: { node: gw }
          to: { node: recepcion }
          dataClass: personal
        - id: recepcion-cola
          from: { node: recepcion }
          to: { node: cola }
          dataClass: personal
        - id: cola-motorviejo
          from: { node: cola }
          to: { node: motorviejo }
          dataClass: personal
        - id: motorviejo-expediente
          from: { node: motorviejo }
          to: { node: expediente }
          dataClass: personal
        - id: motorviejo-registro
          from: { node: motorviejo }
          to: { node: registro }
          dataClass: personal
        - id: registro-motornuevo
          from: { node: registro }
          to: { node: motornuevo }
          dataClass: personal
        - id: motornuevo-comparacion
          from: { node: motornuevo }
          to: { node: comparacion }
          dataClass: personal
        - id: motorviejo-monitoreo
          from: { node: motorviejo }
          to: { node: monitoreo }
          dataClass: public
        - id: motornuevo-monitoreo
          from: { node: motornuevo }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una aseguradora liquida **9.500 siniestros por día**. El motor que calcula
cuánto se paga tiene ocho años, mil doscientas reglas y nadie que las
recuerde todas.

El reemplazo está listo. Se probó con **4.000 siniestros históricos** y
acertó en todos. El problema con ese número es cuál es su muestra: los
siniestros históricos son los que ya se cerraron sin discusión. **Los casos
difíciles nunca llegaron al banco de pruebas**, porque los casos difíciles
son justamente los que todavía están abiertos.

El único juego de datos que contiene los casos difíciles es el tráfico real.
Y el tráfico real mueve dinero: la liquidación termina en una transferencia.

Ya hubo un intento. La primera versión de la prueba hizo que la recepción de
siniestros llamara a los dos motores antes de contestar, para comparar. El
día que el motor nuevo se colgó, **la recepción de siniestros se frenó
entera** y los asegurados no pudieron denunciar. Una prueba que puede tirar
abajo lo que está probando no es una prueba.

Hay un riesgo más, y es silencioso. Los dos motores escriben resultados con
la misma forma; lo único que cambia es el importe. Un resultado del motor
nuevo que se cuele en el expediente que paga **no lo ve nadie el mismo día**:
aparece en la conciliación bancaria del mes siguiente, con la plata ya
girada.

Lo que la dirección pidió es concreto: antes de autorizar el corte, quiere
ver que el motor nuevo y el viejo difieren en **menos del 0,5 % de los
casos**, medido sobre siniestros reales.

**Rearmá el sistema** para que el motor nuevo procese los mismos siniestros
que el viejo sin poder frenar la recepción, sin poder tocar el expediente que
paga, y con una señal por motor que permita decidir el corte con un número en
vez de una sensación.
