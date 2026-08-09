---
title: "El pasaje que nadie vio caer"
level: 5
role: counter-trap
domain: transporte
D1: 1
D2: 1
D3: 2
D4: 1
D5: 2
D6: 1
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir cuánto costó no mirar y cuánto cuesta mirar, con los dos números del enunciado. El reflejo acá es correcto; lo que se aprende es la cuenta que lo justifica."
lambda: 0.5
constraints:
  - metric: pasajes vendidos por día
    operator: ">="
    value: 24000
    unit: pasajes/día
  - metric: tiempo aceptable entre que la venta se rompe y el equipo se entera
    operator: "<="
    value: 5
    unit: minutos
  - metric: unidades operativas libres en el presupuesto del equipo
    operator: ">="
    value: 4
    unit: unidades
hiddenFacts:
  - fact: "la caída de julio duró cinco horas y media y la descubrió un chofer por radio. Se dejaron de vender 5.100 pasajes y la contadora los valuó en una cifra que el gerente conoce de memoria."
    discoveryPath: "poné el costo de no mirar al lado del costo de mirar. Acá el primero se mide en pasajes perdidos por hora y el segundo en una unidad operativa sobre cuatro libres. La cuenta no está peleada: por eso este ejercicio se resuelve con el gesto obvio."
  - fact: "el pasaje vendido se le manda a los validadores de a bordo en el mismo pedido en que se cobra. Si el proceso de ventas se reinicia entre el cobro y el envío, el pasajero pagó y el validador no lo conoce."
    discoveryPath: "seguí el camino de un pasaje desde que se cobra hasta que el validador lo acepta y preguntate qué queda escrito si el proceso se apaga en el medio. Un cobro sin nada durable detrás es una promesa que sólo existe en memoria."
startingDesign:
  nodes:
    - id: pasajero
      type: actor
      label: Pasajero
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de pasajes
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: ventas
      type: service
      label: Servicio de ventas
      zone: private
      role: ventas
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: baseventas
      type: database
      label: Base de ventas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: validadores
      type: external-provider
      label: Validadores de a bordo
      zone: dmz
      role: validadores
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: pasajero-app
      from: { node: pasajero }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-ventas
      from: { node: gw }
      to: { node: ventas }
      dataClass: personal
    - id: ventas-baseventas
      from: { node: ventas }
      to: { node: baseventas }
      dataClass: personal
    - id: ventas-validadores
      from: { node: ventas }
      to: { node: validadores }
      dataClass: personal
guarantees:
  - id: g-signal-exists
    label: el sistema tiene dónde reportar lo que le pasa
    weight: 1
    predicate:
      op: exists
      node:
        type: [observability]
    whyMissing: no hay ningún componente de monitoreo en el sistema.
    consequence: sin un lugar donde reportar, la detección es un chofer con una radio. En julio eso fueron cinco horas y media y 5.100 pasajes que no se vendieron.
  - id: g-services-observed
    label: todos los servicios reportan lo que les pasa
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: el servicio se rompe y sigue pareciendo sano. La primera señal es un chofer avisando por radio que nadie sube con pasaje, cinco horas después de que la venta dejó de funcionar.
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
    consequence: un error que se resuelve en la puerta, como un certificado vencido o un límite de tasa agotado, nunca llega al servicio de ventas. Observar sólo el servicio deja al equipo ciego justo cuando la venta falla sin que el servicio se entere.
  - id: g-ticket-durable
    label: el pasaje cobrado llega al validador aunque el proceso se reinicie
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: ventas
      to:
        role: validadores
    whyMissing: no hay ninguna pieza durable entre el servicio de ventas y los validadores de a bordo. Hoy el pasaje se envía en el mismo pedido en que se cobra, así que un reinicio entre las dos cosas no deja rastro de que había algo por enviar.
    consequence: el pasajero pagó, ve el pasaje en su teléfono, y el validador no lo conoce. La discusión ocurre en la puerta del colectivo, con el chofer de árbitro y doce personas esperando atrás.
rubric:
  - dimension: el sistema tiene dónde reportar
    signal:
      kind: predicate
      guaranteeId: g-signal-exists
  - dimension: el equipo se entera de una falla del servicio sin depender de una radio
    signal:
      kind: predicate
      guaranteeId: g-services-observed
  - dimension: la señal cubre también lo que pasa antes del servicio
    signal:
      kind: predicate
      guaranteeId: g-gateway-observed
  - dimension: el pasaje cobrado sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-ticket-durable
