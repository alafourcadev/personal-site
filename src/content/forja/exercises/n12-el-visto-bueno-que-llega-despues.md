---
title: "El visto bueno que llega después"
level: 12
role: tradeoff
domain: farmacia
tradeoffPairId: liderazgo-el-visto-bueno-que-cuesta-minutos
D1: 3
D2: 4
D3: 3
D4: 3
D5: 3
D6: 3
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 7
aiBudget: "libre. La pregunta que no se delega es de quién es el riesgo: acá el que espera no es un cliente en una cola, es un paciente intubado. Si eso no está en tu argumento, tu argumento es sobre otro sistema."
lambda: 3.0
constraints:
  - metric: tiempo máximo entre el pedido de la guardia y la entrega del antídoto
    operator: "<="
    value: 3
    unit: minutos
  - metric: tiempo medio de respuesta del regente en guardia pasiva de madrugada
    operator: "<="
    value: 14
    unit: minutos
  - metric: plazo que la norma de urgencias da para la validación posterior con constancia completa
    operator: "<="
    value: 24
    unit: horas
  - metric: presupuesto operativo del equipo de sistemas de la cadena
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "la misma norma que exige validación previa en el mostrador la reemplaza por validación posterior dentro de las 24 horas en el servicio de urgencias, con una condición: constancia completa e inalterable de lo que se entregó, quién lo pidió y para qué paciente."
    discoveryPath: "está en la tercera restricción. La excepción no elimina el control: mueve el control de antes a después y le pone un requisito nuevo, que es el expediente."
  - fact: "el regente de este hospital cubre guardia pasiva de madrugada desde su casa. Su tiempo medio de respuesta es de 14 minutos y su mejor marca del último trimestre fue de 6."
    discoveryPath: "está en las restricciones, al lado del plazo de 3 minutos para el antídoto. Los dos números no entran en el mismo camino y ninguno de los dos es negociable."
  - fact: "el expediente de revisión ya existe en el sistema: se creó cuando se firmó el convenio con el hospital y no recibió nunca un solo registro."
    discoveryPath: "está en el lienzo desde el principio y no le entra ninguna conexión. Sin él la excepción de urgencias no aplica, y entonces sí hay que esperar al regente."
startingDesign:
  nodes:
    - id: enfermero
      type: actor
      label: Enfermero de guardia
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: consola
      type: web-client
      label: Consola de urgencias
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      props: { authn: "sí", rateLimit: "sí" }
      position: { x: 445, y: 190 }
    - id: dispensacion
      type: service
      label: Servicio de dispensación
      zone: private
      role: dispensing-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: regente
      type: approver
      label: Regente farmacéutico
      zone: private
      given: true
      props: { availability: "99.0", slaMinutes: "14" }
      position: { x: 85, y: 300 }
    - id: liberacion
      type: service
      label: Servicio de liberación
      zone: private
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: registro
      type: database
      label: Libro de dispensación
      zone: restricted
      role: dispensing-record
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 520 }
    - id: expediente
      type: object-storage
      label: Expediente de revisión
      zone: private
      role: review-archive
      given: true
      props: { durability: "99.999999999", access: "signed" }
      position: { x: 805, y: 410 }
  edges:
    - id: enfermero-consola
      from: { node: enfermero }
      to: { node: consola }
      dataClass: personal
    - id: consola-gw
      from: { node: consola }
      to: { node: gw }
      dataClass: personal
    - id: gw-dispensacion
      from: { node: gw }
      to: { node: dispensacion }
      dataClass: regulated
    - id: dispensacion-regente
      from: { node: dispensacion }
      to: { node: regente }
      dataClass: regulated
    - id: regente-liberacion
      from: { node: regente }
      to: { node: liberacion }
      dataClass: regulated
    - id: liberacion-registro
      from: { node: liberacion }
      to: { node: registro }
      dataClass: regulated
