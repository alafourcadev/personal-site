---
title: "El grupo hotelero que frenó la cola de todos"
level: 8
role: core
domain: hoteleria
D1: 3
D2: 2
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [7]
budget:
  opsUnits: 8
aiBudget: "libre, pero tu respuesta tiene que explicar por qué una única cola compartida convierte el trabajo pesado de un cliente en la demora de todos los demás, incluida la de un viajero que no tiene nada que ver con las tarifas."
lambda: 0.5
constraints:
  - metric: hoteles sobre la misma plataforma
    operator: ">="
    value: 240
    unit: hoteles
  - metric: demora aceptable entre confirmar una reserva y avisarle al hotel
    operator: "<="
    value: 2
    unit: minutos
hiddenFacts:
  - fact: "la confirmación de una reserva y la carga masiva de tarifas entran en la misma cola. No es que la carga sea lenta: es que la confirmación está atrás de ella."
    discoveryPath: "mirá qué componentes escriben en la cola y cuáles la consumen. Dos productores muy distintos sobre una sola cola ordenada significan que el más lento le pone el ritmo al más urgente."
  - fact: "el grupo hotelero carga las doce temporadas de sus noventa hoteles en un solo envío de 1.100.000 tarifas, el primer día hábil del mes. Los otros 150 hoteles cargan entre 300 y 6.000 tarifas cuando les toca."
    discoveryPath: "compará el tamaño del envío más grande contra la demora prometida. Una cola común y ordenada procesa un envío completo antes de tocar el siguiente: la demora del último es la suma de todo lo que tiene adelante."
  - fact: "una cola de mensajes avanza en una sola secuencia: el que llegó primero sale primero, para todos. Un registro de eventos se divide en tramos que avanzan en paralelo y sólo se ordena dentro de cada tramo."
    discoveryPath: "son los dos componentes de infraestructura que pueden llevar trabajo asíncrono. Uno declara en cuántos tramos se divide; el otro no tiene el concepto, porque no lo necesita."
startingDesign:
  nodes:
    - id: viajero
      type: actor
      label: Viajero
      zone: public
      given: true
      position: { x: 85, y: 60 }
    - id: hotelero
      type: actor
      label: Responsable del hotel
      zone: public
      given: true
      position: { x: 85, y: 170 }
    - id: app
      type: web-client
      label: Buscador de hoteles
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: extranet
      type: web-client
      label: Extranet del hotel
      zone: public
      given: true
      position: { x: 445, y: 170 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 280 }
    - id: reservas
      type: service
      label: Servicio de reservas
      zone: private
      role: booking-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 390 }
    - id: tarifas
      type: service
      label: Servicio de tarifas
      zone: private
      role: rates-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 500 }
    - id: cola
      type: queue
      label: Cola común de la plataforma
      zone: private
      role: shared-queue
      given: true
      props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
      position: { x: 805, y: 400 }
    - id: avisos
      type: worker
      label: Aviso al hotel
      zone: private
      role: notifier-worker
      given: true
      position: { x: 445, y: 610 }
    - id: cargador
      type: worker
      label: Cargador de tarifas
      zone: private
      role: rates-loader
      given: true
      position: { x: 445, y: 720 }
    - id: inventario
      type: database
      label: Base de inventario
      zone: restricted
      role: inventory-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 560 }
  edges:
    - id: viajero-app
      from: { node: viajero }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: hotelero-extranet
      from: { node: hotelero }
      to: { node: extranet }
      dataClass: public
    - id: extranet-gw
      from: { node: extranet }
      to: { node: gw }
      dataClass: personal
    - id: gw-reservas
      from: { node: gw }
      to: { node: reservas }
      dataClass: personal
    - id: gw-tarifas
      from: { node: gw }
      to: { node: tarifas }
      dataClass: public
    - id: reservas-inventario
      from: { node: reservas }
      to: { node: inventario }
      dataClass: personal
    - id: tarifas-inventario
      from: { node: tarifas }
      to: { node: inventario }
      dataClass: public
    - id: reservas-cola
      from: { node: reservas }
      to: { node: cola }
      dataClass: personal
    - id: tarifas-cola
      from: { node: tarifas }
      to: { node: cola }
      dataClass: public
    - id: cola-avisos
      from: { node: cola }
      to: { node: avisos }
      dataClass: personal
    - id: cola-cargador
      from: { node: cola }
      to: { node: cargador }
      dataClass: public
    - id: cargador-inventario
      from: { node: cargador }
      to: { node: inventario }
      dataClass: public
