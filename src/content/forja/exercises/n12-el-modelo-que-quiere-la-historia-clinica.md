---
title: "El modelo que quiere la historia clínica entera"
level: 12
role: core
domain: salud
D1: 3
D2: 4
D3: 4
D4: 3
D5: 3
D6: 3
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 7
aiBudget: "libre para explorar el diseño. No para redactar la defensa: si no podés decir con tus palabras qué dato sale de tu sistema y qué dato no, no tomaste la decisión, la copiaste."
lambda: 3.0
constraints:
  - metric: tiempo máximo entre que el paciente describe su síntoma y recibe una orientación
    operator: "<="
    value: 3
    unit: segundos
  - metric: retención exigida por la autoridad sanitaria para la historia clínica
    operator: ">="
    value: 15
    unit: años
  - metric: presupuesto operativo del equipo de plataforma
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "el contrato con el proveedor del modelo dice que los datos enviados no se usan para entrenar. No dice qué pasa con ellos: la transferencia ya ocurrió y sos vos quien tiene que poder justificarla ante la autoridad sanitaria, no el proveedor."
    discoveryPath: "dejá la conexión que trae el ejercicio entre el servicio de triage y el modelo, y probá tu respuesta. El motor no la califica: la rechaza, y te dice por qué con esas palabras."
  - fact: "la jefa de producto ya firmó el piloto y tiene fecha de lanzamiento. Lo que no tiene es una respuesta para la pregunta de qué campo exacto viaja en cada consulta."
    discoveryPath: "es la pregunta que responde tu diseño. Si entre el servicio y el modelo hay una pieza tuya, esa pieza es la respuesta: lo que sale es lo que esa pieza deja salir."
  - fact: "un cuadro clínico con edad, sexo, ciudad y tres síntomas identifica a una persona en un pueblo de 4.000 habitantes aunque no lleve nombre. El equipo legal lo sabe; el proveedor no lo mencionó nunca."
    discoveryPath: "es la razón por la que archivar lo que se envió no es burocracia. Si nadie guarda la consulta exacta que salió, no hay forma de demostrar después qué se envió ni de corregirlo."
startingDesign:
  nodes:
    - id: paciente
      type: actor
      label: Paciente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de consulta
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: triage
      type: service
      label: Servicio de triage
      zone: private
      role: triage-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: modelo
      type: ai-model
      label: Modelo de orientación clínica
      zone: private
      role: triage-model
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 410 }
    - id: historia
      type: database
      label: Historia clínica
      zone: restricted
      role: clinical-record
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: enviado
      type: object-storage
      label: Archivo de consultas enviadas
      zone: private
      role: sent-archive
      given: true
      props: { durability: "99.999999999", access: "signed" }
      position: { x: 805, y: 520 }
  edges:
    - id: paciente-app
      from: { node: paciente }
      to: { node: app }
      dataClass: personal
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-triage
      from: { node: gw }
      to: { node: triage }
      dataClass: personal
    - id: triage-modelo
      from: { node: triage }
      to: { node: modelo }
      dataClass: personal
    - id: triage-historia
      from: { node: triage }
      to: { node: historia }
      dataClass: regulated
