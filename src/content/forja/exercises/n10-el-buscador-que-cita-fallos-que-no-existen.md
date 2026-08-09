---
title: "El buscador que cita fallos que no existen"
level: 10
role: core
domain: legal
D1: 3
D2: 3
D3: 4
D4: 2
D5: 3
D6: 3
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 7
  monthlyUsd: 500
aiBudget: "libre, pero tu respuesta tiene que explicar de dónde sale cada cita que el asistente devuelve y cómo se comprueba seis meses después."
lambda: 0.6
constraints:
  - metric: "consultas de abogados por día"
    operator: ">="
    value: 3100
    unit: consultas
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "el índice que armó el equipo para el asistente guarda el texto de los fallos pero no guarda de qué expediente ni de qué página salió cada fragmento."
    discoveryPath: "los dos índices están en el lienzo y no son iguales: uno declara que conserva la referencia al documento de origen y el otro no. Mirá cuál de los dos está conectado al recuperador hoy."
  - fact: "el modelo no distingue entre citar un fallo que leyó y componer uno que suena como los que leyó. Las dos cosas le salen con la misma confianza."
    discoveryPath: "seguí el camino de una pregunta desde el portal hasta el modelo y contá cuántas piezas le entregan material verificable antes de que conteste. Si la respuesta es cero, lo único que el modelo tiene para citar es lo que recuerda."
  - fact: "el índice trazable existe desde la migración del buscador por palabra clave y nadie lo dio de baja."
    discoveryPath: "está en el lienzo, sin conexiones. Cuesta lo mismo que el otro: la diferencia no es de precio, es de qué guarda cada uno."
startingDesign:
  nodes:
    - id: abogado
      type: actor
      label: "Abogado"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: "Portal de jurisprudencia"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: asistente
      type: service
      label: "Servicio del asistente"
      zone: private
      role: assistant
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: recuperador
      type: service
      label: "Servicio de recuperación de fallos"
      zone: private
      role: retriever
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: indice-express
      type: vector-store
      label: "Índice armado para el asistente"
      zone: private
      given: true
      props: { sourceTraceability: "no" }
      position: { x: 805, y: 410 }
    - id: indice-trazable
      type: vector-store
      label: "Índice con referencia al expediente"
      zone: private
      role: traceable-index
      given: true
      props: { sourceTraceability: "sí" }
      position: { x: 805, y: 520 }
    - id: modelo
      type: ai-model
      label: "Modelo de redacción del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
  edges:
    - id: abogado-portal
      from: { node: abogado }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: public
    - id: gw-asistente
      from: { node: gw }
      to: { node: asistente }
      dataClass: public
    - id: asistente-modelo
      from: { node: asistente }
      to: { node: modelo }
      dataClass: public
    - id: recuperador-indice-express
      from: { node: recuperador }
      to: { node: indice-express }
      dataClass: public
guarantees:
  - id: g-recuperacion-antes-del-modelo
    label: "la pregunta pasa por la recuperación de fallos antes de llegar al modelo"
    weight: 3
    predicate:
      op: path
      from:
        role: assistant
      to:
        type: [ai-model]
      via:
        role: retriever
    whyMissing: "no hay ningún camino desde el asistente hasta el modelo que atraviese el servicio de recuperación de fallos."
    consequence: "el modelo contesta con lo que recuerda de su entrenamiento. Un fallo real y uno compuesto salen con la misma redacción y la misma seguridad, y el abogado no tiene cómo distinguirlos en la pantalla."
  - id: g-sin-atajo-al-modelo
    label: "el asistente no le pregunta al modelo por su cuenta"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: assistant
      to:
        type: [ai-model]
    whyMissing: "existe una conexión directa desde el asistente hasta el modelo, así que la pregunta puede llegar sin ningún fallo adjunto."
    consequence: "alcanza con que un camino barato exista para que termine siendo el camino habitual. La recuperación se vuelve opcional y lo opcional se apaga el día que hay que bajar la factura."
  - id: g-fuente-trazable
    label: "la recuperación lee del índice que conserva de dónde salió cada fragmento"
    weight: 3
    predicate:
      op: covered
      target:
        role: retriever
      by:
        type: [vector-store]
        propEquals: { sourceTraceability: "sí" }
    whyMissing: "el servicio de recuperación no está conectado a ningún índice que conserve la referencia al expediente de origen."
    consequence: "la respuesta puede ser correcta y aun así ser inutilizable. Sin expediente ni página, nadie puede comprobarla, y en un escrito una cita que no se puede comprobar vale lo mismo que una inventada."
  - id: g-sin-indice-ciego
    label: "la recuperación no lee del índice que perdió el origen de los fragmentos"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: retriever
      to:
        type: [vector-store]
        propEquals: { sourceTraceability: "no" }
    whyMissing: "el servicio de recuperación sigue conectado a un índice que guarda el texto de los fallos sin guardar de dónde salió cada fragmento."
    consequence: "es peor que no recuperar nada. El fragmento sin origen le da al modelo material verdadero que después nadie puede rastrear, y convierte una cita inventada en una cita que parece respaldada."
rubric:
  - dimension: "el modelo contesta sobre material recuperado, no sobre lo que recuerda"
    signal:
      kind: predicate
      guaranteeId: g-recuperacion-antes-del-modelo
  - dimension: "no queda ningún camino que se saltee la recuperación"
    signal:
      kind: predicate
      guaranteeId: g-sin-atajo-al-modelo
  - dimension: "cada fragmento se puede rastrear hasta su expediente"
    signal:
      kind: predicate
      guaranteeId: g-fuente-trazable
  - dimension: "no queda una fuente que lave el origen del material"
    signal:
      kind: predicate
      guaranteeId: g-sin-indice-ciego
