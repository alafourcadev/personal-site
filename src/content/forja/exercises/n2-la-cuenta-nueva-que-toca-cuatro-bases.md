---
title: "La cuenta nueva que toca cuatro bases"
level: 2
role: synthesis
domain: banca
D1: 1
D2: 2
D3: 2
D4: 1
D5: 2
D6: 2
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué pieza sacaste y por qué el negocio no la extraña. Una consolidación sin ese porqué es una poda a ciegas."
lambda: 0.5
constraints:
  - metric: solicitudes de apertura de cuenta por día
    operator: ">="
    value: 2100
    unit: solicitudes/día
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: el servicio de documentos no tiene ninguna regla propia. Recibe el archivo, lo guarda en la base y devuelve un identificador.
    discoveryPath: "preguntá qué decide cada pieza del diagrama. La que no decide nada no es un límite: es una capa de paso con una unidad operativa de costo."
  - fact: el legajo del cliente está bajo revisión del regulador y cada acceso tiene que quedar registrado por su dueño. Dos servicios lo leen sin pasar por él.
    discoveryPath: "contá cuántas flechas entran a la base de clientes y de dónde salen. Cada flecha que no sale del servicio de clientes es un acceso que ese servicio no puede registrar ni explicar."
  - fact: cuando riesgo cambió el formato de la fecha de nacimiento, altas empezó a rechazar solicitudes válidas. Los dos leían la misma tabla con dos supuestos distintos.
    discoveryPath: "si dos piezas leen la misma tabla directamente, comparten supuestos que nadie escribió. El error aparece en la que no cambió."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Solicitante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App del banco
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: altas
      type: service
      label: Servicio de altas
      zone: private
      role: onboarding-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: clientes
      type: service
      label: Servicio de clientes
      zone: private
      role: customer-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: clientesdb
      type: database
      label: Legajo del cliente
      zone: restricted
      role: customer-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: riesgo
      type: service
      label: Servicio de riesgo
      zone: private
      role: risk-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: riesgodb
      type: database
      label: Base de riesgo
      zone: restricted
      role: risk-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: documentos
      type: service
      label: Servicio de documentos
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 630 }
    - id: documentosdb
      type: database
      label: Base de documentos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
    - id: archivo
      type: object-storage
      label: Archivo de documentos
      zone: private
      given: true
      position: { x: 805, y: 740 }
  edges:
    - id: cliente-app
      from: { node: cliente }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: regulated
    - id: gw-altas
      from: { node: gw }
      to: { node: altas }
      dataClass: regulated
    - id: gw-clientes
      from: { node: gw }
      to: { node: clientes }
      dataClass: regulated
    - id: clientes-clientesdb
      from: { node: clientes }
      to: { node: clientesdb }
      dataClass: regulated
    - id: altas-clientesdb
      from: { node: altas }
      to: { node: clientesdb }
      dataClass: regulated
    - id: altas-riesgo
      from: { node: altas }
      to: { node: riesgo }
      dataClass: regulated
    - id: riesgo-riesgodb
      from: { node: riesgo }
      to: { node: riesgodb }
      dataClass: regulated
    - id: riesgo-clientesdb
      from: { node: riesgo }
      to: { node: clientesdb }
      dataClass: regulated
    - id: altas-documentos
      from: { node: altas }
      to: { node: documentos }
      dataClass: regulated
    - id: documentos-documentosdb
      from: { node: documentos }
      to: { node: documentosdb }
      dataClass: regulated
    - id: documentos-archivo
      from: { node: documentos }
      to: { node: archivo }
      dataClass: regulated
