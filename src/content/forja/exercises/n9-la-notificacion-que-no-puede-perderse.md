---
title: "La notificación que no puede perderse"
level: 9
role: tradeoff
domain: hospital
tradeoffPairId: entrega-al-tercero
D1: 3
D2: 4
D3: 3
D4: 2
D5: 3
D6: 2
D7: 3
D8: 2
D9: 3
prerequisiteLevels: [8]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que explicar qué pasa con una notificación obligatoria cuando el organismo que la recibe está caído, y por qué acá la respuesta no puede ser «se perdió»."
lambda: 0.75
constraints:
  - metric: horas dentro de las que la ley obliga a notificar un caso de declaración obligatoria
    operator: "<="
    value: 24
    unit: horas
  - metric: casos de declaración obligatoria notificados por año
    operator: ">="
    value: 9400
    unit: casos
hiddenFacts:
  - fact: "la notificación de una enfermedad de declaración obligatoria no depende del consentimiento del paciente: la ley la impone y el paciente no la puede revocar. La única obligación que corre acá es que llegue, y que llegue dentro de 24 horas."
    discoveryPath: "leé qué permiso hace falta para esta entrega. Si la respuesta es ninguno, porque la obligación es legal y no consentida, todo el razonamiento sobre el instante en que se comprueba el permiso deja de aplicar y queda una sola pregunta: qué pasa si no llega."
  - fact: "el punto de recepción del organismo sanitario nacional estuvo caído 71 horas el mes pasado, repartidas en tres cortes. En ese tiempo el hospital detectó 26 casos notificables."
    discoveryPath: "preguntate qué hace tu diseño con una entrega que falla. Si la respuesta es que el que la originó se entera y la vuelve a intentar, mirá quién es ese que la originó y qué más está haciendo a esa hora."
  - fact: "la sanción del año pasado no fue por notificar tarde: fue por 4 casos que no se notificaron nunca. El sistema los había intentado una vez, había fallado y nadie se enteró hasta la inspección anual."
    discoveryPath: "es la razón por la que el ejercicio pide una pieza que guarde entre el hospital y el organismo. Un intento sin lugar donde esperar es un intento único, y un intento único delante de un receptor caído es una notificación perdida."
startingDesign:
  nodes:
    - id: medico
      type: actor
      label: Médico tratante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: escritorio
      type: web-client
      label: Escritorio clínico
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: gw
      type: api-gateway
      label: Puerta del hospital
      zone: dmz
      given: true
      position: { x: 445, y: 180 }
    - id: clinico
      type: service
      label: Servicio de historia clínica
      zone: private
      role: clinico-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad del hospital
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 80 }
    - id: basehistoria
      type: database
      label: Base de historias clínicas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 300 }
    - id: organismo
      type: external-provider
      label: Punto de recepción del organismo sanitario
      zone: dmz
      given: true
      position: { x: 445, y: 460 }
  edges:
    - id: medico-escritorio
      from: { node: medico }
      to: { node: escritorio }
      dataClass: public
    - id: escritorio-gw
      from: { node: escritorio }
      to: { node: gw }
      dataClass: personal
    - id: gw-identidad
      from: { node: gw }
      to: { node: identidad }
      dataClass: secret
    - id: gw-clinico
      from: { node: gw }
      to: { node: clinico }
      dataClass: personal
    - id: clinico-basehistoria
      from: { node: clinico }
      to: { node: basehistoria }
      dataClass: regulated
    - id: clinico-organismo
      from: { node: clinico }
      to: { node: organismo }
      dataClass: regulated
