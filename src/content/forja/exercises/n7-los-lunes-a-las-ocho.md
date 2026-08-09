---
title: "Los lunes a las ocho"
level: 7
role: trap
domain: salud
D1: 3
D2: 3
D3: 3
D4: 2
D5: 2
D6: 3
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 6
aiBudget: "libre, pero antes de proponer una pieza tenés que escribir el número del pico y el número de un día normal, uno al lado del otro. Si no podés justificar la pieza con esos dos números, la pieza no entra."
lambda: 3.0
constraints:
  - metric: personas pidiendo turno al mismo tiempo el lunes a las 8:00
    operator: ">="
    value: 900
    unit: personas
  - metric: personas pidiendo turno al mismo tiempo un martes a las 11:00
    operator: ">="
    value: 840
    unit: personas
  - metric: presupuesto operativo de la red (techo duro)
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el lunes a las 8:00 hay 900 personas pidiendo turno al mismo tiempo. Un martes a las 11 hay 840. El «pico del lunes» es un 7 % más de tráfico que un martes cualquiera, y el servicio ya sostiene el martes sin despeinarse."
    discoveryPath: "pedí el número del pico y el número del día normal antes de diseñar para el pico. Si la diferencia entre los dos cabe en el margen que ya tenés, no tenés un problema de capacidad: tenés otro problema que ocurre a la misma hora."
  - fact: "a las 8:00 en punto de cada lunes, el servicio de informes de gestión recorre la agenda entera, catorce meses de turnos, para armar el reporte semanal de la dirección. Tarda dieciocho minutos, y durante esos dieciocho minutos la base contesta el resto de las consultas cuatro veces más lento."
    discoveryPath: "mirá qué más está pasando en el minuto exacto en que se cae. Un incidente que ocurre siempre a la misma hora en punto no lo causa el tráfico, que nunca es tan puntual: lo causa algo programado."
  - fact: "la grilla de disponibilidad no es la misma para todos: está filtrada por el plan de cobertura de cada paciente y por el profesional que lo derivó. Dos pacientes distintos, dos grillas distintas."
    discoveryPath: "abrí la pantalla con dos pacientes distintos y compará lo que devuelve. Una copia repartida sólo sirve cuando la pantalla es la misma para todos; si cada uno ve la suya, no hay nada que repartir y sí hay algo que filtrar mal."
  - fact: "el reporte semanal se entrega los lunes al mediodía y describe la semana anterior, que ya terminó. Nunca necesitó leer la agenda en vivo."
    discoveryPath: "preguntá de qué fecha habla el informe. Si describe algo que ya pasó, no necesita la base donde se está escribiendo lo que está pasando."
