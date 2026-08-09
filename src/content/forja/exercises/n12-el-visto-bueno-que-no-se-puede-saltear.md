---
title: "El visto bueno que no se puede saltear"
level: 12
role: tradeoff
domain: farmacia
tradeoffPairId: liderazgo-el-visto-bueno-que-cuesta-minutos
D1: 2
D2: 4
D3: 3
D4: 3
D5: 3
D6: 3
D7: 2
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 7
aiBudget: "libre. Un aviso: si le pedís a un modelo que optimice el tiempo de mostrador, te va a proponer sacar la validación del camino. Es la respuesta correcta para el problema que le contaste y la equivocada para el que tenés."
lambda: 3.0
constraints:
  - metric: dispensaciones de lista II por mes en la cadena
    operator: ">="
    value: 12000
    unit: dispensaciones
  - metric: tiempo que agrega la validación del regente por dispensación
    operator: "<="
    value: 40
    unit: segundos
  - metric: dispensaciones de lista II sin validación previa que la autoridad sanitaria tolera
    operator: "<="
    value: 0
    unit: dispensaciones
  - metric: presupuesto operativo del equipo de sistemas de la cadena
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "la validación previa del regente no es una política interna que se pueda flexibilizar: para los psicotrópicos de lista II es la condición de la habilitación de cada local. Sin ella no se cierra una venta: se cierra la farmacia."
    discoveryPath: "está en la tercera restricción, y el número es cero. Una restricción con valor cero no se negocia con un promedio."
  - fact: "el gerente comercial midió bien: 40 segundos por 12.000 dispensaciones son 133 horas de mostrador por mes. Su número es correcto y su conclusión no se sigue de él."
    discoveryPath: "las 133 horas existen. Lo que hay que preguntarse es contra qué se comparan: el costo del otro lado no es tiempo, es la habilitación de 140 locales."
  - fact: "la competencia que él cita valida después. También tiene dos locales clausurados desde febrero, cosa que no figura en la nota que él leyó."
    discoveryPath: "es lo que tenés que averiguar antes de la reunión. Un ejemplo del mercado sin su desenlace es una anécdota, no un dato."
startingDesign:
  nodes:
    - id: farmaceutico
      type: actor
      label: Farmacéutico de mostrador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: mostrador
      type: web-client
      label: Terminal de mostrador
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
      props: { availability: "99.0", slaMinutes: "5" }
      position: { x: 85, y: 300 }
    - id: registro
      type: database
      label: Libro de psicotrópicos
      zone: restricted
      role: dispensing-record
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
  edges:
    - id: farmaceutico-mostrador
      from: { node: farmaceutico }
      to: { node: mostrador }
      dataClass: personal
    - id: mostrador-gw
      from: { node: mostrador }
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
guarantees:
  - id: g-approval-in-path
    label: la dispensación llega al libro pasando por el regente
    weight: 3
    predicate:
      op: path
      from:
        role: dispensing-service
      to:
        role: dispensing-record
      via:
        type: [approver]
    whyMissing: no hay un camino desde el servicio de dispensación hasta el libro de psicotrópicos que pase por el regente farmacéutico.
    consequence: "para los psicotrópicos de lista II la validación previa es la condición de la habilitación del local. Un asiento en el libro sin el visto bueno del regente no es un asiento incompleto: es una dispensación que la autoridad cuenta como irregular, y la cuenta local por local."
  - id: g-no-bypass
    label: el servicio de dispensación no escribe el libro por su cuenta
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: dispensing-service
      to:
        type: [database]
    whyMissing: el servicio de dispensación sigue teniendo una conexión directa a una base, así que puede asentar sin pasar por nadie.
    consequence: "un camino que existe se usa. El día que el regente esté de licencia y el mostrador tenga cola, alguien va a pedir el atajo y el atajo va a estar ahí. Una validación que se puede saltear es una validación que ya se salteó y todavía no te enteraste."
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
    consequence: "el argumento de comercial son 40 segundos. Sin medirlos, la próxima reunión también la vas a dar con su número. Con la demora real por local, la conversación deja de ser sobre si la validación se saca y pasa a ser sobre qué local tarda tres veces más que el resto y por qué."