guarantees:
  - id: g-onboarding-no-direct-read
    label: altas no entra al legajo del cliente
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: onboarding-service
      to:
        role: customer-db
    whyMissing: hay una conexión que sale del servicio de altas y entra directo al legajo del cliente.
    consequence: el legajo está bajo revisión del regulador y su dueño tiene que poder decir quién lo leyó y por qué. Un acceso que no pasa por el servicio de clientes no queda registrado en ningún lado, y ante el regulador un acceso que no figura es un acceso que no se puede defender.
  - id: g-onboarding-through-owner
    label: altas llega al legajo a través del servicio de clientes
    weight: 2
    predicate:
      op: path
      from:
        role: onboarding-service
      to:
        role: customer-db
      via:
        role: customer-service
    whyMissing: no hay ningún camino desde el servicio de altas hasta el legajo del cliente que atraviese el servicio de clientes.
    consequence: "abrir una cuenta necesita el legajo: sin camino hasta él, altas no puede validar un solicitante que ya es cliente y va a crear un duplicado. Cortar el atajo sin poner el camino bueno no arregla el límite, apaga la funcionalidad."
  - id: g-risk-no-direct-read
    label: riesgo no entra al legajo del cliente
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: risk-service
      to:
        role: customer-db
    whyMissing: hay una conexión que sale del servicio de riesgo y entra directo al legajo del cliente.
    consequence: cuando riesgo cambió el formato de la fecha de nacimiento, altas empezó a rechazar solicitudes válidas. Dos piezas que leen la misma tabla comparten supuestos que nadie escribió, y el error siempre aparece en la que no cambió.
  - id: g-risk-owns-its-store
    label: riesgo conserva su propio almacenamiento
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: risk-db
        - op: covered
          target:
            role: risk-db
          by:
            role: risk-service
    whyMissing: la base de riesgo no existe, o no está conectada al servicio de riesgo.
    consequence: el modelo de scoring y su historial son el dato del que riesgo responde ante una auditoría. Consolidar para entrar en presupuesto no puede costar el dato que justifica una decisión de crédito de hace ocho meses.
rubric:
  - dimension: el dato regulado se alcanza únicamente por su dueño
    signal:
      kind: predicate
      guaranteeId: g-onboarding-no-direct-read
  - dimension: cortar el atajo no apaga la funcionalidad
    signal:
      kind: predicate
      guaranteeId: g-onboarding-through-owner
  - dimension: ninguna segunda pieza comparte supuestos no escritos sobre la misma tabla
    signal:
      kind: predicate
      guaranteeId: g-risk-no-direct-read
  - dimension: la consolidación no borra un dato del que alguien responde
    signal:
      kind: predicate
      guaranteeId: g-risk-owns-its-store
