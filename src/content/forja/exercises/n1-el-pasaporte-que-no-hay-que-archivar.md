---
title: "El pasaporte que no hay que archivar"
level: 1
role: trap
domain: hoteleria
D1: 2
D2: 2
D3: 1
D4: 1
D5: 1
D6: 0
D7: 0
D8: 0
D9: 2
prerequisiteLevels: []
budget:
  opsUnits: 3
aiBudget: 'libre para redactar. Cerrada para decidir, y esta vez con un motivo concreto: pedile a un modelo dónde guardar la imagen de un documento y te va a dar tres opciones de almacenamiento, ninguna de las cuales es la respuesta. La pregunta que hay que hacerse primero es si hay que guardarla.'
lambda: 0.5
constraints:
  - metric: imágenes de documento de identidad conservadas por el hotel
    operator: "="
    value: 0
    unit: imágenes
  - metric: presupuesto operativo
    operator: "<="
    value: 3
    unit: unidades operativas
hiddenFacts:
  - fact: el registro oficial de hospedaje sí conserva el alta, con nombre, documento y fechas, durante el plazo que fija la ley. El hotel no es el custodio de ese dato. Es el que lo declara.
    discoveryPath: 'seguí el alta del huésped en el diagrama hasta el final. Ahí hay un tercero que ya recibe el dato: preguntate si la obligación de conservar es tuya o de él, porque el enunciado no lo dice y la respuesta cambia todo el ejercicio.'
  - fact: el archivo de imágenes lo agregó el equipo hace ocho meses, por las dudas. Hoy tiene 41.000 fotos de pasaportes y cédulas, y nadie abrió ninguna nunca.
    discoveryPath: buscá en el enunciado cuántas veces se consultó ese archivo desde que existe. Un depósito de documentos de identidad que nadie leyó jamás no es un respaldo. Es una obligación de custodia que el hotel se puso solo.
startingDesign:
  nodes:
    - id: huesped
      type: actor
      label: Huésped
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: recepcion
      type: web-client
      label: Mostrador de recepción
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: checkin
      type: service
      label: Servicio de check-in
      zone: private
      role: checkin-service
      given: true
      position: { x: 445, y: 410 }
    - id: archivo
      type: object-storage
      label: Archivo de documentos escaneados
      zone: private
      given: true
      position: { x: 805, y: 410 }
    - id: registro
      type: external-provider
      label: Registro oficial de hospedaje
      zone: dmz
      role: lodging-registry
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: huesped-recepcion
      from: { node: huesped }
      to: { node: recepcion }
      dataClass: public
    - id: recepcion-gw
      from: { node: recepcion }
      to: { node: gw }
      dataClass: personal
    - id: gw-checkin
      from: { node: gw }
      to: { node: checkin }
      dataClass: personal
    - id: checkin-archivo
      from: { node: checkin }
      to: { node: archivo }
      dataClass: personal
    - id: checkin-registro
      from: { node: checkin }
      to: { node: registro }
      dataClass: personal
guarantees:
  - id: g-documento-no-se-archiva
    label: la imagen del documento no queda guardada en ninguna pieza del hotel
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [object-storage, database, cache]
    whyMissing: el sistema del hotel está escribiendo la imagen del documento en un almacenamiento propio. La obligación firmada dice que la imagen se usa para verificar y no se conserva.
    consequence: '41.000 imágenes de pasaportes y cédulas que nadie leyó nunca no son un respaldo: son una obligación de custodia que el hotel se puso solo. El día que ese depósito se filtre, la pregunta del organismo no va a ser cómo se filtró. Va a ser por qué existía.'
  - id: g-alta-llega-al-registro
    label: el alta del huésped sigue llegando al registro oficial
    weight: 1
    predicate:
      op: path
      from:
        role: checkin-service
      to:
        role: lodging-registry
    whyMissing: no hay ningún camino desde el servicio de check-in hasta el registro oficial de hospedaje.
    consequence: 'no guardar la imagen no exime de declarar el alta. Si en el camino cortaste la salida hacia el organismo, el hotel dejó de cumplir la obligación que sí es suya para cumplir la que no era: el custodio del dato es el registro, y sólo puede serlo si el dato le llega.'
  - id: g-recepcion-registra
    label: la recepción sigue llegando al servicio de check-in por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: checkin-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde el mostrador de recepción hasta el servicio de check-in que pase por la puerta de entrada.
    consequence: el check-in se hace con el huésped parado en el mostrador a las once de la noche. Si la recepción no llega al sistema, se anota en un papel y se carga al día siguiente, que es exactamente el estado del que el hotel venía saliendo.
