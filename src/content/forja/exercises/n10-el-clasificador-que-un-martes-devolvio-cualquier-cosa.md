---
title: "El clasificador que un martes devolvió cualquier cosa"
level: 10
role: core
domain: seguros
D1: 3
D2: 3
D3: 4
D4: 2
D5: 3
D6: 2
D7: 4
D8: 1
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 8
  monthlyUsd: 500
aiBudget: "libre, pero tu respuesta tiene que decir qué hace el sistema el día que el modelo contesta algo que no está en la lista de categorías, y qué hace el día que no contesta nada."
lambda: 0.5
constraints:
  - metric: "reclamos que entran por día en temporada normal"
    operator: ">="
    value: 2600
    unit: reclamos
  - metric: "reclamos que entran el día después de una tormenta"
    operator: ">="
    value: 31000
    unit: reclamos
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: "el proveedor actualizó la versión del modelo un martes a las 9 de la mañana sin avisar. Durante seis horas devolvió párrafos explicativos en vez de una de las doce categorías."
    discoveryPath: "mirá quién toma la respuesta del modelo hoy y qué hace con ella. Si la pieza que rutea el reclamo lee la salida del modelo directamente, no hay ningún punto del diseño donde alguien pueda decir 'esto no es una de las doce categorías'."
  - fact: "el servicio de validación existe. Se escribió para los formularios del portal viejo, sabe comparar contra una lista cerrada y descartar lo que no encaja."
    discoveryPath: "está en el lienzo sin conexiones. Que valide formularios o que valide la salida de un modelo es el mismo trabajo: comparar contra una lista cerrada."
  - fact: "la mesa de peritos clasificaba estos reclamos a mano hasta 2024 y sigue existiendo con cuatro personas. Cuando entró el modelo, nadie le dejó una entrada."
    discoveryPath: "el equipo de revisión manual está en el lienzo y no recibe nada. Un camino que hoy no existe no se puede usar el día que el modelo falla."
  - fact: "la aseguradora corre el modelo en su propia infraestructura, justamente porque el reclamo trae el nombre, la póliza y las fotos del asegurado."
    discoveryPath: "mirá dónde está alojado el modelo. Esa decisión ya está tomada en este sistema; el problema que quedó abierto es otro."
startingDesign:
  nodes:
    - id: asegurado
      type: actor
      label: "Asegurado"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: "App de la aseguradora"
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
    - id: ingreso
      type: service
      label: "Servicio de ingreso de reclamos"
      zone: private
      role: intake
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: ruteo
      type: service
      label: "Servicio de ruteo a peritaje"
      zone: private
      role: router
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 520 }
    - id: validador
      type: service
      label: "Servicio de validación contra lista cerrada"
      zone: private
      role: validator
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: modelo
      type: ai-model
      label: "Modelo clasificador propio"
      zone: private
      given: true
      props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
      position: { x: 445, y: 630 }
    - id: mesa
      type: worker
      label: "Mesa de peritos"
      zone: private
      given: true
      role: mesa-manual
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 740 }
  edges:
    - id: asegurado-app
      from: { node: asegurado }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-ingreso
      from: { node: gw }
      to: { node: ingreso }
      dataClass: personal
    - id: ingreso-ruteo
      from: { node: ingreso }
      to: { node: ruteo }
      dataClass: personal
    - id: ruteo-modelo
      from: { node: ruteo }
      to: { node: modelo }
      dataClass: personal
