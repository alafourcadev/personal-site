---
title: "La unidad que falta en la farmacia"
level: 5
role: core
domain: retail
D1: 2
D2: 3
D3: 2
D4: 1
D5: 2
D6: 3
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que nombrar la pieza que sacaste, decir qué compraba y decir qué se pierde al sacarla. Una respuesta que sólo agrega no resolvió este ejercicio."
lambda: 0.5
constraints:
  - metric: sucursales conectadas
    operator: ">="
    value: 62
    unit: sucursales
  - metric: personas que operan el sistema
    operator: "="
    value: 2
    unit: personas
  - metric: cambios de precio registrados por día
    operator: ">="
    value: 400
    unit: cambios/día
hiddenFacts:
  - fact: "la caché de la lista de precios vive 300 segundos. Cuando termina una promoción, las cajas siguen cobrando el precio viejo hasta cinco minutos: en marzo eso fueron 1.900 tickets con un precio que ya no existía, y el reintegro lo pagó la cadena."
    discoveryPath: "preguntá qué compra cada pieza y a qué precio. La caché compra tiempo de respuesta en una pantalla que ya responde rápido, y cuesta cinco minutos de precio equivocado en 62 mostradores. Es la única pieza del sistema cuyo beneficio y cuyo costo van en la misma dirección: hacia abajo."
  - fact: la base de auditoría de precios se escribe 400 veces por día y se lee una vez al año, cuando el ente regulador pide el histórico de un medicamento. Nadie hizo nunca una consulta puntual sobre ella.
    discoveryPath: "contá lecturas contra escrituras en cada almacén. Un almacén que sólo se agrega y se lee entero una vez al año es un archivo, y un archivo no consume capacidad operativa del equipo. Un almacén que se consulta por clave todos los días sí necesita ser una base."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la cadena
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: precios
      type: service
      label: Servicio de precios
      zone: private
      role: precios
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: promociones
      type: service
      label: Servicio de promociones
      zone: private
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: baseprecios
      type: database
      label: Base de precios
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: auditoria
      type: database
      label: Base de auditoría de precios
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: cachecatalogo
      type: cache
      label: Caché de la lista de precios
      zone: private
      given: true
      props: { ttl: "300", eviction: "lru" }
      position: { x: 805, y: 630 }
    - id: cajas
      type: external-provider
      label: Cajas de las sucursales
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: cliente-app
      from: { node: cliente }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: public
    - id: gw-precios
      from: { node: gw }
      to: { node: precios }
      dataClass: public
    - id: gw-promociones
      from: { node: gw }
      to: { node: promociones }
      dataClass: public
    - id: precios-baseprecios
      from: { node: precios }
      to: { node: baseprecios }
      dataClass: public
    - id: precios-auditoria
      from: { node: precios }
      to: { node: auditoria }
      dataClass: regulated
    - id: precios-cachecatalogo
      from: { node: precios }
      to: { node: cachecatalogo }
      dataClass: public
    - id: promociones-baseprecios
      from: { node: promociones }
      to: { node: baseprecios }
      dataClass: public
    - id: precios-cajas
      from: { node: precios }
      to: { node: cajas }
      dataClass: public
guarantees:
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
    consequence: "la última vez que el servicio de promociones devolvió error, 62 sucursales cobraron sin descuento durante hora y media y el equipo se enteró por el grupo de encargados. La detección funciona a medias, que en operación es igual que no funcionar."
  - id: g-stores-observed
    label: cada almacén de datos que quede en pie reporta su estado
    weight: 2
    predicate:
      op: covered
      target:
        type: [database]
      by:
        type: [observability]
    whyMissing: hay al menos una base de datos que no está conectada a ningún componente de monitoreo.
    consequence: un disco que se llena, una réplica que se atrasa o una copia nocturna que falló en silencio son cosas que la base sabe y nadie más. Se descubren el día que hay que restaurar, que es siempre el peor día.
  - id: g-catalog-store
    label: el precio vigente sigue viviendo en un almacén que se consulta por producto
    weight: 1
    predicate:
      op: path
      from:
        role: precios
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de precios hasta una base de datos.
    consequence: agregar señal no puede costar el producto. Si en el camino desarmaste el almacén donde se busca el precio de un producto, el sistema quedó perfectamente observado y las cajas no pueden cobrar.
