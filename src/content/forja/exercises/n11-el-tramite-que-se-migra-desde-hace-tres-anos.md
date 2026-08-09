---
title: "El trámite que se migra desde hace tres años"
level: 11
role: synthesis
domain: gobierno
D1: 3
D2: 4
D3: 4
D4: 4
D5: 4
D6: 3
D7: 3
D8: 2
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que sostener las tres cosas a la vez: que las dos versiones sirven, que se puede volver atrás, y que dentro de tres años alguien va a poder saber cuál atendió qué."
lambda: 0.5
constraints:
  - metric: habilitaciones tramitadas por año
    operator: ">="
    value: 2100000
    unit: trámites/año
  - metric: tiempo que lleva la convivencia entre las dos versiones
    operator: ">="
    value: 3
    unit: años
  - metric: retención legal del expediente de habilitación
    operator: ">="
    value: 10
    unit: años
hiddenFacts:
  - fact: "la migración empezó hace tres años con un plan de dieciocho meses. Cambiaron dos veces las autoridades del organismo y ninguna de las dos decidió detenerla ni terminarla: el estado intermedio sobrevivió a los dos mandatos que lo iban a cerrar."
    discoveryPath: "es el supuesto que este ejercicio pide abandonar. Diseñá el estado intermedio como el estado permanente del sistema, porque en la práctica lo es: la pieza de transición va a durar más que el equipo que la puso."
  - fact: "el sistema viejo no lo mantiene el organismo: lo mantiene un contrato con un proveedor que se renueva cada año. La última renovación tardó siete meses en firmarse y durante ese tiempo nadie podía desplegar nada del lado viejo."
    discoveryPath: "preguntate qué podés cambiar del lado viejo en un mes cualquiera. Si la respuesta es 'nada sin una firma', entonces toda la mecánica de la convivencia tiene que vivir del lado que sí controlás."
  - fact: "el expediente de habilitación tiene diez años de retención legal y se usa en juicios. En dos causas del año pasado el organismo no pudo demostrar qué versión del sistema había resuelto el trámite en disputa."
    discoveryPath: "preguntate cómo probarías, dentro de tres años y frente a un juez, cuál de las dos versiones resolvió un trámite puntual. Si la única fuente es la memoria de alguien del equipo, no tenés prueba."
  - fact: si la puerta de entrada sigue llamando al sistema viejo por su cuenta, ese camino sobrevive a cualquier plan de apagado, porque nadie lo tiene anotado en ningún lado.
    discoveryPath: "contá cuántos lugares distintos del diseño deciden hoy quién atiende un trámite. Cada uno de esos lugares es una ruta que alguien va a olvidar el día del corte."
startingDesign:
  nodes:
    - id: ciudadano
      type: actor
      label: Ciudadano
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Portal de trámites
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
      label: Habilitaciones (sistema del proveedor)
      zone: private
      role: legacy-permits
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Habilitaciones (sistema propio)
      zone: private
      role: new-permits
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: dbviejo
      type: database
      label: Expedientes (base del proveedor)
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 430 }
    - id: dbnuevo
      type: database
      label: Expedientes (base propia)
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 540 }
  edges:
    - id: ciudadano-web
      from: { node: ciudadano }
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
      dataClass: regulated
    - id: nuevo-dbnuevo
      from: { node: nuevo }
      to: { node: dbnuevo }
      dataClass: regulated
