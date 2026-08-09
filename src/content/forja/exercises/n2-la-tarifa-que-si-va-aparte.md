---
title: "La tarifa que sí va aparte"
level: 2
role: counter-trap
domain: hoteleria
D1: 1
D2: 2
D3: 2
D4: 1
D5: 1
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, cada cuánto cambia la tarifa, cada cuánto cambia la reserva, y por qué esta vez esos dos números sí justifican separar."
lambda: 0.5
constraints:
  - metric: cambios de tarifa aplicados por día
    operator: ">="
    value: 4200
    unit: cambios/día
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: revenue management cambia tarifas 4.200 veces por día desde su propia herramienta. El código de reservas se toca, en promedio, una vez cada tres semanas.
    discoveryPath: "poné los dos ritmos de cambio uno al lado del otro. Cuando una parte cambia miles de veces por día y la otra una vez cada tres semanas, no las mueve la misma razón, y lo que no cambia por la misma razón no tiene por qué desplegarse junto."
  - fact: la tarifa la leen cuatro consumidores. El sitio, la app, los revendedores autorizados y el motor de la central de reservas. Hoy los cuatro terminan leyendo la tabla de reservas, cada uno con su propia consulta.
    discoveryPath: "contá cuántas piezas distintas necesitan el mismo dato. Un dato con un solo consumidor puede vivir adentro de quien lo usa; un dato con cuatro consumidores y ninguno dueño ya es un contrato sin firmar."
  - fact: la promoción de invierno se publicó con un error de redondeo y hubo que revertirla. La reversión implicó desplegar el servicio de reservas, así que durante seis minutos no se pudo reservar en ninguna de las 31 propiedades.
    discoveryPath: "preguntate qué se cae cuando hay que revertir un cambio de tarifa. Si la respuesta incluye piezas que no tienen nada que ver con tarifas, la frontera está en el lugar equivocado."
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
    - id: revendedor
      type: external-party
      label: Revendedor autorizado
      zone: public
      given: true
      position: { x: 85, y: 190 }
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
    - id: tarifas
      type: service
      label: Consulta de tarifas
      zone: private
      role: rate-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: tarifasdb
      type: database
      label: Base de tarifas
      zone: restricted
      role: rate-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: huesped-web
      from: { node: huesped }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: revendedor-gw
      from: { node: revendedor }
      to: { node: gw }
      dataClass: public
    - id: gw-reservas
      from: { node: gw }
      to: { node: reservas }
      dataClass: personal
    - id: reservas-reservasdb
      from: { node: reservas }
      to: { node: reservasdb }
      dataClass: personal
    - id: reservas-tarifasdb
      from: { node: reservas }
      to: { node: tarifasdb }
      dataClass: public
    - id: gw-tarifas
      from: { node: gw }
      to: { node: tarifas }
      dataClass: public
    - id: tarifas-reservasdb
      from: { node: tarifas }
      to: { node: reservasdb }
      dataClass: personal
guarantees:
  - id: g-rate-reader-out-of-the-booking-store
    label: la consulta de tarifas no entra al almacenamiento de reservas
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: rate-service
      to:
        role: booking-db
    whyMissing: hay una conexión que sale de la consulta de tarifas y entra directo a la base de reservas.
    consequence: "mientras esa flecha exista, cambiar la forma de la tabla de reservas rompe la consulta de tarifas, y la tarifa que ven cuatro consumidores depende de la estructura interna de un almacenamiento que es de otro. Esa dependencia no está escrita en ningún contrato: está escrita en una consulta."
  - id: g-rate-owns-its-store
    label: la tarifa vive en su propio almacenamiento, escrito por su dueño
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [database]
            role: rate-db
        - op: covered
          target:
            role: rate-db
          by:
            role: rate-service
    whyMissing: la base de tarifas no existe, o no está conectada al servicio de tarifas.
    consequence: "un dato que cuatro piezas leen y ninguna escribe como dueña no tiene versión vigente: tiene cuatro interpretaciones. Darle un dueño es lo que convierte 'la tarifa' en un hecho y no en una opinión por consumidor."
  - id: g-booking-does-not-write-the-rate
    label: reservas deja de escribir la tarifa
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: booking-service
      to:
        role: rate-db
    whyMissing: el servicio de reservas sigue escribiendo directamente en la base de tarifas.
    consequence: "mientras reservas publique la tarifa, revertir una promoción mal calculada obliga a desplegar reservas. Eso ya pasó: seis minutos sin poder reservar en 31 propiedades por un error de redondeo que no tenía nada que ver con reservar."
  - id: g-booking-still-gets-the-rate
    label: la reserva sigue obteniendo la tarifa vigente, a través de su dueño
    weight: 2
    predicate:
      op: path
      from:
        role: booking-service
      to:
        role: rate-db
      via:
        role: rate-service
    whyMissing: no hay ningún camino desde el servicio de reservas hasta la base de tarifas que atraviese la consulta de tarifas.
    consequence: "separar sin dejar camino no es separar: es romper. Una reserva sin tarifa es un formulario que no se puede cobrar, y el límite bien puesto se atraviesa por la puerta del dueño, no se tapia."
  - id: g-booking-owner
    label: la reserva conserva su almacenamiento y su dueño
    weight: 1
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
    consequence: "mover la tarifa afuera no es mover la reserva afuera. Si el registro de quién duerme esta noche en cada habitación desaparece, el problema deja de ser de arquitectura y pasa a ser de recepción."
