---
title: "El importe que no puede discrepar del siniestro"
level: 2
role: tradeoff
domain: seguros
tradeoffPairId: n2-un-almacen-o-dos
D1: 1
D2: 2
D3: 2
D4: 2
D5: 1
D6: 2
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 4
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué dos datos de este sistema tienen que ser verdad al mismo tiempo, y qué pasa en el minuto en que no lo son."
lambda: 0.5
constraints:
  - metric: desfase tolerado entre el estado del siniestro y su importe reservado
    operator: "<="
    value: 0
    unit: segundos
  - metric: capacidad operativa del equipo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: el informe mensual al regulador se arma cruzando el estado del siniestro con el importe reservado. Si un siniestro figura cerrado y su importe sigue abierto, el informe sale mal y la observación es del asegurador, no del sistema.
    discoveryPath: "buscá qué dato de afuera se arma juntando dos datos de adentro. Si dos almacenamientos distintos tienen que coincidir para que ese dato exista, ya no son dos datos: son uno partido en dos lugares."
  - fact: en el último trimestre 340 siniestros quedaron con estado e importe distintos durante hasta 19 horas, hasta que corría la conciliación de la madrugada. Uno de ellos entró así al informe del regulador.
    discoveryPath: "mirá qué pieza del diagrama existe sólo para arreglar lo que otra parte del diagrama desalinea. Una pieza que sincroniza es la factura de una frontera que no debería estar ahí."
  - fact: el equipo son dos personas y hoy operan siete piezas. Cuatro de esas piezas existen para sostener la separación, no para atender siniestros.
    discoveryPath: "contá cuántas piezas del sistema le sirven al asegurado y cuántas le sirven a la forma del sistema. Si el segundo grupo es más grande que el primero, la forma se volvió el producto."
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
      label: Base de siniestros
      zone: restricted
      role: claim-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: reservas
      type: service
      label: Servicio de importes reservados
      zone: private
      role: payout-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: reservasdb
      type: database
      label: Base de importes reservados
      zone: restricted
      role: payout-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: cola
      type: queue
      label: Cambios de estado del siniestro
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 300 }
    - id: conciliador
      type: worker
      label: Conciliador de la madrugada
      zone: private
      given: true
      props: { idempotent: "sí" }
      position: { x: 445, y: 520 }
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
    - id: gw-reservas
      from: { node: gw }
      to: { node: reservas }
      dataClass: regulated
    - id: reservas-reservasdb
      from: { node: reservas }
      to: { node: reservasdb }
      dataClass: regulated
    - id: siniestros-cola
      from: { node: siniestros }
      to: { node: cola }
      dataClass: regulated
    - id: cola-conciliador
      from: { node: cola }
      to: { node: conciliador }
      dataClass: regulated
    - id: conciliador-reservasdb
      from: { node: conciliador }
      to: { node: reservasdb }
      dataClass: regulated
guarantees:
  - id: g-one-store-for-the-claim
    label: el importe reservado no vive en un almacenamiento aparte
    weight: 2
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [database]
            role: payout-db
    whyMissing: el importe reservado sigue teniendo su propio almacenamiento, separado del almacenamiento del siniestro.
    consequence: "mientras el estado y el importe vivan en dos lugares, hay un intervalo en el que uno cambió y el otro no. Ese intervalo llegó a 19 horas y entró una vez al informe del regulador. No es un problema de velocidad: es un problema de que dos verdades que tienen que ser una sola se escriben con dos actos distintos."
  - id: g-claim-owner
    label: el siniestro conserva su almacenamiento y su dueño
    weight: 2
    predicate:
      op: all
      of:
        - op: exists
          node:
            type: [database]
            role: claim-db
        - op: covered
          target:
            role: claim-db
          by:
            role: claim-service
    whyMissing: la base de siniestros no existe, o no está conectada al servicio de siniestros.
    consequence: "unificar es juntar dos escrituras en un acto, no borrar una de las dos. Un asegurador que pierde el registro del siniestro no simplificó su sistema: dejó de tener con qué responderle al asegurado y al regulador."
  - id: g-insured-still-reports
    label: el asegurado sigue pudiendo denunciar el siniestro
    weight: 2
    predicate:
      op: path
      from:
        type: [actor]
      to:
        role: claim-service
    whyMissing: no hay ningún camino desde el asegurado hasta el servicio de siniestros.
    consequence: "la denuncia es la entrada del negocio. Un sistema consistente al que nadie puede entrar no es un sistema consistente: es un sistema apagado, que es trivialmente consistente y no sirve para nada."
  - id: g-no-eventual-patch
    label: la consistencia no se delega a un intermediario
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: claim-service
      to:
        type: [queue, stream]
    whyMissing: el servicio de siniestros sigue publicando el cambio de estado en una cola o en un registro de eventos, y alguien lo aplica después.
    consequence: "acortar la ventana de la conciliación de 19 horas a 19 segundos no cambia la naturaleza del problema: sigue habiendo un instante en que el informe puede leer dos verdades distintas. Un intermediario acelera la reconciliación, no la elimina, y acá el contrato dice cero segundos."
