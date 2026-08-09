---
title: "El corte que nadie pudo reportar"
level: 6
role: core
domain: energia
D1: 2
D2: 2
D3: 2
D4: 2
D5: 2
D6: 2
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué recibe el vecino que reporta un corte mientras el despacho de cuadrillas está saturado, y en qué momento la cuadrilla se entera."
lambda: 0.5
constraints:
  - metric: reclamos de corte por hora durante una tormenta
    operator: ">="
    value: 3100
    unit: reclamos/hora
  - metric: minutos sin poder registrar ningún reclamo en la tormenta del 14 de febrero
    operator: ">="
    value: 70
    unit: minutos
  - metric: presupuesto operativo del equipo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el sistema de despacho de cuadrillas no se cayó: se saturó. Durante la tormenta su tiempo de respuesta pasó de 400 milisegundos a 38 segundos, y el servicio de reclamos se quedó esperando en cada llamada hasta agotar sus conexiones."
    discoveryPath: "seguí qué le pasa al servicio de reclamos cuando la pieza del otro lado tarda. Mientras haya una llamada directa desde el reclamo hasta el despacho, el tiempo del despacho es el tiempo del vecino que está en la vereda con el celular."
  - fact: "una cuadrilla no sale por reclamo: sale por zona. Los 3.100 reclamos de esa tormenta se convirtieron en 40 órdenes de trabajo. Que una orden llegue quince minutos tarde no cambia a qué hora sale la cuadrilla; que no llegue nunca, sí."
    discoveryPath: "compará la urgencia de aceptar el reclamo con la urgencia de despacharlo. Si el despacho agrupa por zona y decide cada varios minutos, el rezago es tolerable y la pérdida no."
  - fact: "el vecino que no recibe número de reclamo vuelve a llamar. En febrero el 31 % de las llamadas al centro de atención fueron de gente reportando por segunda o tercera vez el mismo corte, porque la primera no había dejado rastro."
    discoveryPath: "preguntate qué hace la persona cuando la app le contesta un error. El costo de no asentar el reclamo no se paga sólo en la cuadrilla: se paga en el centro de atención, multiplicado."
startingDesign:
  nodes:
    - id: vecino
      type: actor
      label: Vecino
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la distribuidora
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: reclamos
      type: service
      label: Servicio de reclamos
      zone: private
      role: claims-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: despacho
      type: external-provider
      label: Sistema de despacho de cuadrillas
      zone: dmz
      role: dispatch-provider
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: vecino-app
      from: { node: vecino }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-reclamos
      from: { node: gw }
      to: { node: reclamos }
      dataClass: personal
    - id: reclamos-despacho
      from: { node: reclamos }
      to: { node: despacho }
      dataClass: personal
guarantees:
  - id: g-reclamo-no-espera
    label: tomar el reclamo no depende de que el despacho conteste
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: claims-service
      to:
        role: dispatch-provider
    whyMissing: el servicio de reclamos llama directo al sistema de despacho. Todo lo que tarde el despacho es tiempo que el vecino espera con la app abierta y conexiones del servicio de reclamos ocupadas.
    consequence: "cuando el despacho pasa de 400 milisegundos a 38 segundos, no se atrasa el despacho: se cae la toma de reclamos entera. En febrero fueron 70 minutos sin poder registrar un solo corte, justo en la hora en que había 3.100 por registrar."
  - id: g-orden-no-se-pierde
    label: la orden de trabajo llega al despacho igual, por una pieza que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: claims-service
      to:
        role: dispatch-provider
    whyMissing: "no hay ninguna pieza durable entre el servicio de reclamos y el sistema de despacho. Sacar la llamada del camino del vecino sin poner nada en el medio no aísla el fallo: elimina el despacho."
    consequence: tomás los 3.100 reclamos y no sale ninguna cuadrilla. El vecino recibe su número de reclamo y el corte sigue ahí a la mañana siguiente, que es exactamente el reclamo que la empresa no puede permitirse.
  - id: g-vecino-puede-consultar
    label: el estado del reclamo se puede consultar desde la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [database]
      via:
        role: claims-service
    whyMissing: "no hay ningún camino desde la puerta de entrada hasta una base que pase por el servicio que toma el reclamo, así que el reclamo tomado no queda en ningún lado consultable. Una base colgada de otra pieza es una base vacía: hay quien la lee y no hay quien la escriba."
    consequence: "el vecino no tiene forma de saber si su reclamo existe, y vuelve a reportarlo. El 31 % de las llamadas de febrero fueron eso: la misma persona, el mismo corte, tres veces."
rubric:
  - dimension: la saturación del tercero es un rezago en el despacho, no una caída en la toma
    signal:
      kind: predicate
      guaranteeId: g-reclamo-no-espera
  - dimension: aislar el fallo no es borrar la función que fallaba
    signal:
      kind: predicate
      guaranteeId: g-orden-no-se-pierde
  - dimension: el reclamo aceptado existe en algún lado que el vecino puede consultar
    signal:
      kind: predicate
      guaranteeId: g-vecino-puede-consultar
