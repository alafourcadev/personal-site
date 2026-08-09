---
title: "La historia clínica que vive en dos lugares"
level: 11
role: core
domain: salud
D1: 3
D2: 3
D3: 4
D4: 4
D5: 3
D6: 3
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 7
aiBudget: "libre, pero la respuesta tiene que decir quién es el dueño de la historia clínica vieja durante la convivencia, y qué pasa el día que el sistema viejo se apague."
lambda: 0.5
constraints:
  - metric: historias clínicas activas en el sistema viejo
    operator: ">="
    value: 1900000
    unit: historias
  - metric: retención legal de la historia clínica
    operator: ">="
    value: 15
    unit: años
hiddenFacts:
  - fact: "1,9 millones de historias clínicas viven en el sistema viejo y no se pueden trasladar de una vez: la conversión de un solo hospital tarda once horas y la clínica no cierra."
    discoveryPath: "es la razón por la que este ejercicio no tiene una opción de 'migrar todo y apagar'. Diseñá para un período donde una parte de las historias vive de un lado y otra parte del otro, y las dos se tienen que poder leer."
  - fact: "un médico de guardia no sabe, ni tiene por qué saber, en cuál de los dos sistemas está la historia del paciente que tiene adelante. Si tiene que elegir sistema, va a elegir mal en el peor momento."
    discoveryPath: "preguntate qué ve el médico. Si la respuesta depende de dónde esté el dato, la migración se le está delegando a la persona que atiende, y esa persona no está en el diagrama."
  - fact: la historia clínica es dato regulado con quince años de retención. La base vieja tiene respaldo diario y la nueva también, y ninguna de las dos se puede quedar sin él durante la convivencia.
    discoveryPath: "el motor bloquea el diseño en cuanto un dato regulado entra a una base sin respaldo, así que el error se ve al probar la respuesta. Lo que no se ve solo es el otro riesgo: que durante la convivencia haya escrituras que lleguen a una sola de las dos bases."
startingDesign:
  nodes:
    - id: medico
      type: actor
      label: Médico de guardia
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Estación clínica
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: viejo
      type: service
      label: Historia clínica (sistema viejo)
      zone: private
      role: legacy-clinical
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Historia clínica (sistema nuevo)
      zone: private
      role: new-clinical
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: dbviejo
      type: database
      label: Repositorio clínico viejo
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 430 }
    - id: dbnuevo
      type: database
      label: Repositorio clínico nuevo
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 540 }
  edges:
    - id: medico-web
      from: { node: medico }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: regulated
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: regulated
    - id: viejo-dbviejo
      from: { node: viejo }
      to: { node: dbviejo }
      dataClass: regulated
    - id: nuevo-dbnuevo
      from: { node: nuevo }
      to: { node: dbnuevo }
      dataClass: regulated
guarantees:
  - id: g-legacy-standing
    label: el sistema viejo sigue desplegado y entero
    weight: 1
    predicate:
      op: exists
      node:
        type: [service]
        role: legacy-clinical
    whyMissing: el sistema viejo no está en el diseño, así que no hay a dónde volver ni quién responda por las historias que todavía no se trasladaron.
    consequence: "una migración que empieza por dar de baja el sistema viejo no es una migración, es un reemplazo con las manos atadas. Con 1,9 millones de historias y once horas de conversión por hospital, el período en que las dos versiones tienen que estar vivas se mide en meses."
  - id: g-old-data-reachable
    label: el sistema nuevo puede leer las historias que todavía viven del lado viejo
    weight: 2
    predicate:
      op: any
      of:
        - op: path
          from:
            role: new-clinical
          to:
            role: legacy-store
          forbid:
            role: legacy-clinical
        - op: path
          from:
            role: new-clinical
          to:
            role: legacy-clinical
    whyMissing: el sistema nuevo no llega a las historias viejas ni leyendo el repositorio viejo ni pidiéndoselas al sistema viejo.
    consequence: "el médico de guardia abre la estación clínica y ve media historia. La otra mitad existe, está a treinta metros y es inalcanzable desde donde está mirando. La migración se le delegó a la persona que atiende, que ahora tiene que adivinar en qué sistema buscar."
  - id: g-writes-in-both
    label: durante la convivencia la escritura llega a los dos repositorios
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: new-store
        - op: path
          from:
            type: [api-gateway]
          to:
            role: legacy-store
    whyMissing: hay un repositorio al que el tráfico real no llega, así que uno de los dos se está quedando atrás mientras el otro avanza.
    consequence: "con quince años de retención legal, un repositorio que dejó de recibir escrituras no es una copia vieja: es un expediente incompleto. El día que haya que volver atrás, o que un juez pida la historia completa, la respuesta va a estar partida en dos y ninguna de las dos mitades va a ser la verdad."
  - id: g-front-door-closed
    label: la puerta de entrada ya no llama al sistema viejo
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-clinical
    whyMissing: la puerta de entrada sigue teniendo una conexión directa al sistema viejo, así que la estación clínica todavía puede terminar hablándole a la versión que se está reemplazando.
    consequence: "mientras exista esa puerta, el sistema viejo tiene dos clases de tráfico: el que le llega por la convivencia y el que le llega porque nadie cambió una configuración. El día del apagado, la segunda clase es la que rompe algo que nadie sabía que existía."
