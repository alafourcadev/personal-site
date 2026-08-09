---
title: "El mapa de la tormenta"
level: 7
role: core
domain: energia
D1: 2
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
aiBudget: "libre, pero tu respuesta tiene que decir cuántas unidades operativas suma y cuántas resta cada movimiento que hacés. Empezás una unidad por encima del techo: una respuesta que sólo agrega no resolvió este ejercicio."
lambda: 3.0
constraints:
  - metric: visitas al mapa de cortes en las tres horas posteriores a la tormenta
    operator: ">="
    value: 2400000
    unit: visitas
  - metric: reclamos por falta de suministro en esas mismas tres horas
    operator: "<="
    value: 41000
    unit: reclamos
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "de 2.400.000 visitas al mapa, 41.000 terminan en un reclamo. El 98 % del tráfico de la tormenta es gente mirando un mapa que es idéntico para todo el mundo: no se filtra por cliente ni por cuenta."
    discoveryPath: "abrí el mapa con dos cuentas distintas durante un corte y compará lo que devuelve: el mismo dibujo, los mismos barrios, la misma hora estimada. Lo que es igual para todos se calcula una vez y se reparte; lo que depende de quién sos, no."
  - fact: "el mapa se rearma con los partes de las cuadrillas cada tres minutos, y la norma del ente regulador obliga a actualizar la hora estimada de reposición cada quince. Ni el vecino ni el regulador esperan un mapa más fresco que eso."
    discoveryPath: "preguntá con qué frecuencia cambia el dato antes de decidir dónde servirlo. Si el dato cambia cada tres minutos y la obligación es cada quince, una copia que vive un minuto no le miente a nadie."
  - fact: "la caché del mapa entró en la tormenta del año pasado para el mismo problema. Está adentro de tu infraestructura: cada una de las 2.400.000 visitas sigue cruzando tu puerta de entrada. Cuesta una unidad operativa los 365 días del año para un problema que dura tres horas."
    discoveryPath: "seguí el camino de una visita al mapa con la caché puesta y contá cuántas piezas tuyas toca. Una copia guardada del lado de adentro reduce el trabajo del servicio, pero no reduce el tráfico que entra."
