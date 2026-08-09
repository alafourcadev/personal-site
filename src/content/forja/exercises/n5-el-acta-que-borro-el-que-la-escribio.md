---
title: "El acta que borró el que la escribió"
level: 5
role: core
domain: gobierno
D1: 2
D2: 2
D3: 3
D4: 2
D5: 2
D6: 2
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir quién escribe la copia y por qué no puede ser el mismo proceso que puede borrar el original."
lambda: 0.5
constraints:
  - metric: actas inscriptas por mes
    operator: ">="
    value: 11400
    unit: actas/mes
  - metric: años que el archivo provincial exige conservar cada acta
    operator: ">="
    value: 100
    unit: años
hiddenFacts:
  - fact: "el borrado de agosto no vino de afuera: fue una rutina de depuración del propio servicio de actas, escrita para limpiar borradores, que tomó 1.240 actas firmadas por un filtro mal armado."
    discoveryPath: "mirá quién tiene permiso de escribir en cada destino. Si el proceso que borra y el que copia son el mismo, la copia hereda el error del borrado y llega corrompida a los dos lados."
  - fact: la rutina corrió a las 03:00 y la exportación al archivo corría a las 03:20, en el mismo proceso. Las 1.240 actas ya estaban borradas cuando le tocó copiarlas.
    discoveryPath: "seguí el orden en que un acta toca cada pieza. Si la copia se hace después, dentro del mismo proceso, no hay copia: hay una segunda oportunidad de propagar lo que ya salió mal."
startingDesign:
  nodes:
    - id: ciudadano
      type: actor
      label: Ciudadano
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de trámites
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: actas
      type: service
      label: Servicio de actas
      zone: private
      role: actas
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: baseactas
      type: database
      label: Base del registro
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: ciudadano-portal
      from: { node: ciudadano }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-actas
      from: { node: gw }
      to: { node: actas }
      dataClass: regulated
    - id: actas-baseactas
      from: { node: actas }
      to: { node: baseactas }
      dataClass: regulated
guarantees:
  - id: g-copy-outside
    label: existe una copia del acta fuera de la base del registro
    weight: 2
    predicate:
      op: path
      from:
        role: actas
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de actas hasta un almacenamiento de objetos, así que el único lugar donde existe un acta inscripta es la base del registro.
    consequence: una rutina de depuración mal filtrada, una migración apurada o una tabla truncada se llevan el acta y no queda nada que consultar. La reconstrucción se hace con los libros de papel del juzgado, si el juzgado los tiene.
  - id: g-copy-not-by-the-writer
    label: la copia no la escribe el mismo proceso que puede borrar el original
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: actas
      to:
        type: [object-storage]
    whyMissing: el servicio de actas escribe la copia él mismo, así que el proceso que tiene permiso para borrar un acta es también el que decide qué se copia y cuándo.
    consequence: "en agosto la rutina de depuración borró primero y copió después, dentro del mismo proceso. El error no se detuvo en la base: se propagó a la copia con la misma pasada. Dos destinos no son dos copias si un solo proceso los escribe a los dos."
  - id: g-registry-store
    label: el registro sigue siendo consultable por número, apellido y fecha
    weight: 1
    predicate:
      op: path
      from:
        role: actas
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de actas hasta una base de datos.
    consequence: un archivo de objetos devuelve un acta entera cuando ya sabés cuál querés. No busca por apellido, no filtra por año y no sostiene los 340 trámites diarios del mostrador. Si el archivo reemplaza al registro, el empleado deja de poder trabajar aunque el dato esté intacto.
  - id: g-services-observed
    label: todos los servicios del sistema reportan lo que les pasa
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: "el borrado de agosto tardó once días en aparecer, y apareció porque un ciudadano vino al mostrador a pedir su acta. El tiempo de detección pasa a ser el tiempo que tarda alguien en enojarse."
rubric:
  - dimension: el acta existe en más de un lugar
    signal:
      kind: predicate
      guaranteeId: g-copy-outside
  - dimension: quien puede borrar el original no es quien escribe la copia
    signal:
      kind: predicate
      guaranteeId: g-copy-not-by-the-writer
  - dimension: la copia se suma al registro consultable en vez de reemplazarlo
    signal:
      kind: predicate
      guaranteeId: g-registry-store
  - dimension: el equipo detecta la falla antes que el mostrador
    signal:
      kind: predicate
      guaranteeId: g-services-observed