referenceSolutions:
  - label: "el recuperador arma el contexto y hace la llamada"
    contextInversion: "concentrar todo en el recuperador conviene cuando el abogado espera la respuesta en pantalla y cada pieza intermedia se paga en segundos: una sola pieza busca, arma el pedido y llama. También es la que menos cuesta operar. Se paga con que la evidencia de qué se recuperó ese día vive solamente en el registro del proceso, y un registro rota."
    design:
      nodes:
        - id: abogado
          type: actor
          label: "Abogado"
          zone: public
        - id: portal
          type: web-client
          label: "Portal de jurisprudencia"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente"
          zone: private
          role: assistant
          props: { criticality: "high", replicas: "2" }
        - id: recuperador
          type: service
          label: "Servicio de recuperación de fallos"
          zone: private
          role: retriever
          props: { criticality: "high", replicas: "2" }
        - id: indice-trazable
          type: vector-store
          label: "Índice con referencia al expediente"
          zone: private
          role: traceable-index
          props: { sourceTraceability: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de redacción del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: abogado-portal
          from: { node: abogado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: public
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: public
        - id: asistente-recuperador
          from: { node: asistente }
          to: { node: recuperador }
          dataClass: public
        - id: recuperador-indice-trazable
          from: { node: recuperador }
          to: { node: indice-trazable }
          dataClass: public
        - id: recuperador-modelo
          from: { node: recuperador }
          to: { node: modelo }
          dataClass: public
  - label: "la consulta se encola y la recuperación deja escrito lo que entregó"
    contextInversion: "encolar la consulta y archivar lo que se le entregó al modelo conviene cuando la respuesta termina adentro de un escrito judicial y el abogado la va a leer cuando vuelva, no mientras espera. Cambian dos cosas respecto de contestar de corrido. Primera: el asistente se saca la consulta de encima y el proveedor puede estar lento sin que se caiga el portal. Segunda: el índice trazable prueba que el fragmento existe hoy, pero sólo el archivo prueba qué se recuperó el 14 de marzo, cuando el índice ya se reconstruyó dos veces. Se paga con una unidad operativa más y con que la respuesta deja de estar en la misma pantalla."
    design:
      nodes:
        - id: abogado
          type: actor
          label: "Abogado"
          zone: public
        - id: portal
          type: web-client
          label: "Portal de jurisprudencia"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente"
          zone: private
          role: assistant
          props: { criticality: "high", replicas: "2" }
        - id: recuperador
          type: service
          label: "Servicio de recuperación de fallos"
          zone: private
          role: retriever
          props: { criticality: "high", replicas: "2" }
        - id: indice-trazable
          type: vector-store
          label: "Índice con referencia al expediente"
          zone: private
          role: traceable-index
          props: { sourceTraceability: "sí" }
        - id: cola
          type: queue
          label: "Cola de consultas pendientes"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: evidencia
          type: object-storage
          label: "Archivo de material entregado al modelo"
          zone: private
        - id: modelo
          type: ai-model
          label: "Modelo de redacción del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: abogado-portal
          from: { node: abogado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: public
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: public
        - id: asistente-cola
          from: { node: asistente }
          to: { node: cola }
          dataClass: public
        - id: cola-recuperador
          from: { node: cola }
          to: { node: recuperador }
          dataClass: public
        - id: recuperador-indice-trazable
          from: { node: recuperador }
          to: { node: indice-trazable }
          dataClass: public
        - id: recuperador-evidencia
          from: { node: recuperador }
          to: { node: evidencia }
          dataClass: public
        - id: recuperador-modelo
          from: { node: recuperador }
          to: { node: modelo }
          dataClass: public
status: PILOT
---

Un portal de jurisprudencia que usan **3.100 abogados por día**. Desde enero
tiene un asistente: se escribe una pregunta en lenguaje corriente, "¿qué dijo
la Corte sobre prescripción en accidentes laborales?", y contesta un párrafo
redactado, con citas.

En abril un abogado presentó un escrito con **dos citas que no existen**.
Número de expediente, sala, fecha y una frase entrecomillada, todo con la forma
correcta de un fallo real. La contraparte lo revisó, el juez lo revisó, y el
abogado se comió una sanción disciplinaria y una nota en el diario.

El asistente no miente: no tiene contra qué contrastar. Hoy el servicio del
asistente le manda la pregunta al modelo y publica la respuesta. El modelo
contesta con lo que quedó de su entrenamiento, y componer un fallo que suene
como los que leyó le sale con la misma confianza que citar uno que leyó de
verdad.

En el lienzo hay dos piezas que el flujo no usa. Una es el **servicio de
recuperación de fallos**, que hoy consulta el **índice armado para el
asistente**: guarda el texto de los fallos, pero no guarda de qué expediente ni
de qué página salió cada fragmento. La otra es el **índice con referencia al
expediente**, que quedó de la migración del buscador por palabra clave y sigue
completo. Cuestan lo mismo: la diferencia entre los dos no es de precio, es de
qué conservan.

El equipo opera con un techo de **7 unidades operativas**. El modelo, él solo,
factura **USD 200 por mes** y es la pieza más cara del sistema.

**Rearmá el sistema** para que el asistente siga contestando en lenguaje
corriente y cada cita que devuelva se pueda abrir, leer y comprobar contra el
expediente del que salió.