referenceSolutions:
  - label: documentos se pliega a altas y el archivo queda como almacenamiento
    contextInversion: "plegar documentos dentro de altas es lo correcto cuando esa pieza no decide nada propio, porque recibe un archivo, lo guarda y devuelve un identificador, y el equipo necesita bajar una unidad operativa. Un límite sin una decisión adentro no es un límite: es un salto de red con costo de operación. Se paga con que el día que la carga de documentos tenga reglas propias (caducidad, verificación, firma) haya que volver a separarla."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Solicitante
          zone: public
        - id: app
          type: mobile-client
          label: App del banco
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: altas
          type: service
          label: Servicio de altas
          zone: private
          role: onboarding-service
          props: { criticality: "medium", replicas: "2" }
        - id: clientes
          type: service
          label: Servicio de clientes
          zone: private
          role: customer-service
          props: { criticality: "medium", replicas: "2" }
        - id: clientesdb
          type: database
          label: Legajo del cliente
          zone: restricted
          role: customer-db
          props: { backup: "diario" }
        - id: riesgo
          type: service
          label: Servicio de riesgo
          zone: private
          role: risk-service
          props: { criticality: "medium", replicas: "2" }
        - id: riesgodb
          type: database
          label: Base de riesgo
          zone: restricted
          role: risk-db
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de documentos
          zone: private
      edges:
        - id: cliente-app
          from: { node: cliente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: regulated
        - id: gw-altas
          from: { node: gw }
          to: { node: altas }
          dataClass: regulated
        - id: gw-clientes
          from: { node: gw }
          to: { node: clientes }
          dataClass: regulated
        - id: clientes-clientesdb
          from: { node: clientes }
          to: { node: clientesdb }
          dataClass: regulated
        - id: altas-clientes
          from: { node: altas }
          to: { node: clientes }
          dataClass: regulated
        - id: altas-riesgo
          from: { node: altas }
          to: { node: riesgo }
          dataClass: regulated
        - id: riesgo-riesgodb
          from: { node: riesgo }
          to: { node: riesgodb }
          dataClass: regulated
        - id: riesgo-clientes
          from: { node: riesgo }
          to: { node: clientes }
          dataClass: regulated
        - id: altas-archivo
          from: { node: altas }
          to: { node: archivo }
          dataClass: regulated
  - label: documentos sigue siendo su propia pieza, sin base de datos propia
    contextInversion: "mantener documentos separado conviene cuando el equipo ya sabe que le vienen reglas propias, como caducidad del comprobante de domicilio, verificación de firma o formatos por país, y prefiere pagar la pieza ahora antes que volver a partirla después. Lo que se saca es su base de datos, que no guardaba nada que el archivo no guarde mejor. Se paga con la unidad operativa del servicio, que es justo la que deja el presupuesto sin margen."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Solicitante
          zone: public
        - id: app
          type: mobile-client
          label: App del banco
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: altas
          type: service
          label: Servicio de altas
          zone: private
          role: onboarding-service
          props: { criticality: "medium", replicas: "2" }
        - id: clientes
          type: service
          label: Servicio de clientes
          zone: private
          role: customer-service
          props: { criticality: "medium", replicas: "2" }
        - id: clientesdb
          type: database
          label: Legajo del cliente
          zone: restricted
          role: customer-db
          props: { backup: "diario" }
        - id: riesgo
          type: service
          label: Servicio de riesgo
          zone: private
          role: risk-service
          props: { criticality: "medium", replicas: "2" }
        - id: riesgodb
          type: database
          label: Base de riesgo
          zone: restricted
          role: risk-db
          props: { backup: "diario" }
        - id: documentos
          type: service
          label: Servicio de documentos
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: archivo
          type: object-storage
          label: Archivo de documentos
          zone: private
      edges:
        - id: cliente-app
          from: { node: cliente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: regulated
        - id: gw-altas
          from: { node: gw }
          to: { node: altas }
          dataClass: regulated
        - id: gw-clientes
          from: { node: gw }
          to: { node: clientes }
          dataClass: regulated
        - id: clientes-clientesdb
          from: { node: clientes }
          to: { node: clientesdb }
          dataClass: regulated
        - id: altas-clientes
          from: { node: altas }
          to: { node: clientes }
          dataClass: regulated
        - id: altas-riesgo
          from: { node: altas }
          to: { node: riesgo }
          dataClass: regulated
        - id: riesgo-riesgodb
          from: { node: riesgo }
          to: { node: riesgodb }
          dataClass: regulated
        - id: riesgo-clientes
          from: { node: riesgo }
          to: { node: clientes }
          dataClass: regulated
        - id: altas-documentos
          from: { node: altas }
          to: { node: documentos }
          dataClass: regulated
        - id: documentos-archivo
          from: { node: documentos }
          to: { node: archivo }
          dataClass: regulated
status: PILOT
---

Un banco recibe **2.100 solicitudes de apertura de cuenta por día**. El flujo
lo atienden cuatro piezas: altas, que conduce la solicitud; clientes, que es
dueño del legajo; riesgo, que decide si se aprueba; y documentos, que recibe
las fotos del DNI y el comprobante de domicilio.

Tres de esas piezas deciden algo. La cuarta, no: documentos recibe el archivo,
lo guarda en su base y devuelve un identificador. Nada más. Pero tiene su
propio despliegue, su propia base y su propio turno en la guardia.

Y hay dos atajos. Altas lee el legajo **entrando directo a la base de
clientes**, porque era más rápido que llamar al servicio. Riesgo hace lo
mismo. El mes pasado riesgo cambió cómo interpreta la fecha de nacimiento y
**altas empezó a rechazar solicitudes válidas**: dos piezas leyendo la misma
tabla con dos supuestos distintos, y el error apareció en la que no había
cambiado nada.

Encima el legajo está bajo revisión del regulador: su dueño tiene que poder
decir **quién lo leyó y por qué**. Hoy hay dos lecturas por día que el servicio
de clientes ni sabe que existen.

El equipo tiene una capacidad real de **7 unidades operativas** y el sistema
usa **8**.

**Rearmá el sistema** con las tres cosas al mismo tiempo: que el legajo se
alcance sólo por su dueño, que nadie pierda el dato del que responde, y que lo
que quede entre en lo que el equipo puede sostener. Vas a tener que **sacar
algo**, y vas a tener que poder explicar por qué el negocio no lo extraña.
