---
title: "La pregunta que ya contestamos mil veces"
level: 10
role: tradeoff
domain: banca
tradeoffPairId: n10-asistente-del-banco
D1: 2
D2: 3
D3: 3
D4: 2
D5: 2
D6: 4
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 6
  monthlyUsd: 350
aiBudget: "libre, pero tu respuesta tiene que decir qué pasa cuando cambia la comisión de una caja de ahorro y hay respuestas viejas dando vueltas."
lambda: 0.9
constraints:
  - metric: "preguntas por día en el asistente público"
    operator: ">="
    value: 40000
    unit: preguntas
  - metric: "preguntas que repiten una de las treinta consultas más frecuentes"
    operator: ">="
    value: 62
    unit: por ciento
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el 62 por ciento de las preguntas son treinta preguntas. \"¿Cuánto cuesta mantener una caja de ahorro?\" entra 3.400 veces por día con distinta redacción."
    discoveryPath: "el asistente no distingue entre una pregunta nueva y la misma pregunta de siempre: le manda las dos al modelo. Mirá si hay alguna pieza en el diseño capaz de reconocer que esta respuesta ya se dio."
  - fact: "nadie está identificado. El asistente vive en la parte pública del sitio, antes del inicio de sesión, y no puede consultar ninguna cuenta."
    discoveryPath: "seguí la conexión que entra al asistente y fijate qué clase de dato declara. Un asistente que no puede saber quién pregunta tampoco tiene nada personal que proteger, y eso cambia qué se puede guardar."
  - fact: "la factura del modelo del mes pasado fue de USD 4.100 y el comité de tecnología puso un techo duro para el trimestre."
    discoveryPath: "el modelo es la pieza más cara del catálogo y cobra por llamada. Contá cuántas llamadas evita cada pieza que agregues antes de decidir si vale lo que cuesta operarla."
startingDesign:
  nodes:
    - id: visitante
      type: actor
      label: "Visitante del sitio"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: "Sitio público del banco"
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
      label: "Servicio del asistente público"
      zone: private
      role: assistant
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: modelo
      type: ai-model
      label: "Modelo de respuesta del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 410 }
    - id: registro
      type: database
      label: "Base de consultas del asistente"
      zone: restricted
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
  edges:
    - id: visitante-web
      from: { node: visitante }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
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
    - id: asistente-registro
      from: { node: asistente }
      to: { node: registro }
      dataClass: public
guarantees:
  - id: g-el-modelo-contesta-lo-nuevo
    label: "una pregunta que el asistente no vio antes llega al modelo"
    weight: 2
    predicate:
      op: path
      from:
        role: assistant
      to:
        type: [ai-model]
    whyMissing: "no hay ningún camino desde el servicio del asistente hasta el modelo."
    consequence: "sin modelo el asistente sólo puede contestar lo que ya está escrito, y vuelve a ser el buscador de preguntas frecuentes que el banco tenía en 2019."
  - id: g-la-respuesta-repetida-no-se-vuelve-a-pagar
    label: "el asistente tiene dónde guardar una respuesta que ya dio"
    weight: 3
    predicate:
      op: covered
      target:
        role: assistant
      by:
        type: [cache]
    whyMissing: "el servicio del asistente no está conectado a ningún almacenamiento de respuestas ya dadas, así que cada pregunta, nueva o repetida, termina en una llamada al modelo."
    consequence: "3.400 personas por día preguntan cuánto cuesta mantener una caja de ahorro y el banco paga 3.400 llamadas para dar 3.400 veces la misma respuesta. La factura del mes pasado fue de USD 4.100 y el comité puso un techo."
  - id: g-sin-registro-por-consulta
    label: "el asistente no deja un registro permanente de cada pregunta"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: assistant
      to:
        type: [database]
    whyMissing: "el servicio del asistente escribe cada consulta en una base de datos del banco."
    consequence: "nadie está identificado y nadie pidió ese archivo, pero una vez que existe hay que retenerlo, respaldarlo, protegerlo y poder borrarlo a pedido. Es un dato que el negocio no necesita y que el banco igual tiene que custodiar quince años."
