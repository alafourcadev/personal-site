---
title: "Las dos matrículas que abren el mismo lunes"
level: 11
role: core
domain: educacion
D1: 3
D2: 3
D3: 3
D4: 4
D5: 4
D6: 2
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que explicar por qué las dos matrículas conviven en la misma semana y quién decide cuál atiende a quién."
lambda: 0.5
constraints:
  - metric: estudiantes que se matriculan en la semana de apertura
    operator: ">="
    value: 48000
    unit: estudiantes
  - metric: tiempo aceptable para devolver una carrera al sistema viejo si el nuevo falla
    operator: "<="
    value: 10
    unit: minutos
hiddenFacts:
  - fact: "el sistema nuevo sabe matricular grado y nada más. Posgrado, convenios con otras universidades y el régimen de estudiantes de intercambio siguen viviendo únicamente en el sistema viejo, y no hay fecha para migrarlos."
    discoveryPath: "preguntate qué pasa con el estudiante de posgrado el lunes de apertura. Si la respuesta es 'el sistema nuevo no sabe', entonces el viejo no se apaga: la convivencia no es una etapa, es el estado del sistema durante todo el próximo año académico."
  - fact: "alguien conectó el sistema nuevo directamente a la base académica vieja para no tener que copiar los planes de estudio. Funciona. También es lo que va a impedir apagar esa base cuando termine la migración."
    discoveryPath: "seguí las flechas que salen del sistema nuevo. Una entra a la base vieja. Cada consulta que el sistema nuevo hace ahí es una dependencia más que alguien va a tener que desarmar el día del apagado, y para entonces nadie va a recordar cuántas eran."
  - fact: "la matrícula concentra el 70 % del tráfico del año en cinco días. El año pasado el sistema se cayó dos veces y las dos veces tardaron más de una hora en saber qué se había caído."
    discoveryPath: "imaginate el lunes con las dos versiones andando y una sola vista de qué está pasando. Cuando algo se rompa, la primera pregunta va a ser cuál de las dos se rompió, y esa pregunta tarda más que arreglarlo."
  - fact: "el expediente académico de los últimos veintidós años vive en la base vieja y se consulta todos los días: certificados analíticos, equivalencias, reválidas."
    discoveryPath: "apagá el camino a la base vieja y preguntate quién pierde. El historial no es archivo muerto: es lo que mira el departamento de alumnado cada vez que alguien pide un certificado."
startingDesign:
  nodes:
    - id: estudiante
      type: actor
      label: Estudiante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de matrícula
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: enrutador
      type: service
      label: Enrutador de matrícula
      zone: private
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 410 }
    - id: viejo
      type: service
      label: Matrícula (sistema viejo)
      zone: private
      role: legacy-enrolment
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Matrícula (sistema nuevo)
      zone: private
      role: new-enrolment
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 520 }
    - id: dbvieja
      type: database
      label: Base académica (vieja)
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 530 }
    - id: dbnueva
      type: database
      label: Base de matrícula (nueva)
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 640 }
    - id: obs
      type: observability
      label: Observabilidad
      zone: private
      given: true
      position: { x: 805, y: 420 }
  edges:
    - id: estudiante-portal
      from: { node: estudiante }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: personal
    - id: viejo-dbvieja
      from: { node: viejo }
      to: { node: dbvieja }
      dataClass: personal
    - id: nuevo-dbnueva
      from: { node: nuevo }
      to: { node: dbnueva }
      dataClass: personal
    - id: nuevo-dbvieja
      from: { node: nuevo }
      to: { node: dbvieja }
      dataClass: personal
