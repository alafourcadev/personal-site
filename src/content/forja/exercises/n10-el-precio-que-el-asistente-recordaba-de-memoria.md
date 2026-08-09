---
title: "El precio que el asistente recordaba de memoria"
level: 10
role: core
domain: telecomunicaciones
D1: 3
D2: 3
D3: 3
D4: 2
D5: 3
D6: 2
D7: 3
D8: 1
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 7
  monthlyUsd: 450
aiBudget: "libre, pero tu respuesta tiene que decir de qué sistema sale el número que el cliente ve en la pantalla, y qué pasa con ese número el día que comercial cambia una tarifa a las 8 de la mañana."
lambda: 0.6
constraints:
  - metric: "conversaciones de venta por día"
    operator: ">="
    value: 1900
    unit: conversaciones
  - metric: "tiempo aceptable de respuesta en el chat"
    operator: "<="
    value: 4
    unit: segundos
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "el precio que el asistente repite salió de un resumen de tarifas que alguien pegó dentro de la instrucción del modelo en marzo de 2024. Desde entonces comercial cambió tarifas once veces."
    discoveryPath: "seguí el número hacia atrás y preguntá qué pieza lo produce. Si el único que lo devuelve es el modelo, ese número no viene de ningún sistema de la empresa: viene de lo que el modelo tenga adentro, y nadie sabe de cuándo es."
  - fact: "el servicio de tarifas existe, lo mantiene facturación y devuelve el precio vigente de cada plan con la fecha desde la que rige. Es el mismo que usa la factura que le llega al cliente."
    discoveryPath: "está en el lienzo, conectado a la base de tarifas y a nada más. Que lo use la factura y no lo use el chat no es una limitación técnica: es una conexión que nadie dibujó."
  - fact: "facturación no permite que otro equipo lea su base directamente. La base es suya, el contrato de lectura es el servicio."
    discoveryPath: "mirá qué zona ocupa la base de tarifas y quién la toca hoy. El dueño del dato expone un servicio, no una tabla: por eso la pieza intermedia no es burocracia."
  - fact: "el proveedor del modelo no garantiza qué versión atiende cada llamada. Dos consultas iguales el mismo día pueden contestar distinto."
    discoveryPath: "preguntá qué parte de la respuesta puede cambiar sin que nadie la apruebe. Todo lo que el modelo produzca sin haberlo recibido es un dato que cambia solo."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: "Cliente"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: chat
      type: web-client
      label: "Chat de la web comercial"
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
      label: "Servicio del asistente comercial"
      zone: private
      role: asistente
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: tarifas
      type: service
      label: "Servicio de tarifas vigentes"
      zone: private
      role: tarifario
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: basetarifas
      type: database
      label: "Base de planes y precios"
      zone: restricted
      role: catalogo
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
    - id: modelo
      type: ai-model
      label: "Modelo conversacional del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
  edges:
    - id: cliente-chat
      from: { node: cliente }
      to: { node: chat }
      dataClass: public
    - id: chat-gw
      from: { node: chat }
      to: { node: gw }
      dataClass: personal
    - id: gw-asistente
      from: { node: gw }
      to: { node: asistente }
      dataClass: personal
    - id: asistente-modelo
      from: { node: asistente }
      to: { node: modelo }
      dataClass: public
    - id: tarifas-basetarifas
      from: { node: tarifas }
      to: { node: basetarifas }
      dataClass: public
guarantees:
  - id: g-el-precio-sale-del-catalogo
    label: "el asistente puede llegar al catálogo de precios sin pasar por el modelo"
    weight: 3
    predicate:
      op: path
      from:
        role: asistente
      to:
        role: catalogo
      forbid:
        type: [ai-model]
    whyMissing: "no hay ningún camino desde el asistente hasta la base de planes y precios, ni pasando por el servicio de tarifas ni de ninguna otra forma. El precio que el cliente ve no sale de ningún sistema de la empresa."
    consequence: "el asistente cotizó durante siete meses con un resumen de tarifas de marzo de 2024. Cuando comercial subió el abono, el chat siguió ofreciendo el precio viejo a 3.100 clientes y el ente obligó a respetarlo: USD 148.000 que nadie presupuestó. Un precio que no se lee de ningún lado no se puede actualizar, sólo se puede descubrir tarde."
  - id: g-el-modelo-recibe-el-precio-ya-resuelto
    label: "lo que llega al modelo pasó antes por el servicio de tarifas"
    weight: 3
    predicate:
      op: path
      from:
        role: asistente
      to:
        type: [ai-model]
      via:
        role: tarifario
    whyMissing: "no existe ningún camino desde el asistente hasta el modelo que atraviese el servicio de tarifas, así que el modelo tiene que producir el número él mismo."
    consequence: "el modelo es bueno redactando y es pésimo recordando. Si el precio no le llega resuelto, lo inventa con la seguridad de quien lo sabe, y el cliente se lleva una cotización que ninguna área de la empresa aprobó. Redactar no es la misma tarea que saber cuánto sale algo."
  - id: g-el-asistente-no-le-pregunta-al-modelo-directo
    label: "el asistente no tiene una conexión propia al modelo"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: asistente
      to:
        type: [ai-model]
    whyMissing: "el asistente está conectado directo al modelo, así que puede seguir preguntándole cualquier cosa sin que el precio pase por tarifas."
    consequence: "mientras exista ese atajo, el camino correcto es opcional. Alcanza con una consulta que nadie previó, un plan que salió ayer o una promoción de una sola provincia, para que el modelo vuelva a contestar de memoria, y esa consulta es exactamente la que nadie probó."
