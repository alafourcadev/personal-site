---
title: "El escaneo que contesta en la cinta"
level: 7
role: tradeoff
domain: logistica
tradeoffPairId: n7-el-trabajo-que-contesta-ahora
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 3
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir cuántos milisegundos tiene el sistema para contestar y qué pasa físicamente cuando no contesta a tiempo. Un diseño sin ese número no se puede defender acá."
lambda: 2.5
constraints:
  - metric: paquetes escaneados por segundo en el pico de la noche
    operator: ">="
    value: 40
    unit: paquetes
  - metric: tiempo disponible entre el escaneo y la boca de salida
    operator: "<="
    value: 400
    unit: milisegundos
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "entre el lector y la boca de salida hay 1,8 metros de cinta a 4,5 metros por segundo: 400 milisegundos. Un paquete al que le contestás tarde no espera: pasa de largo y termina en la rampa de rechazos, que un operario vacía a mano."
    discoveryPath: "preguntá qué pasa físicamente mientras el sistema piensa. En una pantalla, un pedido lento es un usuario esperando; en una cinta, es un paquete que ya se fue."
  - fact: "la rampa de rechazos de la noche pasada tuvo 2.100 paquetes. El operario tarda unos veinte segundos en reubicar cada uno: doce horas de trabajo manual que nadie presupuestó."
    discoveryPath: "seguí qué le pasa al paquete que el sistema no clasificó a tiempo y contá cuánto cuesta. El costo de diferir la respuesta no aparece en la factura de infraestructura: aparece en la nómina del turno noche."
  - fact: "el equipo trajo este diseño del portal mayorista, donde funciona muy bien: el pedido entra en una cola y un procesador de fondo lo resuelve cuando puede. Nadie revisó si el contexto era el mismo."
    discoveryPath: "compará este ejercicio con el otro del par. Mismo equipo, misma empresa, misma forma de resolverlo, y una de las dos veces está mal. La diferencia no está en el diagrama: está en si hay alguien esperando la respuesta."
  - fact: "la tabla de destinos son 240 filas, una por boca de salida, y cambia cuando se reconfigura la planta, dos o tres veces al año. El registro de envíos, en cambio, crece cuarenta filas por segundo y hay que conservarlo cinco años."
    discoveryPath: "separá el dato que se lee todo el tiempo del dato que hay que conservar. Casi nunca son el mismo dato ni quieren la misma pieza."
startingDesign:
  nodes:
    - id: lector
      type: mobile-client
      label: Lector de la cinta
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: despacho
      type: service
      label: Servicio de despacho
      zone: private
      role: despacho-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: cola
      type: queue
      label: Cola de escaneos
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
      position: { x: 805, y: 300 }
    - id: clasificador
      type: worker
      label: Clasificador de fondo
      zone: private
      given: true
      position: { x: 445, y: 410 }
    - id: envios
      type: database
      label: Registro de envíos
      zone: restricted
      role: registro-envios
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 410 }
  edges:
    - id: lector-gw
      from: { node: lector }
      to: { node: gw }
      dataClass: public
    - id: gw-despacho
      from: { node: gw }
      to: { node: despacho }
      dataClass: public
    - id: despacho-cola
      from: { node: despacho }
      to: { node: cola }
      dataClass: public
    - id: cola-clasificador
      from: { node: cola }
      to: { node: clasificador }
      dataClass: public
    - id: clasificador-envios
      from: { node: clasificador }
      to: { node: envios }
      dataClass: public
    - id: despacho-obs
      from: { node: despacho }
      to: { node: obs }
      dataClass: public
    - id: cola-obs
      from: { node: cola }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-respuesta-en-la-misma-llamada
    label: el escaneo se contesta dentro de la misma llamada, sin pasar por ninguna cola
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: despacho-service
        - op: edgeAbsent
          from:
            type: [service, worker]
          to:
            type: [queue, stream]
    whyMissing: no hay camino desde la puerta de entrada hasta el servicio de despacho, o hay un componente entregando el trabajo a una cola en vez de resolverlo en el momento.
    consequence: "una cola es un lugar donde el trabajo espera, y acá no hay nada que pueda esperar: en 400 milisegundos el paquete pasó la boca de salida. El sistema no da error, da tarde, y la diferencia entre las dos cosas la paga un operario vaciando la rampa de rechazos a mano."
  - id: g-destino-en-pieza-rapida
    label: la boca de salida se resuelve contra una pieza barata de leer, no contra el registro de envíos
    weight: 2
    predicate:
      op: path
      from:
        role: despacho-service
      to:
        type: [cache, object-storage]
    whyMissing: el servicio de despacho no tiene de dónde leer la tabla de destinos salvo el registro de envíos.
    consequence: "cuarenta consultas por segundo contra la misma base donde estás escribiendo cuarenta filas por segundo y que ya acumula cinco años de envíos. La tabla de destinos son 240 filas que cambian dos veces al año: buscarlas ahí es pagar el precio de una base grande para leer una lista chica."
  - id: g-envio-registrado
    label: cada escaneo queda escrito en algo que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: despacho-service
      to:
        role: registro-envios
    whyMissing: entre el servicio de despacho y el registro de envíos no queda ninguna pieza que sobreviva a un reinicio, o directamente no hay camino entre los dos.
    consequence: "contestar rápido y no anotar nada es perder la trazabilidad del envío. Cuando el cliente reclama dónde quedó su paquete, la respuesta «pasó por la planta pero no sé por qué boca» no es una respuesta: es un paquete perdido con pasos extra."
  - id: g-despacho-observado
    label: el equipo ve la cinta mientras corre
    weight: 1
    predicate:
      op: covered
      target:
        role: despacho-service
      by:
        type: [observability]
    whyMissing: el servicio de despacho no está conectado a ningún componente de monitoreo.
    consequence: "un sistema que contesta tarde se ve igual que uno que contesta bien hasta que alguien mira la rampa de rechazos. Sin señal en vivo, el aviso llega a las seis de la mañana y son doce horas de trabajo manual."
