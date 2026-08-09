---
title: "La caché que firmó el arquitecto anterior"
level: 12
role: calibration
domain: banca
D1: 2
D2: 3
D3: 3
D4: 2
D5: 2
D6: 4
D7: 2
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 5
aiBudget: "libre, pero acá la IA no puede decidir por vos. El motor acepta las dos respuestas: la que tenés que poder sostener delante de quien pierde su pieza es la tuya."
lambda: 3.0
constraints:
  - metric: presupuesto operativo del equipo de guardia (techo duro)
    operator: "<="
    value: 5
    unit: unidades operativas
  - metric: tiempo de respuesta acordado con los gestores para consultar un saldo
    operator: "<="
    value: 400
    unit: milisegundos
  - metric: plazo del informe mensual de mora que exige el regulador
    operator: "<="
    value: 5
    unit: días hábiles
hiddenFacts:
  - fact: "el equipo de guardia son dos personas y ya operan otros cuatro sistemas. Cinco piezas es lo que aceptaron sostener por escrito, no una meta de prolijidad."
    discoveryPath: "sumá una sexta pieza y probá tu respuesta: el motor te va a mostrar exactamente cuántos puntos cuesta el sobrepaso, y son muchos más de los que cuesta cualquier garantía sin cumplir."
  - fact: "la caché no es un capricho: sin ella la consulta de saldo tarda 1,3 segundos porque la base de deudas está particionada por año y el gestor consulta los últimos cinco."
    discoveryPath: "está declarada en las restricciones del ejercicio, que piden 400 milisegundos. Si la borrás, ese número no se cumple y tenés que poder decir por qué lo aceptás."
  - fact: "el informe de mora tampoco es un capricho: el mes que no salió, el regulador abrió un expediente que todavía está abierto."
    discoveryPath: "está en la tercera restricción. Las tres restricciones son reales y el presupuesto sólo alcanza para dos."
startingDesign:
  nodes:
    - id: gestor
      type: actor
      label: Gestor de cobranzas
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de cobranzas
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: cobranzas
      type: service
      label: Servicio de cobranzas
      zone: private
      role: collections-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: reportes
      type: service
      label: Servicio de informes de mora
      zone: private
      given: true
      props: { criticality: "medium", replicas: "1" }
      position: { x: 445, y: 410 }
    - id: cache
      type: cache
      label: Caché de saldos
      zone: private
      given: true
      props: { persistence: "volatile", ttl: "300" }
      position: { x: 805, y: 410 }
    - id: deudas
      type: database
      label: Base de deudas
      zone: restricted
      role: ledger
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 520 }
  edges:
    - id: gestor-portal
      from: { node: gestor }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-cobranzas
      from: { node: gw }
      to: { node: cobranzas }
      dataClass: personal
    - id: cobranzas-cache
      from: { node: cobranzas }
      to: { node: cache }
      dataClass: public
    - id: cobranzas-deudas
      from: { node: cobranzas }
      to: { node: deudas }
      dataClass: regulated
    - id: cobranzas-reportes
      from: { node: cobranzas }
      to: { node: reportes }
      dataClass: regulated
    - id: reportes-deudas
      from: { node: reportes }
      to: { node: deudas }
      dataClass: regulated
guarantees:
  - id: g-observed
    label: el servicio de cobranzas reporta lo que le pasa
    weight: 3
    predicate:
      op: covered
      target:
        type: [service]
        role: collections-service
      by:
        type: [observability]
    whyMissing: el servicio de cobranzas no está conectado a ningún componente de monitoreo.
    consequence: "es el único servicio del que depende la operación diaria de veintitrés gestores. Sin señal, el tiempo de detección pasa a ser el tiempo que tarda alguien en enojarse, y acá el que se enoja llama al director, no al equipo."
  - id: g-ledger-path
    label: el servicio de cobranzas sigue llegando a la base de deudas
    weight: 2
    predicate:
      op: path
      from:
        role: collections-service
      to:
        role: ledger
    whyMissing: no quedó ningún camino desde el servicio de cobranzas hasta la base de deudas.
    consequence: recortar para entrar en el presupuesto no puede costar el producto. Un sistema que respeta el techo operativo y ya no puede leer la deuda de nadie no es una decisión, es un apagón.
  - id: g-client-path
    label: el gestor sigue entrando por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: collections-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde el portal hasta el servicio de cobranzas que pase por la puerta de entrada.
    consequence: la puerta de entrada es donde viven la autenticación y el límite de tasa. Si la sacaste para ganar una unidad operativa, ganaste una pieza y perdiste el control de quién entra.