guarantees:
  - id: g-partitioned-lane
    label: la carga de tarifas viaja por un registro de eventos dividido en tramos que avanzan en paralelo
    weight: 3
    predicate:
      op: exists
      node:
        type: [stream]
        propEquals: { partitions: "3" }
    whyMissing: todo el trabajo asíncrono de la plataforma entra en una sola cola ordenada, donde el que llegó primero se procesa completo antes de que empiece el siguiente.
    consequence: "el envío de 1.100.000 tarifas del grupo se procesa entero antes de que se toque el de un hotel de doce habitaciones. La demora que sufre el último no depende de su propio tamaño: depende del tamaño del que estaba adelante."
  - id: g-load-through-lane
    label: el servicio de tarifas le entrega la carga al cargador por ese registro
    weight: 3
    predicate:
      op: path
      from:
        role: rates-service
      to:
        role: rates-loader
      via:
        type: [stream]
    whyMissing: no hay ningún camino desde el servicio de tarifas hasta el cargador que pase por un registro de eventos dividido en tramos.
    consequence: un registro nuevo no resuelve nada si el trabajo sigue entrando por el viejo. Un componente que existe pero no está en el camino es una pieza más para operar y cero problemas resueltos.
  - id: g-rates-off-shared-lane
    label: la carga de tarifas no entra en la cola común de la plataforma
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: rates-service
      to:
        role: shared-queue
    whyMissing: el servicio de tarifas sigue escribiendo en la misma cola por la que viajan las confirmaciones de reserva.
    consequence: "el viajero que reservó a las 09:02 del primer día hábil del mes esperó cuarenta minutos a que el hotel recibiera el aviso. No hubo ninguna caída y nadie tocó un servidor: su confirmación estaba detrás de un millón de tarifas que no tenían nada que ver con él."
  - id: g-confirmation-still-delivered
    label: la confirmación de la reserva sigue llegando al proceso que le avisa al hotel
    weight: 2
    predicate:
      op: path
      from:
        role: booking-service
      to:
        role: notifier-worker
    whyMissing: no queda ningún camino desde el servicio de reservas hasta el proceso que avisa al hotel.
    consequence: sacar la carga de tarifas de la cola también arregla la demora si de paso se corta el aviso, y entonces el hotel se entera del huésped cuando toca el timbre. Separar registros es separar, no dejar de entregar.
rubric:
  - dimension: el trabajo pesado deja de viajar en una sola cola
    signal:
      kind: predicate
      guaranteeId: g-partitioned-lane
  - dimension: el registro nuevo es el camino real, no una pieza al costado
    signal:
      kind: predicate
      guaranteeId: g-load-through-lane
  - dimension: lo urgente deja de esperar detrás de lo pesado
    signal:
      kind: predicate
      guaranteeId: g-rates-off-shared-lane
  - dimension: el hotel se sigue enterando de sus reservas
    signal:
      kind: predicate
      guaranteeId: g-confirmation-still-delivered
