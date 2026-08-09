---
title: "El remito que se bajaba con la dirección"
level: 8
role: core
domain: logistica
D1: 3
D2: 2
D3: 3
D4: 2
D5: 3
D6: 3
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [7]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que explicar por qué una dirección secreta no es un control de acceso, y qué componente de tu diseño decide si este transportista puede ver este archivo."
lambda: 0.5
constraints:
  - metric: transportistas sobre la misma plataforma
    operator: ">="
    value: 190
    unit: transportistas
  - metric: remitos de otro transportista accesibles con una dirección
    operator: "="
    value: 0
    unit: remitos
hiddenFacts:
  - fact: "la dirección de cada remito se arma con el número de remito, que es correlativo y global. Con un remito propio en la mano se puede adivinar el anterior y el siguiente, que son de otro transportista."
    discoveryPath: "es la razón por la que la garantía pide acceso firmado y no una dirección más larga. Un identificador correlativo hace que adivinar sea contar; uno aleatorio sólo hace que sea más caro, no imposible."
  - fact: "el depósito de archivos está publicado detrás de una red de distribución de contenido, que fue la solución del trimestre pasado para bajar el costo de las descargas. Esa red entrega cualquier archivo a cualquiera que sepa la dirección, porque para eso sirve."
    discoveryPath: "una red de distribución existe para copiar y servir contenido lo más cerca posible del que lo pide, sin preguntar quién es. Es la respuesta correcta para una portada y la incorrecta para un documento de un cliente."
  - fact: "los remitos los genera un exportador que consume los pedidos del servicio de envíos. Ese exportador ya sabe de qué transportista es cada remito, porque lo necesita para armar el encabezado."
    discoveryPath: "mirá quién produce el archivo y con qué información. El problema nunca fue que no se supiera el dueño: fue que ese dato se usó para imprimirlo en el papel y no para decidir quién puede bajarlo."
startingDesign:
  nodes:
    - id: transportista
      type: actor
      label: Transportista
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: panel
      type: web-client
      label: Panel de flota
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: envios
      type: service
      label: Servicio de envíos
      zone: private
      role: shipments-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: cola
      type: queue
      label: Cola de remitos por generar
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 300 }
    - id: generador
      type: worker
      label: Generador de remitos
      zone: private
      role: export-worker
      given: true
      position: { x: 445, y: 410 }
    - id: deposito
      type: object-storage
      label: Depósito de remitos
      zone: private
      given: true
      props: { access: "public", durability: "99.999999999" }
      position: { x: 805, y: 520 }
    - id: red
      type: cdn
      label: Red de distribución
      zone: dmz
      given: true
      position: { x: 805, y: 190 }
    - id: base
      type: database
      label: Base de envíos
      zone: restricted
      role: shipments-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: transportista-panel
      from: { node: transportista }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-envios
      from: { node: gw }
      to: { node: envios }
      dataClass: personal
    - id: envios-base
      from: { node: envios }
      to: { node: base }
      dataClass: personal
    - id: envios-cola
      from: { node: envios }
      to: { node: cola }
      dataClass: personal
    - id: cola-generador
      from: { node: cola }
      to: { node: generador }
      dataClass: personal
    - id: generador-deposito
      from: { node: generador }
      to: { node: deposito }
      dataClass: personal
    - id: deposito-red
      from: { node: deposito }
      to: { node: red }
      dataClass: personal
guarantees:
  - id: g-signed-access
    label: los remitos viven en un depósito que sólo entrega con permiso firmado
    weight: 2
    predicate:
      op: exists
      node:
        type: [object-storage]
        propEquals: { access: "signed" }
    whyMissing: el único depósito de archivos del diseño entrega cualquier archivo a quien conozca la dirección, sin pedir nada más.
    consequence: "el número de remito es correlativo y global. Con un remito propio en la mano se adivina el anterior y el siguiente, que son de otro transportista: el precio acordado, la dirección de entrega y el nombre del destinatario de un competidor, a un clic de distancia."
  - id: g-no-open-publication
    label: ningún depósito de remitos queda publicado detrás de una red de distribución
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [object-storage]
      to:
        type: [cdn]
    whyMissing: sigue habiendo un depósito de archivos publicado detrás de una red de distribución de contenido.
    consequence: una red de distribución copia el archivo cerca de quien lo pide y lo entrega sin preguntar quién es. Es exactamente lo que se quiere para una portada y exactamente lo que no se quiere para el documento de un cliente. Además guarda la copia, así que revocar el permiso no borra lo que ya se distribuyó.
  - id: g-download-through-service
    label: la descarga llega al archivo por el servicio que sabe de quién es el remito, no por el camino que lo genera
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [object-storage]
      via:
        role: shipments-service
      forbid:
        role: export-worker
    whyMissing: el único camino desde la puerta de entrada hasta el depósito de archivos es el que usa el generador para escribirlos. No existe un camino de lectura que pase por el servicio de envíos.
    consequence: si nadie decide, cualquiera puede. El permiso firmado necesita un componente que lo emita después de mirar quién pregunta y de qué transportista es el remito; sin ese componente en el camino, el depósito vuelve a ser una carpeta con direcciones adivinables.
  - id: g-export-still-runs
    label: el remito se sigue generando
    weight: 1
    predicate:
      op: path
      from:
        role: export-worker
      to:
        type: [object-storage]
    whyMissing: no queda ningún camino desde el generador de remitos hasta un depósito de archivos.
    consequence: cerrar el acceso también arregla la fuga si además se deja de producir el documento, y entonces el transportista no tiene remito para entregar. El objetivo es que el archivo exista y llegue sólo a su dueño.
