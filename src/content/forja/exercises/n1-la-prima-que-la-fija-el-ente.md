---
title: "La prima que la fija el ente"
level: 1
role: tradeoff
domain: seguros
tradeoffPairId: n1-la-prima-se-calcula-o-se-consulta
D1: 1
D2: 2
D3: 1
D4: 1
D5: 1
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: 'libre, pero este ejercicio tiene un gemelo con el mismo diagrama y la conclusión contraria. Un modelo que no sepa quién es el dueño de la tarifa en este contexto va a acertar la mitad de las veces, y las dos veces con el mismo tono de seguridad.'
lambda: 0.5
constraints:
  - metric: diferencia admitida entre la prima cotizada y la del tarifario oficial
    operator: "="
    value: 0
    unit: guaraníes
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: el tarifario del seguro obligatorio lo publica el ente regulador y cambia por resolución, sin aviso previo y sin calendario. En los últimos dos años cambió cuatro veces.
    discoveryPath: preguntate quién decide el número. Si la compañía copia la tabla, cada resolución del ente abre una ventana en la que la compañía cotiza mal, y esa ventana dura hasta que alguien se entera.
  - fact: la compañía ya intentó mantener una copia de la tabla. La multa del año pasado salió de una copia que quedó dos semanas atrasada.
    discoveryPath: buscá en el enunciado qué pasó la última vez que el número lo puso la compañía. La sanción no fue por calcular mal. Fue por calcular con una tabla que ya no era la vigente.
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
      label: Portal de cotización
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: polizas
      type: service
      label: Servicio de pólizas
      zone: private
      role: policy-service
      given: true
      position: { x: 445, y: 300 }
    - id: base
      type: database
      label: Base de pólizas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: asegurado-portal
      from: { node: asegurado }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-polizas
      from: { node: gw }
      to: { node: polizas }
      dataClass: personal
    - id: polizas-base
      from: { node: polizas }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-prima-consultada-al-ente
    label: la prima se pide al tarifario oficial en el momento de cotizar
    weight: 3
    predicate:
      op: path
      from:
        role: policy-service
      to:
        type: [external-provider]
    whyMissing: no hay ningún camino desde el servicio de pólizas hasta el tarifario del ente regulador. La compañía está poniendo un número que no le corresponde poner.
    consequence: 'el ente cambia la tabla por resolución, sin aviso y sin calendario. Cada resolución abre una ventana en la que la compañía cotiza con un número que ya no es el vigente, y esa ventana dura hasta que alguien lee el boletín. La multa del año pasado salió de una ventana de dos semanas.'
  - id: g-poliza-registrada
    label: la póliza emitida sigue quedando registrada
    weight: 1
    predicate:
      op: path
      from:
        role: policy-service
      to:
        type: [database]
    whyMissing: se cortó el camino entre el servicio de pólizas y la base donde queda escrito qué se emitió, a quién y por cuánto.
    consequence: consultar bien la tarifa no reemplaza registrar la póliza. Sin registro, el día que el asegurado choque y la compañía tenga que decir qué contrató, no hay de dónde sacarlo.
  - id: g-asegurado-cotiza
    label: el asegurado sigue llegando al servicio de pólizas por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: policy-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde el portal de cotización hasta el servicio de pólizas que pase por la puerta de entrada.
    consequence: el 70 % de las pólizas obligatorias se venden por el portal. Un sistema que cotiza con la tarifa perfecta y no le llega a nadie no cumple ningún requisito.
rubric:
  - dimension: el número que se cotiza es el que el ente tiene publicado hoy
    signal:
      kind: predicate
      guaranteeId: g-prima-consultada-al-ente
  - dimension: la póliza emitida sigue quedando escrita
    signal:
      kind: predicate
      guaranteeId: g-poliza-registrada
  - dimension: el portal sigue cotizando
    signal:
      kind: predicate
      guaranteeId: g-asegurado-cotiza
