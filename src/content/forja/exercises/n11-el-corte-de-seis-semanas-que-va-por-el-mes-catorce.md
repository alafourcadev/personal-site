---
title: "El corte de seis semanas que va por el mes catorce"
level: 11
role: core
domain: logistica
D1: 3
D2: 2
D3: 3
D4: 4
D5: 3
D6: 3
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 7
aiBudget: "libre, pero la respuesta tiene que explicar qué señal le diría al equipo, un martes cualquiera del mes catorce, cuál de las dos versiones contestó cada consulta."
lambda: 0.5
constraints:
  - metric: consultas de seguimiento de envío por día
    operator: ">="
    value: 1400000
    unit: consultas/día
  - metric: duración planificada de la convivencia entre las dos versiones
    operator: "<="
    value: 6
    unit: semanas
hiddenFacts:
  - fact: "la convivencia se planificó para seis semanas y va por el mes catorce. Nadie decidió extenderla: simplemente nunca hubo una semana en la que apagar el monolito fuera lo más urgente."
    discoveryPath: "es el supuesto que este ejercicio pide abandonar. Diseñá el estado intermedio como si fuera a durar años, porque el estado intermedio de una migración siempre dura más de lo que se planeó y casi nunca se rediseña cuando eso pasa."
  - fact: "en dos ocasiones la app y el portal contestaron cosas distintas sobre el mismo envío. Nadie pudo reconstruir cuál de las dos versiones había respondido cada vez: no había ninguna señal que lo dijera."
    discoveryPath: "preguntate cómo sabés hoy qué versión atendió una consulta puntual. Si la respuesta es 'mirando el código del enrutador', entonces no lo sabés: sabés qué debería haber pasado."
  - fact: "el servicio nuevo empezó leyendo la base del monolito para no duplicar datos. Fue la decisión más cómoda del primer mes y es la razón por la que hoy el monolito no se puede apagar: la base es suya y se apaga con él."
    discoveryPath: "conectá el servicio nuevo directo a la base del monolito y preguntate qué pasa el día que quieras dar de baja el monolito entero. Todo lo que lee de esa base hereda su fecha de apagado."
startingDesign:
  nodes:
    - id: destinatario
      type: actor
      label: Destinatario
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Portal de seguimiento
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
      label: Seguimiento (monolito)
      zone: private
      role: legacy-tracking
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Seguimiento (servicio nuevo)
      zone: private
      role: new-tracking
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: dbviejo
      type: database
      label: Base del monolito
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 430 }
    - id: dbnuevo
      type: database
      label: Base de seguimiento
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 540 }
  edges:
    - id: destinatario-web
      from: { node: destinatario }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: personal
    - id: viejo-dbviejo
      from: { node: viejo }
      to: { node: dbviejo }
      dataClass: personal
    - id: nuevo-dbnuevo
      from: { node: nuevo }
      to: { node: dbnuevo }
      dataClass: personal
guarantees:
  - id: g-both-serving
    label: las dos versiones atienden consultas reales al mismo tiempo
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: legacy-tracking
        - op: path
          from:
            type: [api-gateway]
          to:
            role: new-tracking
    whyMissing: falta el camino desde la puerta de entrada hasta alguna de las dos versiones, así que no hay convivencia. Hay una sola versión sirviendo y otra esperando.
    consequence: "una migración por partes necesita que las dos versiones estén vivas mientras dure el traslado, y ese traslado dura meses. Si sólo una atiende, el corte vuelve a ser un salto de todo o nada un domingo a la madrugada, que es exactamente lo que se estaba tratando de evitar."
  - id: g-single-switch
    label: la puerta de entrada no habla con el monolito
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-tracking
    whyMissing: la puerta de entrada llama al monolito directamente, así que hay más de un lugar donde se decide qué versión atiende una consulta.
    consequence: "cada camino directo que sobrevive a la migración es una ruta que alguien va a olvidar el día del apagado. El monolito se apaga, y una parte del tráfico que nadie sabía que existía deja de funcionar sin un solo error en el despliegue."
  - id: g-both-branches-watched
    label: cada versión está observada por separado
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay servicios sin ninguna conexión a un componente de monitoreo, así que no hay forma de saber cuál de las dos versiones atendió una consulta ni cómo le fue.
    consequence: "durante la convivencia el sistema tiene dos comportamientos posibles para la misma consulta. Sin una señal por rama, la única forma de saber cuál contestó es leer el código del enrutador y suponer. Cuando la app y el portal contesten distinto, no vas a poder reconstruir qué pasó."
  - id: g-no-shared-store
    label: el servicio nuevo no lee la base del monolito
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: new-tracking
      to:
        role: legacy-store
    whyMissing: el servicio nuevo está conectado a la base del monolito, así que su ciclo de vida quedó atado al de un sistema que se quiere apagar.
    consequence: "todo lo que lee de esa base hereda su fecha de apagado. El día que quieras dar de baja el monolito vas a descubrir que el servicio nuevo también depende de él, y la migración que creías terminada empieza de nuevo por el lado de los datos."
  - id: g-legacy-store-serving
    label: la base del monolito sigue respondiendo consultas mientras dure la convivencia
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-store
    whyMissing: no hay ningún camino desde el tráfico real hasta la base del monolito, así que los envíos que todavía viven ahí dejaron de ser consultables.
    consequence: "los envíos anteriores al corte siguen existiendo y siguen teniendo destinatarios que preguntan por ellos. Apagar el acceso a esos datos antes de haberlos trasladado no acelera la migración: convierte una consulta normal en un ticket de soporte."
