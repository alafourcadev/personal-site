---
title: "La consulta que saltea la puerta"
level: 1
role: core
domain: educacion
D1: 1
D2: 1
D3: 1
D4: 0
D5: 1
D6: 1
D7: 0
D8: 0
D9: 1
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: 'libre para redactar, cerrada para decidir: pedile a un modelo que te explique qué hace una puerta de entrada, no que te diga si esta conexión sobra. Eso lo decide el reglamento del colegio, y el reglamento no está en el modelo.'
lambda: 0.5
constraints:
  - metric: puntos por los que se puede consultar una nota sin pasar por la verificación de identidad
    operator: "="
    value: 0
    unit: puntos de entrada
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: los 40 ms que la app se ahorra saltando la puerta de entrada nunca se midieron. El número salió de una conversación, no de una medición.
    discoveryPath: buscá el número en el enunciado y fijate qué lo respalda. El requisito del consejo escolar sí tiene fuente porque está firmado; el de los 40 ms no tiene ninguna.
  - fact: el atajo de la app no es una decisión discutible de arquitectura, es una conexión que el tablero no acepta.
    discoveryPath: probá tu respuesta con el sistema tal como viene. El motor no te va a dar un puntaje bajo por esa conexión. Te va a decir que no puede evaluar el diseño, y va a nombrar las dos razones.