referenceSolutions:
  - label: el servicio de pólizas consulta el tarifario
    contextInversion: 'que el mismo servicio hable con el ente gana cuando el tarifario es lo único que se consulta afuera y el equipo es uno solo: un lugar donde se maneja el tiempo de espera, un lugar donde se decide qué hacer si el ente no contesta, una sola integración que entender. Se paga con que el servicio de pólizas acumula responsabilidades que no son suyas: el día que haya un segundo organismo que consultar, esa lógica crece adentro del mismo lugar donde se emite la póliza.'
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: portal
          type: web-client
          label: Portal de cotización
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: polizas
          type: service
          label: Servicio de pólizas
          zone: private
          role: policy-service
        - id: base
          type: database
          label: Base de pólizas
          zone: restricted
          props: { backup: "diario" }
        - id: ente
          type: external-provider
          label: Tarifario del ente regulador
          zone: dmz
      edges:
        - id: asegurado-portal
          from: { node: asegurado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-polizas
          from: { node: gw }
          to: { node: polizas }
          dataClass: personal
        - id: polizas-base
          from: { node: polizas }
          to: { node: base }
          dataClass: personal
        - id: polizas-ente
          from: { node: polizas }
          to: { node: ente }
          dataClass: public
  - label: un servicio de tarifas concentra la conversación con el ente
    contextInversion: 'separar la consulta al ente en su propio servicio gana cuando esa conversación tiene reglas propias que no son las de emitir una póliza: qué hacer cuando el organismo no contesta, cómo se registra la respuesta para poder mostrarla en una inspección, cuántas consultas por minuto tolera el ente. El servicio de pólizas deja de tener que saber nada de eso. Se paga con una unidad operativa más y con una llamada extra en el camino de cada cotización: dos disponibilidades que se multiplican para responder una sola pregunta.'
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: portal
          type: web-client
          label: Portal de cotización
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: polizas
          type: service
          label: Servicio de pólizas
          zone: private
          role: policy-service
        - id: tarifas
          type: service
          label: Servicio de tarifas
          zone: private
        - id: base
          type: database
          label: Base de pólizas
          zone: restricted
          props: { backup: "diario" }
        - id: ente
          type: external-provider
          label: Tarifario del ente regulador
          zone: dmz
      edges:
        - id: asegurado-portal
          from: { node: asegurado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-polizas
          from: { node: gw }
          to: { node: polizas }
          dataClass: personal
        - id: polizas-tarifas
          from: { node: polizas }
          to: { node: tarifas }
          dataClass: public
        - id: tarifas-ente
          from: { node: tarifas }
          to: { node: ente }
          dataClass: public
        - id: polizas-base
          from: { node: polizas }
          to: { node: base }
          dataClass: personal
status: PILOT
---

Una compañía de seguros vende **2.400 pólizas de responsabilidad civil
obligatoria por año**. El asegurado entra al portal, carga los datos del
vehículo y ve un precio.

El precio de esa póliza **no lo pone la compañía**. Lo publica el ente
regulador en un tarifario oficial, por categoría de vehículo, y lo cambia por
resolución: sin aviso previo, sin calendario. En los últimos dos años cambió
cuatro veces.

El área legal escribió el requisito después de una sanción:

> *"La prima cotizada tiene que ser exactamente la del tarifario oficial
> vigente al momento de la cotización."*

*Vigente al momento*. No "la que cargamos el lunes". No "la de la última
actualización". La vigente cuando el asegurado aprieta el botón.

La compañía ya probó la otra forma. Mantenía su propia copia de la tabla, un
analista la actualizaba cuando veía el boletín, y el año pasado esa copia quedó
**dos semanas atrasada** después de una resolución de agosto. La multa no fue
por calcular mal: fue por calcular con una tabla que ya no era la vigente.

Mirá el diagrama. El servicio de pólizas cotiza solo. No hay ninguna conexión
hacia afuera, y el único número que la compañía puede poner ahí es uno que se
copió.

**Conectá al que es dueño del número.** Y decidí quién de tu lado sostiene esa
conversación, que es donde está la decisión de verdad.

> Este ejercicio tiene un gemelo: la misma compañía, el mismo diagrama, otro
> ramo. Ahí la conclusión se da vuelta. Si tu respuesta acá te parece
> obviamente correcta *siempre*, todavía no leíste el otro.
