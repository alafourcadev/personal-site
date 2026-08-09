---
title: "El finde largo en que el hotel atendió a la mitad"
level: 6
role: synthesis
domain: hoteleria
D1: 2
D2: 2
D3: 3
D4: 2
D5: 3
D6: 2
D7: 4
D8: 0
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 8
aiBudget: "libre, pero tu respuesta tiene que recorrer las tres caídas del enunciado y decir, para cada una, qué deja de funcionar en tu diseño y qué sigue funcionando. Si en las tres decís «sigue funcionando todo», no rediseñaste: dibujaste."
lambda: 0.5
constraints:
  - metric: reservas intentadas durante el fin de semana largo
    operator: ">="
    value: 9700
    unit: reservas
  - metric: reservas que efectivamente se cerraron
    operator: "<="
    value: 4100
    unit: reservas
  - metric: tiempo máximo de desincronización tolerable con los portales
    operator: "<="
    value: 10
    unit: minutos
  - metric: presupuesto operativo del equipo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: "el conector de portales devolvió errores intermitentes durante 14 horas, no una caída limpia. Como el servicio de reservas lo llamaba dentro del mismo pedido, cada reserva que tocaba un error intermitente moría con él, incluso las reservas directas que no tenían nada que ver con los portales."
    discoveryPath: "seguí qué le pasa a una reserva directa, de alguien que entró por la web del hotel, cuando el conector de portales falla. Si muere igual, es que el fallo de una parte se está propagando a todo."
  - fact: "de las 9.700 reservas intentadas, 5.600 no se cerraron. De esas, la enorme mayoría no tenía ningún problema propio: la habitación estaba libre y el pago era válido."
    discoveryPath: "compará cuántas reservas fallaron por su propia causa contra cuántas fallaron por arrastre. La diferencia es el costo exacto de no haber aislado nada."
  - fact: "durante esas 14 horas tampoco se pudo consultar ninguna reserva existente, ni desde la web ni desde la recepción del hotel: el único camino hasta el dato pasaba por el mismo servicio que estaba muriendo."
    discoveryPath: "contá cuántos caminos distintos llegan hoy al dato de una reserva. Si es uno solo, quien consulta y quien reserva comparten destino cuando ese camino falla."
  - fact: "sincronizar con los portales tiene diez minutos de tolerancia: si la disponibilidad llega tarde, se corrige. Si no llega nunca, se sobrevende, y una sobreventa en fin de semana largo es un huésped en la puerta sin habitación."
    discoveryPath: "no todo lo que sale hacia afuera tiene la misma urgencia ni la misma obligación. Preguntate qué pasa si esa sincronización se demora diez minutos, y qué pasa si se pierde."
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
      label: Web del hotel
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
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: base
      type: database
      label: Base de reservas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: portales
      type: external-provider
      label: Conector de portales de venta
      zone: dmz
      role: channel-manager
      given: true
      position: { x: 445, y: 410 }
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
    - id: reservas-base
      from: { node: reservas }
      to: { node: base }
      dataClass: personal
    - id: reservas-portales
      from: { node: reservas }
      to: { node: portales }
      dataClass: personal
guarantees:
  - id: g-reserva-no-espera-a-los-portales
    label: cerrar una reserva no depende de que el conector de portales conteste
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: booking-service
      to:
        role: channel-manager
    whyMissing: el servicio de reservas llama al conector de portales dentro del mismo pedido. El error del conector es el error de la reserva, aunque la reserva no venga de ningún portal.
    consequence: "14 horas de errores intermitentes del conector se convirtieron en 5.600 reservas caídas, la mayoría de ellas con habitación libre y pago válido. El fallo de una parte se comió el sistema entero."
  - id: g-sincronizacion-no-se-pierde
    label: la sincronización con los portales llega igual, por una pieza que sobrevive un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: booking-service
      to:
        role: channel-manager
    whyMissing: "no hay ninguna pieza durable entre el servicio de reservas y el conector de portales. Sacar la llamada del camino del huésped sin poner nada en el medio no aísla el fallo: elimina la sincronización."
    consequence: la disponibilidad deja de viajar hacia los portales y nadie se entera hasta la sobreventa. En fin de semana largo, una sobreventa es un huésped en la puerta a las once de la noche sin habitación.
  - id: g-consulta-independiente
    label: consultar una reserva existente no pasa por el servicio que las crea
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [database]
      forbid:
        role: booking-service
    whyMissing: todos los caminos desde la puerta de entrada hasta el dato de una reserva atraviesan el servicio de reservas. Leer y escribir comparten la única pieza que puede caerse.
    consequence: "durante las 14 horas nadie pudo ver su reserva: ni el huésped desde la web ni la recepción del hotel. Gente con reserva confirmada discutiendo en el mostrador con alguien que tampoco la podía ver."
  - id: g-reservas-sigue-escribiendo
    label: el servicio de reservas sigue existiendo y sigue llegando al dato
    weight: 1
    predicate:
      op: path
      from:
        role: booking-service
      to:
        type: [database]
    whyMissing: "el servicio de reservas no llega a ninguna base. Agregar un camino de lectura no reemplaza al que escribe: sin la pieza que crea reservas, el camino nuevo lee un dato que nadie actualiza."
    consequence: una lectura rápida sobre datos que nadie escribe es una respuesta veloz y equivocada. El sistema deja de fallar y empieza a mentir, que tarda mucho más en detectarse.
