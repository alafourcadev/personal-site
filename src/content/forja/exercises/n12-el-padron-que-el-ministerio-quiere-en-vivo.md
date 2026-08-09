---
title: "El padrón que el ministerio quiere consultar en vivo"
level: 12
role: core
domain: gobierno
D1: 3
D2: 4
D3: 4
D4: 3
D5: 3
D6: 4
D7: 2
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 6
aiBudget: "libre. Pero la frase que vas a tener que decir en la reunión no la escribe un modelo: 'no' con un diseño al lado es una posición técnica; 'no' solo es una traba administrativa, y a las trabas administrativas las pasan por encima."
lambda: 4.0
constraints:
  - metric: personas en el padrón de beneficiarios
    operator: ">="
    value: 2100000
    unit: personas
  - metric: plazo comprometido con el ministerio para cada cruce de datos
    operator: "<="
    value: 24
    unit: horas
  - metric: presupuesto operativo del equipo del organismo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el ministerio no necesita el padrón: necesita responder si una persona determinada ya cobra un beneficio. Nunca nadie le preguntó qué iba a hacer con el acceso, y cuando se le preguntó, la respuesta cabía en una consulta."
    discoveryPath: "la garantía del ejercicio no te pide cortar el acceso: te pide que entre tu sistema y el ministerio haya una pieza tuya. Esa pieza es donde vive la diferencia entre entregar el padrón y responder una pregunta."
  - fact: "el subsecretario propuso 'una réplica de lectura, es una sola pieza'. Una réplica de lectura del padrón entera es el padrón entero, con la diferencia de que ahora está en dos lugares y sólo controlás uno."
    discoveryPath: "probá a conectar el padrón a algo que no controles y mirá el presupuesto: la pieza que él llama 'una sola' cuesta lo mismo que la pieza que resuelve el problema de verdad, y hace lo contrario."
  - fact: "el organismo tuvo una filtración en 2021 por un acceso directo concedido a otro organismo. El informe interno nunca se publicó y la mitad de la mesa actual no sabe que existió."
    discoveryPath: "es la razón por la que este ejercicio pide que el camino hacia afuera atraviese una pieza durable: sin registro de qué se entregó y cuándo, una filtración no se investiga, se conjetura."
startingDesign:
  nodes:
    - id: ciudadano
      type: actor
      label: Ciudadano
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de beneficios
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: beneficios
      type: service
      label: Servicio de beneficios
      zone: private
      role: benefits-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: padron
      type: database
      label: Padrón de beneficiarios
      zone: restricted
      role: registry
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: ministerio
      type: external-party
      label: Ministerio solicitante
      zone: dmz
      role: ministry
      given: true
      props: { contract: "sí", availability: "99.0" }
      position: { x: 85, y: 190 }
  edges:
    - id: ciudadano-portal
      from: { node: ciudadano }
      to: { node: portal }
      dataClass: personal
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-beneficios
      from: { node: gw }
      to: { node: beneficios }
      dataClass: personal
    - id: beneficios-padron
      from: { node: beneficios }
      to: { node: padron }
      dataClass: regulated
    - id: beneficios-ministerio
      from: { node: beneficios }
      to: { node: ministerio }
      dataClass: regulated
