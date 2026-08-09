---
title: "El historial clínico sin copia"
level: 5
role: core
domain: salud
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
aiBudget: "libre, pero tu respuesta tiene que explicar por qué una copia dentro del mismo proveedor y la misma cuenta no es una copia, sino la misma cosa dos veces."
lambda: 0.5
constraints:
  - metric: historias clínicas activas
    operator: ">="
    value: 74000
    unit: historias
  - metric: pérdida de registros tolerada por el regulador
    operator: "="
    value: 0
    unit: registros
hiddenFacts:
  - fact: "el proveedor de base de datos hace una copia diaria automática, pero la copia vive en la misma cuenta y se sincroniza con el original: un borrado lógico se replicó a la copia en once minutos."
    discoveryPath: "es la razón por la que la garantía pide una copia FUERA de la base, no una propiedad de la base. Una copia que comparte el radio de daño del original no es respaldo, es duplicación."
  - fact: nadie del equipo restauró nunca esa copia. No se sabe cuánto tarda ni si el formato sirve.
    discoveryPath: "un respaldo que nunca se restauró es una hipótesis, no un respaldo. El ejercicio no lo mide, pero explica por qué el equipo pide una segunda copia en un lugar donde escribir y leer sea un gesto ordinario del sistema."
startingDesign:
  nodes:
    - id: paciente
      type: actor
      label: Paciente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del paciente
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: historias
      type: service
      label: Servicio de historias clínicas
      zone: private
      role: records-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: basehistorias
      type: database
      label: Base de historias clínicas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: paciente-portal
      from: { node: paciente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-historias
      from: { node: gw }
      to: { node: historias }
      dataClass: regulated
    - id: historias-basehistorias
      from: { node: historias }
      to: { node: basehistorias }
      dataClass: regulated
guarantees:
  - id: g-copy-outside
    label: existe una copia de las historias fuera de la base principal
    weight: 2
    predicate:
      op: path
      from:
        role: records-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de historias clínicas hasta un almacenamiento de objetos, así que el único lugar donde existe una historia es la base principal.
    consequence: un borrado lógico, una migración mal ejecutada o una tabla truncada se llevan el dato y su copia sincronizada al mismo tiempo. La recuperación pasa a ser el papel del consultorio, si existe.
  - id: g-primary-store
    label: la base principal sigue siendo el sistema de registro
    weight: 1
    predicate:
      op: path
      from:
        role: records-service
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de historias clínicas hasta una base de datos.
    consequence: la copia es un respaldo, no un reemplazo. Un archivo de objetos guarda y devuelve un archivo entero, no busca por paciente ni por fecha ni sostiene una consulta en el consultorio. Si el sistema de registro desaparece, el médico deja de poder trabajar aunque la copia esté intacta.
  - id: g-db-observed
    label: la base principal reporta su estado
    weight: 1
    predicate:
      op: covered
      target:
        type: [database]
      by:
        type: [observability]
    whyMissing: la base de historias clínicas no está conectada a ningún componente de monitoreo.
    consequence: un disco que se llena, una réplica que se atrasa o un trabajo de copia que falló en silencio son cosas que la base sabe y nadie más. Se descubren el día que hay que restaurar.
  - id: g-service-observed
    label: el servicio de historias clínicas reporta lo que le pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: records-service
      by:
        type: [observability]
    whyMissing: el servicio de historias clínicas no está conectado a ningún componente de monitoreo.
    consequence: el médico ve una pantalla en blanco y llama a la mesa de ayuda. Ese llamado es hoy el sistema de detección de la clínica.
rubric:
  - dimension: la historia clínica existe en más de un lugar con radios de daño distintos
    signal:
      kind: predicate
      guaranteeId: g-copy-outside
  - dimension: la copia se suma al sistema de registro en vez de reemplazarlo
    signal:
      kind: predicate
      guaranteeId: g-primary-store
  - dimension: el estado del almacenamiento es una señal y no una sorpresa
    signal:
      kind: predicate
      guaranteeId: g-db-observed
  - dimension: el equipo detecta la falla antes que el médico
    signal:
      kind: predicate
      guaranteeId: g-service-observed
referenceSolutions:
  - label: el servicio escribe la copia él mismo
    contextInversion: "que el propio servicio deje la copia es lo correcto cuando el volumen es bajo y la copia se escribe una vez por historia, en el momento del alta: cero piezas nuevas que operar, y la copia queda escrita en el mismo instante en que el dato es válido. El costo es que la escritura de la copia queda en el camino del pedido del médico: si el almacenamiento se pone lento, el alta se pone lenta."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal del paciente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: historias
          type: service
          label: Servicio de historias clínicas
          zone: private
          role: records-service
          props: { criticality: "high", replicas: "2" }
        - id: basehistorias
          type: database
          label: Base de historias clínicas
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de historias
          zone: private
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: regulated
        - id: historias-basehistorias
          from: { node: historias }
          to: { node: basehistorias }
          dataClass: regulated
        - id: historias-archivo
          from: { node: historias }
          to: { node: archivo }
          dataClass: regulated
        - id: historias-monitoreo
          from: { node: historias }
          to: { node: monitoreo }
          dataClass: public
        - id: basehistorias-monitoreo
          from: { node: basehistorias }
          to: { node: monitoreo }
          dataClass: public
  - label: un exportador aparte, alimentado por una cola
    contextInversion: "un exportador separado conviene cuando la copia no puede robarle tiempo a la consulta médica y cuando exportar es un trabajo que a veces falla y hay que reintentar: la cola guarda el pendiente, el exportador reintenta sin que el médico se entere, y el equipo puede pausarlo un martes a la tarde sin tocar el servicio. Se paga con dos piezas más para operar."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal del paciente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: historias
          type: service
          label: Servicio de historias clínicas
          zone: private
          role: records-service
          props: { criticality: "high", replicas: "2" }
        - id: basehistorias
          type: database
          label: Base de historias clínicas
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de historias por exportar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: exportador
          type: worker
          label: Exportador de historias
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo de historias
          zone: private
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: regulated
        - id: historias-basehistorias
          from: { node: historias }
          to: { node: basehistorias }
          dataClass: regulated
        - id: historias-cola
          from: { node: historias }
          to: { node: cola }
          dataClass: regulated
        - id: cola-exportador
          from: { node: cola }
          to: { node: exportador }
          dataClass: regulated
        - id: exportador-archivo
          from: { node: exportador }
          to: { node: archivo }
          dataClass: regulated
        - id: historias-monitoreo
          from: { node: historias }
          to: { node: monitoreo }
          dataClass: public
        - id: basehistorias-monitoreo
          from: { node: basehistorias }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: exportador-monitoreo
          from: { node: exportador }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una red de consultorios con **74.000 historias clínicas activas**. Todo
vive en una sola base de datos. El proveedor hace una copia automática cada
noche y el equipo duerme tranquilo con eso.

En abril, una migración de esquema mal ejecutada borró **412 historias** un
viernes a las 19:10. El equipo lo descubrió el lunes. Cuando fueron a
restaurar la copia descubrieron dos cosas, y las dos son la lección de este
ejercicio.

La primera: **la copia vive en la misma cuenta y se sincroniza con el
original**. El borrado se replicó a la copia en once minutos. No había dos
cosas, había la misma cosa dos veces.

La segunda: **nadie había restaurado esa copia nunca**. No sabían cuánto
tarda, ni si el formato servía. Un respaldo que jamás se restauró no es un
respaldo, es una hipótesis.

Las 412 historias se rearmaron a mano, con las carpetas de papel de tres
consultorios, durante cinco semanas. El regulador tolera **cero registros
perdidos**.

El equipo tiene **6 unidades operativas** y hoy usa 3.

**Rearmá el sistema** para que exista una copia de la historia clínica
fuera de la base principal, en un lugar con un radio de daño distinto, y
para que el estado del almacenamiento sea una señal que el equipo mira, no
una sorpresa que aparece el día que hay que restaurar.
