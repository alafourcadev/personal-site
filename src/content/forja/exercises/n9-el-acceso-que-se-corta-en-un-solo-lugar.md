---
title: "El acceso que se corta en un solo lugar"
level: 9
role: tradeoff
domain: gobierno
tradeoffPairId: identidad-donde-se-comprueba
D1: 3
D2: 4
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 3
D9: 3
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar qué se pierde al concentrar la comprobación en un solo punto, no sólo qué se gana."
lambda: 0.75
constraints:
  - metric: tiempo máximo entre revocar una credencial y que deje de servir en todo el sistema
    operator: "<="
    value: 30
    unit: segundos
  - metric: agentes públicos con acceso al expediente ciudadano
    operator: ">="
    value: 4300
    unit: agentes
hiddenFacts:
  - fact: "el mes pasado se revocó la credencial de un agente sumariado y siguió abriendo expedientes durante cuatro horas: la puerta ya no lo dejaba entrar, pero un servicio interno seguía aceptando su sesión porque validaba con su propia copia de las claves, refrescada cada seis horas."
    discoveryPath: "buscá cuántos componentes del diseño comprueban identidad por su cuenta. Cada uno que lo hace guarda su propia copia de la verdad, y una copia siempre está atrasada respecto del original."
  - fact: "la ley de procedimiento administrativo obliga al organismo a presentar, ante un pedido judicial, el registro de quién accedió a un expediente. Hoy ese registro hay que armarlo juntando los archivos de cuatro componentes distintos, con relojes distintos."
    discoveryPath: "preguntate desde dónde sacás la lista de accesos si te la piden mañana. Si hay que unir varias fuentes, no tenés un registro: tenés un trabajo de reconstrucción cada vez."
  - fact: "de los 4.300 agentes, 3.900 usan un único trámite. La superficie interna es grande pero el camino real es corto."
    discoveryPath: "es la razón por la que en este contexto concentrar la comprobación no deja fuera a nadie: casi todo el tráfico entra por la misma puerta y sale por el mismo trámite."
startingDesign:
  nodes:
    - id: ciudadano
      type: actor
      label: Agente público
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Escritorio de trámites
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 170 }
    - id: tramites
      type: service
      label: Servicio de trámites
      zone: private
      role: tramites-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 280 }
    - id: expedientes
      type: service
      label: Servicio de expedientes
      zone: private
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 390 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad del Estado
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 80 }
    - id: basetramites
      type: database
      label: Base de expedientes
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 220 }
  edges:
    - id: ciudadano-portal
      from: { node: ciudadano }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-tramites
      from: { node: gw }
      to: { node: tramites }
      dataClass: personal
    - id: tramites-expedientes
      from: { node: tramites }
      to: { node: expedientes }
      dataClass: regulated
    - id: expedientes-identidad
      from: { node: expedientes }
      to: { node: identidad }
      dataClass: secret
    - id: tramites-basetramites
      from: { node: tramites }
      to: { node: basetramites }
      dataClass: regulated
guarantees:
  - id: g-door-identity
    label: la entrada comprueba identidad contra el proveedor del Estado
    weight: 3
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad.
    consequence: "si la puerta no pregunta, la comprobación queda repartida entre los servicios de adentro y cada uno la hace a su manera. La primera consecuencia no es un agujero: es que nadie puede decir cuál es la regla."
  - id: g-single-decision-point
    label: ningún servicio interno comprueba identidad por su cuenta
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        type: [service]
      to:
        type: [identity-provider]
    whyMissing: hay un servicio interno conectado al proveedor de identidad, es decir, decidiendo por su cuenta si el pedido es válido.
    consequence: "cada servicio que comprueba por su cuenta guarda su propia copia de las claves y la refresca cuando puede. Revocar una credencial deja de ser un acto y pasa a ser una carrera: el mes pasado un agente sumariado siguió abriendo expedientes cuatro horas después de la revocación."
  - id: g-citizen-path
    label: el agente llega al trámite pasando por la entrada
    weight: 2
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: tramites-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el escritorio de trámites hasta el servicio de trámites que pase por una entrada del sistema.
    consequence: sin una entrada en el camino no hay ningún punto donde cortar un acceso ni donde registrar el intento. Concentrar la decisión exige que exista el lugar donde se concentra.
  - id: g-record-store
    label: el expediente vive en un almacenamiento con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: tramites-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio de trámites hasta una base de datos con copia de respaldo declarada.
    consequence: un expediente administrativo tiene plazos de conservación fijados por ley y un pedido judicial no admite "se perdió". Sin copia, la conservación es una intención.