guarantees:
  - id: g-no-live-registry
    label: entre el servicio de beneficios y el ministerio hay una pieza tuya
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            role: benefits-service
          to:
            role: ministry
        - op: edgeAbsent
          from:
            role: benefits-service
          to:
            role: ministry
    whyMissing: "o el servicio de beneficios le responde directo al ministerio, o el ministerio ya no recibe nada. Cortar el acceso no es la respuesta: el convenio existe y el cruce de datos es legítimo."
    consequence: "sin una pieza propia en el medio, lo que el ministerio recibe es lo que el servicio sepa responder, que es el padrón consultado a voluntad. Con esa pieza, lo que sale es lo que vos decidiste entregar, y el alcance de la entrega se lee en el diseño en vez de estar escrito en un convenio que nadie relee."
  - id: g-export-durable
    label: lo que sale hacia afuera atraviesa una pieza que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: benefits-service
      to:
        role: ministry
    whyMissing: el camino desde el servicio de beneficios hasta el ministerio no atraviesa ninguna pieza durable.
    consequence: "una entrega que sólo existió en memoria no deja rastro de qué se entregó ni cuándo. En 2021 este organismo tuvo una filtración por un acceso directo concedido a otro organismo, y la investigación terminó en conjeturas porque no había registro de las consultas."
  - id: g-services-observed
    label: todos los servicios del organismo reportan lo que les pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: "el que entrega datos hacia afuera es justo el que más hay que mirar. Un pico de entregas a las tres de la mañana es la única señal temprana que vas a tener de que el convenio se está usando para algo que nadie acordó."
