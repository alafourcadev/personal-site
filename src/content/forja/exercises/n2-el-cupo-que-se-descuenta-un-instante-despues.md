---
title: "El cupo que se descuenta un instante después"
level: 2
role: trap
domain: hoteleria
D1: 2
D2: 2
D3: 2
D4: 1
D5: 1
D6: 1
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, si acá el problema es que dos piezas se sincronizan mal o que hay dos piezas donde debería haber una, y con qué número lo justificás."
lambda: 0.5
constraints:
  - metric: noches sobrevendidas por año
    operator: "<="
    value: 0
    unit: noches
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: reservar una habitación y descontar el cupo de esa noche son dos escrituras separadas por una llamada entre despliegues. Entre una y otra hay una ventana, y en esa ventana entra otra reserva.
    discoveryPath: "seguí una reserva desde que el huésped aprieta el botón hasta que el cupo baja, y contá cuántos actos separados hay. Si son dos, hay un instante en que la habitación está vendida y disponible al mismo tiempo, y eso no se arregla haciendo el segundo acto más rápido."
  - fact: el equipo ya bajó la ventana de 900 milisegundos a 40 con una cola y un conciliador. Las noches sobrevendidas pasaron de 1.240 a 96 por año. No pasaron a cero, y el contrato con las agencias dice cero.
    discoveryPath: "mirá qué pasó cada vez que el equipo achicó la ventana. Si el número baja pero nunca llega a cero, el problema no es el tamaño de la ventana: es que la ventana existe."
  - fact: los últimos cinco cambios de producto tocaron reservas y cupo al mismo tiempo. Fueron tarifa por noche extra, habitación conectada para familias, bloqueo por mantenimiento, cupo por canal y sobreventa deliberada del 3 % en temporada baja. Ninguno tocó sólo uno.
    discoveryPath: "hacé la lista de los últimos cambios del negocio y anotá qué piezas hubo que tocar en cada uno. Dos piezas que aparecen siempre en la misma fila no tienen un problema de comunicación: tienen una frontera de más."
startingDesign:
  nodes:
    - id: huesped
      type: actor
      label: Huésped
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Sitio de la cadena
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: reservas
      type: service
      label: Servicio de reservas
      zone: private
      role: booking-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: reservasdb
      type: database
      label: Base de reservas
      zone: restricted
      role: booking-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: cupo
      type: service
      label: Servicio de cupo
      zone: private
      role: inventory-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: cupodb
      type: database
      label: Base de cupo por noche
      zone: restricted
      role: inventory-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: cola
      type: queue
      label: Reservas confirmadas
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 300 }
    - id: conciliador
      type: worker
      label: Conciliador de cupo
      zone: private
      given: true
      props: { idempotent: "sí" }
      position: { x: 445, y: 520 }
  edges:
    - id: huesped-web
      from: { node: huesped }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-reservas
      from: { node: gw }
      to: { node: reservas }
      dataClass: personal
    - id: reservas-reservasdb
      from: { node: reservas }
      to: { node: reservasdb }
      dataClass: personal
    - id: reservas-cupo
      from: { node: reservas }
      to: { node: cupo }
      dataClass: public
    - id: cupo-cupodb
      from: { node: cupo }
      to: { node: cupodb }
      dataClass: public
    - id: reservas-cola
      from: { node: reservas }
      to: { node: cola }
      dataClass: personal
    - id: cola-conciliador
      from: { node: cola }
      to: { node: conciliador }
      dataClass: personal
    - id: conciliador-cupodb
      from: { node: conciliador }
      to: { node: cupodb }
      dataClass: public
guarantees:
  - id: g-inventory-is-not-a-separate-service
    label: el cupo deja de ser una pieza aparte de la reserva
    weight: 2
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [service]
            role: inventory-service
    whyMissing: el cupo sigue siendo un servicio propio, y por lo tanto reservar y descontar siguen siendo dos actos separados por una llamada entre despliegues.
    consequence: "la habitación queda vendida y disponible al mismo tiempo durante la ventana que hay entre los dos actos. Achicar esa ventana bajó las noches sobrevendidas de 1.240 a 96, y no las va a bajar a cero nunca: mientras haya dos actos, hay un instante entre los dos."
  - id: g-inventory-still-exists-under-the-booking-owner
    label: el cupo sigue existiendo como dato, escrito por el dueño de la reserva
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [database]
            role: inventory-db
        - op: covered
          target:
            role: inventory-db
          by:
            role: booking-service
    whyMissing: la base de cupo por noche no existe, o no está conectada al servicio de reservas.
    consequence: "juntar no es borrar. Un hotel sin cupo por noche no dejó de sobrevender: dejó de saber cuántas habitaciones tiene. Lo que cambia acá es quién lo escribe, no si existe."
  - id: g-booking-owner
    label: la reserva conserva su almacenamiento y su dueño
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [database]
            role: booking-db
        - op: covered
          target:
            role: booking-db
          by:
            role: booking-service
    whyMissing: la base de reservas no existe, o no está conectada al servicio de reservas.
    consequence: si desaparece el registro de la reserva, la cadena deja de saber quién duerme esta noche en cada habitación. Es el único dato del que el negocio no puede prescindir ni un turno.
  - id: g-guest-still-books
    label: el huésped sigue llegando al servicio de reservas
    weight: 2
    predicate:
      op: path
      from:
        type: [actor]
      to:
        role: booking-service
    whyMissing: no hay ningún camino desde el huésped hasta el servicio de reservas.
    consequence: "cero noches sobrevendidas es trivial si nadie puede reservar. La puerta de entrada del negocio es parte de la respuesta, no un detalle que se pierde al consolidar."
  - id: g-no-window-buying
    label: la consistencia del cupo no se compra con un intermediario
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: booking-service
      to:
        type: [queue, stream]
    whyMissing: el servicio de reservas sigue publicando la reserva en una cola o en un registro de eventos para que otro descuente el cupo después.
    consequence: "el intermediario es la ventana, con mejor nombre. Cada milisegundo que le sacás cuesta más que el anterior y ninguno te lleva al cero que el contrato con las agencias exige."
