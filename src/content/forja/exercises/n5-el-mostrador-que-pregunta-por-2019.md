---
title: "El mostrador que pregunta por 2019"
level: 5
role: tradeoff
domain: banca
tradeoffPairId: operacion-donde-vive-la-historia
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 2
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 6
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá la historia se queda en un almacén consultable, y por qué eso sería un desperdicio en el ejercicio hermano."
lambda: 0.5
constraints:
  - metric: consultas de historia previa al año en curso, por día hábil
    operator: ">="
    value: 2100
    unit: consultas/día
  - metric: tiempo que el oficial de cuentas tolera esperar en el mostrador
    operator: "<="
    value: 3
    unit: segundos
hiddenFacts:
  - fact: "el 38 % de las consultas del mostrador cruzan el año: un socio que discute un débito automático pide el mismo movimiento de los últimos cuatro cierres para mostrar que el importe cambió."
    discoveryPath: "mirá el número de consultas contra el volumen de datos. Acá la historia no es un archivo que se entrega una vez: es tráfico de todos los días, con filtros por socio, por concepto y por rango."
  - fact: la base de historia existe desde la migración de 2022 y nunca se conectó a nada. El oficial de cuentas hoy pide el dato por correo interno y lo recibe al otro día.
    discoveryPath: "está en el lienzo desde el principio, sin ninguna conexión entrante. Un almacén que nadie consulta no resuelve nada, y es el error que este ejercicio pide corregir."
startingDesign:
  nodes:
    - id: socio
      type: actor
      label: Socio
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del socio
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: movimientos
      type: service
      label: Servicio de movimientos
      zone: private
      role: movimientos
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: basemovimientos
      type: database
      label: Base del ejercicio en curso
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: historial
      type: database
      label: Base de historia
      zone: restricted
      role: historial
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: socio-portal
      from: { node: socio }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-movimientos
      from: { node: gw }
      to: { node: movimientos }
      dataClass: personal
    - id: movimientos-basemovimientos
      from: { node: movimientos }
      to: { node: basemovimientos }
      dataClass: personal
guarantees:
  - id: g-history-online
    label: la historia se consulta desde el sistema, no por correo interno
    weight: 2
    predicate:
      op: path
      from:
        role: movimientos
      to:
        role: historial
    whyMissing: no hay ningún camino desde el servicio de movimientos hasta la base de historia, así que ese almacén existe y no lo alcanza nadie.
    consequence: el oficial de cuentas pide el movimiento de 2019 por correo interno y lo recibe al otro día. El socio que vino a discutir un débito se va sin respuesta, y vuelve. Un dato que está guardado y no se puede consultar cuesta lo mismo que uno que no está.
  - id: g-stores-observed
    label: los dos almacenes reportan su estado
    weight: 2
    predicate:
      op: covered
      target:
        type: [database]
      by:
        type: [observability]
    whyMissing: hay al menos una base de datos que no está conectada a ningún componente de monitoreo.
    consequence: "una consulta histórica pesada no se cae: se pone lenta, y arrastra a la base del ejercicio en curso con ella. Sin la señal de cada almacén por separado, lo único que se ve es que el mostrador anda mal, y nadie sabe cuál de los dos almacenes hay que mirar."
  - id: g-counter-path
    label: el socio sigue llegando al servicio por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: movimientos
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde el cliente hasta el servicio de movimientos que pase por la puerta de entrada.
    consequence: conectar la historia no puede costar el producto. Si en el camino desarmaste la ruta por la que el socio entra, el sistema quedó perfectamente completo y perfectamente inútil.
rubric:
  - dimension: la historia es tráfico del sistema y no un pedido por correo
    signal:
      kind: predicate
      guaranteeId: g-history-online
  - dimension: cada almacén se puede mirar por separado cuando el mostrador se pone lento
    signal:
      kind: predicate
      guaranteeId: g-stores-observed
  - dimension: el producto sigue funcionando después de tocarlo
    signal:
      kind: predicate
      guaranteeId: g-counter-path
