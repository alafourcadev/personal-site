---
title: "La base que escriben dos equipos"
level: 3
role: core
domain: educacion
D1: 1
D2: 2
D3: 3
D4: 1
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que nombrar quién es el dueño del expediente académico y qué significa exactamente ser dueño de un dato."
lambda: 0.5
constraints:
  - metric: alumnos con expediente activo
    operator: ">="
    value: 11000
    unit: alumnos
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "las dos escrituras nacieron el mismo mes y ninguna de las dos sabe de la otra. Inscripciones escribe el campo `estado` con los valores que usa inscripciones; expediente escribe el mismo campo con los suyos."
    discoveryPath: "mirá las dos conexiones que llegan a la base académica en el lienzo. Dos flechas a la misma base son dos equipos que van a interpretar la misma columna distinto, y el sistema no tiene forma de avisarlo."
  - fact: "la caché de alumnos la agregó inscripciones para no consultar la base en cada pantalla. Guarda nombre, documento y domicilio."
    discoveryPath: "probá tu respuesta con esa conexión puesta: el motor la rechaza y explica por qué. Es la misma lección que el nivel viene repitiendo: el lugar donde vive un dato lo decide la clase de dato, no la velocidad que buscabas."
  - fact: "en el cuatrimestre pasado 143 alumnos aparecieron como inscriptos y sin cursada asignada. Nadie pudo decir cuál de los dos servicios había escrito último."
    discoveryPath: "es la consecuencia directa de dos escritores sobre la misma fila. Cuando el dato lo escribe un solo dueño, la pregunta '¿quién lo escribió?' tiene una sola respuesta posible."