startingDesign:
  nodes:
    - id: cliente
      type: web-client
      label: Navegador del cliente
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: mapa
      type: service
      label: Servicio del mapa de cortes
      zone: private
      role: mapa-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: reclamos
      type: service
      label: Servicio de reclamos
      zone: private
      role: reclamos-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: cortes
      type: database
      label: Base de cortes y reclamos
      zone: restricted
      role: registro-cortes
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: cachemapa
      type: cache
      label: Caché del mapa
      zone: private
      given: true
      props: { ttl: "180", eviction: "lru" }
      position: { x: 805, y: 190 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: cliente-gw
      from: { node: cliente }
      to: { node: gw }
      dataClass: public
    - id: gw-mapa
      from: { node: gw }
      to: { node: mapa }
      dataClass: public
    - id: gw-reclamos
      from: { node: gw }
      to: { node: reclamos }
      dataClass: personal
    - id: mapa-cortes
      from: { node: mapa }
      to: { node: cortes }
      dataClass: public
    - id: mapa-cachemapa
      from: { node: mapa }
      to: { node: cachemapa }
      dataClass: public
    - id: reclamos-cortes
      from: { node: reclamos }
      to: { node: cortes }
      dataClass: personal
    - id: mapa-obs
      from: { node: mapa }
      to: { node: obs }
      dataClass: public
    - id: reclamos-obs
      from: { node: reclamos }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-mapa-repartido
    label: el mapa de cortes llega a una red de distribución
    weight: 3
    predicate:
      op: path
      from:
        role: mapa-service
      to:
        type: [cdn]
    whyMissing: lo que arma el servicio del mapa no llega a ninguna red de distribución, así que las 2.400.000 visitas terminan dentro de tu infraestructura.
    consequence: "2.400.000 visitas en tres horas contra un servicio que además consulta la base donde se escriben los reclamos. Lo primero que se cae no es el mapa: es la base, y con la base se cae el reclamo, que es lo único que el regulador mide."
  - id: g-mapa-fuera-de-la-puerta
    label: la puerta de entrada ya no llama al servicio del mapa
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: mapa-service
    whyMissing: la puerta de entrada sigue teniendo una conexión directa al servicio del mapa, así que el pico de lectura le sigue llegando igual.
    consequence: "poner una pieza nueva adelante y dejar el camino viejo abierto no saca a nadie de encima: el tráfico entra por donde encuentra. Mientras exista esa conexión, tu puerta de entrada sigue siendo el techo de toda la tormenta."
  - id: g-reclamo-entra
    label: el vecino todavía puede denunciar que no tiene luz
    weight: 2
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: reclamos-service
    whyMissing: no hay ningún camino desde el navegador del cliente hasta el servicio de reclamos.
    consequence: "aguantar la tormenta apagando el reclamo es aguantarla sin registrar nada. El ente regulador multa por tiempo de respuesta, y el reloj de un reclamo empieza a correr cuando el reclamo entra: sin entrada no hay reloj, y sin reloj el organismo asume el peor número."
  - id: g-reclamo-persiste
    label: cada reclamo queda escrito en algo que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: reclamos-service
      to:
        role: registro-cortes
    whyMissing: entre el servicio de reclamos y el registro de cortes no queda ninguna pieza que sobreviva a un reinicio, o directamente no hay camino entre los dos.
    consequence: "el reclamo con su hora es la prueba de cuándo te enteraste. Si vive sólo en memoria, un reinicio durante la tormenta borra la evidencia de los reclamos que sí atendiste, y la discusión con el regulador la perdés sin haber hecho nada mal."
  - id: g-sin-copia-adentro
    label: ninguna pieza tuya guarda una copia del mapa en memoria
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [cache]
    whyMissing: hay un componente leyendo o escribiendo una caché.
    consequence: "una copia guardada del lado de adentro le ahorra trabajo al servicio pero no le ahorra tráfico a la puerta de entrada: las visitas siguen entrando todas. Es una unidad operativa que pagás todo el año para un problema que dura tres horas y que la red de distribución resuelve por cero."
  - id: g-reclamos-observado
    label: el equipo ve entrar los reclamos mientras entran
    weight: 1
    predicate:
      op: covered
      target:
        role: reclamos-service
      by:
        type: [observability]
    whyMissing: el servicio de reclamos no está conectado a ningún componente de monitoreo.
    consequence: "durante una tormenta, «no entran reclamos» y «no hay reclamos» se ven exactamente igual. Sin señal en vivo, la diferencia la descubrís cuando el regulador pide el listado."
rubric:
  - dimension: el tráfico que sólo mira sale de tu infraestructura
    signal:
      kind: predicate
      guaranteeId: g-mapa-repartido
  - dimension: el camino viejo quedó cerrado, no sólo evitado
    signal:
      kind: predicate
      guaranteeId: g-mapa-fuera-de-la-puerta
  - dimension: el camino que el regulador mide sigue abierto
    signal:
      kind: predicate
      guaranteeId: g-reclamo-entra
  - dimension: la prueba de cada reclamo sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-reclamo-persiste
  - dimension: no queda ninguna pieza cubriendo un problema que ya resolviste
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-adentro
  - dimension: la entrada de reclamos es visible mientras ocurre
    signal:
      kind: predicate
      guaranteeId: g-reclamos-observado
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: la red de distribución le pide el mapa al servicio
    contextInversion: "que la red de distribución le pida el mapa al servicio cuando le vence la copia es lo correcto cuando las cuadrillas corrigen el parte sin aviso: si a las 3:40 alguien rectifica la hora estimada de un barrio, la corrección se propaga sola al vencer la copia siguiente y nadie tiene que acordarse de republicar. Se paga con que el servicio del mapa tiene que estar vivo durante toda la tormenta, recibiendo poco tráfico pero real, y con que si se cae justo cuando vence una copia, ese pedazo del mapa se cae con él."
    design:
      nodes:
        - id: cliente
          type: web-client
          label: Navegador del cliente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: mapa
          type: service
          label: Servicio del mapa de cortes
          zone: private
          role: mapa-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: reclamos
          type: service
          label: Servicio de reclamos
          zone: private
          role: reclamos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cortes
          type: database
          label: Base de cortes y reclamos
          zone: restricted
          role: registro-cortes
          props: { backup: "diario" }
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-gw
          from: { node: cliente }
          to: { node: gw }
          dataClass: public
        - id: gw-reclamos
          from: { node: gw }
          to: { node: reclamos }
          dataClass: personal
        - id: mapa-cortes
          from: { node: mapa }
          to: { node: cortes }
          dataClass: public
        - id: mapa-distribucion
          from: { node: mapa }
          to: { node: distribucion }
          dataClass: public
        - id: reclamos-cortes
          from: { node: reclamos }
          to: { node: cortes }
          dataClass: personal
        - id: mapa-obs
          from: { node: mapa }
          to: { node: obs }
          dataClass: public
        - id: reclamos-obs
          from: { node: reclamos }
          to: { node: obs }
          dataClass: public
  - label: el mapa se publica como archivo cada tres minutos
    contextInversion: "publicar el mapa como un archivo y que la red sirva sólo de ahí es lo correcto cuando lo que más te importa es que el mapa siga en pie aunque tu sistema no lo esté: durante una tormenta, la pieza que más probablemente se caiga sos vos, y el último mapa publicado sigue online sin nadie detrás. Es también la variante que deja el servicio del mapa fuera del camino de lectura por completo, así que podés reiniciarlo en plena tormenta sin que nadie lo note. Se paga con un paso más: si la publicación se traba, el mapa se congela y no se ve roto, sólo viejo. Y se paga con que corregir un parte deja de ser un cambio en la base y pasa a ser una republicación."
    design:
      nodes:
        - id: cliente
          type: web-client
          label: Navegador del cliente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: mapa
          type: service
          label: Servicio del mapa de cortes
          zone: private
          role: mapa-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: reclamos
          type: service
          label: Servicio de reclamos
          zone: private
          role: reclamos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cortes
          type: database
          label: Base de cortes y reclamos
          zone: restricted
          role: registro-cortes
          props: { backup: "diario" }
        - id: publicado
          type: object-storage
          label: Mapa publicado
          zone: private
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-gw
          from: { node: cliente }
          to: { node: gw }
          dataClass: public
        - id: gw-reclamos
          from: { node: gw }
          to: { node: reclamos }
          dataClass: personal
        - id: mapa-cortes
          from: { node: mapa }
          to: { node: cortes }
          dataClass: public
        - id: mapa-publicado
          from: { node: mapa }
          to: { node: publicado }
          dataClass: public
        - id: publicado-distribucion
          from: { node: publicado }
          to: { node: distribucion }
          dataClass: public
        - id: reclamos-cortes
          from: { node: reclamos }
          to: { node: cortes }
          dataClass: personal
        - id: mapa-obs
          from: { node: mapa }
          to: { node: obs }
          dataClass: public
        - id: reclamos-obs
          from: { node: reclamos }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Una distribuidora eléctrica atiende un área de 1,2 millones de clientes. Un
temporal deja sin luz a **380.000** de golpe. En las tres horas siguientes el
mapa de cortes recibe **2.400.000 visitas** y el canal de reclamos recibe
**41.000 reclamos**.

De cada 58 personas que entran, una denuncia que no tiene luz. Las otras 57
sólo quieren saber cuándo vuelve.

En el temporal del año pasado el sistema estuvo intermitente cuarenta
minutos. No se cayó el mapa primero: se cayó la base, y con la base se cayó
el registro de reclamos. El ente regulador multa por **tiempo de respuesta**,
y el reloj de un reclamo arranca cuando el reclamo entra. Los cuarenta
minutos que nadie pudo reclamar se cuentan igual.

El equipo llega a la reunión con la propuesta de siempre: más máquinas para
el mapa. Y con un problema nuevo: el sistema tiene **seis unidades operativas
y el presupuesto es cinco**. La caché del mapa entró el año pasado
exactamente para esto y no alcanzó: le ahorró trabajo al servicio, pero
todas las visitas siguieron cruzando la puerta de entrada.

Antes de agregar nada, mirá dos cosas que ya están sobre la mesa. El mapa es
**idéntico para todo el mundo**: no se filtra por cliente ni por cuenta. Y se
rearma con los partes de las cuadrillas cada tres minutos, contra una norma
que obliga a actualizar la hora estimada cada quince.

**Rearmá el sistema para que el pico de lectura no llegue a tu
infraestructura, sin pasarte de cinco unidades operativas y sin cerrar el
canal de reclamos.** Vas a tener que sacar algo: empezás debiendo una unidad.
