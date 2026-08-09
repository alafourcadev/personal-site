---
title: "La respuesta que hay que poder reconstruir en dos años"
level: 10
role: tradeoff
domain: banca
tradeoffPairId: n10-asistente-del-banco
D1: 2
D2: 4
D3: 3
D4: 3
D5: 2
D6: 3
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 6
  monthlyUsd: 500
aiBudget: "libre, pero tu respuesta tiene que decir qué se le muestra al inspector del ente cuando pregunta qué le contestó el sistema al oficial de cuentas el 14 de marzo del año pasado."
lambda: 0.9
constraints:
  - metric: "consultas por día de oficiales de cuentas"
    operator: ">="
    value: 5800
    unit: consultas
  - metric: "tiempo que hay que poder reconstruir una consulta y su respuesta"
    operator: ">="
    value: 24
    unit: meses
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el equipo copió el diseño del asistente público, incluido el almacenamiento de respuestas ya dadas. Acá cada respuesta es sobre una persona concreta."
    discoveryPath: "mirá qué clase de dato declara la conexión que sale del asistente hacia el almacenamiento de respuestas. El motor la bloquea antes de calcular nada: no es una preferencia de diseño, es una conexión que no puede existir."
  - fact: "dos oficiales distintos preguntando por el mismo cliente pueden recibir respuestas distintas, porque el modelo no es determinista y porque la situación del cliente cambia entre una consulta y la otra."
    discoveryPath: "una respuesta reutilizada es una respuesta de otro momento. Preguntate qué significa 'la misma pregunta' cuando la pregunta es sobre la mora de una persona y la mora se actualiza todos los días."
  - fact: "el ente regulador puede pedir, hasta dos años después, qué le respondió el sistema a un oficial sobre un cliente puntual."
    discoveryPath: "la base del expediente está en el lienzo con respaldo diario y el asistente no la toca. Seguí el camino de una consulta y contá en qué punto queda escrita en algo que dure dos años."
startingDesign:
  nodes:
    - id: oficial
      type: actor
      label: "Oficial de cuentas"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: consola
      type: web-client
      label: "Consola de banca comercial"
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
      label: "Servicio del asistente de cuentas"
      zone: private
      role: assistant
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: memoria
      type: cache
      label: "Respuestas ya dadas"
      zone: private
      given: true
      props: { persistence: "volatile", ttl: "86400", eviction: "lru" }
      position: { x: 805, y: 300 }
    - id: modelo
      type: ai-model
      label: "Modelo de respuesta del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 410 }
    - id: expediente
      type: database
      label: "Base del expediente del cliente"
      zone: restricted
      role: expediente
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
  edges:
    - id: oficial-consola
      from: { node: oficial }
      to: { node: consola }
      dataClass: public
    - id: consola-gw
      from: { node: consola }
      to: { node: gw }
      dataClass: personal
    - id: gw-asistente
      from: { node: gw }
      to: { node: asistente }
      dataClass: personal
    - id: asistente-memoria
      from: { node: asistente }
      to: { node: memoria }
      dataClass: personal
    - id: asistente-modelo
      from: { node: asistente }
      to: { node: modelo }
      dataClass: public
guarantees:
  - id: g-el-modelo-sigue-contestando
    label: "la consulta del oficial llega al modelo"
    weight: 2
    predicate:
      op: path
      from:
        role: assistant
      to:
        type: [ai-model]
    whyMissing: "no hay ningún camino desde el servicio del asistente hasta el modelo."
    consequence: "sin modelo, el oficial vuelve a abrir seis pantallas y leer el expediente a mano. La consulta en lenguaje corriente es lo que el negocio compró."
  - id: g-cada-consulta-queda-en-el-expediente
    label: "la consulta y lo que se respondió quedan escritos en el expediente del cliente"
    weight: 3
    predicate:
      op: path
      from:
        role: assistant
      to:
        role: expediente
    whyMissing: "no hay ningún camino desde el servicio del asistente hasta la base del expediente del cliente."
    consequence: "el ente puede pedir, hasta dos años después, qué le respondió el sistema a un oficial sobre un cliente puntual. Si la respuesta no quedó escrita en ningún lado con respaldo, la contestación al inspector es que no se sabe, y esa contestación tiene multa."
  - id: g-ninguna-copia-que-nadie-audita
    label: "ninguna pieza guarda copias de las respuestas en un almacenamiento volátil"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [cache]
    whyMissing: "hay al menos una pieza escribiendo respuestas en un almacenamiento que no sobrevive a un reinicio y que nadie audita."
    consequence: "cada respuesta es sobre la mora, las garantías y el historial de una persona identificada. Una copia en un almacenamiento volátil no se puede auditar, no se puede retener por dos años y no se puede borrar a pedido. Encima devuelve la situación de ayer como si fuera la de hoy."
