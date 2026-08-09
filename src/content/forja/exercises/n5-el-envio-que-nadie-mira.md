---
title: "El envío que nadie mira"
level: 5
role: calibration
domain: logistica
D1: 1
D2: 1
D3: 2
D4: 1
D5: 2
D6: 0
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 6
aiBudget: libre. Este ejercicio enseña el gesto de conectar una señal, no hay criterio que la IA pueda arruinar acá.
lambda: 0.5
constraints:
  - metric: tiempo aceptable entre que el seguimiento se rompe y el equipo se entera
    operator: "<="
    value: 5
    unit: minutos
hiddenFacts:
  - fact: la última caída del seguimiento duró 4 horas y la descubrió un cliente por teléfono, no el equipo.
    discoveryPath: dejá el servicio de seguimiento sin conectar a ningún componente de monitoreo y probá tu respuesta. El motor te va a decir, con esas palabras, que el tiempo de detección pasa a ser el tiempo que tarda alguien en enojarse.
  - fact: la mitad de los incidentes del último trimestre no empezaron en el servicio, empezaron en la puerta de entrada, con límites de tasa mal configurados que devolvían error antes de que el pedido llegara a ningún lado.
    discoveryPath: "conectá sólo el servicio al monitoreo y fijate qué garantía sigue sin cumplirse: la puerta de entrada es un componente que falla por su cuenta y también necesita reportar."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
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
    - id: seguimiento
      type: service
      label: Servicio de seguimiento
      zone: private
      role: tracking-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: envios
      type: database
      label: Base de envíos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: cliente-portal
      from: { node: cliente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-seguimiento
      from: { node: gw }
      to: { node: seguimiento }
      dataClass: personal
    - id: seguimiento-envios
      from: { node: seguimiento }
      to: { node: envios }
      dataClass: personal
guarantees:
  - id: g-service-observed
    label: el servicio de seguimiento reporta lo que le pasa
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
        role: tracking-service
      by:
        type: [observability]
    whyMissing: el servicio de seguimiento no está conectado a ningún componente de monitoreo, así que nadie fuera del propio proceso sabe si respondió bien o devolvió error.
    consequence: el sistema se rompe y sigue pareciendo sano. La primera señal es un cliente llamando para preguntar dónde está su paquete, cuatro horas después.
  - id: g-gateway-observed
    label: la puerta de entrada también reporta
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [observability]
    whyMissing: la puerta de entrada no está conectada a ningún componente de monitoreo.
    consequence: un error que se resuelve en la puerta, como una autenticación rechazada o un límite de tasa agotado, nunca llega al servicio, así que observar sólo el servicio deja ciego al equipo justo en la mitad de los incidentes.
  - id: g-path-preserved
    label: el cliente sigue llegando al servicio por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: tracking-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde el cliente hasta el servicio de seguimiento que pase por la puerta de entrada.
    consequence: agregar señal no puede costar el producto. Si en el camino desarmaste la ruta por la que el cliente consulta su envío, el sistema quedó perfectamente observado y perfectamente inútil.
rubric:
  - dimension: el equipo se entera de una falla del servicio sin depender de un reclamo
    signal:
      kind: predicate
      guaranteeId: g-service-observed
  - dimension: la señal cubre también lo que pasa antes del servicio
    signal:
      kind: predicate
      guaranteeId: g-gateway-observed
  - dimension: el producto sigue funcionando después de instrumentarlo
    signal:
      kind: predicate
      guaranteeId: g-path-preserved
referenceSolutions:
  - label: un solo lugar donde mirar
    contextInversion: "un único componente de monitoreo es la elección correcta cuando el mismo equipo opera la puerta de entrada y el servicio: una sola pantalla, una sola guardia, y correlacionar un error de borde con un error de aplicación no cuesta nada porque están juntos."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: portal
          type: web-client
          label: Portal de seguimiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: seguimiento
          type: service
          label: Servicio de seguimiento
          zone: private
          role: tracking-service
          props: { criticality: "high", replicas: "2" }
        - id: envios
          type: database
          label: Base de envíos
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
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
        - id: gw-seguimiento
          from: { node: gw }
          to: { node: seguimiento }
          dataClass: personal
        - id: seguimiento-envios
          from: { node: seguimiento }
          to: { node: envios }
          dataClass: personal
        - id: seguimiento-monitoreo
          from: { node: seguimiento }
          to: { node: monitoreo }
          dataClass: public
        - id: gw-monitoreo
          from: { node: gw }
          to: { node: monitoreo }
          dataClass: public
  - label: señal de borde y señal de aplicación, separadas
    contextInversion: "dos componentes de monitoreo tienen sentido cuando la puerta de entrada la opera un equipo de plataforma y el servicio lo opera el equipo de producto: cada uno mira su propia señal, define sus propios umbrales y no despierta al otro por un problema que no le corresponde. Se paga con una unidad operativa más y con la correlación manual entre las dos vistas cuando un incidente cruza el límite."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: portal
          type: web-client
          label: Portal de seguimiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: seguimiento
          type: service
          label: Servicio de seguimiento
          zone: private
          role: tracking-service
          props: { criticality: "high", replicas: "2" }
        - id: envios
          type: database
          label: Base de envíos
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo-borde
          type: observability
          label: Monitoreo de borde
          zone: private
        - id: monitoreo-app
          type: observability
          label: Monitoreo de aplicación
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
        - id: gw-seguimiento
          from: { node: gw }
          to: { node: seguimiento }
          dataClass: personal
        - id: seguimiento-envios
          from: { node: seguimiento }
          to: { node: envios }
          dataClass: personal
        - id: gw-monitoreo-borde
          from: { node: gw }
          to: { node: monitoreo-borde }
          dataClass: public
        - id: seguimiento-monitoreo-app
          from: { node: seguimiento }
          to: { node: monitoreo-app }
          dataClass: public
        - id: envios-monitoreo-app
          from: { node: envios }
          to: { node: monitoreo-app }
          dataClass: public
status: PILOT
---

Una empresa de logística mueve **8.400 paquetes por día**. El cliente entra
al portal, escribe el número de guía y ve dónde está su envío. El sistema
funciona: lo armaron hace siete meses y desde entonces nadie lo tocó.

Nadie lo tocó y nadie lo mira. El mes pasado el servicio de seguimiento
estuvo devolviendo error durante **cuatro horas**, una madrugada de
martes, y el equipo se enteró porque un cliente llamó al centro de atención a las
nueve de la mañana. En el tablero de nadie había una línea roja, porque no
hay tablero.

Este es el gesto del nivel 5 y es el más simple de todos: **un sistema
correcto que nadie mira es un sistema que se degrada solo**. No hay que
rediseñar nada acá. Hay que hacer que las piezas que ya existen cuenten lo
que les pasa.

**Conectá las señales.** El servicio de seguimiento tiene que reportar, y
la puerta de entrada también: la mitad de los incidentes del último
trimestre murieron en la puerta y nunca llegaron al servicio, así que mirar
sólo el servicio deja al equipo ciego exactamente la mitad de las veces.