startingDesign:
  nodes:
    - id: paciente
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
    - id: turnos
      type: service
      label: Servicio de turnos
      zone: private
      role: turnos-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: informes
      type: service
      label: Servicio de informes de gestión
      zone: private
      role: informes-service
      given: true
      props: { criticality: "medium", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: agenda
      type: database
      label: Base de la agenda clínica
      zone: restricted
      role: agenda-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: paciente-gw
      from: { node: paciente }
      to: { node: gw }
      dataClass: personal
    - id: gw-turnos
      from: { node: gw }
      to: { node: turnos }
      dataClass: personal
    - id: turnos-agenda
      from: { node: turnos }
      to: { node: agenda }
      dataClass: personal
    - id: informes-agenda
      from: { node: informes }
      to: { node: agenda }
      dataClass: personal
    - id: turnos-obs
      from: { node: turnos }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-informe-fuera-de-la-agenda
    label: el informe de gestión ya no recorre la agenda en vivo
    weight: 3
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: informes-service
        - op: edgeAbsent
          from:
            role: informes-service
          to:
            role: agenda-db
    whyMissing: el servicio de informes desapareció del diseño, o sigue leyendo directamente la base de la agenda clínica.
    consequence: "dieciocho minutos recorriendo catorce meses de turnos, todos los lunes a las ocho en punto, en la misma base donde en ese momento se están reservando turnos. La dirección no puede quedarse sin su reporte, así que borrar el servicio no es la respuesta: la respuesta es que lea de otro lado."
  - id: g-informe-con-fuente-propia
    label: el informe lee de una fuente que alguien llena
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            role: informes-service
          to:
            type: [object-storage, database]
          forbid:
            role: agenda-db
        - op: path
          from:
            role: turnos-service
          to:
            type: [object-storage, database]
          forbid:
            role: agenda-db
    whyMissing: "falta una de las dos mitades: o el servicio de informes no llega a ningún lugar fuera de la agenda (ni a una exportación en archivos ni a una base propia), o llega a uno que nadie escribe. Una fuente de datos necesita las dos puntas: quien la lee y quien la llena."
    consequence: "sacar el informe de la agenda sin darle otra fuente es dejar de producir el informe. Y darle una fuente que nadie llena es peor que no dársela: el lunes al mediodía la dirección recibe un reporte que no falla, no avisa nada y está vacío. El sistema parece sano y el dato no existe. El reporte describe una semana ya terminada, así que puede leer una copia de ayer sin perder nada, pero tiene que leer algo que alguien haya escrito."
  - id: g-turnos-sin-copia
    label: la disponibilidad se sigue respondiendo en vivo, sin copias repartidas ni en memoria
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: turnos-service
        - op: edgeAbsent
          from:
            type: [service, worker]
          to:
            type: [cache]
        - op: not
          of:
            - op: exists
              node:
                type: [cdn]
    whyMissing: no hay camino desde la puerta de entrada hasta el servicio de turnos, o apareció una copia de la disponibilidad, en memoria o repartida, que no puede existir acá.
    consequence: "la grilla está filtrada por el plan de cobertura y por el profesional que derivó al paciente: no es la misma pantalla para dos personas. Una copia repartida de una pantalla personalizada sirve la grilla equivocada a alguien, y una copia en memoria de un dato personal es exactamente lo que un reinicio no debería poder dejar tirado en ningún lado."
  - id: g-turno-persiste
    label: el turno reservado queda escrito en algo que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: turnos-service
      to:
        role: agenda-db
    whyMissing: entre el servicio de turnos y la agenda clínica no queda ninguna pieza que sobreviva a un reinicio, o directamente no hay camino entre los dos.
    consequence: "un turno que el paciente cree tener y el hospital no tiene anotado es una persona que viaja y se vuelve. En una red pública eso no se mide en errores: se mide en consultas perdidas y en una lista de espera que crece sola."
  - id: g-turnos-observado
    label: el equipo ve los lunes a las ocho mientras pasan
    weight: 1
    predicate:
      op: covered
      target:
        role: turnos-service
      by:
        type: [observability]
    whyMissing: el servicio de turnos no está conectado a ningún componente de monitoreo.
    consequence: "el lunes a las ocho es el único momento de la semana en que este sistema se comporta distinto. Si no lo mirás mientras pasa, la explicación que te queda es la que trae el ticket: «anda lento los lunes», que no dice nada sobre por qué."
rubric:
  - dimension: el trabajo programado salió del camino de lo que está pasando ahora
    signal:
      kind: predicate
      guaranteeId: g-informe-fuera-de-la-agenda
  - dimension: la obligación con la dirección sigue en pie, con datos adentro
    signal:
      kind: predicate
      guaranteeId: g-informe-con-fuente-propia
  - dimension: no agregaste una pieza que este problema no pedía
    signal:
      kind: predicate
      guaranteeId: g-turnos-sin-copia
  - dimension: el turno reservado sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-turno-persiste
  - dimension: el lunes a las ocho es visible mientras ocurre
    signal:
      kind: predicate
      guaranteeId: g-turnos-observado
  - dimension: el diseño entra en el presupuesto operativo de la red
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: la agenda se exporta a archivos y el informe lee de ahí
    contextInversion: "exportar la agenda a archivos y hacer que el informe lea de ahí es lo correcto cuando el reporte describe una semana ya cerrada y nadie necesita el dato del minuto: una exportación diaria alcanza, no cuesta ninguna unidad operativa y deja el presupuesto exactamente donde estaba. Es la respuesta que no compra nada: mirá el total y vas a ver que gastaste menos que antes. Se paga con que el informe nunca puede contestar una pregunta sobre hoy, y con que si la exportación falla un domingo, el lunes al mediodía la dirección recibe el reporte de la semana anterior a la anterior sin que nada se vea roto."
    design:
      nodes:
        - id: paciente
          type: web-client
          label: Portal del paciente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: turnos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: informes
          type: service
          label: Servicio de informes de gestión
          zone: private
          role: informes-service
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: agenda
          type: database
          label: Base de la agenda clínica
          zone: restricted
          role: agenda-db
          props: { backup: "diario" }
        - id: exportacion
          type: object-storage
          label: Exportación diaria de la agenda
          zone: private
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: paciente-gw
          from: { node: paciente }
          to: { node: gw }
          dataClass: personal
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: turnos-agenda
          from: { node: turnos }
          to: { node: agenda }
          dataClass: personal
        - id: turnos-exportacion
          from: { node: turnos }
          to: { node: exportacion }
          dataClass: personal
        - id: informes-exportacion
          from: { node: informes }
          to: { node: exportacion }
          dataClass: personal
        - id: turnos-obs
          from: { node: turnos }
          to: { node: obs }
          dataClass: public
  - label: una base aparte para gestión, escrita por el servicio de turnos
    contextInversion: "darle al informe una base propia es lo correcto cuando la dirección va a seguir pidiendo cortes nuevos (por profesional, por especialidad, por sede) y no querés volver a tocar la exportación cada vez: una base contesta preguntas que nadie previó, un archivo sólo contesta la que ya estaba escrita en él. Esa flexibilidad cuesta la única unidad operativa que te queda, así que es la variante que deja el presupuesto en el techo. Se paga con eso y con una copia más de datos clínicos que hay que respaldar, retener y borrar cuando corresponda: cada copia de un dato personal es una obligación más, no sólo un disco más."
    design:
      nodes:
        - id: paciente
          type: web-client
          label: Portal del paciente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: turnos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: informes
          type: service
          label: Servicio de informes de gestión
          zone: private
          role: informes-service
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: agenda
          type: database
          label: Base de la agenda clínica
          zone: restricted
          role: agenda-db
          props: { backup: "diario" }
        - id: gestion
          type: database
          label: Base de gestión
          zone: restricted
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: paciente-gw
          from: { node: paciente }
          to: { node: gw }
          dataClass: personal
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: turnos-agenda
          from: { node: turnos }
          to: { node: agenda }
          dataClass: personal
        - id: turnos-gestion
          from: { node: turnos }
          to: { node: gestion }
          dataClass: personal
        - id: informes-gestion
          from: { node: informes }
          to: { node: gestion }
          dataClass: personal
        - id: turnos-obs
          from: { node: turnos }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Una red de salud pública atiende turnos por su portal. **Todos los lunes entre
las 8:00 y las 8:20 el portal se arrastra**, y todos los lunes a las 8:25
vuelve solo. Pasa desde hace catorce meses.

El ticket dice lo que dicen todos los tickets: "el lunes a la mañana es el
pico, hay que aguantar el pico". El equipo llega con la propuesta que este
nivel te enseñó a dar: sacar la grilla de disponibilidad de la
infraestructura, servirla desde una pieza que cuesta cero, y listo.

Antes de dibujar nada, pedí los dos números.

- Lunes 8:00: **900 personas** pidiendo turno al mismo tiempo.
- Martes 11:00: **840 personas** pidiendo turno al mismo tiempo.

Un 7 % más. El martes no se cae nunca. Ese pico no es un pico: es un martes
con mala prensa.

Ahora mirá qué más ocurre a las 8:00 en punto de cada lunes. El **servicio de
informes de gestión** arranca su reporte semanal para la dirección y recorre
la agenda entera, catorce meses de turnos, durante **dieciocho minutos**. En
esos dieciocho minutos, la base contesta todo lo demás cuatro veces más
lento. El reporte se entrega al mediodía y describe la semana que ya terminó.

Y un dato más, por si la idea de repartir la grilla todavía sobrevive: la
disponibilidad **está filtrada por el plan de cobertura del paciente y por el
profesional que lo derivó**. Dos pacientes, dos grillas distintas. No hay una
pantalla común para copiar.

El sistema son cinco piezas despiertas y **el presupuesto es seis**: te sobra
una unidad. Es exactamente la unidad que alcanza para meter una copia en
memoria de la disponibilidad, que es lo que todo el mundo propone y lo que acá
no hay que hacer.

**Arreglá los lunes a las ocho, sin pasarte de seis unidades operativas y sin
dejar a la dirección sin su reporte.** La pregunta que resuelve este ejercicio
no es "¿cómo aguanto el pico?". Es "¿qué otra cosa está pasando a esa hora?".

Si le das al informe una fuente nueva, acordate de la otra punta: **una fuente
de datos tiene quien la lea y quien la llene.** Una base que nadie escribe no
falla, no avisa y el lunes al mediodía entrega un reporte vacío.
