---
title: "La prima que hay que poder reconstruir"
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
  - metric: cotizaciones que no se pueden reconstruir con las tablas de la compañía
    operator: "="
    value: 0
    unit: cotizaciones
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: el cotizador tercerizado no entrega la fórmula. Devuelve un número y una referencia interna, y el contrato dice explícitamente que el modelo de riesgo es propiedad del proveedor.
    discoveryPath: preguntate qué tendría que mostrar la compañía si el supervisor pide cómo se llegó a la prima de una póliza concreta. Lo único que hay es un número que vino de afuera y una referencia que sólo el proveedor sabe leer.
  - fact: el ramo de hogar no tiene tarifario oficial. La tabla la firma el actuario de la compañía y se archiva con esa firma.
    discoveryPath: buscá en el enunciado quién firma la tabla de este ramo. Si la firma es de la compañía, el dueño del número también, y delegarlo no es una decisión técnica sino la renuncia a algo que no se puede renunciar.
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
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de pólizas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: cotizador
      type: external-provider
      label: Cotizador tercerizado
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
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
    - id: polizas-cotizador
      from: { node: polizas }
      to: { node: cotizador }
      dataClass: personal
guarantees:
  - id: g-calculo-adentro
    label: el cálculo de la prima no depende de ningún tercero
    weight: 3
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [external-provider]
    whyMissing: el sistema le pide la prima a un tercero que no entrega la fórmula. La compañía publica un precio que no puede explicar.
    consequence: 'el supervisor pide cómo se llegó a la prima de una póliza concreta y lo único que hay es un número que vino de afuera y una referencia que sólo el proveedor sabe leer. La compañía no incumple por cobrar de más ni de menos: incumple porque no puede reconstruir su propio precio, y la obligación de poder hacerlo es de ella, no del proveedor.'
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
    consequence: traer el cálculo adentro no reemplaza registrar la póliza. Poder explicar cómo se calculó una prima que no está escrita en ningún lado no le sirve a nadie.
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
    consequence: el ramo de hogar se vende casi entero por el portal. Un sistema que puede explicar perfectamente una prima que ya no cotiza no resolvió nada.
rubric:
  - dimension: la prima se puede reconstruir con las tablas de la compañía
    signal:
      kind: predicate
      guaranteeId: g-calculo-adentro
  - dimension: la póliza emitida sigue quedando escrita
    signal:
      kind: predicate
      guaranteeId: g-poliza-registrada
  - dimension: el portal sigue cotizando
    signal:
      kind: predicate
      guaranteeId: g-asegurado-cotiza
referenceSolutions:
  - label: el cálculo vive en el servicio de pólizas
    contextInversion: 'tener el cálculo en el mismo servicio que emite gana cuando la tabla del actuario cambia dos veces por año y cabe en una planilla: un solo lugar donde vive el precio, un solo despliegue cuando la tabla cambia, y el equipo que emite la póliza es el mismo que entiende cómo se calculó. Se paga con que la lógica actuarial y la de emisión crecen juntas en el mismo lugar, y el día que el actuario quiera probar una tabla nueva sin tocar la emisión, no va a poder.'
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
  - label: el cálculo vive en un servicio de tarifas propio
    contextInversion: 'separar el cálculo en un servicio propio gana cuando la tabla la maneja el área actuarial con su propio calendario y su propia idea de qué es una prueba: pueden cambiar la tabla, versionarla y explicarla sin negociar con el equipo que emite. Y cuando llega el supervisor, hay un solo lugar al que apuntar. Se paga con una unidad operativa más y con una llamada extra en cada cotización: dos disponibilidades que se multiplican para responder una sola pregunta.'
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
          label: Servicio de tarifas actuariales
          zone: private
        - id: base
          type: database
          label: Base de pólizas
          zone: restricted
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
        - id: gw-polizas
          from: { node: gw }
          to: { node: polizas }
          dataClass: personal
        - id: polizas-tarifas
          from: { node: polizas }
          to: { node: tarifas }
          dataClass: personal
        - id: tarifas-base
          from: { node: tarifas }
          to: { node: base }
          dataClass: personal
        - id: polizas-base
          from: { node: polizas }
          to: { node: base }
          dataClass: personal
status: PILOT
---

La misma compañía de seguros del ejercicio anterior. El mismo portal, el mismo
servicio de pólizas, la misma base.

Cambió el ramo, y sólo el ramo.

Esto es **seguro de hogar**: incendio, robo, daños por agua. **1.800 pólizas
por año**. Y acá no hay tarifario oficial: **la tabla la firma el actuario de
la compañía**, se archiva con esa firma, y cambia dos veces por año cuando el
área revisa la siniestralidad.

El requisito lo escribió el área de cumplimiento, después de una inspección:

> *"Toda prima cotizada tiene que poder reconstruirse con las tablas
> registradas de la compañía."*

*Reconstruirse*. Que alguien pueda tomar la póliza número 4.417, la tabla
vigente ese día, y volver a llegar al mismo número.

Mirá el diagrama. Hay un cotizador tercerizado, y funciona bien: responde
rápido, casi nunca se cae, y el precio que devuelve es razonable. El problema
no es que ande mal. El problema es el contrato: **el proveedor no entrega la
fórmula.** Devuelve un número y una referencia interna, y la letra chica dice
que el modelo de riesgo es propiedad suya.

Así que cuando el supervisor pregunte cómo se llegó a esa prima, la respuesta
disponible es "nos la dio un tercero". Esa respuesta no existe como respuesta.
La obligación de poder explicar el precio es de la compañía, y no se terceriza
con el cálculo.

**Traé el cálculo adentro y dejá el portal cotizando.** Después decidí dónde
vive esa tabla, que es donde está la decisión de verdad.

> Este es el gemelo del ejercicio anterior. Mismo diagrama, otro ramo,
> conclusión opuesta. Si te sirvió el mismo razonamiento en los dos, uno de los
> dos lo resolviste de memoria.
