---
title: "La consulta que se fue con el historial clínico"
level: 10
role: core
domain: salud
D1: 3
D2: 4
D3: 3
D4: 3
D5: 3
D6: 3
D7: 3
D8: 1
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 8
  monthlyUsd: 600
aiBudget: "libre, pero tu respuesta tiene que decir qué viaja por cada tramo del camino y en qué punto exacto deja de haber un paciente identificable."
lambda: 0.6
constraints:
  - metric: "consultas médicas por día en la red de clínicas"
    operator: ">="
    value: 4200
    unit: consultas
  - metric: "tiempo aceptable de espera del médico por el resumen"
    operator: "<="
    value: 6
    unit: segundos
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: "el modelo corre en la infraestructura del proveedor. La red de clínicas firmó un contrato de servicio, no un acuerdo de tratamiento de datos de salud."
    discoveryPath: "mirá qué declara la conexión que sale del servicio de historias clínicas y a qué tipo de pieza entra. El motor la bloquea antes de calcular nada: un dato de salud identificable saliendo hacia un tercero no es una advertencia que se pueda postergar."
  - fact: "el servicio de seudonimización existe y funciona. Se usa desde 2023 para las exportaciones a los estudios de investigación, y reemplaza documento, nombre y fecha de nacimiento por un identificador que sólo la clínica puede revertir."
    discoveryPath: "está en el lienzo, conectado a la base clínica y a nada más. Que el flujo del resumidor no lo use no es una limitación técnica: es una conexión que nadie dibujó."
  - fact: "el proveedor del modelo tuvo tres cortes de más de veinte minutos en el último trimestre. Durante esos cortes el médico veía un error y el pedido de resumen se perdía."
    discoveryPath: "seguí el camino de un pedido de resumen y buscá en qué punto queda escrito en algún lado. Si el único lugar donde existe es la memoria del proceso que lo está atendiendo, un corte del proveedor y un reinicio se llevan lo mismo."
startingDesign:
  nodes:
    - id: medico
      type: actor
      label: "Médico"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: consola
      type: web-client
      label: "Consola clínica"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: historias
      type: service
      label: "Servicio de historias clínicas"
      zone: private
      role: clinical-record
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: seudonimizador
      type: service
      label: "Servicio de seudonimización"
      zone: private
      role: de-identifier
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: baseclinica
      type: database
      label: "Base de historias clínicas"
      zone: restricted
      role: historia
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
    - id: modelo
      type: ai-model
      label: "Modelo de resumen del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
  edges:
    - id: medico-consola
      from: { node: medico }
      to: { node: consola }
      dataClass: public
    - id: consola-gw
      from: { node: consola }
      to: { node: gw }
      dataClass: regulated
    - id: gw-historias
      from: { node: gw }
      to: { node: historias }
      dataClass: regulated
    - id: historias-baseclinica
      from: { node: historias }
      to: { node: baseclinica }
      dataClass: regulated
    - id: seudonimizador-baseclinica
      from: { node: seudonimizador }
      to: { node: baseclinica }
      dataClass: regulated
    - id: historias-modelo
      from: { node: historias }
      to: { node: modelo }
      dataClass: personal
guarantees:
  - id: g-nada-identificable-al-modelo
    label: "el servicio que tiene la historia clínica no le habla directo al modelo"
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: clinical-record
      to:
        type: [ai-model]
    whyMissing: "hay una conexión directa desde el servicio de historias clínicas hasta el modelo, y por esa conexión viaja la historia tal como está guardada."
    consequence: "el diagnóstico de una persona con nombre y documento sale de la red de clínicas y entra en la infraestructura de un tercero. La transferencia no se deshace, y el paciente que pide que borren sus datos ya no tiene a quién pedírselo."
  - id: g-seudonimizado-antes-del-modelo
    label: "lo que llega al modelo pasó antes por el servicio de seudonimización"
    weight: 3
    predicate:
      op: path
      from:
        role: clinical-record
      to:
        type: [ai-model]
      via:
        role: de-identifier
    whyMissing: "no existe ningún camino desde el servicio de historias clínicas hasta el modelo que atraviese el servicio de seudonimización."
    consequence: "sin esa pieza en el medio, la decisión de qué campos salen de la clínica la toma quien escribió la consulta. El resumen sigue saliendo; lo que desaparece es el control de qué se mandó."
  - id: g-pedido-que-sobrevive-al-proveedor
    label: "el pedido de resumen queda escrito en algo durable antes de llegar al modelo"
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: clinical-record
      to:
        type: [ai-model]
    whyMissing: "entre el servicio de historias clínicas y el modelo no hay ninguna pieza que sobreviva a un reinicio, así que el pedido existe solamente mientras el proceso que lo atiende siga vivo."
    consequence: "el proveedor tuvo tres cortes de más de veinte minutos en el trimestre. En cada uno, todo pedido en vuelo se perdió: el médico vio un error, cerró la pestaña, y nadie volvió a pedir ese resumen nunca."
  - id: g-respaldo-de-la-historia-intacto
    label: "la historia clínica sigue guardada en una base con respaldo"
    weight: 1
    predicate:
      op: exists
      node:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: "no queda en el diseño ninguna base de datos con respaldo diario donde vivan las historias clínicas."
    consequence: "la obligación de conservar la historia clínica no depende del resumidor ni desaparece porque el sistema se rearme alrededor de un modelo. Sin respaldo, la retención a quince años es una afirmación sin nada que la sostenga."
