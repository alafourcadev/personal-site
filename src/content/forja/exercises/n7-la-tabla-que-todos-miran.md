---
title: "La tabla que todos miran"
level: 7
role: core
domain: videojuegos
D1: 3
D2: 3
D3: 2
D4: 2
D5: 2
D6: 4
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que nombrar la pieza que dejás de necesitar y decir por qué deja de tener razón de existir. En este ejercicio se gana sacando algo, no agregándolo."
lambda: 3.0
constraints:
  - metric: partidas que terminan por segundo en el fin de temporada
    operator: ">="
    value: 6100
    unit: partidas
  - metric: consultas a la tabla de posiciones por hora en el mismo fin de semana
    operator: ">="
    value: 11000000
    unit: consultas
  - metric: presupuesto operativo del estudio (techo duro)
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "la tabla de posiciones que miran 2.800.000 jugadores es una sola tabla, igual para todos. El puesto propio no se busca en ella: viene en la respuesta de la partida que acabás de jugar, calculado ahí mismo."
    discoveryPath: "mirá qué devuelve la pantalla de la tabla para dos jugadores distintos. Si el único dato personalizado ya viaja por otro camino, lo que queda es una pantalla pública disfrazada de pantalla personal."
  - fact: "por decisión de producto, la tabla que se muestra se congela treinta segundos: si el orden saltara seis mil veces por segundo, el jugador no podría leerla. El dato en pantalla ya nace con treinta segundos de atraso permitido."
    discoveryPath: "preguntá cuánta frescura tolera el producto antes de decidir de dónde se lee. Acá el atraso no es una concesión que hacés al diseñar: es un requisito que producto ya escribió."
  - fact: "cada consulta a la tabla obliga al registro de partidas a ordenar cuarenta millones de filas, en la misma base donde se están escribiendo 6.100 resultados por segundo. En la final anterior los resultados dejaron de escribirse durante nueve minutos: no se cayó nada, la base estaba ordenando."
    discoveryPath: "seguí las dos operaciones hasta el final y fijate dónde se cruzan. Cuando la lectura del presente y la escritura del registro terminan en la misma pieza, la que pierde siempre es la escritura, porque es la que no puede reintentar sin duplicar."
  - fact: "el registro de partidas no se puede tocar: los premios de la temporada se adjudican con él y el equipo antifraude reaudita la temporada completa dos meses después."
    discoveryPath: "preguntá quién más lee ese dato y cuándo. Un registro que alguien va a releer dentro de dos meses no es un detalle de implementación: es la razón por la que existe la base."