rubric:
  - dimension: la respuesta vuelve dentro de la llamada que la pidió
    signal:
      kind: predicate
      guaranteeId: g-respuesta-en-la-misma-llamada
  - dimension: el dato que se lee todo el tiempo salió de la base grande
    signal:
      kind: predicate
      guaranteeId: g-destino-en-pieza-rapida
  - dimension: la trazabilidad del envío sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-envio-registrado
  - dimension: la cinta es visible mientras corre
    signal:
      kind: predicate
      guaranteeId: g-despacho-observado
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: un solo servicio con la tabla de destinos en memoria
    contextInversion: "que un solo componente lea la tabla de destinos, conteste la boca de salida y escriba el registro es lo correcto cuando los 400 milisegundos son el requisito duro: cada salto de red que sacás del camino son milisegundos que le devolvés al margen, y con un solo salto el margen es holgado. Tener la tabla en memoria además la deja actualizable en caliente el día que reconfiguran la planta. Se paga con una unidad operativa dedicada a guardar 240 filas, y con que si esa memoria se reinicia, la primera tanda de paquetes se va a rechazos hasta que se vuelva a llenar."
    design:
      nodes:
        - id: lector
          type: mobile-client
          label: Lector de la cinta
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: despacho
          type: service
          label: Servicio de despacho
          zone: private
          role: despacho-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: destinos
          type: cache
          label: Tabla de destinos en memoria
          zone: private
          props: { ttl: "600", eviction: "lru" }
        - id: envios
          type: database
          label: Registro de envíos
          zone: restricted
          role: registro-envios
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-despacho
          from: { node: gw }
          to: { node: despacho }
          dataClass: public
        - id: despacho-destinos
          from: { node: despacho }
          to: { node: destinos }
          dataClass: public
        - id: despacho-envios
          from: { node: despacho }
          to: { node: envios }
          dataClass: public
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
          dataClass: public
  - label: la cinta contesta con un archivo publicado y otro componente escribe el registro
    contextInversion: "separar el componente que contesta la cinta del que escribe el registro es lo correcto cuando la planta corre veinte horas por día y necesitás poder tocar la escritura sin parar la clasificación: podés desplegar, reiniciar o migrar el lado que escribe mientras la cinta sigue contestando con la tabla publicada, que no cuesta ninguna unidad operativa porque es un archivo. Se paga con un salto de red más en el camino del registro, que no está apurado, y con que reconfigurar la planta deja de ser un cambio en caliente y pasa a ser una republicación del archivo."
    design:
      nodes:
        - id: lector
          type: mobile-client
          label: Lector de la cinta
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: despacho
          type: service
          label: Servicio de la cinta
          zone: private
          role: despacho-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: destinos
          type: object-storage
          label: Tabla de destinos publicada
          zone: private
        - id: registrador
          type: service
          label: Servicio de registro de envíos
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: envios
          type: database
          label: Registro de envíos
          zone: restricted
          role: registro-envios
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-despacho
          from: { node: gw }
          to: { node: despacho }
          dataClass: public
        - id: despacho-destinos
          from: { node: despacho }
          to: { node: destinos }
          dataClass: public
        - id: despacho-registrador
          from: { node: despacho }
          to: { node: registrador }
          dataClass: public
        - id: registrador-envios
          from: { node: registrador }
          to: { node: envios }
          dataClass: public
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
          dataClass: public
        - id: registrador-obs
          from: { node: registrador }
          to: { node: obs }
          dataClass: public
status: PILOT
---

La misma empresa de logística, la misma noche, la otra punta de la operación:
la **planta de clasificación**. Cuarenta paquetes por segundo pasan por el
lector, y cada uno tiene que recibir su boca de salida antes de llegar a
ella.

Entre el lector y la boca hay 1,8 metros de cinta a 4,5 metros por segundo.
**Cuatrocientos milisegundos.** No hay nadie mirando una pantalla: hay un
paquete moviéndose.

El equipo trajo acá el diseño que le funciona en el portal mayorista: el
escaneo entra en una cola y un procesador de fondo lo resuelve cuando puede.
La noche pasada la **rampa de rechazos tuvo 2.100 paquetes**, y un operario
tardó doce horas en reubicarlos a mano. El informe decía "hubo demoras". No
hubo demoras: hubo respuestas que llegaron después de que el paquete pasara.

Acá el trabajo no puede esperar en ningún lado, porque **el que espera es un
objeto físico que no frena**. Una cola no absorbe un pico cuando el pico se va
solo por la cinta.

El sistema son seis piezas despiertas y **el presupuesto es cinco**: empezás
debiendo una. Y hay dos datos que conviene separar antes de decidir: la tabla
de destinos son **240 filas** que cambian dos o tres veces al año, y el
registro de envíos crece **cuarenta filas por segundo** y hay que conservarlo
cinco años.

**Rearmá la clasificación para que el escaneo se conteste dentro de la misma
llamada, sin pasarte de cinco unidades operativas y sin dejar de registrar un
solo envío.** Empezá sacando lo que trajiste del otro sistema: acá esa pieza
no es una optimización, es la causa de la rampa.
