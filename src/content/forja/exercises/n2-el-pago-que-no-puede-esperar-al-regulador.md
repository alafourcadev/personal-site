---
title: "El pago que no puede esperar al regulador"
level: 2
role: tradeoff
domain: seguros
tradeoffPairId: n2-un-almacen-o-dos
D1: 1
D2: 2
D3: 2
D4: 2
D5: 1
D6: 1
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, cada cuánto cambia la forma de cada uno de los dos datos de este sistema, y quién tiene que autorizar cada cambio."
lambda: 0.5
constraints:
  - metric: pagos a talleres registrados por día
    operator: ">="
    value: 90000
    unit: pagos/día
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: el legajo del siniestro está bajo resguardo regulatorio. Cualquier cambio de forma en ese almacenamiento exige una presentación al organismo con 30 días de anticipación.
    discoveryPath: "preguntá quién tiene que autorizar un cambio en cada almacenamiento. Si dos datos con autorizadores distintos comparten almacén, el más lento de los dos gobierna la velocidad del otro para siempre."
  - fact: el pago al taller cambió de forma once veces en un año, entre retenciones, división por rubro y anticipos, y cada cambio esperó la presentación regulatoria del legajo. Un cambio de dos días tardó once semanas.
    discoveryPath: "contá los cambios de cada lado del último año. Si un lado cambió once veces y el otro ninguna, no tienen el mismo ritmo, y compartir almacén los obliga a moverse al ritmo del más lento."
  - fact: el 3 de cada mes, mientras el organismo lee el legajo, la escritura de pagos sobre la misma tabla dejó el portal del asegurado sin responder durante 26 minutos.
    discoveryPath: "buscá el momento del mes en que dos usos muy distintos del mismo almacenamiento coinciden. La lectura de un auditor y noventa mil escrituras por día no compiten a veces: compiten el día que el auditor lee."
startingDesign:
  nodes:
    - id: asegurado
      type: actor
      label: Asegurado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de siniestros
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: siniestros
      type: service
      label: Servicio de siniestros
      zone: private
      role: claim-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: siniestrosdb
      type: database
      label: Base del legajo del siniestro
      zone: restricted
      role: claim-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: pagos
      type: service
      label: Servicio de pagos a talleres
      zone: private
      role: payout-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: pagosdb
      type: database
      label: Base de pagos
      zone: restricted
      role: payout-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: asegurado-portal
      from: { node: asegurado }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-siniestros
      from: { node: gw }
      to: { node: siniestros }
      dataClass: regulated
    - id: siniestros-siniestrosdb
      from: { node: siniestros }
      to: { node: siniestrosdb }
      dataClass: regulated
    - id: gw-pagos
      from: { node: gw }
      to: { node: pagos }
      dataClass: regulated
    - id: pagos-pagosdb
      from: { node: pagos }
      to: { node: pagosdb }
      dataClass: regulated
    - id: pagos-siniestrosdb
      from: { node: pagos }
      to: { node: siniestrosdb }
      dataClass: regulated
guarantees:
  - id: g-payout-out-of-the-claim-store
    label: pagos no entra al almacenamiento del legajo
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: payout-service
      to:
        role: claim-db
    whyMissing: hay una conexión que sale del servicio de pagos y entra directo a la base del legajo del siniestro.
    consequence: "mientras esa flecha exista, la forma del pago es parte del almacenamiento que el organismo resguarda: cada retención nueva espera una presentación de 30 días. Y el día que el auditor lee, noventa mil escrituras por día compiten con él por la misma tabla."
  - id: g-payout-owns-its-store
    label: el pago tiene su propio almacenamiento, escrito por su dueño
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [database]
            role: payout-db
        - op: covered
          target:
            role: payout-db
          by:
            role: payout-service
    whyMissing: la base de pagos no existe, o no está conectada al servicio de pagos.
    consequence: "sacar el pago del legajo no es dejarlo sin lugar donde vivir. Un pago a taller sin registro propio es un pago que el asegurador no puede probar que hizo, y el taller sí tiene su factura."
  - id: g-payout-reads-through-owner
    label: el pago sigue alcanzando el legajo a través de su dueño
    weight: 2
    predicate:
      op: path
      from:
        role: payout-service
      to:
        role: claim-db
      via:
        role: claim-service
    whyMissing: no hay ningún camino desde el servicio de pagos hasta la base del legajo que atraviese el servicio de siniestros.
    consequence: "un pago necesita saber a qué siniestro pertenece y si está aprobado: cortar el atajo sin dejar camino deja noventa mil pagos por día sin poder validarse. El límite se atraviesa por la puerta del dueño, que además es quien puede registrar quién leyó el legajo."
  - id: g-insured-still-reports
    label: el asegurado sigue pudiendo denunciar el siniestro
    weight: 1
    predicate:
      op: path
      from:
        type: [actor]
      to:
        role: claim-service
    whyMissing: no hay ningún camino desde el asegurado hasta el servicio de siniestros.
    consequence: separar bien y dejar al asegurado afuera es cambiar un problema de acoplamiento por uno de negocio. La denuncia es la entrada, y sin entrada no hay siniestros que pagar.
