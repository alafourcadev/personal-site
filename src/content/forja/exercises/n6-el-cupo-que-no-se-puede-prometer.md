---
title: "El cupo que no se puede prometer"
level: 6
role: tradeoff
domain: educacion
tradeoffPairId: resiliencia-aceptar-y-diferir-o-rechazar-en-el-acto
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 1
D7: 3
D8: 1
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir qué ve el estudiante cuando el sistema de gestión académica no confirma el cupo, y qué queda escrito de esa inscripción que no se pudo cerrar."
lambda: 0.5
constraints:
  - metric: lugares reales en el laboratorio de la materia
    operator: "<="
    value: 30
    unit: lugares
  - metric: inscriptos que quedaron confirmados en marzo para esos lugares
    operator: ">="
    value: 61
    unit: inscriptos
  - metric: solicitudes de inscripción en la primera hora de apertura
    operator: ">="
    value: 4200
    unit: solicitudes/hora
hiddenFacts:
  - fact: "en marzo el sistema de gestión académica estuvo 25 minutos sin responder. La plataforma siguió aceptando inscripciones y encolándolas: cuando el sistema volvió, 61 personas tenían confirmación por correo para un laboratorio de 30 lugares."
    discoveryPath: "seguí quién decide si hay lugar. Si la plataforma acepta antes de que ese sistema conteste, entonces en algún momento va a aceptar más de lo que hay, y va a ser justo cuando el sistema no conteste."
  - fact: "dar de baja a 31 personas ya confirmadas llevó dos semanas, una nota del decano y tres reclamos formales. Ninguna de las 31 había hecho nada mal."
    discoveryPath: "preguntate qué cuesta deshacer lo que aceptaste. Si deshacer es un trámite de dos semanas con una persona enojada del otro lado, aceptar sin confirmar no fue una degradación: fue una promesa que no podías cumplir."
  - fact: "el equipo ya tiene la cola armada porque el flujo de entregas la usa y le funciona bien. La tentación es reusar el mismo patrón acá: es la misma plataforma, el mismo estudiante, el mismo botón."
    discoveryPath: "el patrón es el mismo; lo que cambia es qué compromete aceptar. Recibir un trabajo no le saca el lugar a nadie; confirmar una inscripción sí."
  - fact: "una inscripción que no se pudo cerrar no es un aspirante perdido si el intento queda anotado: la secretaría reabre el cupo por orden de intento y en marzo recuperó al 78 % de los que habían quedado afuera por el incidente."
    discoveryPath: "degradar rechazando no es lo mismo que degradar perdiendo. Fijate qué pasa con el intento fallido si la plataforma simplemente devuelve un error y no escribe nada durable."
startingDesign:
  nodes:
    - id: estudiante
      type: actor
      label: Estudiante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: campus
      type: web-client
      label: Campus virtual
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: inscripciones
      type: service
      label: Servicio de inscripciones
      zone: private
      role: intake-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: cola
      type: queue
      label: Cola de inscripciones pendientes
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 410 }
    - id: asignador
      type: worker
      label: Asignador de cupos
      zone: private
      given: true
      position: { x: 445, y: 520 }
    - id: academica
      type: external-provider
      label: Sistema de gestión académica
      zone: dmz
      role: verifier-source
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: estudiante-campus
      from: { node: estudiante }
      to: { node: campus }
      dataClass: public
    - id: campus-gw
      from: { node: campus }
      to: { node: gw }
      dataClass: personal
    - id: gw-inscripciones
      from: { node: gw }
      to: { node: inscripciones }
      dataClass: personal
    - id: inscripciones-cola
      from: { node: inscripciones }
      to: { node: cola }
      dataClass: personal
    - id: cola-asignador
      from: { node: cola }
      to: { node: asignador }
      dataClass: personal
    - id: asignador-academica
      from: { node: asignador }
      to: { node: academica }
      dataClass: personal
