---
title: "La señal que hay que poder revisar en marzo"
level: 5
role: tradeoff
domain: marketplace
tradeoffPairId: operacion-camino-de-la-senal
D1: 2
D2: 3
D3: 2
D4: 1
D5: 2
D6: 2
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 7
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá la señal pasa por un buffer antes de llegar al archivo, y por qué eso sería un error en el ejercicio anterior."
lambda: 0.5
constraints:
  - metric: eventos de checkout generados por día
    operator: ">="
    value: 40000000
    unit: eventos/día
  - metric: retención exigida por la auditoría anual
    operator: ">="
    value: 13
    unit: meses
hiddenFacts:
  - fact: escribir los 40 millones de eventos directamente desde el checkout al archivo puso la latencia de compra en 1,9 segundos el día que el almacenamiento tuvo un pico de escritura.
    discoveryPath: "es la razón por la que el archivo no puede estar colgado del camino del comprador: una escritura lenta del archivo se convierte en un checkout lento. El buffer es lo que corta esa cadena."
  - fact: el archivo existe hace seis meses y está vacío. Lo creó alguien que se fue del equipo y nadie escribió nunca en él.
    discoveryPath: "está en el lienzo desde el principio, sin ninguna conexión entrante. Un destino que nadie usa no protege nada, y es el error que este ejercicio pide corregir."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Tienda online
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: checkout
      type: service
      label: Servicio de checkout
      zone: private
      role: checkout-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: pedidos
      type: database
      label: Base de pedidos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: archivo
      type: object-storage
      label: Archivo de eventos
      zone: private
      role: archive
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: comprador-web
      from: { node: comprador }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-checkout
      from: { node: gw }
      to: { node: checkout }
      dataClass: personal
    - id: checkout-pedidos
      from: { node: checkout }
      to: { node: pedidos }
      dataClass: personal
guarantees:
  - id: g-buffered-trail
    label: los eventos llegan al archivo pasando por un buffer que absorbe el volumen
    weight: 2
    predicate:
      op: path
      from:
        role: checkout-service
      to:
        role: archive
      via:
        type: [queue, stream]
    whyMissing: no hay un camino desde el servicio de checkout hasta el archivo que pase por una cola o por un registro de eventos.
    consequence: el archivo queda colgado del camino del comprador. Una escritura lenta del almacenamiento se convierte en un checkout lento (1,9 segundos el día del pico) y si el archivo no responde, la compra falla por una razón que no tiene nada que ver con la compra.
  - id: g-buffer-observed
    label: alguien mira cuánto trabajo se está acumulando en ese buffer
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza que absorbe el volumen de eventos no está conectada a ningún componente de monitoreo.
    consequence: "los mensajes se acumulan hasta llenar la retención y después se descartan. El sistema parece funcionar: nadie ve el error hasta que en marzo falta el dato que la auditoría pide."