referenceSolutions:
  - label: cola de órdenes de trabajo con un despachador detrás
    contextInversion: "una cola es lo correcto cuando la orden tiene un solo destino, el sistema de cuadrillas, y lo único que importa es que ninguna se pierda: cada mensaje se toma una vez, se reintenta mientras el despacho esté saturado, y el rezago se lee como profundidad de cola en el tablero de la guardia. Acá además el servicio de reclamos asienta el reclamo en la base antes de encolar, así que el vecino tiene número apenas apoya el dedo. El costo es que si mañana el área de calidad de servicio necesita el mismo evento para calcular tiempos de reposición, hay que volver a publicarlo: una cola consumida no se relee."
    design:
      nodes:
        - id: vecino
          type: actor
          label: Vecino
          zone: public
        - id: app
          type: mobile-client
          label: App de la distribuidora
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reclamos
          type: service
          label: Servicio de reclamos
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: base
          type: database
          label: Base de reclamos
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de órdenes de trabajo
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachador
          type: worker
          label: Despachador de cuadrillas
          zone: private
        - id: despacho
          type: external-provider
          label: Sistema de despacho de cuadrillas
          zone: dmz
          role: dispatch-provider
      edges:
        - id: vecino-app
          from: { node: vecino }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-reclamos
          from: { node: gw }
          to: { node: reclamos }
          dataClass: personal
        - id: reclamos-base
          from: { node: reclamos }
          to: { node: base }
          dataClass: personal
        - id: reclamos-cola
          from: { node: reclamos }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-despacho
          from: { node: despachador }
          to: { node: despacho }
          dataClass: personal
  - label: registro de reclamos, y el despachador asienta el estado
    contextInversion: "un registro de eventos conviene cuando el hecho «se reportó un corte en tal esquina» le sirve a más de un lector, como el despacho, el mapa de cortes de la web pública y el cálculo regulatorio de tiempo de reposición, y cuando después de una tormenta querés poder volver a pasar una ventana entera de reclamos sin pedirle nada al vecino. Acá el servicio de reclamos publica y contesta, y quien asienta el estado final en la base es el mismo despachador. Se paga con una ventana de segundos en la que el reclamo ya existe en el registro y todavía no aparece en la consulta del vecino, y con un registro que hay que dimensionar y retener."
    design:
      nodes:
        - id: vecino
          type: actor
          label: Vecino
          zone: public
        - id: app
          type: mobile-client
          label: App de la distribuidora
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reclamos
          type: service
          label: Servicio de reclamos
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: stream
          label: Registro de reclamos de corte
          zone: private
          props: { retention: "30d", partitions: "6" }
        - id: despachador
          type: worker
          label: Despachador de cuadrillas
          zone: private
        - id: base
          type: database
          label: Base de reclamos
          zone: restricted
          props: { backup: "diario" }
        - id: despacho
          type: external-provider
          label: Sistema de despacho de cuadrillas
          zone: dmz
          role: dispatch-provider
      edges:
        - id: vecino-app
          from: { node: vecino }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-reclamos
          from: { node: gw }
          to: { node: reclamos }
          dataClass: personal
        - id: reclamos-registro
          from: { node: reclamos }
          to: { node: registro }
          dataClass: personal
        - id: registro-despachador
          from: { node: registro }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-base
          from: { node: despachador }
          to: { node: base }
          dataClass: personal
        - id: despachador-despacho
          from: { node: despachador }
          to: { node: despacho }
          dataClass: personal
status: PILOT
---

Una distribuidora eléctrica con **3.100 reclamos de corte por hora** cuando hay
tormenta. El vecino abre la app, marca su dirección y reporta que se quedó sin
luz. El servicio de reclamos, antes de contestarle, le abre la orden de trabajo
al sistema de despacho de cuadrillas y espera la respuesta.

El 14 de febrero el sistema de despacho no se cayó. Se saturó: su tiempo de
respuesta pasó de 400 milisegundos a **38 segundos**. El servicio de reclamos se
quedó esperando en cada llamada hasta agotar sus conexiones, y durante **70
minutos** la distribuidora no pudo registrar un solo reclamo.

Ni los de la zona que estaba sin luz hacía tres horas, ni los demás.

Y acá está el número que decide el ejercicio: una cuadrilla **no sale por
reclamo, sale por zona**. Los 3.100 reclamos de esa noche se convirtieron en 40
órdenes de trabajo, y el despacho las agrupa cuando las recibe. Que una orden
llegue quince minutos tarde no cambia a qué hora sale la cuadrilla. Que no
llegue nunca, sí.

Mientras tanto, el vecino que no recibe número de reclamo vuelve a llamar. En
febrero, **el 31 %** de las llamadas al centro de atención fueron de gente
reportando por segunda o tercera vez el mismo corte.

La gerenta de operaciones lo resume así: *"Tomame el reclamo aunque la cuadrilla
salga diez minutos después. Lo que no puedo explicarle a nadie es que la app
diga error mientras el barrio está a oscuras."*

El equipo tiene **6 unidades operativas** y hoy usa 3.

**Rearmá el sistema** para que la saturación del despacho sea un rezago en la
orden de trabajo y no una caída en la toma de reclamos, para que ninguna orden se
pierda en el camino, y para que el vecino pueda consultar el reclamo que acaba
de dejar.
