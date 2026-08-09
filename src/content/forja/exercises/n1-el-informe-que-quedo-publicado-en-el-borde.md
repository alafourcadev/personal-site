---
title: "El informe que quedó publicado en el borde"
level: 1
role: core
domain: inmobiliaria
D1: 1
D2: 1
D3: 1
D4: 1
D5: 1
D6: 0
D7: 0
D8: 0
D9: 1
prerequisiteLevels: []
budget:
  opsUnits: 3
aiBudget: 'libre para redactar. Para decidir, ojo: un modelo te va a felicitar por poner la red de distribución, porque en el 90 % de los casos es la respuesta correcta. Este es el otro 10 %, y la diferencia está en una línea del contrato, no en el diagrama.'
lambda: 0.5
constraints:
  - metric: informes de tasación accesibles sin pasar por el servicio
    operator: "="
    value: 0
    unit: informes
  - metric: presupuesto operativo
    operator: "<="
    value: 3
    unit: unidades operativas
hiddenFacts:
  - fact: la red de distribución sirve el archivo a quien tenga el enlace, sin preguntar quién es. Los enlaces de tres tasaciones aparecieron en un grupo de WhatsApp de vecinos del edificio.
    discoveryPath: seguí el recorrido del informe en el diagrama hasta el último punto. Preguntate quién decide, en esa última pieza, si el que pide el archivo tiene derecho a verlo. La respuesta es que nadie decide nada.
  - fact: la pieza se agregó porque el informe pesa 14 MB y tardaba en abrir. Nadie midió cuánto tardaba, y son 40 tasaciones por mes.
    discoveryPath: 'buscá en el enunciado el número de tasaciones y el número que motivó la decisión. Uno está contado y el otro no existe: la lentitud nunca se midió, se comentó.'
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente que encarga la tasación
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del cliente
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: tasaciones
      type: service
      label: Servicio de tasaciones
      zone: private
      role: appraisal-service
      given: true
      position: { x: 445, y: 300 }
    - id: archivo
      type: object-storage
      label: Archivo de informes
      zone: private
      given: true
      position: { x: 805, y: 410 }
    - id: borde
      type: cdn
      label: Distribución de informes en el borde
      zone: dmz
      given: true
      position: { x: 805, y: 190 }
  edges:
    - id: cliente-portal
      from: { node: cliente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-tasaciones
      from: { node: gw }
      to: { node: tasaciones }
      dataClass: personal
    - id: tasaciones-archivo
      from: { node: tasaciones }
      to: { node: archivo }
      dataClass: personal
    - id: archivo-borde
      from: { node: archivo }
      to: { node: borde }
      dataClass: personal
guarantees:
  - id: g-sin-publicacion-en-el-borde
    label: el informe no se entrega desde ninguna pieza publicada en el borde
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        type: [object-storage, service]
      to:
        type: [cdn]
    whyMissing: el archivo de informes está publicado en una red de distribución que sirve el documento a cualquiera que tenga el enlace. Esa pieza no sabe quién es el que pide, y no puede saberlo.
    consequence: 'el contrato dice que el informe se entrega al que lo encargó. Un enlace que funciona para cualquiera no incumple el contrato el día que se filtra: lo incumple desde el momento en que existe. Tres tasaciones ya circularon en un grupo de vecinos, y la inmobiliaria se enteró porque un cliente llamó enojado.'
  - id: g-informe-guardado-y-alcanzable
    label: el informe sigue guardado y el servicio sigue llegando a él
    weight: 1
    predicate:
      op: path
      from:
        role: appraisal-service
      to:
        type: [object-storage]
    whyMissing: se cortó el camino entre el servicio de tasaciones y el archivo donde el informe queda guardado.
    consequence: cerrar la puerta de atrás no puede costar el documento. Un informe que ya nadie puede sacar del sistema no está protegido. Está perdido, que es una forma más cara del mismo problema.
  - id: g-cliente-recibe
    label: el cliente sigue llegando al servicio de tasaciones por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: appraisal-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde el portal del cliente hasta el servicio de tasaciones que pase por la puerta de entrada.
    consequence: el cliente paga la tasación y la descarga del portal. Si el rediseño lo deja afuera, el informe queda perfectamente guardado y perfectamente inaccesible para el único que tiene derecho a verlo.
rubric:
  - dimension: no queda ninguna vía de entrega que no verifique quién pide
    signal:
      kind: predicate
      guaranteeId: g-sin-publicacion-en-el-borde
  - dimension: el informe sigue existiendo y el servicio sigue alcanzándolo
    signal:
      kind: predicate
      guaranteeId: g-informe-guardado-y-alcanzable
  - dimension: el cliente sigue pudiendo descargar lo que encargó
    signal:
      kind: predicate
      guaranteeId: g-cliente-recibe
referenceSolutions:
  - label: el informe sale por el servicio, y nada más
    contextInversion: 'dejar el sistema en su forma mínima gana cuando son 40 tasaciones por mes y el equipo es de dos personas: cada pieza que existe es una que hay que respaldar, actualizar y entender un domingo. El informe sale por el mismo camino por el que entra el cliente, y ese camino ya sabe quién es. Se paga con que, si mañana un cliente dice que nunca recibió su tasación, no hay contra qué comparar más que la memoria de quien atendió.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente que encarga la tasación
          zone: public
        - id: portal
          type: web-client
          label: Portal del cliente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tasaciones
          type: service
          label: Servicio de tasaciones
          zone: private
          role: appraisal-service
        - id: archivo
          type: object-storage
          label: Archivo de informes
          zone: private
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-tasaciones
          from: { node: gw }
          to: { node: tasaciones }
          dataClass: personal
        - id: tasaciones-archivo
          from: { node: tasaciones }
          to: { node: archivo }
          dataClass: personal
  - label: el informe sale por el servicio y queda escrito quién lo pidió
    contextInversion: 'gastar la unidad libre en un registro de entregas gana cuando el informe es prueba y la discusión aparece meses después: quién descargó, cuándo, y desde qué cuenta. Una inmobiliaria que tasa para juicios sucesorios necesita poder contestar esa pregunta con un dato, no con un recuerdo. Se paga con una pieza más que operar y respaldar, y con la obligación de decidir cuánto tiempo se conserva ese rastro, que es a su vez un dato sobre personas.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente que encarga la tasación
          zone: public
        - id: portal
          type: web-client
          label: Portal del cliente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tasaciones
          type: service
          label: Servicio de tasaciones
          zone: private
          role: appraisal-service
        - id: archivo
          type: object-storage
          label: Archivo de informes
          zone: private
        - id: entregas
          type: database
          label: Registro de entregas
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-tasaciones
          from: { node: gw }
          to: { node: tasaciones }
          dataClass: personal
        - id: tasaciones-archivo
          from: { node: tasaciones }
          to: { node: archivo }
          dataClass: personal
        - id: tasaciones-entregas
          from: { node: tasaciones }
          to: { node: entregas }
          dataClass: personal
status: PILOT
---

Una inmobiliaria de barrio hace **40 tasaciones por mes**. El cliente encarga
la tasación, el tasador visita la propiedad, y el informe queda disponible en
el portal: fotos, medidas, comparables de la zona, valor sugerido.

El contrato que firma el cliente tiene una línea sobre esto:

> *"El informe de tasación se entrega exclusivamente a quien lo encargó."*

*Exclusivamente*. Esa palabra es el requisito entero.

Ahora seguí el informe en el diagrama. El servicio lo escribe en el archivo.
El archivo lo publica en una red de distribución. Y ahí se termina el
recorrido. **La última pieza entrega el documento a quien tenga el enlace, sin
preguntar quién es**. No es que esté mal configurada: no tiene manera de
preguntar. Esa pieza existe justamente para servir rápido sin consultarle nada
a nadie.

El motivo por el que entró fue que el informe pesa 14 MB y "tardaba". Nadie
midió cuánto. Son 40 tasaciones por mes.

Los enlaces de tres tasaciones aparecieron en un grupo de WhatsApp del
edificio. La inmobiliaria se enteró porque llamó un cliente.

**Cerrá la vía que no pregunta nada, y dejá al cliente adentro.** Ojo con la
mitad fácil: borrar el archivo también cierra la vía, y también borra el
informe. El requisito no era que nadie llegue. Era que llegue uno solo.