rubric:
  - dimension: el archivo no está en el camino crítico de la compra
    signal:
      kind: predicate
      guaranteeId: g-buffered-trail
  - dimension: la acumulación de eventos pendientes es visible antes de que la retención los borre
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
referenceSolutions:
  - label: cola y archivador
    contextInversion: "una cola con un solo archivador es lo correcto cuando el único consumidor del evento es el archivo: la cola entrega, el archivador escribe y el mensaje se va. Es la topología más barata de operar que corta la dependencia entre el comprador y el almacenamiento. Se pierde la posibilidad de que otro proceso lea el mismo evento sin coordinarse con este."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: checkout
          type: service
          label: Servicio de checkout
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de eventos de checkout
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: archivador
          type: worker
          label: Archivador de eventos
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo de eventos
          zone: private
          role: archive
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-web
          from: { node: comprador }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-cola
          from: { node: checkout }
          to: { node: cola }
          dataClass: personal
        - id: cola-archivador
          from: { node: cola }
          to: { node: archivador }
          dataClass: personal
        - id: archivador-archivo
          from: { node: archivador }
          to: { node: archivo }
          dataClass: personal
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: checkout-monitoreo
          from: { node: checkout }
          to: { node: monitoreo }
          dataClass: public
        - id: archivador-monitoreo
          from: { node: archivador }
          to: { node: monitoreo }
          dataClass: public
  - label: registro de eventos con archivado y vigilancia de fraude
    contextInversion: "un registro releíble con dos consumidores conviene cuando el mismo evento le sirve a más de un destino: uno lo archiva para la auditoría de marzo y otro busca patrones de fraude en el momento, cada uno con su propia posición de lectura y su propio ritmo. Se paga con una unidad operativa más, y con la obligación de mirar dos consumidores en vez de uno."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: app
          type: mobile-client
          label: App de compras
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: checkout
          type: service
          label: Servicio de checkout
          zone: private
          role: checkout-service
          props: { criticality: "high", replicas: "2" }
        - id: pedidos
          type: database
          label: Base de pedidos
          zone: restricted
          props: { backup: "diario" }
        - id: eventos
          type: stream
          label: Registro de eventos de checkout
          zone: private
          props: { retention: "7d", partitions: "24" }
        - id: archivador
          type: worker
          label: Archivador de eventos
          zone: private
        - id: vigilante
          type: worker
          label: Vigilancia de fraude
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo de eventos
          zone: private
          role: archive
        - id: antifraude
          type: external-provider
          label: Proveedor antifraude
          zone: dmz
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: comprador-app
          from: { node: comprador }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkout
          from: { node: gw }
          to: { node: checkout }
          dataClass: personal
        - id: checkout-pedidos
          from: { node: checkout }
          to: { node: pedidos }
          dataClass: personal
        - id: checkout-eventos
          from: { node: checkout }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-archivador
          from: { node: eventos }
          to: { node: archivador }
          dataClass: personal
        - id: archivador-archivo
          from: { node: archivador }
          to: { node: archivo }
          dataClass: personal
        - id: eventos-vigilante
          from: { node: eventos }
          to: { node: vigilante }
          dataClass: personal
        - id: vigilante-antifraude
          from: { node: vigilante }
          to: { node: antifraude }
          dataClass: personal
        - id: eventos-monitoreo
          from: { node: eventos }
          to: { node: monitoreo }
          dataClass: public
        - id: checkout-monitoreo
          from: { node: checkout }
          to: { node: monitoreo }
          dataClass: public
        - id: archivador-monitoreo
          from: { node: archivador }
          to: { node: monitoreo }
          dataClass: public
        - id: vigilante-monitoreo
          from: { node: vigilante }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

El mismo marketplace, el mismo servicio de checkout. Pero la pregunta de
este ejercicio no es cuándo se entera la guardia: es **qué se puede
reconstruir seis meses después**.

El checkout genera **40 millones de eventos por día**. La auditoría anual,
que cae en marzo, pide poder reconstruir cualquier compra de los
**últimos 13 meses**: qué se cobró, con qué precio, con qué descuento
aplicado y en qué orden pasaron las cosas. El año pasado el equipo tardó
tres semanas en responder nueve preguntas, reconstruyendo a mano desde la
base de pedidos, que guarda el estado final y no la historia.

Hay un archivo de eventos creado hace seis meses. **Está vacío.** Lo creó
alguien que ya no está en el equipo y nadie escribió nunca en él.

La primera versión de la solución fue la obvia: que el checkout escriba
cada evento en el archivo. Duró un día. El almacenamiento tuvo un pico de
escritura y **la latencia de compra saltó a 1,9 segundos**, porque el
archivo quedó colgado del camino del comprador. Una escritura lenta del
archivo es un checkout lento; un archivo caído es una compra que falla por
una razón que no tiene nada que ver con la compra.

Acá el equipo acepta el precio contrario al del ejercicio anterior, y
también con los ojos abiertos: **entre el hecho y el archivo va a haber un
intermediario**, así que el dato llega con retraso y con la posibilidad de
acumularse. Vale la pena, porque el valor de esta señal no vence en 60
segundos: vence en 13 meses, y lo único que no se perdona es que falte.

Ese intermediario, eso sí, es una pieza más que se puede llenar en
silencio. Si nadie mira cuánto se acumula, la retención se vence y los
eventos se descartan sin un solo error en ningún registro. El agujero
aparece en marzo, delante del auditor.

**Armá el sistema** para que los eventos lleguen al archivo pasando por un
buffer que absorba el volumen, y para que la acumulación en ese buffer sea
una señal que alguien mira.
