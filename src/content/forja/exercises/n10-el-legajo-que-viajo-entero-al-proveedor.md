---
title: "El legajo que viajó entero al proveedor"
level: 10
role: core
domain: reclutamiento
D1: 3
D2: 3
D3: 4
D4: 2
D5: 3
D6: 3
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 8
  monthlyUsd: 900
aiBudget: "libre, pero tu respuesta tiene que decir qué pieza evalúa el legajo del candidato, en qué infraestructura corre esa pieza, y por qué el texto del aviso de empleo puede seguir saliendo del proveedor."
lambda: 0.7
constraints:
  - metric: "candidatos evaluados por mes"
    operator: ">="
    value: 8400
    unit: candidatos
  - metric: "avisos de empleo redactados por mes"
    operator: ">="
    value: 5200
    unit: avisos
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: "el contrato con el proveedor del modelo es un contrato de servicio. El legajo que se le manda trae foto, domicilio, fecha de nacimiento y nacionalidad: exactamente los cuatro datos con los que la ley prohíbe decidir una contratación."
    discoveryPath: "mirá qué declara la conexión que sale del servicio de legajos y a qué tipo de pieza entra. El motor la bloquea antes de calcular nada, y el bloqueo no es un trámite: es un dato personal saliendo hacia un tercero con el que no hay acuerdo de tratamiento."
  - fact: "anonimizar el legajo no alcanza. Lo que el modelo evalúa es la trayectoria completa, y una trayectoria identifica: dos empleadores, una universidad y un año de egreso alcanzan para saber de quién se trata."
    discoveryPath: "probá el reflejo que aprendiste con la historia clínica: poné una pieza que borre nombre y documento antes del proveedor. Después preguntate qué queda del legajo si además le sacás la trayectoria, y si sin trayectoria el modelo todavía sirve para evaluar a alguien."
  - fact: "la consultora ya tiene un modelo corriendo en su propia infraestructura. Se compró el año pasado para el producto de descripciones de puesto, quedó con capacidad libre y hoy no recibe nada."
    discoveryPath: "hay dos modelos en el lienzo. Uno dice que corre afuera y el otro adentro; uno está conectado y el otro no. La decisión de alojamiento no la toma compras: la toma el dato que va a atravesar la pieza."
  - fact: "el texto del aviso de empleo no tiene ningún candidato adentro: es el puesto, el sueldo y la ciudad. El modelo del proveedor cuesta doce veces menos por llamada que el propio, y ahí no hay nada que proteger."
    discoveryPath: "separá los dos flujos y preguntá por cada uno qué dato viaja. Si mandás todo al modelo caro porque uno de los dos flujos es sensible, estás pagando protección para un texto que ya es público."
startingDesign:
  nodes:
    - id: candidato
      type: actor
      label: "Candidato"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: "Portal de postulaciones"
      zone: public
      given: true
      position: { x: 445, y: 190 }
    - id: reclutador
      type: actor
      label: "Reclutador"
      zone: public
      given: true
      position: { x: 85, y: 190 }
    - id: consola
      type: web-client
      label: "Consola de reclutamiento"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
    - id: legajos
      type: service
      label: "Servicio de legajos de candidatos"
      zone: private
      role: legajos
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 520 }
    - id: basecand
      type: database
      label: "Base de legajos"
      zone: restricted
      role: candidatos
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
    - id: avisos
      type: service
      label: "Servicio de avisos de empleo"
      zone: private
      role: avisos
      given: true
      props: { criticality: "medium", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: modeloprov
      type: ai-model
      label: "Modelo del proveedor de reclutamiento"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 630 }
    - id: modelopropio
      type: ai-model
      label: "Modelo propio, en la infraestructura de la consultora"
      zone: private
      given: true
      props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
      position: { x: 445, y: 740 }
  edges:
    - id: candidato-portal
      from: { node: candidato }
      to: { node: portal }
      dataClass: personal
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: reclutador-consola
      from: { node: reclutador }
      to: { node: consola }
      dataClass: public
    - id: consola-gw
      from: { node: consola }
      to: { node: gw }
      dataClass: personal
    - id: gw-legajos
      from: { node: gw }
      to: { node: legajos }
      dataClass: personal
    - id: legajos-basecand
      from: { node: legajos }
      to: { node: basecand }
      dataClass: personal
    - id: legajos-modeloprov
      from: { node: legajos }
      to: { node: modeloprov }
      dataClass: personal
    - id: gw-avisos
      from: { node: gw }
      to: { node: avisos }
      dataClass: public
