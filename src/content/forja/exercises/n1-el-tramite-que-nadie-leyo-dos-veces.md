---
title: "El trámite que nadie leyó dos veces"
level: 1
role: synthesis
domain: gobierno
D1: 1
D2: 2
D3: 2
D4: 1
D5: 2
D6: 1
D7: 0
D8: 0
D9: 1
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: 'libre para redactar y para explicarte términos. Cerrada para lo único que importa acá: cuál de las cinco líneas del pliego es un requisito y cuál es una preferencia. Eso se decide leyendo quién firmó cada una, y eso no está en ningún modelo.'
lambda: 0.5
constraints:
  - metric: tiempo que el expediente tiene que poder consultarse
    operator: ">="
    value: 10
    unit: años
  - metric: puntos de entrada donde no se verifica la identidad del ciudadano
    operator: "="
    value: 0
    unit: puntos de entrada
  - metric: tiempo aceptable para consultar el estado de un trámite
    operator: "<="
    value: 3
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: el presupuesto operativo alcanza justo. La pieza que nadie justificó está ocupando exactamente el lugar que necesita la pieza que el pliego sí pide.
    discoveryPath: contá las piezas que cuestan del diagrama actual y compará con el presupuesto declarado. Después contá las que necesitás para cumplir las tres garantías que fallan. El número cierra sólo si sacás una.
  - fact: el listado de rubros habilitados, consultado contra el registro, tarda 240 milisegundos. El pliego acepta 3 segundos.
    discoveryPath: 'buscá el número medido en el enunciado y el número exigido. Cuando el medido entra doce veces en el exigido, la pieza que se agregó para acelerarlo no está cumpliendo ningún requisito: está ocupando presupuesto.'
  - fact: el pliego tiene cinco puntos y sólo tres los firmó el consejo municipal. Los otros dos los agregó el proveedor que lo armó.
    discoveryPath: mirá quién firma cada línea en el enunciado. Un requisito con firma se puede exigir en una auditoría; una preferencia sin firma es la opinión de alguien que ya cobró.
startingDesign:
  nodes:
    - id: ciudadano
      type: actor
      label: Ciudadano
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de trámites
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: tramites
      type: service
      label: Servicio de habilitaciones
      zone: private
      role: permits-service
      given: true
      position: { x: 445, y: 300 }
    - id: copia
      type: cache
      label: Copia rápida de rubros
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: ciudadano-app
      from: { node: ciudadano }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-tramites
      from: { node: gw }
      to: { node: tramites }
      dataClass: personal
    - id: tramites-copia
      from: { node: tramites }
      to: { node: copia }
      dataClass: public
guarantees:
  - id: g-expediente-durable
    label: el expediente queda en un lugar que sobrevive a un reinicio
    weight: 2
    predicate:
      op: path
      from:
        role: permits-service
      to:
        type: [database, object-storage]
    whyMissing: el servicio de habilitaciones no llega a ningún lugar durable. Recibe el trámite, lo procesa y no lo escribe en ninguna parte que dure más que el proceso.
    consequence: el pliego exige poder consultar el expediente durante diez años. Hoy el expediente dura lo que dura el proceso. El despliegue de la noche lo borra, y el ciudadano que vuelva a preguntar en 2036 no va a encontrar nada que la municipalidad pueda mostrarle.
  - id: g-identidad-en-la-puerta
    label: toda puerta de entrada verifica quién es el ciudadano
    weight: 2
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
    whyMissing: la puerta de entrada no está conectada a ninguna pieza que verifique identidad. Deja pasar a cualquiera que sepa la forma de la petición.
    consequence: 'una habilitación comercial se otorga a una persona con nombre y documento. Sin verificación en la puerta, el sistema no puede distinguir al titular del que dice ser el titular, y eso no se descubre cuando pasa: se descubre en la auditoría, dos años después, sin manera de reconstruir quién hizo qué.'
  - id: g-ciudadano-tramita
    label: el ciudadano sigue llegando al servicio por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [mobile-client, web-client]
      to:
        role: permits-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde la app de trámites hasta el servicio de habilitaciones que pase por la puerta de entrada.
    consequence: el pliego también dice que el trámite se hace desde el celular. Un sistema perfectamente archivado y perfectamente auditado al que nadie puede entrar no cumple el primero de los cinco puntos.
  - id: g-sin-la-pieza-que-nadie-pidio
    label: el sistema no arrastra la copia que nadie justificó
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: permits-service
      to:
        type: [cache]
    whyMissing: el servicio de habilitaciones se apoya en una copia rápida de rubros que ninguna de las tres líneas firmadas pide, y que consume el presupuesto operativo que sí necesitan las que faltan.
    consequence: 'la consulta contra el registro tarda 240 ms y el pliego acepta 3 segundos: esa pieza no está resolviendo nada. Lo que sí hace es ocupar el lugar de la verificación de identidad, que sí está firmada. El costo de una preferencia no se paga en la preferencia: se paga en el requisito que se queda afuera.'