startingDesign:
  nodes:
    - id: madre
      type: actor
      label: Madre o padre
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de familias
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: docente
      type: actor
      label: Docente
      zone: public
      given: true
      position: { x: 85, y: 190 }
    - id: consola
      type: web-client
      label: Consola del docente
      zone: public
      given: true
      position: { x: 445, y: 190 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
    - id: notas
      type: service
      label: Servicio de calificaciones
      zone: private
      role: grades-service
      given: true
      position: { x: 445, y: 410 }
    - id: db
      type: database
      label: Base de calificaciones
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: madre-app
      from: { node: madre }
      to: { node: app }
      dataClass: public
    - id: docente-consola
      from: { node: docente }
      to: { node: consola }
      dataClass: public
    - id: consola-gw
      from: { node: consola }
      to: { node: gw }
      dataClass: personal
    - id: gw-notas
      from: { node: gw }
      to: { node: notas }
      dataClass: personal
    - id: notas-db
      from: { node: notas }
      to: { node: db }
      dataClass: personal
    - id: app-notas
      from: { node: app }
      to: { node: notas }
      dataClass: personal
guarantees:
  - id: g-sin-atajo
    label: ningún cliente llega al servicio de calificaciones por su cuenta
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [mobile-client, web-client]
      to:
        role: grades-service
    whyMissing: hay una conexión directa desde un cliente hasta el servicio de calificaciones, sin ninguna pieza en el medio que verifique quién pregunta.
    consequence: el reglamento dice "un solo punto de entrada" y el sistema tiene dos. El segundo no verifica nada, no registra nada y nadie se acuerda de que existe hasta que alguien consulta la nota de un chico que no es suyo.
  - id: g-app-por-la-puerta
    label: la app de familias entra por una puerta de entrada
    weight: 2
    predicate:
      op: path
      from:
        type: [mobile-client]
      to:
        role: grades-service
      via:
        type: [api-gateway]
    whyMissing: no hay ningún camino desde la app de familias hasta el servicio de calificaciones que pase por una puerta de entrada.
    consequence: sacar el atajo sin poner el camino correcto deja a 900 familias sin poder ver una nota. El requisito no era "cerrar la puerta de atrás", era "que todos entren por la de adelante".
  - id: g-consola-por-la-puerta
    label: la consola del docente entra por una puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: grades-service
      via:
        type: [api-gateway]
    whyMissing: no hay ningún camino desde la consola del docente hasta el servicio de calificaciones que pase por una puerta de entrada.
    consequence: los docentes cargan las notas. Si el rediseño los deja afuera, el sistema queda impecablemente cerrado y vacío.
rubric:
  - dimension: no queda ningún camino que evite la verificación de identidad
    signal:
      kind: predicate
      guaranteeId: g-sin-atajo
  - dimension: las familias siguen pudiendo consultar
    signal:
      kind: predicate
      guaranteeId: g-app-por-la-puerta
  - dimension: los docentes siguen pudiendo cargar
    signal:
      kind: predicate
      guaranteeId: g-consola-por-la-puerta
referenceSolutions:
  - label: una sola puerta para todos
    contextInversion: 'una puerta compartida gana cuando las dos audiencias consultan lo mismo y el equipo es uno solo: una configuración, un lugar donde se cambia el límite de tasa, un lugar donde se lee quién entró. Se paga con acoplamiento: el día que las familias necesiten un límite distinto al de los docentes, ese cambio toca la pieza por la que entran los dos.'
    design:
      nodes:
        - id: madre
          type: actor
          label: Madre o padre
          zone: public
        - id: app
          type: mobile-client
          label: App de familias
          zone: public
        - id: docente
          type: actor
          label: Docente
          zone: public
        - id: consola
          type: web-client
          label: Consola del docente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: notas
          type: service
          label: Servicio de calificaciones
          zone: private
          role: grades-service
        - id: db
          type: database
          label: Base de calificaciones
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: madre-app
          from: { node: madre }
          to: { node: app }
          dataClass: public
        - id: docente-consola
          from: { node: docente }
          to: { node: consola }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-notas
          from: { node: gw }
          to: { node: notas }
          dataClass: personal
        - id: notas-db
          from: { node: notas }
          to: { node: db }
          dataClass: personal
  - label: una puerta por audiencia
    contextInversion: 'dos puertas ganan cuando las audiencias no se parecen en nada: las familias consultan desde afuera del colegio, en redes que no controlás, y los docentes cargan desde la sala de profesores. Cada puerta define su propio límite de tasa y su propia forma de autenticar sin negociar con la otra. Se paga con una unidad operativa más y con dos configuraciones que se pueden desincronizar sin que nadie lo note.'
    design:
      nodes:
        - id: madre
          type: actor
          label: Madre o padre
          zone: public
        - id: app
          type: mobile-client
          label: App de familias
          zone: public
        - id: docente
          type: actor
          label: Docente
          zone: public
        - id: consola
          type: web-client
          label: Consola del docente
          zone: public
        - id: gw-familias
          type: api-gateway
          label: Puerta de las familias
          zone: dmz
        - id: gw-escuela
          type: api-gateway
          label: Puerta del colegio
          zone: dmz
        - id: notas
          type: service
          label: Servicio de calificaciones
          zone: private
          role: grades-service
        - id: db
          type: database
          label: Base de calificaciones
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: madre-app
          from: { node: madre }
          to: { node: app }
          dataClass: public
        - id: docente-consola
          from: { node: docente }
          to: { node: consola }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw-familias }
          dataClass: personal
        - id: consola-gw
          from: { node: consola }
          to: { node: gw-escuela }
          dataClass: personal
        - id: gwf-notas
          from: { node: gw-familias }
          to: { node: notas }
          dataClass: personal
        - id: gwe-notas
          from: { node: gw-escuela }
          to: { node: notas }
          dataClass: personal
        - id: notas-db
          from: { node: notas }
          to: { node: db }
          dataClass: personal
status: PILOT
---

Un colegio de **1.400 alumnos**. Dos programas contra el mismo sistema de
calificaciones: la app donde las familias miran las notas, y la consola donde
los docentes las cargan.

El reglamento que firmó el consejo escolar dice una sola cosa sobre esto:

> *"Toda consulta de una calificación entra por un único punto, donde se
> verifica quién pregunta."*

Hace cuatro meses, en una semana con quejas de lentitud, alguien conectó la app
de familias directo al servicio de calificaciones. El argumento fue **"la puerta
de entrada agrega 40 ms"**. Ese número no está medido en ningún lado: salió de
una conversación en un pasillo y quedó escrito en el ticket como si fuera un
requisito.

Ahora hay dos maneras de llegar a una nota. Una pasa por el punto donde se
verifica quién pregunta. La otra no.

**Sacá el atajo y dejá a las dos audiencias adentro.** Ojo con la mitad fácil:
borrar la conexión es un gesto de un segundo, y deja a 900 familias sin poder
consultar nada. El requisito no era cerrar una puerta. Era que todos entren por
una.