startingDesign:
  nodes:
    - id: alumno
      type: actor
      label: Alumno
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del alumno
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
      role: enrollment-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: expediente
      type: service
      label: Servicio de expediente académico
      zone: private
      role: record-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: cachealumnos
      type: cache
      label: Caché de alumnos
      zone: private
      given: true
      position: { x: 805, y: 300 }
    - id: baseacademica
      type: database
      label: Base académica (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: alumno-portal
      from: { node: alumno }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-inscripciones
      from: { node: gw }
      to: { node: inscripciones }
      dataClass: personal
    - id: gw-expediente
      from: { node: gw }
      to: { node: expediente }
      dataClass: personal
    - id: inscripciones-base
      from: { node: inscripciones }
      to: { node: baseacademica }
      dataClass: regulated
    - id: expediente-base
      from: { node: expediente }
      to: { node: baseacademica }
      dataClass: regulated
    - id: inscripciones-cache
      from: { node: inscripciones }
      to: { node: cachealumnos }
      dataClass: personal
guarantees:
  - id: g-un-solo-escritor
    label: inscripciones no escribe directo en la base del expediente
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: enrollment-service
      to:
        type: [database]
    whyMissing: el servicio de inscripciones sigue teniendo una conexión directa a una base de datos.
    consequence: dos servicios escribiendo la misma fila son dos definiciones del mismo campo conviviendo sin contrato. El que escribe último gana, y nadie diseñó quién escribe último.
  - id: g-por-el-dueno
    label: lo que inscripciones necesita guardar llega al expediente a través de su dueño
    weight: 2
    predicate:
      op: path
      from:
        role: enrollment-service
      to:
        type: [database]
      via:
        role: record-service
    whyMissing: no hay ningún camino desde el servicio de inscripciones hasta la base que pase por el servicio de expediente académico.
    consequence: "sacar la conexión directa sin poner otra vía no arregla nada: deja al alumno inscripto en un sistema y sin expediente en el otro. Ser dueño de un dato significa que toda escritura pasa por vos, no que los demás dejen de escribir."
  - id: g-sin-copia-volatil
    label: los datos personales del alumno no se copian a un almacenamiento volátil
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: enrollment-service
      to:
        type: [cache]
    whyMissing: el servicio de inscripciones sigue copiando nombre, documento y domicilio a la caché de alumnos.
    consequence: "el dato personal termina duplicado en una pieza que nadie respalda, nadie audita y nadie borra cuando el alumno pide que lo borren. La caché no es gratis: es una segunda casa del mismo dato con reglas distintas."
rubric:
  - dimension: el expediente académico tiene un solo dueño que lo escribe
    signal:
      kind: predicate
      guaranteeId: g-un-solo-escritor
  - dimension: quitar la escritura directa no deja al alumno sin expediente
    signal:
      kind: predicate
      guaranteeId: g-por-el-dueno
  - dimension: la clase de dato decide dónde puede haber una copia
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-volatil
referenceSolutions:
  - label: inscripciones le pide al expediente y espera la respuesta
    contextInversion: "pedirle al dueño y esperar es lo correcto cuando el alumno tiene que ver el resultado en la misma pantalla en la que se inscribió: si el expediente rechaza la inscripción por una materia adeudada, el alumno se entera en el momento y no dos minutos después por correo. Se paga con que una caída del servicio de expediente frena las inscripciones."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Alumno
          zone: public
        - id: portal
          type: web-client
          label: Portal del alumno
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: inscripciones
          type: service
          label: Servicio de inscripciones
          zone: private
          role: enrollment-service
          props: { criticality: "high", replicas: "2" }
        - id: expediente
          type: service
          label: Servicio de expediente académico
          zone: private
          role: record-service
          props: { criticality: "high", replicas: "2" }
        - id: baseacademica
          type: database
          label: Base académica (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-inscripciones
          from: { node: gw }
          to: { node: inscripciones }
          dataClass: personal
        - id: gw-expediente
          from: { node: gw }
          to: { node: expediente }
          dataClass: personal
        - id: inscripciones-expediente
          from: { node: inscripciones }
          to: { node: expediente }
          dataClass: regulated
        - id: expediente-base
          from: { node: expediente }
          to: { node: baseacademica }
          dataClass: regulated
  - label: inscripciones deja la novedad en una cola y el expediente la aplica
    contextInversion: "dejar la novedad y seguir conviene en la semana de inscripciones, cuando entran once mil alumnos en cuatro días y el expediente no puede absorber ese pico en el momento: la inscripción se acepta igual, el expediente aplica a su ritmo y una caída del expediente no frena la inscripción. Se paga con una ventana en la que el alumno está inscripto y su expediente todavía no lo dice, y con una pieza más para operar."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Alumno
          zone: public
        - id: portal
          type: web-client
          label: Portal del alumno
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: inscripciones
          type: service
          label: Servicio de inscripciones
          zone: private
          role: enrollment-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de novedades de inscripción
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: expediente
          type: service
          label: Servicio de expediente académico
          zone: private
          role: record-service
          props: { criticality: "high", replicas: "2" }
        - id: baseacademica
          type: database
          label: Base académica (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-inscripciones
          from: { node: gw }
          to: { node: inscripciones }
          dataClass: personal
        - id: gw-expediente
          from: { node: gw }
          to: { node: expediente }
          dataClass: personal
        - id: inscripciones-cola
          from: { node: inscripciones }
          to: { node: cola }
          dataClass: regulated
        - id: cola-expediente
          from: { node: cola }
          to: { node: expediente }
          dataClass: regulated
        - id: expediente-base
          from: { node: expediente }
          to: { node: baseacademica }
          dataClass: regulated
status: PILOT
---

Una universidad con **11.000 alumnos con expediente activo**. Dos servicios,
dos equipos, una sola base.

El servicio de inscripciones escribe en la base académica cuando el alumno se
anota. El servicio de expediente académico escribe en la misma base cuando
carga una nota, una equivalencia o una baja. Los dos tocan la misma fila del
mismo alumno. Los dos escriben el campo `estado`. Ninguno de los dos equipos
sabía que el otro lo escribía.

El cuatrimestre pasado **143 alumnos** quedaron inscriptos y sin cursada
asignada. Nadie pudo reconstruir cuál de los dos servicios había escrito
último, porque la respuesta a esa pregunta es "el que llegó después" y eso no
está diseñado en ningún lado: pasa.

Hay una pieza más. Inscripciones se armó una **caché de alumnos** para no
consultar la base en cada pantalla. Adentro hay nombre, documento y
domicilio de los once mil.

El equipo tiene **5 unidades operativas**.

**Rearmá el sistema** para que el expediente académico tenga un solo dueño que
lo escribe, y para que el dato personal del alumno deje de tener una segunda
casa que nadie respalda ni borra. Inscripciones tiene que seguir pudiendo dejar
su novedad: quitar la conexión y no poner nada en su lugar deja al alumno
anotado y sin expediente.