referenceSolutions:
  - label: el mismo servicio consulta los dos almacenes
    contextInversion: "que el servicio de movimientos consulte las dos bases es lo correcto cuando la consulta histórica es del mismo tamaño que la del ejercicio en curso (un socio, un rango, unas decenas de filas) y el equipo prefiere una pieza menos que operar. La ambigüedad de si un dato está en un almacén o en el otro queda adentro del servicio, que es donde ya vive la regla de qué es un movimiento. Lo que se pierde es el aislamiento: una consulta histórica pesada corre en el mismo proceso que atiende al mostrador, así que un pedido de cuatro años sin filtrar deja esperando al que pidió el saldo de ayer."
    design:
      nodes:
        - id: socio
          type: actor
          label: Socio
          zone: public
        - id: portal
          type: web-client
          label: Portal del socio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: movimientos
          type: service
          label: Servicio de movimientos
          zone: private
          role: movimientos
          props: { criticality: "high", replicas: "2" }
        - id: basemovimientos
          type: database
          label: Base del ejercicio en curso
          zone: restricted
          props: { backup: "diario" }
        - id: historial
          type: database
          label: Base de historia
          zone: restricted
          role: historial
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: socio-portal
          from: { node: socio }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-movimientos
          from: { node: gw }
          to: { node: movimientos }
          dataClass: personal
        - id: movimientos-basemovimientos
          from: { node: movimientos }
          to: { node: basemovimientos }
          dataClass: personal
        - id: movimientos-historial
          from: { node: movimientos }
          to: { node: historial }
          dataClass: personal
        - id: movimientos-monitoreo
          from: { node: movimientos }
          to: { node: monitoreo }
          dataClass: public
        - id: basemovimientos-monitoreo
          from: { node: basemovimientos }
          to: { node: monitoreo }
          dataClass: public
        - id: historial-monitoreo
          from: { node: historial }
          to: { node: monitoreo }
          dataClass: public
  - label: un servicio de consulta histórica aparte
    contextInversion: "separar la consulta histórica en su propio servicio es lo correcto cuando el pedido de cuatro años es de otra escala que el saldo de ayer y no puede compartir el proceso que atiende al mostrador: si la consulta histórica se satura, el saldo del día sigue respondiendo. También deja que el equipo la despliegue, la limite y la apague sin tocar el servicio que sostiene la caja. Se paga con una unidad operativa más, que consume todo el margen del presupuesto, y con un salto de red extra en cada consulta histórica."
    design:
      nodes:
        - id: socio
          type: actor
          label: Socio
          zone: public
        - id: app
          type: mobile-client
          label: App del socio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: movimientos
          type: service
          label: Servicio de movimientos
          zone: private
          role: movimientos
          props: { criticality: "high", replicas: "2" }
        - id: consulta
          type: service
          label: Servicio de consulta histórica
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: basemovimientos
          type: database
          label: Base del ejercicio en curso
          zone: restricted
          props: { backup: "diario" }
        - id: historial
          type: database
          label: Base de historia
          zone: restricted
          role: historial
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: socio-app
          from: { node: socio }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-movimientos
          from: { node: gw }
          to: { node: movimientos }
          dataClass: personal
        - id: movimientos-basemovimientos
          from: { node: movimientos }
          to: { node: basemovimientos }
          dataClass: personal
        - id: movimientos-consulta
          from: { node: movimientos }
          to: { node: consulta }
          dataClass: personal
        - id: consulta-historial
          from: { node: consulta }
          to: { node: historial }
          dataClass: personal
        - id: movimientos-monitoreo
          from: { node: movimientos }
          to: { node: monitoreo }
          dataClass: public
        - id: consulta-monitoreo
          from: { node: consulta }
          to: { node: monitoreo }
          dataClass: public
        - id: basemovimientos-monitoreo
          from: { node: basemovimientos }
          to: { node: monitoreo }
          dataClass: public
        - id: historial-monitoreo
          from: { node: historial }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una cooperativa de crédito con mostrador físico en catorce sucursales. El
oficial de cuentas atiende al socio con la pantalla abierta y **no tolera
esperar más de tres segundos**.

**2.100 consultas por día hábil cruzan el año en curso.** No son auditorías
ni entregas: es la conversación de todos los días. Un socio discute un
débito automático y el oficial necesita el mismo movimiento de los últimos
cuatro cierres para mostrarle que el importe cambió. El 38 % de lo que se
pregunta en el mostrador está antes del 1 de enero.

La base de historia existe. La creó la migración de 2022 y **nunca se
conectó a nada**. Hoy el oficial pide el movimiento de 2019 por correo
interno al equipo de datos y lo recibe al otro día. El socio se va sin
respuesta, vuelve la semana siguiente, y esa segunda visita la paga la
cooperativa dos veces: en tiempo de mostrador y en un reclamo que ya
empezó mal.

Este ejercicio y su hermano son la misma decisión mirada desde dos
negocios distintos: **dónde vive la historia**. Acá la respuesta es que
vive en línea, y el precio se acepta con los ojos abiertos: un almacén
consultable es una pieza que el equipo mantiene todo el año. La parchea,
le mira el disco, le restaura la copia. Y esa unidad operativa sale del
mismo presupuesto que todo lo demás.

Vale la pena, porque acá la historia no se entrega una vez: **se consulta
2.100 veces por día, con filtros, y contra reloj.** Eso es una base, y una
base se paga.

Hay una segunda cosa que el equipo aprendió en junio: una consulta
histórica sin filtrar se pone lenta y arrastra al mostrador con ella. Desde
afuera las dos cosas se ven igual, "el sistema anda mal", y nadie sabe cuál
de los dos almacenes hay que mirar.

**Armá el sistema** para que la historia se consulte desde el propio
sistema y para que cada almacén reporte su estado por separado, sin
romper el camino por el que entra el socio.
