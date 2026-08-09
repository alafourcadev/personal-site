---
title: "El comercio que no puede compartir la consulta"
level: 8
role: tradeoff
domain: cobranzas
tradeoffPairId: n8-quien-puede-leer-la-base-compartida
D1: 3
D2: 3
D3: 3
D4: 2
D5: 2
D6: 2
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué le mostrarías al auditor para probar que ninguna consulta puede leer filas de dos comercios a la vez."
lambda: 0.5
constraints:
  - metric: comercios sobre la misma base
    operator: ">="
    value: 140
    unit: comercios
  - metric: consultas capaces de leer filas de más de un comercio
    operator: "="
    value: 0
    unit: consultas
hiddenFacts:
  - fact: "el regulador no pide una base por comercio. Pide poder enumerar todas las consultas que llegan a los datos y demostrar que cada una lleva el comercio adentro."
    discoveryPath: "es la razón por la que la garantía pide que el conciliador PASE POR el servicio de cobros, y no que exista una segunda base. Una lista de consultas es corta cuando hay una sola puerta y es imposible de cerrar cuando cada componente abre la suya."
  - fact: "la conciliación nocturna la escribió el equipo de finanzas, no el de plataforma. Tiene su propia conexión a la base desde 2023 y nadie de plataforma la revisa."
    discoveryPath: "seguí la conexión del conciliador y preguntate quién la revisa cuando cambia. Una consulta que vive fuera del componente que conoce el modelo de tenencia envejece sin que nadie la mire."
  - fact: "la conciliación mueve entre 30.000 y 90.000 movimientos por noche, y hoy tarda once minutos. Pasando por el servicio de cobros va a tardar más."
    discoveryPath: "es el costo real de esta decisión, y el ejercicio te lo cobra a propósito. La otra mitad del par te pone en el contexto donde ese costo no se puede pagar."
startingDesign:
  nodes:
    - id: comercio
      type: actor
      label: Comercio
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: panel
      type: web-client
      label: Panel de cobros
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: cobros
      type: service
      label: Servicio de cobros
      zone: private
      role: billing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: conciliador
      type: worker
      label: Conciliación nocturna
      zone: private
      role: reconciler
      given: true
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de movimientos
      zone: restricted
      role: shared-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: comercio-panel
      from: { node: comercio }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-cobros
      from: { node: gw }
      to: { node: cobros }
      dataClass: personal
    - id: cobros-base
      from: { node: cobros }
      to: { node: base }
      dataClass: personal
    - id: conciliador-base
      from: { node: conciliador }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-merchant-scoped-read
    label: el comercio llega a sus movimientos por el servicio que estampa de quién son
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: shared-store
      via:
        role: billing-service
    whyMissing: no hay ningún camino desde la puerta de entrada hasta la base de movimientos que pase por el servicio de cobros.
    consequence: el servicio de cobros es el único componente que recibe de qué comercio es la sesión. Sin él en el camino, el aislamiento vuelve a depender de que cada consulta esté bien escrita.
  - id: g-reconciler-same-door
    label: la conciliación llega a los movimientos por esa misma puerta
    weight: 2
    predicate:
      op: path
      from:
        role: reconciler
      to:
        role: shared-store
      via:
        role: billing-service
    whyMissing: no hay ningún camino desde la conciliación nocturna hasta la base de movimientos que pase por el servicio de cobros.
    consequence: "la lista de consultas que el regulador pide enumerar tiene que ser corta y verificable. Con dos componentes abriendo cada uno su conexión, esa lista crece cada vez que alguien agrega una función, y el que la agrega no siempre sabe que existe un modelo de tenencia."
  - id: g-no-side-connection
    label: no queda ninguna conexión propia de la conciliación contra una base
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: reconciler
      to:
        type: [database]
    whyMissing: sigue existiendo una conexión directa entre la conciliación nocturna y una base de datos.
    consequence: "esa consulta la escribió finanzas en 2023 y plataforma no la revisa. Mientras exista, la puerta única es una convención, no una propiedad del sistema: alcanza con que alguien la modifique un jueves para que el aislamiento deje de valer, sin que nadie se entere."
rubric:
  - dimension: el comercio lee lo suyo por el componente que conoce al dueño
    signal:
      kind: predicate
      guaranteeId: g-merchant-scoped-read
  - dimension: el proceso masivo no tiene un camino privilegiado
    signal:
      kind: predicate
      guaranteeId: g-reconciler-same-door
  - dimension: la puerta única es una propiedad del diseño, no una costumbre
    signal:
      kind: predicate
      guaranteeId: g-no-side-connection
