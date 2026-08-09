---
title: "La carpeta del cliente en la red pública"
level: 3
role: core
domain: fintech
D1: 2
D2: 1
D3: 2
D4: 1
D5: 2
D6: 0
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que explicar por qué el motor no bloqueó este diseño y por qué eso no lo vuelve correcto."
lambda: 0.5
constraints:
  - metric: altas de cuenta por mes
    operator: ">="
    value: 9000
    unit: altas
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "la red de distribución se conectó al almacén de documentos en 2024 para que las fotos del onboarding cargaran rápido en la app. Nadie separó el material de marketing del material de identidad: estaban en el mismo lugar."
    discoveryPath: "seguí la conexión que sale del almacén de documentos en el lienzo y fijate en qué zona termina. Una red de distribución vive en la frontera: su trabajo es que un archivo llegue rápido a cualquiera que lo pida."
  - fact: "el motor no marca esta conexión como error. Ninguna regla la prohíbe."
    discoveryPath: "probá el diseño tal como viene: no vas a ver un bloqueante. La exposición no está en la forma del diagrama, porque las piezas son las correctas y están en la zona correcta. Está en qué clase de dato declara llevar esa conexión. Por ahí sale un documento de identidad, que es dato regulado. Declarar la clase no es burocracia: es la única razón por la que alguien puede leer este diagrama y darse cuenta."
  - fact: "el almacén de material público existe desde el rediseño de marzo y está vacío de conexiones. Ahí van los logos, los folletos y las capturas de la app."
    discoveryPath: "está en el lienzo, sin una sola conexión, esperando que alguien termine la separación. El material de marketing sigue publicándose desde el mismo lugar que los documentos de identidad porque nadie la terminó."
startingDesign:
  nodes:
    - id: solicitante
      type: actor
      label: Solicitante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de alta de cuenta
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
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: documentos
      type: object-storage
      label: Almacén de documentos de identidad
      zone: private
      role: documents-store
      given: true
      position: { x: 805, y: 410 }
    - id: publico
      type: object-storage
      label: Almacén de material público
      zone: private
      role: public-assets
      given: true
      position: { x: 805, y: 520 }
    - id: red
      type: cdn
      label: Red de distribución
      zone: dmz
      given: true
      position: { x: 805, y: 190 }
  edges:
    - id: solicitante-app
      from: { node: solicitante }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-altas
      from: { node: gw }
      to: { node: altas }
      dataClass: personal
    - id: altas-documentos
      from: { node: altas }
      to: { node: documentos }
      dataClass: regulated
    - id: documentos-red
      from: { node: documentos }
      to: { node: red }
      dataClass: regulated
guarantees:
  - id: g-documentos-fuera-de-la-red-publica
    label: los documentos de identidad no se publican por la red de distribución
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: documents-store
      to:
        type: [cdn]
    whyMissing: el almacén de documentos de identidad sigue conectado a la red de distribución.
    consequence: una red de distribución existe para entregar un archivo rápido y a cualquiera, y guarda copias en lugares sobre los que no tenés control. Una foto de documento que entró ahí siguió existiendo después de que la borraste del origen, y no hay forma de saber en cuántos lados.
  - id: g-documentos-guardados
    label: el documento de identidad sigue guardándose donde el alta lo necesita
    weight: 2
    predicate:
      op: path
      from:
        role: onboarding-service
      to:
        role: documents-store
    whyMissing: no hay ningún camino desde el servicio de altas hasta el almacén de documentos de identidad.
    consequence: "cortar la publicación borrando el almacén deja al servicio de altas sin dónde guardar la foto que la ley obliga a conservar. Sacar el dato de la red pública es la mitad del trabajo: la otra mitad es que siga existiendo donde tiene que existir."
  - id: g-material-publico-por-la-red
    label: el material público sí se publica por la red de distribución
    weight: 1
    predicate:
      op: path
      from:
        role: public-assets
      to:
        type: [cdn]
    whyMissing: el almacén de material público no llega a la red de distribución, así que los logos, folletos y capturas siguen sin tener por dónde salir.
    consequence: "apagar la red de distribución entera resuelve la exposición y rompe el otro problema: el material que sí es público vuelve a servirse desde el servicio de altas, que pasa a gastar su capacidad entregando imágenes de marketing."
rubric:
  - dimension: el dato regulado no viaja a una red que no controlás
    signal:
      kind: predicate
      guaranteeId: g-documentos-fuera-de-la-red-publica
  - dimension: quitar la exposición no borra el dato que hay que conservar
    signal:
      kind: predicate
      guaranteeId: g-documentos-guardados
  - dimension: cada clase de contenido sale por el camino que le corresponde
    signal:
      kind: predicate
      guaranteeId: g-material-publico-por-la-red