startingDesign:
  nodes:
    - id: jugador
      type: mobile-client
      label: App del juego
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: partidas
      type: service
      label: Servicio de partidas
      zone: private
      role: partidas-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: tabla
      type: service
      label: Servicio de la tabla de posiciones
      zone: private
      role: tabla-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: registro
      type: database
      label: Registro de partidas
      zone: restricted
      role: registro-partidas
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: jugador-gw
      from: { node: jugador }
      to: { node: gw }
      dataClass: personal
    - id: gw-partidas
      from: { node: gw }
      to: { node: partidas }
      dataClass: personal
    - id: gw-tabla
      from: { node: gw }
      to: { node: tabla }
      dataClass: public
    - id: partidas-registro
      from: { node: partidas }
      to: { node: registro }
      dataClass: personal
    - id: tabla-registro
      from: { node: tabla }
      to: { node: registro }
      dataClass: public
    - id: partidas-obs
      from: { node: partidas }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-tabla-no-ordena-el-registro
    label: la tabla de posiciones ya no se arma leyendo el registro de partidas
    weight: 3
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: registro-partidas
        - op: edgeAbsent
          from:
            role: tabla-service
          to:
            role: registro-partidas
    whyMissing: el registro de partidas ya no existe en el diseño, o el servicio de la tabla lo sigue consultando en cada pedido.
    consequence: "once millones de consultas por hora obligando a ordenar cuarenta millones de filas en la misma base donde entran 6.100 escrituras por segundo. Las dos operaciones se pelean por la misma pieza y la que pierde es la escritura: dejás de registrar partidas justo en la final, que es la única partida que importa."
  - id: g-tabla-en-pieza-barata
    label: la tabla que ve el jugador sale de una pieza barata de leer
    weight: 3
    predicate:
      op: path
      from:
        role: partidas-service
      to:
        type: [cdn, cache]
    whyMissing: lo que produce el servicio de partidas no llega a ninguna pieza pensada para que la lean muchos a la vez, ni una copia en memoria ni una red de distribución.
    consequence: "sacar la tabla de encima del registro no es suficiente si no le das otro lugar de donde salir. Una tabla que nadie puede leer es la misma pantalla caída, con la base sana."
  - id: g-resultado-persiste
    label: el resultado de cada partida queda escrito en algo que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: partidas-service
      to:
        role: registro-partidas
    whyMissing: entre el servicio de partidas y el registro no queda ninguna pieza que sobreviva a un reinicio, o directamente no hay camino entre los dos.
    consequence: "los premios de la temporada se adjudican con ese registro y el equipo antifraude lo reaudita dos meses después. Una partida que sólo vivió en memoria es un premio que no podés justificar y una sanción que no podés probar."
  - id: g-jugador-entra
    label: el resultado del jugador sigue llegando al sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [mobile-client]
      to:
        role: partidas-service
    whyMissing: no hay ningún camino desde la app del juego hasta el servicio de partidas.
    consequence: "aliviar la base cerrando la entrada no es escalar: es cancelar la temporada. Todo lo que saques tiene que dejar en pie el camino por el que entra una partida terminada."
  - id: g-partidas-observado
    label: el estudio ve el fin de semana mientras pasa
    weight: 1
    predicate:
      op: covered
      target:
        role: partidas-service
      by:
        type: [observability]
    whyMissing: el servicio de partidas no está conectado a ningún componente de monitoreo.
    consequence: "los nueve minutos en que dejaron de escribirse resultados se vieron igual que nueve minutos tranquilos. Sin señal en vivo, la caída de un fin de semana de final se reconstruye el lunes con las quejas del foro."
