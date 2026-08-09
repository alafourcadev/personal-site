---
title: "La base que no aguanta una consulta más"
level: 11
role: tradeoff
domain: telefonia
tradeoffPairId: migracion-de-donde-lee-el-sistema-nuevo
D1: 3
D2: 4
D3: 3
D4: 4
D5: 3
D6: 3
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 7
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá el motor nuevo no puede leer la base vieja, y por qué eso sería un error en el ejercicio anterior."
lambda: 0.5
constraints:
  - metric: líneas postpago que se facturan en el cierre mensual
    operator: ">="
    value: 1300000
    unit: líneas
  - metric: atraso tolerable entre el consumo registrado y el consumo que ve el lado nuevo
    operator: "<="
    value: 30
    unit: minutos
hiddenFacts:
  - fact: "la base de saldos corre sobre un motor licenciado por conexión concurrente. El contrato está al tope: el proveedor ya respondió por escrito que no autoriza conexiones adicionales sin renegociar la licencia entera."
    discoveryPath: "es la restricción que da vuelta la decisión respecto del ejercicio anterior. Cuando leer la base vieja deja de ser gratis y pasa a ser una negociación contractual, la lectura directa deja de ser la opción barata y pasa a ser la más cara de todas."
  - fact: "en el cierre mensual esa base va al 94 % de CPU durante nueve horas. Es la ventana en la que se factura a 1,3 millones de líneas."
    discoveryPath: "preguntate cuándo hace falta el dato y cuándo la base está peor. Acá coinciden: el motor nuevo necesita el consumo justo en el cierre, que es exactamente la ventana en la que una consulta más tira abajo la facturación entera."
  - fact: "lo que el motor nuevo necesita del lado viejo no es un saldo al instante: es el consumo acumulado del mes, que se factura una vez, a fin de mes. Media hora de atraso no cambia una sola factura."
    discoveryPath: "preguntate qué decisión se toma con ese dato y cada cuánto. Un dato que decide si una llamada sigue tiene que ser exacto ahora; uno que decide cuánto dice una factura que se emite una vez por mes tolera un atraso que se mide en minutos."
startingDesign:
  nodes:
    - id: abonado
      type: actor
      label: Abonado postpago
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la línea
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: viejo
      type: service
      label: Motor de tarificación (viejo)
      zone: private
      role: legacy-rating
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Motor de tarificación (nuevo)
      zone: private
      role: new-rating
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 410 }
    - id: saldos
      type: database
      label: Base de saldos (licenciada)
      zone: restricted
      role: balance-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 440 }
    - id: dbnueva
      type: database
      label: Base del motor nuevo
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 550 }
  edges:
    - id: abonado-app
      from: { node: abonado }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: personal
    - id: gw-nuevo
      from: { node: gw }
      to: { node: nuevo }
      dataClass: personal
    - id: viejo-saldos
      from: { node: viejo }
      to: { node: saldos }
      dataClass: personal
    - id: nuevo-saldos
      from: { node: nuevo }
      to: { node: saldos }
      dataClass: personal
    - id: nuevo-dbnueva
      from: { node: nuevo }
      to: { node: dbnueva }
      dataClass: personal
guarantees:
  - id: g-no-direct-read
    label: el motor nuevo no abre conexiones contra la base licenciada
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: new-rating
      to:
        role: balance-store
    whyMissing: el motor nuevo tiene una conexión directa a la base de saldos.
    consequence: "esa base está licenciada por conexión concurrente y el contrato está al tope: cada conexión nueva es una renegociación con el proveedor, no una línea de configuración. Y en el cierre mensual la base va al 94 % de CPU durante nueve horas: la ventana en la que se factura a 1,3 millones de líneas es exactamente la ventana en la que una consulta más la tira abajo."
  - id: g-durable-copy
    label: el consumo llega al lado nuevo por una cola o un registro de eventos que sobrevive a un reinicio
    weight: 2
    predicate:
      op: path
      from:
        role: legacy-rating
      to:
        role: new-store
      via:
        type: [queue, stream]
    whyMissing: no hay ningún camino desde el motor viejo hasta la base del motor nuevo que pase por una cola o un registro de eventos.
    consequence: "sin una pieza durable en el medio, el lado nuevo se queda sin el consumo del mes en cuanto algo se reinicia: no hay dónde volver a leer lo que ya pasó. Y lo que falta no se nota hasta el cierre, cuando 1,3 millones de facturas salen con menos consumo del que hubo."
  - id: g-new-serves
    label: el motor nuevo atiende tráfico real
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: new-rating
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el motor nuevo.
    consequence: "un motor que nunca atendió no está migrado: está escrito. Y con un cierre mensual de por medio, cada mes que no atiende es un mes menos de evidencia antes de que le toque facturar solo."
  - id: g-legacy-store-standing
    label: la base licenciada sigue en pie y sigue siendo la que registra el consumo
    weight: 1
    predicate:
      op: exists
      node:
        type: [database]
        role: balance-store
    whyMissing: la base de saldos no está en el diseño.
    consequence: "no conectarse a ella no es lo mismo que borrarla. Es la única que tiene el consumo de las líneas que todavía no migraron, y el día que se la saca del diagrama esas líneas dejan de facturarse, que es el único error de esta migración que se mide en dinero que nunca se cobra."
