---
title: "Los ciento cuarenta que cierran el mismo día"
level: 8
role: tradeoff
domain: cobranzas
tradeoffPairId: n8-quien-puede-leer-la-base-compartida
D1: 3
D2: 3
D3: 3
D4: 2
D5: 2
D6: 3
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir dónde vive, en tu diseño, la regla de que una fila pertenece a un comercio, si ya no vive en el servicio por el que pasan todas las lecturas."
lambda: 0.5
constraints:
  - metric: comercios que cierran el mismo día
    operator: ">="
    value: 140
    unit: comercios
  - metric: ventana disponible para cerrar el mes
    operator: "<="
    value: 4
    unit: horas
hiddenFacts:
  - fact: "el cierre de mes lee los movimientos de los 140 comercios y hoy lo hace de a uno, pidiéndoselos al servicio de cobros. Tarda seis horas y media y la ventana es de cuatro."
    discoveryPath: "es la razón por la que la garantía pide un camino a los datos que NO pase por el servicio de cobros. El nivel anterior ya mostró qué pasa cuando un proceso masivo comparte capacidad con el camino que atienden los usuarios."
  - fact: "durante esas seis horas y media, el servicio de cobros atiende el cierre y a los comercios al mismo tiempo. El 1 de julio a las 6:40 de la mañana, cobrar una tarjeta tardó 22 segundos."
    discoveryPath: "el cierre no se cae ni tira errores. Sólo consume la misma capacidad que los comercios necesitan para trabajar, y lo hace justo el día en que más lo necesitan."
  - fact: "la base guarda el comercio en cada fila y tiene un índice por ese campo. El barrido masivo no necesita adivinar nada: recorre comercio por comercio usando ese índice."
    discoveryPath: "es lo que hace posible esta mitad del par. Cuando la pertenencia vive en el dato y no sólo en el código que lo lee, un barrido puede ser correcto sin pasar por el servicio. Cuando no vive ahí, no puede."
startingDesign:
  nodes:
    - id: comercio
      type: actor
      label: Comercio
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: panel
      type: web-client
      label: Panel de cobros
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: cobros
      type: service
      label: Servicio de cobros
      zone: private
      role: billing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: conciliador
      type: worker
      label: Cierre de mes
      zone: private
      role: reconciler
      given: true
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de movimientos
      zone: restricted
      role: shared-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: comercio-panel
      from: { node: comercio }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-cobros
      from: { node: gw }
      to: { node: cobros }
      dataClass: personal
    - id: cobros-base
      from: { node: cobros }
      to: { node: base }
      dataClass: personal
    - id: conciliador-cobros
      from: { node: conciliador }
      to: { node: cobros }
      dataClass: personal
guarantees:
  - id: g-merchant-scoped-read
    label: el comercio llega a sus movimientos por el servicio que estampa de quién son
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: shared-store
      via:
        role: billing-service
    whyMissing: no hay ningún camino desde la puerta de entrada hasta la base de movimientos que pase por el servicio de cobros.
    consequence: lo que atiende al comercio no cambia en esta mitad del problema. El servicio de cobros sigue siendo el único componente que recibe de qué comercio es la sesión, y toda consulta en vivo tiene que llevar ese dato adentro.
  - id: g-bulk-read-off-the-hot-path
    label: el cierre de mes llega a los movimientos sin pasar por el servicio que atienden los comercios
    weight: 2
    predicate:
      op: path
      from:
        role: reconciler
      to:
        role: shared-store
      forbid:
        role: billing-service
    whyMissing: el único camino desde el cierre de mes hasta la base de movimientos pasa por el servicio de cobros.
    consequence: "el cierre lee los 140 comercios de a uno por la misma interfaz que usa el panel. Tarda seis horas y media contra una ventana de cuatro, y durante esas horas consume la capacidad que los comercios necesitan justo el día en que más la necesitan: el 1 de julio a las 6:40, cobrar una tarjeta tardó 22 segundos."
  - id: g-no-call-into-hot-service
    label: no queda ninguna llamada del cierre de mes al servicio de cobros
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: reconciler
      to:
        role: billing-service
    whyMissing: sigue existiendo una conexión del cierre de mes hacia el servicio de cobros.
    consequence: mientras exista, el camino lento sigue disponible y alguien lo va a volver a usar el mes que viene, porque es el que ya conoce. Un camino de emergencia que no se borra deja de ser una excepción y vuelve a ser la costumbre.
