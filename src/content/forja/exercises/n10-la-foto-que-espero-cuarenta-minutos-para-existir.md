---
title: "La foto que esperó cuarenta minutos para existir"
level: 10
role: tradeoff
domain: clasificados
tradeoffPairId: n10-moderacion-de-avisos
D1: 2
D2: 3
D3: 3
D4: 2
D5: 3
D6: 3
D7: 3
D8: 2
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 8
  monthlyUsd: 550
aiBudget: "libre, pero tu respuesta tiene que decir qué ve el vendedor en el segundo siguiente a tocar publicar, y qué pasa con su aviso mientras el proveedor está saturado."
lambda: 0.7
constraints:
  - metric: "publicaciones el domingo de feria"
    operator: ">="
    value: 40000
    unit: publicaciones
  - metric: "llamadas por segundo que acepta el proveedor del modelo"
    operator: "<="
    value: 60
    unit: llamadas
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: "el 61 % de las ventas de la feria de usados ocurre en los primeros veinte minutos de publicado el aviso. Un aviso que aparece cuarenta minutos tarde entra a competir con otros ochocientos."
    discoveryPath: "preguntá qué le pasa al negocio cuando la publicación se demora, no cuándo se rompe. En este mercado la demora no degrada la experiencia: cancela la venta, y eso no aparece en ningún error de la aplicación."
  - fact: "el modelo del proveedor acepta 60 llamadas por segundo. El domingo de la feria entran 40.000 publicaciones en tres horas, con picos de 90 por segundo."
    discoveryPath: "dividí el pico por el límite del proveedor. Si el pedido de revisión sale en el mismo momento en que el vendedor publica, el sistema le pide al proveedor más de lo que aceptó darte, y lo que sobra vuelve como rechazo."
  - fact: "el daño acá es reversible. Un aviso dado de baja a los cuatro minutos no dejó una operación cerrada: el marketplace retiene el pago hasta la entrega y la cancelación devuelve el dinero completo."
    discoveryPath: "preguntá qué pasa después de bajar un aviso malo. Si el dinero todavía no cambió de manos, la revisión posterior repara de verdad; si ya cambió, no repara nada. Es la misma decisión que en el alquiler y la respuesta se da vuelta."
  - fact: "el equipo de fraude son tres personas y hoy no recibe nada del sistema: se enteran por los reclamos de los compradores, dos días después."
    discoveryPath: "está en el lienzo y no le entra ninguna conexión. Un camino que hoy no existe no se puede usar el día que el modelo marca algo dudoso y hace falta que lo mire una persona."