referenceSolutions:
  - label: una cola y un archivador aparte
    contextInversion: "poner una cola entre el servicio y el archivador es lo correcto cuando el acta tiene que quedar copiada aunque el archivador esté caído en ese momento: el pendiente vive en la cola, el archivador lo toma cuando vuelve, y una falla del archivado no toca el trámite del ciudadano. Además el archivador es un proceso distinto, con sus propias credenciales: no tiene permiso para borrar nada en el registro, y esa asimetría es la que hace que la copia sea una copia. Se paga con dos piezas más para operar, que en este presupuesto es todo el margen que había."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: portal
          type: web-client
          label: Portal de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: actas
          type: service
          label: Servicio de actas
          zone: private
          role: actas
          props: { criticality: "high", replicas: "2" }
        - id: baseactas
          type: database
          label: Base del registro
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de actas por copiar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: archivador
          type: worker
          label: Archivador de actas
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo del registro
          zone: private
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: ciudadano-portal
          from: { node: ciudadano }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-actas
          from: { node: gw }
          to: { node: actas }
          dataClass: regulated
        - id: actas-baseactas
          from: { node: actas }
          to: { node: baseactas }
          dataClass: regulated
        - id: actas-cola
          from: { node: actas }
          to: { node: cola }
          dataClass: regulated
        - id: cola-archivador
          from: { node: cola }
          to: { node: archivador }
          dataClass: regulated
        - id: archivador-archivo
          from: { node: archivador }
          to: { node: archivo }
          dataClass: regulated
        - id: actas-monitoreo
          from: { node: actas }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: baseactas-monitoreo
          from: { node: baseactas }
          to: { node: monitoreo }
          dataClass: public
  - label: el archivador recibe el acta de la mano del servicio
    contextInversion: "pasarle el acta directamente al archivador es lo correcto cuando el volumen es de 11.400 actas por mes, unas sesenta y cinco por hora en horario de mesa de entradas, y el equipo prefiere una pieza menos que operar antes que un pendiente que puede acumularse sin que nadie lo mire. La separación de permisos, que es lo que este ejercicio protege, se conserva entera: el archivador sigue siendo otro proceso y sigue sin poder borrar en el registro. Lo que se pierde es el pendiente: si el archivador no está en el momento en que se inscribe el acta, esa copia no ocurre y no hay dónde reclamarla. Se gana una unidad operativa de margen, que en un equipo de dos personas es la diferencia entre poder agregar algo el año que viene y no poder."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: portal
          type: web-client
          label: Portal de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: actas
          type: service
          label: Servicio de actas
          zone: private
          role: actas
          props: { criticality: "high", replicas: "2" }
        - id: baseactas
          type: database
          label: Base del registro
          zone: restricted
          props: { backup: "diario" }
        - id: archivador
          type: worker
          label: Archivador de actas
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo del registro
          zone: private
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: ciudadano-portal
          from: { node: ciudadano }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-actas
          from: { node: gw }
          to: { node: actas }
          dataClass: regulated
        - id: actas-baseactas
          from: { node: actas }
          to: { node: baseactas }
          dataClass: regulated
        - id: actas-archivador
          from: { node: actas }
          to: { node: archivador }
          dataClass: regulated
        - id: archivador-archivo
          from: { node: archivador }
          to: { node: archivo }
          dataClass: regulated
        - id: actas-monitoreo
          from: { node: actas }
          to: { node: monitoreo }
          dataClass: public
        - id: archivador-monitoreo
          from: { node: archivador }
          to: { node: monitoreo }
          dataClass: public
        - id: baseactas-monitoreo
          from: { node: baseactas }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Un Registro Civil provincial inscribe **11.400 actas por mes**. El acta de
nacimiento de una persona tiene que seguir existiendo dentro de **cien
años**: no es una meta del equipo, es la ley que crea la oficina.

Todo vive en una sola base. El proveedor hace su copia nocturna y el
equipo, que son dos personas, duerme con eso.

El 12 de agosto, a las 03:00, corrió una rutina de depuración escrita seis
meses antes para limpiar borradores abandonados. El filtro estaba mal
armado y tomó **1.240 actas ya firmadas**. A las 03:20, en el mismo
proceso, corrió la exportación al archivo provincial: copió lo que había
en la base, que ya no incluía esas 1.240.

Ese es el punto del ejercicio, y no es "hacé una copia". El equipo **tenía**
una copia. Lo que no tenía era una copia que un error del servicio de actas
no pudiera alcanzar. **El proceso que puede borrar un acta no puede ser el
mismo que decide qué se copia**: si lo es, un solo error escribe dos veces
la misma pérdida y el sistema informa que todo salió bien.

El equipo se enteró **once días después**, cuando un ciudadano vino al
mostrador a pedir su acta y no estaba. No hubo un error en ningún registro:
hubo ausencia.

El equipo tiene **6 unidades operativas** y hoy usa 3.

**Rearmá el sistema** para que el acta exista fuera de la base del
registro, para que esa copia la escriba un proceso distinto del que puede
borrar el original, y para que la próxima vez el equipo se entere antes que
el mostrador. El registro tiene que seguir siendo consultable: los 340
trámites diarios se buscan por apellido y por año, y eso un archivo no lo
hace.
