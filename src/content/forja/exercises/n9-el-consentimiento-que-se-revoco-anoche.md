---
title: "El consentimiento que se revocó anoche"
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
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar en qué instante se comprueba el permiso en tu diseño, y qué pasa con lo que ya salió del hospital cuando el permiso deja de existir."
lambda: 0.75
constraints:
  - metric: pacientes cuyos datos clínicos alimentan el consorcio de investigación
    operator: ">="
    value: 74000
    unit: pacientes
  - metric: revocaciones de consentimiento recibidas por mes
    operator: ">="
    value: 210
    unit: revocaciones
hiddenFacts:
  - fact: "la ley de investigación biomédica que aplica acá no exige que el paciente haya consentido alguna vez: exige que el consentimiento esté vigente en el instante en que el dato se entrega. Una entrega hecha con el permiso de ayer es una entrega sin permiso."
    discoveryPath: "leé la obligación con cuidado y fijate en qué momento la sitúa. Si el momento que importa es el de la entrega, cualquier pieza que guarde el dato antes de entregarlo mueve la comprobación hacia atrás en el tiempo."
  - fact: "el consorcio recibe hoy un lote nocturno. Entre que el lote se arma y que sale pasan tres horas. Llegan siete revocaciones por día, así que en ese rango entra en promedio una: una historia clínica por noche que sale después de que su dueño dijo que no."
    discoveryPath: "seguí el camino que hace hoy el dato hasta el consorcio y contá cuántas piezas lo guardan en el medio. Cada una de esas piezas es tiempo entre la comprobación y la entrega."
  - fact: "en febrero un paciente revocó a las 21:40 y su historia clínica salió en el lote de las 23:00. La revocación estaba registrada, el lote no la miró: el lote se había armado a las 20:00."
    discoveryPath: "es la razón por la que el ejercicio pide que no haya una pieza que guarde el dato entre el hospital y el consorcio. No es una preferencia de latencia: es dónde queda el instante en que se pregunta si se puede."
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
    - id: lote
      type: queue
      label: Lote nocturno de exportación
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 430 }
    - id: exportador
      type: worker
      label: Exportador al consorcio
      zone: private
      given: true
      position: { x: 445, y: 660 }
    - id: consorcio
      type: external-provider
      label: Consorcio de investigación
      zone: dmz
      given: true
      position: { x: 445, y: 550 }
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
    - id: clinico-lote
      from: { node: clinico }
      to: { node: lote }
      dataClass: regulated
    - id: lote-exportador
      from: { node: lote }
      to: { node: exportador }
      dataClass: regulated
    - id: exportador-consorcio
      from: { node: exportador }
      to: { node: consorcio }
      dataClass: regulated
guarantees:
  - id: g-no-buffer-before-handoff
    label: lo que sale hacia el consorcio no espera guardado en ninguna pieza del camino
    weight: 4
    predicate:
      op: path
      from:
        role: clinico-service
      to:
        type: [external-provider]
      forbid:
        type: [queue, stream, object-storage]
    whyMissing: no hay ningún camino desde el servicio de historia clínica hasta el consorcio que no pase por una cola, un registro de eventos o un archivo, es decir, por una pieza que guarda el dato antes de entregarlo.
    consequence: "cada pieza que guarda el dato en el medio mueve hacia atrás el instante en que se preguntó si se podía entregar. El lote de las 23:00 se arma a las 20:00: lo que salga esa noche sale con el permiso de tres horas antes, y de las siete revocaciones que llegan por día, en esas tres horas entra en promedio una. En febrero pasó exactamente eso y la revocación estaba registrada."
  - id: g-clinician-path
    label: el médico sigue llegando a la historia clínica por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: clinico-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el escritorio clínico hasta el servicio de historia clínica que pase por una entrada del sistema.
    consequence: "la obligación con el consorcio es de investigación; la de atender al paciente es asistencial y no admite pausa. Un cambio que arregla la entrega y deja al médico sin historia clínica en la guardia se revierte esa misma noche, y con él vuelve el lote nocturno."
  - id: g-door-identity
    label: la entrada al hospital comprueba identidad con doble factor
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad del hospital con segundo factor obligatorio.
    consequence: "el consentimiento sólo significa algo si se sabe de qué paciente y de qué profesional se está hablando. Una entrada que no identifica convierte todo el andamiaje de permisos en un formulario: el permiso existe, pero nadie puede decir a quién se le pidió."
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
    consequence: "una historia clínica tiene plazo legal de conservación y es la prueba de qué se hizo con un paciente. Sin copia, la conservación depende de que nunca falle un disco, que es otra forma de decir que no está resuelta."