guarantees:
  - id: g-no-approval-in-path
    label: la entrega llega al libro sin esperar al regente
    weight: 3
    predicate:
      op: path
      from:
        role: dispensing-service
      to:
        role: dispensing-record
      forbid:
        type: [approver]
    whyMissing: todos los caminos desde el servicio de dispensación hasta el libro pasan por el regente, así que la entrega no ocurre hasta que él responde.
    consequence: "el plazo del antídoto son 3 minutos y la respuesta del regente en guardia pasiva tarda 14 de media. Poner esos dos números en el mismo camino no es una demora aceptable: es una intoxicación por organofosforados esperando una notificación en un teléfono que está en una mesa de luz."
  - id: g-review-archived
    label: cada entrega deja constancia en el expediente de revisión
    weight: 2
    predicate:
      op: path
      from:
        role: dispensing-service
      to:
        role: review-archive
    whyMissing: no hay ningún camino desde el servicio de dispensación hasta el expediente de revisión.
    consequence: "la norma de urgencias no elimina el control, lo mueve: permite validar dentro de las 24 horas siempre que haya constancia completa de qué salió, quién lo pidió y para qué paciente. Sin expediente no hay excepción, y sin excepción volvés a tener que esperar al regente."
  - id: g-observed
    label: todos los servicios reportan lo que les pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: "una validación que llega después sólo funciona si alguien sabe cuántas están pendientes y hace cuánto. Sin esa medición, el plazo de 24 horas se descubre incumplido el día que lo audita alguien de afuera."
rubric:
  - dimension: la urgencia no espera a una persona que está durmiendo
    signal:
      kind: predicate
      guaranteeId: g-no-approval-in-path
  - dimension: el control existe, corrido en el tiempo, no eliminado
    signal:
      kind: predicate
      guaranteeId: g-review-archived
  - dimension: el retraso de la validación posterior es visible mientras se puede corregir
    signal:
      kind: predicate
      guaranteeId: g-observed
  - dimension: el diseño entra en el presupuesto del equipo de sistemas
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 7
      unit: unidades operativas
