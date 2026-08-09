---
title: "La foto que se queda en el teléfono"
level: 1
role: core
domain: transporte
D1: 1
D2: 1
D3: 1
D4: 1
D5: 1
D6: 0
D7: 0
D8: 0
D9: 1
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: 'libre, pero el requisito acá lo escribió un abogado, no un ingeniero. Antes de generar nada, traducí su frase a una obligación que se pueda verificar mirando el diagrama.'
lambda: 0.5
constraints:
  - metric: tiempo que la foto del parte tiene que poder verse
    operator: ">="
    value: 3
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: hoy la foto se queda en el teléfono del chofer. En dos años la empresa cambió tres veces de flota de teléfonos y perdió todo lo que había en los anteriores.
    discoveryPath: seguí el recorrido de la foto en el diagrama y fijate dónde termina. La tablet del chofer es un origen, no un archivo. No hay ninguna conexión que saque la imagen de ahí.
  - fact: el parte de daños sí queda registrado, con fecha, patente y descripción escrita. Lo único que no queda es la imagen.
    discoveryPath: probá tu respuesta con el sistema tal como viene. Una de las tres garantías ya se cumple, y es justamente la del registro escrito. La que falla nombra otra cosa.
startingDesign:
  nodes:
    - id: chofer
      type: actor
      label: Chofer
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tablet
      type: mobile-client
      label: Tablet del chofer
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: partes
      type: service
      label: Servicio de partes de daño
      zone: private
      role: damage-service
      given: true
      position: { x: 445, y: 300 }
    - id: registro
      type: database
      label: Registro de partes
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: chofer-tablet
      from: { node: chofer }
      to: { node: tablet }
      dataClass: public
    - id: tablet-gw
      from: { node: tablet }
      to: { node: gw }
      dataClass: personal
    - id: gw-partes
      from: { node: gw }
      to: { node: partes }
      dataClass: personal
    - id: partes-registro
      from: { node: partes }
      to: { node: registro }
      dataClass: personal
guarantees:
  - id: g-foto-queda
    label: la foto del parte queda fuera del teléfono, en un archivo durable
    weight: 2
    predicate:
      op: path
      from:
        role: damage-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de partes hasta un archivo donde la imagen quede guardada. La foto se saca, se muestra y no sale nunca de la tablet.
    consequence: 'a los dieciocho meses el seguro pide la foto del golpe del paragolpes trasero y la respuesta de la empresa es que la tablet se cambió. El parte escrito sin la imagen no prueba el daño: prueba que alguien lo describió.'
  - id: g-parte-registrado
    label: el parte escrito sigue quedando registrado
    weight: 1
    predicate:
      op: path
      from:
        role: damage-service
      to:
        type: [database]
    whyMissing: se cortó el camino entre el servicio de partes y el registro donde quedan la fecha, la patente y la descripción.
    consequence: guardar la foto no reemplaza el parte. Una imagen sin fecha, sin patente y sin quién la sacó es una foto de un micro roto, no la constancia de un incidente.
  - id: g-chofer-carga
    label: el chofer sigue pudiendo cargar el parte desde la tablet
    weight: 1
    predicate:
      op: path
      from:
        type: [mobile-client, web-client]
      to:
        role: damage-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde la tablet del chofer hasta el servicio de partes que pase por la puerta de entrada.
    consequence: el parte se carga en la terminal, con el micro todavía en la plataforma. Si el chofer no puede cargarlo ahí, se carga al día siguiente de memoria, o no se carga.
rubric:
  - dimension: la imagen sobrevive al cambio de flota de teléfonos
    signal:
      kind: predicate
      guaranteeId: g-foto-queda
  - dimension: el parte escrito sigue existiendo
    signal:
      kind: predicate
      guaranteeId: g-parte-registrado
  - dimension: el chofer sigue pudiendo reportar en la terminal
    signal:
      kind: predicate
      guaranteeId: g-chofer-carga
