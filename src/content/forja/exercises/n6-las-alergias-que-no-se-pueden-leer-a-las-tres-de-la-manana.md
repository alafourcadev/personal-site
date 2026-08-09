---
title: "Las alergias que no se pueden leer a las tres de la mañana"
level: 6
role: core
domain: salud
D1: 2
D2: 2
D3: 2
D4: 2
D5: 2
D6: 1
D7: 3
D8: 0
D9: 3
prerequisiteLevels: [5]
budget:
  opsUnits: 4
aiBudget: "libre, pero tu respuesta tiene que decir qué ve el médico de guardia en la pantalla cuando el registro central no contesta, y de dónde salió eso que ve."
lambda: 0.5
constraints:
  - metric: horas por mes en que el registro central no responde
    operator: ">="
    value: 9
    unit: horas/mes
  - metric: ingresos por guardia entre medianoche y las seis
    operator: ">="
    value: 74
    unit: ingresos/noche
  - metric: presupuesto operativo del equipo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: "la ventana de mantenimiento del registro central provincial es de 01:00 a 04:00, que es exactamente la franja de mayor ingreso por guardia. Son unas 9 horas por mes, siempre de madrugada."
    discoveryPath: "preguntate cuándo se cae la pieza de la que dependés, no sólo cuánto. Un tercero que se apaga justo en tu hora pico no es un tercero poco disponible: es un tercero cuya disponibilidad no está alineada con la tuya."
  - fact: "de la historia clínica completa, lo que la guardia necesita en el primer minuto son dos listas cortas: alergias y medicación actual. El resto se puede consultar después, con calma."
    discoveryPath: "no todo el dato tiene la misma urgencia. Si separás lo que se necesita en el primer minuto de lo que se necesita en la primera hora, la copia local que hace falta es mucho más chica de lo que parecía."
  - fact: "una copia en memoria no sirve acá: el servidor de la guardia se reinicia con los cortes de luz del edificio, y los cortes y la ventana de mantenimiento del central ya coincidieron dos veces."
    discoveryPath: "probá con una copia volátil y preguntate qué queda después de un reinicio. Si la respuesta es «nada», tu plan de contingencia depende de que no fallen dos cosas a la vez, y ya fallaron dos veces."
startingDesign:
  nodes:
    - id: medico
      type: actor
      label: Médico de guardia
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: terminal
      type: web-client
      label: Terminal de guardia
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
    - id: central
      type: external-provider
      label: Registro central provincial
      zone: dmz
      role: central-registry
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: medico-terminal
      from: { node: medico }
      to: { node: terminal }
      dataClass: public
    - id: terminal-gw
      from: { node: terminal }
      to: { node: gw }
      dataClass: personal
    - id: gw-historias
      from: { node: gw }
      to: { node: historias }
      dataClass: personal
    - id: historias-central
      from: { node: historias }
      to: { node: central }
      dataClass: personal
guarantees:
  - id: g-resumen-durable
    label: el resumen crítico queda guardado en algo que sobrevive a un reinicio
    weight: 2
    predicate:
      op: any
      of:
        - op: path
          from:
            role: records-service
          to:
            type: [database]
        - op: path
          from:
            role: records-service
          to:
            type: [object-storage]
    whyMissing: el servicio de historias clínicas no llega a ningún almacenamiento que sobreviva un reinicio. Lo único que sabe de un paciente es lo que el registro central le acaba de contestar.
    consequence: "entre la 01:00 y las 04:00 la guardia atiende sin lista de alergias y sin medicación actual. No hay una pantalla con dato viejo: hay una pantalla con un error, y una decisión clínica que se toma igual."
  - id: g-central-es-la-fuente
    label: el resumen se sigue alimentando del registro central
    weight: 2
    predicate:
      op: path
      from:
        type: [service, worker]
      to:
        role: central-registry
    whyMissing: ninguna pieza del sistema llega al registro central, así que la copia local no tiene de dónde actualizarse ni con qué contrastarse.
    consequence: una alergia que se cargó en otro hospital hace tres semanas nunca llega. El resumen local deja de ser una copia y pasa a ser una versión propia del paciente, que es el problema que el registro central existía para resolver.
  - id: g-lectura-llega-a-la-copia
    label: el pedido de la guardia llega hasta la copia, no sólo hasta el servicio
    weight: 1
    predicate:
      op: any
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            type: [database]
        - op: path
          from:
            type: [api-gateway]
          to:
            type: [object-storage]
    whyMissing: la copia existe pero no está en el camino de lo que la guardia consulta. Quedó colgada al costado y el pedido del médico sigue terminando en el registro central.
    consequence: "tener la contingencia y no usarla es peor que no tenerla: el equipo cree que está cubierto y la pantalla se sigue poniendo en rojo a las tres de la mañana."
