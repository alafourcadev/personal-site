---
title: "El archivo que nadie puede borrar"
level: 9
role: trap
domain: retail
D1: 4
D2: 3
D3: 3
D4: 3
D5: 3
D6: 2
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar en cuántos lugares vive el dato de un cliente en tu diseño, y qué hay que hacer en cada uno cuando el cliente pide desaparecer."
lambda: 0.75
constraints:
  - metric: días que da el organismo para probar que un dato se borró
    operator: "<="
    value: 30
    unit: días
  - metric: clientes con historial de compras en el sistema
    operator: ">="
    value: 2300000
    unit: clientes
hiddenFacts:
  - fact: "el archivo histórico se creó en 2023 justamente para que la agencia dejara de leer la base viva. La decisión fue correcta para el problema que tenía entonces: consultas pesadas contra el sistema de la tienda. Nadie revisó qué problema creaba."
    discoveryPath: "preguntate por qué está ahí la pieza que sobra antes de sacarla. Una pieza que resolvió un problema real hace dos años sigue resolviéndolo; lo que cambió es que ahora también causa uno."
  - fact: "un archivo de objetos se escribe agregando y se lee entero. No tiene índice por cliente. Borrar a una persona ahí significa reescribir el archivo completo, y por eso nunca se hizo."
    discoveryPath: "mirá qué tipo de almacenamiento es cada copia y preguntate cómo se borra una fila en cada uno. Si en uno la respuesta es «reescribiendo todo», esa copia no se va a poder borrar nunca en la práctica."
  - fact: "en la última inspección la empresa mostró 1.400 borrados ejecutados en la base. El organismo pidió una campaña de correo posterior a esa fecha y encontró 62 direcciones de personas que habían pedido el borrado. La campaña se había armado desde el archivo."
    discoveryPath: "seguí de dónde sale el dato que usa cada área, no de dónde creés que sale. Si el borrado se ejecuta en un lugar y el trabajo se hace desde otro, el borrado no existe."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 60 }
    - id: agencia
      type: external-party
      label: Agencia de marketing
      zone: public
      given: true
      position: { x: 85, y: 380 }
    - id: tienda
      type: web-client
      label: Tienda en línea
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: gwtienda
      type: api-gateway
      label: Puerta de la tienda
      zone: dmz
      given: true
      position: { x: 445, y: 170 }
    - id: gwagencia
      type: api-gateway
      label: Puerta de la agencia
      zone: dmz
      given: true
      position: { x: 445, y: 390 }
    - id: clientes
      type: service
      label: Servicio de clientes
      zone: private
      role: clientes-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 280 }
    - id: segmentos
      type: service
      label: Servicio de segmentos
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 500 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad de la cadena
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 40 }
    - id: baseclientes
      type: database
      label: Base de clientes
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 170 }
    - id: archivo
      type: object-storage
      label: Archivo histórico de compras
      zone: private
      given: true
      position: { x: 805, y: 380 }
  edges:
    - id: cliente-tienda
      from: { node: cliente }
      to: { node: tienda }
      dataClass: public
    - id: tienda-gwtienda
      from: { node: tienda }
      to: { node: gwtienda }
      dataClass: personal
    - id: gwtienda-identidad
      from: { node: gwtienda }
      to: { node: identidad }
      dataClass: secret
    - id: gwtienda-clientes
      from: { node: gwtienda }
      to: { node: clientes }
      dataClass: personal
    - id: clientes-baseclientes
      from: { node: clientes }
      to: { node: baseclientes }
      dataClass: personal
    - id: clientes-archivo
      from: { node: clientes }
      to: { node: archivo }
      dataClass: personal
    - id: agencia-gwagencia
      from: { node: agencia }
      to: { node: gwagencia }
      dataClass: personal
    - id: gwagencia-segmentos
      from: { node: gwagencia }
      to: { node: segmentos }
      dataClass: personal
    - id: segmentos-archivo
      from: { node: segmentos }
      to: { node: archivo }
      dataClass: personal