referenceSolutions:
  - label: un registro propio para la carga masiva, la cola común queda para los avisos
    contextInversion: "dejar la cola común para las confirmaciones y abrir un registro aparte para la carga conviene cuando el aviso al hotel necesita reintento por mensaje y un destino para lo que falla siempre (cosas que una cola da y un registro de eventos dividido en tramos no), y cuando el equipo ya sabe operar esa cola. Se paga con dos piezas de mensajería en vez de una: dos formas de mirar el atraso, dos alertas, dos maneras de equivocarse."
    design:
      nodes:
        - id: viajero
          type: actor
          label: Viajero
          zone: public
        - id: hotelero
          type: actor
          label: Responsable del hotel
          zone: public
        - id: app
          type: web-client
          label: Buscador de hoteles
          zone: public
        - id: extranet
          type: web-client
          label: Extranet del hotel
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reservas
          type: service
          label: Servicio de reservas
          zone: private
          role: booking-service
          props: { criticality: "high", replicas: "2" }
        - id: tarifas
          type: service
          label: Servicio de tarifas
          zone: private
          role: rates-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de avisos al hotel
          zone: private
          role: shared-queue
          props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
        - id: flujo
          type: stream
          label: Registro de carga de tarifas
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: avisos
          type: worker
          label: Aviso al hotel
          zone: private
          role: notifier-worker
        - id: cargador
          type: worker
          label: Cargador de tarifas
          zone: private
          role: rates-loader
        - id: inventario
          type: database
          label: Base de inventario
          zone: restricted
          role: inventory-store
          props: { backup: "diario" }
      edges:
        - id: viajero-app
          from: { node: viajero }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: hotelero-extranet
          from: { node: hotelero }
          to: { node: extranet }
          dataClass: public
        - id: extranet-gw
          from: { node: extranet }
          to: { node: gw }
          dataClass: personal
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: gw-tarifas
          from: { node: gw }
          to: { node: tarifas }
          dataClass: public
        - id: reservas-inventario
          from: { node: reservas }
          to: { node: inventario }
          dataClass: personal
        - id: tarifas-inventario
          from: { node: tarifas }
          to: { node: inventario }
          dataClass: public
        - id: reservas-cola
          from: { node: reservas }
          to: { node: cola }
          dataClass: personal
        - id: cola-avisos
          from: { node: cola }
          to: { node: avisos }
          dataClass: personal
        - id: tarifas-flujo
          from: { node: tarifas }
          to: { node: flujo }
          dataClass: public
        - id: flujo-cargador
          from: { node: flujo }
          to: { node: cargador }
          dataClass: public
        - id: cargador-inventario
          from: { node: cargador }
          to: { node: inventario }
          dataClass: public
  - label: un solo registro de eventos dividido en tramos para todo lo asíncrono
    contextInversion: "unificar todo en un registro de eventos dividido en tramos conviene cuando el equipo puede sostener una sola pieza de mensajería y lo que hay que garantizar es el orden dentro de cada hotel, no entre hoteles: el tramo se elige por hotel y dos clientes distintos nunca se pisan. Se paga con que el aviso al hotel pierde el reintento por mensaje y el destino de lo que falla siempre; si un aviso rompe, el tramo entero se traba hasta que alguien lo saque a mano."
    design:
      nodes:
        - id: viajero
          type: actor
          label: Viajero
          zone: public
        - id: hotelero
          type: actor
          label: Responsable del hotel
          zone: public
        - id: app
          type: web-client
          label: Buscador de hoteles
          zone: public
        - id: extranet
          type: web-client
          label: Extranet del hotel
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reservas
          type: service
          label: Servicio de reservas
          zone: private
          role: booking-service
          props: { criticality: "high", replicas: "2" }
        - id: tarifas
          type: service
          label: Servicio de tarifas
          zone: private
          role: rates-service
          props: { criticality: "high", replicas: "2" }
        - id: flujo
          type: stream
          label: Registro único por hotel
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: avisos
          type: worker
          label: Aviso al hotel
          zone: private
          role: notifier-worker
        - id: cargador
          type: worker
          label: Cargador de tarifas
          zone: private
          role: rates-loader
        - id: inventario
          type: database
          label: Base de inventario
          zone: restricted
          role: inventory-store
          props: { backup: "diario" }
      edges:
        - id: viajero-app
          from: { node: viajero }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: hotelero-extranet
          from: { node: hotelero }
          to: { node: extranet }
          dataClass: public
        - id: extranet-gw
          from: { node: extranet }
          to: { node: gw }
          dataClass: personal
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: gw-tarifas
          from: { node: gw }
          to: { node: tarifas }
          dataClass: public
        - id: reservas-inventario
          from: { node: reservas }
          to: { node: inventario }
          dataClass: personal
        - id: tarifas-inventario
          from: { node: tarifas }
          to: { node: inventario }
          dataClass: public
        - id: reservas-flujo
          from: { node: reservas }
          to: { node: flujo }
          dataClass: personal
        - id: tarifas-flujo
          from: { node: tarifas }
          to: { node: flujo }
          dataClass: public
        - id: flujo-avisos
          from: { node: flujo }
          to: { node: avisos }
          dataClass: personal
        - id: flujo-cargador
          from: { node: flujo }
          to: { node: cargador }
          dataClass: public
        - id: cargador-inventario
          from: { node: cargador }
          to: { node: inventario }
          dataClass: public
status: PILOT
---

Un motor de reservas que usan **240 hoteles**. El viajero reserva desde el
buscador; el hotel carga sus tarifas de temporada desde la extranet. Todo lo
que no se resuelve en el momento, sea el aviso de una reserva al hotel o
la carga de un archivo de tarifas, entra en la misma cola y sale en el
mismo orden en que entró.

Uno de esos 240 clientes no es un hotel: es un grupo con **noventa
hoteles**. Carga las doce temporadas de sus noventa hoteles en un único
envío de **1.100.000 tarifas**, el primer día hábil de cada mes, a las
08:00.

El 2 de septiembre, una viajera reservó a las 09:02. El hotel recibió el
aviso a las 09:44.

No hubo ninguna caída. Nadie tocó un servidor. La confirmación de esa reserva
estaba en la misma cola que un millón de tarifas de un cliente con el que no
tenía nada que ver, y en una cola ordenada nada empieza hasta que termina
todo lo que estaba adelante.

La plataforma promete que el hotel se entera en **dos minutos**. Ese día
falló para todos los que reservaron entre las 08:00 y las 11:20, en los 240
hoteles.

El equipo tiene **8 unidades operativas** y hoy usa 7.

**Rearmá el sistema** para que el tamaño del envío de un cliente deje de
decidir cuánto espera el resto, y para que sacar la carga pesada del medio no
signifique dejar de avisarle al hotel.