rubric:
  - dimension: "el asistente sigue pudiendo contestar algo que nunca le preguntaron"
    signal:
      kind: predicate
      guaranteeId: g-el-modelo-contesta-lo-nuevo
  - dimension: "la misma pregunta no se paga dos veces"
    signal:
      kind: predicate
      guaranteeId: g-la-respuesta-repetida-no-se-vuelve-a-pagar
  - dimension: "no se guarda lo que después hay que custodiar sin motivo"
    signal:
      kind: predicate
      guaranteeId: g-sin-registro-por-consulta
referenceSolutions:
  - label: "el asistente guarda él mismo lo que ya contestó"
    contextInversion: "que la memoria de respuestas viva pegada al asistente conviene cuando hay un solo consumidor del modelo y el equipo quiere el mínimo de piezas que operar: dos conexiones, una decisión, nada más. Se paga con que el día que aparezca un segundo consumidor, la app o el chat de WhatsApp, cada uno va a tener su propia memoria y sus propias respuestas viejas."
    design:
      nodes:
        - id: visitante
          type: actor
          label: "Visitante del sitio"
          zone: public
        - id: web
          type: web-client
          label: "Sitio público del banco"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente público"
          zone: private
          role: assistant
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: memoria
          type: cache
          label: "Respuestas ya dadas"
          zone: private
          props: { persistence: "volatile", ttl: "86400", eviction: "lru" }
        - id: modelo
          type: ai-model
          label: "Modelo de respuesta del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: visitante-web
          from: { node: visitante }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: public
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: public
        - id: asistente-memoria
          from: { node: asistente }
          to: { node: memoria }
          dataClass: public
        - id: asistente-modelo
          from: { node: asistente }
          to: { node: modelo }
          dataClass: public
  - label: "una pieza aparte es la única que le habla al proveedor"
    contextInversion: "separar al que atiende la web del que llama al proveedor conviene cuando el modelo se va a cambiar: el día que el banco migre de proveedor, o corte el gasto a la mitad del mes, se toca una sola pieza y el asistente ni se entera. También es donde vive el límite de llamadas por minuto. Se paga con una unidad operativa más, que en este presupuesto es casi todo lo que queda."
    design:
      nodes:
        - id: visitante
          type: actor
          label: "Visitante del sitio"
          zone: public
        - id: web
          type: web-client
          label: "Sitio público del banco"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente público"
          zone: private
          role: assistant
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: memoria
          type: cache
          label: "Respuestas ya dadas"
          zone: private
          props: { persistence: "volatile", ttl: "86400", eviction: "lru" }
        - id: puerta-modelo
          type: service
          label: "Servicio de acceso al modelo"
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de respuesta del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: visitante-web
          from: { node: visitante }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: public
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: public
        - id: asistente-memoria
          from: { node: asistente }
          to: { node: memoria }
          dataClass: public
        - id: asistente-puerta-modelo
          from: { node: asistente }
          to: { node: puerta-modelo }
          dataClass: public
        - id: puerta-modelo-modelo
          from: { node: puerta-modelo }
          to: { node: modelo }
          dataClass: public
status: PILOT
---

El sitio público de un banco tiene un asistente desde octubre. Está **antes del
inicio de sesión**: cualquiera que entre al sitio puede preguntar. No puede
consultar ninguna cuenta, no sabe con quién habla y no tiene forma de saberlo.
Contesta sobre productos: qué es una caja de ahorro, cuánto cuesta mantenerla,
qué documentación pide un préstamo personal, cuál es el tope de una tarjeta
prepaga.

Entran **40.000 preguntas por día**. El equipo midió algo incómodo: el **62 por
ciento** de esas preguntas son **treinta preguntas**. *"¿Cuánto cuesta mantener
una caja de ahorro?"* entra 3.400 veces por día, escrita de 3.400 maneras
distintas, y cada una de esas veces el asistente le paga al proveedor una
llamada para producir la misma respuesta.

La factura del mes pasado fue de **USD 4.100**. El comité de tecnología puso un
techo duro para el trimestre y el equipo tiene **6 unidades operativas** para
trabajar.

Hay una cosa más que el equipo copió sin pensar del sistema anterior: **cada
consulta se escribe en una base del banco**. Nadie pidió ese archivo. Nadie lo
lee. Pero una vez que existe, hay que retenerlo, respaldarlo, protegerlo y
poder borrarlo a pedido, como cualquier otro dato bajo custodia del banco.

**Rearmá el sistema** para que una pregunta que ya se contestó no se vuelva a
pagar, y para que el asistente siga pudiendo contestar algo que nunca le
preguntaron.