rubric:
  - dimension: el expediente se puede consultar dentro de diez años
    signal:
      kind: predicate
      guaranteeId: g-expediente-durable
  - dimension: no queda ninguna entrada sin verificación de identidad
    signal:
      kind: predicate
      guaranteeId: g-identidad-en-la-puerta
  - dimension: el ciudadano sigue pudiendo iniciar el trámite
    signal:
      kind: predicate
      guaranteeId: g-ciudadano-tramita
  - dimension: separar lo firmado de lo agregado, y actuar en consecuencia
    signal:
      kind: predicate
      guaranteeId: g-sin-la-pieza-que-nadie-pidio
referenceSolutions:
  - label: el expediente en una base consultable
    contextInversion: 'la base gana cuando la municipalidad necesita responder preguntas sobre el conjunto: cuántas habilitaciones hay abiertas por rubro, cuáles vencen este mes, qué expedientes lleva parados el mismo inspector. Eso es una consulta, no un recorrido. Se paga con la unidad operativa completa y con la obligación de respaldar de verdad: una base con expedientes y sin copia convierte la retención a diez años en una afirmación sin nada detrás.'
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: app
          type: mobile-client
          label: App de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: identidad
          type: identity-provider
          label: Verificación de identidad
          zone: dmz
        - id: tramites
          type: service
          label: Servicio de habilitaciones
          zone: private
          role: permits-service
        - id: expedientes
          type: database
          label: Base de expedientes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: ciudadano-app
          from: { node: ciudadano }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: personal
        - id: gw-tramites
          from: { node: gw }
          to: { node: tramites }
          dataClass: personal
        - id: tramites-expedientes
          from: { node: tramites }
          to: { node: expedientes }
          dataClass: regulated
  - label: el expediente como legajo de documentos
    contextInversion: 'guardar el expediente como legajo gana cuando lo que el pliego exige conservar son documentos que casi nadie abre después de otorgada la habilitación: el plano firmado, el certificado de bomberos, la cédula escaneada. Se escribe una vez, no se modifica nunca, cuesta cero unidades operativas y deja una libre para lo que venga. Se paga con que "todas las habilitaciones de gastronomía vencidas" deja de ser una consulta y pasa a ser un recorrido carpeta por carpeta.'
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Ciudadano
          zone: public
        - id: app
          type: mobile-client
          label: App de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: identidad
          type: identity-provider
          label: Verificación de identidad
          zone: dmz
        - id: tramites
          type: service
          label: Servicio de habilitaciones
          zone: private
          role: permits-service
        - id: legajos
          type: object-storage
          label: Legajos de expedientes
          zone: private
      edges:
        - id: ciudadano-app
          from: { node: ciudadano }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: personal
        - id: gw-tramites
          from: { node: gw }
          to: { node: tramites }
          dataClass: personal
        - id: tramites-legajos
          from: { node: tramites }
          to: { node: legajos }
          dataClass: regulated
status: PILOT
---

Una municipalidad de **280.000 habitantes** digitalizó la habilitación
comercial. El comerciante entra desde el celular, carga los papeles y sigue el
estado del expediente. **1.900 trámites por año**.

El pliego que llegó al equipo tiene cinco puntos bajo el título "Requisitos":

> 1. *El trámite se inicia desde el celular del ciudadano.* **Firmado por el consejo municipal.**
> 2. *El expediente debe poder consultarse durante diez años.* **Firmado por el consejo municipal.**
> 3. *Se entra por un único punto, donde se verifica la identidad del ciudadano.* **Firmado por el consejo municipal.**
> 4. *El listado de rubros debe cargar instantáneamente.* Lo agregó el proveedor que armó el pliego.
> 5. *Se usará una copia en memoria para acelerar las consultas.* Lo agregó el mismo proveedor.

Cinco líneas, un solo título, y el título dice "Requisitos" para todas. Ese es
el problema del nivel entero: **un enunciado no viene marcado**. Nadie te avisa
cuál línea se puede exigir en una auditoría y cuál es la opinión de alguien que
ya cobró.

Los números que existen: el listado de rubros contra el registro tarda **240
milisegundos**; el punto 4 no dice cuánto es "instantáneamente", y el requisito
de tiempo que sí está firmado en otra parte del pliego acepta **3 segundos**.

Ahora mirá el diagrama. Lo único que se implementó de los cinco puntos es el
quinto. El expediente no queda en ningún lado. La puerta de entrada no verifica
nada. Y el presupuesto operativo es de **4 unidades**, y ya tiene tres ocupadas, una
de ellas por la copia.

Hacé la cuenta antes de dibujar. Ese es el ejercicio.

**Rearmá el sistema para que cumpla los tres puntos firmados**, dentro del
presupuesto. Vas a descubrir que la única forma de que entren es sacar lo que
nadie firmó. Y que ese es, casi siempre, el trabajo real de leer un
requisito.
