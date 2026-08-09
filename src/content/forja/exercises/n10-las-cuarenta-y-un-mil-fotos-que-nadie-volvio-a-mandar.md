---
title: "Las cuarenta y un mil fotos que nadie volvió a mandar"
level: 10
role: core
domain: logistica
D1: 3
D2: 3
D3: 3
D4: 2
D5: 3
D6: 4
D7: 3
D8: 1
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 7
  monthlyUsd: 450
aiBudget: "libre, pero tu respuesta tiene que decir cuántas veces se le pregunta al modelo por cada foto y qué pasa con una foto cuando el proveedor devuelve un rechazo por límite de llamadas."
lambda: 0.8
constraints:
  - metric: "fotos de entrega que se leen por día"
    operator: ">="
    value: 300000
    unit: fotos
  - metric: "llamadas por minuto que el proveedor acepta antes de rechazar"
    operator: "<="
    value: 600
    unit: llamadas/minuto
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "el viernes 12 el proveedor devolvió rechazos por límite de llamadas durante cuatro horas. Cada rechazo se registró como error y la foto no se volvió a mandar nunca."
    discoveryPath: "seguí el camino de una foto desde la app del repartidor hasta el modelo y buscá en qué punto el pedido queda escrito en algo que sobreviva a un reinicio. Si no hay ninguno, un rechazo del proveedor y una caída del proceso cuestan lo mismo: el pedido desaparece."
  - fact: "la foto original no queda guardada en ninguna parte. Lo único que se conserva es la dirección que el modelo leyó."
    discoveryPath: "contá cuántas piezas del diseño reciben la foto y cuántas la guardan. Cuando el 12 quisieron reprocesar las 41.000 lecturas perdidas, no había fotos que reprocesar."
  - fact: "nadie sabe cuántas llamadas al modelo hace el sistema por día. La primera medición fue la factura."
    discoveryPath: "mirá qué pieza del diseño reporta su propio ritmo. Si el servicio que llama al modelo no está conectado a nada que lo mida, el único instrumento disponible llega el día 5 del mes siguiente."
startingDesign:
  nodes:
    - id: repartidor
      type: actor
      label: "Repartidor"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: "App de reparto"
      zone: public
      given: true
      props: { connectivity: "intermittent", offlineCapable: "no" }
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: entregas
      type: service
      label: "Servicio de entregas"
      zone: private
      role: entregas
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "no" }
      position: { x: 445, y: 300 }
    - id: lector
      type: service
      label: "Servicio de lectura de etiquetas"
      zone: private
      role: lector
      given: true
      props: { criticality: "high", replicas: "1", idempotent: "no" }
      position: { x: 445, y: 410 }
    - id: modelo
      type: ai-model
      label: "Modelo de lectura de imagen del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
  edges:
    - id: repartidor-app
      from: { node: repartidor }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-entregas
      from: { node: gw }
      to: { node: entregas }
      dataClass: personal
    - id: entregas-lector
      from: { node: entregas }
      to: { node: lector }
      dataClass: personal
    - id: lector-modelo
      from: { node: lector }
      to: { node: modelo }
      dataClass: public
