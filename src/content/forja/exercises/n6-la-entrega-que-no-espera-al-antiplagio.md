---
title: "La entrega que no espera al antiplagio"
level: 6
role: tradeoff
domain: educacion
tradeoffPairId: resiliencia-aceptar-y-diferir-o-rechazar-en-el-acto
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 1
D7: 3
D8: 1
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué ve el estudiante que sube su trabajo faltando cuatro minutos para el cierre mientras el servicio de similitud está saturado, y cuándo se hace el análisis."
lambda: 0.5
constraints:
  - metric: entregas en la última hora antes del cierre de una materia grande
    operator: ">="
    value: 12000
    unit: entregas/hora
  - metric: entregas rechazadas por tiempo de espera agotado en el cierre de agosto
    operator: ">="
    value: 1900
    unit: entregas
  - metric: horas que puede demorarse el análisis de similitud sin afectar la corrección
    operator: ">="
    value: 48
    unit: horas
hiddenFacts:
  - fact: "el servicio de similitud es un proveedor externo con cuota por minuto. No se cae: cuando lo pasás, encola del lado de él y contesta en 30 o 40 segundos. La plataforma esperaba esa respuesta antes de dar por recibida la entrega."
    discoveryPath: "seguí qué le pasa a la plataforma de entregas cuando el proveedor tarda. Mientras la entrega no se dé por recibida hasta que el análisis conteste, el tiempo del proveedor es el tiempo del estudiante."
  - fact: "la corrección de un trabajo empieza, en el mejor de los casos, tres días después del cierre. El informe de similitud llega a la mesa del docente junto con el trabajo, no antes."
    discoveryPath: "preguntate cuándo se usa de verdad el resultado del análisis. Si el docente lo mira 72 horas después, un rezago de minutos u horas no le cambia nada a nadie."
  - fact: "aceptar una entrega no promete una nota. Si el análisis marca similitud alta, el trabajo sigue el circuito de integridad académica que la facultad ya tiene y que corre por fuera de la plataforma."
    discoveryPath: "está en el enunciado y es lo que hace admisible diferir acá. Fijate qué pasa con el mismo problema cuando aceptar sí compromete algo que después hay que deshacer."
startingDesign:
  nodes:
    - id: estudiante
      type: actor
      label: Estudiante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: campus
      type: web-client
      label: Campus virtual
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: entregas
      type: service
      label: Servicio de entregas
      zone: private
      role: intake-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: base
      type: database
      label: Base de entregas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: similitud
      type: external-provider
      label: Servicio externo de similitud
      zone: dmz
      role: verifier-source
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: estudiante-campus
      from: { node: estudiante }
      to: { node: campus }
      dataClass: public
    - id: campus-gw
      from: { node: campus }
      to: { node: gw }
      dataClass: personal
    - id: gw-entregas
      from: { node: gw }
      to: { node: entregas }
      dataClass: personal
    - id: entregas-base
      from: { node: entregas }
      to: { node: base }
      dataClass: personal
    - id: entregas-similitud
      from: { node: entregas }
      to: { node: similitud }
      dataClass: personal
guarantees:
  - id: g-entrega-no-espera
    label: dar por recibida la entrega no depende de que el servicio de similitud conteste
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: intake-service
      to:
        role: verifier-source
    whyMissing: el servicio de entregas llama directo al servicio de similitud y espera. Todo lo que el proveedor tarde es tiempo que el estudiante mira una barra de progreso a cuatro minutos del cierre.
    consequence: "en el cierre de agosto fueron 1.900 entregas rechazadas por tiempo de espera agotado. No falló el análisis: falló la entrega, que es la única parte del trámite que tiene una fecha límite real."
  - id: g-analisis-no-se-pierde
    label: el análisis llega al servicio de similitud igual, por una pieza que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: intake-service
      to:
        role: verifier-source
    whyMissing: "no hay ninguna pieza durable entre el servicio de entregas y el servicio de similitud. Sacar la llamada del camino del estudiante sin poner nada en el medio no difiere el análisis: lo elimina."
    consequence: recibís las 12.000 entregas y no analizás ninguna. El control de integridad deja de ser un control y pasa a ser una casilla marcada en un informe, que es peor que no tenerlo porque nadie va a volver a mirarlo.
  - id: g-entrega-consultable-sin-el-proveedor
    label: el estudiante puede ver que su entrega quedó registrada sin que el proveedor intervenga
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [database]
      via:
        role: intake-service
      forbid:
        role: verifier-source
    whyMissing: no hay ningún camino desde la puerta de entrada hasta una base que pase por el servicio de entregas y no pase por el proveedor externo, así que el comprobante o depende de la misma pieza que se satura, o sale de una base que nadie escribe.
    consequence: "el estudiante sube el trabajo, no ve confirmación y lo sube otra vez. Al cierre hay tres copias del mismo trabajo y ninguna certeza de cuál llegó primero, que es exactamente la discusión que la fecha límite existía para evitar."
rubric:
  - dimension: la cuota del proveedor no es la fecha límite del estudiante
    signal:
      kind: predicate
      guaranteeId: g-entrega-no-espera
  - dimension: diferir no es cancelar, el análisis sigue ocurriendo
    signal:
      kind: predicate
      guaranteeId: g-analisis-no-se-pierde
  - dimension: el comprobante de la entrega no cuelga de la pieza que se satura
    signal:
      kind: predicate
      guaranteeId: g-entrega-consultable-sin-el-proveedor
