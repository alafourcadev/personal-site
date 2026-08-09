---
title: "El aviso que no puede salir sin revisar"
level: 10
role: tradeoff
domain: clasificados
tradeoffPairId: n10-moderacion-de-avisos
D1: 2
D2: 3
D3: 3
D4: 3
D5: 2
D6: 3
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 6
  monthlyUsd: 400
aiBudget: "libre, pero tu respuesta tiene que decir cuánto tiempo puede estar visible un aviso todavía no revisado. Si la respuesta es 'ninguno', el diseño tiene que hacerlo cierto."
lambda: 1
constraints:
  - metric: "avisos de alquiler publicados por día"
    operator: ">="
    value: 3400
    unit: avisos
  - metric: "tiempo máximo que un aviso puede estar visible sin revisar"
    operator: "<="
    value: 0
    unit: segundos
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "un fallo de 2023 dejó establecido que el sitio responde por el aviso publicado, no por el aviso revisado. Las once denuncias por seña de un inmueble inexistente salieron de avisos que estuvieron visibles menos de cuatro minutos."
    discoveryPath: "medí cuánto dura el daño, no cuánto dura la revisión. Si el aviso ya está en el catálogo público cuando alguien lo mira, la ventana de exposición deja de ser un parámetro que puedas ajustar: es exactamente lo que tarde la revisión, y en el peor día tarda lo que tarde el proveedor."
  - fact: "el servicio de moderación existe. Lo escribió el equipo el año pasado para las denuncias de usuarios: aplica la política editorial del sitio y sabe rechazar, pedir corrección o aprobar."
    discoveryPath: "está en el lienzo sin ninguna conexión. Que hoy lo dispare una denuncia y no una publicación es una conexión que nadie dibujó, no una limitación de la pieza."
  - fact: "lo que se manda a revisar es el texto del aviso y las fotos. El teléfono del anunciante se guarda aparte y no forma parte del pedido que sale hacia el proveedor."
    discoveryPath: "mirá qué dato declara la conexión que entra al modelo. Que el aviso sea contenido público es lo que permite que el modelo sea del proveedor y no propio; si por ahí viajara el contacto, esa decisión se caía sola."
  - fact: "publicar tarde acá casi no cuesta: el 78 % de los avisos de alquiler se cargan de noche y se miran a la mañana siguiente. Nadie está esperando que su aviso salga en el segundo siguiente."
    discoveryPath: "preguntá cuánto vale un minuto de demora en este negocio concreto. La respuesta cambia todo el diseño, y no es la misma en todos los mercados de este mismo sitio."
startingDesign:
  nodes:
    - id: anunciante
      type: actor
      label: "Anunciante"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: "Sitio de clasificados"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: publicacion
      type: service
      label: "Servicio de publicación de avisos"
      zone: private
      role: publicacion
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: catalogo
      type: database
      label: "Catálogo público de avisos"
      zone: restricted
      role: catalogo
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
    - id: moderador
      type: service
      label: "Servicio de moderación editorial"
      zone: private
      role: moderador
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: modelo
      type: ai-model
      label: "Modelo de revisión de contenido del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
  edges:
    - id: anunciante-web
      from: { node: anunciante }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-publicacion
      from: { node: gw }
      to: { node: publicacion }
      dataClass: personal
    - id: publicacion-catalogo
      from: { node: publicacion }
      to: { node: catalogo }
      dataClass: public
guarantees:
  - id: g-la-revision-ocurre-en-la-misma-operacion
    label: "hay un camino desde la publicación hasta el modelo que no pasa por ninguna cola ni ningún registro de eventos"
    weight: 3
    predicate:
      op: path
      from:
        role: publicacion
      to:
        type: [ai-model]
      forbid:
        type: [queue, stream]
    whyMissing: "no existe ningún camino desde el servicio de publicación hasta el modelo, o el único que existe atraviesa una pieza que difiere el trabajo para más tarde."
    consequence: "cuando la revisión se difiere, el aviso ya está publicado mientras espera turno. En este sitio eso es exactamente la denuncia: once señas cobradas sobre inmuebles inexistentes, todas de avisos visibles menos de cuatro minutos. El sitio responde por lo publicado, no por lo revisado."
  - id: g-lo-publicado-paso-por-el-moderador
    label: "todo lo que llega al catálogo público pasó antes por el servicio de moderación"
    weight: 3
    predicate:
      op: path
      from:
        role: publicacion
      to:
        role: catalogo
      via:
        role: moderador
    whyMissing: "no hay ningún camino desde el servicio de publicación hasta el catálogo público que atraviese el servicio de moderación."
    consequence: "el modelo devuelve una opinión, no una decisión. La política editorial (qué se puede decir de un barrio, qué se puede pedir como garantía, qué no) la aplica el moderador, y es la pieza que el equipo puede cambiar un martes sin renegociar con nadie. Sin ella en el camino, la política del sitio pasa a ser la del proveedor."
  - id: g-sin-atajo-al-catalogo-publico
    label: "el servicio de publicación no escribe directo en el catálogo público"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: publicacion
      to:
        role: catalogo
    whyMissing: "el servicio de publicación escribe directo en el catálogo público, así que el camino revisado es apenas una opción entre dos."
    consequence: "mientras el atajo exista, alcanza un caso que nadie previó, un aviso reeditado o una carga por lote de una inmobiliaria, para que algo llegue al catálogo sin haber sido revisado. Y ese es precisamente el aviso que nadie miró."