rubric:
  - dimension: la validación está en el camino, no al costado
    signal:
      kind: predicate
      guaranteeId: g-approval-in-path
  - dimension: no queda ningún atajo que alguien pueda tomar un día de cola
    signal:
      kind: predicate
      guaranteeId: g-no-bypass
  - dimension: el costo real de la validación es medible, no opinable
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
  - label: liberación sincrónica después del visto bueno
    contextInversion: "la liberación sincrónica se defiende cuando el farmacéutico tiene que poder decirle algo al cliente que está enfrente: aprieta, espera, y sale un sí o un no que puede comunicar. Es la topología más barata de operar de las dos y no agrega ninguna pieza que se pueda llenar en silencio. Al gerente comercial le llevás sus propias 133 horas y las ponés al lado del otro número: la validación previa es la condición de habilitación de 140 locales, y el ejemplo de la competencia que él cita tiene dos locales clausurados desde febrero. Lo que aceptás a cambio, y hay que decirlo sin adornos: si el enlace del local al centro se cae, el mostrador de lista II se detiene, porque no hay dónde dejar la operación esperando."
    design:
      nodes:
        - id: farmaceutico
          type: actor
          label: Farmacéutico de mostrador
          zone: public
        - id: mostrador
          type: web-client
          label: Terminal de mostrador
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
        - id: regente
          type: approver
          label: Regente farmacéutico
          zone: private
          props: { availability: "99.0", slaMinutes: "5" }
        - id: liberacion
          type: service
          label: Servicio de liberación
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: database
          label: Libro de psicotrópicos
          zone: restricted
          role: dispensing-record
          props: { backup: "diario", consistency: "strong" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: farmaceutico-mostrador
          from: { node: farmaceutico }
          to: { node: mostrador }
          dataClass: personal
        - id: mostrador-gw
          from: { node: mostrador }
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
        - id: dispensacion-monitoreo
          from: { node: dispensacion }
          to: { node: monitoreo }
          dataClass: public
        - id: liberacion-monitoreo
          from: { node: liberacion }
          to: { node: monitoreo }
          dataClass: public
  - label: visto bueno sincrónico y asiento desacoplado
    contextInversion: "desacoplar el asiento se defiende cuando el enlace no es confiable: 61 de los 140 locales están en el interior y su enlace se cae varias veces por semana. La validación sigue siendo previa, eso no se negocia, pero el asiento en el libro deja de estar en el camino crítico del mostrador, así que una caída del enlace al centro no detiene la venta de lista II, sólo demora el asiento. Al gerente comercial le devolvés una parte de sus 133 horas sin tocar la validación, que es exactamente el trato que se puede cerrar. Lo que aceptás a cambio: dos piezas más para operar y una que se puede llenar en silencio, así que ahora hay una pregunta nueva que responder todos los días, cuántos asientos están esperando."
    design:
      nodes:
        - id: farmaceutico
          type: actor
          label: Farmacéutico de mostrador
          zone: public
        - id: mostrador
          type: web-client
          label: Terminal de mostrador
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
        - id: regente
          type: approver
          label: Regente farmacéutico
          zone: private
          props: { availability: "99.0", slaMinutes: "5" }
        - id: liberacion
          type: service
          label: Servicio de liberación
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: Cola de asientos
          zone: private
          props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
        - id: escritor
          type: worker
          label: Escritor del libro
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: registro
          type: database
          label: Libro de psicotrópicos
          zone: restricted
          role: dispensing-record
          props: { backup: "diario", consistency: "strong" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: farmaceutico-mostrador
          from: { node: farmaceutico }
          to: { node: mostrador }
          dataClass: personal
        - id: mostrador-gw
          from: { node: mostrador }
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
        - id: liberacion-cola
          from: { node: liberacion }
          to: { node: cola }
          dataClass: regulated
        - id: cola-escritor
          from: { node: cola }
          to: { node: escritor }
          dataClass: regulated
        - id: escritor-registro
          from: { node: escritor }
          to: { node: registro }
          dataClass: regulated
        - id: dispensacion-monitoreo
          from: { node: dispensacion }
          to: { node: monitoreo }
          dataClass: public
        - id: liberacion-monitoreo
          from: { node: liberacion }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una cadena de **140 farmacias**. Entre todas dispensan **12.000 unidades de
lista II por mes**: psicotrópicos con receta archivada. Para esa lista, el
regente farmacéutico tiene que dar el visto bueno **antes** de que el
producto salga del mostrador. No es una política de la cadena: es la
condición de la habilitación de cada local.

Hoy el sistema no hace nada de eso. El servicio de dispensación asienta
directo en el libro y el regente firma un resumen al final del día.

El gerente comercial trae un número y el número está bien: la validación en
línea agrega **40 segundos** por dispensación, y 40 segundos por 12.000 son
**133 horas de mostrador por mes**. Con eso pide que el sistema entregue y
el regente valide después, "como hace la competencia".

Su medición es correcta. Su conclusión no se sigue de ella. Las 133 horas se
comparan contra algo, y ese algo no es tiempo: es la habilitación de 140
locales. La competencia que él cita, además, tiene dos locales clausurados
desde febrero. Eso no estaba en la nota que él leyó, y averiguarlo es parte
de tu trabajo antes de entrar a la reunión.

Vas a tener que decirle que no a un número correcto. La única forma de que
ese no se sostenga es que el sistema haga imposible el atajo, no que lo
desaconseje: un camino que existe se usa el primer día que hay cola y el
regente está de licencia.

El equipo de sistemas sostiene **siete piezas**.

**Armá el sistema** para que la dispensación llegue al libro pasando por el
regente, para que el servicio de dispensación no pueda escribir el libro por
su cuenta, y para que todos los servicios reporten lo que les pasa.
