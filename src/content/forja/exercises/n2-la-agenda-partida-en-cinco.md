---
title: "La agenda partida en cinco"
level: 2
role: core
domain: salud
D1: 1
D2: 2
D3: 2
D4: 1
D5: 1
D6: 2
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué dos piezas de este sistema cambian siempre juntas y por qué eso las hace una sola."
lambda: 0.5
constraints:
  - metric: turnos agendados por día
    operator: ">="
    value: 1900
    unit: turnos/día
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: los tres últimos cambios de producto tocaron el servicio de turnos y el de disponibilidad al mismo tiempo. Fueron franjas de 20 minutos, sobreturnos y bloqueo por feriado. Ninguno tocó sólo uno.
    discoveryPath: "mirá qué dos piezas del diagrama aparecen siempre en la misma frase cuando describís un cambio del negocio. Dos cosas que siempre se despliegan juntas son una cosa con una frontera de más."
  - fact: la base de recordatorios guarda una copia del turno, y esa copia se desincroniza cuando alguien reprograma.
    discoveryPath: "seguí de dónde saca el turno cada pieza. Si dos almacenamientos distintos guardan el mismo hecho, uno de los dos va a estar viejo y nadie sabe cuál."
  - fact: el historial clínico es del área médica, no del área de agenda, y su equipo lo audita aparte.
    discoveryPath: "fijate qué conexión entra al historial clínico desde una pieza que no es su dueño. Esa es la única frontera del diagrama que no se puede borrar."
startingDesign:
  nodes:
    - id: paciente
      type: actor
      label: Paciente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la clínica
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: turnos
      type: service
      label: Servicio de turnos
      zone: private
      role: appointment-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: disponibilidad
      type: service
      label: Servicio de disponibilidad
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: recordatorios
      type: service
      label: Servicio de recordatorios
      zone: private
      role: reminder-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: historial
      type: service
      label: Servicio de historial clínico
      zone: private
      role: records-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 630 }
    - id: turnosdb
      type: database
      label: Base de turnos
      zone: restricted
      role: appointment-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: disponibilidaddb
      type: database
      label: Base de disponibilidad
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: recordatoriosdb
      type: database
      label: Base de recordatorios
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
    - id: historialdb
      type: database
      label: Base de historial clínico
      zone: restricted
      role: records-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 740 }
  edges:
    - id: paciente-app
      from: { node: paciente }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-turnos
      from: { node: gw }
      to: { node: turnos }
      dataClass: personal
    - id: turnos-turnosdb
      from: { node: turnos }
      to: { node: turnosdb }
      dataClass: personal
    - id: turnos-disponibilidad
      from: { node: turnos }
      to: { node: disponibilidad }
      dataClass: personal
    - id: disponibilidad-disponibilidaddb
      from: { node: disponibilidad }
      to: { node: disponibilidaddb }
      dataClass: personal
    - id: turnos-recordatorios
      from: { node: turnos }
      to: { node: recordatorios }
      dataClass: personal
    - id: recordatorios-recordatoriosdb
      from: { node: recordatorios }
      to: { node: recordatoriosdb }
      dataClass: personal
    - id: turnos-historial
      from: { node: turnos }
      to: { node: historial }
      dataClass: regulated
    - id: historial-historialdb
      from: { node: historial }
      to: { node: historialdb }
      dataClass: regulated
    - id: recordatorios-historialdb
      from: { node: recordatorios }
      to: { node: historialdb }
      dataClass: regulated
guarantees:
  - id: g-agenda-owner
    label: la agenda la escribe el servicio de turnos
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: appointment-db
        - op: covered
          target:
            role: appointment-db
          by:
            role: appointment-service
    whyMissing: la base de turnos no existe, o no está conectada al servicio de turnos.
    consequence: consolidar no es borrar hasta que entre en el presupuesto. Si desaparece el almacenamiento del turno, la clínica deja de tener agenda, que es lo único que este sistema existe para hacer.
  - id: g-history-through-owner
    label: el turno llega al historial clínico a través de su dueño
    weight: 2
    predicate:
      op: path
      from:
        role: appointment-service
      to:
        role: records-db
      via:
        role: records-service
    whyMissing: no hay ningún camino desde el servicio de turnos hasta la base de historial clínico que atraviese el servicio de historial clínico.
    consequence: el historial clínico es el dato que el área médica audita y del que responde legalmente. Un acceso que no pasa por su dueño no queda registrado en ningún lado, y en una auditoría "no figura" y "no pasó" no son lo mismo.
  - id: g-patient-still-enters
    label: el paciente sigue llegando al servicio de turnos
    weight: 2
    predicate:
      op: path
      from:
        type: [actor]
      to:
        role: appointment-service
    whyMissing: no hay ningún camino desde el paciente hasta el servicio de turnos.
    consequence: "consolidar es juntar responsabilidades, no apagar la puerta por la que entra la gente. Un sistema que entra en presupuesto porque ya nadie puede usarlo no resolvió el problema, lo canceló."
  - id: g-no-reminder-peek
    label: los recordatorios no leen el historial clínico
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: reminder-service
      to:
        role: records-db
    whyMissing: hay una conexión que sale del servicio de recordatorios y entra directo a la base de historial clínico.
    consequence: mandar un mensaje "no se olvide de su turno" no necesita el diagnóstico del paciente. Una pieza que puede leer más de lo que su trabajo requiere es una filtración esperando la primera consulta mal escrita.