rubric:
  - dimension: hay un único punto donde se decide quién entra
    signal:
      kind: predicate
      guaranteeId: g-single-decision-point
  - dimension: ese punto existe y está en el camino de todos
    signal:
      kind: predicate
      guaranteeId: g-door-identity
  - dimension: el agente sigue pudiendo trabajar
    signal:
      kind: predicate
      guaranteeId: g-citizen-path
  - dimension: el expediente queda donde se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-record-store
referenceSolutions:
  - label: la puerta decide, los servicios de adentro obedecen
    contextInversion: "concentrar la comprobación en la entrada es lo correcto cuando la exigencia dura es el tiempo de revocación: hay un solo lugar donde cortar, y cortar ahí corta en todos lados al mismo tiempo. Además deja un único registro de accesos, que es exactamente lo que un pedido judicial pide. El costo es real y hay que decirlo: si alguien entra a la red interna, adentro nadie le vuelve a preguntar nada."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Agente público
          zone: public
        - id: portal
          type: web-client
          label: Escritorio de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tramites
          type: service
          label: Servicio de trámites
          zone: private
          role: tramites-service
          props: { criticality: "high", replicas: "2" }
        - id: expedientes
          type: service
          label: Servicio de expedientes
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad del Estado
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basetramites
          type: database
          label: Base de expedientes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: ciudadano-portal
          from: { node: ciudadano }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-tramites
          from: { node: gw }
          to: { node: tramites }
          dataClass: personal
        - id: tramites-expedientes
          from: { node: tramites }
          to: { node: expedientes }
          dataClass: regulated
        - id: tramites-basetramites
          from: { node: tramites }
          to: { node: basetramites }
          dataClass: regulated
  - label: una sola pieza detrás de la puerta
    contextInversion: "juntar los dos servicios en uno conviene cuando 3.900 de los 4.300 agentes usan un único trámite: la separación no estaba comprando independencia de despliegue ni de escala, sólo agregaba un salto interno más y una pieza más para operar. Con un solo componente detrás de la puerta, la frase «adentro nadie vuelve a preguntar» describe una superficie chica y verificable en vez de una promesa sobre cuatro servicios. Se paga con acoplamiento: trámites y expedientes se despliegan juntos para siempre."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Agente público
          zone: public
        - id: portal
          type: web-client
          label: Escritorio de trámites
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: tramites
          type: service
          label: Servicio de trámites y expedientes
          zone: private
          role: tramites-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad del Estado
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basetramites
          type: database
          label: Base de expedientes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: ciudadano-portal
          from: { node: ciudadano }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-tramites
          from: { node: gw }
          to: { node: tramites }
          dataClass: personal
        - id: tramites-basetramites
          from: { node: tramites }
          to: { node: basetramites }
          dataClass: regulated
status: PILOT
---

Una plataforma de trámites de un organismo público. **4.300 agentes**
abriendo, firmando y cerrando expedientes ciudadanos.

Todo el sistema corre en infraestructura del organismo, operada por el
organismo, con una sola puerta de entrada desde internet.

El mes pasado se revocó la credencial de un agente sumariado. La puerta dejó
de aceptarlo enseguida. **Siguió abriendo expedientes durante cuatro
horas.** El servicio de expedientes comprobaba la identidad por su cuenta,
contra su propia copia de las claves, que refrescaba cada seis horas.

Nadie hizo nada mal: cada equipo hizo lo que le pareció más seguro. El
resultado es que hoy la comprobación está repartida y **nadie puede decir
cuál es la regla**, porque hay cuatro implementaciones de la regla.

Hay una segunda consecuencia que apareció en el pedido judicial de abril: la
ley obliga al organismo a presentar el registro de quién accedió a un
expediente. Ese registro hoy se arma juntando archivos de cuatro componentes
con relojes distintos, y tardó once días.

La política nueva es dura y no está en discusión: **una credencial revocada
deja de servir en todo el sistema en menos de 30 segundos**. El equipo de
seguridad de aplicaciones se opone y su argumento no es tonto: sacarle la
comprobación a los servicios internos significa que, si alguien llega a la
red interna, nadie más le va a preguntar nada.

Un dato que ordena la discusión: de los 4.300 agentes, **3.900 usan un único
trámite**. La superficie interna parece grande; el camino real es corto.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que la decisión de quién entra ocurra en un solo
lugar, y para que ese lugar esté en el camino de todos.