rubric:
  - dimension: "ningún dato que identifique al paciente sale hacia el proveedor"
    signal:
      kind: predicate
      guaranteeId: g-nada-identificable-al-modelo
  - dimension: "hay una sola pieza que decide qué se le manda al modelo"
    signal:
      kind: predicate
      guaranteeId: g-seudonimizado-antes-del-modelo
  - dimension: "un corte del proveedor no se lleva el pedido"
    signal:
      kind: predicate
      guaranteeId: g-pedido-que-sobrevive-al-proveedor
  - dimension: "la obligación sobre la historia clínica sigue cumplida"
    signal:
      kind: predicate
      guaranteeId: g-respaldo-de-la-historia-intacto
referenceSolutions:
  - label: "se encola primero y se seudonimiza después"
    contextInversion: "encolar antes de seudonimizar conviene cuando el pico de la mañana es el problema: el servicio de historias se saca el pedido de encima en milisegundos y el trabajo pesado ocurre después, al ritmo que el proveedor aguante. Se paga con que por la cola viajan datos de salud identificables, así que la cola hereda la retención, el cifrado y el borrado a pedido de la historia clínica: una pieza de infraestructura pasa a estar dentro del alcance regulatorio."
    design:
      nodes:
        - id: medico
          type: actor
          label: "Médico"
          zone: public
        - id: consola
          type: web-client
          label: "Consola clínica"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: historias
          type: service
          label: "Servicio de historias clínicas"
          zone: private
          role: clinical-record
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: "Cola de resúmenes pendientes"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: seudonimizador
          type: service
          label: "Servicio de seudonimización"
          zone: private
          role: de-identifier
          props: { criticality: "high", replicas: "2" }
        - id: baseclinica
          type: database
          label: "Base de historias clínicas"
          zone: restricted
          role: historia
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: modelo
          type: ai-model
          label: "Modelo de resumen del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: medico-consola
          from: { node: medico }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: regulated
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: regulated
        - id: historias-baseclinica
          from: { node: historias }
          to: { node: baseclinica }
          dataClass: regulated
        - id: historias-cola
          from: { node: historias }
          to: { node: cola }
          dataClass: regulated
        - id: cola-seudonimizador
          from: { node: cola }
          to: { node: seudonimizador }
          dataClass: regulated
        - id: seudonimizador-modelo
          from: { node: seudonimizador }
          to: { node: modelo }
          dataClass: public
  - label: "se seudonimiza primero y se encola después"
    contextInversion: "seudonimizar antes de encolar conviene cuando lo que querés es que ninguna pieza de infraestructura conserve un dato de salud identificable: por la cola sólo circula texto ya sin paciente, así que la cola queda fuera del alcance regulatorio y su retención deja de ser un problema legal. Se paga con que la seudonimización vuelve al camino síncrono del médico, con una pieza más para operar, y con que si el seudonimizador se cae, no se encola nada."
    design:
      nodes:
        - id: medico
          type: actor
          label: "Médico"
          zone: public
        - id: consola
          type: web-client
          label: "Consola clínica"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: historias
          type: service
          label: "Servicio de historias clínicas"
          zone: private
          role: clinical-record
          props: { criticality: "high", replicas: "2" }
        - id: seudonimizador
          type: service
          label: "Servicio de seudonimización"
          zone: private
          role: de-identifier
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: "Cola de resúmenes seudonimizados"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: lector
          type: worker
          label: "Proceso que consulta al modelo"
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: baseclinica
          type: database
          label: "Base de historias clínicas"
          zone: restricted
          role: historia
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: modelo
          type: ai-model
          label: "Modelo de resumen del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: medico-consola
          from: { node: medico }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: regulated
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: regulated
        - id: historias-baseclinica
          from: { node: historias }
          to: { node: baseclinica }
          dataClass: regulated
        - id: historias-seudonimizador
          from: { node: historias }
          to: { node: seudonimizador }
          dataClass: regulated
        - id: seudonimizador-cola
          from: { node: seudonimizador }
          to: { node: cola }
          dataClass: public
        - id: cola-lector
          from: { node: cola }
          to: { node: lector }
          dataClass: public
        - id: lector-modelo
          from: { node: lector }
          to: { node: modelo }
          dataClass: public
status: PILOT
---

Una red de clínicas con **4.200 consultas por día**. Antes de que el paciente
entre al consultorio, el médico abre la consola y lee un resumen de la historia
clínica: qué tiene, qué toma, qué le pasó las últimas tres veces que vino.
Antes lo armaba una enfermera. Desde marzo lo arma un modelo.

Lo que se le manda al modelo es **la historia clínica como está guardada**:
nombre y apellido, número de documento, fecha de nacimiento, diagnósticos,
medicación y el texto libre que escribió cada médico. El modelo no corre en la
red de clínicas: corre en la infraestructura del proveedor, que factura **USD
200 por mes** y con el que se firmó un contrato de servicio, no un acuerdo de
tratamiento de datos de salud.

Hay una pieza en el lienzo que el flujo no usa. El **servicio de
seudonimización** existe desde 2023: se construyó para las exportaciones a los
estudios de investigación, reemplaza documento, nombre y fecha de nacimiento
por un identificador que sólo la clínica puede revertir, y está probado contra
diez millones de registros. Hoy está conectado a la base clínica y a nada más.

Hay una segunda cosa que el equipo ya vivió tres veces este trimestre: el
proveedor se cayó más de veinte minutos. Durante esos cortes el médico veía un
error en la pantalla, cerraba la pestaña y el pedido de resumen desaparecía. No
quedó en ninguna parte: nadie lo volvió a pedir.

El equipo tiene un techo de **8 unidades operativas** y hoy usa 5. La
obligación de conservar la historia clínica quince años no la suspende ningún
rediseño.

**Rearmá el sistema** con tres cosas en la cabeza. Una: al proveedor no le
puede llegar nada que permita saber de quién es esa historia. Dos: un corte de
veinte minutos no puede llevarse el pedido. Tres: la historia clínica sigue
guardada donde estaba, con el respaldo que ya tenía.