rubric:
  - dimension: el archivo se entrega con un permiso, no con una dirección
    signal:
      kind: predicate
      guaranteeId: g-signed-access
  - dimension: el documento de un cliente deja de estar publicado abiertamente
    signal:
      kind: predicate
      guaranteeId: g-no-open-publication
  - dimension: alguien decide, en cada descarga, si este transportista puede ver este archivo
    signal:
      kind: predicate
      guaranteeId: g-download-through-service
  - dimension: el remito se sigue produciendo y entregando
    signal:
      kind: predicate
      guaranteeId: g-export-still-runs
referenceSolutions:
  - label: el servicio de envíos entrega el remito
    contextInversion: "que el mismo servicio de envíos autorice y entregue conviene cuando las descargas son pocas y previsibles, un remito por viaje mirado una vez, porque no agrega ninguna pieza para operar y deja una sola implementación de la regla \"este archivo es de este transportista\". El costo es que una descarga masiva, o un cliente que baja seis meses de remitos de golpe, se cobra sobre el mismo servicio que registra los viajes."
    design:
      nodes:
        - id: transportista
          type: actor
          label: Transportista
          zone: public
        - id: panel
          type: web-client
          label: Panel de flota
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: envios
          type: service
          label: Servicio de envíos
          zone: private
          role: shipments-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de remitos por generar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: generador
          type: worker
          label: Generador de remitos
          zone: private
          role: export-worker
        - id: deposito
          type: object-storage
          label: Depósito de remitos
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de envíos
          zone: restricted
          role: shipments-store
          props: { backup: "diario" }
      edges:
        - id: transportista-panel
          from: { node: transportista }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-envios
          from: { node: gw }
          to: { node: envios }
          dataClass: personal
        - id: envios-base
          from: { node: envios }
          to: { node: base }
          dataClass: personal
        - id: envios-cola
          from: { node: envios }
          to: { node: cola }
          dataClass: personal
        - id: cola-generador
          from: { node: cola }
          to: { node: generador }
          dataClass: personal
        - id: generador-deposito
          from: { node: generador }
          to: { node: deposito }
          dataClass: personal
        - id: envios-deposito
          from: { node: envios }
          to: { node: deposito }
          dataClass: personal
  - label: una capa de entrega de archivos que consulta al servicio de envíos
    contextInversion: "una capa de entrega aparte conviene cuando bajar documentos es un caso de uso propio y pesado, como auditorías, cierres de mes o clientes que descargan seis meses de golpe, porque esa carga se escala y se limita sin tocar el servicio que registra viajes, que es el que no puede caerse. Se paga con una pieza más para operar y con un salto más entre el clic y el archivo."
    design:
      nodes:
        - id: transportista
          type: actor
          label: Transportista
          zone: public
        - id: panel
          type: web-client
          label: Panel de flota
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: entrega
          type: service
          label: Servicio de entrega de documentos
          zone: private
        - id: envios
          type: service
          label: Servicio de envíos
          zone: private
          role: shipments-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de remitos por generar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: generador
          type: worker
          label: Generador de remitos
          zone: private
          role: export-worker
        - id: deposito
          type: object-storage
          label: Depósito de remitos
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de envíos
          zone: restricted
          role: shipments-store
          props: { backup: "diario" }
      edges:
        - id: transportista-panel
          from: { node: transportista }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-entrega
          from: { node: gw }
          to: { node: entrega }
          dataClass: personal
        - id: gw-envios
          from: { node: gw }
          to: { node: envios }
          dataClass: personal
        - id: entrega-envios
          from: { node: entrega }
          to: { node: envios }
          dataClass: personal
        - id: envios-base
          from: { node: envios }
          to: { node: base }
          dataClass: personal
        - id: envios-cola
          from: { node: envios }
          to: { node: cola }
          dataClass: personal
        - id: cola-generador
          from: { node: cola }
          to: { node: generador }
          dataClass: personal
        - id: generador-deposito
          from: { node: generador }
          to: { node: deposito }
          dataClass: personal
        - id: envios-deposito
          from: { node: envios }
          to: { node: deposito }
          dataClass: personal
status: PILOT
---

Una plataforma de seguimiento de flota que usan **190 transportistas**. Cada
viaje genera un remito en PDF con el destinatario, la dirección de entrega y
el precio acordado. El transportista lo baja desde su panel.

El trimestre pasado, las descargas empezaron a costar caro y el equipo hizo
lo que había aprendido: puso el depósito de archivos detrás de una red de
distribución de contenido. El costo bajó un 70 % y las descargas se
volvieron instantáneas. Fue una buena decisión para el problema que tenían.

En abril, un transportista escribió al soporte. Había cambiado un número en
la dirección de su remito, de `R-084417` a `R-084416`, y le abrió el remito
de otra empresa. Nombre del destinatario, dirección, precio.

El número de remito es correlativo y global. Adivinar no es adivinar: es
contar.

La red de distribución no tiene la culpa. Entrega cualquier archivo a
cualquiera que sepa la dirección, porque para eso existe. El error fue poner
ahí un documento cuyo dueño importa.

El generador de remitos ya sabe de qué transportista es cada uno: lo usa para
imprimir el encabezado. Ese dato nunca se usó para decidir quién puede bajar
el archivo.

El equipo tiene **7 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que el remito sólo se entregue después de que
algún componente mire quién está preguntando, y para que dejar de estar
publicado no signifique dejar de generarse.
