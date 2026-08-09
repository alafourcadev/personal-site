---
title: "El día de la declaración"
level: 7
role: synthesis
domain: gobierno
D1: 3
D2: 3
D3: 3
D4: 2
D5: 3
D6: 4
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que separar el tráfico en tres: el que hay que atender, el que se puede diferir y el que no hay que atender nunca. Un diseño que trata a los tres igual no leyó el problema."
lambda: 2.5
constraints:
  - metric: declaraciones presentadas en las últimas 48 horas del plazo
    operator: ">="
    value: 620000
    unit: declaraciones
  - metric: visitas a las páginas de ayuda en esas mismas 48 horas
    operator: ">="
    value: 4100000
    unit: visitas
  - metric: presupuesto operativo del organismo (techo duro)
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "las páginas de ayuda son 38 documentos que se aprueban en enero y no se tocan hasta el enero siguiente. El servicio que las sirve consulta la base en cada visita para traer el mismo texto."
    discoveryPath: "preguntá cuándo cambió por última vez lo que estás sirviendo. Un documento que cambia una vez al año no necesita un proceso vivo que lo busque cuatro millones de veces en dos días."
  - fact: "el comprobante en PDF tarda entre seis y catorce segundos porque incluye el detalle completo de la declaración con el sello temporal. El contribuyente no lo necesita en el momento: lo necesita cuando se lo pide alguien, semanas después."
    discoveryPath: "separá lo que el usuario necesita antes de irse de lo que necesita alguna vez. La declaración presentada es lo primero; el papel que la prueba es lo segundo, y no tienen por qué salir del mismo pedido."
  - fact: "la caché de ayuda entró hace dos años. Guarda copias de las páginas más visitadas y hoy es una de las siete piezas que el organismo mantiene despiertas todo el año para un problema que dura 48 horas."
    discoveryPath: "sumá las unidades operativas del sistema que te entregan y compará con el presupuesto. Empezás debiendo una, y la pieza que te sobra es la que resuelve el problema de un modo caro."
  - fact: "el organismo no puede contratar. El presupuesto operativo es una decisión presupuestaria del año anterior, no una negociación con el equipo."
    discoveryPath: "probá una respuesta que se pase del presupuesto: el motor te muestra exactamente cuántos puntos cuesta el sobrepaso. Acá el techo no es una meta de prolijidad, es el límite dentro del cual existe el diseño."
