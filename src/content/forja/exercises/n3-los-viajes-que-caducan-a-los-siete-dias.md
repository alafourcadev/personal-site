---
title: "Los viajes que caducan a los siete días"
level: 3
role: core
domain: transporte
D1: 2
D2: 1
D3: 3
D4: 2
D5: 2
D6: 1
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir qué pasa con la factura de un viaje del 2 de marzo cuando el reclamo llega el 14 de abril."
lambda: 0.5
constraints:
  - metric: viajes registrados por día
    operator: ">="
    value: 18000
    unit: viajes
  - metric: años que la factura debe poder reconstruirse
    operator: ">="
    value: 5
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "el registro de viajes conserva siete días y después descarta. No es una falla ni un parámetro mal puesto: es lo que hace un registro de eventos, y siete días es más que suficiente para lo que se diseñó."
    discoveryPath: "el registro lo dice en su propia configuración de retención. La pregunta no es si el número está bien, es quién está apoyado en él sin saberlo."
  - fact: "facturación lee el viaje del mismo registro que el panel de operaciones. Se conectó ahí porque el dato ya estaba pasando por ahí y era lo más rápido de implementar."
    discoveryPath: "mirá de dónde sale la conexión que entra a facturación. Un consumidor más sobre un registro que ya existe es la decisión más barata del día y la más cara del año."
  - fact: "en abril llegaron 62 reclamos de viajes de marzo. Ninguno se pudo verificar contra el dato original."
    discoveryPath: "es la consecuencia de que el único lugar donde existía el viaje fuera algo que caduca. El sistema no falló: hizo exactamente lo que la retención decía que iba a hacer."
startingDesign:
  nodes:
    - id: conductor
      type: actor
      label: Conductor
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App del conductor
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: viajes
      type: service
      label: Servicio de viajes
      zone: private
      role: trip-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: flujo
      type: stream
      label: Registro de viajes (retención 7 días)
      zone: private
      given: true
      props: { retention: "7d", partitions: "6", ordering: "sí" }
      position: { x: 805, y: 410 }
    - id: panel
      type: worker
      label: Panel de operaciones
      zone: private
      given: true
      position: { x: 445, y: 300 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: billing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 520 }
  edges:
    - id: conductor-app
      from: { node: conductor }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-viajes
      from: { node: gw }
      to: { node: viajes }
      dataClass: personal
    - id: viajes-flujo
      from: { node: viajes }
      to: { node: flujo }
      dataClass: personal
    - id: flujo-panel
      from: { node: flujo }
      to: { node: panel }
      dataClass: personal
    - id: flujo-facturacion
      from: { node: flujo }
      to: { node: facturacion }
      dataClass: personal
guarantees:
  - id: g-viaje-registrado
    label: el viaje queda en una base que no caduca
    weight: 2
    predicate:
      op: path
      from:
        role: trip-service
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de viajes hasta una base de datos, así que el único lugar donde existe un viaje es un registro de eventos que descarta a los siete días.
    consequence: "el día 8 el viaje no existió nunca. No hay error, no hay alerta, no hay hueco visible: hay una consulta que devuelve vacío y un cliente que dice que sí viajó."
  - id: g-facturacion-no-depende-de-lo-que-caduca
    label: facturación no toma el viaje del registro que caduca
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [stream]
      to:
        role: billing-service
    whyMissing: el servicio de facturación sigue recibiendo el viaje directamente del registro de eventos.
    consequence: "si facturación se atrasa más que la retención, esos viajes no se facturan y nadie lo nota: no quedó ningún rastro de que existieran. Un consumidor tardío de algo que caduca pierde dato en silencio."
  - id: g-facturacion-lee-el-registro
    label: facturación llega al viaje guardado en la base
    weight: 2
    predicate:
      op: path
      from:
        role: billing-service
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de facturación hasta una base de datos.
    consequence: "desconectar facturación del registro de eventos y no darle otra fuente deja de facturar. La decisión no es de dónde sacarlo el equipo: es que el dato de la factura tiene que salir de la base, que es el único lugar donde el viaje sigue existiendo en abril."
  - id: g-historico-archivado
    label: el histórico de viajes se archiva fuera de la base operativa
    weight: 1
    predicate:
      op: path
      from:
        role: trip-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de viajes hasta un almacenamiento de objetos.
    consequence: los cinco años de historia que hay que poder reconstruir quedan dentro de la base que atiende las consultas del día. A dieciocho mil viajes diarios eso son treinta y tres millones de filas compitiendo con la operación, y el día que hay que responderle a un auditor la consulta corre sobre la misma base que usa el conductor.