rubric:
  - dimension: la lectura masiva dejó de golpear el registro
    signal:
      kind: predicate
      guaranteeId: g-tabla-no-ordena-el-registro
  - dimension: la tabla tiene de dónde salir, y esa pieza es barata de leer
    signal:
      kind: predicate
      guaranteeId: g-tabla-en-pieza-barata
  - dimension: lo que hay que auditar en dos meses sigue escrito
    signal:
      kind: predicate
      guaranteeId: g-resultado-persiste
  - dimension: la partida terminada sigue teniendo por dónde entrar
    signal:
      kind: predicate
      guaranteeId: g-jugador-entra
  - dimension: el fin de semana es visible mientras ocurre
    signal:
      kind: predicate
      guaranteeId: g-partidas-observado
  - dimension: el diseño entra en el presupuesto operativo del estudio
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: la tabla vive en memoria y la contesta el mismo servicio que escribe el resultado
    contextInversion: "tener la tabla en memoria, mantenida y servida por el mismo componente que escribe el resultado, es lo correcto cuando el orden tiene que reflejar la última partida casi al instante: no hay ventana entre «se registró el resultado» y «el orden nuevo es visible», porque las dos cosas las hace el mismo proceso. Cuesta una unidad operativa, y esa unidad sale del servicio de la tabla, que una vez que no consulta la base dejó de tener trabajo propio. Se paga con que si esa memoria se reinicia en plena final, la tabla queda vacía hasta que el servicio la vuelva a armar, y con que la lectura y la escritura vuelven a escalar juntas: no podés darle capacidad a los que miran sin dársela también a los que juegan."
    design:
      nodes:
        - id: jugador
          type: mobile-client
          label: App del juego
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: partidas
          type: service
          label: Servicio de partidas
          zone: private
          role: partidas-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: tablaviva
          type: cache
          label: Tabla de posiciones en memoria
          zone: private
          props: { ttl: "30", eviction: "lru" }
        - id: registro
          type: database
          label: Registro de partidas
          zone: restricted
          role: registro-partidas
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: jugador-gw
          from: { node: jugador }
          to: { node: gw }
          dataClass: personal
        - id: gw-partidas
          from: { node: gw }
          to: { node: partidas }
          dataClass: personal
        - id: partidas-registro
          from: { node: partidas }
          to: { node: registro }
          dataClass: personal
        - id: partidas-tablaviva
          from: { node: partidas }
          to: { node: tablaviva }
          dataClass: public
        - id: partidas-obs
          from: { node: partidas }
          to: { node: obs }
          dataClass: public
  - label: la tabla se publica como archivo cada treinta segundos
    contextInversion: "publicar la tabla como un archivo y servirla desde una red de distribución es lo correcto cuando producto ya aceptó los treinta segundos de atraso y lo que querés es que once millones de lecturas por hora no toquen absolutamente nada tuyo. Es la única variante donde el pico de lectura tiene cero relación con tu infraestructura, y además te deja una unidad operativa sin gastar, que en un fin de semana de final es el margen para reaccionar a lo que no previste. Se paga en frescura, porque la tabla que se ve estuvo bien hace medio minuto, y en que si la publicación se traba, la tabla se congela sin que nada se vea roto: el jugador ve un orden viejo servido rapidísimo."
    design:
      nodes:
        - id: jugador
          type: mobile-client
          label: App del juego
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: partidas
          type: service
          label: Servicio de partidas
          zone: private
          role: partidas-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: publicada
          type: object-storage
          label: Tabla publicada
          zone: private
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: registro
          type: database
          label: Registro de partidas
          zone: restricted
          role: registro-partidas
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: jugador-gw
          from: { node: jugador }
          to: { node: gw }
          dataClass: personal
        - id: gw-partidas
          from: { node: gw }
          to: { node: partidas }
          dataClass: personal
        - id: partidas-registro
          from: { node: partidas }
          to: { node: registro }
          dataClass: personal
        - id: partidas-publicada
          from: { node: partidas }
          to: { node: publicada }
          dataClass: public
        - id: publicada-distribucion
          from: { node: publicada }
          to: { node: distribucion }
          dataClass: public
        - id: partidas-obs
          from: { node: partidas }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Un estudio de juegos para móvil cierra la temporada un domingo. Ese fin de
semana terminan **6.100 partidas por segundo** y **2.800.000 jugadores** abren
la tabla de posiciones: **once millones de consultas por hora**.

Las dos cosas terminan en la misma pieza. Cada consulta a la tabla obliga al
registro de partidas a ordenar cuarenta millones de filas, en la misma base
donde se están escribiendo los resultados. En la final anterior **los
resultados dejaron de escribirse durante nueve minutos**. No se cayó nada: la
base estaba ordenando.

El sistema son cinco piezas despiertas: puerta de entrada, servicio de
partidas, servicio de la tabla, registro de partidas y monitoreo. **El
presupuesto es exactamente cinco**. No hay una sexta. Si entra algo, sale
algo.

Tres datos que ya están sobre la mesa:

- La tabla que miran los 2.800.000 es **una sola tabla, igual para todos**. El
  puesto propio ya viaja en la respuesta de la partida, calculado ahí mismo.
- Producto congela el orden en pantalla **treinta segundos** a propósito: si
  saltara seis mil veces por segundo, nadie podría leerlo.
- El registro de partidas **no se toca**. Los premios se adjudican con él y el
  equipo antifraude reaudita la temporada dos meses después.

**Sacá las once millones de consultas de encima del registro, sin pasarte de
cinco unidades operativas y sin dejar de escribir una sola partida.** Antes de
buscar qué agregar, mirá qué pieza deja de tener razón de existir en cuanto la
tabla sale de la base.