guarantees:
  - id: g-one-place-for-personal
    label: el dato personal del cliente vive en un solo lugar
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [object-storage]
    whyMissing: hay un componente del sistema que escribe dato de cliente en un archivo de objetos, así que ese dato existe en dos lugares distintos.
    consequence: "un archivo de objetos se escribe agregando y se lee entero: no tiene índice por cliente y borrar a una persona ahí significa reescribirlo completo. En la última inspección la empresa mostró 1.400 borrados ejecutados en la base y el organismo encontró 62 de esas personas en una campaña posterior, armada desde el archivo. El borrado se ejecutó en un lugar y el trabajo se hizo desde el otro."
  - id: g-erasable-store
    label: el dato del cliente vive en un almacenamiento donde se puede borrar una fila
    weight: 2
    predicate:
      op: path
      from:
        role: clientes-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio de clientes hasta una base de datos con copia de respaldo declarada.
    consequence: "el derecho al borrado no es sólo la obligación de borrar: es la obligación de poder demostrar que se borró, en 30 días. Eso exige un almacenamiento donde borrar sea una operación, no un proyecto. Y exige copia de respaldo, porque el mismo organismo que pide borrar lo que sobra pide conservar lo que la ley fiscal manda conservar."
  - id: g-agency-served
    label: la agencia sigue llegando al dato que necesita, y entra por una puerta del sistema
    weight: 2
    predicate:
      op: path
      from:
        type: [external-party]
      to:
        type: [database]
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde la agencia de marketing hasta la base donde vive el dato, pasando por una entrada del sistema.
    consequence: "dejar a la agencia sin acceso no cierra el problema: lo muda. La primera campaña que haya que armar va a salir de una exportación a planilla que alguien manda por correo, y eso es la misma copia sin control, ahora sin ninguna puerta que la registre."
  - id: g-customer-path
    label: el cliente sigue llegando a su cuenta por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: clientes-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde la tienda en línea hasta el servicio de clientes que pase por una entrada del sistema.
    consequence: la tienda es el negocio. Un cambio de privacidad que deja a 2.300.000 clientes sin poder ver su cuenta se revierte antes del mediodía, y con él vuelve todo lo demás.
  - id: g-doors-identity
    label: todas las entradas comprueban identidad con doble factor
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad de la cadena con segundo factor obligatorio.
    consequence: "la puerta de la agencia entrega historial de compras de 2.300.000 personas y hoy no pregunta quién es el que entra. Es un problema real y hay que arreglarlo. Lo que no hace es resolver el otro: una puerta bien cerrada delante de una copia que no se puede borrar sigue siendo una copia que no se puede borrar."
rubric:
  - dimension: el dato de una persona existe en un solo lugar
    signal:
      kind: predicate
      guaranteeId: g-one-place-for-personal
  - dimension: borrar es una operación, no un proyecto
    signal:
      kind: predicate
      guaranteeId: g-erasable-store
  - dimension: la agencia sigue pudiendo trabajar
    signal:
      kind: predicate
      guaranteeId: g-agency-served
  - dimension: la tienda sigue funcionando
    signal:
      kind: predicate
      guaranteeId: g-customer-path
  - dimension: ninguna entrada queda sin comprobar identidad
    signal:
      kind: predicate
      guaranteeId: g-doors-identity