guarantees:
  - id: g-legacy-standing
    label: el sistema del proveedor sigue desplegado y entero
    weight: 1
    predicate:
      op: exists
      node:
        type: [service]
        role: legacy-permits
    whyMissing: el sistema viejo no está en el diseño, así que no hay a dónde volver ni quién responda por los trámites que todavía resuelve él.
    consequence: "el organismo no controla ese sistema: lo mantiene un contrato que la última vez tardó siete meses en renovarse. Dar de baja lo único que sabe resolver dos millones de trámites al año, para reemplazarlo por algo que todavía está en convivencia, es una decisión que no se puede deshacer con un despliegue."
  - id: g-both-serving
    label: las dos versiones atienden trámites reales al mismo tiempo
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: legacy-permits
        - op: path
          from:
            type: [api-gateway]
          to:
            role: new-permits
    whyMissing: falta el camino desde la puerta de entrada hasta alguna de las dos versiones, así que no hay convivencia. Hay una versión sirviendo y otra esperando su turno.
    consequence: "con 2,1 millones de trámites al año y tres años de convivencia, el traslado avanza por tipo de trámite y no de golpe. Si sólo una versión atiende, el corte vuelve a ser un salto de todo o nada, y este organismo ya demostró dos veces que no puede sostener una fecha."
  - id: g-single-switch
    label: la puerta de entrada no habla con el sistema del proveedor
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-permits
    whyMissing: la puerta de entrada llama al sistema viejo directamente, así que hay más de un lugar donde se decide quién atiende un trámite.
    consequence: "ese camino directo no está anotado en ningún plan de apagado, porque nadie lo puso ahí a propósito: quedó. Va a sobrevivir a los tres años de migración y va a aparecer el día del corte, cuando una parte del tráfico que nadie sabía que existía deje de funcionar sin un solo error en el despliegue."
  - id: g-branches-watched
    label: cada versión está observada por separado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay servicios sin ninguna conexión a un componente de monitoreo, así que no queda registro de qué versión atendió cada trámite.
    consequence: "el expediente de habilitación tiene diez años de retención y se usa en juicios. El año pasado, en dos causas, el organismo no pudo demostrar qué versión había resuelto el trámite en disputa. Sin señal por rama, la respuesta dentro de tres años va a depender de que alguien del equipo se acuerde."
  - id: g-rollback-data
    label: la base del proveedor se mantiene al día durante toda la convivencia
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-store
    whyMissing: no hay ningún camino desde el tráfico real hasta la base del proveedor, así que ese expediente es una foto del día en que empezó la convivencia.
    consequence: "volver atrás con una base desactualizada no es cambiar una ruta: es reconstruir a mano los trámites del período, con reglas distintas de las que se aplicaron. Y para un organismo público eso no es un problema técnico: es un ciudadano con dos resoluciones diferentes sobre el mismo expediente."
rubric:
  - dimension: el sistema que no se controla sigue en pie mientras dure la transición
    signal:
      kind: predicate
      guaranteeId: g-legacy-standing
  - dimension: las dos versiones conviven sirviendo tráfico real
    signal:
      kind: predicate
      guaranteeId: g-both-serving
  - dimension: existe un único lugar donde se decide quién atiende
    signal:
      kind: predicate
      guaranteeId: g-single-switch
  - dimension: dentro de tres años se puede probar qué versión resolvió un trámite
    signal:
      kind: predicate
      guaranteeId: g-branches-watched
  - dimension: volver atrás sigue siendo una decisión de operación
    signal:
      kind: predicate
      guaranteeId: g-rollback-data
