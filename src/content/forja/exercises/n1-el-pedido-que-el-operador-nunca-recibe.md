---
title: "El pedido que el operador nunca recibe"
level: 1
role: core
domain: logistica
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
  opsUnits: 4
aiBudget: 'libre. El ejercicio se gana subrayando verbos en el enunciado, no generando diagramas. Un modelo te va a proponer una arquitectura; el requisito ya te dice cuál falta.'
lambda: 0.5
constraints:
  - metric: pedidos confirmados que no llegan al operador logístico
    operator: "="
    value: 0
    unit: pedidos
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: hoy alguien exporta una planilla a las 18:00 y se la manda por correo al operador. Ese alguien se toma vacaciones dos veces por año.
    discoveryPath: buscá en el diagrama la conexión que representa ese correo de las 18:00. No está, porque no la hace el sistema. Todo lo que el diagrama no muestra lo está haciendo una persona a mano.
  - fact: el operador logístico no lee la base de pedidos. Recibe encargos por su propia interfaz, y esa interfaz es un tercero fuera del sistema.
    discoveryPath: 'fijate qué tipo de pieza representa a alguien que no es tuyo, que tiene su propio horario y su propia caída: no es un servicio del equipo, es un proveedor externo.'
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tienda
      type: web-client
      label: Tienda online
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: pedidos
      type: service
      label: Servicio de pedidos
      zone: private
      role: orders-service
      given: true
      position: { x: 445, y: 300 }
    - id: base
      type: database
      label: Base de pedidos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: cliente-tienda
      from: { node: cliente }
      to: { node: tienda }
      dataClass: public
    - id: tienda-gw
      from: { node: tienda }
      to: { node: gw }
      dataClass: personal
    - id: gw-pedidos
      from: { node: gw }
      to: { node: pedidos }
      dataClass: personal
    - id: pedidos-base
      from: { node: pedidos }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-llega-al-operador
    label: el pedido confirmado llega a un operador logístico
    weight: 2
    predicate:
      op: path
      from:
        role: orders-service
      to:
        type: [external-provider]
    whyMissing: no hay ningún camino desde el servicio de pedidos hasta un tercero que retire y entregue. El pedido se confirma, se cobra y se queda adentro del sistema.
    consequence: 'el cliente recibe "pedido confirmado" y nadie fuera del sistema se enteró de que hay algo que retirar. El pedido no está perdido: está esperando a que una persona se acuerde de exportarlo.'
  - id: g-pedido-registrado
    label: el pedido sigue quedando registrado
    weight: 1
    predicate:
      op: path
      from:
        role: orders-service
      to:
        type: [database]
    whyMissing: se cortó el camino entre el servicio de pedidos y la base donde el pedido queda escrito.
    consequence: avisarle al operador no reemplaza registrar el pedido. Sin registro, el día que el operador diga que nunca recibió nada, no hay contra qué comparar.
  - id: g-cliente-compra
    label: el cliente sigue llegando al servicio de pedidos por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: orders-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde la tienda hasta el servicio de pedidos que pase por la puerta de entrada.
    consequence: conectar la logística no puede costar la venta. Un sistema que entrega perfectamente los pedidos que ya no puede tomar no resolvió nada.
rubric:
  - dimension: el pedido confirmado sale del sistema sin que nadie lo empuje a mano
    signal:
      kind: predicate
      guaranteeId: g-llega-al-operador
  - dimension: el pedido sigue quedando escrito
    signal:
      kind: predicate
      guaranteeId: g-pedido-registrado
  - dimension: la tienda sigue vendiendo
    signal:
      kind: predicate
      guaranteeId: g-cliente-compra
referenceSolutions:
  - label: un solo operador con contrato nacional
    contextInversion: 'un operador único gana cuando el volumen todavía no justifica negociar dos contratos: una integración que mantener, una factura que conciliar, un interlocutor al que llamar cuando algo se pierde. Se paga con dependencia: el día que ese operador tenga un paro de dos semanas, no hay ninguna otra forma de entregar.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: tienda
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: pedidos
          type: service
          label: Servicio de pedidos
          zone: private
          role: orders-service
        - id: base
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: operador
          type: external-provider
          label: Operador logístico nacional
          zone: dmz
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
          dataClass: personal
        - id: pedidos-base
          from: { node: pedidos }
          to: { node: base }
          dataClass: personal
        - id: pedidos-operador
          from: { node: pedidos }
          to: { node: operador }
          dataClass: personal
  - label: dos operadores, uno por región
    contextInversion: 'dos operadores ganan cuando el mapa lo pide de verdad: el 40 % de los pedidos va al interior, donde el operador nacional tarda seis días y el regional tarda dos. También deja de haber un único tercero del que depende toda la entrega. Se paga con dos integraciones que mantener, dos formas distintas de numerar un envío, y una decisión nueva en cada pedido: a cuál de los dos va.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: tienda
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: pedidos
          type: service
          label: Servicio de pedidos
          zone: private
          role: orders-service
        - id: base
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: operador-area
          type: external-provider
          label: Operador del área metropolitana
          zone: dmz
        - id: operador-interior
          type: external-provider
          label: Operador del interior
          zone: dmz
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
          dataClass: personal
        - id: pedidos-base
          from: { node: pedidos }
          to: { node: base }
          dataClass: personal
        - id: pedidos-metro
          from: { node: pedidos }
          to: { node: operador-area }
          dataClass: personal
        - id: pedidos-interior
          from: { node: pedidos }
          to: { node: operador-interior }
          dataClass: personal
status: PILOT
---

Una tienda de artículos de cocina vende **240 pedidos por semana**. El cliente
compra, paga, y la pantalla dice "pedido confirmado". El pedido queda escrito en
la base. Ahí termina el sistema.

La dueña escribió lo que necesita en una frase:

> *"Todo pedido confirmado tiene que llegar al operador logístico el mismo día."*

Leelo entero, incluida la última palabra. No dice "quedar registrado". No dice
"estar disponible para consulta". Dice **llegar** a alguien que no es vos.

Buscá en el diagrama la conexión que hace eso. No está. Lo que hay en su lugar
es Marcela, que a las 18:00 exporta una planilla y se la manda por correo al
operador. Marcela funciona: el 96 % de los pedidos sale. El otro 4 % son los
días que Marcela está de licencia, el feriado que nadie cubrió, y las tres
veces que la planilla salió con una columna corrida.

Un paso manual dentro de un sistema automático no es un detalle de
implementación: es una parte del diseño que nadie dibujó, y por eso nadie la
está midiendo.

**Dibujala.** El operador no es un servicio del equipo. Tiene su propio
horario, su propia caída y su propio contrato. Elegí a cuántos le hablás y
sostené por qué.
