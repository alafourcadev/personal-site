---
title: "El cobro que espera al antifraude"
level: 6
role: core
domain: pagos
D1: 2
D2: 2
D3: 2
D4: 1
D5: 2
D6: 2
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué le pasa a una compra concreta mientras el antifraude no contesta: si se cobra, si se rechaza, y en qué estado queda anotada."
lambda: 0.5
constraints:
  - metric: compras por hora en horario pico
    operator: ">="
    value: 2600
    unit: compras/hora
  - metric: compras que el antifraude marca como sospechosas
    operator: "<="
    value: 4
    unit: por mil
  - metric: presupuesto operativo del equipo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el antifraude no se cae: se pone lento. En el incidente de mayo su tiempo de respuesta pasó de 300 milisegundos a 26 segundos durante 40 minutos, y el servicio de cobros se quedó esperando en cada compra hasta agotar sus conexiones."
    discoveryPath: "seguí qué pasa en el servicio de cobros si la pieza que está del otro lado tarda. Mientras haya una llamada directa desde el cobro al antifraude, el tiempo del antifraude es el tiempo del cobro."
  - fact: "996 de cada 1.000 compras el antifraude las aprueba. Las 4 restantes se revisan y, si hay que revertir, se revierte: el negocio ya opera devoluciones todos los días."
    discoveryPath: "es el número que decide el ejercicio. Si casi todas las compras se aprueban, esperar la respuesta antes de cobrar es pagar el peor caso en el 99,6 % de los casos donde no hacía falta."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la tienda
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: cobros
      type: service
      label: Servicio de cobros
      zone: private
      role: payment-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: base
      type: database
      label: Base de cobros
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: antifraude
      type: external-provider
      label: Antifraude del proveedor de tarjetas
      zone: dmz
      role: fraud-provider
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: comprador-app
      from: { node: comprador }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-cobros
      from: { node: gw }
      to: { node: cobros }
      dataClass: personal
    - id: cobros-base
      from: { node: cobros }
      to: { node: base }
      dataClass: personal
    - id: cobros-antifraude
      from: { node: cobros }
      to: { node: antifraude }
      dataClass: personal
guarantees:
  - id: g-cobro-no-espera
    label: el cobro no le pide permiso al antifraude en el mismo pedido del comprador
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: payment-service
      to:
        role: fraud-provider
    whyMissing: el servicio de cobros llama directo al antifraude. Todo el tiempo que tarde el antifraude es tiempo que el comprador espera y conexiones del servicio de cobros ocupadas.
    consequence: "cuando el antifraude pasa de 300 milisegundos a 26 segundos, no se degrada la revisión: se cae el cobro entero. En mayo fueron 40 minutos sin cobrar nada, con el antifraude respondiendo todo el tiempo."
  - id: g-revision-no-se-pierde
    label: la revisión llega al antifraude igual, por una pieza que sobrevive un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: payment-service
      to:
        role: fraud-provider
    whyMissing: "no hay ninguna pieza durable entre el servicio de cobros y el antifraude. Sacar la llamada del camino del comprador sin poner nada en el medio no aísla el fallo: elimina la revisión."
    consequence: cobrás las 2.600 compras por hora y no revisás ninguna. El fraude deja de ser un riesgo controlado y pasa a ser una pérdida que se descubre en la conciliación del mes siguiente.
  - id: g-estado-asentado
    label: el cobro queda asentado con su estado antes de que el antifraude opine
    weight: 1
    predicate:
      op: path
      from:
        role: payment-service
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de cobros hasta una base, así que no queda registro de que hay un cobro hecho con la revisión pendiente.
    consequence: si la revisión nunca vuelve, nadie puede decir qué compras quedaron sin revisar. La lista de lo pendiente vive en la memoria de un proceso, y ahí no se puede consultar ni reclamar.
rubric:
  - dimension: el tiempo del tercero no es el tiempo del comprador
    signal:
      kind: predicate
      guaranteeId: g-cobro-no-espera
  - dimension: aislar el fallo no es borrar la función que fallaba
    signal:
      kind: predicate
      guaranteeId: g-revision-no-se-pierde
  - dimension: el estado intermedio "cobrado, revisión pendiente" existe en algún lado consultable
    signal:
      kind: predicate
      guaranteeId: g-estado-asentado