rubric:
  - dimension: el permiso se comprueba en el instante de la entrega
    signal:
      kind: predicate
      guaranteeId: g-no-buffer-before-handoff
  - dimension: la atención del paciente no se interrumpe
    signal:
      kind: predicate
      guaranteeId: g-clinician-path
  - dimension: la entrada identifica a la persona
    signal:
      kind: predicate
      guaranteeId: g-door-identity
  - dimension: la historia clínica se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-clinical-store
referenceSolutions:
  - label: el servicio clínico entrega en el momento
    contextInversion: "entregar directo desde el servicio que tiene el dato conviene cuando lo que hay que garantizar es que la comprobación y la entrega ocurren en el mismo acto: no hay ninguna pieza en el medio que pueda tener una versión anterior del permiso, porque no hay medio. Es el diseño con menos partes y el único donde la frase «se entregó con consentimiento vigente» se puede sostener sin explicar nada más. El costo hay que decirlo entero: si el consorcio no responde, la entrega no ocurre y nadie la reintenta, y el servicio de historia clínica, que es asistencial, queda esperando a un tercero de investigación."
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
        - id: consorcio
          type: external-provider
          label: Consorcio de investigación
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
        - id: clinico-consorcio
          from: { node: clinico }
          to: { node: consorcio }
          dataClass: regulated
  - label: un servicio de entrega que vuelve a preguntar antes de mandar
    contextInversion: "separar la entrega en su propio servicio conviene cuando el hospital quiere que el componente asistencial no dependa de la disponibilidad de un tercero de investigación: la historia clínica sigue atendiendo aunque el consorcio esté caído, y la lógica de consentimiento, que cambia cada vez que cambia el marco regulatorio, vive en una pieza que se despliega sola. La comprobación se sigue haciendo en el mismo acto que la entrega, porque el servicio de entrega no guarda nada: pregunta, arma y manda. Se paga con una pieza más para operar y con una llamada más en un camino que ya era sincrónico."
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
        - id: entrega
          type: service
          label: Servicio de entrega al consorcio
          zone: private
          props: { criticality: "medium", replicas: "2" }
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
        - id: consorcio
          type: external-provider
          label: Consorcio de investigación
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
        - id: clinico-entrega
          from: { node: clinico }
          to: { node: entrega }
          dataClass: regulated
        - id: entrega-identidad
          from: { node: entrega }
          to: { node: identidad }
          dataClass: secret
        - id: entrega-consorcio
          from: { node: entrega }
          to: { node: consorcio }
          dataClass: regulated
status: PILOT
---

Una red hospitalaria entrega datos clínicos de **74.000 pacientes** a un
consorcio de investigación. El paciente firma un consentimiento y lo puede
revocar cuando quiera: llegan **210 revocaciones por mes**.

La ley que aplica acá no dice lo que casi todos leen. No exige que el
paciente haya consentido alguna vez: exige que **el consentimiento esté
vigente en el instante en que el dato se entrega**. Una entrega hecha con el
permiso de ayer es, a los efectos de la norma, una entrega sin permiso.

Hoy la entrega es un lote nocturno. El lote se arma a las 20:00 y sale a las
23:00. Llegan **siete revocaciones por día**, así que en esas tres horas
entra, en promedio, una.

En febrero un paciente revocó a las 21:40 y su historia clínica salió en el
lote de las 23:00. La revocación estaba registrada en el sistema. El lote no
la miró, porque el lote ya se había armado.

El equipo de plataforma se opone a sacar el lote y su argumento es real: el
lote existe porque el consorcio se cae, y cuando se cae el lote reintenta.
Sin lote, una entrega fallida es una entrega perdida y alguien la va a tener
que rehacer a mano.

Los dos tienen razón. La pregunta no es cuál diseño es mejor: es qué pesa
más **en este contexto**, donde lo que se puede incumplir es un permiso que
cambia de noche.

El equipo tiene **6 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que entre el hospital y el consorcio no quede
ninguna pieza que guarde el dato antes de entregarlo, sin dejar al médico
sin historia clínica.