rubric:
  - dimension: "ningún aviso está visible antes de ser revisado"
    signal:
      kind: predicate
      guaranteeId: g-la-revision-ocurre-en-la-misma-operacion
  - dimension: "la política editorial la decide el sitio, no el proveedor"
    signal:
      kind: predicate
      guaranteeId: g-lo-publicado-paso-por-el-moderador
  - dimension: "no queda ningún camino sin revisar hacia el catálogo"
    signal:
      kind: predicate
      guaranteeId: g-sin-atajo-al-catalogo-publico
referenceSolutions:
  - label: "el moderador es la única puerta al proveedor y el único que publica"
    contextInversion: "concentrar todo en el moderador conviene cuando lo que más te preocupa es no equivocarte dos veces con el mismo proveedor: hay un solo lugar donde se llama al modelo, un solo lugar donde se limita el gasto y un solo lugar donde se cambia de proveedor sin tocar la publicación. Se paga con que el moderador queda en el camino crítico de los 3.400 avisos diarios: si se cae, no se publica nada, ni siquiera lo que el modelo ya había aprobado."
    design:
      nodes:
        - id: anunciante
          type: actor
          label: "Anunciante"
          zone: public
        - id: web
          type: web-client
          label: "Sitio de clasificados"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: publicacion
          type: service
          label: "Servicio de publicación de avisos"
          zone: private
          role: publicacion
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: moderador
          type: service
          label: "Servicio de moderación editorial"
          zone: private
          role: moderador
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de revisión de contenido del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: catalogo
          type: database
          label: "Catálogo público de avisos"
          zone: restricted
          role: catalogo
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
      edges:
        - id: anunciante-web
          from: { node: anunciante }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-publicacion
          from: { node: gw }
          to: { node: publicacion }
          dataClass: personal
        - id: publicacion-moderador
          from: { node: publicacion }
          to: { node: moderador }
          dataClass: public
        - id: moderador-modelo
          from: { node: moderador }
          to: { node: modelo }
          dataClass: public
        - id: moderador-catalogo
          from: { node: moderador }
          to: { node: catalogo }
          dataClass: public
  - label: "publicación consulta al modelo y el moderador aplica la política"
    contextInversion: "que la publicación consulte al modelo por su cuenta conviene cuando querés que la política editorial no dependa del proveedor ni un segundo: el moderador nunca habla con un tercero, así que se puede auditar y cambiar sin mirar contratos, y el día que el proveedor no contesta, publicación decide sola mandar todo a revisión estricta en vez de quedarse esperando. Se paga con que la llamada al proveedor queda en la pieza más caliente del sistema, la que recibe los 3.400 avisos, y con que el límite de llamadas hay que administrarlo ahí, donde también vive el pico de tráfico."
    design:
      nodes:
        - id: anunciante
          type: actor
          label: "Anunciante"
          zone: public
        - id: web
          type: web-client
          label: "Sitio de clasificados"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: publicacion
          type: service
          label: "Servicio de publicación de avisos"
          zone: private
          role: publicacion
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de revisión de contenido del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: moderador
          type: service
          label: "Servicio de moderación editorial"
          zone: private
          role: moderador
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: catalogo
          type: database
          label: "Catálogo público de avisos"
          zone: restricted
          role: catalogo
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
      edges:
        - id: anunciante-web
          from: { node: anunciante }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-publicacion
          from: { node: gw }
          to: { node: publicacion }
          dataClass: personal
        - id: publicacion-modelo
          from: { node: publicacion }
          to: { node: modelo }
          dataClass: public
        - id: publicacion-moderador
          from: { node: publicacion }
          to: { node: moderador }
          dataClass: public
        - id: moderador-catalogo
          from: { node: moderador }
          to: { node: catalogo }
          dataClass: public
status: PILOT
---

Un sitio de clasificados publica **3.400 avisos de alquiler por día**. Hoy el
aviso sale en el momento: el anunciante aprieta publicar y el aviso queda
visible.

En 2023 un fallo dejó establecido que **el sitio responde por el aviso
publicado, no por el aviso revisado**. Las once denuncias que llegaron después,
señas cobradas por inmuebles que no existían, salieron de avisos que
estuvieron visibles **menos de cuatro minutos**. Cuatro minutos alcanzaron.

El equipo tiene el **servicio de moderación editorial** desde el año pasado.
Aplica la política del sitio: qué se puede decir de un barrio, qué garantías se
pueden exigir, qué fotos no corresponden al inmueble. Hoy se dispara con una
denuncia de un usuario, o sea siempre después. Está en el lienzo sin ninguna
conexión.

Y está el **modelo de revisión de contenido del proveedor**, que lee el texto y
las fotos y marca lo sospechoso. Lo que se le manda es el aviso: el teléfono
del anunciante se guarda aparte y no viaja. Esa es la razón por la que el
modelo puede ser de un tercero y no tiene que correr adentro.

El dato que ordena todo lo demás: **el 78 % de estos avisos se cargan de noche y
se miran a la mañana siguiente**. Publicar tres minutos más tarde acá no le
cuesta nada a nadie. Publicar un aviso falso cuesta una denuncia penal.

El equipo tiene un techo de **6 unidades operativas** y hoy usa 5. Una pieza
más y el diseño deja de ser sostenible: no hay lugar para inventar
infraestructura.

**Rearmá el sistema** para que ningún aviso pueda estar visible antes de haber
sido revisado, y para que la decisión final la siga tomando la política del
sitio y no la opinión del proveedor.
