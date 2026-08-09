---
title: "El siniestro que nadie sabe que se trabó"
level: 5
role: synthesis
domain: seguros
D1: 2
D2: 2
D3: 3
D4: 1
D5: 3
D6: 3
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que justificar cada pieza que agregaste contra el presupuesto: qué señal compra, y qué se rompería sin ella."
lambda: 0.5
constraints:
  - metric: siniestros denunciados por mes
    operator: ">="
    value: 5400
    unit: siniestros/mes
  - metric: tiempo prometido al asegurado para la asignación de perito
    operator: "<="
    value: 24
    unit: horas
hiddenFacts:
  - fact: el estudio de peritaje devuelve un 200 cuando recibe la denuncia, pero si su cola interna está llena la descarta sin avisar. En febrero descartó 340.
    discoveryPath: "es la razón por la que la denuncia tiene que quedar durable de este lado antes de salir. Si el único registro de que la mandaste es que el tercero dijo que sí, no tenés registro."
  - fact: las fotos que sube el asegurado hoy viven sólo dentro del cuerpo del pedido y se descartan cuando el pedido termina.
    discoveryPath: "seguí el camino de una foto desde la app hasta donde queda guardada. Si no llega a ningún almacenamiento, el perito llega al lugar sin ver lo que había el primer día."
  - fact: nadie mide cuántas denuncias entraron y cuántas salieron hacia el perito. Los dos números se calculan a mano, una vez por mes, y en febrero no coincidieron por 340.
    discoveryPath: "conectá cada pieza del camino al monitoreo y fijate cuál te dice cuánto trabajo quedó sin salir. Esa diferencia es el incidente antes de que sea un incidente."
startingDesign:
  nodes:
    - id: asegurado
      type: actor
      label: Asegurado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de denuncias
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: siniestros
      type: service
      label: Servicio de siniestros
      zone: private
      role: claims-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: basesiniestros
      type: database
      label: Base de siniestros
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: perito
      type: external-provider
      label: Estudio de peritaje
      zone: dmz
      role: assessor
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: asegurado-app
      from: { node: asegurado }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-siniestros
      from: { node: gw }
      to: { node: siniestros }
      dataClass: personal
    - id: siniestros-basesiniestros
      from: { node: siniestros }
      to: { node: basesiniestros }
      dataClass: personal
    - id: siniestros-perito
      from: { node: siniestros }
      to: { node: perito }
      dataClass: personal
guarantees:
  - id: g-services-observed
    label: todos los servicios reportan lo que les pasa
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: el tiempo de detección pasa a ser el tiempo que tarda alguien en enojarse. Con 5.400 denuncias por mes, ese alguien llama al defensor del asegurado antes que a la compañía.
  - id: g-buffer-observed
    label: alguien mira cuánto trabajo se está acumulando
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza donde se acumulan las denuncias pendientes de asignar no está conectada a ningún componente de monitoreo.
    consequence: la diferencia entre lo que entró y lo que salió crece durante días sin que nada se queje. En febrero esa diferencia fue de 340 denuncias y se calculó a mano, a fin de mes.
  - id: g-claim-durable
    label: la denuncia llega al estudio de peritaje aunque el servicio se reinicie
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: claims-service
      to:
        role: assessor
    whyMissing: no hay ninguna pieza durable entre el servicio de siniestros y el estudio de peritaje. Hoy la denuncia sale en el mismo pedido que la recibió, y si el proceso se reinicia en el medio no queda rastro de que había que mandarla.
    consequence: el asegurado denuncia, ve la confirmación en la app, y nadie le asigna un perito nunca. La promesa de 24 horas se incumple sin que se registre un solo error.
  - id: g-evidence-archived
    label: las fotos del siniestro quedan guardadas fuera del pedido que las trajo
    weight: 2
    predicate:
      op: path
      from:
        role: claims-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de siniestros hasta un almacenamiento de objetos, así que las fotos existen sólo mientras dura el pedido que las subió.
    consequence: el perito llega tres días después y ve el auto ya movido, la vereda ya limpia y el agua ya bajada. La prueba del primer día no se puede volver a tomar.
rubric:
  - dimension: la cobertura de señal alcanza a todos los servicios, no a los más visibles
    signal:
      kind: predicate
      guaranteeId: g-services-observed
  - dimension: la diferencia entre lo que entra y lo que sale es una señal del sistema, no una planilla de fin de mes
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
  - dimension: la denuncia sobrevive a un reinicio y a un tercero que dice que sí y descarta
    signal:
      kind: predicate
      guaranteeId: g-claim-durable
  - dimension: la evidencia del primer día queda guardada donde se pueda volver a leer
    signal:
      kind: predicate
      guaranteeId: g-evidence-archived