guarantees:
  - id: g-model-isolated
    label: entre el servicio de triage y el modelo hay una pieza tuya que decide qué sale
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            role: triage-service
          to:
            role: triage-model
        - op: edgeAbsent
          from:
            role: triage-service
          to:
            role: triage-model
    whyMissing: "o el servicio de triage le habla directo al modelo, o directamente ya no hay camino hasta el modelo. Las dos cosas son respuestas equivocadas a la misma pregunta."
    consequence: "sin una pieza propia en el medio, lo que sale hacia el proveedor es lo que el servicio tenga a mano, que es la consulta entera con la historia clínica adentro. Con esa pieza, lo que sale es lo que vos decidiste que salga, y esa decisión se puede leer en el diseño sin preguntarle a nadie."
  - id: g-sent-archived
    label: queda registro de la consulta exacta que salió hacia el proveedor
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            role: triage-service
          to:
            role: sent-archive
        - op: edgeAbsent
          from:
            role: triage-service
          to:
            role: sent-archive
    whyMissing: "no hay camino desde el servicio de triage hasta el archivo de consultas enviadas, o el que archiva es el propio servicio y no la pieza que habla con el proveedor."
    consequence: "el que archiva tiene que ser el mismo que envía, o estás guardando lo que creías mandar en vez de lo que mandaste. El día que la autoridad sanitaria pregunte qué campos salieron del país, la diferencia entre esas dos cosas es la diferencia entre responder y suponer."
  - id: g-triage-observed
    label: el servicio de triage reporta lo que le pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: triage-service
      by:
        type: [observability]
    whyMissing: el servicio de triage no está conectado a ningún componente de monitoreo.
    consequence: "el modelo es de un tercero y falla como un tercero: lento, intermitente, a veces con una respuesta vacía. Si no medís desde tu lado, la conversación con el proveedor es tu impresión contra su panel."
rubric:
  - dimension: el dato personal no cruza la frontera del proveedor
    signal:
      kind: predicate
      guaranteeId: g-model-isolated
  - dimension: lo que salió se puede demostrar, no recordar
    signal:
      kind: predicate
      guaranteeId: g-sent-archived
  - dimension: la falla del tercero se mide desde tu lado
    signal:
      kind: predicate
      guaranteeId: g-triage-observed
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 7
      unit: unidades operativas
referenceSolutions:
  - label: un despersonalizador en el camino, sincrónico
    contextInversion: "la versión sincrónica se defiende cuando la orientación es el producto: el paciente escribe un síntoma y espera una respuesta en pantalla, y meter una cola en el medio significa que la respuesta llega cuando llega, que para un producto de consulta es lo mismo que no llegar. Una sola pieza intermedia, una sola cosa que puede fallar, tres segundos de presupuesto de latencia repartidos entre dos saltos. Al proveedor le decís que no vas a mandar la historia clínica y que el acuerdo sigue en pie con lo que sí mandás; a la jefa de producto le decís que la fecha de lanzamiento se mantiene. Lo que aceptás a cambio, y hay que decirlo en voz alta: si el proveedor está caído, la consulta del paciente falla en el momento, porque no hay dónde guardarla para después."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: app
          type: mobile-client
          label: App de consulta
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: triage
          type: service
          label: Servicio de triage
          zone: private
          role: triage-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: despersonalizador
          type: worker
          label: Despersonalizador de consultas
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: modelo
          type: ai-model
          label: Modelo de orientación clínica
          zone: private
          role: triage-model
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: historia
          type: database
          label: Historia clínica
          zone: restricted
          role: clinical-record
          props: { backup: "diario", consistency: "strong" }
        - id: enviado
          type: object-storage
          label: Archivo de consultas enviadas
          zone: private
          role: sent-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: paciente-app
          from: { node: paciente }
          to: { node: app }
          dataClass: personal
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-triage
          from: { node: gw }
          to: { node: triage }
          dataClass: personal
        - id: triage-historia
          from: { node: triage }
          to: { node: historia }
          dataClass: regulated
        - id: triage-despersonalizador
          from: { node: triage }
          to: { node: despersonalizador }
          dataClass: personal
        - id: despersonalizador-modelo
          from: { node: despersonalizador }
          to: { node: modelo }
          dataClass: public
        - id: despersonalizador-enviado
          from: { node: despersonalizador }
          to: { node: enviado }
          dataClass: public
        - id: triage-monitoreo
          from: { node: triage }
          to: { node: monitoreo }
          dataClass: public
  - label: una cola delante del despersonalizador
    contextInversion: "la versión con cola se defiende cuando la orientación no es la respuesta sino un agregado que llega después: el paciente ya recibió su turno y la orientación del modelo entra a su ficha en el minuto siguiente. Ahí la cola es lo correcto, porque el proveedor tiene 99,0 % de disponibilidad declarada y un pico de latencia suyo deja de ser un pico tuyo: la consulta se guarda y se reintenta. Al proveedor le decís que sus caídas ya no son tu problema, y esa frase cambia la negociación del contrato. Lo que aceptás a cambio: una unidad operativa más, la última que tenés, y una pieza que se puede llenar en silencio, así que ahora también hay que mirar cuánto se acumula ahí."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: app
          type: mobile-client
          label: App de consulta
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: triage
          type: service
          label: Servicio de triage
          zone: private
          role: triage-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: Cola de consultas a orientar
          zone: private
          props: { delivery: "at-least-once", dlq: "no", ordering: "no" }
        - id: despersonalizador
          type: worker
          label: Despersonalizador de consultas
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: modelo
          type: ai-model
          label: Modelo de orientación clínica
          zone: private
          role: triage-model
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: historia
          type: database
          label: Historia clínica
          zone: restricted
          role: clinical-record
          props: { backup: "diario", consistency: "strong" }
        - id: enviado
          type: object-storage
          label: Archivo de consultas enviadas
          zone: private
          role: sent-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: paciente-app
          from: { node: paciente }
          to: { node: app }
          dataClass: personal
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-triage
          from: { node: gw }
          to: { node: triage }
          dataClass: personal
        - id: triage-historia
          from: { node: triage }
          to: { node: historia }
          dataClass: regulated
        - id: triage-cola
          from: { node: triage }
          to: { node: cola }
          dataClass: personal
        - id: cola-despersonalizador
          from: { node: cola }
          to: { node: despersonalizador }
          dataClass: personal
        - id: despersonalizador-modelo
          from: { node: despersonalizador }
          to: { node: modelo }
          dataClass: public
        - id: despersonalizador-enviado
          from: { node: despersonalizador }
          to: { node: enviado }
          dataClass: public
        - id: triage-monitoreo
          from: { node: triage }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una plataforma de telemedicina con **31.000 consultas por mes**. El
