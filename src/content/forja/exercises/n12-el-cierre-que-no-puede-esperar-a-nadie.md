---
title: "El cierre que no puede esperar a nadie"
level: 12
role: tradeoff
domain: medios
tradeoffPairId: liderazgo-la-pieza-que-se-defiende
D1: 2
D2: 4
D3: 3
D4: 3
D5: 3
D6: 4
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 4
aiBudget: "libre. Lo que no delegues es la frase con la que le explicás al responsable de la caída anterior por qué le vas a sacar la pieza que él puso. Esa frase es el ejercicio."
lambda: 4.0
constraints:
  - metric: tiempo entre que el editor aprieta publicar y la nota está visible
    operator: "<="
    value: 5
    unit: segundos
  - metric: ventaja media sobre el segundo medio que publica la misma noticia
    operator: "<="
    value: 40
    unit: segundos
  - metric: presupuesto operativo de la redacción
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: "la cadena de publicación que trae el ejercicio se agregó después de una caída del almacenamiento en marzo. Funcionó: desde entonces no se perdió ninguna nota. También agregó entre 40 segundos y 4 minutos al cierre, según cuánto trabajo tenga el proceso de fondo."
    discoveryPath: "es la pieza que el ejercicio te pide sacar. No la sacás porque esté mal hecha: la sacás porque en este contexto su beneficio vale menos que su costo, y eso hay que poder decirlo con los dos números."
  - fact: "la redacción sostiene cuatro piezas. Hoy hay cinco, y ninguna es un componente de monitoreo."
    discoveryPath: "probá el diseño tal como viene: el motor te dice cuánto cuesta el sobrepaso, y con este acantilado de presupuesto cuesta casi todo el puntaje."
  - fact: "un medio que llega segundo a una noticia de alcance nacional pierde alrededor del 70 % del tráfico de esa nota, y ese tráfico no se recupera después."
    discoveryPath: "está en la segunda restricción, y es la razón por la que el retraso del cierre no es una molestia operativa: es la métrica del negocio."
startingDesign:
  nodes:
    - id: lector
      type: actor
      label: Lector
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: sitio
      type: web-client
      label: Sitio del medio
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: redaccion
      type: service
      label: Servicio de publicación
      zone: private
      role: publishing-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: notas
      type: database
      label: Base de notas
      zone: restricted
      role: story-store
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 520 }
    - id: cola
      type: queue
      label: Cola de publicaciones
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "no", ordering: "no" }
      position: { x: 805, y: 410 }
    - id: publicador
      type: worker
      label: Publicador de fondo
      zone: private
      given: true
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 300 }
    - id: estatico
      type: object-storage
      label: Almacén de páginas
      zone: private
      given: true
      props: { durability: "99.999999999", access: "signed" }
      position: { x: 805, y: 630 }
    - id: borde
      type: cdn
      label: Red de distribución
      zone: dmz
      role: edge
      given: true
      props: { cacheControl: "public, max-age=60" }
      position: { x: 805, y: 190 }
  edges:
    - id: lector-sitio
      from: { node: lector }
      to: { node: sitio }
      dataClass: public
    - id: sitio-gw
      from: { node: sitio }
      to: { node: gw }
      dataClass: public
    - id: gw-redaccion
      from: { node: gw }
      to: { node: redaccion }
      dataClass: public
    - id: redaccion-notas
      from: { node: redaccion }
      to: { node: notas }
      dataClass: public
    - id: redaccion-cola
      from: { node: redaccion }
      to: { node: cola }
      dataClass: public
    - id: cola-publicador
      from: { node: cola }
      to: { node: publicador }
      dataClass: public
    - id: publicador-estatico
      from: { node: publicador }
      to: { node: estatico }
      dataClass: public
    - id: estatico-borde
      from: { node: estatico }
      to: { node: borde }
      dataClass: public
