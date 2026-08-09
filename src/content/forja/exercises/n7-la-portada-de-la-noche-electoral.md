---
title: "La portada de la noche electoral"
level: 7
role: calibration
domain: medios
D1: 1
D2: 2
D3: 2
D4: 1
D5: 2
D6: 3
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 4
aiBudget: "libre, pero tu respuesta tiene que decir cuántas unidades operativas suma cada pieza que agregás. Una respuesta que no cuenta el costo no resolvió este ejercicio."
lambda: 1.0
constraints:
  - metric: lectores simultáneos en el pico de la noche electoral
    operator: ">="
    value: 90000
    unit: lectores
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: la portada cambia cada 40 segundos y todos los lectores ven exactamente la misma portada. No hay nada personalizado en esa pantalla.
    discoveryPath: "mirá qué devuelve el servicio de portada en dos pedidos seguidos de dos lectores distintos: el mismo HTML. Lo que es igual para todos no hace falta calcularlo 90.000 veces."
  - fact: hay piezas del catálogo que cuestan cero unidades operativas. La red de distribución y el almacén de objetos son dos de ellas. Una caché, en cambio, cuesta una.
    discoveryPath: "probá tu respuesta con una caché y después con una red de distribución. El motor te muestra el total de unidades operativas de cada diseño: uno entra en el presupuesto y el otro no."
startingDesign:
  nodes:
    - id: lector
      type: web-client
      label: Navegador del lector
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: portada
      type: service
      label: Servicio de portada
      zone: private
      role: portada-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: notas
      type: database
      label: Base de notas
      zone: restricted
      role: archivo-notas
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
    - id: lector-gw
      from: { node: lector }
      to: { node: gw }
      dataClass: public
    - id: gw-portada
      from: { node: gw }
      to: { node: portada }
      dataClass: public
    - id: portada-notas
      from: { node: portada }
      to: { node: notas }
      dataClass: public
    - id: portada-obs
      from: { node: portada }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-lector-llega
    label: el lector sigue llegando a las notas publicadas
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: archivo-notas
    whyMissing: no hay ningún camino desde el navegador del lector hasta la base donde viven las notas.
    consequence: "aliviar el pico borrando el camino de lectura no es escalar: es apagar el producto. La portada tiene que seguir sirviendo notas reales."
  - id: g-cdn-delante
    label: lo que se publica llega a una red de distribución
    weight: 2
    predicate:
      op: path
      from:
        role: portada-service
      to:
        type: [cdn]
    whyMissing: lo que arma el servicio de portada no llega a ninguna red de distribución, y cada lector obliga al servicio a armar la página otra vez.
    consequence: "a 90.000 lectores simultáneos el servicio arma 90.000 veces la misma página. No se cae por un error: se cae por repetir trabajo que ya hizo."
  - id: g-estatico-fuera
    label: las fotos y los archivos pesados viven fuera del servicio
    weight: 1
    predicate:
      op: exists
      node:
        type: [object-storage]
    whyMissing: no hay ningún almacén de objetos en el diseño, así que las fotos de las notas salen por el mismo proceso que arma la portada.
    consequence: una foto de 2 MB ocupa el servicio el tiempo que tarda la red del lector, no el tiempo que tarda el servidor. En el pico, la mitad de los procesos están esperando a conexiones lentas en vez de armar páginas.
rubric:
  - dimension: el producto sigue existiendo después de tu cambio
    signal:
      kind: predicate
      guaranteeId: g-lector-llega
  - dimension: el pico de lectura no llega hasta el servicio
    signal:
      kind: predicate
      guaranteeId: g-cdn-delante
  - dimension: lo pesado no viaja por el camino caro
    signal:
      kind: predicate
      guaranteeId: g-estatico-fuera
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 4
      unit: unidades operativas
referenceSolutions:
  - label: la red de distribución lee del servicio
    contextInversion: "sacar la página desde el servicio hacia la red de distribución es lo correcto cuando la portada cambia sola y seguido: la red pide la versión nueva cuando le vence la copia y nadie tiene que acordarse de publicar. Se paga con que el servicio recibe un pedido cada vez que vence esa copia, y con que un error de armado se propaga a todos los lectores hasta el siguiente vencimiento."
    design:
      nodes:
        - id: lector
          type: web-client
          label: Navegador del lector
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: portada
          type: service
          label: Servicio de portada
          zone: private
          role: portada-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: notas
          type: database
          label: Base de notas
          zone: restricted
          role: archivo-notas
          props: { backup: "diario" }
        - id: fotos
          type: object-storage
          label: Almacén de fotos
          zone: private
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-portada
          from: { node: gw }
          to: { node: portada }
          dataClass: public
        - id: portada-notas
          from: { node: portada }
          to: { node: notas }
          dataClass: public
        - id: portada-distribucion
          from: { node: portada }
          to: { node: distribucion }
          dataClass: public
        - id: fotos-distribucion
          from: { node: fotos }
          to: { node: distribucion }
          dataClass: public
        - id: portada-obs
          from: { node: portada }
          to: { node: obs }
          dataClass: public
  - label: el servicio publica la portada en el almacén y la red sirve el almacén
    contextInversion: "publicar la portada armada en el almacén de objetos y que la red de distribución sirva sólo de ahí es lo correcto cuando querés que el servicio pueda caerse sin que la portada deje de verse: si el proceso muere a las 21:40, lo último que publicó sigue online. Se paga con un paso más, porque alguien tiene que publicar, y con que la portada queda congelada en la última versión buena en vez de intentar refrescarse sola."
    design:
      nodes:
        - id: lector
          type: web-client
          label: Navegador del lector
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: portada
          type: service
          label: Servicio de portada
          zone: private
          role: portada-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: notas
          type: database
          label: Base de notas
          zone: restricted
          role: archivo-notas
          props: { backup: "diario" }
        - id: publicado
          type: object-storage
          label: Almacén de la portada publicada
          zone: private
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-portada
          from: { node: gw }
          to: { node: portada }
          dataClass: public
        - id: portada-notas
          from: { node: portada }
          to: { node: notas }
          dataClass: public
        - id: portada-publicado
          from: { node: portada }
          to: { node: publicado }
          dataClass: public
        - id: publicado-distribucion
          from: { node: publicado }
          to: { node: distribucion }
          dataClass: public
        - id: portada-obs
          from: { node: portada }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Un diario digital tiene **9.000 lectores simultáneos** un martes cualquiera.
La noche de la elección espera **90.000**. Diez veces. Durante unas cuatro
horas, y después vuelve a nueve mil.

El sistema de hoy son cuatro piezas que hay que mantener despiertas: la
puerta de entrada, el servicio de portada, la base de notas y el monitoreo.
**Cuatro unidades operativas, y el presupuesto del equipo es exactamente
cuatro.** No hay presupuesto para una quinta.

El jefe de tecnología ya escuchó la propuesta obvia, "metemos una caché", y
la contestó con una pregunta: la caché cuesta una unidad operativa, ¿de
dónde sale? Nadie tuvo respuesta.

Antes de agregar nada, mirá qué está pasando: los 90.000 lectores piden la
**misma portada**. No hay nada personalizado en esa pantalla. Y las fotos de
las notas, lo más pesado que se sirve esa noche, salen por el mismo proceso
que arma el HTML.

**Rearmá el sistema para que el pico no llegue al servicio de portada, sin
pasarte de cuatro unidades operativas.** Hay piezas en el catálogo que
cuestan cero: encontralas antes de gastar una unidad que no tenés.
