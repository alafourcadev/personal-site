---
title: "El servicio que no puede confiar en quien lo llama"
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
aiBudget: "libre, pero tu respuesta tiene que explicar qué se paga por volver a preguntar en cada servicio, y por qué acá ese precio se paga igual."
lambda: 0.75
constraints:
  - metric: proveedores externos que operan servicios dentro de la red del organismo
    operator: ">="
    value: 3
    unit: proveedores
  - metric: expedientes con datos de salud y antecedentes penales
    operator: ">="
    value: 210000
    unit: expedientes
hiddenFacts:
  - fact: "en noviembre se comprometió la cadena de despliegue de uno de los proveedores. Durante nueve días, código firmado por ese proveedor corrió dentro de la red del organismo con las mismas credenciales de red que el resto."
    discoveryPath: "preguntate qué significa «adentro» en este sistema. Si adentro corren servicios de tres empresas distintas, la red interna no es un límite de confianza: es sólo un límite de direcciones."
  - fact: "el contrato de los proveedores les prohíbe leer expedientes con datos de salud. No hay ningún componente que haga cumplir esa prohibición: se controla leyendo registros después."
    discoveryPath: "una regla que sólo se comprueba después del hecho no es un control de acceso, es una auditoría. Buscá qué componente podría decir «este que llama no puede ver esto» en el momento."
  - fact: "el servicio de expedientes recibe llamadas de siete componentes distintos y cuatro de ellos no los opera el organismo."
    discoveryPath: "contá quién llama al componente que guarda el dato más sensible. Si la lista incluye software que no controlás, el que atiende esa llamada tiene que poder comprobar de quién es."
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
guarantees:
  - id: g-each-service-revalidates
    label: cada servicio vuelve a comprobar de quién es el pedido que atiende
    weight: 4
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [identity-provider]
    whyMissing: hay al menos un servicio que no consulta al proveedor de identidad, así que atiende la llamada por el solo hecho de venir de adentro.
    consequence: "adentro corren servicios de tres empresas que el organismo no opera. Un servicio que confía en el que lo llama porque lo llama desde la red interna le está delegando el control de acceso a la cadena de despliegue de un tercero. En noviembre esa cadena estuvo comprometida nueve días."
  - id: g-door-identity
    label: la entrada también comprueba identidad
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad.
    consequence: que cada servicio vuelva a preguntar no reemplaza la primera pregunta. Sin comprobación en la entrada, todo pedido malformado o automatizado llega hasta el fondo antes de que alguien lo rechace, y el costo de rechazarlo lo paga el componente más caro.
  - id: g-citizen-path
    label: el agente llega al trámite pasando por la entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: tramites-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el escritorio de trámites hasta el servicio de trámites que pase por una entrada del sistema.
    consequence: endurecer el interior no puede costar el canal por el que trabajan 4.300 agentes. Un control que deja al organismo sin operar se revierte el mismo día y vuelve todo como estaba.
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
  - dimension: ningún servicio confía en el que lo llama sólo por venir de adentro
    signal:
      kind: predicate
      guaranteeId: g-each-service-revalidates
  - dimension: la entrada sigue comprobando antes de dejar entrar
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
  - label: los dos servicios vuelven a preguntar
    contextInversion: "que cada servicio revalide es lo correcto cuando adentro corre software de terceros: el servicio de expedientes deja de confiar en que quien lo llama es quien dice ser y pasa a comprobarlo, y la prohibición contractual de leer expedientes de salud se puede hacer cumplir en el momento en vez de auditarla un mes después. El costo hay que decirlo entero: cada llamada interna agrega una consulta más, y revocar una credencial ahora depende de que dos componentes se enteren, no de uno."
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
        - id: tramites-identidad
          from: { node: tramites }
          to: { node: identidad }
          dataClass: secret
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
  - label: un solo servicio que comprueba, y el trabajo pesado por detrás
    contextInversion: "sacar el segundo servicio del camino del pedido y convertirlo en un trabajo por detrás conviene cuando lo que hacía no era atender a una persona sino procesar expedientes en lote: un trabajo que consume una cola no lleva sesión de nadie, así que no hay identidad que revalidar y la superficie que hay que comprobar se reduce a un solo componente. Es la forma más barata de cumplir la regla «nadie confía en quien lo llama»: que haya menos llamadas. Se paga con latencia, porque el expediente se procesa después y no durante, y con dos piezas de infraestructura más para operar."
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
        - id: colaexpedientes
          type: queue
          label: Cola de expedientes por procesar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: procesador
          type: worker
          label: Procesador de expedientes
          zone: private
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
        - id: tramites-identidad
          from: { node: tramites }
          to: { node: identidad }
          dataClass: secret
        - id: tramites-colaexpedientes
          from: { node: tramites }
          to: { node: colaexpedientes }
          dataClass: regulated
        - id: colaexpedientes-procesador
          from: { node: colaexpedientes }
          to: { node: procesador }
          dataClass: regulated
        - id: procesador-basetramites
          from: { node: procesador }
          to: { node: basetramites }
          dataClass: regulated
        - id: tramites-basetramites
          from: { node: tramites }
          to: { node: basetramites }
          dataClass: regulated
status: PILOT
---

La misma plataforma de trámites del organismo público, un año después y con
un dato que cambia todo: **tres de los servicios que corren adentro los
operan proveedores externos**. Distintas empresas, distintas cadenas de
despliegue, la misma red.

En noviembre se comprometió la cadena de despliegue de uno de ellos. Durante
**nueve días**, código firmado por ese proveedor corrió dentro de la red del
organismo con las mismas credenciales de red que el resto del sistema. No
hubo intrusión perimetral. No hacía falta: ya estaba adentro.

El contrato de los proveedores les prohíbe leer expedientes con datos de
salud, y hay **210.000**. Esa prohibición hoy se controla leyendo registros
después. Un control que se comprueba después del hecho no es control de
acceso: es una auditoría con un mes de retraso.

Acá "adentro" dejó de ser un límite de confianza. Es sólo un rango de
direcciones donde conviven servicios de cuatro organizaciones distintas.

El equipo de plataforma se opone al cambio con números concretos: cada
llamada interna que tenga que volver a comprobar identidad agrega una
consulta más, y hay trámites que encadenan cinco llamadas. Además pierden lo
que más querían: un solo lugar donde cortar un acceso. Ahora una revocación
depende de que se entere cada componente que pregunta.

Los dos tienen razón. La pregunta no es quién gana: es qué riesgo pesa más
en **este** contexto.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que ningún servicio atienda una llamada sólo
porque viene de adentro, sin dejar de comprobar también en la entrada.