guarantees:
  - id: g-durable-before-handoff
    label: entre el hospital y el organismo hay una pieza que guarda la notificación hasta que llegue
    weight: 4
    predicate:
      op: noVolatileCut
      from:
        role: clinico-service
      to:
        type: [external-provider]
    whyMissing: "hay camino hasta el organismo, pero ninguna pieza de ese camino guarda la notificación: si el intento falla, no queda en ningún lado."
    consequence: "el punto de recepción estuvo caído 71 horas el mes pasado y en ese tiempo el hospital detectó 26 casos notificables. Sin un lugar donde esperar, cada uno de esos casos fue un intento único contra un receptor que no estaba. La sanción del año pasado no fue por notificar tarde: fue por 4 casos que no se notificaron nunca y que nadie supo que faltaban hasta la inspección."
  - id: g-no-direct-handoff
    label: el servicio clínico no le entrega la notificación al organismo por su cuenta
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: clinico-service
      to:
        type: [external-provider]
    whyMissing: hay una conexión directa desde el servicio de historia clínica hasta el punto de recepción del organismo.
    consequence: "el servicio de historia clínica es asistencial: lo usa el médico en la guardia. Hacerlo responsable de esperar a un receptor externo que se cae 71 horas por mes le mete en el camino crítico una dependencia que no controla, y cuando el organismo se degrada el que se degrada es el escritorio clínico."
  - id: g-clinician-path
    label: el médico sigue llegando a la historia clínica por una entrada del sistema
    weight: 2
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: clinico-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el escritorio clínico hasta el servicio de historia clínica que pase por una entrada del sistema.
    consequence: "la notificación obligatoria es una obligación del hospital; atender al paciente es su razón de existir. Un diseño que asegura la notificación y deja al médico sin historia clínica no resolvió el problema: lo cambió por uno más caro."
  - id: g-door-identity
    label: la entrada al hospital comprueba identidad con doble factor
    weight: 2
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad del hospital con segundo factor obligatorio.
    consequence: "una notificación de declaración obligatoria lleva el nombre del profesional que la firma, y esa firma tiene consecuencias legales para él. Una entrada que no identifica con segundo factor convierte esa firma en una afirmación que nadie puede sostener."
  - id: g-clinical-store
    label: la historia clínica vive en un almacenamiento con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: clinico-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio de historia clínica hasta una base de datos con copia de respaldo declarada.
    consequence: "la historia clínica es la prueba de que el caso existió y de cuándo se detectó. Sin copia, el hospital puede haber notificado a tiempo y no poder demostrarlo, que delante de una inspección es lo mismo que no haber notificado."
rubric:
  - dimension: una entrega fallida no es una notificación perdida
    signal:
      kind: predicate
      guaranteeId: g-durable-before-handoff
  - dimension: el componente asistencial no espera a un tercero
    signal:
      kind: predicate
      guaranteeId: g-no-direct-handoff
  - dimension: la atención del paciente no se interrumpe
    signal:
      kind: predicate
      guaranteeId: g-clinician-path
  - dimension: la firma del profesional tiene un nombre detrás
    signal:
      kind: predicate
      guaranteeId: g-door-identity
  - dimension: la historia clínica se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-clinical-store