referenceSolutions:
  - label: cola de análisis pendientes con un revisor detrás
    contextInversion: "una cola es lo correcto cuando el análisis tiene un solo destino y lo único que importa es que ninguna entrega se quede sin revisar: cada mensaje se toma una vez, se reintenta mientras el proveedor esté en cuota, y el rezago se lee como profundidad de cola. Acá el servicio de entregas asienta el trabajo en la base antes de encolar, así que el estudiante tiene comprobante en el mismo segundo. El costo es que si mañana la secretaría académica quiere reprocesar un cuatrimestre entero con otro proveedor, esos mensajes ya se consumieron y hay que reconstruirlos desde la base."
    design:
      nodes:
        - id: estudiante
          type: actor
          label: Estudiante
          zone: public
        - id: campus
          type: web-client
          label: Campus virtual
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: entregas
          type: service
          label: Servicio de entregas
          zone: private
          role: intake-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: base
          type: database
          label: Base de entregas
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de análisis pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: revisor
          type: worker
          label: Revisor de similitud
          zone: private
        - id: similitud
          type: external-provider
          label: Servicio externo de similitud
          zone: dmz
          role: verifier-source
      edges:
        - id: estudiante-campus
          from: { node: estudiante }
          to: { node: campus }
          dataClass: public
        - id: campus-gw
          from: { node: campus }
          to: { node: gw }
          dataClass: personal
        - id: gw-entregas
          from: { node: gw }
          to: { node: entregas }
          dataClass: personal
        - id: entregas-base
          from: { node: entregas }
          to: { node: base }
          dataClass: personal
        - id: entregas-cola
          from: { node: entregas }
          to: { node: cola }
          dataClass: personal
        - id: cola-revisor
          from: { node: cola }
          to: { node: revisor }
          dataClass: personal
        - id: revisor-similitud
          from: { node: revisor }
          to: { node: similitud }
          dataClass: personal
  - label: registro de entregas con un servicio de similitud propio consumiéndolo
    contextInversion: "un registro de eventos con un servicio dedicado detrás conviene cuando el hecho «se entregó un trabajo» le sirve a más de un lector, como el análisis de similitud, el tablero de la cátedra y la auditoría de la fecha límite, y cuando el análisis deja de ser una tarea de fondo para volverse una pieza con su propio ritmo, su propia cuota y su propia guardia. Acá el servicio de entregas publica y contesta, y quien asienta el resultado en la base es el servicio de similitud. Se paga con una ventana de segundos en la que la entrega ya existe en el registro y todavía no aparece en la consulta del estudiante, y con un registro que hay que dimensionar y retener."
    design:
      nodes:
        - id: estudiante
          type: actor
          label: Estudiante
          zone: public
        - id: campus
          type: web-client
          label: Campus virtual
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: entregas
          type: service
          label: Servicio de entregas
          zone: private
          role: intake-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: stream
          label: Registro de entregas
          zone: private
          props: { retention: "180d", partitions: "6" }
        - id: analisis
          type: service
          label: Servicio de análisis de similitud
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: base
          type: database
          label: Base de entregas
          zone: restricted
          props: { backup: "diario" }
        - id: similitud
          type: external-provider
          label: Servicio externo de similitud
          zone: dmz
          role: verifier-source
      edges:
        - id: estudiante-campus
          from: { node: estudiante }
          to: { node: campus }
          dataClass: public
        - id: campus-gw
          from: { node: campus }
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
        - id: registro-analisis
          from: { node: registro }
          to: { node: analisis }
          dataClass: personal
        - id: analisis-base
          from: { node: analisis }
          to: { node: base }
          dataClass: personal
        - id: analisis-similitud
          from: { node: analisis }
          to: { node: similitud }
          dataClass: personal
status: PILOT
---

Una universidad con **12.000 entregas en la última hora** antes del cierre de una
materia grande. El estudiante sube el trabajo al campus, el servicio de entregas
se lo manda al servicio externo de similitud, espera el informe, y recién
entonces le dice al estudiante que su entrega quedó registrada.

El servicio de similitud no se cae. Tiene **cuota por minuto**: cuando la pasás,
encola del lado de él y contesta en 30 o 40 segundos. En el cierre de agosto eso
alcanzó para **1.900 entregas rechazadas** por tiempo de espera agotado, todas en
los últimos veinte minutos, todas de gente que había terminado a tiempo.

Y acá está el número que decide el ejercicio: la corrección de esos trabajos
empieza, en el mejor de los casos, **tres días después**. El informe de similitud
llega a la mesa del docente junto con el trabajo, no antes. Un rezago de minutos,
o de horas, no le cambia nada a nadie.

Aceptar la entrega, además, no promete una nota. Si el análisis marca similitud
alta, el trabajo entra al circuito de integridad académica que la facultad ya
tiene, con sus plazos y su comisión, por fuera de la plataforma.

Lo único con fecha límite real acá es la entrega.

La secretaria académica lo dijo en la reunión de octubre: *"El chico entregó a
las 23:56. Que el informe salga a las 23:57 o a las 4 de la mañana no me importa.
Que la plataforma le diga que no entregó, sí."*

El equipo tiene **6 unidades operativas** y hoy usa 3.

**Rearmá la plataforma** para que dar por recibida una entrega no dependa del
proveedor externo, para que ninguna entrega se quede sin analizar, y para que el
comprobante que ve el estudiante no cuelgue de la misma pieza que se satura.