guarantees:
  - id: g-ningun-camino-del-legajo-al-proveedor
    label: "no existe ningún camino desde el servicio de legajos hasta el modelo del proveedor"
    weight: 3
    predicate:
      op: not
      of:
        - op: path
          from:
            role: legajos
          to:
            type: [ai-model]
            propEquals: { hosting: "external" }
    whyMissing: "el servicio de legajos llega al modelo del proveedor, hoy por una conexión directa. Alcanza con que exista un camino: no importa cuántas piezas haya en el medio, el legajo termina afuera."
    consequence: "la trayectoria de una persona, con su foto y su domicilio, entra en la infraestructura de un tercero con el que hay un contrato de servicio y ningún acuerdo de tratamiento. La transferencia no se deshace. Y cuando un candidato rechazado pregunte por qué lo descartaron, la respuesta va a estar del otro lado de una frontera que la consultora no controla."
  - id: g-el-legajo-lo-evalua-el-modelo-propio
    label: "el legajo llega al modelo que corre en la infraestructura de la consultora"
    weight: 3
    predicate:
      op: path
      from:
        role: legajos
      to:
        type: [ai-model]
        propEquals: { hosting: "interno" }
    whyMissing: "no hay ningún camino desde el servicio de legajos hasta el modelo propio, que está en el lienzo sin recibir nada."
    consequence: "sin ese camino la respuesta fácil es dejar de evaluar y volver a las 8.400 lecturas a mano por mes, que es lo que la consultora dejó de hacer en 2024 porque tardaba once días. El modelo no es el problema: el problema era dónde estaba corriendo."
  - id: g-el-aviso-sigue-saliendo-del-proveedor
    label: "el servicio de avisos de empleo sigue llegando al modelo del proveedor"
    weight: 2
    predicate:
      op: path
      from:
        role: avisos
      to:
        type: [ai-model]
        propEquals: { hosting: "external" }
    whyMissing: "el servicio de avisos no llega a ningún modelo del proveedor: o quedó sin conexión, o su flujo se mudó al modelo propio junto con el de los legajos."
    consequence: "el texto de un aviso es el puesto, el sueldo y la ciudad: ahí no hay ningún candidato que proteger. Mandarlo al modelo propio cuesta doce veces más por llamada y ocupa la capacidad que necesita la evaluación de legajos. Proteger todo por igual es la forma más cara de no decidir nada."
rubric:
  - dimension: "el dato del candidato no cruza la frontera de la consultora"
    signal:
      kind: predicate
      guaranteeId: g-ningun-camino-del-legajo-al-proveedor
  - dimension: "la evaluación automática sigue existiendo"
    signal:
      kind: predicate
      guaranteeId: g-el-legajo-lo-evalua-el-modelo-propio
  - dimension: "lo que no es sensible sigue usando el modelo barato"
    signal:
      kind: predicate
      guaranteeId: g-el-aviso-sigue-saliendo-del-proveedor