startingDesign:
  nodes:
    - id: vendedor
      type: actor
      label: "Vendedor"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: "App del marketplace"
      zone: public
      given: true
      props: { connectivity: "intermittent", offlineCapable: "no" }
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
    - id: moderador
      type: service
      label: "Servicio de moderación editorial"
      zone: private
      role: moderador
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 520 }
    - id: modelo
      type: ai-model
      label: "Modelo de revisión de contenido del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 630 }
    - id: catalogo
      type: database
      label: "Catálogo público de avisos"
      zone: restricted
      role: catalogo
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
    - id: fraude
      type: worker
      label: "Equipo de fraude"
      zone: private
      role: mesa
      given: true
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 300 }
  edges:
    - id: vendedor-app
      from: { node: vendedor }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
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
guarantees:
  - id: g-el-pedido-de-revision-sobrevive-al-pico
    label: "el pedido de revisión queda escrito en algo que sobrevive a un reinicio antes de llegar al modelo"
    weight: 3
    predicate:
      op: noVolatileCut
      from:
        role: publicacion
      to:
        type: [ai-model]
    whyMissing: "entre el servicio de publicación y el modelo no hay ninguna pieza que sobreviva a un reinicio: el pedido existe sólo mientras el proceso que lo atiende siga vivo."
    consequence: "el domingo de la feria entran 90 publicaciones por segundo contra un proveedor que acepta 60. Los 30 que sobran vuelven como rechazo y, si el pedido no quedó escrito en ningún lado, ese aviso no se revisa nunca: queda publicado y sin revisar, que es justo lo contrario de lo que se buscaba."
  - id: g-el-aviso-se-publica-sin-esperar-la-revision
    label: "el aviso llega al catálogo público por un camino que no atraviesa la moderación"
    weight: 3
    predicate:
      op: path
      from:
        role: publicacion
      to:
        role: catalogo
      forbid:
        role: moderador
    whyMissing: "todo camino desde el servicio de publicación hasta el catálogo público pasa por el servicio de moderación, así que el aviso no existe hasta que la revisión termina."
    consequence: "el 61 % de las ventas ocurre en los primeros veinte minutos del aviso. Cuando la revisión se pone en el camino, la demora del proveedor se convierte en demora de publicación, y una demora de publicación acá no molesta: cancela la venta. El vendedor no vuelve a probar más tarde, se va a otro sitio."
  - id: g-lo-dudoso-llega-a-una-persona
    label: "hay un camino desde la publicación hasta el equipo de fraude"
    weight: 2
    predicate:
      op: path
      from:
        role: publicacion
      to:
        role: mesa
    whyMissing: "no hay ningún camino desde el servicio de publicación hasta el equipo de fraude, que hoy está en el lienzo sin recibir nada."
    consequence: "revisar después sólo repara si alguien puede actuar sobre lo que se encontró. Sin ese camino, el modelo marca un aviso como dudoso y esa marca no llega a ninguna parte: las tres personas del equipo de fraude se siguen enterando por el reclamo del comprador, dos días tarde."
rubric:
  - dimension: "el pico del proveedor no se lleva pedidos de revisión"
    signal:
      kind: predicate
      guaranteeId: g-el-pedido-de-revision-sobrevive-al-pico
  - dimension: "el vendedor ve su aviso publicado en el momento"
    signal:
      kind: predicate
      guaranteeId: g-el-aviso-se-publica-sin-esperar-la-revision
  - dimension: "lo que el modelo marca termina en manos de alguien"
    signal:
      kind: predicate
      guaranteeId: g-lo-dudoso-llega-a-una-persona