rubric:
  - dimension: cada dato lo escribe su dueño y sólo su dueño
    signal:
      kind: predicate
      guaranteeId: g-rate-owns-its-store
  - dimension: nadie depende de la forma interna del almacenamiento de otro
    signal:
      kind: predicate
      guaranteeId: g-rate-reader-out-of-the-booking-store
  - dimension: separar dejó camino, no un corte
    signal:
      kind: predicate
      guaranteeId: g-booking-still-gets-the-rate
referenceSolutions:
  - label: tarifas es la dueña de la tarifa y reservas se la pide
    contextInversion: "darle a la tarifa su propia pieza y su propio almacén es lo correcto acá porque la tarifa cambia 4.200 veces por día y el código de reservas una vez cada tres semanas: no los mueve la misma razón, y cuatro consumidores distintos necesitan la tarifa sin necesitar nada más de reservas. Se paga con que confirmar una reserva ahora depende de que tarifas responda, y con una llamada entre despliegues donde antes había una consulta local. En un negocio donde la tarifa y la reserva se escribieran en el mismo acto y tuvieran que ser verdad al mismo instante, esta decisión sería la equivocada."
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
        - id: revendedor
          type: external-party
          label: Revendedor autorizado
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
        - id: tarifas
          type: service
          label: Servicio de tarifas
          zone: private
          role: rate-service
          props: { criticality: "medium", replicas: "2" }
        - id: tarifasdb
          type: database
          label: Base de tarifas
          zone: restricted
          role: rate-db
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
        - id: revendedor-gw
          from: { node: revendedor }
          to: { node: gw }
          dataClass: public
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: reservas-reservasdb
          from: { node: reservas }
          to: { node: reservasdb }
          dataClass: personal
        - id: gw-tarifas
          from: { node: gw }
          to: { node: tarifas }
          dataClass: public
        - id: tarifas-tarifasdb
          from: { node: tarifas }
          to: { node: tarifasdb }
          dataClass: public
        - id: reservas-tarifas
          from: { node: reservas }
          to: { node: tarifas }
          dataClass: public
  - label: la tarifa se expone por su propia puerta para los canales externos
    contextInversion: "darle a tarifas su propia puerta de entrada conviene cuando los consumidores del dato no son los mismos que los de la reserva: los revendedores consultan tarifas miles de veces por hora y nunca reservan por ahí. Con una puerta propia, un pico de consultas de tarifa no compite por la misma entrada que la reserva del huésped, y se puede limitar por canal sin tocar el camino de la compra. Se paga con una unidad operativa más y con dos puertas que mantener y autenticar en vez de una."
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
        - id: revendedor
          type: external-party
          label: Revendedor autorizado
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada de reservas
          zone: dmz
        - id: gwtarifas
          type: api-gateway
          label: Puerta de entrada de tarifas
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
        - id: tarifas
          type: service
          label: Servicio de tarifas
          zone: private
          role: rate-service
          props: { criticality: "medium", replicas: "2" }
        - id: tarifasdb
          type: database
          label: Base de tarifas
          zone: restricted
          role: rate-db
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
        - id: revendedor-gwtarifas
          from: { node: revendedor }
          to: { node: gwtarifas }
          dataClass: public
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: reservas-reservasdb
          from: { node: reservas }
          to: { node: reservasdb }
          dataClass: personal
        - id: gwtarifas-tarifas
          from: { node: gwtarifas }
          to: { node: tarifas }
          dataClass: public
        - id: tarifas-tarifasdb
          from: { node: tarifas }
          to: { node: tarifasdb }
          dataClass: public
        - id: reservas-tarifas
          from: { node: reservas }
          to: { node: tarifas }
          dataClass: public
status: PILOT
---

La misma cadena de 31 hoteles, otro par de responsabilidades, la misma
pregunta: **¿esto vive en una pieza o en dos?**

Con el cupo, la respuesta fue una. Acá no.

Revenue management cambia tarifas **4.200 veces por día** desde su propia
herramienta: temporada, día de la semana, ocupación de la competencia,
promociones por canal. El código del servicio de reservas se toca, en promedio,
**una vez cada tres semanas**.

Hoy la tarifa vigente vive adentro de la base de reservas y la escribe el
servicio de reservas. La base de tarifas existe, pero sólo guarda el
histórico, y la pieza que se llama "consulta de tarifas" no es dueña de nada:
lee la tabla de reservas con su propia consulta, igual que el sitio, la app y
el motor de la central. Cuatro consumidores, cuatro consultas, ningún dueño.

La factura llegó en julio. La promoción de invierno se publicó con un error de
redondeo y hubo que revertirla. Revertirla significó **desplegar el servicio de
reservas**, y durante **seis minutos** no se pudo reservar en ninguna de las 31
propiedades. El error era de tarifas. La caída fue de reservas.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que la tarifa tenga un dueño que la escriba y un
lugar propio donde vivir, y para que la reserva siga pudiendo obtener la tarifa
vigente cuando la necesita. Esta vez la respuesta que primero se te ocurre es
la correcta: lo que tenés que poder explicar es **por qué acá sí y con el cupo
no**.