referenceSolutions:
  - label: la agencia consulta, no recibe una copia
    contextInversion: "darle a la agencia su propia puerta y su propio servicio de consulta conviene cuando los dos públicos tienen contratos muy distintos: la tienda atiende picos de clientes y la agencia lanza consultas pesadas de segmentación, y compartir entrada significa que una campaña de un martes se sienta en el carrito de compras. Separadas, cada una tiene sus límites y su ventana. El costo es una pieza más para operar y la disciplina de que ese servicio de segmentos nunca guarde lo que devuelve: el día que empiece a guardar resultados para ir más rápido, el problema del archivo vuelve con otro nombre."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: agencia
          type: external-party
          label: Agencia de marketing
          zone: public
        - id: tienda
          type: web-client
          label: Tienda en línea
          zone: public
        - id: gwtienda
          type: api-gateway
          label: Puerta de la tienda
          zone: dmz
        - id: gwagencia
          type: api-gateway
          label: Puerta de la agencia
          zone: dmz
        - id: clientes
          type: service
          label: Servicio de clientes
          zone: private
          role: clientes-service
          props: { criticality: "high", replicas: "2" }
        - id: segmentos
          type: service
          label: Servicio de segmentos
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la cadena
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: baseclientes
          type: database
          label: Base de clientes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gwtienda
          from: { node: tienda }
          to: { node: gwtienda }
          dataClass: personal
        - id: gwtienda-identidad
          from: { node: gwtienda }
          to: { node: identidad }
          dataClass: secret
        - id: gwtienda-clientes
          from: { node: gwtienda }
          to: { node: clientes }
          dataClass: personal
        - id: clientes-baseclientes
          from: { node: clientes }
          to: { node: baseclientes }
          dataClass: personal
        - id: agencia-gwagencia
          from: { node: agencia }
          to: { node: gwagencia }
          dataClass: personal
        - id: gwagencia-identidad
          from: { node: gwagencia }
          to: { node: identidad }
          dataClass: secret
        - id: gwagencia-segmentos
          from: { node: gwagencia }
          to: { node: segmentos }
          dataClass: personal
        - id: segmentos-baseclientes
          from: { node: segmentos }
          to: { node: baseclientes }
          dataClass: personal
  - label: una sola puerta y un solo servicio que atiende a los dos
    contextInversion: "colapsar todo en una puerta y un servicio conviene cuando el equipo es chico y lo que más se paga es la deriva: un solo lugar donde se comprueba identidad, un solo lugar donde se ejecuta un borrado y un solo lugar donde mirar cuando el organismo pregunta. Cada componente que toca dato de cliente es un componente que alguien tiene que acordarse de incluir en el procedimiento de borrado; el diseño más barato de cumplir es el que tiene menos componentes que recordar. Se paga con acoplamiento: la agencia y la tienda comparten entrada, límites de tasa y ventana de mantenimiento."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: agencia
          type: external-party
          label: Agencia de marketing
          zone: public
        - id: tienda
          type: web-client
          label: Tienda en línea
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta única
          zone: dmz
        - id: clientes
          type: service
          label: Servicio de clientes
          zone: private
          role: clientes-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la cadena
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: baseclientes
          type: database
          label: Base de clientes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: agencia-gw
          from: { node: agencia }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-clientes
          from: { node: gw }
          to: { node: clientes }
          dataClass: personal
        - id: clientes-baseclientes
          from: { node: clientes }
          to: { node: baseclientes }
          dataClass: personal
status: PILOT
---

Una cadena de retail con **2.300.000 clientes** con historial de compras.

La agencia de marketing que arma las campañas necesita ese historial para
segmentar. En 2023 el equipo hizo lo correcto para el problema que tenía:
la agencia lanzaba consultas pesadas contra la base de la tienda y una de
ellas se llevó puesto un lunes de descuentos. Entonces armaron un **archivo
histórico de compras**, lo alimenta el servicio de clientes, y la agencia
lee de ahí. La base viva dejó de recibir consultas de terceros.

Este año llegó la otra obligación. La ley de protección de datos le da al
cliente el derecho a pedir el borrado de su información, y le da a la
empresa **30 días para demostrar que lo hizo**.

En la última inspección la empresa mostró **1.400 borrados ejecutados**. El
organismo pidió después una campaña de correo posterior a esa fecha y
encontró **62 direcciones de personas que habían pedido el borrado**. La
campaña se había armado desde el archivo.

El archivo se escribe agregando y se lee entero. No tiene índice por
cliente. Borrar a una persona ahí significa reescribirlo completo, y por eso
nunca se hizo: cada vez que alguien lo planteó, la estimación fue de días de
proceso y nadie firmó el riesgo de reescribir el histórico de la compañía.

Hay algo más, y es lo primero que salta a la vista: la puerta de la agencia
no comprueba quién entra. Es un problema real. No es el que se explica acá.

El equipo tiene **6 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que un borrado ejecutado una vez sea un borrado
completo. La agencia tiene que seguir teniendo con qué segmentar y la tienda
tiene que seguir vendiendo.
