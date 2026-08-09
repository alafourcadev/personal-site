---
title: "El día de la matrícula"
level: 7
role: core
domain: educacion
D1: 2
D2: 3
D3: 3
D4: 2
D5: 2
D6: 4
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que nombrar las dos piezas que sacaste y decir qué se pierde con cada una. El presupuesto no se mueve: sólo se puede cambiar en qué se gasta."
lambda: 2.0
constraints:
  - metric: estudiantes inscribiéndose en la primera hora
    operator: ">="
    value: 41000
    unit: estudiantes
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 6
    unit: unidades operativas
  - metric: duración del pico
    operator: "<="
    value: 3
    unit: horas
hiddenFacts:
  - fact: "la caché de cupos tiene 300 segundos de vida. En el día de la matrícula, un cupo dura menos de dos segundos: la caché no está acelerando lecturas, está mostrando cupos que ya no existen."
    discoveryPath: "mirá el número que la caché guarda y el ritmo al que cambia el dato real. Una caché sirve cuando el dato vive más que la copia; acá vive mucho menos, y cada acierto de caché es una inscripción que va a fallar más adelante."
  - fact: "el servicio de validación sólo comprueba que el estudiante no deba materias. Es una consulta a la misma base que el servicio de matrícula ya consulta, envuelta en un proceso propio."
    discoveryPath: "seguí el camino de una inscripción y contá cuántos procesos la tocan sin agregar información nueva. Un servicio que consulta la base que otro ya consulta es un salto de red que pagás en cada pico."
