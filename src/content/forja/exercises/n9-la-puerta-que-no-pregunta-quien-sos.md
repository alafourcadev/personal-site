---
title: "La puerta que no pregunta quién sos"
level: 9
role: calibration
domain: banca
D1: 2
D2: 2
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre. Este ejercicio enseña dónde se comprueba quién entra. No hay nada que la IA pueda resolver por vos acá, porque el problema no es escribir código sino decidir en qué punto del sistema se hace la pregunta."
lambda: 0.5
constraints:
  - metric: cuentas activas en el portal
    operator: ">="
    value: 41000
    unit: cuentas
  - metric: tiempo máximo que puede quedar viva una sesión revocada
    operator: "<="
    value: 60
    unit: segundos
hiddenFacts:
  - fact: "el portal ya valida usuario y contraseña por su cuenta, con una tabla propia. El banco compró un proveedor de identidad hace ocho meses y todavía no lo conectó a nada."
    discoveryPath: "el proveedor de identidad está en el diseño y no tiene ninguna conexión. Un componente que nadie usa no está aportando nada: preguntate quién tendría que estar consultándolo."
  - fact: "revocar una cuenta hoy significa borrar una fila en la base del portal. Mientras la sesión abierta siga viva, el usuario revocado sigue operando."
    discoveryPath: "seguí el camino de un pedido desde el navegador hasta la base y contá cuántas veces alguien comprueba quién lo manda. Si la respuesta es cero después de la primera pantalla, la sesión es la única prueba de identidad que queda."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente del banco
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de cuentas
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: cuentas
      type: service
      label: Servicio de cuentas
      zone: private
      role: cuentas-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 80 }
    - id: basecuentas
      type: database
      label: Base de cuentas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 200 }
  edges:
    - id: cliente-portal
      from: { node: cliente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-cuentas
      from: { node: gw }
      to: { node: cuentas }
      dataClass: personal
    - id: cuentas-basecuentas
      from: { node: cuentas }
      to: { node: basecuentas }
      dataClass: regulated
guarantees:
  - id: g-door-identity
    label: la puerta de entrada comprueba quién es el que entra
    weight: 2
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
    whyMissing: hay una puerta de entrada que no consulta a ningún proveedor de identidad, así que acepta el pedido por el solo hecho de venir bien formado.
    consequence: "cualquiera que copie una sesión válida entra igual que el dueño de la cuenta. La puerta no está autenticando: está dejando pasar."
  - id: g-single-entrance
    label: el portal llega al servicio de cuentas pasando por una puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: cuentas-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el portal hasta el servicio de cuentas que pase por una puerta de entrada.
    consequence: sin una puerta en el medio no existe ningún punto donde se pueda cortar un acceso, limitar la tasa de pedidos o registrar quién intentó qué.
  - id: g-service-authorizes
    label: el servicio de cuentas también comprueba de quién es el pedido
    weight: 1
    predicate:
      op: covered
      target:
        role: cuentas-service
      by:
        type: [identity-provider]
    whyMissing: el servicio de cuentas no consulta a ningún proveedor de identidad, así que confía en que el pedido ya viene comprobado desde afuera.
    consequence: "autenticar y autorizar no son lo mismo. La puerta puede decir que sos vos; sólo el servicio sabe si vos podés ver esa cuenta. Si el servicio no pregunta, el que entró con una sesión ajena ve todo lo que esa sesión alcanza."
rubric:
  - dimension: cada puerta de entrada comprueba identidad antes de dejar pasar
    signal:
      kind: predicate
      guaranteeId: g-door-identity
  - dimension: no hay forma de llegar al servicio sin cruzar una puerta
    signal:
      kind: predicate
      guaranteeId: g-single-entrance
  - dimension: el servicio decide si ese usuario puede ver ese dato
    signal:
      kind: predicate
      guaranteeId: g-service-authorizes
referenceSolutions:
  - label: una sola puerta, y el servicio vuelve a preguntar
    contextInversion: "una única puerta conviene cuando hay un solo público, clientes del banco entrando por el navegador, y el equipo quiere un solo lugar donde mirar los intentos fallidos. El costo es que esa puerta es también el único punto que puede caerse y dejar a todos afuera."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente del banco
          zone: public
        - id: portal
          type: web-client
          label: Portal de cuentas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cuentas
          type: service
          label: Servicio de cuentas
          zone: private
          role: cuentas-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basecuentas
          type: database
          label: Base de cuentas
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
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-cuentas
          from: { node: gw }
          to: { node: cuentas }
          dataClass: personal
        - id: cuentas-identidad
          from: { node: cuentas }
          to: { node: identidad }
          dataClass: secret
        - id: cuentas-basecuentas
          from: { node: cuentas }
          to: { node: basecuentas }
          dataClass: regulated
  - label: dos puertas, un solo lugar donde se comprueba identidad
    contextInversion: "dos puertas convienen cuando la app móvil y el navegador tienen ritmos y límites de tasa distintos y el equipo no quiere que un pico de la app deje sin servicio al navegador. Se paga con una pieza más para operar y con la disciplina de que ninguna de las dos puede quedar sin preguntar quién entra."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente del banco
          zone: public
        - id: portal
          type: web-client
          label: Portal de cuentas
          zone: public
        - id: app
          type: mobile-client
          label: App del banco
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta del portal
          zone: dmz
        - id: gwapp
          type: api-gateway
          label: Puerta de la app
          zone: dmz
        - id: cuentas
          type: service
          label: Servicio de cuentas
          zone: private
          role: cuentas-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basecuentas
          type: database
          label: Base de cuentas
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: cliente-app
          from: { node: cliente }
          to: { node: app }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: app-gwapp
          from: { node: app }
          to: { node: gwapp }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gwapp-identidad
          from: { node: gwapp }
          to: { node: identidad }
          dataClass: secret
        - id: gw-cuentas
          from: { node: gw }
          to: { node: cuentas }
          dataClass: personal
        - id: gwapp-cuentas
          from: { node: gwapp }
          to: { node: cuentas }
          dataClass: personal
        - id: cuentas-identidad
          from: { node: cuentas }
          to: { node: identidad }
          dataClass: secret
        - id: cuentas-basecuentas
          from: { node: cuentas }
          to: { node: basecuentas }
          dataClass: regulated
status: PILOT
---

Un banco mediano con **41.000 cuentas activas** en su portal. El sistema
funciona: el cliente entra con usuario y contraseña, ve sus movimientos y
transfiere.

La contraseña la comprueba el portal, contra una tabla propia. Hace ocho
meses el banco compró un proveedor de identidad, con segundo factor y
rotación de sesión, y todavía no lo conectó a nada. Está pago y apagado.

En la última revisión interna alguien preguntó algo incómodo: **cuando se
revoca una cuenta, ¿en cuánto tiempo deja de funcionar?** La respuesta fue
que se borra la fila del portal, pero la sesión que ya estaba abierta sigue
viva. El banco necesita que una cuenta revocada muera en **menos de 60
segundos**, y hoy no puede decir en cuánto muere.

Este es el ejercicio donde se aprende el gesto del nivel: **quién pregunta
quién sos, y en qué punto del camino lo pregunta.**

Hay dos preguntas distintas y se hacen en dos lugares distintos. La puerta
de entrada pregunta *quién sos*. El servicio pregunta *si vos podés ver
esto*. Un sistema que sólo hace la primera deja que cualquiera que consiga
una sesión válida vea todo lo que esa sesión alcanza.

**Rearmá el sistema** para que la puerta de entrada compruebe la identidad
contra el proveedor que el banco ya compró, y para que el servicio de
cuentas vuelva a comprobar de quién es el pedido antes de responderlo.