referenceSolutions:
  - label: un enrutador propio decide por tipo de trámite
    contextInversion: "poner el enrutador del lado que el organismo controla es lo correcto cuando el sistema viejo no se puede tocar sin una firma: la regla de reparto vive en una pieza propia, se cambia el mismo día, y ni el proveedor ni el contrato entran en la conversación. Los dos sistemas reciben el trámite en el mismo momento, así que la base vieja nunca se atrasa y volver atrás es cambiar una configuración. Se paga con la confirmación del trámite atada a que los dos sistemas respondan: la disponibilidad del proveedor pasa a ser también la del organismo."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: web
          type: web-client
          label: Portal de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador de trámites
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Habilitaciones (sistema del proveedor)
          zone: private
          role: legacy-permits
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Habilitaciones (sistema propio)
          zone: private
          role: new-permits
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Expedientes (base del proveedor)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Expedientes (base propia)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: ciudadano-web
          from: { node: ciudadano }
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
          dataClass: regulated
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: regulated
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
  - label: el sistema propio atiende y replica al del proveedor por un registro
    contextInversion: "que el sistema propio atienda todo y replique al del proveedor por un registro durable conviene cuando el proveedor no puede sostener el ritmo del organismo: sus siete meses sin poder desplegar, sus ventanas de mantenimiento y su latencia dejan de estar en el camino del ciudadano, porque el trámite se confirma con el sistema propio solo y el viejo se pone al día a su ritmo. El precio es un atraso real entre las dos bases, de segundos pero real, y dos piezas más para operar durante los tres años que dure esto."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: app
          type: mobile-client
          label: App de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Habilitaciones (sistema propio)
          zone: private
          role: new-permits
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: stream
          label: Registro de trámites resueltos
          zone: private
          props: { retention: "7d", partitions: "12" }
        - id: repetidor
          type: worker
          label: Repetidor hacia el sistema del proveedor
          zone: private
        - id: viejo
          type: service
          label: Habilitaciones (sistema del proveedor)
          zone: private
          role: legacy-permits
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Expedientes (base del proveedor)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Expedientes (base propia)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: ciudadano-app
          from: { node: ciudadano }
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
        - id: nuevo-registro
          from: { node: nuevo }
          to: { node: registro }
          dataClass: personal
        - id: registro-repetidor
          from: { node: registro }
          to: { node: repetidor }
          dataClass: personal
        - id: repetidor-viejo
          from: { node: repetidor }
          to: { node: viejo }
          dataClass: personal
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: regulated
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: regulated
        - id: nuevo-monitoreo
          from: { node: nuevo }
          to: { node: monitoreo }
          dataClass: public
        - id: viejo-monitoreo
          from: { node: viejo }
          to: { node: monitoreo }
          dataClass: public
        - id: registro-monitoreo
          from: { node: registro }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Un organismo público tramita **2,1 millones de habilitaciones por año**:
comercios, transportes, obras. El sistema que las resuelve no es suyo: lo
mantiene un proveedor, con un contrato que se renueva cada año. La última
renovación **tardó siete meses en firmarse**, y durante esos siete meses
nadie pudo desplegar nada del lado viejo.

Hace tres años empezó la migración a un sistema propio, con un plan de
dieciocho meses. Cambiaron dos veces las autoridades del organismo. Ninguna
de las dos la detuvo ni la terminó. **El estado intermedio sobrevivió a los
dos mandatos que lo iban a cerrar**, y hoy es, en los hechos, el estado
permanente del sistema.

Este ejercicio junta las tres cosas que el nivel viene enseñando por
separado, y las pide al mismo tiempo.

**Las dos versiones tienen que servir.** El traslado avanza por tipo de
trámite, no de golpe, y va a seguir avanzando durante años.

**Volver atrás tiene que seguir siendo posible.** Si la base del proveedor se
queda atrás, volver no es cambiar una ruta: es reconstruir a mano los
trámites del período, con reglas distintas de las que se aplicaron. Para un
organismo público eso no es un problema técnico, es un ciudadano con dos
resoluciones diferentes sobre el mismo expediente.

**Y dentro de tres años alguien va a preguntar quién resolvió qué.** El
expediente de habilitación tiene diez años de retención y se usa en juicios.
El año pasado, en dos causas, el organismo **no pudo demostrar qué versión
del sistema había resuelto el trámite en disputa**.

Una restricción más, y condiciona todo lo demás: del lado viejo no se puede
cambiar nada sin una firma que tarda meses. **Toda la mecánica de la
convivencia tiene que vivir del lado que el organismo controla.**

**Rearmá el sistema** para que las dos versiones atiendan trámites reales,
para que la decisión de quién atiende viva en un solo lugar propio, para que
la base del proveedor no se atrase ni un día, y para que dentro de tres años
se pueda probar cuál de las dos resolvió cada expediente.
