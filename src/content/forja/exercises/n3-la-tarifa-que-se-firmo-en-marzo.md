---
title: "La tarifa que se firmó en marzo"
level: 3
role: tradeoff
domain: logistica
tradeoffPairId: n3-copia-propia-o-preguntarle-al-dueno
D1: 1
D2: 2
D3: 3
D4: 2
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir con qué tarifa se reimprime en 2031 una factura del 4 de marzo, y de dónde sale ese número."
lambda: 0.5
constraints:
  - metric: facturas de flete emitidas por mes
    operator: ">="
    value: 31000
    unit: facturas
  - metric: años que la factura debe poder reconstruirse
    operator: ">="
    value: 5
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "la tarifa del flete cambia todas las semanas por el precio del combustible. En doce meses cambió 47 veces."
    discoveryPath: "es el número que da vuelta la decisión. Una tarifa que cambia una vez al año se puede preguntar en el momento sin consecuencias; una que cambia todas las semanas convierte cada reimpresión en una factura distinta."
  - fact: "facturación le pregunta la tarifa al servicio de tarifas tanto al emitir como al reimprimir. El servicio de tarifas contesta siempre la vigente, porque es lo único que administra: la de hoy."
    discoveryPath: "seguí la conexión que sale de facturación en el lienzo. El servicio de tarifas hace bien su trabajo, que es publicar la tarifa vigente; el que le pide lo que no sabe contestar es el otro."
  - fact: "en junio una auditoría reimprimió 2.300 facturas de marzo y salieron con la tarifa de junio. Fueron 2.300 notas de crédito y una multa del organismo de control."
    discoveryPath: "es la consecuencia de que el precio aplicado no exista en ningún lado: se recalcula cada vez que alguien mira, y el resultado depende del día en que mira."
  - fact: "el cierre mensual corre el primer día hábil y dura seis horas. Si el servicio de tarifas está caído esa mañana, no se factura."
    discoveryPath: "contá cuántas piezas tienen que estar vivas al mismo tiempo para emitir una factura. Cada dependencia sincrónica que agregás al cierre es una pieza más que puede frenarlo."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente corporativo
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de facturación
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: tarifas
      type: service
      label: Servicio de tarifas
      zone: private
      role: owner-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: consumer-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: basetarifas
      type: database
      label: Base de tarifas (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    # Viene en el lienzo, sin conectar, y con respaldo declarado: la factura
    # es un dato regulado, y una base sin respaldo que lo recibe es un error
    # bloqueante. El jugador no tiene ningún gesto para activarle el respaldo
    # a una base que cree él, así que la que el ejercicio necesita tiene que
    # estar dada. Conectarla es la decisión, no fabricarla.
    - id: basefacturas
      type: database
      label: Base de facturas emitidas (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: cliente-portal
      from: { node: cliente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-tarifas
      from: { node: gw }
      to: { node: tarifas }
      dataClass: public
    - id: gw-facturacion
      from: { node: gw }
      to: { node: facturacion }
      dataClass: personal
    - id: tarifas-base
      from: { node: tarifas }
      to: { node: basetarifas }
      dataClass: public
    - id: facturacion-tarifas
      from: { node: facturacion }
      to: { node: tarifas }
      dataClass: public
guarantees:
  - id: g-tarifa-aplicada-guardada
    label: facturación guarda la tarifa que aplicó, sin depender del servicio de tarifas para leerla
    weight: 2
    predicate:
      op: path
      from:
        role: consumer-service
      to:
        type: [database]
      forbid:
        role: owner-service
    whyMissing: no hay ningún camino desde el servicio de facturación hasta una base de datos que no pase por el servicio de tarifas, así que el precio aplicado no está escrito en ningún lado.
    consequence: "el precio de una factura de marzo se recalcula cada vez que alguien la mira, y el resultado depende del día en que mira. Eso no es una factura: es una consulta que devuelve un número distinto cada vez."
  - id: g-no-le-pregunta-al-dueno-al-emitir
    label: facturación no le pregunta la tarifa al servicio de tarifas
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: consumer-service
      to:
        role: owner-service
    whyMissing: el servicio de facturación sigue preguntándole la tarifa al servicio de tarifas, que sólo sabe contestar la vigente.
    consequence: "el servicio de tarifas hace bien su trabajo: publica la de hoy. Preguntarle por la de marzo es pedirle algo que no administra, y la respuesta que devuelve, la de hoy, es exactamente la que produjo 2.300 notas de crédito."
  - id: g-la-tarifa-le-sigue-llegando
    label: la tarifa le sigue llegando a facturación desde su dueño
    weight: 2
    predicate:
      op: path
      from:
        role: owner-service
      to:
        role: consumer-service
    whyMissing: no hay ningún camino desde el servicio de tarifas hasta el servicio de facturación.
    consequence: "cortar la pregunta y no poner nada en su lugar deja a facturación sin saber cuánto cobrar. Congelar el precio aplicado no es dejar de enterarse del precio: es que el dueño lo publique y el que factura lo guarde con la factura."
  - id: g-la-tarifa-sigue-teniendo-dueno
    label: el servicio de tarifas sigue conservando la tarifa vigente en su propia base
    weight: 1
    predicate:
      op: path
      from:
        role: owner-service
      to:
        type: [database]
      forbid:
        role: consumer-service
    whyMissing: no hay ningún camino desde el servicio de tarifas hasta una base de datos propia, sin pasar por facturación.
    consequence: "resolver esto dejando al servicio de tarifas sin dónde guardar deja a la empresa sin quién decida cuánto vale el flete de mañana. La tarifa sigue teniendo un dueño: lo que cambia es quién guarda la que ya se aplicó."
rubric:
  - dimension: el valor aplicado queda escrito donde se aplicó
    signal:
      kind: predicate
      guaranteeId: g-tarifa-aplicada-guardada
  - dimension: nadie le pide a un servicio lo que ese servicio no administra
    signal:
      kind: predicate
      guaranteeId: g-no-le-pregunta-al-dueno-al-emitir
  - dimension: cortar la pregunta no deja de traer el dato
    signal:
      kind: predicate
      guaranteeId: g-la-tarifa-le-sigue-llegando
  - dimension: congelar el valor no borra al dueño del valor
    signal:
      kind: predicate
      guaranteeId: g-la-tarifa-sigue-teniendo-dueno
referenceSolutions:
  - label: tarifas publica cada cambio y facturación lo guarda con la factura
    contextInversion: "que el dueño publique el cambio conviene cuando la tarifa cambia pocas veces por semana y facturación necesita tenerla antes de que llegue el primer flete del día: cuando el cierre corre, todo lo que necesita ya está en su propia base y no depende de que nadie esté vivo. Se paga con una pieza más para operar y con una ventana de minutos entre que comercial publica una tarifa nueva y facturación la tiene."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente corporativo
          zone: public
        - id: portal
          type: web-client
          label: Portal de facturación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tarifas
          type: service
          label: Servicio de tarifas
          zone: private
          role: owner-service
          props: { criticality: "high", replicas: "2" }
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: consumer-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de tarifas publicadas
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: basetarifas
          type: database
          label: Base de tarifas (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: basefacturas
          type: database
          label: Base de facturas emitidas (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-tarifas
          from: { node: gw }
          to: { node: tarifas }
          dataClass: public
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: tarifas-base
          from: { node: tarifas }
          to: { node: basetarifas }
          dataClass: public
        - id: tarifas-cola
          from: { node: tarifas }
          to: { node: cola }
          dataClass: public
        - id: cola-facturacion
          from: { node: cola }
          to: { node: facturacion }
          dataClass: public
        - id: facturacion-basefacturas
          from: { node: facturacion }
          to: { node: basefacturas }
          dataClass: regulated
  - label: facturación conserva el histórico de tarifas y archiva la factura emitida
    contextInversion: "conservar el histórico completo del lado de facturación conviene cuando además de reimprimir hay que recalcular hacia atrás, como en una auditoría que revisa doce meses o un reclamo que discute una serie de fletes: facturación no guarda un precio suelto sino la historia de cuándo estuvo vigente cada uno, y el documento emitido queda archivado tal como se le entregó al cliente. Se paga con una pieza más para operar y con la disciplina de conservar esa historia tanto tiempo como la obligación lo exige."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente corporativo
          zone: public
        - id: portal
          type: web-client
          label: Portal de facturación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tarifas
          type: service
          label: Servicio de tarifas
          zone: private
          role: owner-service
          props: { criticality: "high", replicas: "2" }
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: consumer-service
          props: { criticality: "high", replicas: "2" }
        - id: flujo
          type: stream
          label: Registro de cambios de tarifa
          zone: private
          props: { retention: "30d", partitions: "3", ordering: "sí" }
        - id: basetarifas
          type: database
          label: Base de tarifas (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: basefacturas
          type: database
          label: Base de facturas con la tarifa aplicada (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de facturas emitidas
          zone: private
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-tarifas
          from: { node: gw }
          to: { node: tarifas }
          dataClass: public
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: tarifas-base
          from: { node: tarifas }
          to: { node: basetarifas }
          dataClass: public
        - id: tarifas-flujo
          from: { node: tarifas }
          to: { node: flujo }
          dataClass: public
        - id: flujo-facturacion
          from: { node: flujo }
          to: { node: facturacion }
          dataClass: public
        - id: facturacion-basefacturas
          from: { node: facturacion }
          to: { node: basefacturas }
          dataClass: regulated
        - id: facturacion-archivo
          from: { node: facturacion }
          to: { node: archivo }
          dataClass: regulated
status: PILOT
---

La misma empresa de reparto de la mitad gemela, un piso más arriba: **31.000
facturas de flete por mes**.

El precio del flete lo publica el servicio de tarifas y **cambia todas las
semanas** por el combustible. En doce meses cambió 47 veces. El servicio de
tarifas hace bien su trabajo: administra y publica la tarifa vigente. La de hoy.

El servicio de facturación le pregunta la tarifa cuando emite. Y también cuando
**reimprime**.

En junio una auditoría reimprimió **2.300 facturas de marzo**. Salieron con la
tarifa de junio. Fueron 2.300 notas de crédito, una multa del organismo de
control y una semana de un equipo entero cruzando planillas. Nadie se equivocó
al escribir el código: facturación pidió la tarifa y le contestaron la vigente,
que es la única que existe.

El contrato obliga a poder reconstruir cualquier factura durante **cinco años**.
Una factura del 4 de marzo se reconstruye con la tarifa del 4 de marzo, en 2031,
aunque el servicio de tarifas para entonces no exista.

Hay algo más: el cierre mensual corre el primer día hábil y dura seis horas. Si
el servicio de tarifas está caído esa mañana, **no se factura**.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que el precio que se aplicó quede escrito donde se
aplicó, sin dejar a la empresa sin quién decida cuánto vale el flete de mañana.

> Este ejercicio tiene una mitad gemela: *El domicilio que tiene que ser el de
> hoy*. Misma empresa, misma pregunta (copia propia o pedírselo al dueño) y la
> decisión correcta al revés. Jugá los dos y comparalos.
