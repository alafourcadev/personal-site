---
title: "Las diez mil etiquetas de la madrugada"
level: 7
role: tradeoff
domain: logistica
tradeoffPairId: n7-el-trabajo-que-contesta-ahora
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
aiBudget: "libre, pero tu respuesta tiene que decir quién está esperando la respuesta y cuánto tiempo tiene. Si nadie está esperando, decilo con esas palabras: es la mitad del razonamiento."
lambda: 2.5
constraints:
  - metric: envíos cargados por un cliente mayorista en un solo lote
    operator: ">="
    value: 10000
    unit: envíos
  - metric: tiempo hasta que el cliente necesita las etiquetas impresas
    operator: ">="
    value: 5
    unit: horas
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "armar una etiqueta tarda entre 200 y 900 milisegundos: hay que resolver la zona de reparto, calcular el código de barras y componer el PDF. Diez mil etiquetas en una sola llamada son entre 33 minutos y dos horas y media con el pedido abierto."
    discoveryPath: "multiplicá el tiempo de una unidad por el tamaño del lote antes de decidir dónde corre el trabajo. Un trabajo que dura más que cualquier tiempo de espera razonable no es un trabajo lento: es un trabajo que está en el lugar equivocado."
  - fact: "los clientes mayoristas cargan sus lotes entre la una y las cuatro de la madrugada, con un proceso automático. El primer camión sale a las nueve. Nadie mira la pantalla mientras se generan las etiquetas: la operación arranca cinco horas después."
    discoveryPath: "preguntá quién está del otro lado esperando la respuesta y a qué hora la necesita. Acá no hay nadie: hay un proceso automático que sube un archivo y se va."
  - fact: "la semana pasada un lote de 12.000 envíos cortó a los 41 minutos por tiempo de espera agotado. El cliente lo reintentó entero y se generaron 4.800 etiquetas duplicadas, con sus 4.800 envíos duplicados en el registro."
    discoveryPath: "seguí qué hace el cliente cuando el pedido largo se corta. Reintenta el lote completo, porque no tiene forma de saber hasta dónde llegó, y cada reintento vuelve a hacer todo el trabajo que ya estaba hecho."
  - fact: "el equipo mira este sistema con el diseño de la planta de clasificación en la cabeza, donde una cola sería un desastre. Es la misma empresa y el mismo equipo, pero acá no hay ninguna cinta moviéndose."
    discoveryPath: "compará este ejercicio con el otro del par. La forma correcta de resolverlo se invierte y la única diferencia es si hay alguien, o algo, esperando la respuesta del otro lado."