rubric:
  - dimension: la agenda conserva un dueño explícito después de consolidar
    signal:
      kind: predicate
      guaranteeId: g-agenda-owner
  - dimension: el dato clínico se alcanza siempre por su dueño
    signal:
      kind: predicate
      guaranteeId: g-history-through-owner
  - dimension: ninguna pieza accede a más dato del que su trabajo necesita
    signal:
      kind: predicate
      guaranteeId: g-no-reminder-peek
referenceSolutions:
  - label: una sola agenda, con la disponibilidad y los avisos adentro
    contextInversion: "juntar todo lo que cambia junto es lo correcto en un equipo chico que no puede pagar cuatro despliegues coordinados por semana: el turno y su disponibilidad son el mismo hecho mirado desde dos lados, y separarlos convirtió cada cambio de producto en dos pull requests y una ventana de despliegue. Se paga con que el envío de recordatorios comparte destino de despliegue con el agendamiento."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: app
          type: mobile-client
          label: App de la clínica
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: appointment-service
          props: { criticality: "medium", replicas: "2" }
        - id: turnosdb
          type: database
          label: Base de turnos
          zone: restricted
          role: appointment-db
          props: { backup: "diario" }
        - id: historial
          type: service
          label: Servicio de historial clínico
          zone: private
          role: records-service
          props: { criticality: "medium", replicas: "2" }
        - id: historialdb
          type: database
          label: Base de historial clínico
          zone: restricted
          role: records-db
          props: { backup: "diario" }
      edges:
        - id: paciente-app
          from: { node: paciente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: turnos-turnosdb
          from: { node: turnos }
          to: { node: turnosdb }
          dataClass: personal
        - id: turnos-historial
          from: { node: turnos }
          to: { node: historial }
          dataClass: regulated
        - id: historial-historialdb
          from: { node: historial }
          to: { node: historialdb }
          dataClass: regulated
  - label: los recordatorios siguen aparte, pero sin base propia
    contextInversion: "dejar los recordatorios como pieza separada conviene cuando el envío tiene un ritmo propio: corre de madrugada, se reintenta, y una campaña de avisos no puede competir con el agendamiento en hora pico. Eso sí, sin darle almacenamiento: el turno lo sigue teniendo un solo dueño y la copia desincronizada desaparece. Se paga con la unidad operativa de un servicio más y con una llamada entre piezas donde antes había una consulta local."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: app
          type: mobile-client
          label: App de la clínica
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: appointment-service
          props: { criticality: "medium", replicas: "2" }
        - id: turnosdb
          type: database
          label: Base de turnos
          zone: restricted
          role: appointment-db
          props: { backup: "diario" }
        - id: recordatorios
          type: service
          label: Servicio de recordatorios
          zone: private
          role: reminder-service
          props: { criticality: "medium", replicas: "2" }
        - id: historial
          type: service
          label: Servicio de historial clínico
          zone: private
          role: records-service
          props: { criticality: "medium", replicas: "2" }
        - id: historialdb
          type: database
          label: Base de historial clínico
          zone: restricted
          role: records-db
          props: { backup: "diario" }
      edges:
        - id: paciente-app
          from: { node: paciente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: turnos-turnosdb
          from: { node: turnos }
          to: { node: turnosdb }
          dataClass: personal
        - id: turnos-recordatorios
          from: { node: turnos }
          to: { node: recordatorios }
          dataClass: personal
        - id: turnos-historial
          from: { node: turnos }
          to: { node: historial }
          dataClass: regulated
        - id: historial-historialdb
          from: { node: historial }
          to: { node: historialdb }
          dataClass: regulated
status: DRAFT
---

Una clínica agenda **1.900 turnos por día**. Hace dos años el sistema era un
solo servicio. Alguien leyó que los servicios chicos se despliegan mejor y lo
partieron en cuatro: turnos, disponibilidad, recordatorios e historial
clínico. Cada uno con su base de datos.

Los tres últimos cambios de producto tocaron **turnos y disponibilidad al mismo
tiempo**: franjas de veinte minutos, sobreturnos y bloqueo por feriado.
Ninguno tocó sólo uno. Cada uno de esos cambios costó dos pull requests, dos
despliegues coordinados y una tarde de alguien mirando cuál de los dos había
quedado atrás.

Recordatorios guarda su propia copia del turno. Cuando un paciente reprograma,
la copia queda vieja hasta la próxima sincronización, y cada tanto llega un
mensaje avisando de un turno que ya no existe. Además, para armar el texto del
mensaje, recordatorios **lee la base del historial clínico**, que es del área
médica y se audita aparte.

El equipo son **tres personas** y su capacidad real es de **6 unidades
operativas**. Hoy el sistema usa **9**. No es una opinión: es la cantidad de
piezas que hay que actualizar, monitorear y respaldar cada semana.

**Rearmá el sistema** para que lo que siempre cambia junto viva junto, para que
el turno tenga un solo dueño, y para que el historial clínico se siga
alcanzando sólo por el suyo. Vas a tener que **sacar piezas**, no agregarlas.