rubric:
  - dimension: la migración no agrega carga ni conexiones a lo que se va a apagar
    signal:
      kind: predicate
      guaranteeId: g-no-direct-read
  - dimension: el dato viaja por algo que se puede releer
    signal:
      kind: predicate
      guaranteeId: g-durable-copy
  - dimension: el motor nuevo acumula tiempo real de vuelo
    signal:
      kind: predicate
      guaranteeId: g-new-serves
  - dimension: el registro del consumo sigue existiendo durante la convivencia
    signal:
      kind: predicate
      guaranteeId: g-legacy-store-standing
referenceSolutions:
  - label: un registro de eventos y un proceso de fondo que escribe del lado nuevo
    contextInversion: "poner un proceso de fondo dedicado entre el registro y la base nueva conviene cuando la copia tiene trabajo propio: reintentar, deduplicar, traducir el esquema viejo al nuevo. El motor que atiende llamadas no se entera de nada de eso y su tiempo de respuesta no depende de cuánto tarde la copia. Se paga con una unidad operativa más y con una pieza que hay que mirar aparte, porque cuando se atrasa nadie lo nota desde el lado que factura."
    design:
      nodes:
        - id: abonado
          type: actor
          label: Abonado postpago
          zone: public
        - id: app
          type: mobile-client
          label: App de la línea
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: viejo
          type: service
          label: Motor de tarificación (viejo)
          zone: private
          role: legacy-rating
          props: { criticality: "high", replicas: "3" }
        - id: nuevo
          type: service
          label: Motor de tarificación (nuevo)
          zone: private
          role: new-rating
          props: { criticality: "high", replicas: "3" }
        - id: canal
          type: stream
          label: Registro de consumo
          zone: private
          props: { retention: "30d", ordering: "sí" }
        - id: cargador
          type: worker
          label: Cargador de consumo
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: saldos
          type: database
          label: Base de saldos (licenciada)
          zone: restricted
          role: balance-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base del motor nuevo
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: abonado-app
          from: { node: abonado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-viejo
          from: { node: gw }
          to: { node: viejo }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: viejo-saldos
          from: { node: viejo }
          to: { node: saldos }
          dataClass: personal
        - id: viejo-canal
          from: { node: viejo }
          to: { node: canal }
          dataClass: personal
        - id: canal-cargador
          from: { node: canal }
          to: { node: cargador }
          dataClass: personal
        - id: cargador-dbnueva
          from: { node: cargador }
          to: { node: dbnueva }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
  - label: el motor nuevo consume la cola él mismo
    contextInversion: "que el propio motor nuevo consuma la cola conviene cuando la copia no necesita traducción y lo que se busca es que haya una sola cosa que operar del lado nuevo: el mismo servicio que atiende llamadas es el que escribe el consumo que recibe, así que no hay una pieza silenciosa que se pueda atrasar sin que nadie la mire. El precio es que un atraso de la cola y un pico de tráfico se pelean por el mismo servicio, y el día del cierre esas dos cosas pasan juntas."
    design:
      nodes:
        - id: abonado
          type: actor
          label: Abonado postpago
          zone: public
        - id: app
          type: mobile-client
          label: App de la línea
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: viejo
          type: service
          label: Motor de tarificación (viejo)
          zone: private
          role: legacy-rating
          props: { criticality: "high", replicas: "3" }
        - id: nuevo
          type: service
          label: Motor de tarificación (nuevo)
          zone: private
          role: new-rating
          props: { criticality: "high", replicas: "3" }
        - id: cola
          type: queue
          label: Cola de consumo
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: saldos
          type: database
          label: Base de saldos (licenciada)
          zone: restricted
          role: balance-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base del motor nuevo
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: abonado-app
          from: { node: abonado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-viejo
          from: { node: gw }
          to: { node: viejo }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: viejo-saldos
          from: { node: viejo }
          to: { node: saldos }
          dataClass: personal
        - id: viejo-cola
          from: { node: viejo }
          to: { node: cola }
          dataClass: personal
        - id: cola-nuevo
          from: { node: cola }
          to: { node: nuevo }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
status: PILOT
---

El mismo operador, el mismo motor de tarificación nuevo. Cambian dos cosas, y
entre las dos dan vuelta la respuesta entera.

La primera: acá el segmento es **postpago**, 1,3 millones de líneas. Lo que el
motor nuevo necesita del lado viejo no es un saldo que se descuenta por
segundo: es el **consumo acumulado del mes**, que se factura una vez, a fin de
mes. Media hora de atraso no cambia una sola factura.

La segunda: la base de saldos corre sobre un motor **licenciado por conexión
concurrente**, y el contrato está al tope. El proveedor ya respondió por
escrito: no autoriza conexiones adicionales sin renegociar la licencia
completa. Leer esa base dejó de ser una decisión técnica y pasó a ser una
negociación con un tercero que no tiene ningún apuro.

Hay una tercera cosa que las junta a las dos. En el **cierre mensual** esa base
va al 94 % de CPU durante nueve horas seguidas. Es la ventana en la que se
factura a 1,3 millones de líneas, y es exactamente la ventana en la que el
motor nuevo necesitaría el dato. La consulta que en el ejercicio anterior era
la respuesta correcta acá tira abajo la facturación del mes.

Y sigue habiendo algo que no se puede perder de vista: **la base vieja no se
borra**. Es la única que tiene el consumo de las líneas que todavía no
migraron. No conectarse a ella no es lo mismo que apagarla: el día que
desaparezca del diagrama, esas líneas dejan de facturarse, que es el único
error de esta migración que se mide en plata que nunca se cobra.

**Rearmá el sistema** para que el motor nuevo atienda tráfico real sin abrir una
sola conexión contra la base licenciada, y para que el consumo del lado viejo
llegue al lado nuevo por un camino que se pueda volver a leer cuando algo se
reinicie.