referenceSolutions:
  - label: la foto se guarda y sale sólo por el servicio
    contextInversion: 'guardar la imagen y no publicarla en ningún lado gana cuando la foto es prueba: la ve el seguro, la ve un perito, y a veces la ve un juez. Que cada acceso pase por el servicio permite responder quién la miró y cuándo. Se paga con que el taller, que necesita ver el daño antes de que llegue el micro, tiene que pedirla por el mismo camino que todos.'
    design:
      nodes:
        - id: chofer
          type: actor
          label: Chofer
          zone: public
        - id: tablet
          type: mobile-client
          label: Tablet del chofer
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: partes
          type: service
          label: Servicio de partes de daño
          zone: private
          role: damage-service
        - id: registro
          type: database
          label: Registro de partes
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de fotos de daño
          zone: private
      edges:
        - id: chofer-tablet
          from: { node: chofer }
          to: { node: tablet }
          dataClass: public
        - id: tablet-gw
          from: { node: tablet }
          to: { node: gw }
          dataClass: personal
        - id: gw-partes
          from: { node: gw }
          to: { node: partes }
          dataClass: personal
        - id: partes-registro
          from: { node: partes }
          to: { node: registro }
          dataClass: personal
        - id: partes-archivo
          from: { node: partes }
          to: { node: archivo }
          dataClass: personal
  - label: la foto se guarda y se distribuye al taller
    contextInversion: 'poner una red de distribución delante del archivo gana cuando quien más mira la foto es el taller de la terminal de destino, que la abre ocho o diez veces mientras planifica la reparación, desde una conexión mala y con el micro en camino. Cada una de esas lecturas deja de golpear al servicio. Se paga con que la imagen queda servida por una pieza en la zona expuesta, y ahí controlar quién la ve deja de ser una decisión del servicio.'
    design:
      nodes:
        - id: chofer
          type: actor
          label: Chofer
          zone: public
        - id: tablet
          type: mobile-client
          label: Tablet del chofer
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: partes
          type: service
          label: Servicio de partes de daño
          zone: private
          role: damage-service
        - id: registro
          type: database
          label: Registro de partes
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de fotos de daño
          zone: private
        - id: distribucion
          type: cdn
          label: Distribución de imágenes al taller
          zone: dmz
      edges:
        - id: chofer-tablet
          from: { node: chofer }
          to: { node: tablet }
          dataClass: public
        - id: tablet-gw
          from: { node: tablet }
          to: { node: gw }
          dataClass: personal
        - id: gw-partes
          from: { node: gw }
          to: { node: partes }
          dataClass: personal
        - id: partes-registro
          from: { node: partes }
          to: { node: registro }
          dataClass: personal
        - id: partes-archivo
          from: { node: partes }
          to: { node: archivo }
          dataClass: personal
        - id: archivo-distribucion
          from: { node: archivo }
          to: { node: distribucion }
          dataClass: personal
status: PILOT
---

Una empresa de micros de larga distancia, **62 unidades**, seis terminales.
Cuando un micro llega, el chofer carga el parte de daños desde la tablet: fecha,
patente, qué se rompió, y una foto.

El contrato con la aseguradora tiene una cláusula que el abogado de la empresa
leyó en voz alta en la reunión:

> *"El registro fotográfico del daño debe estar disponible durante tres años
> desde el hecho."*

Eso es un requisito. Dice qué tiene que pasar, dice por cuánto tiempo, y se
puede verificar si se cumple o no.

Ahora seguí la foto en el diagrama. El chofer la saca con la tablet. La tablet
la muestra en el formulario. El formulario se envía y el parte queda en el
registro: fecha, patente, descripción. **La foto no viaja a ningún lado.** Se
queda en el teléfono, que en dos años la empresa cambió tres veces.

El parte escrito existe. La imagen no. Y la cláusula no habla del parte escrito.

**Poné el lugar donde la foto queda**, y después decidí quién puede llegar a
ella. Las dos referencias resuelven la cláusula; se diferencian en quién mira la
foto todos los días y en cuánto control querés conservar sobre eso.