referenceSolutions:
  - label: "una cola para revisar y otra para el equipo de fraude"
    contextInversion: "encadenar dos colas conviene cuando cada aviso tiene que ser trabajado exactamente una vez: el que revisa toma su mensaje, y sólo lo que resultó dudoso se le pasa al equipo de fraude, que son tres personas y no pueden mirar 40.000 avisos. El costo de revisar no crece con el trabajo humano. Se paga con las ocho unidades operativas completas, el techo exacto, y con que el equipo de fraude sólo ve lo que el proceso de revisión decidió mandarle: si esa regla está mal calibrada, nadie afuera lo nota."
    design:
      nodes:
        - id: vendedor
          type: actor
          label: "Vendedor"
          zone: public
        - id: app
          type: mobile-client
          label: "App del marketplace"
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
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
        - id: catalogo
          type: database
          label: "Catálogo público de avisos"
          zone: restricted
          role: catalogo
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: cola
          type: queue
          label: "Cola de avisos por revisar"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: revisor
          type: worker
          label: "Proceso de revisión de avisos"
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: modelo
          type: ai-model
          label: "Modelo de revisión de contenido del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: coladudosos
          type: queue
          label: "Cola de avisos dudosos"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: fraude
          type: worker
          label: "Equipo de fraude"
          zone: private
          role: mesa
          props: { idempotent: "sí", retryPolicy: "exponential" }
      edges:
        - id: vendedor-app
          from: { node: vendedor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
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
        - id: publicacion-cola
          from: { node: publicacion }
          to: { node: cola }
          dataClass: public
        - id: cola-revisor
          from: { node: cola }
          to: { node: revisor }
          dataClass: public
        - id: revisor-modelo
          from: { node: revisor }
          to: { node: modelo }
          dataClass: public
        - id: revisor-catalogo
          from: { node: revisor }
          to: { node: catalogo }
          dataClass: public
        - id: revisor-coladudosos
          from: { node: revisor }
          to: { node: coladudosos }
          dataClass: public
        - id: coladudosos-fraude
          from: { node: coladudosos }
          to: { node: fraude }
          dataClass: public
  - label: "un registro de publicaciones con dos lectores independientes"
    contextInversion: "un registro de eventos conviene cuando querés que el equipo de fraude no dependa de lo que el proceso automático decida contarle: los dos leen la misma publicación, cada uno a su ritmo, y el humano puede mirar por su cuenta la categoría que se le antoje esta semana. Además queda una unidad operativa libre bajo el techo. Se paga con que el equipo de fraude recibe las 40.000 publicaciones del domingo y necesita su propio criterio para filtrarlas: nadie se lo dio ya masticado."
    design:
      nodes:
        - id: vendedor
          type: actor
          label: "Vendedor"
          zone: public
        - id: app
          type: mobile-client
          label: "App del marketplace"
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "no" }
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
        - id: catalogo
          type: database
          label: "Catálogo público de avisos"
          zone: restricted
          role: catalogo
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: flujo
          type: stream
          label: "Registro de avisos publicados"
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: revisor
          type: worker
          label: "Proceso de revisión de avisos"
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: modelo
          type: ai-model
          label: "Modelo de revisión de contenido del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: fraude
          type: worker
          label: "Equipo de fraude"
          zone: private
          role: mesa
          props: { idempotent: "sí", retryPolicy: "exponential" }
      edges:
        - id: vendedor-app
          from: { node: vendedor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
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
        - id: publicacion-flujo
          from: { node: publicacion }
          to: { node: flujo }
          dataClass: public
        - id: flujo-revisor
          from: { node: flujo }
          to: { node: revisor }
          dataClass: public
        - id: revisor-modelo
          from: { node: revisor }
          to: { node: modelo }
          dataClass: public
        - id: revisor-catalogo
          from: { node: revisor }
          to: { node: catalogo }
          dataClass: public
        - id: flujo-fraude
          from: { node: flujo }
          to: { node: fraude }
          dataClass: public
status: PILOT
---

El mismo sitio, otro mercado. La **feria de usados** publica **40.000 avisos en
tres horas** el domingo que arranca: alguien saca una foto de una bicicleta, le
pone precio y toca publicar.

Hoy el aviso espera. El servicio de publicación llama a la moderación, la
moderación llama al modelo del proveedor, y recién cuando vuelve la respuesta
el aviso aparece. El domingo pasado ese camino tardó **cuarenta minutos** en el
pico.

Dos números explican por qué eso es un problema distinto al del alquiler. El
primero: **el 61 % de las ventas ocurre en los primeros veinte minutos** de
publicado el aviso. Cuarenta minutos tarde el aviso entra a competir con otros
ochocientos, y el vendedor no vuelve a probar: publica en otro sitio. El
segundo: el proveedor acepta **60 llamadas por segundo** y el domingo entran
picos de **90**. Los treinta que sobran vuelven como rechazo, y hoy ese rechazo
se pierde: nadie vuelve a pedir esa revisión.

Y hay un tercer dato, que es el que da vuelta la decisión: **acá el daño es
reversible**. El marketplace retiene el pago hasta la entrega. Un aviso falso
dado de baja a los cuatro minutos no dejó ninguna operación cerrada: se cancela
y el dinero vuelve completo. No es el alquiler, donde la seña ya se fue por
transferencia y no hay a quién reclamarle.

El **equipo de fraude** son tres personas. Hoy no reciben nada del sistema: se
enteran por el reclamo del comprador, dos días después. Están en el lienzo sin
ninguna conexión.

El equipo tiene un techo de **8 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que el vendedor vea su aviso publicado en el
momento, para que ningún pedido de revisión se pierda cuando el proveedor
rechaza por saturación, y para que lo que el modelo marca como dudoso termine
en manos de alguien que pueda bajarlo.
