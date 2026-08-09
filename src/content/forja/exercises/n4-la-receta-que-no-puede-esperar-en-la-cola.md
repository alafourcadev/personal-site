---
title: "La receta que no puede esperar en la cola"
level: 4
role: trap
domain: farmacia
D1: 2
D2: 2
D3: 2
D4: 1
D5: 1
D6: 1
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [3]
budget:
  opsUnits: 6
aiBudget: "libre, pero si tu respuesta pone una cola en el medio, tenés que explicar quién le avisa al paciente que ya se fue del mostrador."
lambda: 0.5
constraints:
  - metric: tiempo aceptable para responder si la receta se puede dispensar
    operator: "<="
    value: 900
    unit: ms
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: el registro nacional responde en 300 ms el 98% de las veces, y tiene un acuerdo de servicio firmado de 900 ms. No es un tercero lento, es un tercero rápido con contrato.
    discoveryPath: "el enunciado trae el número. Antes de desacoplar por reflejo, preguntate si el tercero es realmente el problema: el ejercicio del proveedor de email lo era porque tardaba 8 segundos y se caía. Este no."
  - fact: una receta de un medicamento controlado que ya fue dispensada en otra farmacia no se puede volver a dispensar, y el registro es el único lugar donde eso consta.
    discoveryPath: "preguntate qué hace el farmacéutico con la respuesta. Si la respuesta llega cuando el paciente ya se fue con la caja en la mano, no es una respuesta: es una notificación de que hubo un delito."
  - fact: la farmacia tiene obligación de conservar el registro de cada dispensa de sustancia controlada por cinco años, y hoy ese registro es un cuaderno.
    discoveryPath: "mirá qué le queda a la farmacia después del despacho. La consulta al registro nacional no deja constancia propia: es una pregunta que se hace y se olvida."