rubric:
  - dimension: la cobertura de señal es completa, no la de los servicios más visibles
    signal:
      kind: predicate
      guaranteeId: g-services-observed
  - dimension: el estado del almacenamiento es una señal y no una sorpresa
    signal:
      kind: predicate
      guaranteeId: g-stores-observed
  - dimension: el sistema sigue pudiendo cobrar después de instrumentarlo
    signal:
      kind: predicate
      guaranteeId: g-catalog-store
referenceSolutions:
  - label: paga la caché
    contextInversion: "sacar la caché es lo correcto cuando lo que compra es tiempo de respuesta en una consulta que ya responde rápido, y lo que cuesta es cinco minutos de precio viejo en 62 mostradores cada vez que termina una promoción. La base absorbe 400 escrituras y unas pocas miles de lecturas por día sin despeinarse. Conservás la base de auditoría, que es lo correcto si el ente regulador pregunta por rangos y por producto en vez de pedir el volcado entero: eso es una consulta, y una consulta necesita una base."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: app
          type: mobile-client
          label: App de la cadena
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: precios
          type: service
          label: Servicio de precios
          zone: private
          role: precios
          props: { criticality: "high", replicas: "2" }
        - id: promociones
          type: service
          label: Servicio de promociones
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: baseprecios
          type: database
          label: Base de precios
          zone: restricted
          props: { backup: "diario" }
        - id: auditoria
          type: database
          label: Base de auditoría de precios
          zone: restricted
          props: { backup: "diario" }
        - id: cajas
          type: external-provider
          label: Cajas de las sucursales
          zone: dmz
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-app
          from: { node: cliente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: public
        - id: gw-precios
          from: { node: gw }
          to: { node: precios }
          dataClass: public
        - id: gw-promociones
          from: { node: gw }
          to: { node: promociones }
          dataClass: public
        - id: precios-baseprecios
          from: { node: precios }
          to: { node: baseprecios }
          dataClass: public
        - id: precios-auditoria
          from: { node: precios }
          to: { node: auditoria }
          dataClass: regulated
        - id: promociones-baseprecios
          from: { node: promociones }
          to: { node: baseprecios }
          dataClass: public
        - id: precios-cajas
          from: { node: precios }
          to: { node: cajas }
          dataClass: public
        - id: precios-monitoreo
          from: { node: precios }
          to: { node: monitoreo }
          dataClass: public
        - id: promociones-monitoreo
          from: { node: promociones }
          to: { node: monitoreo }
          dataClass: public
        - id: baseprecios-monitoreo
          from: { node: baseprecios }
          to: { node: monitoreo }
          dataClass: public
        - id: auditoria-monitoreo
          from: { node: auditoria }
          to: { node: monitoreo }
          dataClass: public
  - label: paga la base de auditoría
    contextInversion: "mover la auditoría a un archivo es lo correcto cuando esa auditoría se escribe 400 veces por día y se lee una vez al año, entera: eso no es una consulta, es una entrega. Un archivo la sostiene sin consumir capacidad del equipo, porque no se parchea, no se le mira el disco y no se le restaura una copia, y libera la unidad que el monitoreo necesita. Conservás la caché, que es lo correcto si las promociones se cargan de madrugada y la lista de precios pasa el día entera quieta: entonces los 300 segundos nunca caen dentro de un cambio y lo único que compran es tiempo de respuesta gratis. Lo que se pierde es la consulta puntual sobre el histórico: si el regulador pregunta por un medicamento y un rango de fechas, ahora hay que bajar el archivo y buscarlo a mano."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: app
          type: mobile-client
          label: App de la cadena
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: precios
          type: service
          label: Servicio de precios
          zone: private
          role: precios
          props: { criticality: "high", replicas: "2" }
        - id: promociones
          type: service
          label: Servicio de promociones
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: baseprecios
          type: database
          label: Base de precios
          zone: restricted
          props: { backup: "diario" }
        - id: cachecatalogo
          type: cache
          label: Caché de la lista de precios
          zone: private
          props: { ttl: "300", eviction: "lru" }
        - id: archivoauditoria
          type: object-storage
          label: Archivo de cambios de precio
          zone: private
        - id: cajas
          type: external-provider
          label: Cajas de las sucursales
          zone: dmz
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-app
          from: { node: cliente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: public
        - id: gw-precios
          from: { node: gw }
          to: { node: precios }
          dataClass: public
        - id: gw-promociones
          from: { node: gw }
          to: { node: promociones }
          dataClass: public
        - id: precios-baseprecios
          from: { node: precios }
          to: { node: baseprecios }
          dataClass: public
        - id: precios-cachecatalogo
          from: { node: precios }
          to: { node: cachecatalogo }
          dataClass: public
        - id: precios-archivoauditoria
          from: { node: precios }
          to: { node: archivoauditoria }
          dataClass: regulated
        - id: promociones-baseprecios
          from: { node: promociones }
          to: { node: baseprecios }
          dataClass: public
        - id: precios-cajas
          from: { node: precios }
          to: { node: cajas }
          dataClass: public
        - id: precios-monitoreo
          from: { node: precios }
          to: { node: monitoreo }
          dataClass: public
        - id: promociones-monitoreo
          from: { node: promociones }
          to: { node: monitoreo }
          dataClass: public
        - id: baseprecios-monitoreo
          from: { node: baseprecios }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una cadena de **62 farmacias**. La operan **dos personas**, y esas dos
personas también escriben el producto.

El sistema tiene seis piezas que hay que mantener despiertas: la puerta de
entrada, el servicio de precios, el servicio de promociones, la base de
precios, la base de auditoría de precios y la caché de la lista. **Seis
unidades operativas, y el presupuesto del equipo es exactamente seis.**

No hay ninguna señal. La última vez que el servicio de promociones devolvió
error, 62 mostradores cobraron sin descuento durante **hora y media**, y el
equipo se enteró por el grupo de WhatsApp de los encargados.

El monitoreo cuesta **una unidad operativa más**, y eso los pone en siete
sobre un presupuesto de seis. El gerente no va a contratar a nadie y tiene
razón en no hacerlo: un sistema que dos personas no pueden sostener se
degrada solo, tenga el diagrama que tenga.

Así que el ejercicio no es "agregá monitoreo". Es este:

**Hacé entrar la señal dentro del presupuesto que ya tenés.** Una pieza
tiene que salir. Hay dos candidatas y las dos tienen defensa; elegir cuál
paga es el ejercicio.

La **caché de la lista de precios** vive 300 segundos. Cuando termina una
promoción, las cajas siguen cobrando el precio viejo hasta cinco minutos:
en marzo fueron **1.900 tickets** con un precio que ya no existía, y el
reintegro lo pagó la cadena.

La **base de auditoría de precios** recibe 400 escrituras por día y se lee
una vez al año, cuando el ente regulador pide el histórico. Nadie hizo
nunca una consulta puntual sobre ella.

Mirá cada una y preguntate qué compra y a qué precio. Después sacá la que
pierde esa cuenta.

Y acordate de la otra mitad, que es la que se olvida: una señal que sólo mira
los servicios no te avisa el día que el problema está en el almacenamiento. El
precio vigente se sigue buscando por producto, así que esa base se queda. Y
una pieza que se queda es una pieza que hay que poder mirar.