guarantees:
  - id: g-una-sola-puerta-al-modelo
    label: "al modelo se le habla desde el servicio de lectura y desde ningún otro lado"
    weight: 3
    predicate:
      op: path
      from:
        role: entregas
      to:
        type: [ai-model]
      via:
        role: lector
    whyMissing: "no hay ningún camino desde el servicio de entregas hasta el modelo que atraviese el servicio de lectura de etiquetas."
    consequence: "cuando cada pieza llama al modelo por su cuenta, nadie puede contar las llamadas, nadie puede cortarlas cuando la factura se dispara, y cambiar de proveedor deja de ser una decisión y pasa a ser una migración."
  - id: g-el-pedido-sobrevive-al-rechazo
    label: "el pedido de lectura queda escrito en algo durable antes de llegar al modelo"
    weight: 3
    predicate:
      op: noVolatileCut
      from:
        role: entregas
      to:
        type: [ai-model]
    whyMissing: "entre el servicio de entregas y el modelo no hay ninguna pieza que sobreviva a un reinicio, así que el pedido de lectura existe sólo mientras el proceso que lo atiende siga vivo."
    consequence: "el viernes 12 el proveedor rechazó llamadas durante cuatro horas por límite de tasa. Cada rechazo se anotó como error y ahí terminó: 41.000 fotos quedaron sin leer y no había ninguna lista de cuáles eran."
  - id: g-la-foto-queda-guardada
    label: "la foto original queda guardada, no sólo lo que el modelo leyó de ella"
    weight: 2
    predicate:
      op: path
      from:
        role: entregas
      to:
        type: [object-storage]
    whyMissing: "no hay ningún camino desde el servicio de entregas hasta un almacenamiento de objetos, así que lo único que sobrevive de una entrega es el texto que el modelo devolvió."
    consequence: "sin la foto no hay reproceso posible. Cuando el modelo lee mal, o cuando no llega a leer, no queda nada contra qué volver a intentar, y la única fuente de verdad es lo que dijo un componente no determinista una sola vez."
  - id: g-el-gasto-es-visible
    label: "la pieza que llama al modelo reporta su propio ritmo"
    weight: 2
    predicate:
      op: covered
      target:
        role: lector
      by:
        type: [observability]
    whyMissing: "el servicio de lectura de etiquetas no está conectado a ningún componente de monitoreo, así que nadie sabe cuántas llamadas hace ni cuántas le rechazan."
    consequence: "el primer instrumento de medición pasa a ser la factura, que llega el día 5 del mes siguiente. Un reintento mal configurado puede triplicar el gasto durante treinta días sin que nada se queje."
rubric:
  - dimension: "hay un solo lugar del sistema que le habla al modelo"
    signal:
      kind: predicate
      guaranteeId: g-una-sola-puerta-al-modelo
  - dimension: "un rechazo del proveedor no se lleva el trabajo pendiente"
    signal:
      kind: predicate
      guaranteeId: g-el-pedido-sobrevive-al-rechazo
  - dimension: "la lectura se puede rehacer porque el original existe"
    signal:
      kind: predicate
      guaranteeId: g-la-foto-queda-guardada
  - dimension: "el gasto del modelo se mide antes de que llegue la factura"
    signal:
      kind: predicate
      guaranteeId: g-el-gasto-es-visible