startingDesign:
  nodes:
    - id: estudiante
      type: web-client
      label: Portal del estudiante
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: matricula
      type: service
      label: Servicio de matrícula
      zone: private
      role: matricula-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: validador
      type: service
      label: Servicio de validación académica
      zone: private
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: cupos
      type: database
      label: Base de cupos e inscripciones
      zone: restricted
      role: registro-academico
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: cachecupos
      type: cache
      label: Caché de cupos disponibles
      zone: private
      given: true
      props: { ttl: "300", eviction: "lru" }
      position: { x: 805, y: 300 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: estudiante-gw
      from: { node: estudiante }
      to: { node: gw }
      dataClass: personal
    - id: gw-matricula
      from: { node: gw }
      to: { node: matricula }
      dataClass: personal
    - id: matricula-validador
      from: { node: matricula }
      to: { node: validador }
      dataClass: personal
    - id: validador-cupos
      from: { node: validador }
      to: { node: cupos }
      dataClass: personal
    - id: matricula-cupos
      from: { node: matricula }
      to: { node: cupos }
      dataClass: personal
    - id: matricula-cachecupos
      from: { node: matricula }
      to: { node: cachecupos }
      dataClass: public
    - id: matricula-obs
      from: { node: matricula }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-pico-en-buffer
    label: la inscripción entra en una cola y se resuelve después, no dentro de la llamada
    weight: 3
    predicate:
      op: path
      from:
        role: matricula-service
      to:
        role: registro-academico
      via:
        type: [queue, stream]
    whyMissing: el camino desde el servicio de matrícula hasta el registro académico no pasa por ninguna pieza donde el trabajo pueda esperar. Cada estudiante ocupa un proceso hasta que la base termina de escribir.
    consequence: "el pico dura tres horas y la capacidad de escritura de la base no cambia porque haya más gente. Sin un lugar donde el trabajo espere, lo que se acumula son conexiones abiertas: la base deja de responder y se caen también las inscripciones que ya estaban en curso."
  - id: g-cupos-sin-cache
    label: el número de cupos no se lee de una copia en memoria
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [cache]
    whyMissing: hay un componente leyendo cupos desde una caché.
    consequence: "un cupo dura menos de dos segundos y la copia dura trescientos. El estudiante ve un lugar libre, lo pide, y recibe un error después de haber completado el formulario. La caché no aceleró nada: movió el fallo al peor momento posible."
  - id: g-estudiante-entra
    label: el estudiante sigue llegando al servicio de matrícula
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: matricula-service
    whyMissing: no hay ningún camino desde el portal del estudiante hasta el servicio de matrícula.
    consequence: "bajar el consumo cerrando la entrada no es resolver el pico: es cancelar la matrícula. Todo lo que saques tiene que dejar el camino de inscripción en pie."
  - id: g-matricula-observada
    label: el equipo ve el pico mientras pasa
    weight: 1
    predicate:
      op: covered
      target:
        role: matricula-service
      by:
        type: [observability]
    whyMissing: el servicio de matrícula no está conectado a ningún componente de monitoreo.
    consequence: "un pico de tres horas se termina antes de que alguien lo entienda mirando registros al día siguiente. Sin señal en vivo, la única palanca que te queda es apagar todo."
rubric:
  - dimension: el pico tiene dónde esperar
    signal:
      kind: predicate
      guaranteeId: g-pico-en-buffer
  - dimension: ninguna pieza miente sobre el estado de los cupos
    signal:
      kind: predicate
      guaranteeId: g-cupos-sin-cache
  - dimension: la inscripción sigue siendo posible después de tu recorte
    signal:
      kind: predicate
      guaranteeId: g-estudiante-entra
  - dimension: el pico es visible mientras ocurre
    signal:
      kind: predicate
      guaranteeId: g-matricula-observada
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: cola y procesador de fondo
    contextInversion: "un procesador de fondo es lo correcto cuando la inscripción no tiene que contestar nada mientras espera: el estudiante recibe un correo cuando su lugar está confirmado y ya está. Es la variante más barata de operar porque el procesador no expone nada, no necesita puerta de entrada y no puede recibir tráfico por accidente. Se paga con que el estudiante no tiene forma de preguntar en qué punto de la cola está."
    design:
      nodes:
        - id: estudiante
          type: web-client
          label: Portal del estudiante
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: matricula
          type: service
          label: Servicio de matrícula
          zone: private
          role: matricula-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: Cola de inscripciones
          zone: private
          props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
        - id: asignador
          type: worker
          label: Asignador de cupos
          zone: private
        - id: cupos
          type: database
          label: Base de cupos e inscripciones
          zone: restricted
          role: registro-academico
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: estudiante-gw
          from: { node: estudiante }
          to: { node: gw }
          dataClass: personal
        - id: gw-matricula
          from: { node: gw }
          to: { node: matricula }
          dataClass: personal
        - id: matricula-cola
          from: { node: matricula }
          to: { node: cola }
          dataClass: personal
        - id: cola-asignador
          from: { node: cola }
          to: { node: asignador }
          dataClass: personal
        - id: asignador-cupos
          from: { node: asignador }
          to: { node: cupos }
          dataClass: personal
        - id: matricula-obs
          from: { node: matricula }
          to: { node: obs }
          dataClass: public
        - id: cola-obs
          from: { node: cola }
          to: { node: obs }
          dataClass: public
  - label: cola y un servicio que además contesta en qué lugar vas
    contextInversion: "que el consumidor de la cola sea un servicio y no un procesador de fondo es lo correcto cuando el estudiante tiene que poder preguntar «¿en qué lugar de la cola estoy?». Un procesador de fondo no es llamable: para contestar esa pregunta necesitás un componente que reciba pedidos. Cuesta lo mismo operar y te compra que la espera sea visible en vez de silenciosa, que en un pico de tres horas es la diferencia entre una cola y una caída aparente. Se paga con que ese componente ahora sí puede recibir tráfico del exterior, y hay que cuidarlo."
    design:
      nodes:
        - id: estudiante
          type: web-client
          label: Portal del estudiante
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: matricula
          type: service
          label: Servicio de matrícula
          zone: private
          role: matricula-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: Cola de inscripciones
          zone: private
          props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
        - id: asignador
          type: service
          label: Servicio de asignación de cupos
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cupos
          type: database
          label: Base de cupos e inscripciones
          zone: restricted
          role: registro-academico
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: estudiante-gw
          from: { node: estudiante }
          to: { node: gw }
          dataClass: personal
        - id: gw-matricula
          from: { node: gw }
          to: { node: matricula }
          dataClass: personal
        - id: gw-asignador
          from: { node: gw }
          to: { node: asignador }
          dataClass: personal
        - id: matricula-cola
          from: { node: matricula }
          to: { node: cola }
          dataClass: personal
        - id: cola-asignador
          from: { node: cola }
          to: { node: asignador }
          dataClass: personal
        - id: asignador-cupos
          from: { node: asignador }
          to: { node: cupos }
          dataClass: personal
        - id: matricula-obs
          from: { node: matricula }
          to: { node: obs }
          dataClass: public
        - id: cola-obs
          from: { node: cola }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Una universidad pública abre la matrícula del semestre un lunes a las ocho
de la mañana. En la primera hora entran **41.000 estudiantes**. El resto del
semestre el sistema atiende cuatro mil pedidos por día.

Diez veces el tráfico, durante tres horas, una vez cada seis meses.

El sistema actual tiene seis piezas que hay que mantener despiertas: la
puerta de entrada, el servicio de matrícula, el servicio de validación
académica, la base de cupos, la caché de cupos disponibles y el monitoreo.
**Seis unidades operativas, y el presupuesto es exactamente seis.**

El semestre pasado el sistema estuvo caído cuarenta minutos. El informe
decía "la base no dio abasto", y el equipo pidió una base más grande. El
área financiera contestó lo único que se puede contestar a eso: no se compra
capacidad permanente para tres horas cada seis meses.

Así que el problema no es cuánta capacidad falta. Es **dónde espera el
trabajo cuando llega más del que se puede hacer al mismo tiempo**.

Y el presupuesto no se mueve. Si entra una pieza, sale otra.

**Rearmá el sistema para que el pico tenga dónde esperar, sin pasarte de
seis unidades operativas.** Mirá cada pieza y preguntate qué compra: hay dos
que en el día de la matrícula no compran nada, y una de ellas además miente.