startingDesign:
  nodes:
    - id: farmaceutico
      type: actor
      label: Farmacéutico
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: mostrador
      type: web-client
      label: Terminal de mostrador
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: despacho
      type: service
      label: Servicio de despacho
      zone: private
      role: dispensing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: registro
      type: external-provider
      label: Registro nacional de recetas
      zone: dmz
      role: prescription-registry
      given: true
      position: { x: 445, y: 300 }
    # Viene en el lienzo, sin conectar, y con respaldo declarado: la dispensa
    # es un dato regulado, y una base sin respaldo que lo recibe es un error
    # bloqueante. El jugador no tiene ningún gesto para activarle el respaldo
    # a una base que cree él, así que la que el ejercicio necesita tiene que
    # estar dada. Conectarla es la decisión, no fabricarla.
    - id: libro
      type: database
      label: Libro de dispensas (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario", persistence: "durable" }
      position: { x: 805, y: 410 }
  edges:
    - id: farmaceutico-mostrador
      from: { node: farmaceutico }
      to: { node: mostrador }
    - id: mostrador-gw
      from: { node: mostrador }
      to: { node: gw }
    - id: gw-despacho
      from: { node: gw }
      to: { node: despacho }
guarantees:
  - id: g-sync-check
    label: el despacho tiene la respuesta del registro nacional antes de entregar
    weight: 3
    predicate:
      op: path
      from:
        role: dispensing-service
      to:
        role: prescription-registry
      forbid:
        type: [queue, stream]
    whyMissing: no hay un camino desde el servicio de despacho hasta el registro nacional que no pase por una cola o un registro de eventos.
    consequence: el farmacéutico entrega la caja y la respuesta llega después. Si la receta ya había sido usada en otra farmacia, la única acción posible es un informe a la autoridad sanitaria sobre un medicamento controlado que ya salió por la puerta.
  - id: g-no-async-hop
    label: no hay una cola entre el despacho y el registro nacional
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: dispensing-service
      to:
        type: [queue, stream]
    whyMissing: el servicio de despacho está encolando la consulta al registro nacional.
    consequence: "una cola acá no compra nada y cuesta dos cosas: una pieza más para operar, y la peligrosa creencia de que el chequeo se hizo. El registro responde en 300 ms con un acuerdo firmado de 900. Desacoplar es la respuesta a un tercero lento o caído; este no es ninguno de los dos."
  - id: g-dispensing-record
    label: cada dispensa deja constancia propia y durable
    weight: 1
    predicate:
      op: path
      from:
        role: dispensing-service
      to:
        type: [database]
    whyMissing: no hay ninguna base de datos donde el servicio de despacho deje registrada la dispensa.
    consequence: "la farmacia tiene que poder mostrar cinco años de dispensas de sustancias controladas ante una inspección. Preguntarle al registro nacional no es tener el dato: es tener acceso al dato de otro."
  - id: g-observability
    label: el servicio de despacho está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: dispensing-service
      by:
        type: [observability]
    whyMissing: el servicio de despacho no está conectado a ningún componente de observabilidad.
    consequence: si el registro nacional empieza a rechazar consultas, la farmacia se entera por el farmacéutico que llama a soporte con un paciente esperando enfrente.
rubric:
  - dimension: la respuesta del registro llega antes de entregar el medicamento
    signal:
      kind: predicate
      guaranteeId: g-sync-check
  - dimension: no se agregó un paso asíncrono donde no hacía falta
    signal:
      kind: predicate
      guaranteeId: g-no-async-hop
  - dimension: la dispensa queda registrada del lado de la farmacia
    signal:
      kind: predicate
      guaranteeId: g-dispensing-record
referenceSolutions:
  - label: consulta directa al registro nacional
    contextInversion: es la variante correcta cuando la farmacia es una sola y el registro nacional responde dentro de su acuerdo de servicio. Un salto síncrono, ninguna pieza intermedia, y la decisión de entregar o no se toma con el dato en la mano.
    design:
      nodes:
        - id: farmaceutico
          type: actor
          label: Farmacéutico
          zone: public
        - id: mostrador
          type: web-client
          label: Terminal de mostrador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: despacho
          type: service
          label: Servicio de despacho
          zone: private
          role: dispensing-service
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: external-provider
          label: Registro nacional de recetas
          zone: dmz
          role: prescription-registry
        - id: libro
          type: database
          label: Libro de dispensas
          zone: restricted
          props: { backup: "diario", persistence: "durable" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: farmaceutico-mostrador
          from: { node: farmaceutico }
          to: { node: mostrador }
        - id: mostrador-gw
          from: { node: mostrador }
          to: { node: gw }
        - id: gw-despacho
          from: { node: gw }
          to: { node: despacho }
        - id: despacho-registro
          from: { node: despacho }
          to: { node: registro }
          dataClass: personal
        - id: despacho-libro
          from: { node: despacho }
          to: { node: libro }
          dataClass: regulated
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
  - label: un servicio de validación propio delante del registro
    contextInversion: conviene cuando la cadena tiene decenas de sucursales y las credenciales, los reintentos y el corte de circuito contra el registro nacional deberían vivir en un solo lugar en vez de repetidos en cada terminal. Cuesta una pieza más y un salto más de latencia. Sigue siendo síncrono de punta a punta, que es lo que el mostrador necesita.
    design:
      nodes:
        - id: farmaceutico
          type: actor
          label: Farmacéutico
          zone: public
        - id: mostrador
          type: web-client
          label: Terminal de mostrador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: despacho
          type: service
          label: Servicio de despacho
          zone: private
          role: dispensing-service
          props: { criticality: "high", replicas: "2" }
        - id: validador
          type: service
          label: Servicio de validación de recetas
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: external-provider
          label: Registro nacional de recetas
          zone: dmz
          role: prescription-registry
        - id: libro
          type: database
          label: Libro de dispensas
          zone: restricted
          props: { backup: "diario", persistence: "durable" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: farmaceutico-mostrador
          from: { node: farmaceutico }
          to: { node: mostrador }
        - id: mostrador-gw
          from: { node: mostrador }
          to: { node: gw }
        - id: gw-despacho
          from: { node: gw }
          to: { node: despacho }
        - id: despacho-validador
          from: { node: despacho }
          to: { node: validador }
          dataClass: personal
        - id: validador-registro
          from: { node: validador }
          to: { node: registro }
          dataClass: personal
        - id: despacho-libro
          from: { node: despacho }
          to: { node: libro }
          dataClass: regulated
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
status: PILOT
---

Una farmacia de barrio. Un paciente llega con una receta de un medicamento
controlado y espera, parado en el mostrador, mientras el farmacéutico la
carga en la terminal.

Antes de entregar, hay una pregunta que hay que contestar: **¿esta receta
ya fue dispensada en otra farmacia?** Una receta de sustancia controlada se
usa una sola vez, y el único lugar donde eso consta es el **registro
nacional de recetas**. Hoy el farmacéutico lo consulta a mano, en otra
pestaña, y lo copia a ojo.

El registro nacional no es el proveedor errático de los ejercicios
anteriores: responde en **300 ms el 98% de las veces** y tiene un acuerdo
de servicio firmado de **900 ms**. Está disponible, y responde rápido.

Falta una segunda cosa que la farmacia no tiene: la **constancia propia**.
La normativa obliga a conservar cinco años de dispensas de sustancias
controladas. Hoy eso es un cuaderno abajo del mostrador. Preguntarle al
registro nacional no alcanza: es el dato de otro, no el tuyo.

El presupuesto operativo de la farmacia es de **6 unidades operativas**.

**Armá el sistema** para que el farmacéutico sepa si puede entregar
**antes** de entregar, y para que cada dispensa deje una constancia que la
farmacia pueda mostrar dentro de cinco años.