referenceSolutions:
  - label: dos almacenes, uno solo publicado
    contextInversion: "que el mismo servicio de altas escriba en los dos almacenes es lo correcto cuando el material público lo publica el mismo equipo que hace el alta y son pocas piezas por mes: cero componentes nuevos para operar y una sola línea de responsabilidad. Se paga con que el equipo de marketing depende del equipo de altas para publicar un folleto."
    design:
      nodes:
        - id: solicitante
          type: actor
          label: Solicitante
          zone: public
        - id: app
          type: mobile-client
          label: App de alta de cuenta
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
          props: { criticality: "high", replicas: "2" }
        - id: documentos
          type: object-storage
          label: Almacén de documentos de identidad
          zone: private
          role: documents-store
        - id: publico
          type: object-storage
          label: Almacén de material público
          zone: private
          role: public-assets
        - id: red
          type: cdn
          label: Red de distribución
          zone: dmz
      edges:
        - id: solicitante-app
          from: { node: solicitante }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-altas
          from: { node: gw }
          to: { node: altas }
          dataClass: personal
        - id: altas-documentos
          from: { node: altas }
          to: { node: documentos }
          dataClass: regulated
        - id: altas-publico
          from: { node: altas }
          to: { node: publico }
          dataClass: public
        - id: publico-red
          from: { node: publico }
          to: { node: red }
          dataClass: public
  - label: un servicio de publicación con su propia llave
    contextInversion: "separar la publicación conviene cuando marketing publica todos los días y no puede depender de un despliegue del servicio de altas: el servicio de publicación tiene permiso sobre el almacén público y ninguno sobre el de documentos, así que la separación deja de depender de que nadie se equivoque de conexión. Se paga con una pieza más para operar y con un permiso más que administrar."
    design:
      nodes:
        - id: solicitante
          type: actor
          label: Solicitante
          zone: public
        - id: app
          type: mobile-client
          label: App de alta de cuenta
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
          props: { criticality: "high", replicas: "2" }
        - id: publicacion
          type: service
          label: Servicio de publicación
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: documentos
          type: object-storage
          label: Almacén de documentos de identidad
          zone: private
          role: documents-store
        - id: publico
          type: object-storage
          label: Almacén de material público
          zone: private
          role: public-assets
        - id: red
          type: cdn
          label: Red de distribución
          zone: dmz
      edges:
        - id: solicitante-app
          from: { node: solicitante }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-altas
          from: { node: gw }
          to: { node: altas }
          dataClass: personal
        - id: gw-publicacion
          from: { node: gw }
          to: { node: publicacion }
          dataClass: public
        - id: altas-documentos
          from: { node: altas }
          to: { node: documentos }
          dataClass: regulated
        - id: publicacion-publico
          from: { node: publicacion }
          to: { node: publico }
          dataClass: public
        - id: publico-red
          from: { node: publico }
          to: { node: red }
          dataClass: public
status: PILOT
---

Una fintech que abre **9.000 cuentas por mes**. Para abrir una cuenta hay que
subir una foto del documento y una selfie. Eso se guarda en el almacén de
documentos de identidad, que es exactamente donde tiene que estar y donde la
ley obliga a conservarlo cinco años.

En 2024 alguien conectó ese almacén a la red de distribución. La razón era
buena: las fotos del onboarding cargaban lento en la app y con la red de
distribución cargaban al instante. Nadie mintió, nadie fue descuidado, y el
problema no se ve mirando la forma del diagrama de arriba: las piezas son las
correctas y están en la zona correcta.

Lo que decide si esa conexión está bien es **qué viaja por ella**. Por ahí sale
un documento de identidad: dato regulado, cinco años de retención y obligación
de borrarlo cuando el cliente se va.

Una red de distribución guarda copias en lugares que no administrás, para
entregar rápido a cualquiera que pida el archivo. Es su trabajo. Cuando una
cuenta se da de baja y el equipo borra la foto del documento del origen, la
copia que quedó afuera no se entera.

El motor **no bloquea este diseño**. Ninguna regla lo prohíbe, porque la
exposición no está en la forma del diagrama: está en la clase de dato que esa
conexión declara llevar. Para eso se declara. Es la única señal que le permite
a alguien leer este diagrama y darse cuenta antes de que pase.

Desde el rediseño de marzo hay un segundo almacén, el de **material público**:
logos, folletos, capturas de la app. Está en el lienzo, sin una sola conexión.
Se creó justamente para separar lo que se publica de lo que se conserva, y
quedó a medio hacer: marketing todavía publica desde el almacén de documentos.

**Rearmá el sistema.** El documento de identidad tiene que dejar de salir por
la red de distribución, y el servicio de altas tiene que seguir teniendo dónde
guardarlo: la obligación de conservarlo cinco años no se suspende porque
cambies el diagrama. Y el material de marketing tiene que seguir llegando a la
calle. Apagar la red de distribución entera resuelve lo primero y rompe lo
último.