paciente describe su síntoma en la app, un servicio de triage decide con
qué urgencia hay que atenderlo, y desde hace dos semanas hay un modelo de
orientación clínica, de un proveedor externo, conectado a ese servicio.

Lo conectó el equipo del piloto de la forma más corta posible: el servicio
le manda la consulta completa. La consulta completa incluye la historia
clínica.

El proveedor pide exactamente eso, y lo pide con un argumento razonable:
**cuanto más contexto recibe el modelo, mejor orienta**. Tiene métricas que
lo respaldan. La jefa de producto ya firmó el piloto, tiene fecha de
lanzamiento y considera que recortar el contexto es "empeorar el producto a
propósito".

El contrato dice que esos datos no se usan para entrenar. No dice qué pasa
con ellos. Y la transferencia ya ocurrió: quien tiene que poder explicarla
ante la autoridad sanitaria sos vos, no el proveedor.

Hay un detalle que nadie de la mesa mencionó. Un cuadro con edad, sexo,
ciudad y tres síntomas **identifica a una persona en un pueblo de 4.000
habitantes** aunque no lleve nombre. Así que "sacarle el nombre" no es una
respuesta: la respuesta es que exista una pieza tuya que decida campo por
campo qué sale, y que quede registro exacto de lo que salió.

El equipo de plataforma sostiene **siete piezas**. Hoy hay cuatro que
cuestan unidad operativa y falta el monitoreo.

**Armá el sistema** para que entre el servicio de triage y el modelo haya
una pieza tuya, para que el archivo de consultas enviadas lo escriba esa
misma pieza y no el servicio, y para que el triage reporte lo que le pasa.
Después vas a tener que explicarle al proveedor por qué recibe menos de lo
que pidió.