startingDesign:
  nodes:
    - id: contribuyente
      type: web-client
      label: Portal del contribuyente
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: declaracion
      type: service
      label: Servicio de declaraciones
      zone: private
      role: declaracion-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: ayuda
      type: service
      label: Servicio de páginas de ayuda
      zone: private
      role: ayuda-service
      given: true
      props: { criticality: "medium", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 630 }
    - id: validacion
      type: service
      label: Servicio de validación fiscal
      zone: private
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: comprobantes
      type: service
      label: Servicio de comprobantes en PDF
      zone: private
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 520 }
    - id: registro
      type: database
      label: Registro fiscal
      zone: restricted
      role: registro-fiscal
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: cacheayuda
      type: cache
      label: Caché de páginas de ayuda
      zone: private
      given: true
      props: { ttl: "300", eviction: "lru" }
      position: { x: 805, y: 630 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 410 }
  edges:
    - id: contribuyente-gw
      from: { node: contribuyente }
      to: { node: gw }
      dataClass: personal
    - id: gw-declaracion
      from: { node: gw }
      to: { node: declaracion }
      dataClass: personal
    - id: gw-ayuda
      from: { node: gw }
      to: { node: ayuda }
      dataClass: public
    - id: declaracion-validacion
      from: { node: declaracion }
      to: { node: validacion }
      dataClass: personal
    - id: validacion-registro
      from: { node: validacion }
      to: { node: registro }
      dataClass: regulated
    - id: declaracion-comprobantes
      from: { node: declaracion }
      to: { node: comprobantes }
      dataClass: personal
    - id: comprobantes-registro
      from: { node: comprobantes }
      to: { node: registro }
      dataClass: regulated
    - id: ayuda-cacheayuda
      from: { node: ayuda }
      to: { node: cacheayuda }
      dataClass: public
    - id: declaracion-obs
      from: { node: declaracion }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-declaracion-registrada
    label: la declaración presentada llega al registro fiscal
    weight: 2
    predicate:
      op: path
      from:
        role: declaracion-service
      to:
        role: registro-fiscal
    whyMissing: no hay ningún camino desde el servicio de declaraciones hasta el registro fiscal.
    consequence: "una declaración que no llega al registro no está presentada, por más que el portal haya dicho que sí. El contribuyente cumplió el plazo y el organismo no tiene con qué probarlo."
  - id: g-comprobante-diferido
    label: el comprobante se arma fuera del pedido y queda guardado como archivo
    weight: 3
    predicate:
      op: path
      from:
        role: declaracion-service
      to:
        type: [object-storage]
      via:
        type: [queue, stream]
    whyMissing: el camino desde el servicio de declaraciones hasta un almacén de archivos no pasa por ninguna pieza donde el trabajo pueda esperar su turno, o no hay ningún almacén donde dejar el comprobante.
    consequence: "catorce segundos de armado de PDF dentro del pedido, multiplicados por 620.000 presentaciones en 48 horas, no agotan el procesador: agotan las conexiones. Se cae también la presentación, que es lo único que el plazo obliga a hacer hoy."
  - id: g-ayuda-fuera-del-sistema
    label: las páginas de ayuda se sirven desde una red de distribución y ya no pasan por la puerta de entrada
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [cdn]
        - op: edgeAbsent
          from:
            type: [api-gateway]
          to:
            role: ayuda-service
    whyMissing: no hay una red de distribución en el diseño, o la puerta de entrada sigue llamando al servicio de ayuda.
    consequence: "4.100.000 visitas para leer 38 documentos que se aprobaron en enero. Ese tráfico entra por la misma puerta que las presentaciones y compite con ellas por los mismos procesos: la ayuda sobre cómo declarar termina impidiendo declarar."
  - id: g-presentacion-entra
    label: el contribuyente sigue llegando al servicio de declaraciones
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: declaracion-service
    whyMissing: no hay ningún camino desde el portal del contribuyente hasta el servicio de declaraciones.
    consequence: "el plazo vence igual. Un portal que no recibe presentaciones no ahorra unidades operativas: transfiere 620.000 trámites a las oficinas de atención al público y a una prórroga por resolución."
  - id: g-declaracion-observada
    label: el organismo ve las 48 horas mientras pasan
    weight: 1
    predicate:
      op: covered
      target:
        role: declaracion-service
      by:
        type: [observability]
    whyMissing: el servicio de declaraciones no está conectado a ningún componente de monitoreo.
    consequence: "el plazo vence una vez al año y dura 48 horas. Si te enterás al día siguiente, lo que te queda no es un incidente: es una prórroga por resolución y una nota en el diario."
rubric:
  - dimension: lo que el plazo obliga a hacer se hace
    signal:
      kind: predicate
      guaranteeId: g-declaracion-registrada
  - dimension: el trabajo largo salió del camino del pedido
    signal:
      kind: predicate
      guaranteeId: g-comprobante-diferido
  - dimension: el tráfico que no había que atender no entra
    signal:
      kind: predicate
      guaranteeId: g-ayuda-fuera-del-sistema
  - dimension: la puerta por la que se presenta sigue abierta
    signal:
      kind: predicate
      guaranteeId: g-presentacion-entra
  - dimension: las 48 horas son visibles mientras ocurren
    signal:
      kind: predicate
      guaranteeId: g-declaracion-observada
  - dimension: el diseño entra en el presupuesto operativo del organismo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 7
      unit: unidades operativas