rubric:
  - dimension: las dos versiones conviven sirviendo tráfico real
    signal:
      kind: predicate
      guaranteeId: g-both-serving
  - dimension: existe un único lugar donde se decide quién atiende
    signal:
      kind: predicate
      guaranteeId: g-single-switch
  - dimension: se puede saber qué versión respondió cada consulta
    signal:
      kind: predicate
      guaranteeId: g-both-branches-watched
  - dimension: el sistema nuevo se puede quedar cuando el viejo se apague
    signal:
      kind: predicate
      guaranteeId: g-no-shared-store
  - dimension: los envíos que todavía viven en el monolito siguen siendo consultables
    signal:
      kind: predicate
      guaranteeId: g-legacy-store-serving
referenceSolutions:
  - label: un enrutador reparte por antigüedad del envío
    contextInversion: "un enrutador que reparte es lo correcto cuando el criterio de corte es del negocio y cambia solo con el tiempo, como cuando los envíos anteriores a una fecha los atiende el monolito y los posteriores el servicio nuevo: la regla vive en una pieza que no es ninguno de los dos sistemas, se puede leer, se puede cambiar y se puede invertir. Se paga con una unidad operativa más y con una pieza que hay que mantener hasta el último día de la convivencia."
    design:
      nodes:
        - id: destinatario
          type: actor
          label: Destinatario
          zone: public
        - id: web
          type: web-client
          label: Portal de seguimiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador de consultas
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Seguimiento (monolito)
          zone: private
          role: legacy-tracking
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Seguimiento (servicio nuevo)
          zone: private
          role: new-tracking
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Base del monolito
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Base de seguimiento
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: destinatario-web
          from: { node: destinatario }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
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
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: personal
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: personal
        - id: enrutador-monitoreo
          from: { node: enrutador }
          to: { node: monitoreo }
          dataClass: public
        - id: viejo-monitoreo
          from: { node: viejo }
          to: { node: monitoreo }
          dataClass: public
        - id: nuevo-monitoreo
          from: { node: nuevo }
          to: { node: monitoreo }
          dataClass: public
  - label: el servicio nuevo adelante, delegando en el monolito lo que no migró
    contextInversion: "que el servicio nuevo esté adelante y delegue en el monolito lo que todavía no sabe responder conviene cuando la migración avanza por funcionalidad y no por fecha: cada capacidad que el nuevo aprende deja de delegarse, el monolito se queda sin trabajo solo, y el día del apagado no hay que coordinar a nadie más que a un servicio. Se paga con el servicio nuevo en el camino de absolutamente todo desde el primer día, y con el monolito escondido detrás de él, lo que hace más difícil ver cuánto trabajo sigue haciendo."
    design:
      nodes:
        - id: destinatario
          type: actor
          label: Destinatario
          zone: public
        - id: app
          type: mobile-client
          label: App de seguimiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Seguimiento (servicio nuevo)
          zone: private
          role: new-tracking
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Seguimiento (monolito)
          zone: private
          role: legacy-tracking
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Base del monolito
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Base de seguimiento
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: destinatario-app
          from: { node: destinatario }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
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
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: personal
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: personal
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

Una operadora logística responde **1,4 millones de consultas de seguimiento
por día**: gente que abre la app o el portal para ver dónde está su paquete.

El monolito que las contesta tiene doce años. Hace catorce meses arrancó la
migración a un servicio nuevo, con un plan de **seis semanas de convivencia**
y una fecha de apagado escrita en una diapositiva.

Nadie decidió extender esas seis semanas. Simplemente nunca hubo una semana
en la que apagar el monolito fuera lo más urgente que había para hacer. El
estado intermedio se volvió el estado normal, y **se diseñó para durar seis
semanas**.

Dos cosas se rompieron por eso.

La primera: en dos ocasiones la app y el portal contestaron cosas distintas
sobre el mismo envío. Nadie pudo reconstruir cuál de las dos versiones había
respondido cada vez, porque **ninguna señal lo decía**. La investigación
terminó en "mirá el código del enrutador y suponé".

La segunda es más cara. Para no duplicar datos al principio, el servicio
nuevo se conectó a la base del monolito. Fue la decisión más cómoda del
primer mes y es la razón por la que hoy el monolito no se puede apagar: esa
base es suya y se apaga con él. Todo lo que la lee **heredó su fecha de
apagado**.

Los envíos anteriores al corte, eso sí, siguen viviendo en el monolito y
siguen teniendo destinatarios que preguntan por ellos. Dejar de responder por
ellos no acelera nada: convierte una consulta normal en un ticket de soporte.

**Rearmá el sistema** para que las dos versiones convivan sirviendo tráfico
real, para que se pueda saber cuál contestó cada consulta, y para que el
servicio nuevo pueda seguir vivo el día en que el monolito se apague.