referenceSolutions:
  - label: entrega directa y expediente escrito en el momento
    contextInversion: "escribir el expediente en el momento de la entrega se defiende cuando la constancia es lo que habilita el acto: si la entrega ocurre y el expediente todavía no existe, durante esa ventana la dispensación es irregular aunque después se regularice. Con la escritura en línea esa ventana no existe, y el servicio de revisión le arma al regente el lote de la mañana con lo que ya está guardado. Al jefe de calidad le decís que no le estás sacando el control: se lo estás moviendo doce horas y le estás dando algo que hoy no tiene, que es el expediente completo de cada entrega en vez de una firma sobre un resumen. Lo que aceptás a cambio: la entrega depende de que el archivo esté disponible en ese instante, así que una caída del almacenamiento sí detiene la guardia."
    design:
      nodes:
        - id: enfermero
          type: actor
          label: Enfermero de guardia
          zone: public
        - id: consola
          type: web-client
          label: Consola de urgencias
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: dispensacion
          type: service
          label: Servicio de dispensación
          zone: private
          role: dispensing-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: database
          label: Libro de dispensación
          zone: restricted
          role: dispensing-record
          props: { backup: "diario", consistency: "strong" }
        - id: expediente
          type: object-storage
          label: Expediente de revisión
          zone: private
          role: review-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: revision
          type: service
          label: Servicio de revisión posterior
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: regente
          type: approver
          label: Regente farmacéutico
          zone: private
          props: { availability: "99.0", slaMinutes: "14" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: enfermero-consola
          from: { node: enfermero }
          to: { node: consola }
          dataClass: personal
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-dispensacion
          from: { node: gw }
          to: { node: dispensacion }
          dataClass: regulated
        - id: dispensacion-registro
          from: { node: dispensacion }
          to: { node: registro }
          dataClass: regulated
        - id: dispensacion-expediente
          from: { node: dispensacion }
          to: { node: expediente }
          dataClass: regulated
        - id: revision-expediente
          from: { node: revision }
          to: { node: expediente }
          dataClass: regulated
        - id: revision-regente
          from: { node: revision }
          to: { node: regente }
          dataClass: regulated
        - id: dispensacion-monitoreo
          from: { node: dispensacion }
          to: { node: monitoreo }
          dataClass: public
        - id: revision-monitoreo
          from: { node: revision }
          to: { node: monitoreo }
          dataClass: public
  - label: expediente armado por un proceso de fondo
    contextInversion: "armar el expediente con un proceso de fondo se defiende cuando la entrega no puede depender de nada más: la guardia de este hospital atiende accidentes de la ruta y en un accidente múltiple entran once pedidos en cuatro minutos. Con una cola en el medio, la entrega se registra apenas el mensaje se acepta y el armado del expediente (fotos de la etiqueta, identificación del paciente, motivo) ocurre después sin frenar a nadie. Al jefe de calidad le mostrás que la constancia sigue siendo completa y que el plazo de 24 horas tiene doce de margen. Lo que aceptás a cambio: dos piezas más para operar y una ventana, corta pero real, en la que la entrega ya ocurrió y el expediente todavía se está escribiendo. Esa ventana hay que medirla y hay que decirla."
    design:
      nodes:
        - id: enfermero
          type: actor
          label: Enfermero de guardia
          zone: public
        - id: consola
          type: web-client
          label: Consola de urgencias
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: dispensacion
          type: service
          label: Servicio de dispensación
          zone: private
          role: dispensing-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: database
          label: Libro de dispensación
          zone: restricted
          role: dispensing-record
          props: { backup: "diario", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de constancias
          zone: private
          props: { delivery: "at-least-once", dlq: "sí", ordering: "no" }
        - id: armador
          type: worker
          label: Armador de expedientes
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: expediente
          type: object-storage
          label: Expediente de revisión
          zone: private
          role: review-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: revision
          type: service
          label: Servicio de revisión posterior
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: regente
          type: approver
          label: Regente farmacéutico
          zone: private
          props: { availability: "99.0", slaMinutes: "14" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: enfermero-consola
          from: { node: enfermero }
          to: { node: consola }
          dataClass: personal
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-dispensacion
          from: { node: gw }
          to: { node: dispensacion }
          dataClass: regulated
        - id: dispensacion-registro
          from: { node: dispensacion }
          to: { node: registro }
          dataClass: regulated
        - id: dispensacion-cola
          from: { node: dispensacion }
          to: { node: cola }
          dataClass: regulated
        - id: cola-armador
          from: { node: cola }
          to: { node: armador }
          dataClass: regulated
        - id: armador-expediente
          from: { node: armador }
          to: { node: expediente }
          dataClass: regulated
        - id: revision-expediente
          from: { node: revision }
          to: { node: expediente }
          dataClass: regulated
        - id: revision-regente
          from: { node: revision }
          to: { node: regente }
          dataClass: regulated
        - id: dispensacion-monitoreo
          from: { node: dispensacion }
          to: { node: monitoreo }
          dataClass: public
        - id: revision-monitoreo
          from: { node: revision }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

La misma cadena de farmacias, otro local. Este es la farmacia interna del
servicio de urgencias de un hospital, operada por convenio desde hace un
año. No vende: entrega antídotos y medicación de rescate a la guardia.

Cuando entra una intoxicación por organofosforados, la atropina tiene que
estar en la mano del médico en **3 minutos**. El regente farmacéutico de
este local cubre **guardia pasiva** de madrugada desde su casa: su tiempo
medio de respuesta es de **14 minutos**.

El sistema que corre hoy en este local es el que ganó la discusión anterior:
el pedido pasa por el regente y recién después se libera y se asienta. Se
instaló en enero, con las mismas piezas y el mismo criterio.

El jefe de calidad, el mismo que tenía razón en el mostrador, pide que se
mantenga tal cual, y su argumento suena igual de sólido: si el control
previo es la condición de la habilitación en 140 locales, no puede
desaparecer en el local 141 porque ahí hay apuro.

Hay algo que él no está leyendo. La norma de urgencias **no elimina el
control: lo mueve**. Permite la validación posterior dentro de las **24
horas** con una condición dura: constancia completa e inalterable de qué se
entregó, quién lo pidió y para qué paciente. El control sigue existiendo;
cambia de lugar en el tiempo y cambia de forma.

Así que esta vez el no va en la otra dirección, y es más incómodo: le vas a
decir que no a la persona que la vez pasada tenía razón, sobre el mismo
principio, y vas a tener que explicar por qué el mismo principio da vuelta
la respuesta.

El expediente de revisión ya existe en el sistema desde que se firmó el
convenio y **nunca recibió un registro**. El equipo de sistemas sostiene
**siete piezas**.

**Armá el sistema** para que la entrega llegue al libro sin esperar al
regente, para que cada entrega deje constancia en el expediente de revisión,
y para que todos los servicios reporten lo que les pasa.