rubric:
  - dimension: cada dato cambia de forma al ritmo de quien lo autoriza
    signal:
      kind: predicate
      guaranteeId: g-payout-out-of-the-claim-store
  - dimension: el pago conserva un dueño y un registro propio
    signal:
      kind: predicate
      guaranteeId: g-payout-owns-its-store
  - dimension: el dato ajeno se sigue alcanzando por su dueño
    signal:
      kind: predicate
      guaranteeId: g-payout-reads-through-owner
referenceSolutions:
  - label: pagos le pregunta a siniestros y guarda lo suyo aparte
    contextInversion: "dos almacenes con dos dueños es lo correcto exactamente acá: el legajo cambia de forma una vez cada tanto y con 30 días de aviso al organismo, el pago cambió once veces en un año, y compartir almacén hace que el más lento de los dos gobierne al otro. Se paga con que validar un pago depende de que siniestros responda, y con que el estado del siniestro y el registro del pago pueden diferir por el tiempo de una llamada. En un asegurador donde los dos datos entraran juntos al mismo informe con cero segundos de tolerancia, esta decisión sería la equivocada."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: portal
          type: web-client
          label: Portal de siniestros
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claim-service
          props: { criticality: "medium", replicas: "2" }
        - id: siniestrosdb
          type: database
          label: Base del legajo del siniestro
          zone: restricted
          role: claim-db
          props: { backup: "diario" }
        - id: pagos
          type: service
          label: Servicio de pagos a talleres
          zone: private
          role: payout-service
          props: { criticality: "medium", replicas: "2" }
        - id: pagosdb
          type: database
          label: Base de pagos
          zone: restricted
          role: payout-db
          props: { backup: "diario" }
      edges:
        - id: asegurado-portal
          from: { node: asegurado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: regulated
        - id: siniestros-siniestrosdb
          from: { node: siniestros }
          to: { node: siniestrosdb }
          dataClass: regulated
        - id: gw-pagos
          from: { node: gw }
          to: { node: pagos }
          dataClass: regulated
        - id: pagos-siniestros
          from: { node: pagos }
          to: { node: siniestros }
          dataClass: regulated
        - id: pagos-pagosdb
          from: { node: pagos }
          to: { node: pagosdb }
          dataClass: regulated
  - label: el pago se liquida por lote, disparado por el siniestro
    contextInversion: "liquidar por lote conviene cuando el pago al taller no tiene que ocurrir en el mismo segundo que la aprobación, porque los talleres cobran por tanda y no por evento, y cuando querés que un pico de noventa mil pagos no se traduzca en noventa mil llamadas sincrónicas contra el servicio que atiende al asegurado. El límite es el mismo: el pago tiene su almacén y consulta el legajo por su dueño. Se paga con una pieza más que operar y con que el pago aparece registrado minutos después de la aprobación, no en el mismo instante."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: portal
          type: web-client
          label: Portal de siniestros
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claim-service
          props: { criticality: "medium", replicas: "2" }
        - id: siniestrosdb
          type: database
          label: Base del legajo del siniestro
          zone: restricted
          role: claim-db
          props: { backup: "diario" }
        - id: aprobaciones
          type: queue
          label: Aprobaciones de siniestro
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: liquidador
          type: worker
          label: Liquidador de pagos
          zone: private
          role: payout-service
          props: { idempotent: "sí" }
        - id: pagosdb
          type: database
          label: Base de pagos
          zone: restricted
          role: payout-db
          props: { backup: "diario" }
      edges:
        - id: asegurado-portal
          from: { node: asegurado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: regulated
        - id: siniestros-siniestrosdb
          from: { node: siniestros }
          to: { node: siniestrosdb }
          dataClass: regulated
        - id: siniestros-aprobaciones
          from: { node: siniestros }
          to: { node: aprobaciones }
          dataClass: regulated
        - id: aprobaciones-liquidador
          from: { node: aprobaciones }
          to: { node: liquidador }
          dataClass: regulated
        - id: liquidador-pagosdb
          from: { node: liquidador }
          to: { node: pagosdb }
          dataClass: regulated
        - id: liquidador-siniestros
          from: { node: liquidador }
          to: { node: siniestros }
          dataClass: regulated
status: PILOT
---

El mismo asegurador de automotores, otro par de datos.

Por un lado, el **legajo del siniestro**: la denuncia, el peritaje, las fotos,
la resolución. Está bajo resguardo regulatorio. Cambiar la forma de ese
almacenamiento (una columna, un tipo, un índice) exige una presentación al
organismo con **30 días de anticipación**.

Por el otro, el **pago al taller**. El asegurador registra **90.000 pagos por
día** y la forma de ese registro cambió **once veces en el último año**:
retenciones nuevas, división por rubro, anticipos, un régimen provincial
distinto.

Hoy los dos comparten almacenamiento. El servicio de pagos escribe en la base
del legajo porque, cuando se armó, el pago era una columna más del siniestro.

Las dos facturas de esa decisión ya llegaron. La primera: un cambio de dos días
en la forma del pago tardó **once semanas**, porque quedó atado a la
presentación regulatoria del legajo. La segunda: el **3 de cada mes**, mientras
el organismo lee el legajo, las escrituras de pagos sobre la misma tabla
dejaron el portal del asegurado sin responder **26 minutos**.

Nadie discute que el pago tiene que saber a qué siniestro pertenece y si está
aprobado. Lo que se discute es dónde vive el pago y quién lo escribe.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que la forma del pago deje de depender de una
presentación regulatoria, sin que el pago pierda de vista el siniestro al que
pertenece.