rubric:
  - dimension: reservar y descontar el cupo son un solo acto
    signal:
      kind: predicate
      guaranteeId: g-inventory-is-not-a-separate-service
  - dimension: consolidar no perdió el dato del cupo
    signal:
      kind: predicate
      guaranteeId: g-inventory-still-exists-under-the-booking-owner
  - dimension: la respuesta no se apoya en achicar una ventana
    signal:
      kind: predicate
      guaranteeId: g-no-window-buying
referenceSolutions:
  - label: una sola pieza de reservas, dueña del cupo
    contextInversion: "poner el cupo adentro de reservas es lo correcto acá porque reservar y descontar son el mismo acto del negocio: el huésped no compra una reserva y después un cupo. Los últimos cinco cambios de producto tocaron las dos piezas a la vez, lo cual dice que tampoco son dos cosas para el equipo. Se paga con que el cupo ya no se puede desplegar ni escalar por separado: si un pico de consultas de disponibilidad aprieta, aprieta sobre la misma pieza que confirma reservas."
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: web
          type: web-client
          label: Sitio de la cadena
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
          props: { criticality: "medium", replicas: "2" }
        - id: reservasdb
          type: database
          label: Base de reservas
          zone: restricted
          role: booking-db
          props: { backup: "diario" }
        - id: cupodb
          type: database
          label: Base de cupo por noche
          zone: restricted
          role: inventory-db
          props: { backup: "diario" }
      edges:
        - id: huesped-web
          from: { node: huesped }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: reservas-reservasdb
          from: { node: reservas }
          to: { node: reservasdb }
          dataClass: personal
        - id: reservas-cupodb
          from: { node: reservas }
          to: { node: cupodb }
          dataClass: public
  - label: reservas dueña del cupo, con un proceso aparte que libera lo vencido
    contextInversion: "separar la liberación de reservas vencidas conviene porque ese trabajo no participa del acto de reservar: corre por reloj, procesa miles de noches de una vez y puede reintentarse sin que nadie espere. Lo que no se separa es la decisión de vender una noche, que sigue siendo una sola escritura del dueño de la reserva. Se paga con una unidad operativa más y con una pieza que hay que vigilar para que no se atrase."
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: web
          type: web-client
          label: Sitio de la cadena
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
          props: { criticality: "medium", replicas: "2" }
        - id: reservasdb
          type: database
          label: Base de reservas
          zone: restricted
          role: booking-db
          props: { backup: "diario" }
        - id: cupodb
          type: database
          label: Base de cupo por noche
          zone: restricted
          role: inventory-db
          props: { backup: "diario" }
        - id: liberador
          type: worker
          label: Liberador de reservas vencidas
          zone: private
          props: { idempotent: "sí" }
      edges:
        - id: huesped-web
          from: { node: huesped }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: reservas-reservasdb
          from: { node: reservas }
          to: { node: reservasdb }
          dataClass: personal
        - id: reservas-cupodb
          from: { node: reservas }
          to: { node: cupodb }
          dataClass: public
        - id: reservas-liberador
          from: { node: reservas }
          to: { node: liberador }
          dataClass: personal
        - id: liberador-cupodb
          from: { node: liberador }
          to: { node: cupodb }
          dataClass: public
status: PILOT
---

Una cadena de hoteles, 31 propiedades. El sistema está separado como manda el
manual: **reservas** es dueño de la reserva y **cupo** es dueño de cuántas
habitaciones quedan por noche. Cada uno con su base. Nadie escribe en la base
del otro. Cuando reservas necesita bajar el cupo, se lo pide a cupo.

Y aun así, el año pasado la cadena **sobrevendió 1.240 noches**. Cada una es
una llamada del gerente a las once de la noche buscando dónde reubicar a
alguien que ya está en el lobby, y una penalidad de la agencia.

El equipo hizo lo razonable. Metió una cola entre las dos piezas para que el
descuento no dependiera de que cupo respondiera, puso un conciliador que
repasa lo que quedó desalineado, y bajó la ventana entre "reservé" y "descontá"
de **900 milisegundos a 40**. Las noches sobrevendidas pasaron de 1.240 a
**96**.

Noventa y seis no es cero. El contrato con las agencias dice cero. Y el
próximo salto, bajar de 40 milisegundos a 10, cuesta más que todos los
anteriores juntos y tampoco llega.

Hay un dato más sobre la mesa. Los últimos cinco cambios de producto tocaron
**reservas y cupo al mismo tiempo**: tarifa por noche extra, habitación
conectada para familias, bloqueo por mantenimiento, cupo por canal y
sobreventa deliberada del 3 % en temporada baja. Ninguno tocó sólo uno.

El equipo tiene **5 unidades operativas** y hoy usa 7.

**Rearmá el sistema** para que vender una noche sea un solo acto. Antes de
mover una pieza, decidí qué estás mirando: dos piezas que se sincronizan mal, o
dos piezas donde el negocio siempre tuvo una.