guarantees:
  - id: g-both-serving
    label: las dos matrículas atienden estudiantes reales el mismo lunes
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: legacy-enrolment
        - op: path
          from:
            type: [api-gateway]
          to:
            role: new-enrolment
    whyMissing: falta el camino desde la puerta de entrada hasta una de las dos versiones. O el sistema nuevo no recibe tráfico, o el viejo dejó de recibirlo.
    consequence: "el sistema nuevo sabe matricular grado y nada más: posgrado, convenios e intercambio siguen viviendo sólo del lado viejo. Si el viejo deja de atender, esos estudiantes no se matriculan; si el nuevo no atiende, la semana de apertura pasa sin que nadie descubra qué le falta."
  - id: g-single-switch
    label: la decisión de quién atiende a quién vive en un solo lugar
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-enrolment
    whyMissing: la puerta de entrada sigue llamando al sistema viejo directamente, así que la decisión de a quién atiende cada versión está escrita en la puerta.
    consequence: "devolver una carrera al sistema viejo pasa a ser un despliegue en la puerta de entrada, en plena semana de matrícula, con 48.000 estudiantes intentando entrar. Diez minutos es el tiempo de una decisión de operación; un despliegue en la puerta no entra en diez minutos ni en un buen día."
  - id: g-branches-watched
    label: cada versión se puede mirar por separado
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay servicios en el diseño que no están conectados a ninguna pieza de observabilidad.
    consequence: "la matrícula concentra el 70 % del tráfico del año en cinco días. Cuando algo se rompe con las dos versiones andando, la primera pregunta es cuál de las dos se rompió, y el año pasado esa pregunta tardó más de una hora las dos veces. Sin una vista por versión, el tiempo de diagnóstico es el tiempo que tarda alguien en adivinar."
  - id: g-no-shared-store
    label: el sistema nuevo no lee la base académica vieja
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: new-enrolment
      to:
        role: legacy-store
    whyMissing: el sistema nuevo tiene una conexión directa a la base vieja.
    consequence: "cada consulta del sistema nuevo a la base vieja es una dependencia que alguien va a tener que desarmar el día del apagado, y para entonces nadie va a saber cuántas eran. El atajo que hoy ahorra copiar los planes de estudio es el que dentro de dos años va a impedir apagar esa base."
  - id: g-history-reachable
    label: el expediente académico sigue consultable desde la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-store
    whyMissing: no hay ningún camino desde la puerta de entrada hasta la base académica vieja.
    consequence: "veintidós años de expedientes viven ahí y se consultan todos los días: certificados analíticos, equivalencias, reválidas. Sin ese camino, cada pedido pasa a ser un ticket al equipo de datos y un certificado que salía en el día tarda una semana."
rubric:
  - dimension: las dos versiones conviven atendiendo tráfico real
    signal:
      kind: predicate
      guaranteeId: g-both-serving
  - dimension: el reparto se cambia sin desplegar
    signal:
      kind: predicate
      guaranteeId: g-single-switch
  - dimension: cada versión se diagnostica por separado
    signal:
      kind: predicate
      guaranteeId: g-branches-watched
  - dimension: la migración no crea dependencias nuevas hacia lo que se va a apagar
    signal:
      kind: predicate
      guaranteeId: g-no-shared-store
  - dimension: el historial no se pierde durante la convivencia
    signal:
      kind: predicate
      guaranteeId: g-history-reachable