rubric:
  - dimension: "el oficial sigue preguntando en lenguaje corriente"
    signal:
      kind: predicate
      guaranteeId: g-el-modelo-sigue-contestando
  - dimension: "hay con qué contestarle al inspector dentro de dos años"
    signal:
      kind: predicate
      guaranteeId: g-cada-consulta-queda-en-el-expediente
  - dimension: "no quedan copias de datos de una persona fuera de lo auditable"
    signal:
      kind: predicate
      guaranteeId: g-ninguna-copia-que-nadie-audita
referenceSolutions:
  - label: "el asistente escribe en el expediente antes de contestar"
    contextInversion: "escribir en el expediente dentro de la misma operación conviene cuando el registro tiene que ser condición de la respuesta: si la escritura falla, la consulta falla y el oficial lo ve en el momento. No hay ventana en la que se haya respondido algo que no quedó anotado. Se paga con que la base del expediente entra en el camino crítico de cada consulta, y son 5.800 por día."
    design:
      nodes:
        - id: oficial
          type: actor
          label: "Oficial de cuentas"
          zone: public
        - id: consola
          type: web-client
          label: "Consola de banca comercial"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente de cuentas"
          zone: private
          role: assistant
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: expediente
          type: database
          label: "Base del expediente del cliente"
          zone: restricted
          role: expediente
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: modelo
          type: ai-model
          label: "Modelo de respuesta del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: oficial-consola
          from: { node: oficial }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: personal
        - id: asistente-expediente
          from: { node: asistente }
          to: { node: expediente }
          dataClass: regulated
        - id: asistente-modelo
          from: { node: asistente }
          to: { node: modelo }
          dataClass: public
  - label: "un registro de consultas que después alimenta el expediente"
    contextInversion: "publicar la consulta en un registro de eventos y dejar que un archivista la asiente conviene cuando la base del expediente no aguanta 5.800 escrituras sincrónicas por día encima de su carga normal: el asistente publica y sigue, y el registro conserva el orden y se puede releer si el archivista se atrasa o se rompe. Se paga con dos piezas más para operar, todo el presupuesto que queda, y con una ventana de segundos en la que la respuesta ya salió y todavía no está en el expediente."
    design:
      nodes:
        - id: oficial
          type: actor
          label: "Oficial de cuentas"
          zone: public
        - id: consola
          type: web-client
          label: "Consola de banca comercial"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente de cuentas"
          zone: private
          role: assistant
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: stream
          label: "Registro de consultas al asistente"
          zone: private
          props: { retention: "30d", partitions: "6", ordering: "sí" }
        - id: archivista
          type: worker
          label: "Archivista de consultas"
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: expediente
          type: database
          label: "Base del expediente del cliente"
          zone: restricted
          role: expediente
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: modelo
          type: ai-model
          label: "Modelo de respuesta del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: oficial-consola
          from: { node: oficial }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: personal
        - id: asistente-registro
          from: { node: asistente }
          to: { node: registro }
          dataClass: regulated
        - id: registro-archivista
          from: { node: registro }
          to: { node: archivista }
          dataClass: regulated
        - id: archivista-expediente
          from: { node: archivista }
          to: { node: expediente }
          dataClass: regulated
        - id: asistente-modelo
          from: { node: asistente }
          to: { node: modelo }
          dataClass: public
status: PILOT
---

El mismo banco, otro asistente. Este vive **después del inicio de sesión**, en
la consola que usan los oficiales de cuentas de las sucursales. El oficial
escribe *"¿cómo viene Rodríguez con el crédito prendario?"* y recibe un párrafo
sobre la mora, las garantías y el historial de un cliente con nombre, apellido
y número de documento.

Entran **5.800 consultas por día**. Cada una es sobre una persona concreta.

El equipo copió el diseño del asistente público del sitio, que funciona muy
bien y bajó la factura del proveedor a la mitad. Copió todo, incluida la pieza
que guarda las respuestas ya dadas para no volver a pagarlas. Acá esa pieza
hace otra cosa: guarda la situación crediticia de personas identificadas en un
almacenamiento que no sobrevive a un reinicio, que nadie audita y que devuelve
la mora de ayer como si fuera la de hoy.

Hay un requisito que el asistente público no tenía. El ente regulador puede
pedir, **hasta veinticuatro meses después**, qué le respondió el sistema a un
oficial sobre un cliente puntual: la pregunta, la respuesta y el momento. La
**base del expediente del cliente** está en el lienzo, con respaldo diario, y
el asistente no la toca.

El equipo tiene las mismas **6 unidades operativas** que el otro.

**Rearmá el sistema** para que dentro de dos años se pueda reconstruir qué se
respondió y sobre quién, y para que no quede ninguna copia de la situación de
una persona en un lugar que nadie puede auditar.
