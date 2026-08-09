---
title: "El portal de socios que entra por otra puerta"
level: 9
role: core
domain: seguros
D1: 3
D2: 3
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar por qué una segunda entrada sin comprobación de identidad convierte a todas las demás en decoración."
lambda: 0.75
constraints:
  - metric: talleres asociados con acceso al portal de socios
    operator: ">="
    value: 1900
    unit: talleres
  - metric: pólizas consultables desde el portal de socios
    operator: ">="
    value: 380000
    unit: pólizas
hiddenFacts:
  - fact: "el portal de socios se construyó en 2019 para doce talleres piloto y se autenticaba con una clave compartida por correo. Hoy son 1.900 talleres y la clave sigue siendo la misma para todos."
    discoveryPath: "mirá cuántas entradas tiene el sistema y cuántas de ellas están conectadas al proveedor de identidad. La entrada que quedó suelta es siempre la más vieja, la que se hizo cuando el problema era chico."
  - fact: "el taller que se da de baja del acuerdo comercial sigue teniendo la clave. Nadie la rota porque rotarla obliga a avisar a 1.900 talleres el mismo día."
    discoveryPath: "preguntate qué hay que hacer hoy para cortarle el acceso a un solo socio. Si la respuesta afecta a los 1.900, no hay control de acceso: hay una contraseña compartida."
  - fact: "en la auditoría de marzo el regulador pidió el listado de quién consultó la póliza 44-0912-7 en los últimos doce meses. Del portal de clientes salió completo. Del portal de socios, la respuesta fue el número de veces, sin el quién."
    discoveryPath: "una entrada que no comprueba identidad tampoco puede registrarla. No podés auditar un acceso del que no sabés el nombre."
startingDesign:
  nodes:
    - id: asegurado
      type: actor
      label: Asegurado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: taller
      type: external-party
      label: Taller asociado
      zone: public
      given: true
      position: { x: 85, y: 200 }
    - id: portal
      type: web-client
      label: Portal del asegurado
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: gwclientes
      type: api-gateway
      label: Puerta del portal de clientes
      zone: dmz
      given: true
      position: { x: 445, y: 170 }
    - id: gwsocios
      type: api-gateway
      label: Puerta del portal de socios
      zone: dmz
      given: true
      position: { x: 445, y: 280 }
    - id: polizas
      type: service
      label: Servicio de pólizas
      zone: private
      role: polizas-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 390 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad corporativo
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 80 }
    - id: basepolizas
      type: database
      label: Base de pólizas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 220 }
  edges:
    - id: asegurado-portal
      from: { node: asegurado }
      to: { node: portal }
      dataClass: public
    - id: portal-gwclientes
      from: { node: portal }
      to: { node: gwclientes }
      dataClass: personal
    - id: gwclientes-identidad
      from: { node: gwclientes }
      to: { node: identidad }
      dataClass: secret
    - id: gwclientes-polizas
      from: { node: gwclientes }
      to: { node: polizas }
      dataClass: personal
    - id: taller-gwsocios
      from: { node: taller }
      to: { node: gwsocios }
      dataClass: personal
    - id: gwsocios-polizas
      from: { node: gwsocios }
      to: { node: polizas }
      dataClass: regulated
    - id: polizas-basepolizas
      from: { node: polizas }
      to: { node: basepolizas }
      dataClass: regulated
guarantees:
  - id: g-every-door
    label: todas las entradas comprueban identidad contra el proveedor con doble factor
    weight: 4
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay al menos una entrada al sistema que no consulta al proveedor de identidad corporativo, el único que exige un segundo factor.
    consequence: "la seguridad de un sistema no es el promedio de sus entradas, es la peor. Mientras exista una puerta que acepta una clave compartida, el doble factor de la otra puerta no protege nada: el atacante entra por donde no se pregunta."
  - id: g-partner-reaches-policies
    label: el taller asociado sigue llegando a las pólizas, y lo hace cruzando una entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [external-party]
      to:
        role: polizas-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el taller asociado hasta el servicio de pólizas que pase por una entrada del sistema.
    consequence: "1.900 talleres dejan de poder consultar la cobertura antes de aceptar un vehículo. La aseguradora no cerró un agujero: cerró el canal. El negocio vuelve al teléfono y el problema de identidad sigue ahí, ahora sin registro."
  - id: g-customer-reaches-policies
    label: el asegurado sigue llegando a su póliza por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: polizas-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el portal del asegurado hasta el servicio de pólizas que pase por una entrada del sistema.
    consequence: el canal que hoy funciona bien es el que más fácil se rompe al reordenar el resto. Endurecer el acceso de los socios no puede costar el acceso de los clientes.
  - id: g-regulated-store
    label: el dato de póliza vive en un almacenamiento con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: polizas-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio de pólizas hasta una base de datos con copia de respaldo declarada.
    consequence: "el regulador no pregunta sólo quién vio el dato: pregunta si el dato sigue estando. Un registro regulado que vive en un almacenamiento sin copia es una promesa de retención que nadie puede cumplir."