rubric:
  - dimension: "el precio se lee del sistema que lo administra"
    signal:
      kind: predicate
      guaranteeId: g-el-precio-sale-del-catalogo
  - dimension: "el modelo redacta, no recuerda"
    signal:
      kind: predicate
      guaranteeId: g-el-modelo-recibe-el-precio-ya-resuelto
  - dimension: "no queda ningún camino que saltee la tarifa vigente"
    signal:
      kind: predicate
      guaranteeId: g-el-asistente-no-le-pregunta-al-modelo-directo
referenceSolutions:
  - label: "tarifas resuelve el precio y arma la respuesta"
    contextInversion: "dejar que el propio servicio de tarifas hable con el modelo conviene cuando el equipo es chico y la conversación es corta: hay una sola pieza que operar entre el asistente y el proveedor, un solo lugar donde limitar llamadas y un solo lugar donde cambiar de proveedor. Se paga con que facturación queda dueña de una integración con un tercero que no le interesa mantener, y con que una demora del modelo se le nota también a la factura, que consulta el mismo servicio."
    design:
      nodes:
        - id: cliente
          type: actor
          label: "Cliente"
          zone: public
        - id: chat
          type: web-client
          label: "Chat de la web comercial"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente comercial"
          zone: private
          role: asistente
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: tarifas
          type: service
          label: "Servicio de tarifas vigentes"
          zone: private
          role: tarifario
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: basetarifas
          type: database
          label: "Base de planes y precios"
          zone: restricted
          role: catalogo
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: modelo
          type: ai-model
          label: "Modelo conversacional del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: cliente-chat
          from: { node: cliente }
          to: { node: chat }
          dataClass: public
        - id: chat-gw
          from: { node: chat }
          to: { node: gw }
          dataClass: personal
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: personal
        - id: asistente-tarifas
          from: { node: asistente }
          to: { node: tarifas }
          dataClass: public
        - id: tarifas-basetarifas
          from: { node: tarifas }
          to: { node: basetarifas }
          dataClass: public
        - id: tarifas-modelo
          from: { node: tarifas }
          to: { node: modelo }
          dataClass: public
  - label: "un redactor separado que recibe el precio ya resuelto"
    contextInversion: "separar la redacción conviene cuando el servicio de tarifas ya es crítico para otra cosa, porque la factura de 900.000 clientes sale de ahí, y no querés que una demora del proveedor de IA se le note. El redactor es la única pieza que conoce al proveedor: absorbe los reintentos, el límite de llamadas y el cambio de modelo sin tocar facturación. Se paga con una pieza más para operar y con una cadena de tres servicios entre la pregunta del cliente y la respuesta, que es tiempo que el chat siente."
    design:
      nodes:
        - id: cliente
          type: actor
          label: "Cliente"
          zone: public
        - id: chat
          type: web-client
          label: "Chat de la web comercial"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: asistente
          type: service
          label: "Servicio del asistente comercial"
          zone: private
          role: asistente
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: tarifas
          type: service
          label: "Servicio de tarifas vigentes"
          zone: private
          role: tarifario
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: basetarifas
          type: database
          label: "Base de planes y precios"
          zone: restricted
          role: catalogo
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: redactor
          type: service
          label: "Servicio de redacción de respuestas"
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo conversacional del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: cliente-chat
          from: { node: cliente }
          to: { node: chat }
          dataClass: public
        - id: chat-gw
          from: { node: chat }
          to: { node: gw }
          dataClass: personal
        - id: gw-asistente
          from: { node: gw }
          to: { node: asistente }
          dataClass: personal
        - id: asistente-tarifas
          from: { node: asistente }
          to: { node: tarifas }
          dataClass: public
        - id: tarifas-basetarifas
          from: { node: tarifas }
          to: { node: basetarifas }
          dataClass: public
        - id: tarifas-redactor
          from: { node: tarifas }
          to: { node: redactor }
          dataClass: public
        - id: redactor-modelo
          from: { node: redactor }
          to: { node: modelo }
          dataClass: public
status: PILOT
---

Una operadora con **900.000 líneas** vende planes por chat. El asistente
atiende **1.900 conversaciones por día** y contesta la pregunta que hacen
todos: *"¿cuánto me sale pasarme al plan de 200 gigas?"*.

Contesta bien. Escribe claro, entiende el modismo de cada provincia y no se
cansa a las once de la noche. El problema es de dónde saca el número.

En **marzo de 2024** alguien pegó un resumen de tarifas dentro de la
instrucción del modelo. Era lo más rápido para salir a producción y funcionó.
Desde entonces comercial cambió tarifas **once veces**, y la instrucción quedó
igual. El chat siguió cotizando el abono de marzo del año pasado.

Se descubrió cuando **3.100 clientes** reclamaron que la factura no coincidía
con lo que el chat les había prometido. El ente regulador resolvió que la
cotización obliga: la operadora tuvo que respetar el precio viejo doce meses.
**USD 148.000** que nadie presupuestó, y una instrucción que ahora hay que
revisar a mano cada vez que cambia una tarifa.

En el lienzo hay una pieza que este flujo no usa. El **servicio de tarifas
vigentes** lo mantiene facturación, devuelve el precio de cada plan con la
fecha desde la que rige, y es el mismo que produce la factura que le llega al
cliente. Hoy está conectado a la base de planes y a nada más. Facturación no
va a abrir su base a otro equipo: el contrato de lectura es el servicio, no la
tabla.

Hay algo más que conviene tener en la cabeza: el proveedor **no garantiza qué
versión del modelo atiende cada llamada**. Todo lo que el modelo produzca sin
haberlo recibido es un dato que puede cambiar sin que nadie lo apruebe.

El equipo tiene un techo de **7 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que el número que ve el cliente salga del mismo
lugar que el de la factura, y para que no quede ningún camino por el que el
asistente pueda volver a preguntarle el precio al modelo.