rubric:
  - dimension: el viaje existe en un lugar que no tiene fecha de vencimiento
    signal:
      kind: predicate
      guaranteeId: g-viaje-registrado
  - dimension: ningún consumidor de negocio depende de una retención
    signal:
      kind: predicate
      guaranteeId: g-facturacion-no-depende-de-lo-que-caduca
  - dimension: cortar la fuente vieja no deja de facturar
    signal:
      kind: predicate
      guaranteeId: g-facturacion-lee-el-registro
  - dimension: la historia larga no compite con la operación del día
    signal:
      kind: predicate
      guaranteeId: g-historico-archivado
referenceSolutions:
  - label: la base es la fuente y el registro de eventos queda para operaciones
    contextInversion: "conservar el registro de eventos tiene sentido cuando el panel de operaciones necesita ver el viaje mientras está pasando: el registro sirve para mirar el ahora y la base sirve para lo que hay que poder reconstruir. Cada consumidor toma de donde le corresponde. Se paga con una pieza más para operar y con la disciplina de que nadie nuevo se enchufe al registro para leer algo que después va a necesitar en marzo."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Conductor
          zone: public
        - id: app
          type: mobile-client
          label: App del conductor
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: viajes
          type: service
          label: Servicio de viajes
          zone: private
          role: trip-service
          props: { criticality: "high", replicas: "2" }
        - id: baseviajes
          type: database
          label: Base de viajes (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo histórico de viajes
          zone: private
        - id: flujo
          type: stream
          label: Registro de viajes (retención 7 días)
          zone: private
          props: { retention: "7d", partitions: "6", ordering: "sí" }
        - id: panel
          type: worker
          label: Panel de operaciones
          zone: private
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
      edges:
        - id: conductor-app
          from: { node: conductor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-viajes
          from: { node: gw }
          to: { node: viajes }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: viajes-base
          from: { node: viajes }
          to: { node: baseviajes }
          dataClass: personal
        - id: viajes-archivo
          from: { node: viajes }
          to: { node: archivo }
          dataClass: personal
        - id: viajes-flujo
          from: { node: viajes }
          to: { node: flujo }
          dataClass: personal
        - id: flujo-panel
          from: { node: flujo }
          to: { node: panel }
          dataClass: personal
        - id: facturacion-base
          from: { node: facturacion }
          to: { node: baseviajes }
          dataClass: personal
  - label: sin registro de eventos, el servicio de viajes es la única puerta al dato
    contextInversion: "sacar el registro de eventos conviene cuando el panel de operaciones tolera consultar en vez de recibir, y cuando el equipo prefiere una sola forma de leer un viaje: hay un dueño del dato y todos pasan por él, así que no existe la posibilidad de que un consumidor nuevo se enchufe a una fuente que caduca. Se paga con carga sobre el servicio de viajes y con un panel que ya no ve el viaje en el instante en que ocurre."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Conductor
          zone: public
        - id: app
          type: mobile-client
          label: App del conductor
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: viajes
          type: service
          label: Servicio de viajes
          zone: private
          role: trip-service
          props: { criticality: "high", replicas: "2" }
        - id: baseviajes
          type: database
          label: Base de viajes (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo histórico de viajes
          zone: private
        - id: panel
          type: worker
          label: Panel de operaciones
          zone: private
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
      edges:
        - id: conductor-app
          from: { node: conductor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-viajes
          from: { node: gw }
          to: { node: viajes }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: viajes-base
          from: { node: viajes }
          to: { node: baseviajes }
          dataClass: personal
        - id: viajes-archivo
          from: { node: viajes }
          to: { node: archivo }
          dataClass: personal
        - id: viajes-panel
          from: { node: viajes }
          to: { node: panel }
          dataClass: personal
        - id: facturacion-viajes
          from: { node: facturacion }
          to: { node: viajes }
          dataClass: personal
status: PILOT
---

Una empresa de transporte con **18.000 viajes por día**. Cada viaje que
termina se publica en un registro de eventos. El panel de operaciones lo lee
para ver la flota en tiempo real, y el servicio de facturación lo lee del
mismo registro para emitir la factura.

Es un diseño limpio. Un solo lugar donde se publica el hecho, dos
consumidores que lo leen. Funciona hace dos años.

El registro conserva **siete días**. Eso no es un error de configuración: es
lo que hace un registro de eventos, y siete días es de sobra para ver la
flota en tiempo real.

En abril llegaron **62 reclamos** de viajes de marzo. "Me cobraron un viaje
que no hice", "no me cobraron el del día 2". El equipo fue a buscar el viaje
original y no había nada que buscar. El día 8 de marzo, ese viaje dejó de
existir en todo el sistema.

El contrato con el municipio obliga a poder reconstruir cualquier factura
durante **cinco años**.

El equipo tiene **7 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que el viaje quede en una base que no venza,
para que facturación deje de depender de una retención que nadie eligió
pensando en ella, y para que los cinco años de historia no vivan adentro de la
base que atiende al conductor mientras maneja.