rubric:
  - dimension: el sistema viejo sigue en pie durante toda la convivencia
    signal:
      kind: predicate
      guaranteeId: g-legacy-standing
  - dimension: una sola vista devuelve la historia completa, esté donde esté
    signal:
      kind: predicate
      guaranteeId: g-old-data-reachable
  - dimension: ningún repositorio se queda atrás mientras dure el traslado
    signal:
      kind: predicate
      guaranteeId: g-writes-in-both
  - dimension: existe un solo camino de entrada al dominio clínico
    signal:
      kind: predicate
      guaranteeId: g-front-door-closed
referenceSolutions:
  - label: el sistema nuevo lee el repositorio viejo directamente
    contextInversion: "leer el repositorio viejo directamente conviene cuando el sistema viejo es lento, frágil o cobra por llamada, y el esquema de datos se entiende bien: la lectura no depende de que ese sistema esté arriba, y el traslado avanza copiando tablas sin pedirle permiso a nadie. El precio es acoplarse al esquema interno de un sistema que se quiere apagar, donde cualquier cambio rompe al nuevo, y perder toda la lógica que el viejo aplicaba al leer, que hay que reimplementar sin equivocarse."
    design:
      nodes:
        - id: medico
          type: actor
          label: Médico de guardia
          zone: public
        - id: web
          type: web-client
          label: Estación clínica
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador clínico
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Historia clínica (sistema nuevo)
          zone: private
          role: new-clinical
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Historia clínica (sistema viejo)
          zone: private
          role: legacy-clinical
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Repositorio clínico viejo
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Repositorio clínico nuevo
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: medico-web
          from: { node: medico }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: regulated
        - id: gw-enrutador
          from: { node: gw }
          to: { node: enrutador }
          dataClass: regulated
        - id: enrutador-nuevo
          from: { node: enrutador }
          to: { node: nuevo }
          dataClass: regulated
        - id: enrutador-viejo
          from: { node: enrutador }
          to: { node: viejo }
          dataClass: regulated
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: regulated
        - id: nuevo-dbviejo
          from: { node: nuevo }
          to: { node: dbviejo }
          dataClass: regulated
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: regulated
  - label: el sistema nuevo le pide las historias viejas al sistema viejo
    contextInversion: "pedírselas al sistema viejo conviene cuando ese sistema tiene reglas clínicas propias (qué campos se muestran, qué se oculta, cómo se resuelve un duplicado) que nadie quiere reimplementar dos veces: el viejo sigue siendo el dueño de sus datos hasta el final y el nuevo no se entera de su esquema interno, así que el día del apagado no hay que reescribir consultas. El precio es que cada lectura de una historia vieja necesita que el sistema viejo esté arriba: su disponibilidad se le suma a la del nuevo, y su latencia también."
    design:
      nodes:
        - id: medico
          type: actor
          label: Médico de guardia
          zone: public
        - id: web
          type: web-client
          label: Estación clínica
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Historia clínica (sistema nuevo)
          zone: private
          role: new-clinical
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Historia clínica (sistema viejo)
          zone: private
          role: legacy-clinical
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Repositorio clínico viejo
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Repositorio clínico nuevo
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: medico-web
          from: { node: medico }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: regulated
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: regulated
        - id: nuevo-viejo
          from: { node: nuevo }
          to: { node: viejo }
          dataClass: regulated
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: regulated
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: regulated
        - id: nuevo-monitoreo
          from: { node: nuevo }
          to: { node: monitoreo }
          dataClass: public
        - id: viejo-monitoreo
          from: { node: viejo }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una red de clínicas con **1,9 millones de historias clínicas activas** está
reemplazando el sistema que las guarda. El viejo tiene catorce años. El nuevo
está en producción desde hace tres meses, con los pacientes nuevos.

El traslado de las historias existentes no se puede hacer de una vez. La
conversión de un solo hospital tarda **once horas** y las clínicas no cierran.
El plan real, el que está escrito en el cronograma, es un hospital por fin de
semana durante ocho meses.

Eso significa ocho meses en los que **una parte de las historias vive de un
lado y otra parte del otro**. No es un estado de transición: es el estado del
sistema durante casi un año.

Y hay alguien en el medio que no está en ningún diagrama. El médico de
guardia abre la estación clínica con un paciente adelante y **no sabe en cuál
de los dos sistemas está su historia**. No tiene por qué saberlo. Si el
diseño le pide que elija sistema, va a elegir mal exactamente en el momento
en que menos margen hay.

La historia clínica es dato regulado, con **quince años de retención**. Las
dos bases tienen respaldo diario y ninguna se puede quedar sin él. Pero el
riesgo que no salta a la vista es otro: si durante estos ocho meses una
escritura llega a un solo repositorio, el expediente queda partido en dos y
ninguna de las dos mitades es la verdad.

**Rearmá el sistema** para que el sistema viejo siga en pie y siga sirviendo,
para que una sola vista devuelva la historia completa esté donde esté, y para
que ninguno de los dos repositorios se quede atrás mientras dure el traslado.