referenceSolutions:
  - label: cola de asignación, evidencia escrita por el propio servicio
    contextInversion: "que el servicio escriba la evidencia y encole la asignación es lo correcto cuando la foto tiene que quedar guardada antes de responderle al asegurado, porque si el guardado falla la denuncia se rechaza y la persona la vuelve a intentar con el auto todavía en el lugar, y cuando la asignación al perito es el único consumidor del evento. Es la topología con menos piezas que cumple las cuatro obligaciones, y deja una unidad operativa de margen."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: app
          type: mobile-client
          label: App de denuncias
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2" }
        - id: basesiniestros
          type: database
          label: Base de siniestros
          zone: restricted
          props: { backup: "diario" }
        - id: evidencia
          type: object-storage
          label: Archivo de evidencia
          zone: private
        - id: cola
          type: queue
          label: Cola de asignación de perito
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachador
          type: worker
          label: Despachador de asignaciones
          zone: private
        - id: perito
          type: external-provider
          label: Estudio de peritaje
          zone: dmz
          role: assessor
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: asegurado-app
          from: { node: asegurado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: personal
        - id: siniestros-basesiniestros
          from: { node: siniestros }
          to: { node: basesiniestros }
          dataClass: personal
        - id: siniestros-evidencia
          from: { node: siniestros }
          to: { node: evidencia }
          dataClass: personal
        - id: siniestros-cola
          from: { node: siniestros }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-perito
          from: { node: despachador }
          to: { node: perito }
          dataClass: personal
        - id: siniestros-monitoreo
          from: { node: siniestros }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: despachador-monitoreo
          from: { node: despachador }
          to: { node: monitoreo }
          dataClass: public
  - label: registro de eventos con un archivador y un despachador
    contextInversion: "un registro de eventos con dos consumidores conviene cuando el servicio de siniestros no puede quedarse esperando ninguna escritura, porque publica el hecho una vez y responde, y cuando el mismo evento le sirve al archivado y a la asignación por separado. Además permite reprocesar un rango de denuncias si el estudio de peritaje descartó un lote, sin pedirle nada al asegurado. Se paga con una unidad operativa más, que consume todo el margen del presupuesto, y con dos consumidores que hay que mirar en vez de uno."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: web
          type: web-client
          label: Portal de denuncias
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2" }
        - id: basesiniestros
          type: database
          label: Base de siniestros
          zone: restricted
          props: { backup: "diario" }
        - id: eventos
          type: stream
          label: Registro de denuncias
          zone: private
          props: { retention: "30d", partitions: "6" }
        - id: despachador
          type: worker
          label: Despachador de asignaciones
          zone: private
        - id: archivador
          type: worker
          label: Archivador de evidencia
          zone: private
        - id: evidencia
          type: object-storage
          label: Archivo de evidencia
          zone: private
        - id: perito
          type: external-provider
          label: Estudio de peritaje
          zone: dmz
          role: assessor
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: asegurado-web
          from: { node: asegurado }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: personal
        - id: siniestros-basesiniestros
          from: { node: siniestros }
          to: { node: basesiniestros }
          dataClass: personal
        - id: siniestros-eventos
          from: { node: siniestros }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-despachador
          from: { node: eventos }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-perito
          from: { node: despachador }
          to: { node: perito }
          dataClass: personal
        - id: eventos-archivador
          from: { node: eventos }
          to: { node: archivador }
          dataClass: personal
        - id: archivador-evidencia
          from: { node: archivador }
          to: { node: evidencia }
          dataClass: personal
        - id: siniestros-monitoreo
          from: { node: siniestros }
          to: { node: monitoreo }
          dataClass: public
        - id: eventos-monitoreo
          from: { node: eventos }
          to: { node: monitoreo }
          dataClass: public
        - id: despachador-monitoreo
          from: { node: despachador }
          to: { node: monitoreo }
          dataClass: public
        - id: archivador-monitoreo
          from: { node: archivador }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una aseguradora recibe **5.400 denuncias de siniestro por mes** desde la
app. El asegurado saca fotos, describe lo que pasó y le prometen un perito
**en menos de 24 horas**. El servicio de siniestros guarda la denuncia en
su base y, en el mismo pedido, se la manda al estudio de peritaje.

En febrero pasaron tres cosas y ninguna dejó un error en ningún lado.

**Una.** El estudio de peritaje devuelve un 200 cuando recibe la denuncia,
pero si su cola interna está llena la descarta. Descartó **340**. Del lado
de la aseguradora todo salió bien: el tercero dijo que sí.

**Dos.** El servicio de siniestros se reinició cuatro veces por despliegues
normales. Cada reinicio agarró denuncias entre "guardada" y "mandada". Esas
no las descartó nadie: nunca existieron como algo pendiente, porque el
único lugar donde constaba que había que mandarlas era la memoria del
proceso que se apagó.

**Tres.** Las fotos viven dentro del cuerpo del pedido y se descartan
cuando el pedido termina. Los peritos que sí llegaron, llegaron tres días
después: el auto ya estaba movido, la vereda limpia y el agua bajada.

Hay dos números: cuántas denuncias entraron y cuántas salieron hacia el
perito. Se calculan a mano una vez por mes. En febrero no coincidieron por
340, y ese fue el momento en que la compañía se enteró.

El equipo tiene **7 unidades operativas** y hoy usa 3. Cada pieza que
agregues sale de ahí, así que ninguna entra por las dudas.

**Rearmá el sistema entero.** Este ejercicio junta el nivel: la denuncia
tiene que sobrevivir a un reinicio y a un tercero que dice que sí y
descarta; la evidencia del primer día tiene que quedar guardada donde se
pueda volver a leer; y la diferencia entre lo que entra y lo que sale tiene
que ser una señal del sistema, no una planilla de fin de mes.