guarantees:
  - id: g-cupo-se-confirma-en-el-acto
    label: la confirmación del cupo se le pide a la gestión académica en el mismo pedido, sin nada que la difiera
    weight: 2
    predicate:
      op: path
      from:
        role: intake-service
      to:
        role: verifier-source
      forbid:
        type: [queue, stream]
    whyMissing: el único camino desde el servicio de inscripciones hasta la gestión académica pasa por una pieza que difiere el pedido. Mientras exista ese diferimiento, la plataforma contesta antes de saber si hay lugar.
    consequence: "marzo: 25 minutos sin gestión académica, la cola aceptando todo, y 61 confirmaciones por correo para un laboratorio de 30 lugares. La cola no falló; hizo exactamente lo que hace una cola."
  - id: g-sin-buffer-en-la-inscripcion
    label: ninguna pieza del camino de inscripción encola la solicitud
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [queue, stream]
    whyMissing: hay una pieza del camino de inscripción que deja la solicitud en un intermediario para procesarla después. Aceptar y procesar después es, acá, prometer un lugar que todavía nadie contó.
    consequence: dar de baja a 31 personas ya confirmadas llevó dos semanas, una nota del decano y tres reclamos formales. Ninguna de las 31 había hecho nada mal, y ese costo no aparece en ningún tablero de disponibilidad.
  - id: g-intento-queda-anotado
    label: la inscripción que no se pudo cerrar queda anotada
    weight: 1
    predicate:
      op: path
      from:
        role: intake-service
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de inscripciones hasta una base, así que el intento que no se pudo confirmar existe sólo mientras dura el pedido que lo produjo.
    consequence: "rechazar está bien; perder no. Sin registro durable, las 4.200 solicitudes de la primera hora que no se pudieron cerrar desaparecen sin rastro, y con ellas el 78 % que la secretaría recuperó en marzo reabriendo el cupo por orden de intento."
rubric:
  - dimension: aceptar sólo cuando la fuente confirmó, porque aceptar acá promete
    signal:
      kind: predicate
      guaranteeId: g-cupo-se-confirma-en-el-acto
  - dimension: el intermediario se saca del camino, no se le ajusta el tiempo de espera
    signal:
      kind: predicate
      guaranteeId: g-sin-buffer-en-la-inscripcion
  - dimension: degradar rechazando no es lo mismo que degradar perdiendo
    signal:
      kind: predicate
      guaranteeId: g-intento-queda-anotado