rubric:
  - dimension: el alcance de lo que sale está en el diseño, no en un convenio
    signal:
      kind: predicate
      guaranteeId: g-no-live-registry
  - dimension: cada entrega deja rastro
    signal:
      kind: predicate
      guaranteeId: g-export-durable
  - dimension: el camino hacia afuera es el más observado del sistema
    signal:
      kind: predicate
      guaranteeId: g-services-observed
  - dimension: el diseño entra en el presupuesto operativo del organismo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: cola de cruces y servicio de entrega
    contextInversion: "la cola con un servicio de entrega se defiende cuando el cruce es por lote y con plazo: el convenio dice 24 horas, no 24 milisegundos, y una cola convierte cada pedido del ministerio en un ítem de trabajo que se atiende, se registra y se responde. Al subsecretario le decís que su réplica de lectura y esta cola cuestan exactamente lo mismo en operación, una unidad, y que la diferencia es qué recibe el ministerio: con la réplica recibe 2,1 millones de personas, con esto recibe la respuesta a la pregunta que hizo. Lo que aceptás a cambio: el ministerio va a esperar horas donde quería segundos, y va a escalar la queja, probablemente por encima tuyo."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: portal
          type: web-client
          label: Portal de beneficios
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: beneficios
          type: service
          label: Servicio de beneficios
          zone: private
          role: benefits-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: padron
          type: database
          label: Padrón de beneficiarios
          zone: restricted
          role: registry
          props: { backup: "diario", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de pedidos de cruce
          zone: private
          props: { delivery: "at-least-once", dlq: "no", ordering: "no" }
        - id: entrega
          type: service
          label: Servicio de entrega al ministerio
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: ministerio
          type: external-party
          label: Ministerio solicitante
          zone: dmz
          role: ministry
          props: { contract: "sí", availability: "99.0" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: ciudadano-portal
          from: { node: ciudadano }
          to: { node: portal }
          dataClass: personal
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-beneficios
          from: { node: gw }
          to: { node: beneficios }
          dataClass: personal
        - id: beneficios-padron
          from: { node: beneficios }
          to: { node: padron }
          dataClass: regulated
        - id: beneficios-cola
          from: { node: beneficios }
          to: { node: cola }
          dataClass: regulated
        - id: cola-entrega
          from: { node: cola }
          to: { node: entrega }
          dataClass: regulated
        - id: entrega-ministerio
          from: { node: entrega }
          to: { node: ministerio }
          dataClass: regulated
        - id: beneficios-monitoreo
          from: { node: beneficios }
          to: { node: monitoreo }
          dataClass: public
        - id: entrega-monitoreo
          from: { node: entrega }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: registro releíble, servicio de entrega y copia de lo entregado
    contextInversion: "el registro releíble con copia de lo entregado se defiende cuando la pregunta que vas a tener que responder no es del ministerio sino de un juez: qué se entregó exactamente, a quién y en qué fecha. La copia de lo entregado no cuesta unidad operativa, porque un archivo no se opera y se paga por lo que ocupa, así que por el mismo presupuesto pasás de tener un registro de que hubo una entrega a tener la entrega misma. Al área legal le mostrás que la investigación de 2021 hoy sería una consulta al archivo. Lo que aceptás a cambio: guardás copias de datos personales que ahora hay que retener, clasificar y borrar con un criterio, y eso es trabajo que alguien va a tener que hacer todos los meses."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: portal
          type: web-client
          label: Portal de beneficios
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: beneficios
          type: service
          label: Servicio de beneficios
          zone: private
          role: benefits-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: padron
          type: database
          label: Padrón de beneficiarios
          zone: restricted
          role: registry
          props: { backup: "diario", consistency: "strong" }
        - id: registro
          type: stream
          label: Registro de pedidos de cruce
          zone: private
          props: { retention: "30d", partitions: "3", ordering: "sí" }
        - id: entrega
          type: service
          label: Servicio de entrega al ministerio
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: entregado
          type: object-storage
          label: Copia de lo entregado
          zone: private
          props: { durability: "99.999999999", access: "signed" }
        - id: ministerio
          type: external-party
          label: Ministerio solicitante
          zone: dmz
          role: ministry
          props: { contract: "sí", availability: "99.0" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: ciudadano-portal
          from: { node: ciudadano }
          to: { node: portal }
          dataClass: personal
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-beneficios
          from: { node: gw }
          to: { node: beneficios }
          dataClass: personal
        - id: beneficios-padron
          from: { node: beneficios }
          to: { node: padron }
          dataClass: regulated
        - id: beneficios-registro
          from: { node: beneficios }
          to: { node: registro }
          dataClass: regulated
        - id: registro-entrega
          from: { node: registro }
          to: { node: entrega }
          dataClass: regulated
        - id: entrega-entregado
          from: { node: entrega }
          to: { node: entregado }
          dataClass: regulated
        - id: entrega-ministerio
          from: { node: entrega }
          to: { node: ministerio }
          dataClass: regulated
        - id: beneficios-monitoreo
          from: { node: beneficios }
          to: { node: monitoreo }
          dataClass: public
        - id: entrega-monitoreo
          from: { node: entrega }
          to: { node: monitoreo }
          dataClass: public
        - id: registro-monitoreo
          from: { node: registro }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Un organismo que administra beneficios sociales para **2,1 millones de
personas**. Hay un convenio firmado con un ministerio que necesita cruzar
datos, y el convenio es legítimo: el cruce evita que la misma persona cobre
dos veces el mismo beneficio por dos vías distintas.

La forma en que el sistema resuelve hoy ese convenio es la más corta
posible: el servicio de beneficios le responde al ministerio. Sin
intermediarios, sin registro, sin límite.

El subsecretario quiere avanzar más y su propuesta suena razonable: *"una
réplica de lectura del padrón, es una sola pieza"*. Y es cierto que es una
sola pieza. También es cierto que **una réplica de lectura del padrón es el
padrón**, con la diferencia de que ahora está en dos lugares y sólo
controlás uno.

Hay algo que nadie preguntó en tres reuniones: **qué necesita responder el
ministerio**. Cuando se preguntó, la respuesta cabía en una consulta: si una
persona determinada ya cobra un beneficio. Sí o no. El plazo comprometido es
de **24 horas**, no de 24 milisegundos.

Y hay algo que la mitad de la mesa no sabe. En 2021 este organismo tuvo una
filtración por un acceso directo concedido a otro organismo. La
investigación terminó en conjeturas porque **no había registro de las
consultas**. El informe interno nunca se publicó.

El equipo del organismo sostiene **seis piezas**.

**Armá el sistema** para que entre el servicio de beneficios y el ministerio
haya una pieza tuya, para que lo que sale hacia afuera atraviese algo que
sobreviva a un reinicio, y para que todos los servicios reporten lo que les
pasa. Después vas a tener que decirle al subsecretario que su réplica y tu
pieza cuestan lo mismo, y que hacen lo contrario.