rubric:
  - dimension: el equipo se entera de una falla antes que el director
    signal:
      kind: predicate
      guaranteeId: g-observed
  - dimension: el recorte no rompe la función que justifica el sistema
    signal:
      kind: predicate
      guaranteeId: g-ledger-path
  - dimension: la entrada sigue controlada después del recorte
    signal:
      kind: predicate
      guaranteeId: g-client-path
  - dimension: el diseño entra en el techo operativo que el equipo firmó
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: se queda la caché, se va el informe
    contextInversion: "defendés la caché cuando el costo de la lentitud es continuo y el costo del informe es puntual: veintitrés gestores hacen 9.200 consultas por día, unas 400 cada uno, y cada una pasaría de 400 milisegundos a 1,3 segundos, seis minutos perdidos por gestor por día, todos los días. El informe de mora sale una vez por mes y se puede armar a mano en cuatro horas con una consulta directa a la base. Le decís al director financiero que su informe le va a costar medio día de trabajo de alguien cada mes, con nombre y apellido, y que la alternativa es que su equipo pierda dos horas por día para siempre. Lo que aceptás a cambio: un mes que ese alguien esté de licencia, el informe se demora y el expediente del regulador suma una hoja."
    design:
      nodes:
        - id: gestor
          type: actor
          label: Gestor de cobranzas
          zone: public
        - id: portal
          type: web-client
          label: Portal de cobranzas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobranzas
          type: service
          label: Servicio de cobranzas
          zone: private
          role: collections-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cache
          type: cache
          label: Caché de saldos
          zone: private
          props: { persistence: "volatile", ttl: "300" }
        - id: deudas
          type: database
          label: Base de deudas
          zone: restricted
          role: ledger
          props: { backup: "diario", consistency: "strong" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: gestor-portal
          from: { node: gestor }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobranzas
          from: { node: gw }
          to: { node: cobranzas }
          dataClass: personal
        - id: cobranzas-cache
          from: { node: cobranzas }
          to: { node: cache }
          dataClass: public
        - id: cobranzas-deudas
          from: { node: cobranzas }
          to: { node: deudas }
          dataClass: regulated
        - id: cobranzas-monitoreo
          from: { node: cobranzas }
          to: { node: monitoreo }
          dataClass: public
  - label: se queda el informe, se va la caché
    contextInversion: "defendés el informe cuando el costo de fallarlo no es tiempo sino permiso para operar: el expediente abierto del regulador no se cierra con horas de nadie, y la sanción siguiente no es una multa, es una observación en la licencia. La lentitud de la consulta es una molestia medible, negociable y reversible: le mostrás al responsable de cobranzas que las 9.200 consultas por día pasarían de 400 milisegundos a 1,3 segundos, y esos 900 milisegundos de más son dos horas de espera repartidas entre veintitrés personas, y que en el trimestre que viene el particionado de la base cambia y ese número baja solo. Lo que aceptás a cambio: durante ese trimestre los gestores trabajan peor, lo sienten todos los días, y te lo van a decir todos los días."
    design:
      nodes:
        - id: gestor
          type: actor
          label: Gestor de cobranzas
          zone: public
        - id: portal
          type: web-client
          label: Portal de cobranzas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cobranzas
          type: service
          label: Servicio de cobranzas
          zone: private
          role: collections-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: reportes
          type: service
          label: Servicio de informes de mora
          zone: private
          props: { criticality: "medium", replicas: "1" }
        - id: deudas
          type: database
          label: Base de deudas
          zone: restricted
          role: ledger
          props: { backup: "diario", consistency: "strong" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: gestor-portal
          from: { node: gestor }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-cobranzas
          from: { node: gw }
          to: { node: cobranzas }
          dataClass: personal
        - id: cobranzas-deudas
          from: { node: cobranzas }
          to: { node: deudas }
          dataClass: regulated
        - id: cobranzas-reportes
          from: { node: cobranzas }
          to: { node: reportes }
          dataClass: regulated
        - id: reportes-deudas
          from: { node: reportes }
          to: { node: deudas }
          dataClass: regulated
        - id: cobranzas-monitoreo
          from: { node: cobranzas }
          to: { node: monitoreo }
          dataClass: public
        - id: reportes-monitoreo
          from: { node: reportes }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Un banco mediano. Veintitrés gestores de cobranzas trabajan todo el día
sobre el mismo portal: buscan un deudor, ven su saldo, registran una
gestión. **9.200 consultas por día**, unas 400 cada uno, y el acuerdo interno dice que una
consulta responde en **400 milisegundos**.

El sistema tiene siete meses y lo dejó armado el arquitecto anterior, que
ya no está. Su decisión más visible es la **caché de saldos**: sin ella la
consulta tarda 1,3 segundos, porque la base de deudas está particionada por
año y el gestor mira los últimos cinco. La decisión está firmada en un
documento que todavía circula.

El director financiero quiere otra cosa. El **informe mensual de mora** que
pide el regulador salió tarde una vez, hay un expediente abierto por eso, y
él considera que el servicio de informes es lo único de este sistema que
puede terminar en una sanción.

Y hay un tercer número que nadie discute porque está firmado: el equipo de
guardia son **dos personas** que ya operan otros cuatro sistemas, y
aceptaron por escrito sostener **cinco piezas**. Hoy hay cinco. Ninguna es
un componente de monitoreo.

Ese es el problema entero. La sexta pieza no existe. Vas a tener que mirar
a una de las dos personas que te piden algo y decirle que no, con un
número, no con una opinión.

**Armá el sistema** que cumple las tres reglas (el servicio de cobranzas
reporta lo que le pasa, sigue llegando a la base de deudas, y el gestor
sigue entrando por la puerta de entrada) sin pasar de cinco piezas. La
respuesta correcta no es una: son dos, y la diferencia entre ellas es a
quién le explicás la decisión.
