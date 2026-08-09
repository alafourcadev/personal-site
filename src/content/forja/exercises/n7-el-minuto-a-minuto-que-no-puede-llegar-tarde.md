---
title: "El minuto a minuto que no puede llegar tarde"
level: 7
role: tradeoff
domain: deportes
tradeoffPairId: n7-el-minuto-a-minuto
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 3
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir cuánto retraso acepta este producto y qué pasa exactamente en el segundo de retraso número treinta y uno."
lambda: 2.5
constraints:
  - metric: pujadores simultáneos en el último minuto de la subasta
    operator: ">="
    value: 210000
    unit: pujadores
  - metric: retraso tolerado en el precio actual
    operator: "<="
    value: 1
    unit: segundos
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "una puja hecha contra un precio viejo se rechaza. En la última subasta se rechazó el 61 % de las pujas de los últimos treinta segundos, y el reclamo que llegó no fue «anda lento»: fue «me cobraron mal»."
    discoveryPath: "mirá qué pasa cuando el número que el usuario ve y el número real no coinciden. En una pantalla de lectura eso es un retraso; en una pantalla donde el usuario actúa sobre el número, es un error de negocio."
  - fact: "el equipo que armó la pantalla del partido dejó acá el mismo diseño que le funcionó allá: un publicador que sube el precio a la red de distribución cada treinta segundos. Nadie revisó si el contexto era el mismo."
    discoveryPath: "compará este ejercicio con el otro del par. Mismo pico, misma plataforma, misma forma de resolverlo, y una de las dos veces está mal. La diferencia no está en el diagrama, está en el número que el negocio tolera."
  - fact: "el precio actual es un número por subasta. Cabe entero en memoria y no ocupa nada; lo que no cabe en memoria es el libro de pujas, que es lo que hay que poder auditar después."
    discoveryPath: "separá el dato que se lee todo el tiempo del dato que hay que conservar. Casi nunca son el mismo dato ni quieren la misma pieza."