referenceSolutions:
  - label: siete piezas, con la validación fiscal separada
    contextInversion: "conservar la validación fiscal como componente propio es lo correcto cuando las reglas fiscales las escribe otra área y cambian por resolución en mitad del plazo: ese componente se puede desplegar sin tocar el servicio que está recibiendo 620.000 presentaciones, que es exactamente lo que no querés tocar un 30 de abril. Gastás las siete unidades completas, sin margen. Se paga con un salto de red en cada presentación y con que la disponibilidad de la presentación pasa a depender de dos componentes en vez de uno."
    design:
      nodes:
        - id: contribuyente
          type: web-client
          label: Portal del contribuyente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: declaracion
          type: service
          label: Servicio de declaraciones
          zone: private
          role: declaracion-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: validacion
          type: service
          label: Servicio de validación fiscal
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: Cola de comprobantes pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: emisor
          type: worker
          label: Emisor de comprobantes
          zone: private
        - id: registro
          type: database
          label: Registro fiscal
          zone: restricted
          role: registro-fiscal
          props: { backup: "diario" }
        - id: archivos
          type: object-storage
          label: Almacén de comprobantes
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
        - id: contribuyente-gw
          from: { node: contribuyente }
          to: { node: gw }
          dataClass: personal
        - id: gw-declaracion
          from: { node: gw }
          to: { node: declaracion }
          dataClass: personal
        - id: declaracion-validacion
          from: { node: declaracion }
          to: { node: validacion }
          dataClass: personal
        - id: validacion-registro
          from: { node: validacion }
          to: { node: registro }
          dataClass: regulated
        - id: declaracion-cola
          from: { node: declaracion }
          to: { node: cola }
          dataClass: personal
        - id: cola-emisor
          from: { node: cola }
          to: { node: emisor }
          dataClass: personal
        - id: emisor-registro
          from: { node: emisor }
          to: { node: registro }
          dataClass: regulated
        - id: emisor-archivos
          from: { node: emisor }
          to: { node: archivos }
          dataClass: regulated
        - id: archivos-distribucion
          from: { node: archivos }
          to: { node: distribucion }
          dataClass: public
        - id: declaracion-obs
          from: { node: declaracion }
          to: { node: obs }
          dataClass: public
        - id: cola-obs
          from: { node: cola }
          to: { node: obs }
          dataClass: public
  - label: seis piezas, con la validación adentro y un registro de eventos
    contextInversion: "plegar la validación fiscal dentro del servicio de declaraciones es lo correcto cuando las reglas cambian una vez al año junto con el resto del formulario: no hay nada que desplegar por separado, y la presentación deja de depender de que un segundo componente esté vivo. La unidad operativa que te ahorrás es margen real: el organismo no puede contratar, así que un lugar libre en el presupuesto es la única capacidad de reacción que tiene. Un registro de eventos, además, deja volver a emitir los comprobantes de las 48 horas releyendo lo que pasó, cosa que una cola ya consumida no permite. Se paga con que una corrección de reglas obliga a desplegar el servicio que está recibiendo las presentaciones."
    design:
      nodes:
        - id: contribuyente
          type: web-client
          label: Portal del contribuyente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: declaracion
          type: service
          label: Servicio de declaraciones
          zone: private
          role: declaracion-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: eventos
          type: stream
          label: Registro de presentaciones
          zone: private
          props: { retention: "30d", partitions: "3", ordering: "sí" }
        - id: emisor
          type: service
          label: Servicio emisor de comprobantes
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: registro
          type: database
          label: Registro fiscal
          zone: restricted
          role: registro-fiscal
          props: { backup: "diario" }
        - id: archivos
          type: object-storage
          label: Almacén de comprobantes
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
        - id: contribuyente-gw
          from: { node: contribuyente }
          to: { node: gw }
          dataClass: personal
        - id: gw-declaracion
          from: { node: gw }
          to: { node: declaracion }
          dataClass: personal
        - id: declaracion-registro
          from: { node: declaracion }
          to: { node: registro }
          dataClass: regulated
        - id: declaracion-eventos
          from: { node: declaracion }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-emisor
          from: { node: eventos }
          to: { node: emisor }
          dataClass: personal
        - id: emisor-archivos
          from: { node: emisor }
          to: { node: archivos }
          dataClass: regulated
        - id: archivos-distribucion
          from: { node: archivos }
          to: { node: distribucion }
          dataClass: public
        - id: declaracion-obs
          from: { node: declaracion }
          to: { node: obs }
          dataClass: public
        - id: eventos-obs
          from: { node: eventos }
          to: { node: obs }
          dataClass: public
status: PILOT
---

El organismo tributario tiene plazo hasta el 30 de abril. En las **últimas 48
horas** entran **620.000 declaraciones**, el 55 % de todo el año, y
**4.100.000 visitas a las páginas de ayuda**.

El año pasado el portal estuvo intermitente durante nueve horas y el plazo
se prorrogó por resolución. La nota del diario decía "la web del organismo
no aguantó". El informe interno decía otra cosa: los procesos estaban
ocupados armando comprobantes en PDF y buscando en la base el mismo texto de
ayuda, cuatro millones de veces.

El sistema son ocho piezas despiertas todo el año y **el presupuesto
operativo es siete**. Ese número no se negocia con el equipo: es una decisión
presupuestaria del año anterior. El organismo no puede contratar.

Tres cosas están sobre la mesa y ninguna es una opinión:

- Las páginas de ayuda son **38 documentos aprobados en enero** que no se
  tocan hasta el enero siguiente.
- El comprobante en PDF tarda **entre 6 y 14 segundos** y el contribuyente lo
  necesita semanas después, no antes de irse.
- La declaración presentada tiene que llegar al registro fiscal **hoy**,
  porque el plazo es hoy.

Es el mismo tipo de decisión que venís tomando en todo el nivel, junta:
tráfico que hay que atender, tráfico que se puede diferir y tráfico que no
hay que atender nunca. Lo único nuevo es que ahora están los tres a la vez y
el presupuesto ya está en rojo antes de que empieces.

**Rearmá el sistema para que las 620.000 declaraciones entren, dentro de las
siete unidades operativas.** Empezás debiendo una.