referenceSolutions:
  - label: una cola y un trabajador que reintenta
    contextInversion: "encolar la notificación y dejar que un trabajador la entregue conviene cuando la obligación es de resultado y no de instante: la ley pide que llegue dentro de 24 horas, y 24 horas es tiempo de sobra para atravesar tres cortes del receptor. El servicio clínico deja de esperar a nadie y la notificación deja de depender de que el organismo esté vivo en el segundo exacto en que el médico cargó el caso. Se paga con dos piezas más de infraestructura y con una verdad incómoda: mientras el mensaje espera, el hospital cree que notificó y todavía no notificó."
    design:
      nodes:
        - id: medico
          type: actor
          label: Médico tratante
          zone: public
        - id: escritorio
          type: web-client
          label: Escritorio clínico
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta del hospital
          zone: dmz
        - id: clinico
          type: service
          label: Servicio de historia clínica
          zone: private
          role: clinico-service
          props: { criticality: "high", replicas: "2" }
        - id: colanotificaciones
          type: queue
          label: Cola de notificaciones obligatorias
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: notificador
          type: worker
          label: Notificador al organismo
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad del hospital
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basehistoria
          type: database
          label: Base de historias clínicas
          zone: restricted
          props: { backup: "diario" }
        - id: organismo
          type: external-provider
          label: Punto de recepción del organismo sanitario
          zone: dmz
      edges:
        - id: medico-escritorio
          from: { node: medico }
          to: { node: escritorio }
          dataClass: public
        - id: escritorio-gw
          from: { node: escritorio }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-clinico
          from: { node: gw }
          to: { node: clinico }
          dataClass: personal
        - id: clinico-basehistoria
          from: { node: clinico }
          to: { node: basehistoria }
          dataClass: regulated
        - id: clinico-colanotificaciones
          from: { node: clinico }
          to: { node: colanotificaciones }
          dataClass: regulated
        - id: colanotificaciones-notificador
          from: { node: colanotificaciones }
          to: { node: notificador }
          dataClass: regulated
        - id: notificador-organismo
          from: { node: notificador }
          to: { node: organismo }
          dataClass: regulated
  - label: un servicio que es dueño de la obligación, con su propia cola detrás
    contextInversion: "darle a la notificación un servicio propio conviene cuando el hospital necesita poder contestar «cuántos casos están pendientes y desde cuándo» sin mirar una cola: la obligación deja de ser un efecto secundario del servicio clínico y pasa a ser un componente con dueño, que sabe qué se notificó, qué falló y qué está esperando. Es lo que hace falta cuando la sanción llega por casos que nadie supo que faltaban. Se paga con una pieza más para operar que el diseño anterior y con la disciplina de mantener dos componentes en el mismo camino."
    design:
      nodes:
        - id: medico
          type: actor
          label: Médico tratante
          zone: public
        - id: escritorio
          type: web-client
          label: Escritorio clínico
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta del hospital
          zone: dmz
        - id: clinico
          type: service
          label: Servicio de historia clínica
          zone: private
          role: clinico-service
          props: { criticality: "high", replicas: "2" }
        - id: notificacion
          type: service
          label: Servicio de notificación obligatoria
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: colanotificaciones
          type: queue
          label: Cola de notificaciones obligatorias
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: notificador
          type: worker
          label: Notificador al organismo
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad del hospital
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basehistoria
          type: database
          label: Base de historias clínicas
          zone: restricted
          props: { backup: "diario" }
        - id: organismo
          type: external-provider
          label: Punto de recepción del organismo sanitario
          zone: dmz
      edges:
        - id: medico-escritorio
          from: { node: medico }
          to: { node: escritorio }
          dataClass: public
        - id: escritorio-gw
          from: { node: escritorio }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-clinico
          from: { node: gw }
          to: { node: clinico }
          dataClass: personal
        - id: clinico-basehistoria
          from: { node: clinico }
          to: { node: basehistoria }
          dataClass: regulated
        - id: clinico-notificacion
          from: { node: clinico }
          to: { node: notificacion }
          dataClass: regulated
        - id: notificacion-colanotificaciones
          from: { node: notificacion }
          to: { node: colanotificaciones }
          dataClass: regulated
        - id: colanotificaciones-notificador
          from: { node: colanotificaciones }
          to: { node: notificador }
          dataClass: regulated
        - id: notificador-organismo
          from: { node: notificador }
          to: { node: organismo }
          dataClass: regulated
status: PILOT
---

La misma red hospitalaria, la misma historia clínica, otro tercero y otra
obligación.

Cuando un médico detecta una enfermedad de declaración obligatoria, el
hospital tiene que notificarla al organismo sanitario nacional **dentro de
24 horas**. Son **9.400 casos por año**.

Acá el consentimiento no entra en la discusión. La notificación no la
autoriza el paciente: la impone la ley y el paciente no la puede revocar.
Todo el razonamiento sobre el instante exacto en que se comprueba un permiso,
el que resolvió el caso del consorcio de investigación, **no aplica**. Lo
único que la norma exige es que llegue, y que llegue a tiempo.

El punto de recepción del organismo estuvo caído **71 horas el mes pasado**,
repartidas en tres cortes. En ese tiempo el hospital detectó 26 casos
notificables.

Hoy el servicio de historia clínica llama al organismo en el momento en que
el médico carga el caso. Si el organismo responde, listo. Si no responde, no
pasa nada más: no hay reintento, no hay alerta, no hay lugar donde el caso
quede esperando.

La sanción del año pasado no fue por notificar tarde. Fue por **4 casos que
no se notificaron nunca**. El sistema los había intentado una vez, había
fallado, y nadie se enteró hasta la inspección anual.

El equipo que resolvió el caso del consorcio quiere aplicar la misma
respuesta: sacar todo lo que guarde en el medio y entregar en el momento.
Es exactamente lo contrario de lo que este caso necesita, y entender por qué
es el ejercicio.

El equipo tiene **7 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que una notificación que no se pudo entregar
quede en algún lado hasta que se entregue, sin que el servicio asistencial
sea el que espera.
