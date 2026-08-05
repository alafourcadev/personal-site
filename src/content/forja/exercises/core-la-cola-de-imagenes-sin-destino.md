---
title: "La cola de miniaturas que se llena y nadie mira"
level: 4
role: core
domain: procesamiento-de-imagenes
D1: 1
D2: 0
D3: 2
D4: 1
D5: 2
D6: 1
D7: 1
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 8
aiBudget: libre — pero explicá qué pasa concretamente con una imagen que falla, no sólo que "está resuelto".
lambda: 0.5
constraints:
  - metric: imágenes subidas por hora en pico
    operator: ">="
    value: 2000
    unit: imágenes/hora
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: opsUnits
hiddenFacts:
  - fact: entre el 1% y el 3% de las imágenes subidas están corruptas o en un formato que el generador de miniaturas no puede procesar.
    discoveryPath: dejá la cola sin marcar `dlq` y probá tu respuesta — el motor te marca el hallazgo con la palabra exacta que describe qué le pasa a esas imágenes.
  - fact: hoy una imagen que falla el procesamiento se queda atascada en la cola hasta que la retención la borra sola — nadie la vuelve a ver.
    discoveryPath: la misma pregunta que responde el hallazgo de la cola sin destino para fallos.
startingDesign:
  nodes:
    - id: usuario
      type: actor
      label: Usuario
      zone: public
      given: true
      position: { x: 28, y: 80 }
    - id: web
      type: web-client
      label: Panel web
      zone: public
      given: true
      position: { x: 388, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 388, y: 190 }
    - id: subida
      type: service
      label: Servicio de subida
      zone: private
      given: true
      props: { criticality: "medium" }
      position: { x: 388, y: 300 }
    - id: cola
      type: queue
      label: Cola de procesamiento
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 748, y: 80 }
  edges:
    - id: usuario-web
      from: { node: usuario }
      to: { node: web }
    - id: web-gw
      from: { node: web }
      to: { node: gw }
    - id: gw-subida
      from: { node: gw }
      to: { node: subida }
    - id: subida-cola
      from: { node: subida }
      to: { node: cola }
guarantees:
  - id: g-queue-exists
    label: las imágenes pasan por una cola, no se procesan en el momento de subirlas
    weight: 1
    predicate:
      op: exists
      node:
        type: [queue]
    whyMissing: no hay ninguna cola en el diseño — el procesamiento estaría atado al momento exacto de la subida.
    consequence: un pico de subidas satura al servicio de subida, y una imagen pesada bloquea a las que vienen atrás.
  - id: g-consumed
    label: la cola tiene quien la vacíe
    weight: 1
    predicate:
      op: ruleSilent
      rule: orphan-queue
    whyMissing: la cola no tiene ningún consumidor conectado.
    consequence: las imágenes se acumulan hasta llenar la retención y después se descartan sin que nadie lo note.
  - id: g-has-dlq
    label: una imagen que falla el procesamiento siempre tiene un destino
    weight: 2
    predicate:
      op: ruleSilent
      rule: queue-without-dlq
    whyMissing: la cola no tiene una cola de mensajes fallidos configurada.
    consequence: una imagen corrupta bloquea o se pierde en silencio — con un solo responsable de guardia, nadie la va a ver hasta que un usuario reclame que su miniatura nunca apareció.
rubric:
  - dimension: el pico de subidas no llega directo al generador de miniaturas
    signal:
      kind: predicate
      guaranteeId: g-queue-exists
  - dimension: una imagen que falla tiene un destino, no desaparece
    signal:
      kind: predicate
      guaranteeId: g-has-dlq
referenceSolutions:
  - label: cola con DLQ, salida a almacenamiento de objetos
    contextInversion: la variante estándar cuando las miniaturas se sirven directo desde almacenamiento de objetos, sin nada más leyendo el resultado.
    design:
      nodes:
        - id: usuario
          type: actor
          label: Usuario
          zone: public
        - id: web
          type: web-client
          label: Panel web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: subida
          type: service
          label: Servicio de subida
          zone: private
          props: { criticality: "medium" }
        - id: cola
          type: queue
          label: Cola de procesamiento
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: generador
          type: worker
          label: Generador de miniaturas
          zone: private
        - id: almacenamiento
          type: object-storage
          label: Almacenamiento de imágenes
          zone: private
      edges:
        - id: usuario-web
          from: { node: usuario }
          to: { node: web }
        - id: web-gw
          from: { node: web }
          to: { node: gw }
        - id: gw-subida
          from: { node: gw }
          to: { node: subida }
        - id: subida-cola
          from: { node: subida }
          to: { node: cola }
        - id: cola-generador
          from: { node: cola }
          to: { node: generador }
        - id: generador-almacenamiento
          from: { node: generador }
          to: { node: almacenamiento }
  - label: cola con DLQ, más un CDN sirviendo el resultado
    contextInversion: cuando las miniaturas se leen mucho más de lo que se generan, un CDN adelante del almacenamiento reduce la carga del propio almacenamiento — vale la pieza extra si la lectura domina sobre la escritura.
    design:
      nodes:
        - id: usuario
          type: actor
          label: Usuario
          zone: public
        - id: web
          type: web-client
          label: Panel web
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: subida
          type: service
          label: Servicio de subida
          zone: private
          props: { criticality: "medium" }
        - id: cola
          type: queue
          label: Cola de procesamiento
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: generador
          type: worker
          label: Generador de miniaturas
          zone: private
        - id: almacenamiento
          type: object-storage
          label: Almacenamiento de imágenes
          zone: private
        - id: cdn
          type: cdn
          label: CDN
          zone: dmz
      edges:
        - id: usuario-web
          from: { node: usuario }
          to: { node: web }
        - id: web-gw
          from: { node: web }
          to: { node: gw }
        - id: gw-subida
          from: { node: gw }
          to: { node: subida }
        - id: subida-cola
          from: { node: subida }
          to: { node: cola }
        - id: cola-generador
          from: { node: cola }
          to: { node: generador }
        - id: generador-almacenamiento
          from: { node: generador }
          to: { node: almacenamiento }
        - id: almacenamiento-cdn
          from: { node: almacenamiento }
          to: { node: cdn }
status: PILOT
---

Una plataforma donde los usuarios suben fotos y el sistema genera
miniaturas automáticamente. En horario pico suben unas **2000 imágenes por
hora**. Entre el 1% y el 3% están corruptas o en un formato que el
generador de miniaturas no reconoce.

Hoy, cuando el procesamiento de una imagen falla, **se queda atascada en la
cola** hasta que la retención la borra sola — nadie la vuelve a mirar, y el
usuario que subió la foto simplemente nunca ve su miniatura, sin ningún
mensaje de error.

El equipo tiene **8 unidades operativas** de presupuesto.

**Armá el sistema** para que la subida no dependa de que el procesamiento
termine en el momento, y para que una imagen que falla el procesamiento
tenga un destino conocido en vez de desaparecer en silencio.