referenceSolutions:
  - label: una cola, un despachador y un solo tablero
    contextInversion: "un solo componente de monitoreo es lo correcto cuando el mismo equipo opera la puerta de entrada, la venta y el despacho a los validadores: una pantalla, una guardia, y correlacionar un error de borde con uno de aplicación no cuesta nada porque están juntos. La cola con un solo consumidor es la topología más barata que hace que un reinicio no se lleve el pasaje cobrado: entrega, el despachador manda, y el mensaje se va. Quedan dos unidades operativas de margen para lo que venga."
    design:
      nodes:
        - id: pasajero
          type: actor
          label: Pasajero
          zone: public
        - id: app
          type: mobile-client
          label: App de pasajes
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de ventas
          zone: private
          role: ventas
          props: { criticality: "high", replicas: "2" }
        - id: baseventas
          type: database
          label: Base de ventas
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de pasajes por despachar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachador
          type: worker
          label: Despachador a validadores
          zone: private
        - id: validadores
          type: external-provider
          label: Validadores de a bordo
          zone: dmz
          role: validadores
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: pasajero-app
          from: { node: pasajero }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: ventas-baseventas
          from: { node: ventas }
          to: { node: baseventas }
          dataClass: personal
        - id: ventas-cola
          from: { node: ventas }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-validadores
          from: { node: despachador }
          to: { node: validadores }
          dataClass: personal
        - id: gw-monitoreo
          from: { node: gw }
          to: { node: monitoreo }
          dataClass: public
        - id: ventas-monitoreo
          from: { node: ventas }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: despachador-monitoreo
          from: { node: despachador }
          to: { node: monitoreo }
          dataClass: public
  - label: un registro releíble y la señal de borde separada de la de aplicación
    contextInversion: "un registro de eventos releíble conviene cuando el hecho de que se vendió un pasaje le va a servir a más de un proceso: hoy lo consume el despacho a los validadores, mañana la liquidación con las empresas concesionarias, cada uno con su propia posición de lectura. Y dos tableros tienen sentido cuando la puerta de entrada la opera el equipo de plataforma y la venta el equipo de producto: cada uno define sus umbrales y no despierta al otro por un problema que no le toca. Se paga con dos unidades operativas más que la otra opción, con lo que el presupuesto queda al límite, y con la correlación manual entre las dos vistas cuando un incidente cruza el borde."
    design:
      nodes:
        - id: pasajero
          type: actor
          label: Pasajero
          zone: public
        - id: web
          type: web-client
          label: Portal de pasajes
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de ventas
          zone: private
          role: ventas
          props: { criticality: "high", replicas: "2" }
        - id: baseventas
          type: database
          label: Base de ventas
          zone: restricted
          props: { backup: "diario" }
        - id: registro
          type: stream
          label: Registro de pasajes vendidos
          zone: private
          props: { retention: "14d", partitions: "6" }
        - id: despachador
          type: worker
          label: Despachador a validadores
          zone: private
        - id: validadores
          type: external-provider
          label: Validadores de a bordo
          zone: dmz
          role: validadores
        - id: tableroborde
          type: observability
          label: Monitoreo de borde
          zone: private
        - id: tableroapp
          type: observability
          label: Monitoreo de aplicación
          zone: private
      edges:
        - id: pasajero-web
          from: { node: pasajero }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: ventas-baseventas
          from: { node: ventas }
          to: { node: baseventas }
          dataClass: personal
        - id: ventas-registro
          from: { node: ventas }
          to: { node: registro }
          dataClass: personal
        - id: registro-despachador
          from: { node: registro }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-validadores
          from: { node: despachador }
          to: { node: validadores }
          dataClass: personal
        - id: gw-tableroborde
          from: { node: gw }
          to: { node: tableroborde }
          dataClass: public
        - id: ventas-tableroapp
          from: { node: ventas }
          to: { node: tableroapp }
          dataClass: public
        - id: registro-tableroapp
          from: { node: registro }
          to: { node: tableroapp }
          dataClass: public
        - id: despachador-tableroapp
          from: { node: despachador }
          to: { node: tableroapp }
          dataClass: public
        - id: baseventas-tableroapp
          from: { node: baseventas }
          to: { node: tableroapp }
          dataClass: public
status: PILOT
---

El mismo operador de transporte, el otro sistema: **la venta de pasajes por
la app**. **24.000 pasajes por día.**

El ejercicio anterior te pidió que no sumaras monitoreo. Este te pide lo
contrario, y por eso van juntos: el reflejo que aprendiste no es un error
que hay que corregir, es una herramienta que hay que saber cuándo usar. Acá
se usa.

En julio la venta dejó de funcionar a las 05:40. Lo descubrió **un chofer
por radio, cinco horas y media después**, cuando le llamó la atención que
nadie subiera con pasaje comprado. Se dejaron de vender **5.100 pasajes**.

La propuesta obvia es agregar un componente de monitoreo y conectarle todo.
Es la correcta, y la cuenta que lo demuestra es la siguiente. Del lado del
costo: **una unidad operativa, sobre cuatro que el equipo tiene libres.**
Del lado del beneficio: cinco horas y media de venta caída, medidas en
pasajes, valuadas por la contadora, con un número que el gerente repite de
memoria. Acá el presupuesto no está peleado con la señal: el sistema usa
tres unidades de siete.

Esa es toda la diferencia con el ejercicio anterior. Allá la unidad no
existía y una de las dos pantallas no despertaba a nadie. Acá sobran cuatro
y no hay ninguna pantalla. **La misma decisión, dos respuestas contrarias,
y la que decide no es la costumbre: es la cuenta.**

Hay un segundo agujero que el incidente de julio destapó de costado. El
pasaje cobrado **se le manda a los validadores de a bordo en el mismo
pedido en que se cobra**. Si el proceso de ventas se reinicia entre el
cobro y el envío, el pasajero pagó, ve su pasaje en el teléfono y el
validador no lo conoce. Esa discusión ocurre en la puerta del colectivo,
con el chofer de árbitro y doce personas esperando atrás.

**Armá el sistema** para que el equipo se entere de una falla sin depender
de una radio, para que la puerta de entrada también reporte, porque la mitad
de los incidentes del trimestre murieron ahí y nunca llegaron a la venta, y
para que el pasaje cobrado sobreviva a un reinicio del proceso que lo
cobró.
