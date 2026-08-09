---
title: "La ficha que conviene mostrar vieja"
level: 6
role: counter-trap
domain: industria
D1: 2
D2: 2
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
aiBudget: "libre, pero tu respuesta tiene que decir qué muestra la terminal del depósito durante los minutos en que el catálogo del proveedor no contesta, y por qué acá sí es mejor que no mostrar nada."
lambda: 0.5
constraints:
  - metric: consultas de ficha de seguridad en el depósito por mes
    operator: ">="
    value: 1100
    unit: consultas/mes
  - metric: veces por año que una ficha de seguridad cambia de contenido
    operator: "<="
    value: 2
    unit: cambios/año
  - metric: derrames o salpicaduras registrados por mes en la planta
    operator: ">="
    value: 3
    unit: eventos/mes
hiddenFacts:
  - fact: "una ficha de seguridad cambia como mucho dos veces por año, y cuando cambia lo hace por una revisión normativa que se anuncia con meses de anticipación. Nunca cambia de un día para el otro por un incidente."
    discoveryPath: "preguntate cómo cambia el dato, no sólo cada cuánto. Un dato que cambia por una revisión anunciada es un dato cuya copia de ayer es correcta; uno que cambia por un incidente de esta mañana, no."
  - fact: "mostrar una ficha no autoriza nada. No abre una puerta, no habilita a nadie, no compromete plata: le dice al operario qué hacer con un líquido que ya está en el piso. La decisión sigue siendo del operario y del supervisor."
    discoveryPath: "preguntate qué compromete la lectura. Si el dato informa a una persona que va a decidir igual, servirlo viejo es darle más información que no servirlo. Si el dato es la decisión, es al revés."
  - fact: "el catálogo del proveedor químico es una web con inicio de sesión y sin acuerdo de nivel de servicio. Cae sin aviso, entre veinte minutos y dos horas, unas cuatro veces por trimestre."
    discoveryPath: "buscá qué contrato tenés con la fuente. Sin acuerdo de nivel de servicio no hay a quién reclamarle: la disponibilidad de tu depósito es la que vos construyas de este lado."
  - fact: "cuando la terminal no muestra nada, el operario no espera: improvisa con lo que recuerda o pregunta al de al lado. Los tres derrames del mes pasado se atendieron así, y en uno se usó el absorbente equivocado."
    discoveryPath: "seguí qué hace la persona cuando la pantalla está en blanco. No se queda quieta esperando: decide igual, con peor información que la de una ficha de hace un mes."
startingDesign:
  nodes:
    - id: operario
      type: actor
      label: Operario de depósito
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: terminal
      type: web-client
      label: Terminal del depósito
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: fichas
      type: service
      label: Servicio de fichas de seguridad
      zone: private
      role: safety-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: catalogo
      type: external-provider
      label: Catálogo de fichas del proveedor químico
      zone: dmz
      role: catalog-source
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: operario-terminal
      from: { node: operario }
      to: { node: terminal }
      dataClass: public
    - id: terminal-gw
      from: { node: terminal }
      to: { node: gw }
      dataClass: public
    - id: gw-fichas
      from: { node: gw }
      to: { node: fichas }
      dataClass: public
    - id: fichas-catalogo
      from: { node: fichas }
      to: { node: catalogo }
      dataClass: public
guarantees:
  - id: g-ficha-sin-el-catalogo
    label: la consulta del operario llega hasta una ficha guardada sin pasar por el catálogo del proveedor
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [cache, object-storage, database]
      forbid:
        role: catalog-source
    whyMissing: el pedido que entra por la puerta termina siempre en el catálogo del proveedor. No hay ningún camino que llegue a una ficha guardada de este lado, así que cuando el catálogo no contesta la terminal no tiene nada que mostrar.
    consequence: "el operario tiene un líquido en el piso y una pantalla en blanco. No espera: improvisa con lo que recuerda o le pregunta al de al lado. En uno de los tres derrames del mes pasado eso terminó con el absorbente equivocado sobre un ácido."
  - id: g-catalogo-sigue-alimentando
    label: la copia se sigue alimentando del catálogo del proveedor
    weight: 2
    predicate:
      op: path
      from:
        type: [service, worker]
      to:
        role: catalog-source
    whyMissing: ninguna pieza del sistema llega al catálogo del proveedor, así que la copia local no tiene de dónde actualizarse.
    consequence: una revisión normativa cambia un pictograma o un límite de exposición y el depósito nunca se entera. Una copia que nadie refresca deja de estar un mes vieja y pasa a estar años vieja, que es otra cosa y ya no es admisible.
  - id: g-servicio-lee-la-copia
    label: el servicio de fichas es el que llega a la copia, no una pieza colgada al costado
    weight: 1
    predicate:
      op: path
      from:
        role: safety-service
      to:
        type: [cache, object-storage, database]
    whyMissing: la copia existe pero el servicio que atiende la terminal no llega hasta ella. Quedó al costado del diagrama, actualizándose contra algo que nadie consulta.
    consequence: "tener la contingencia y no usarla es peor que no tenerla: el informe de seguridad dice que hay respaldo local, y la terminal se sigue poniendo en blanco cuatro veces por trimestre."
rubric:
  - dimension: reconocer cuándo el dato viejo sigue siendo el dato correcto
    signal:
      kind: predicate
      guaranteeId: g-ficha-sin-el-catalogo
  - dimension: la copia tiene una fuente y una edad acotada
    signal:
      kind: predicate
      guaranteeId: g-catalogo-sigue-alimentando
  - dimension: la contingencia está en el camino real de la consulta
    signal:
      kind: predicate
      guaranteeId: g-servicio-lee-la-copia