guarantees:
  - id: g-direct-publish
    label: la nota llega a la red de distribución sin pasar por nada que pueda tener trabajo pendiente
    weight: 3
    predicate:
      op: path
      from:
        role: publishing-service
      to:
        role: edge
      forbid:
        type: [queue, stream]
    whyMissing: no hay un camino desde el servicio de publicación hasta la red de distribución que no atraviese una cola o un registro de eventos.
    consequence: "una cola publica cuando llega a ese mensaje, no cuando el editor aprieta el botón. En marzo eso costó entre 40 segundos y 4 minutos por nota, y un medio que llega segundo a una noticia nacional pierde el 70 % del tráfico de esa nota para siempre."
  - id: g-no-buffer
    label: ningún servicio deja trabajo pendiente en el camino de la publicación
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service]
      to:
        type: [queue, stream]
    whyMissing: hay un servicio que publica en una cola o en un registro de eventos, y en este ejercicio ese intermediario está en el camino del cierre.
    consequence: "mientras el intermediario exista, alguien lo va a usar, y el día de la noticia grande es justo el día en que más trabajo pendiente tiene. La pieza que te protege del pico es la que te falla en el pico."
  - id: g-story-store
    label: la nota sigue guardándose en la base de notas
    weight: 1
    predicate:
      op: path
      from:
        role: publishing-service
      to:
        role: story-store
    whyMissing: no quedó ningún camino desde el servicio de publicación hasta la base de notas.
    consequence: "publicar rápido no puede significar publicar sin guardar. La red de distribución sirve copias; el original vive en la base, y si el original no existe la nota no se puede corregir, ni versionar, ni recuperar."
  - id: g-observed
    label: el servicio de publicación reporta lo que le pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: publishing-service
      by:
        type: [observability]
    whyMissing: el servicio de publicación no está conectado a ningún componente de monitoreo.
    consequence: "si sacás la pieza que absorbía los picos, el pico ahora lo recibe el servicio. Sacar el amortiguador sin poner el medidor es la forma más rápida de descubrir un límite: chocándose contra él."
rubric:
  - dimension: el cierre no depende de trabajo pendiente de nadie
    signal:
      kind: predicate
      guaranteeId: g-direct-publish
  - dimension: no queda un intermediario que alguien vuelva a usar
    signal:
      kind: predicate
      guaranteeId: g-no-buffer
  - dimension: la velocidad no se compró perdiendo el original
    signal:
      kind: predicate
      guaranteeId: g-story-store
  - dimension: el nuevo límite es medible antes de alcanzarlo
    signal:
      kind: predicate
      guaranteeId: g-observed