guarantees:
  - id: g-salida-revisada
    label: "la respuesta del modelo la recibe la pieza que la compara contra la lista de categorías"
    weight: 3
    predicate:
      op: covered
      target:
        type: [ai-model]
      by:
        role: validator
    whyMissing: "el modelo no está conectado al servicio de validación, así que lo que devuelve entra al sistema tal cual, sin que nadie compare esa respuesta contra las doce categorías que existen."
    consequence: "un martes el proveedor cambió de versión y durante seis horas el modelo devolvió párrafos en vez de categorías. 4.000 reclamos quedaron etiquetados con algo que no existe en el sistema y ninguna cola de peritaje los levantó. Nadie se enteró hasta el jueves."
  - id: g-el-modelo-sigue-en-el-circuito
    label: "el reclamo que entra llega a ser clasificado por el modelo"
    weight: 2
    predicate:
      op: path
      from:
        role: intake
      to:
        type: [ai-model]
    whyMissing: "no hay ningún camino desde el ingreso del reclamo hasta el modelo clasificador."
    consequence: "sin clasificación automática, los 31.000 reclamos del día después de una tormenta vuelven a la mesa de cuatro personas. El modelo no es un adorno: es lo que hace que el volumen entre."
  - id: g-camino-que-no-depende-del-modelo
    label: "hay un camino desde el reclamo hasta la mesa de peritos que no pasa por el modelo"
    weight: 3
    predicate:
      op: path
      from:
        role: intake
      to:
        role: mesa-manual
      forbid:
        type: [ai-model]
    whyMissing: "todo camino desde el ingreso hasta la mesa de peritos atraviesa el modelo, o directamente no existe."
    consequence: "el día que el modelo devuelve cualquier cosa, o no devuelve nada, no hay a dónde mandar el reclamo. Un sistema que sólo funciona cuando el modelo funciona no es un sistema con un modelo adentro: es un modelo con una interfaz alrededor."
  - id: g-el-ruteo-no-lee-la-salida-cruda
    label: "la pieza que decide a dónde va el reclamo no le pregunta al modelo"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: router
      to:
        type: [ai-model]
    whyMissing: "el servicio de ruteo está conectado directo al modelo, así que toma como categoría lo primero que le devuelvan."
    consequence: "quien decide tiene que decidir sobre un dato de forma conocida. Mientras el ruteo lea la salida cruda, cada cambio de versión del proveedor es un cambio de comportamiento en el negocio que nadie aprobó."
  - id: g-el-reclamo-clasificado-llega-al-ruteo
    label: "el reclamo llega a la pieza que lo manda al área de peritaje"
    weight: 2
    predicate:
      op: path
      from:
        role: intake
      to:
        role: router
    whyMissing: "no hay ningún camino desde el ingreso del reclamo hasta el servicio de ruteo a peritaje."
    consequence: "clasificar sin rutear no sirve de nada: la categoría queda anotada y el reclamo se queda quieto. El ruteo es la pieza que convierte una etiqueta en trabajo asignado a un perito, y sacarla del camino es la forma más rápida de que 2.600 reclamos por día no lleguen a ninguna parte."
rubric:
  - dimension: "nada de lo que devuelve el modelo entra sin revisar"
    signal:
      kind: predicate
      guaranteeId: g-salida-revisada
  - dimension: "el volumen sigue entrando por la clasificación automática"
    signal:
      kind: predicate
      guaranteeId: g-el-modelo-sigue-en-el-circuito
  - dimension: "el sistema sigue funcionando con el modelo apagado"
    signal:
      kind: predicate
      guaranteeId: g-camino-que-no-depende-del-modelo
  - dimension: "la decisión de negocio no depende de la versión del proveedor"
    signal:
      kind: predicate
      guaranteeId: g-el-ruteo-no-lee-la-salida-cruda
  - dimension: "el reclamo termina asignado a un área, no sólo etiquetado"
    signal:
      kind: predicate
      guaranteeId: g-el-reclamo-clasificado-llega-al-ruteo