referenceSolutions:
  - label: cola de revisiones con un revisor detrás
    contextInversion: "una cola es lo correcto cuando la revisión tiene un solo consumidor y lo único que importa es que ninguna compra se quede sin revisar: cada mensaje se toma una vez, se reintenta si falla y el rezago se ve como profundidad de cola. El costo es que si mañana alguien más necesita el mismo evento de compra (analítica de riesgo, por ejemplo) hay que republicarlo, porque una cola consumida no se vuelve a leer."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: app
          type: mobile-client
          label: App de la tienda
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobros
          type: service
          label: Servicio de cobros
          zone: private
          role: payment-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: base
          type: database
          label: Base de cobros
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de revisiones pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: revisor
          type: worker
          label: Revisor de riesgo
          zone: private
        - id: antifraude
          type: external-provider
          label: Antifraude del proveedor de tarjetas
          zone: dmz
          role: fraud-provider
      edges:
        - id: comprador-app
          from: { node: comprador }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobros
          from: { node: gw }
          to: { node: cobros }
          dataClass: personal
        - id: cobros-base
          from: { node: cobros }
          to: { node: base }
          dataClass: personal
        - id: cobros-cola
          from: { node: cobros }
          to: { node: cola }
          dataClass: personal
        - id: cola-revisor
          from: { node: cola }
          to: { node: revisor }
          dataClass: personal
        - id: revisor-antifraude
          from: { node: revisor }
          to: { node: antifraude }
          dataClass: personal
  - label: registro de compras, y el revisor también asienta el resultado
    contextInversion: "un registro de eventos conviene cuando el hecho «se cobró» le sirve a más de un lector y cuando querés poder volver a pasar un rango entero de compras por el antifraude después de un incidente, sin pedirle nada al comprador. Acá además el servicio de cobros no escribe la base: publica el hecho y contesta, y quien asienta el estado final es el mismo revisor. Se paga con un camino más largo hasta que el cobro es consultable, porque hay una ventana de segundos donde el cobro existe en el registro y todavía no en la base, y con un registro que hay que dimensionar y retener."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: app
          type: mobile-client
          label: App de la tienda
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobros
          type: service
          label: Servicio de cobros
          zone: private
          role: payment-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: stream
          label: Registro de compras cobradas
          zone: private
          props: { retention: "14d", partitions: "6" }
        - id: revisor
          type: worker
          label: Revisor de riesgo
          zone: private
        - id: base
          type: database
          label: Base de cobros
          zone: restricted
          props: { backup: "diario" }
        - id: antifraude
          type: external-provider
          label: Antifraude del proveedor de tarjetas
          zone: dmz
          role: fraud-provider
      edges:
        - id: comprador-app
          from: { node: comprador }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobros
          from: { node: gw }
          to: { node: cobros }
          dataClass: personal
        - id: cobros-registro
          from: { node: cobros }
          to: { node: registro }
          dataClass: personal
        - id: registro-revisor
          from: { node: registro }
          to: { node: revisor }
          dataClass: personal
        - id: revisor-base
          from: { node: revisor }
          to: { node: base }
          dataClass: personal
        - id: revisor-antifraude
          from: { node: revisor }
          to: { node: antifraude }
          dataClass: personal
status: PILOT
---

Una tienda que cobra **2.600 compras por hora** en horario pico. Antes de
confirmar cada cobro, el servicio de cobros le pregunta al antifraude del
proveedor de tarjetas si la operación es sospechosa, y espera la respuesta.

En mayo el antifraude no se cayó. Se puso lento: pasó de 300 milisegundos a
**26 segundos** durante 40 minutos. El servicio de cobros se quedó esperando
en cada compra hasta agotar sus conexiones, y durante esos 40 minutos la
tienda no cobró nada. Ni las compras sospechosas ni las otras.

Ese "las otras" es el número que importa: el antifraude aprueba **996 de cada
1.000** compras. Cuatro por mil se revisan a mano y, si hay que revertir, se
revierte. El negocio ya opera devoluciones todos los días.

Así que el equipo esperó el peor caso en el 99,6 % de los casos donde no
hacía falta, y cuando el peor caso llegó, se llevó puesto el cobro entero.

El dueño de producto pide dos cosas que parecen opuestas: **que el cobro no
dependa del antifraude para responderle al comprador**, y **que ninguna
compra se quede sin revisar**. Sacar la llamada y listo resuelve la primera
rompiendo la segunda.

El equipo tiene **6 unidades operativas** y hoy usa 3.

**Rearmá el sistema** para que la lentitud del antifraude sea un rezago en la
revisión y no una caída del cobro, y para que quede constancia de qué compras
tienen la revisión pendiente.