startingDesign:
  nodes:
    - id: pujador
      type: web-client
      label: Navegador del pujador
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: vivo
      type: service
      label: Servicio de la subasta en vivo
      zone: private
      role: vivo-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: pujas
      type: database
      label: Libro de pujas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: publicador
      type: service
      label: Publicador de precio
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: distribucion
      type: cdn
      label: Red de distribución
      zone: dmz
      given: true
      position: { x: 805, y: 190 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: pujador-gw
      from: { node: pujador }
      to: { node: gw }
      dataClass: personal
    - id: gw-vivo
      from: { node: gw }
      to: { node: vivo }
      dataClass: personal
    - id: vivo-pujas
      from: { node: vivo }
      to: { node: pujas }
      dataClass: personal
    - id: publicador-pujas
      from: { node: publicador }
      to: { node: pujas }
      dataClass: personal
    - id: publicador-distribucion
      from: { node: publicador }
      to: { node: distribucion }
      dataClass: public
    - id: vivo-obs
      from: { node: vivo }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-lectura-en-vivo
    label: el pujador llega al servicio de la subasta en cada consulta
    weight: 3
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: vivo-service
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el servicio de la subasta, así que el precio que ve el pujador no viene del sistema que lo conoce.
    consequence: "el precio que el pujador ve es el precio con el que va a pujar. Si ese número no sale del componente que lo acaba de cambiar, la puja se hace contra un número que ya no existe y se rechaza después de que la persona apretó el botón."
  - id: g-sin-copia-repartida
    label: el precio actual no se sirve desde una red de distribución
    weight: 2
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [cdn]
    whyMissing: hay una red de distribución en el diseño, y una copia repartida es exactamente lo que no se puede tener acá.
    consequence: "una copia repartida vive en cientos de puntos y se invalida cuando se invalida, no cuando vos querés. Treinta segundos de precio viejo en una pantalla donde la gente puja no son un retraso: son pujas rechazadas y un reclamo de cobro."
  - id: g-precio-en-memoria
    label: el precio actual se responde desde memoria, no desde el libro de pujas
    weight: 2
    predicate:
      op: path
      from:
        role: vivo-service
      to:
        type: [cache]
    whyMissing: el servicio de la subasta no tiene ninguna pieza en memoria de dónde leer el precio actual.
    consequence: "210.000 pujadores mirando el precio contra el mismo libro donde estás escribiendo cada puja. Las lecturas y las escrituras se pelean por la misma pieza justo en el último minuto, que es el único minuto que importa."
  - id: g-libro-persistente
    label: cada puja queda escrita en algo que sobrevive a un reinicio
    weight: 1
    predicate:
      op: exists
      node:
        type: [database]
    whyMissing: no hay ninguna base en el diseño, y las pujas viven sólo mientras el proceso esté vivo.
    consequence: "una subasta se puede impugnar seis meses después. Sin un libro que persista, la respuesta a «¿quién pujó cuánto y cuándo?» es que no lo sabés, y eso no es un problema técnico: es un problema legal."
rubric:
  - dimension: el número que se ve es el número con el que se actúa
    signal:
      kind: predicate
      guaranteeId: g-lectura-en-vivo
  - dimension: no queda ninguna copia que se invalide cuando quiere
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-repartida
  - dimension: la lectura del pico no pelea con la escritura del libro
    signal:
      kind: predicate
      guaranteeId: g-precio-en-memoria
  - dimension: la subasta se puede auditar después
    signal:
      kind: predicate
      guaranteeId: g-libro-persistente
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: un solo servicio que escribe el libro y refresca la memoria
    contextInversion: "un solo servicio que atiende la puja, escribe el libro y actualiza el precio en memoria es lo correcto cuando el precio y la puja tienen que moverse juntos: no hay ventana entre «se aceptó la puja» y «el precio nuevo es visible», porque las dos cosas las hace el mismo proceso. Es también la variante que deja una unidad operativa sin gastar, y en una subasta que dura noventa minutos ese margen es lo que te permite reaccionar. Se paga con que la lectura y la escritura escalan juntas: no podés poner más capacidad para los que miran sin ponerla también para los que pujan."
    design:
      nodes:
        - id: pujador
          type: web-client
          label: Navegador del pujador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: vivo
          type: service
          label: Servicio de la subasta en vivo
          zone: private
          role: vivo-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: precio
          type: cache
          label: Precio actual en memoria
          zone: private
          props: { ttl: "5", eviction: "lru" }
        - id: pujas
          type: database
          label: Libro de pujas
          zone: restricted
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: pujador-gw
          from: { node: pujador }
          to: { node: gw }
          dataClass: personal
        - id: gw-vivo
          from: { node: gw }
          to: { node: vivo }
          dataClass: personal
        - id: vivo-pujas
          from: { node: vivo }
          to: { node: pujas }
          dataClass: personal
        - id: vivo-precio
          from: { node: vivo }
          to: { node: precio }
          dataClass: public
        - id: vivo-obs
          from: { node: vivo }
          to: { node: obs }
          dataClass: public
  - label: lectura y escritura separadas, con la memoria en el medio
    contextInversion: "separar el componente que muestra el precio del componente que acepta la puja es lo correcto cuando los dos lados crecen a ritmos distintos: 210.000 personas miran y unas pocas miles pujan. Con dos componentes podés darle capacidad al lado que mira sin tocar el lado que escribe el libro, que es el lado delicado. Cuesta una unidad operativa más, la que la otra variante se ahorra, y se paga con una ventana real: entre que la puja se acepta y que el precio nuevo aparece en memoria hay un instante en que los dos lados no dicen lo mismo."
    design:
      nodes:
        - id: pujador
          type: web-client
          label: Navegador del pujador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: vivo
          type: service
          label: Servicio de lectura de la subasta
          zone: private
          role: vivo-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: puja
          type: service
          label: Servicio de puja
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: precio
          type: cache
          label: Precio actual en memoria
          zone: private
          props: { ttl: "5", eviction: "lru" }
        - id: pujas
          type: database
          label: Libro de pujas
          zone: restricted
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: pujador-gw
          from: { node: pujador }
          to: { node: gw }
          dataClass: personal
        - id: gw-vivo
          from: { node: gw }
          to: { node: vivo }
          dataClass: personal
        - id: gw-puja
          from: { node: gw }
          to: { node: puja }
          dataClass: personal
        - id: puja-pujas
          from: { node: puja }
          to: { node: pujas }
          dataClass: personal
        - id: puja-precio
          from: { node: puja }
          to: { node: precio }
          dataClass: public
        - id: vivo-precio
          from: { node: vivo }
          to: { node: precio }
          dataClass: public
        - id: vivo-obs
          from: { node: vivo }
          to: { node: obs }
          dataClass: public
        - id: puja-obs
          from: { node: puja }
          to: { node: obs }
          dataClass: public
status: PILOT
---

La misma plataforma de deportes, la misma noche, la otra pantalla: la
**subasta de la camiseta del partido**, que cierra al pitazo final. En el
último minuto hay **210.000 personas** mirando el precio actual.

Mismo pico. Mismo equipo. Y el equipo trajo el diseño que le funcionó en la
ficha del partido: un publicador que sube el precio actual a la red de
distribución cada treinta segundos.

En la última subasta se rechazó el **61 % de las pujas de los últimos
treinta segundos**. Los usuarios no escribieron "anda lento". Escribieron "me
cobraron mal" y "pujé y no me lo tomaron".

Acá el número que se ve en la pantalla no es información: es el número
contra el cual la persona **actúa**. Un precio viejo no produce una
experiencia peor, produce una operación inválida. El área de producto ya
fijó el límite: **un segundo**.

El sistema son cinco piezas y **el presupuesto es seis**: hay una unidad
disponible, no dos. Y sigue habiendo algo que no se negocia: una subasta se
puede impugnar seis meses después, así que cada puja tiene que quedar
escrita en algo que sobreviva a un reinicio.

**Rearmá la subasta para que el precio que se ve sea el precio real, sin
pasarte de seis unidades operativas.** Empezá sacando lo que trajiste de la
otra pantalla: acá esa pieza no es una optimización, es el problema.