rubric:
  - dimension: el fallo de una integración externa no se propaga a la operación propia
    signal:
      kind: predicate
      guaranteeId: g-reserva-no-espera-a-los-portales
  - dimension: aislar el fallo no es borrar la función que fallaba
    signal:
      kind: predicate
      guaranteeId: g-sincronizacion-no-se-pierde
  - dimension: leer y escribir no comparten la única pieza que se puede caer
    signal:
      kind: predicate
      guaranteeId: g-consulta-independiente
  - dimension: la redundancia se agrega, no se consigue borrando lo que molestaba
    signal:
      kind: predicate
      guaranteeId: g-reservas-sigue-escribiendo
referenceSolutions:
  - label: cola de sincronización y un servicio de consultas sobre la misma base
    contextInversion: "cola para lo que sale y un segundo servicio para lo que entra a leer es lo correcto cuando el dato tiene que estar fresco en la consulta, porque la recepción no puede ver una reserva de hace un minuto, y cuando el equipo prefiere una sola base que respaldar y auditar. Es la topología con menos piezas que cumple las cuatro obligaciones y deja dos unidades operativas de margen. El costo es que la base sigue siendo compartida: un bloqueo largo de escritura se nota en la lectura."
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: web
          type: web-client
          label: Web del hotel
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
        - id: base
          type: database
          label: Base de reservas
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de sincronización con portales
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: sincronizador
          type: worker
          label: Sincronizador de disponibilidad
          zone: private
        - id: consultas
          type: service
          label: Servicio de consultas de reserva
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: portales
          type: external-provider
          label: Conector de portales de venta
          zone: dmz
          role: channel-manager
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
        - id: reservas-base
          from: { node: reservas }
          to: { node: base }
          dataClass: personal
        - id: reservas-cola
          from: { node: reservas }
          to: { node: cola }
          dataClass: personal
        - id: cola-sincronizador
          from: { node: cola }
          to: { node: sincronizador }
          dataClass: personal
        - id: sincronizador-portales
          from: { node: sincronizador }
          to: { node: portales }
          dataClass: personal
        - id: gw-consultas
          from: { node: gw }
          to: { node: consultas }
          dataClass: personal
        - id: consultas-base
          from: { node: consultas }
          to: { node: base }
          dataClass: personal
  - label: registro de reservas con una copia de lectura propia
    contextInversion: "publicar cada reserva en un registro durable y proyectarla a una copia de lectura conviene cuando la consulta tiene que seguir en pie aunque la escritura esté completamente detenida, con la recepción atendiendo y el servicio de reservas apagado, y cuando querés poder volver a pasar un rango de reservas hacia los portales después de un incidente, sin tocar el dato original. El mismo registro alimenta la sincronización y la lectura. Se paga con una unidad operativa más, con una ventana de segundos en la que la copia va atrás del registro, y con dos consumidores que hay que operar en vez de uno."
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: web
          type: web-client
          label: Web del hotel
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
        - id: registro
          type: stream
          label: Registro de reservas
          zone: private
          props: { retention: "30d", partitions: "6" }
        - id: sincronizador
          type: worker
          label: Sincronizador de disponibilidad
          zone: private
        - id: proyector
          type: worker
          label: Proyector de reservas
          zone: private
        - id: copia
          type: database
          label: Copia de lectura de reservas
          zone: restricted
          props: { backup: "diario" }
        - id: consultas
          type: service
          label: Servicio de consultas de reserva
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: portales
          type: external-provider
          label: Conector de portales de venta
          zone: dmz
          role: channel-manager
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
        - id: reservas-registro
          from: { node: reservas }
          to: { node: registro }
          dataClass: personal
        - id: registro-sincronizador
          from: { node: registro }
          to: { node: sincronizador }
          dataClass: personal
        - id: sincronizador-portales
          from: { node: sincronizador }
          to: { node: portales }
          dataClass: personal
        - id: registro-proyector
          from: { node: registro }
          to: { node: proyector }
          dataClass: personal
        - id: proyector-copia
          from: { node: proyector }
          to: { node: copia }
          dataClass: personal
        - id: gw-consultas
          from: { node: gw }
          to: { node: consultas }
          dataClass: personal
        - id: consultas-copia
          from: { node: consultas }
          to: { node: copia }
          dataClass: personal
status: PILOT
---

Una cadena de tres hoteles. Un fin de semana largo. **9.700 reservas
intentadas** y **4.100 cerradas**.

Las 5.600 que faltan no fallaron por su propia causa. Casi todas tenían la
habitación libre y el pago válido.

Lo que pasó fue esto, y son tres cosas encadenadas.

**Una.** El conector de portales de venta, el que sincroniza disponibilidad
con las agencias, devolvió errores intermitentes durante **14 horas**. No una
caída limpia: errores salteados. El servicio de reservas lo llamaba dentro
del mismo pedido, así que cada reserva que tocaba un error moría con él.
También las reservas directas de la web del hotel, que no tenían nada que ver
con ningún portal.

**Dos.** Nadie pensó en sacar esa llamada del camino, porque sacarla sin más
significa dejar de sincronizar, y dejar de sincronizar significa sobrevender.
La sincronización tolera **diez minutos** de demora sin problema. Lo que no
tolera es perderse: una sobreventa en fin de semana largo es un huésped en la
puerta a las once de la noche.

**Tres.** Durante esas 14 horas tampoco se pudo consultar ninguna reserva
existente. Ni desde la web ni desde la recepción del hotel. El único camino
hasta el dato pasaba por el mismo servicio que se estaba muriendo, así que
hubo gente con reserva confirmada discutiendo en el mostrador con alguien que
tampoco la podía ver.

El equipo tiene **8 unidades operativas** y hoy usa 3.

**Rearmá el sistema entero.** Este ejercicio junta el nivel: el error de una
integración externa no puede propagarse a la operación propia; aislar ese
fallo no puede significar apagar la función que fallaba; y consultar una
reserva no puede depender de la misma pieza que las crea, sin borrar esa
pieza, que es la que escribe.