referenceSolutions:
  - label: copia en memoria, refrescada por el mismo servicio
    contextInversion: "una copia en memoria es lo correcto cuando el depósito maneja cuarenta productos y la ficha que se consulta hoy es casi siempre la que se consultó ayer: se paga sólo lo que alguien mira, y una ficha que nadie abre nunca ocupa nada. Es la topología con menos piezas. El costo es que después de un reinicio del servidor la primera consulta de cada producto vuelve a depender del catálogo, y si el reinicio y la caída del proveedor coinciden, la terminal queda en blanco igual. Pasó una vez en dos años."
    design:
      nodes:
        - id: operario
          type: actor
          label: Operario de depósito
          zone: public
        - id: terminal
          type: web-client
          label: Terminal del depósito
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: fichas
          type: service
          label: Servicio de fichas de seguridad
          zone: private
          role: safety-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Copia de fichas consultadas
          zone: private
          props: { ttl: "86400" }
        - id: catalogo
          type: external-provider
          label: Catálogo de fichas del proveedor químico
          zone: dmz
          role: catalog-source
      edges:
        - id: operario-terminal
          from: { node: operario }
          to: { node: terminal }
          dataClass: public
        - id: terminal-gw
          from: { node: terminal }
          to: { node: gw }
          dataClass: public
        - id: gw-fichas
          from: { node: gw }
          to: { node: fichas }
          dataClass: public
        - id: fichas-copia
          from: { node: fichas }
          to: { node: copia }
          dataClass: public
        - id: fichas-catalogo
          from: { node: fichas }
          to: { node: catalogo }
          dataClass: public
  - label: archivo local de fichas, bajado por un sincronizador aparte
    contextInversion: "un archivo de documentos mantenido por una pieza separada conviene cuando la ficha se lee entera y sin consultas, un PDF por producto que se abre y se muestra, y cuando querés que el depósito funcione aunque el catálogo esté caído dos horas y el servidor se haya reiniciado en el medio: lo que hay en el archivo sigue estando. Además el sincronizador baja las cuarenta fichas completas de madrugada, así que ninguna consulta paga nunca la lentitud del proveedor, ni la primera. Se paga con una pieza más para operar y con fichas de productos que ya no se usan ocupando lugar hasta que alguien las saque."
    design:
      nodes:
        - id: operario
          type: actor
          label: Operario de depósito
          zone: public
        - id: terminal
          type: web-client
          label: Terminal del depósito
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: fichas
          type: service
          label: Servicio de fichas de seguridad
          zone: private
          role: safety-service
          props: { criticality: "high", replicas: "2" }
        - id: archivo
          type: object-storage
          label: Archivo local de fichas de seguridad
          zone: private
        - id: sincronizador
          type: worker
          label: Sincronizador de fichas
          zone: private
        - id: catalogo
          type: external-provider
          label: Catálogo de fichas del proveedor químico
          zone: dmz
          role: catalog-source
      edges:
        - id: operario-terminal
          from: { node: operario }
          to: { node: terminal }
          dataClass: public
        - id: terminal-gw
          from: { node: terminal }
          to: { node: gw }
          dataClass: public
        - id: gw-fichas
          from: { node: gw }
          to: { node: fichas }
          dataClass: public
        - id: fichas-archivo
          from: { node: fichas }
          to: { node: archivo }
          dataClass: public
        - id: sincronizador-archivo
          from: { node: sincronizador }
          to: { node: archivo }
          dataClass: public
        - id: sincronizador-catalogo
          from: { node: sincronizador }
          to: { node: catalogo }
          dataClass: public
status: PILOT
---

La misma planta. Cien metros más allá del área restringida: **el depósito de
reactivos**.

Cuando hay un derrame, y hay **tres por mes**, el operario escanea el código del
bidón en la terminal y la pantalla le dice qué hacer: qué absorbente usar, qué
elementos de protección ponerse, qué no mezclar nunca con eso. El servicio de
fichas de seguridad se lo pregunta al catálogo del proveedor químico en el
momento.

El catálogo del proveedor es una web con inicio de sesión y **sin acuerdo de
nivel de servicio**. Cae sin aviso, entre veinte minutos y dos horas, unas cuatro
veces por trimestre. No hay a quién reclamarle.

Cuando cae, la terminal no muestra una ficha vieja. Muestra nada. Y el operario
no espera con el líquido en el piso: improvisa con lo que recuerda, o le pregunta
al de al lado. Los tres derrames del mes pasado se atendieron así. En uno se usó
el absorbente equivocado.

Después de lo de la puerta del área restringida, el equipo llega a este problema
con desconfianza. Ahí la copia mentía; acá parece la misma copia.

No es la misma. Una ficha de seguridad cambia **como mucho dos veces por año**, y
cuando cambia es por una revisión normativa que se anuncia con meses de
anticipación. Nunca cambia de un día para el otro por algo que acaba de pasar.

Y sobre todo: **mostrar una ficha no autoriza nada**. No abre una puerta, no
habilita a nadie, no compromete plata. Le da información a una persona que va a
decidir igual, con ficha o sin ficha. Una ficha de hace un mes es mejor
información que la memoria de alguien a las tres de la mañana.

La responsable de higiene y seguridad lo cierra así: *"La ficha de marzo dice lo
mismo que la de hoy. Lo que no dice lo mismo es una pantalla en blanco."*

El equipo tiene **5 unidades operativas** y hoy usa 2.

**Rearmá el depósito** para que la terminal pueda mostrar la última ficha
conocida sin depender del catálogo del proveedor, para que esa copia se siga
actualizando cuando el catálogo vuelve, y para que sea el servicio que atiende la
terminal, y no una pieza al costado, el que la lea.