rubric:
  - dimension: la contingencia sobrevive a un reinicio, no sólo a la caída del tercero
    signal:
      kind: predicate
      guaranteeId: g-resumen-durable
  - dimension: la copia tiene una fuente y no se convierte en una historia clínica paralela
    signal:
      kind: predicate
      guaranteeId: g-central-es-la-fuente
  - dimension: la copia está en el camino del pedido, no al costado del diagrama
    signal:
      kind: predicate
      guaranteeId: g-lectura-llega-a-la-copia
referenceSolutions:
  - label: tabla local del resumen crítico, escrita por el mismo servicio
    contextInversion: "que el propio servicio escriba y lea una tabla local es lo correcto cuando el resumen se consulta por paciente y por identificador, y cuando querés poder buscarlo, filtrarlo y auditar quién lo leyó con las herramientas que el equipo ya tiene. Menos piezas, un solo lugar donde mirar. El costo es que el servicio hace las dos cosas, atender la guardia y mantener la copia al día, y una sobrecarga en cualquiera de las dos se nota en la otra."
    design:
      nodes:
        - id: medico
          type: actor
          label: Médico de guardia
          zone: public
        - id: terminal
          type: web-client
          label: Terminal de guardia
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
        - id: resumen
          type: database
          label: Resumen crítico local
          zone: restricted
          props: { backup: "diario" }
        - id: central
          type: external-provider
          label: Registro central provincial
          zone: dmz
          role: central-registry
      edges:
        - id: medico-terminal
          from: { node: medico }
          to: { node: terminal }
          dataClass: public
        - id: terminal-gw
          from: { node: terminal }
          to: { node: gw }
          dataClass: personal
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: personal
        - id: historias-resumen
          from: { node: historias }
          to: { node: resumen }
          dataClass: personal
        - id: historias-central
          from: { node: historias }
          to: { node: central }
          dataClass: personal
  - label: archivo de resúmenes mantenido por un sincronizador aparte
    contextInversion: "un archivo de documentos mantenido por una pieza separada conviene cuando el resumen se lee entero y sin consultas, una ficha por paciente que se abre y se muestra, y cuando querés que sincronizar contra el registro central no compita nunca por los recursos que atienden a la guardia: si el sincronizador se traba, la guardia sigue leyendo el archivo. Además el almacenamiento de objetos no suma carga operativa. Se paga con una pieza más para operar y con un resumen que no se puede consultar por criterios, sólo por paciente."
    design:
      nodes:
        - id: medico
          type: actor
          label: Médico de guardia
          zone: public
        - id: terminal
          type: web-client
          label: Terminal de guardia
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
        - id: sincronizador
          type: worker
          label: Sincronizador de resúmenes
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo de resúmenes críticos
          zone: private
        - id: central
          type: external-provider
          label: Registro central provincial
          zone: dmz
          role: central-registry
      edges:
        - id: medico-terminal
          from: { node: medico }
          to: { node: terminal }
          dataClass: public
        - id: terminal-gw
          from: { node: terminal }
          to: { node: gw }
          dataClass: personal
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: personal
        - id: historias-archivo
          from: { node: historias }
          to: { node: archivo }
          dataClass: personal
        - id: historias-sincronizador
          from: { node: historias }
          to: { node: sincronizador }
          dataClass: personal
        - id: sincronizador-central
          from: { node: sincronizador }
          to: { node: central }
          dataClass: personal
        - id: sincronizador-archivo
          from: { node: sincronizador }
          to: { node: archivo }
          dataClass: personal
status: PILOT
---

Un hospital público con **74 ingresos por guardia entre medianoche y las
seis**. Cuando llega un paciente, el médico abre la terminal y el servicio de
historias clínicas le pregunta al registro central provincial por sus
antecedentes.

La ventana de mantenimiento del registro central es de **01:00 a 04:00**.
Son unas **9 horas por mes**, siempre de madrugada, que es exactamente la
franja de mayor ingreso.

En esas horas la terminal no muestra una historia vieja. Muestra un error. Y
la decisión clínica se toma igual, sin la lista de alergias y sin la
medicación actual del paciente.

Eso es lo que la guardia necesita en el primer minuto: **dos listas cortas**.
El resto de la historia (estudios, evoluciones, internaciones anteriores) se
consulta después, con calma, y puede esperar a que el central vuelva.

El jefe de guardia ya intentó algo: pidieron una copia en memoria. Funcionó
hasta que el edificio se quedó sin luz durante la ventana de mantenimiento.
Pasó dos veces. Después de un reinicio, una copia en memoria no tiene nada
que ofrecer.

El equipo tiene **4 unidades operativas** y hoy usa 2.

**Rearmá el sistema** para que la guardia pueda leer el resumen crítico
cuando el registro central no contesta, para que ese resumen siga
alimentándose del central cuando vuelve, y para que sobreviva a un reinicio
del servidor del hospital.