referenceSolutions:
  - label: la conciliación le pide los movimientos al servicio de cobros
    contextInversion: "pedirle los movimientos al servicio de cobros es lo correcto cuando lo que hay que poder demostrar es que existe UNA puerta: la lista de consultas que llegan a los datos tiene una entrada, y esa entrada lleva el comercio adentro por construcción. El costo es tiempo: la conciliación pasa de once minutos a bastante más, porque leer 90.000 movimientos por una interfaz de servicio nunca va a ser tan barato como un barrido."
    design:
      nodes:
        - id: comercio
          type: actor
          label: Comercio
          zone: public
        - id: panel
          type: web-client
          label: Panel de cobros
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobros
          type: service
          label: Servicio de cobros
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: conciliador
          type: worker
          label: Conciliación nocturna
          zone: private
          role: reconciler
        - id: base
          type: database
          label: Base de movimientos
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
      edges:
        - id: comercio-panel
          from: { node: comercio }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobros
          from: { node: gw }
          to: { node: cobros }
          dataClass: personal
        - id: cobros-base
          from: { node: cobros }
          to: { node: base }
          dataClass: personal
        - id: conciliador-cobros
          from: { node: conciliador }
          to: { node: cobros }
          dataClass: personal
  - label: el servicio publica cada movimiento en un registro de eventos y la conciliación lo consume
    contextInversion: "publicar los movimientos en un registro de eventos conviene cuando la conciliación no puede esperar a la ventana nocturna o cuando hay más de un consumidor interesado en el mismo movimiento: el servicio de cobros sigue siendo el único que toca la base, cada evento sale con el comercio adentro, y la conciliación trabaja al ritmo en que los movimientos ocurren en vez de una vez por noche. Se paga con una pieza más para operar y con que el orden entre eventos sólo se garantiza dentro de cada tramo."
    design:
      nodes:
        - id: comercio
          type: actor
          label: Comercio
          zone: public
        - id: panel
          type: web-client
          label: Panel de cobros
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobros
          type: service
          label: Servicio de cobros
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: movimientos
          type: stream
          label: Registro de movimientos
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: conciliador
          type: worker
          label: Conciliación nocturna
          zone: private
          role: reconciler
        - id: base
          type: database
          label: Base de movimientos
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
      edges:
        - id: comercio-panel
          from: { node: comercio }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobros
          from: { node: gw }
          to: { node: cobros }
          dataClass: personal
        - id: cobros-base
          from: { node: cobros }
          to: { node: base }
          dataClass: personal
        - id: cobros-movimientos
          from: { node: cobros }
          to: { node: movimientos }
          dataClass: personal
        - id: movimientos-conciliador
          from: { node: movimientos }
          to: { node: conciliador }
          dataClass: personal
        - id: conciliador-cobros
          from: { node: conciliador }
          to: { node: cobros }
          dataClass: personal
status: PILOT
---

Una plataforma de cobros que usan **140 comercios**. Todos sobre la misma
base de movimientos. El comercio entra a su panel, ve lo que cobró, y cierra
su caja.

Uno de esos 140 es una financiera regulada. En noviembre pasó una auditoría y
el resultado fue una sola observación, escrita en dos líneas:

> Enumeren todas las consultas que llegan a los datos y demuestren que cada
> una lleva el identificador del comercio adentro.

El equipo pudo enumerar las del servicio de cobros. Están en un solo lugar,
todas pasan por la misma función, y esa función recibe el comercio de la
sesión porque sin eso no sabría a quién acreditarle el dinero.

Después apareció la conciliación nocturna. La escribió el equipo de finanzas
en 2023, tiene su propia conexión a la base, y mueve entre **30.000 y 90.000
movimientos por noche** en once minutos. Nadie de plataforma la revisa. Nadie
supo decir cuántas consultas tiene hoy.

El regulador no pidió una base por comercio. Pidió una lista corta y una
demostración. Una lista es corta cuando hay una sola puerta; es imposible de
cerrar cuando cada componente abre la suya.

Pasar la conciliación por el servicio de cobros va a hacerla más lenta. Ese
es el precio de esta mitad del problema, y el enunciado lo pone sobre la mesa
en vez de esconderlo.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que exista una sola puerta a los movimientos, y
para que la conciliación entre por ella como todos los demás.