startingDesign:
  nodes:
    - id: cliente
      type: web-client
      label: Portal del cliente mayorista
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: despacho
      type: service
      label: Servicio de despacho
      zone: private
      role: despacho-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: etiquetas
      type: service
      label: Servicio de armado de etiquetas
      zone: private
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: envios
      type: database
      label: Registro de envíos
      zone: restricted
      role: registro-envios
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: cliente-gw
      from: { node: cliente }
      to: { node: gw }
      dataClass: personal
    - id: gw-despacho
      from: { node: gw }
      to: { node: despacho }
      dataClass: personal
    - id: despacho-etiquetas
      from: { node: despacho }
      to: { node: etiquetas }
      dataClass: personal
    - id: etiquetas-envios
      from: { node: etiquetas }
      to: { node: envios }
      dataClass: personal
    - id: despacho-obs
      from: { node: despacho }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-lote-diferido
    label: las etiquetas se arman fuera del pedido y quedan guardadas como archivos
    weight: 4
    predicate:
      op: path
      from:
        role: despacho-service
      to:
        type: [object-storage]
      via:
        type: [queue, stream]
    whyMissing: el camino desde el servicio de despacho hasta un almacén de archivos no pasa por ninguna pieza donde el trabajo pueda esperar su turno, o directamente no hay almacén donde dejar las etiquetas.
    consequence: "diez mil etiquetas de hasta 900 milisegundos cada una dentro de un solo pedido son horas con la conexión abierta. Lo que se agota no es el procesador: es el tiempo de espera del cliente, que corta y reintenta el lote entero porque no tiene forma de saber hasta dónde llegó. Cada reintento duplica el trabajo hecho y los envíos ya registrados."
  - id: g-envio-registrado
    label: cada envío del lote queda escrito en algo que sobrevive a un reinicio
    weight: 1
    predicate:
      op: noVolatileCut
      from:
        role: despacho-service
      to:
        role: registro-envios
    whyMissing: entre el servicio de despacho y el registro de envíos no queda ninguna pieza que sobreviva a un reinicio, o directamente no hay camino entre los dos.
    consequence: "mover el trabajo de lugar no puede significar dejar de anotarlo. Un envío que se etiquetó y no quedó registrado es un paquete con código de barras que el sistema no reconoce cuando entra a la planta."
  - id: g-cliente-entra
    label: el cliente mayorista sigue pudiendo cargar su lote
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: despacho-service
    whyMissing: no hay ningún camino desde el portal del cliente mayorista hasta el servicio de despacho.
    consequence: "sacar el trabajo largo del pedido no puede terminar cerrando la puerta por la que entra el trabajo. Un lote que no se puede cargar no es un lote barato: son diez mil envíos que alguien va a cargar de otra manera, casi siempre por correo electrónico y a mano."
  - id: g-despacho-observado
    label: el equipo ve la madrugada mientras pasa
    weight: 1
    predicate:
      op: covered
      target:
        role: despacho-service
      by:
        type: [observability]
    whyMissing: el servicio de despacho no está conectado a ningún componente de monitoreo.
    consequence: "el trabajo diferido tiene una trampa propia: cuando se atrasa, no se ve. La pantalla dice que el lote se aceptó y las etiquetas simplemente no aparecen. Sin señal en vivo, el primero en enterarse es el camión de las nueve."