rubric:
  - dimension: el hotel deja de custodiar imágenes de documentos
    signal:
      kind: predicate
      guaranteeId: g-documento-no-se-archiva
  - dimension: la declaración al organismo sigue saliendo
    signal:
      kind: predicate
      guaranteeId: g-alta-llega-al-registro
  - dimension: la recepción sigue haciendo el check-in
    signal:
      kind: predicate
      guaranteeId: g-recepcion-registra
referenceSolutions:
  - label: el documento se mira en el mostrador y no se guarda
    contextInversion: 'no guardar nada gana cuando la verificación la hace una persona con el documento en la mano: el recepcionista mira el pasaporte, carga el número, y la imagen no llega a existir del lado del sistema. Es la forma más barata de operar y la única en la que un incidente de seguridad no puede exponer documentos que el hotel no tiene. Se paga con que la calidad de la verificación depende de quién esté en el mostrador a las tres de la mañana, y no queda constancia de qué se miró.'
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: recepcion
          type: web-client
          label: Mostrador de recepción
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: checkin
          type: service
          label: Servicio de check-in
          zone: private
          role: checkin-service
        - id: registro
          type: external-provider
          label: Registro oficial de hospedaje
          zone: dmz
          role: lodging-registry
      edges:
        - id: huesped-recepcion
          from: { node: huesped }
          to: { node: recepcion }
          dataClass: public
        - id: recepcion-gw
          from: { node: recepcion }
          to: { node: gw }
          dataClass: personal
        - id: gw-checkin
          from: { node: gw }
          to: { node: checkin }
          dataClass: personal
        - id: checkin-registro
          from: { node: checkin }
          to: { node: registro }
          dataClass: personal
  - label: la verificación la hace el proveedor de identidad y el hotel sólo da el alta
    contextInversion: 'delegar la verificación gana cuando el hotel recibe huéspedes de treinta países y nadie en el mostrador sabe cómo se ve un documento válido de todos ellos: el proveedor lee el chip, compara y devuelve sí o no, y la imagen nunca entra al sistema del hotel. La calidad de la verificación deja de depender del turno de la noche. Se paga con una unidad operativa más, con una dependencia externa en el momento exacto en que el huésped está esperando, y con un contrato que hay que leer, porque ahora hay un tercero que sí ve el documento.'
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: recepcion
          type: web-client
          label: Mostrador de recepción
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: identidad
          type: identity-provider
          label: Verificación de documento
          zone: dmz
        - id: checkin
          type: service
          label: Servicio de check-in
          zone: private
          role: checkin-service
        - id: registro
          type: external-provider
          label: Registro oficial de hospedaje
          zone: dmz
          role: lodging-registry
      edges:
        - id: huesped-recepcion
          from: { node: huesped }
          to: { node: recepcion }
          dataClass: public
        - id: recepcion-gw
          from: { node: recepcion }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: personal
        - id: gw-checkin
          from: { node: gw }
          to: { node: checkin }
          dataClass: personal
        - id: checkin-registro
          from: { node: checkin }
          to: { node: registro }
          dataClass: personal
status: PILOT
---

Un hotel de **140 habitaciones**, **26.000 check-ins por año**. El huésped
llega al mostrador, entrega el pasaporte o la cédula, el recepcionista lo
escanea y el sistema declara el alta al registro oficial de hospedaje, como
exige la ley.

Hasta acá el ejercicio se parece a otro que ya jugaste. En aquel, una foto se
quedaba en un teléfono y había que ponerle un lugar donde quedar. **El reflejo
que te dejó ese ejercicio es agregar el archivo.** Guardalo un segundo.

Leé lo que firmó la responsable de protección de datos del hotel:

> *"La imagen del documento de identidad se usa para verificar al huésped en el
> mostrador y no se conserva. El dato de identidad que el hotel declara queda
> bajo custodia del registro oficial."*

Dos frases, dos obligaciones distintas, y una de las dos **no es del hotel**.

Ahora los números. El archivo de documentos escaneados lo agregó el equipo hace
ocho meses, por las dudas. Tiene **41.000 imágenes** de pasaportes y cédulas.
**Nadie abrió ninguna, nunca.** No hay un solo caso registrado en el que el
hotel haya necesitado volver a mirar una.

Un depósito de documentos de identidad que nadie leyó jamás no es un respaldo.
Es una obligación de custodia que el hotel se puso solo, y que el día del
incidente cambia la pregunta. Ya no es cómo entraron. Es algo mucho peor:
**por qué había 41.000 pasaportes ahí.**

**Sacá lo que no hay que conservar, y no cortes la declaración que sí hay que
hacer.** Las dos mitades importan: la segunda es la que separa "cumplir" de
"borrar todo".

> El reflejo de agregar el lugar durable es correcto casi siempre, y por eso es
> peligroso. Antes de aplicarlo, la pregunta previa es de quién es la
> obligación de conservar. Acá no era tuya.