referenceSolutions:
  - label: el servicio publica directo en la red de distribución
    contextInversion: "publicar directo se defiende cuando el valor de la nota vence en minutos: son cero piezas intermedias, cero trabajo pendiente posible, y el editor ve el resultado del botón que apretó. Al responsable del arreglo de marzo le decís que su cadena hizo exactamente lo que tenía que hacer, porque desde entonces no se perdió ninguna nota, y que el contexto cambió: el medio pasó de perder notas a perder primicias, y las primicias no se recuperan a la mañana siguiente. Lo que aceptás a cambio, dicho en la misma reunión: si la red de distribución no está disponible en el instante del cierre, esa publicación falla y hay que rehacerla a mano. Es un riesgo de minutos contra una pérdida de tráfico permanente."
    design:
      nodes:
        - id: lector
          type: actor
          label: Lector
          zone: public
        - id: sitio
          type: web-client
          label: Sitio del medio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: redaccion
          type: service
          label: Servicio de publicación
          zone: private
          role: publishing-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: notas
          type: database
          label: Base de notas
          zone: restricted
          role: story-store
          props: { backup: "diario", consistency: "strong" }
        - id: borde
          type: cdn
          label: Red de distribución
          zone: dmz
          role: edge
          props: { cacheControl: "public, max-age=60" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-sitio
          from: { node: lector }
          to: { node: sitio }
          dataClass: public
        - id: sitio-gw
          from: { node: sitio }
          to: { node: gw }
          dataClass: public
        - id: gw-redaccion
          from: { node: gw }
          to: { node: redaccion }
          dataClass: public
        - id: redaccion-notas
          from: { node: redaccion }
          to: { node: notas }
          dataClass: public
        - id: redaccion-borde
          from: { node: redaccion }
          to: { node: borde }
          dataClass: public
        - id: redaccion-monitoreo
          from: { node: redaccion }
          to: { node: monitoreo }
          dataClass: public
  - label: el servicio escribe la página y la red la sirve
    contextInversion: "escribir la página en un almacén y que la red de distribución la sirva desde ahí se defiende cuando la portada tiene que aguantar el pico de lectura que viene detrás de la primicia: la escritura sigue siendo del propio servicio, sin trabajo pendiente de nadie y con el editor viendo el resultado de su botón, pero ahora existe un original servible que sobrevive a que el servicio de publicación se caiga por el mismo pico. El almacén no cuesta unidad operativa, así que la redacción sigue en cuatro piezas. Lo que aceptás a cambio: una pieza más que puede fallar en el momento del cierre, y una escritura que ahora depende de que el almacenamiento responda, que es exactamente lo que falló en marzo."
    design:
      nodes:
        - id: lector
          type: actor
          label: Lector
          zone: public
        - id: sitio
          type: web-client
          label: Sitio del medio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: redaccion
          type: service
          label: Servicio de publicación
          zone: private
          role: publishing-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: notas
          type: database
          label: Base de notas
          zone: restricted
          role: story-store
          props: { backup: "diario", consistency: "strong" }
        - id: estatico
          type: object-storage
          label: Almacén de páginas
          zone: private
          props: { durability: "99.999999999", access: "signed" }
        - id: borde
          type: cdn
          label: Red de distribución
          zone: dmz
          role: edge
          props: { cacheControl: "public, max-age=60" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-sitio
          from: { node: lector }
          to: { node: sitio }
          dataClass: public
        - id: sitio-gw
          from: { node: sitio }
          to: { node: gw }
          dataClass: public
        - id: gw-redaccion
          from: { node: gw }
          to: { node: redaccion }
          dataClass: public
        - id: redaccion-notas
          from: { node: redaccion }
          to: { node: notas }
          dataClass: public
        - id: redaccion-estatico
          from: { node: redaccion }
          to: { node: estatico }
          dataClass: public
        - id: estatico-borde
          from: { node: estatico }
          to: { node: borde }
          dataClass: public
        - id: redaccion-monitoreo
          from: { node: redaccion }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Un medio digital de alcance nacional. La noticia que estás por publicar la
tienen otros tres medios y la va a publicar el primero que apriete el botón.
El equipo mide su ventaja media sobre el segundo: **40 segundos**. Un medio
que llega segundo a una noticia nacional pierde alrededor del **70 % del
tráfico de esa nota**, y ese tráfico no vuelve.

El sistema tiene una cadena de publicación que se agregó en marzo, después
de una caída del almacenamiento que perdió cuatro notas. **Funcionó**: desde
entonces no se perdió ninguna. Y agregó entre **40 segundos y 4 minutos** al
cierre, según cuánto trabajo pendiente tenga el proceso de fondo, que es
mucho justo el día de la noticia grande.

La persona que armó esa cadena sigue en el equipo, la defiende con datos
correctos, y tiene razón en todo salvo en una cosa: el contexto cambió. El
medio pasó de perder notas a perder primicias.

La redacción sostiene **cuatro piezas**. Hoy hay cinco y ninguna es un
componente de monitoreo, así que la cuenta no cierra ni siquiera antes de
empezar.

**Armá el sistema** para que la nota llegue a la red de distribución sin
pasar por nada que pueda tener trabajo pendiente, para que ningún servicio
deje ese trabajo pendiente en el camino del cierre, para que la nota se siga
guardando en la base, y para que el servicio de publicación reporte lo que
le pasa.

Después vas a tener que sentarte con quien armó la cadena de marzo y
explicarle por qué se la sacás. Con los dos números, no con una opinión.