rubric:
  - dimension: ninguna entrada al sistema queda sin comprobar identidad
    signal:
      kind: predicate
      guaranteeId: g-every-door
  - dimension: el socio sigue pudiendo trabajar después del cambio
    signal:
      kind: predicate
      guaranteeId: g-partner-reaches-policies
  - dimension: endurecer una entrada no rompe la otra
    signal:
      kind: predicate
      guaranteeId: g-customer-reaches-policies
  - dimension: el dato regulado queda donde se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-regulated-store
referenceSolutions:
  - label: dos puertas, las dos preguntando lo mismo
    contextInversion: "mantener las dos entradas conviene cuando los dos públicos tienen contratos distintos: el asegurado entra desde su casa con su teléfono, el taller entra desde una red fija con un certificado de empresa, y los límites de tasa, los formatos y los horarios de uso no se parecen en nada. Separadas, un pico de talleres un lunes a la mañana no deja sin portal a los asegurados. El costo es una pieza más para operar y una regla que hay que sostener para siempre: cada entrada nueva nace conectada al proveedor de identidad o no nace."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: taller
          type: external-party
          label: Taller asociado
          zone: public
        - id: portal
          type: web-client
          label: Portal del asegurado
          zone: public
        - id: gwclientes
          type: api-gateway
          label: Puerta del portal de clientes
          zone: dmz
        - id: gwsocios
          type: api-gateway
          label: Puerta del portal de socios
          zone: dmz
        - id: polizas
          type: service
          label: Servicio de pólizas
          zone: private
          role: polizas-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad corporativo
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basepolizas
          type: database
          label: Base de pólizas
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: asegurado-portal
          from: { node: asegurado }
          to: { node: portal }
          dataClass: public
        - id: portal-gwclientes
          from: { node: portal }
          to: { node: gwclientes }
          dataClass: personal
        - id: gwclientes-identidad
          from: { node: gwclientes }
          to: { node: identidad }
          dataClass: secret
        - id: gwclientes-polizas
          from: { node: gwclientes }
          to: { node: polizas }
          dataClass: personal
        - id: taller-gwsocios
          from: { node: taller }
          to: { node: gwsocios }
          dataClass: personal
        - id: gwsocios-identidad
          from: { node: gwsocios }
          to: { node: identidad }
          dataClass: secret
        - id: gwsocios-polizas
          from: { node: gwsocios }
          to: { node: polizas }
          dataClass: regulated
        - id: polizas-basepolizas
          from: { node: polizas }
          to: { node: basepolizas }
          dataClass: regulated
  - label: una sola entrada para los dos públicos
    contextInversion: "colapsar las dos entradas en una conviene cuando el equipo es chico y la entrada vieja es exactamente el tipo de pieza que nadie mantiene: una sola puerta significa un solo lugar donde se comprueba identidad, un solo registro de accesos para darle al regulador y una pieza menos para operar. Se paga con acoplamiento: talleres y asegurados comparten límites de tasa y ventana de mantenimiento, y un pico de un público se siente en el otro."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: taller
          type: external-party
          label: Taller asociado
          zone: public
        - id: portal
          type: web-client
          label: Portal del asegurado
          zone: public
        - id: gwclientes
          type: api-gateway
          label: Puerta única de entrada
          zone: dmz
        - id: polizas
          type: service
          label: Servicio de pólizas
          zone: private
          role: polizas-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad corporativo
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basepolizas
          type: database
          label: Base de pólizas
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: asegurado-portal
          from: { node: asegurado }
          to: { node: portal }
          dataClass: public
        - id: portal-gwclientes
          from: { node: portal }
          to: { node: gwclientes }
          dataClass: personal
        - id: taller-gwclientes
          from: { node: taller }
          to: { node: gwclientes }
          dataClass: personal
        - id: gwclientes-identidad
          from: { node: gwclientes }
          to: { node: identidad }
          dataClass: secret
        - id: gwclientes-polizas
          from: { node: gwclientes }
          to: { node: polizas }
          dataClass: regulated
        - id: polizas-basepolizas
          from: { node: polizas }
          to: { node: basepolizas }
          dataClass: regulated
status: PILOT
---

Una aseguradora de autos con **380.000 pólizas** y dos formas de entrar al
mismo dato.

La primera es el portal del asegurado: entra con su documento, segundo
factor por la app, y cada consulta queda registrada con nombre y hora. Se
rehizo en 2023 y funciona bien.

La segunda es el portal de socios, que usan **1.900 talleres** para
comprobar la cobertura de un vehículo antes de aceptarlo. Se construyó en
2019 para doce talleres piloto, se autentica con **una clave compartida**
que se mandó por correo, y desde entonces creció ciento cincuenta veces sin
que nadie volviera a mirarlo.

En la auditoría de marzo el regulador pidió el listado de quién consultó una
póliza específica en los últimos doce meses. Del portal de clientes salió
completo. Del portal de socios salió **la cantidad de consultas, sin el
quién**: cuando todos entran con la misma clave, no hay a quién nombrar.

El área comercial tiene una objeción concreta y no es caprichosa: pedirle a
1.900 talleres que cambien su forma de entrar el mismo día es un riesgo de
negocio real, y ya hubo un intento en 2022 que se dio de baja a las cuarenta
y ocho horas porque los talleres dejaron de consultar y empezaron a aceptar
vehículos sin verificar cobertura.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que las dos entradas comprueben quién es el que
entra. Los talleres tienen que seguir llegando a las pólizas y el asegurado
tiene que seguir entrando por el portal.