rubric:
  - dimension: el estado y el importe se escriben como un solo acto
    signal:
      kind: predicate
      guaranteeId: g-one-store-for-the-claim
  - dimension: el siniestro conserva un dueño explícito
    signal:
      kind: predicate
      guaranteeId: g-claim-owner
  - dimension: la consistencia no se compra con una pieza que sincroniza después
    signal:
      kind: predicate
      guaranteeId: g-no-eventual-patch
referenceSolutions:
  - label: un solo servicio de siniestros, con el importe adentro
    contextInversion: "un solo almacén con un solo dueño es lo correcto exactamente acá: el estado y el importe entran juntos al informe del regulador, el contrato dice cero segundos de desfase, y el equipo son dos personas que hoy operan cuatro piezas cuyo único trabajo es sostener una frontera. Se paga con que cualquier cambio en la lógica de importes se despliega junto con la lógica de siniestros, y con que un pico de liquidaciones compite por el mismo almacenamiento que la denuncia. En un asegurador donde las liquidaciones fueran cien veces más frecuentes que las denuncias, esta decisión sería la equivocada."
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
          label: Base de siniestros
          zone: restricted
          role: claim-db
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
  - label: la liquidación sigue siendo su propia pieza, pero escribe en el almacén del siniestro por su dueño
    contextInversion: "dejar la liquidación como pieza aparte conviene cuando quien la opera no es quien atiende la denuncia, sino peritos, talleres o un turno distinto, y querés poder desplegar sus reglas sin tocar el flujo de la denuncia. Lo que no se separa es el almacenamiento: el importe se sigue escribiendo en el mismo acto que el estado, porque quien escribe es el dueño del siniestro. Se paga con una unidad operativa más y con que la liquidación depende de que siniestros esté respondiendo."
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
          label: Base de siniestros
          zone: restricted
          role: claim-db
          props: { backup: "diario" }
        - id: liquidacion
          type: service
          label: Servicio de liquidación
          zone: private
          role: payout-service
          props: { criticality: "medium", replicas: "2" }
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
        - id: gw-liquidacion
          from: { node: gw }
          to: { node: liquidacion }
          dataClass: regulated
        - id: liquidacion-siniestros
          from: { node: liquidacion }
          to: { node: siniestros }
          dataClass: regulated
status: PILOT
---

Un asegurador de automotores. Cada siniestro tiene dos datos que el negocio
mira juntos: en qué **estado** está (denunciado, peritado, aprobado, cerrado) y
qué **importe** tiene reservado para pagarlo.

Hoy viven en dos lugares. Siniestros escribe el estado en su base. Importes
reservados escribe el monto en la suya. Y como los dos tienen que coincidir,
hay una cola y un proceso de madrugada que empareja lo que quedó desalineado
durante el día.

El informe mensual al regulador se arma **cruzando esos dos datos**. Un
siniestro cerrado con importe abierto es una observación, y la observación es
del asegurador.

En el último trimestre **340 siniestros** estuvieron con estado e importe
distintos durante hasta **19 horas**. Uno entró así al informe. La respuesta
del equipo fue subir la frecuencia de la conciliación, primero a cada hora y
después a cada quince minutos. Los 340 pasaron a ser 40. No pasaron a ser cero,
y el contrato con el regulador no dice "pocos": dice que el informe tiene que
ser correcto.

El equipo son **dos personas** y su capacidad real es de **4 unidades
operativas**. Hoy el sistema usa **7**. Cuatro de esas siete piezas existen
para sostener la separación entre el estado y el importe, no para atender un
siniestro.

**Rearmá el sistema** para que el estado y el importe del siniestro sean
verdad al mismo tiempo, siempre, sin una pieza que los empareje después.