referenceSolutions:
  - label: "el validador en el camino y la mesa como salida directa"
    contextInversion: "clasificar dentro de la misma llamada conviene cuando el asegurado tiene que ver en la app, antes de cerrar el reclamo, a qué área fue: el reclamo entra, se clasifica y se rutea de corrido. La mesa de peritos cuelga del ingreso, así que el reclamo que el validador descarta llega a una persona el mismo día. Se paga con que el pico de una tormenta le pega directo al modelo, sin nada que absorba la diferencia de ritmo."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: "Asegurado"
          zone: public
        - id: app
          type: mobile-client
          label: "App de la aseguradora"
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: ingreso
          type: service
          label: "Servicio de ingreso de reclamos"
          zone: private
          role: intake
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: validador
          type: service
          label: "Servicio de validación contra lista cerrada"
          zone: private
          role: validator
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo clasificador propio"
          zone: private
          props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
        - id: ruteo
          type: service
          label: "Servicio de ruteo a peritaje"
          zone: private
          role: router
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: mesa
          type: worker
          label: "Mesa de peritos"
          zone: private
          role: mesa-manual
          props: { idempotent: "sí", retryPolicy: "exponential" }
      edges:
        - id: asegurado-app
          from: { node: asegurado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-ingreso
          from: { node: gw }
          to: { node: ingreso }
          dataClass: personal
        - id: ingreso-validador
          from: { node: ingreso }
          to: { node: validador }
          dataClass: personal
        - id: validador-modelo
          from: { node: validador }
          to: { node: modelo }
          dataClass: personal
        - id: validador-ruteo
          from: { node: validador }
          to: { node: ruteo }
          dataClass: personal
        - id: ingreso-mesa
          from: { node: ingreso }
          to: { node: mesa }
          dataClass: personal
  - label: "una cola que alimenta las dos vías"
    contextInversion: "poner una cola entre el ingreso y la clasificación conviene cuando el volumen es el enemigo: el día después de una tormenta entran 31.000 reclamos y el modelo tiene un límite de llamadas por minuto que no se negocia. Con la cola, el pico se convierte en demora y no en pérdida, y la mesa de peritos toma trabajo de la misma cola en vez de depender de que alguien la avise. Se paga con una pieza más para operar y con que el asegurado ya no ve el área asignada en el momento de cerrar el reclamo."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: "Asegurado"
          zone: public
        - id: app
          type: mobile-client
          label: "App de la aseguradora"
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: ingreso
          type: service
          label: "Servicio de ingreso de reclamos"
          zone: private
          role: intake
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: "Cola de reclamos por clasificar"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: validador
          type: service
          label: "Servicio de validación contra lista cerrada"
          zone: private
          role: validator
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo clasificador propio"
          zone: private
          props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
        - id: ruteo
          type: service
          label: "Servicio de ruteo a peritaje"
          zone: private
          role: router
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: mesa
          type: worker
          label: "Mesa de peritos"
          zone: private
          role: mesa-manual
          props: { idempotent: "sí", retryPolicy: "exponential" }
      edges:
        - id: asegurado-app
          from: { node: asegurado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-ingreso
          from: { node: gw }
          to: { node: ingreso }
          dataClass: personal
        - id: ingreso-cola
          from: { node: ingreso }
          to: { node: cola }
          dataClass: personal
        - id: cola-validador
          from: { node: cola }
          to: { node: validador }
          dataClass: personal
        - id: validador-modelo
          from: { node: validador }
          to: { node: modelo }
          dataClass: personal
        - id: validador-ruteo
          from: { node: validador }
          to: { node: ruteo }
          dataClass: personal
        - id: cola-mesa
          from: { node: cola }
          to: { node: mesa }
          dataClass: personal
status: PILOT
---

Una aseguradora recibe **2.600 reclamos por día** en temporada normal y
**31.000** el día después de una tormenta. Cada reclamo entra por la app con
fotos y un texto libre del asegurado, y hay que mandarlo a una de **doce
categorías** de peritaje: granizo, incendio, robo, daños por agua, y así.

Hasta 2024 lo hacía a mano una mesa de cuatro peritos. Desde 2024 lo hace un
modelo que la aseguradora corre en su propia infraestructura. Esa decisión ya
se tomó, y se tomó porque el reclamo trae el nombre, la póliza y las fotos del
asegurado. Funcionó dieciocho meses.

El **martes 4 a las 9 de la mañana** el proveedor actualizó la versión del
modelo sin avisar. En vez de devolver una de las doce categorías, empezó a
devolver párrafos: *"Este reclamo parece corresponder a un daño por
granizo, aunque también podría..."*. El servicio de ruteo tomó ese párrafo
como categoría y lo escribió en el reclamo.

**4.000 reclamos** quedaron con una categoría que no existe. Ninguna cola de
peritaje los levantó porque ninguna cola de peritaje se llama así. Nadie se
enteró hasta el jueves, cuando un asegurado llamó preguntando por qué nadie lo
había contactado. Cuarenta y ocho horas de reclamos parados y una multa del
ente por incumplimiento de plazos.

En el lienzo hay dos piezas que este flujo no usa. El **servicio de validación
contra lista cerrada**, escrito para los formularios del portal viejo, que sabe
comparar una respuesta contra una lista y descartar lo que no encaja. Y la
**mesa de peritos**, que sigue existiendo con cuatro personas y a la que nadie
le dejó una entrada cuando entró el modelo.

El equipo tiene un techo de **8 unidades operativas**.

**Rearmá el sistema** para que ninguna respuesta del modelo entre al negocio
sin haber sido comparada contra las doce categorías, y para que el día que el
modelo devuelva cualquier cosa, o no devuelva nada, el reclamo tenga a dónde
ir.