rubric:
  - dimension: el trabajo largo salió del camino del pedido
    signal:
      kind: predicate
      guaranteeId: g-lote-diferido
  - dimension: cada envío del lote quedó anotado
    signal:
      kind: predicate
      guaranteeId: g-envio-registrado
  - dimension: el lote sigue teniendo por dónde entrar
    signal:
      kind: predicate
      guaranteeId: g-cliente-entra
  - dimension: el atraso del trabajo diferido es visible
    signal:
      kind: predicate
      guaranteeId: g-despacho-observado
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: cola, procesador de fondo y las etiquetas como archivos
    contextInversion: "una cola con un procesador de fondo es lo correcto cuando lo único que importa es que el trabajo se haga antes de las nueve y nadie va a preguntar nada mientras tanto: el cliente sube el lote, recibe el acuse en el momento y se va. Es la variante más barata de operar porque el procesador no expone nada, no necesita puerta de entrada y no puede recibir tráfico por accidente. Se paga con que un mensaje consumido no se puede volver a leer: si descubrís a las siete de la mañana que las etiquetas salieron con la zona de reparto vieja, no tenés de dónde regenerarlas y hay que pedirle al cliente que vuelva a subir el lote."
    design:
      nodes:
        - id: cliente
          type: web-client
          label: Portal del cliente mayorista
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: despacho
          type: service
          label: Servicio de despacho
          zone: private
          role: despacho-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: Cola de lotes pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí", ordering: "no" }
        - id: generador
          type: worker
          label: Generador de etiquetas
          zone: private
        - id: envios
          type: database
          label: Registro de envíos
          zone: restricted
          role: registro-envios
          props: { backup: "diario" }
        - id: archivos
          type: object-storage
          label: Etiquetas generadas
          zone: private
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-gw
          from: { node: cliente }
          to: { node: gw }
          dataClass: personal
        - id: gw-despacho
          from: { node: gw }
          to: { node: despacho }
          dataClass: personal
        - id: despacho-cola
          from: { node: despacho }
          to: { node: cola }
          dataClass: personal
        - id: cola-generador
          from: { node: cola }
          to: { node: generador }
          dataClass: personal
        - id: generador-envios
          from: { node: generador }
          to: { node: envios }
          dataClass: personal
        - id: generador-archivos
          from: { node: generador }
          to: { node: archivos }
          dataClass: personal
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
          dataClass: public
        - id: cola-obs
          from: { node: cola }
          to: { node: obs }
          dataClass: public
  - label: un registro de eventos y la descarga desde la red de distribución
    contextInversion: "un registro de eventos en vez de una cola es lo correcto cuando querés poder volver a generar un lote entero sin molestar al cliente: los eventos siguen ahí después de consumidos, así que a las siete de la mañana podés reprocesar la madrugada completa con la zona de reparto corregida. Sacar la descarga a una red de distribución además saca de tu infraestructura las diez mil bajadas de PDF, que llegan todas juntas cuando el cliente abre su panel. Se paga en retención, porque los eventos ocupan lugar aunque nadie los vuelva a leer, y en que el archivo queda accesible por una dirección firmada que vos no controlás bajada por bajada: la caducidad del enlace es la única barrera que te queda."
    design:
      nodes:
        - id: cliente
          type: web-client
          label: Portal del cliente mayorista
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: despacho
          type: service
          label: Servicio de despacho
          zone: private
          role: despacho-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: eventos
          type: stream
          label: Registro de lotes recibidos
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: generador
          type: worker
          label: Generador de etiquetas
          zone: private
        - id: envios
          type: database
          label: Registro de envíos
          zone: restricted
          role: registro-envios
          props: { backup: "diario" }
        - id: archivos
          type: object-storage
          label: Etiquetas generadas
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
          dataClass: personal
        - id: gw-despacho
          from: { node: gw }
          to: { node: despacho }
          dataClass: personal
        - id: despacho-eventos
          from: { node: despacho }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-generador
          from: { node: eventos }
          to: { node: generador }
          dataClass: personal
        - id: generador-envios
          from: { node: generador }
          to: { node: envios }
          dataClass: personal
        - id: generador-archivos
          from: { node: generador }
          to: { node: archivos }
          dataClass: personal
        - id: archivos-distribucion
          from: { node: archivos }
          to: { node: distribucion }
          dataClass: personal
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
          dataClass: public
        - id: eventos-obs
          from: { node: eventos }
          to: { node: obs }
          dataClass: public
status: PILOT
---

La misma empresa de logística, la misma noche, la otra punta: el **portal
mayorista**. Entre la una y las cuatro de la madrugada, los clientes grandes
suben sus lotes. Uno solo carga **diez mil envíos** de una vez, con un proceso
automático que sube el archivo y se desconecta.

Cada etiqueta tarda entre 200 y 900 milisegundos: resolver la zona de
reparto, calcular el código de barras, componer el PDF. Diez mil etiquetas
son entre media hora y dos horas y media de trabajo. Hoy eso pasa **dentro
del pedido**.

La semana pasada un lote de 12.000 cortó a los 41 minutos por tiempo de
espera agotado. El cliente lo reintentó entero, porque no tenía forma de saber hasta
dónde había llegado, y quedaron **4.800 etiquetas duplicadas**, con sus 4.800
envíos duplicados en el registro.

El equipo llega a esta reunión con la planta de clasificación fresca en la
cabeza, donde meter una cola sería un desastre. Es la misma empresa, el mismo
equipo y la misma pregunta. Pero acá hay algo que allá no había: **el primer
camión sale a las nueve**, y entre las cuatro y las nueve no hay nadie
esperando nada.

El sistema son cinco piezas despiertas y **el presupuesto es seis**: tenés una
unidad disponible, no dos.

**Sacá el armado de etiquetas del camino del pedido, sin pasarte de seis
unidades operativas y sin dejar de registrar un solo envío.** El trabajo no
desaparece: cambia de lugar, y de paso deja un resultado que se puede volver a
entregar sin volver a hacerlo.