referenceSolutions:
  - label: "el legajo se evalúa en el momento, contra el modelo propio"
    contextInversion: "evaluar dentro de la misma llamada conviene cuando el reclutador está mirando la pantalla: abre el legajo, ve el resumen y sigue. Con 8.400 legajos por mes y un modelo propio con capacidad libre, el ritmo entra sin amortiguación y el diseño queda en seis piezas para operar, dos menos que el techo. Se paga con que un pico de postulaciones, una búsqueda masiva o un aviso que se hace viral, le llega al modelo propio sin nada que absorba la diferencia, y con que el reclutador espera lo que tarde la evaluación."
    design:
      nodes:
        - id: candidato
          type: actor
          label: "Candidato"
          zone: public
        - id: portal
          type: web-client
          label: "Portal de postulaciones"
          zone: public
        - id: reclutador
          type: actor
          label: "Reclutador"
          zone: public
        - id: consola
          type: web-client
          label: "Consola de reclutamiento"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: legajos
          type: service
          label: "Servicio de legajos de candidatos"
          zone: private
          role: legajos
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: basecand
          type: database
          label: "Base de legajos"
          zone: restricted
          role: candidatos
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: avisos
          type: service
          label: "Servicio de avisos de empleo"
          zone: private
          role: avisos
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: modeloprov
          type: ai-model
          label: "Modelo del proveedor de reclutamiento"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: modelopropio
          type: ai-model
          label: "Modelo propio, en la infraestructura de la consultora"
          zone: private
          props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
      edges:
        - id: candidato-portal
          from: { node: candidato }
          to: { node: portal }
          dataClass: personal
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: reclutador-consola
          from: { node: reclutador }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-legajos
          from: { node: gw }
          to: { node: legajos }
          dataClass: personal
        - id: legajos-basecand
          from: { node: legajos }
          to: { node: basecand }
          dataClass: personal
        - id: legajos-modelopropio
          from: { node: legajos }
          to: { node: modelopropio }
          dataClass: personal
        - id: gw-avisos
          from: { node: gw }
          to: { node: avisos }
          dataClass: public
        - id: avisos-modeloprov
          from: { node: avisos }
          to: { node: modeloprov }
          dataClass: public
  - label: "la evaluación se desacopla en una cola y un proceso propio"
    contextInversion: "desacoplar conviene cuando las postulaciones llegan a golpes y la capacidad del modelo propio es fija: la consultora compró una máquina, no un servicio elástico, así que el pico no se resuelve pagando más. Con la cola en el medio, 4.000 postulaciones en una tarde se convierten en demora y no en errores, y el proceso que evalúa es también el que escribe el resultado, así que un reintento no duplica nada. Se paga con las ocho unidades operativas completas, el techo exacto del equipo, y con que el reclutador ya no ve el resumen en el momento de abrir el legajo."
    design:
      nodes:
        - id: candidato
          type: actor
          label: "Candidato"
          zone: public
        - id: portal
          type: web-client
          label: "Portal de postulaciones"
          zone: public
        - id: reclutador
          type: actor
          label: "Reclutador"
          zone: public
        - id: consola
          type: web-client
          label: "Consola de reclutamiento"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: legajos
          type: service
          label: "Servicio de legajos de candidatos"
          zone: private
          role: legajos
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: "Cola de legajos por evaluar"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: evaluador
          type: worker
          label: "Proceso de evaluación de legajos"
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: basecand
          type: database
          label: "Base de legajos"
          zone: restricted
          role: candidatos
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: avisos
          type: service
          label: "Servicio de avisos de empleo"
          zone: private
          role: avisos
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: modeloprov
          type: ai-model
          label: "Modelo del proveedor de reclutamiento"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: modelopropio
          type: ai-model
          label: "Modelo propio, en la infraestructura de la consultora"
          zone: private
          props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
      edges:
        - id: candidato-portal
          from: { node: candidato }
          to: { node: portal }
          dataClass: personal
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: reclutador-consola
          from: { node: reclutador }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-legajos
          from: { node: gw }
          to: { node: legajos }
          dataClass: personal
        - id: legajos-basecand
          from: { node: legajos }
          to: { node: basecand }
          dataClass: personal
        - id: legajos-cola
          from: { node: legajos }
          to: { node: cola }
          dataClass: personal
        - id: cola-evaluador
          from: { node: cola }
          to: { node: evaluador }
          dataClass: personal
        - id: evaluador-modelopropio
          from: { node: evaluador }
          to: { node: modelopropio }
          dataClass: personal
        - id: evaluador-basecand
          from: { node: evaluador }
          to: { node: basecand }
          dataClass: personal
        - id: gw-avisos
          from: { node: gw }
          to: { node: avisos }
          dataClass: public
        - id: avisos-modeloprov
          from: { node: avisos }
          to: { node: modeloprov }
          dataClass: public
status: PILOT
---

Una consultora de selección recibe **8.400 postulaciones por mes** para
búsquedas de perfiles técnicos. Hasta 2024 las leía un equipo de seis personas
y tardaba once días en armar una lista corta. Desde 2024 las lee un modelo, y
la lista sale en cuatro horas.

Lo que se le manda al modelo es **el legajo completo**: el CV en texto, la
foto, el domicilio, la fecha de nacimiento, la nacionalidad y la trayectoria
laboral entera. El modelo no corre en la consultora: corre en la
infraestructura del proveedor, con el que se firmó un contrato de servicio y
nada más.

Son, casualmente, los cuatro datos con los que la ley prohíbe decidir una
contratación. Y están cruzando una frontera todos los días, 8.400 veces por
mes.

Hay un reflejo que en este punto ya tenés entrenado: poner una pieza que borre
nombre y documento antes de salir. **Acá no alcanza.** Lo que el modelo evalúa
es la trayectoria, y una trayectoria identifica: dos empleadores, una
universidad y un año de egreso son suficientes para saber de quién se trata. Si
además le sacás la trayectoria, no queda legajo que evaluar.

En el lienzo hay **dos modelos**. Uno dice que corre afuera y está conectado.
El otro corre en la infraestructura de la consultora, se compró el año pasado
para el producto de descripciones de puesto, quedó con capacidad libre y hoy no
recibe nada.

Y hay un segundo flujo que conviene mirar por separado: el **servicio de avisos
de empleo** redacta **5.200 avisos por mes**: el puesto, el sueldo, la ciudad.
Ahí no hay ningún candidato. El modelo del proveedor cuesta **doce veces menos
por llamada** que el propio, y la capacidad del propio es fija: se compró una
máquina, no un servicio que crece pagando más.

El equipo tiene un techo de **8 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que ningún camino lleve el legajo de un candidato
hasta el proveedor, para que la evaluación automática siga existiendo, y para
que el aviso de empleo no termine pagando una protección que no necesita.