referenceSolutions:
  - label: el servicio de inscripciones confirma y anota el intento en su propia base
    contextInversion: "que el mismo servicio pregunte, decida y anote es lo correcto cuando la inscripción es una operación corta y la gestión académica contesta en milisegundos el 99 % del tiempo: menos piezas, un solo lugar donde mirar y ninguna ventana en la que el estado sea ambiguo. El intento fallido queda en la misma base que las inscripciones cerradas, así que reabrir el cupo por orden de intento es una consulta y no un proyecto. El costo es que la secretaría se entera de que hubo intentos fallidos porque alguien mira la tabla: nadie avisa solo."
    design:
      nodes:
        - id: estudiante
          type: actor
          label: Estudiante
          zone: public
        - id: campus
          type: web-client
          label: Campus virtual
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: inscripciones
          type: service
          label: Servicio de inscripciones
          zone: private
          role: intake-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: base
          type: database
          label: Base de inscripciones e intentos
          zone: restricted
          props: { backup: "diario" }
        - id: academica
          type: external-provider
          label: Sistema de gestión académica
          zone: dmz
          role: verifier-source
      edges:
        - id: estudiante-campus
          from: { node: estudiante }
          to: { node: campus }
          dataClass: public
        - id: campus-gw
          from: { node: campus }
          to: { node: gw }
          dataClass: personal
        - id: gw-inscripciones
          from: { node: gw }
          to: { node: inscripciones }
          dataClass: personal
        - id: inscripciones-base
          from: { node: inscripciones }
          to: { node: base }
          dataClass: personal
        - id: inscripciones-academica
          from: { node: inscripciones }
          to: { node: academica }
          dataClass: personal
  - label: un servicio de recuperación aparte avisa a los que quedaron afuera
    contextInversion: "separar al que avisa del que inscribe conviene cuando el rechazo no termina en el rechazo: alguien tiene que volver a buscar a esas personas cuando el cupo se reabre, y esa tarea tiene su propio ritmo (lotes, horarios razonables, reintentos contra la plataforma de mensajería) que no se parece en nada al de atender 4.200 solicitudes en una hora. El servicio de inscripciones sigue decidiendo en el acto y sin intermediarios; lo que se difiere es el aviso, que no le promete nada a nadie. Se paga con una pieza más para operar y con dos servicios leyendo la misma tabla."
    design:
      nodes:
        - id: estudiante
          type: actor
          label: Estudiante
          zone: public
        - id: campus
          type: web-client
          label: Campus virtual
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: inscripciones
          type: service
          label: Servicio de inscripciones
          zone: private
          role: intake-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: base
          type: database
          label: Base de inscripciones e intentos
          zone: restricted
          props: { backup: "diario" }
        - id: recuperacion
          type: service
          label: Servicio de reapertura de cupos
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: mensajeria
          type: external-provider
          label: Plataforma de mensajería a estudiantes
          zone: dmz
        - id: academica
          type: external-provider
          label: Sistema de gestión académica
          zone: dmz
          role: verifier-source
      edges:
        - id: estudiante-campus
          from: { node: estudiante }
          to: { node: campus }
          dataClass: public
        - id: campus-gw
          from: { node: campus }
          to: { node: gw }
          dataClass: personal
        - id: gw-inscripciones
          from: { node: gw }
          to: { node: inscripciones }
          dataClass: personal
        - id: inscripciones-base
          from: { node: inscripciones }
          to: { node: base }
          dataClass: personal
        - id: inscripciones-academica
          from: { node: inscripciones }
          to: { node: academica }
          dataClass: personal
        - id: recuperacion-base
          from: { node: recuperacion }
          to: { node: base }
          dataClass: personal
        - id: recuperacion-mensajeria
          from: { node: recuperacion }
          to: { node: mensajeria }
          dataClass: personal
status: PILOT
---

La misma universidad, la misma plataforma, el mismo botón. Un metro más adelante
en el año académico: **la inscripción a materias**.

Acá aceptar no es recibir. Es **prometer un lugar**. El laboratorio tiene **30
lugares**: treinta mesadas, treinta puestos. Y en la primera hora de apertura
entran **4.200 solicitudes**.

El equipo reusó el patrón que le funciona en las entregas: aceptar la solicitud,
encolarla, y dejar que el asignador la resuelva contra el sistema de gestión
académica cuando pueda. Tiene sentido. Es la misma plataforma, el mismo
estudiante, el mismo formulario.

Y funcionó bien hasta marzo.

En marzo el sistema de gestión académica estuvo **25 minutos** sin responder. La
plataforma no se cayó: siguió aceptando y encolando. Cuando el sistema volvió,
**61 personas** tenían confirmación por correo para un laboratorio de 30 lugares.

La cola no falló. Hizo exactamente lo que hace una cola: aceptó ahora y resolvió
después.

Dar de baja a **31 personas ya confirmadas** llevó dos semanas, una nota del
decano y tres reclamos formales. Ninguna de las 31 había hecho nada mal.

Acá la degradación correcta es la otra: **si la gestión académica no confirma, no
hay inscripción**. Pero la secretaria académica marca el límite de eso: *"Que no
inscriba de más, de acuerdo. Que no me borre al que intentó, eso no."* En marzo
la secretaría reabrió el cupo por orden de intento y recuperó al **78 %** de los
que habían quedado afuera, porque alguien, en algún lado, había anotado que
existieron.

El equipo tiene **5 unidades operativas** y hoy usa 4.

**Rearmá la inscripción** para que el cupo se confirme contra la gestión
académica en el mismo pedido, para que ninguna pieza del camino difiera la
solicitud, y para que el intento que no se pudo cerrar quede anotado en algo que
sobreviva al pedido que lo produjo.