referenceSolutions:
  - label: un enrutador que reparte por tipo de carrera
    contextInversion: "una pieza dedicada que reparte conviene cuando el criterio de reparto va a cambiar varias veces y no siempre en la misma dirección: grado primero, después una facultad, después atrás porque el lunes salió mal. Todo eso son cambios en un solo lugar, y ninguno toca a los dos sistemas. Se paga con una unidad operativa más y con una pieza en el camino de las 48.000 matrículas de la semana pico."
    design:
      nodes:
        - id: estudiante
          type: actor
          label: Estudiante
          zone: public
        - id: portal
          type: web-client
          label: Portal de matrícula
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador de matrícula
          zone: private
          props: { criticality: "high", replicas: "3" }
        - id: viejo
          type: service
          label: Matrícula (sistema viejo)
          zone: private
          role: legacy-enrolment
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Matrícula (sistema nuevo)
          zone: private
          role: new-enrolment
          props: { criticality: "high", replicas: "3" }
        - id: dbvieja
          type: database
          label: Base académica (vieja)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base de matrícula (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Observabilidad por versión
          zone: private
      edges:
        - id: estudiante-portal
          from: { node: estudiante }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-enrutador
          from: { node: gw }
          to: { node: enrutador }
          dataClass: personal
        - id: enrutador-viejo
          from: { node: enrutador }
          to: { node: viejo }
          dataClass: personal
        - id: enrutador-nuevo
          from: { node: enrutador }
          to: { node: nuevo }
          dataClass: personal
        - id: viejo-dbvieja
          from: { node: viejo }
          to: { node: dbvieja }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
        - id: enrutador-obs
          from: { node: enrutador }
          to: { node: obs }
          dataClass: public
        - id: viejo-obs
          from: { node: viejo }
          to: { node: obs }
          dataClass: public
        - id: nuevo-obs
          from: { node: nuevo }
          to: { node: obs }
          dataClass: public
  - label: el sistema nuevo adelante, delegando lo que todavía no sabe
    contextInversion: "poner el sistema nuevo adelante y que delegue en el viejo lo que no sabe hacer conviene cuando la migración avanza por funcionalidad y no por porcentaje: el día que el nuevo aprenda posgrado, deja de delegarlo y nadie toca ninguna otra pieza. Es una unidad operativa menos que sostener en la semana pico. El precio es que el sistema nuevo está en el camino de absolutamente todo desde el primer lunes, incluido el estudiante de posgrado que él no sabe atender: si se cae, se cae también lo que sí funcionaba."
    design:
      nodes:
        - id: estudiante
          type: actor
          label: Estudiante
          zone: public
        - id: portal
          type: web-client
          label: Portal de matrícula
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Matrícula (sistema nuevo)
          zone: private
          role: new-enrolment
          props: { criticality: "high", replicas: "3" }
        - id: viejo
          type: service
          label: Matrícula (sistema viejo)
          zone: private
          role: legacy-enrolment
          props: { criticality: "high", replicas: "2" }
        - id: dbvieja
          type: database
          label: Base académica (vieja)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base de matrícula (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Observabilidad por versión
          zone: private
      edges:
        - id: estudiante-portal
          from: { node: estudiante }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: nuevo-viejo
          from: { node: nuevo }
          to: { node: viejo }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
        - id: viejo-dbvieja
          from: { node: viejo }
          to: { node: dbvieja }
          dataClass: personal
        - id: nuevo-obs
          from: { node: nuevo }
          to: { node: obs }
          dataClass: public
        - id: viejo-obs
          from: { node: viejo }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Una universidad con **48.000 estudiantes** abre la matrícula el mismo lunes
de todos los años. Esa semana concentra el **70 % del tráfico del año**: cinco
días de pico y once meses de calma.

El sistema que la atiende tiene catorce años. El reemplazo está terminado,
probado y desplegado, y sabe hacer **una sola cosa: matricular grado**.
Posgrado, convenios con otras universidades y el régimen de intercambio
siguen viviendo únicamente en el sistema viejo, y no hay fecha para migrarlos:
la persona que entiende las equivalencias de convenio se jubila el año que
viene y todavía nadie escribió cómo funciona.

Eso decide algo antes de que empiece el diseño: **el sistema viejo no se
apaga este año**. La convivencia no es una etapa de transición de seis
semanas. Es el estado del sistema durante todo el próximo año académico, y
hay que armarla para durar.

Tres cosas más, todas en el diagrama:

La puerta de entrada llama al sistema viejo directamente. Vicerrectorado pidió
poder **devolver una carrera al sistema viejo en menos de diez minutos** si el
lunes sale mal, y diez minutos es el tiempo de una decisión de operación, no
el de un despliegue en plena semana de matrícula.

Alguien conectó el sistema nuevo directo a la base académica vieja para no
tener que copiar los planes de estudio. Funciona hoy. También es lo que va a
impedir apagar esa base cuando la migración termine.

Y el año pasado el sistema se cayó dos veces durante la matrícula. Las dos
veces tardaron **más de una hora en saber qué se había caído**, con una sola
versión andando.

**Rearmá el sistema** para que las dos matrículas atiendan estudiantes reales
el mismo lunes, para que el reparto se pueda cambiar y deshacer sin desplegar
nada, y para que cuando algo se rompa se sepa en cuál de las dos.