rubric:
  - dimension: el comercio sigue leyendo por el componente que conoce al dueño
    signal:
      kind: predicate
      guaranteeId: g-merchant-scoped-read
  - dimension: el proceso masivo deja de competir con el camino que da de comer
    signal:
      kind: predicate
      guaranteeId: g-bulk-read-off-the-hot-path
  - dimension: el camino lento ya no está disponible para volver a usarlo
    signal:
      kind: predicate
      guaranteeId: g-no-call-into-hot-service
referenceSolutions:
  - label: el cierre de mes recorre la base por su cuenta, usando el campo de comercio
    contextInversion: "que el cierre lea la base directamente es lo correcto cuando la pertenencia vive en el dato, con cada fila guardando su comercio y un índice por ese campo, y la ventana no da para leer de a uno: el barrido recorre comercio por comercio en minutos y no le saca ni un poco de capacidad al servicio que está cobrando tarjetas. El costo es que la regla de tenencia ahora tiene dos implementaciones, y la del cierre nadie la mira."
    design:
      nodes:
        - id: comercio
          type: actor
          label: Comercio
          zone: public
        - id: panel
          type: web-client
          label: Panel de cobros
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobros
          type: service
          label: Servicio de cobros
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: conciliador
          type: worker
          label: Cierre de mes
          zone: private
          role: reconciler
        - id: base
          type: database
          label: Base de movimientos
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
      edges:
        - id: comercio-panel
          from: { node: comercio }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobros
          from: { node: gw }
          to: { node: cobros }
          dataClass: personal
        - id: cobros-base
          from: { node: cobros }
          to: { node: base }
          dataClass: personal
        - id: conciliador-base
          from: { node: conciliador }
          to: { node: base }
          dataClass: personal
  - label: un servicio de lectura masiva, separado del que atiende a los comercios
    contextInversion: "un servicio de lectura masiva conviene cuando el barrido no es una consulta suelta sino un producto, como los cierres, las exportaciones y los reportes fiscales, y esa lógica merece un lugar donde vivir y que alguien la revise: la implementación de la tenencia vuelve a estar en un servicio, pero en uno que se escala, se limita y se cae sin arrastrar a los comercios. Se paga con una pieza más para operar."
    design:
      nodes:
        - id: comercio
          type: actor
          label: Comercio
          zone: public
        - id: panel
          type: web-client
          label: Panel de cobros
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobros
          type: service
          label: Servicio de cobros
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: lecturas
          type: service
          label: Servicio de lectura masiva
          zone: private
        - id: conciliador
          type: worker
          label: Cierre de mes
          zone: private
          role: reconciler
        - id: base
          type: database
          label: Base de movimientos
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
      edges:
        - id: comercio-panel
          from: { node: comercio }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobros
          from: { node: gw }
          to: { node: cobros }
          dataClass: personal
        - id: cobros-base
          from: { node: cobros }
          to: { node: base }
          dataClass: personal
        - id: conciliador-lecturas
          from: { node: conciliador }
          to: { node: lecturas }
          dataClass: personal
        - id: lecturas-base
          from: { node: lecturas }
          to: { node: base }
          dataClass: personal
status: PILOT
---

La misma plataforma de cobros. Los mismos **140 comercios** sobre la misma
base de movimientos. Ninguno es una financiera regulada: son almacenes,
farmacias, talleres, una cadena de nueve panaderías.

Todos cierran el mes el mismo día, porque el mes termina para todos el mismo
día.

Hoy el cierre entra por donde entra todo el mundo: le pide los movimientos al
servicio de cobros, comercio por comercio. Es la puerta única, y funcionó
bien mientras fueron 30 comercios.

Con 140 tarda **seis horas y media**. La ventana es de cuatro.

Y durante esas seis horas y media, el servicio de cobros atiende el cierre y
a los comercios al mismo tiempo. El 1 de julio a las 6:40 de la mañana, en
una panadería, cobrar una tarjeta tardó **22 segundos**. Nadie vio un error
en ningún tablero: el sistema estaba sano, sólo que ocupado.

Un dato que cambia el problema: la base guarda el comercio en cada fila y
tiene un índice por ese campo. El barrido no tiene que adivinar de quién es
nada. Recorre comercio por comercio usando ese índice, y termina en minutos.

Eso no era cierto en la otra mitad de este par, y por eso allá la respuesta
era la contraria.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que el cierre de mes llegue a los movimientos sin
competir por la capacidad del servicio que están usando los comercios, y para
que el camino lento deje de estar disponible.