referenceSolutions:
  - label: "la cola absorbe el pico y el servicio de entregas archiva la foto"
    contextInversion: "que el servicio de entregas escriba la foto y después encole conviene cuando el archivo tiene que estar antes que cualquier otra cosa: si el guardado falla, la entrega se rechaza en el momento y el repartidor la reintenta desde el teléfono, que es el único lugar donde la foto todavía existe. El orden es explícito y hay un solo consumidor. Se paga con la escritura del archivo dentro del camino del repartidor."
    design:
      nodes:
        - id: repartidor
          type: actor
          label: "Repartidor"
          zone: public
        - id: app
          type: mobile-client
          label: "App de reparto"
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: entregas
          type: service
          label: "Servicio de entregas"
          zone: private
          role: entregas
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: fotos
          type: object-storage
          label: "Archivo de fotos de entrega"
          zone: private
        - id: cola
          type: queue
          label: "Cola de lecturas pendientes"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: lector
          type: service
          label: "Servicio de lectura de etiquetas"
          zone: private
          role: lector
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de lectura de imagen del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: monitoreo
          type: observability
          label: "Monitoreo"
          zone: private
      edges:
        - id: repartidor-app
          from: { node: repartidor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-entregas
          from: { node: gw }
          to: { node: entregas }
          dataClass: personal
        - id: entregas-fotos
          from: { node: entregas }
          to: { node: fotos }
          dataClass: personal
        - id: entregas-cola
          from: { node: entregas }
          to: { node: cola }
          dataClass: personal
        - id: cola-lector
          from: { node: cola }
          to: { node: lector }
          dataClass: personal
        - id: lector-modelo
          from: { node: lector }
          to: { node: modelo }
          dataClass: public
        - id: entregas-monitoreo
          from: { node: entregas }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: lector-monitoreo
          from: { node: lector }
          to: { node: monitoreo }
          dataClass: public
  - label: "un registro de eventos con un archivador aparte"
    contextInversion: "publicar la entrega en un registro de eventos y dejar que un archivador la guarde conviene cuando el servicio de entregas no puede quedarse esperando ninguna escritura: publica una vez y sigue, y el archivado sale del camino del repartidor. Además el mismo registro se relee: las 41.000 lecturas del viernes 12 se reprocesan pidiendo el rango de esa tarde, sin tocar el archivo ni molestar a los repartidores. Se paga con una unidad operativa más, que en este presupuesto es la última que queda, y con dos consumidores que hay que mirar por separado."
    design:
      nodes:
        - id: repartidor
          type: actor
          label: "Repartidor"
          zone: public
        - id: app
          type: mobile-client
          label: "App de reparto"
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: entregas
          type: service
          label: "Servicio de entregas"
          zone: private
          role: entregas
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: stream
          label: "Registro de entregas"
          zone: private
          props: { retention: "14d", partitions: "12", ordering: "sí" }
        - id: archivador
          type: worker
          label: "Archivador de fotos"
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: fotos
          type: object-storage
          label: "Archivo de fotos de entrega"
          zone: private
        - id: lector
          type: service
          label: "Servicio de lectura de etiquetas"
          zone: private
          role: lector
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de lectura de imagen del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: monitoreo
          type: observability
          label: "Monitoreo"
          zone: private
      edges:
        - id: repartidor-app
          from: { node: repartidor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-entregas
          from: { node: gw }
          to: { node: entregas }
          dataClass: personal
        - id: entregas-registro
          from: { node: entregas }
          to: { node: registro }
          dataClass: personal
        - id: registro-archivador
          from: { node: registro }
          to: { node: archivador }
          dataClass: personal
        - id: archivador-fotos
          from: { node: archivador }
          to: { node: fotos }
          dataClass: personal
        - id: registro-lector
          from: { node: registro }
          to: { node: lector }
          dataClass: personal
        - id: lector-modelo
          from: { node: lector }
          to: { node: modelo }
          dataClass: public
        - id: entregas-monitoreo
          from: { node: entregas }
          to: { node: monitoreo }
          dataClass: public
        - id: registro-monitoreo
          from: { node: registro }
          to: { node: monitoreo }
          dataClass: public
        - id: lector-monitoreo
          from: { node: lector }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una empresa de última milla entrega **300.000 paquetes por día** en tres
países. Al dejar cada paquete, el repartidor saca una foto: la etiqueta, la
puerta, el paquete apoyado. Un modelo lee la etiqueta de esa foto y confirma
que la dirección de la entrega coincide con la del envío. Es lo que evita que
un paquete quede marcado como entregado en la casa equivocada.

El modelo es del proveedor, corre afuera y **factura por llamada**. Es, con
diferencia, la pieza más cara del sistema: **USD 200 por mes** de base, más
consumo.

El **viernes 12**, entre las 14 y las 18, el proveedor empezó a rechazar
llamadas por límite de tasa: acepta 600 por minuto y el sistema le estaba
mandando más. Cada rechazo se anotó como error en el registro del proceso y ahí
terminó la historia. **41.000 fotos quedaron sin leer.**

El lunes, cuando quisieron reprocesarlas, aparecieron las dos mitades del
problema. La primera: no había ninguna lista de cuáles eran. El pedido de
lectura existía solamente adentro del proceso que lo estaba atendiendo, y ese
proceso ya se había reiniciado. La segunda: **la foto tampoco estaba**. El
sistema guarda lo que el modelo leyó, no lo que el repartidor sacó. No había
nada que volver a mandar.

Y hay una tercera cosa que se descubrió esa misma semana: **nadie sabía cuántas
llamadas al modelo hacía el sistema por día**. La primera medición fue la
factura.

El equipo tiene un techo de **7 unidades operativas** y hoy usa 4. Cada pieza
que agregues sale de ese número, y el modelo ya se lleva una.

**Rearmá el sistema** con tres cosas en la cabeza. Una: el pedido de lectura
tiene que existir en algún lado que sobreviva a un reinicio, o un mal rato del
proveedor se lleva el trabajo. Dos: la foto original tiene que quedar guardada,
porque es lo único contra lo que se puede volver a intentar. Tres: el gasto del
modelo se tiene que poder mirar antes del día 5 del mes siguiente.
