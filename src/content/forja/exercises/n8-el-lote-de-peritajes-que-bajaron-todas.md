---
title: "El lote de peritajes que bajaron todas"
level: 8
role: core
domain: seguros
D1: 4
D2: 2
D3: 3
D4: 2
D5: 3
D6: 3
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [7]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que explicar por qué el problema no fue quién podía bajar el archivo sino qué había adentro del archivo, y qué componente de tu diseño decide de quién es cada informe."
lambda: 0.5
constraints:
  - metric: aseguradoras sobre la misma plataforma
    operator: ">="
    value: 58
    unit: aseguradoras
  - metric: informes de otra aseguradora dentro de un archivo entregado
    operator: "="
    value: 0
    unit: informes
hiddenFacts:
  - fact: "el armador no produce un informe por siniestro: produce un lote diario, un único documento con todos los siniestros peritados ese día, de las 58 aseguradoras juntas, ordenado por número de siniestro."
    discoveryPath: "mirá de dónde saca los datos el armador. Barre la base entera del día, sin filtrar por aseguradora, porque nadie le dijo de quién es cada fila: la información del dueño estaba en la base y no en el pedido."
  - fact: "el visor del panel abre el documento directamente en la página del siniestro que la operadora consultó. Por eso nadie lo notó durante catorce meses."
    discoveryPath: "una entrega correcta y un documento correcto no son lo mismo. El permiso de descarga puede estar perfecto y el archivo seguir teniendo adentro el dato de otro cliente."
  - fact: "el servicio de siniestros ya sabe de qué aseguradora es cada expediente: lo usa para calcular el monto ofrecido según la póliza. Ese dato nunca viajó hasta el armador."
    discoveryPath: "seguí el pedido de peritaje desde que se crea hasta que se convierte en archivo. En algún tramo se pierde la única información que hacía falta para no mezclar."
startingDesign:
  nodes:
    - id: operadora
      type: actor
      label: Operadora de siniestros
      zone: public
      given: true
      position: { x: 85, y: 90 }
    - id: panel
      type: web-client
      label: Panel de la aseguradora
      zone: public
      given: true
      position: { x: 445, y: 90 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 200 }
    - id: siniestros
      type: service
      label: Servicio de siniestros
      zone: private
      role: claims-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 320 }
    - id: descargas
      type: service
      label: Servicio de descargas
      zone: private
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 430 }
    - id: cola
      type: queue
      label: Cola de peritajes pendientes
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 420 }
    - id: perito
      type: worker
      label: Armador de informes
      zone: private
      role: report-worker
      given: true
      position: { x: 445, y: 540 }
    - id: deposito
      type: object-storage
      label: Depósito de informes
      zone: private
      given: true
      props: { access: "signed", durability: "99.999999999" }
      position: { x: 805, y: 540 }
    - id: base
      type: database
      label: Base de siniestros
      zone: restricted
      role: claims-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 650 }
  edges:
    - id: operadora-panel
      from: { node: operadora }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-siniestros
      from: { node: gw }
      to: { node: siniestros }
      dataClass: personal
    - id: gw-descargas
      from: { node: gw }
      to: { node: descargas }
      dataClass: personal
    - id: siniestros-base
      from: { node: siniestros }
      to: { node: base }
      dataClass: personal
    - id: siniestros-cola
      from: { node: siniestros }
      to: { node: cola }
      dataClass: personal
    - id: cola-perito
      from: { node: cola }
      to: { node: perito }
      dataClass: personal
    - id: perito-base
      from: { node: perito }
      to: { node: base }
      dataClass: personal
    - id: perito-deposito
      from: { node: perito }
      to: { node: deposito }
      dataClass: personal
    - id: descargas-deposito
      from: { node: descargas }
      to: { node: deposito }
      dataClass: personal
guarantees:
  - id: g-no-direct-sweep
    label: el armador de informes no abre ninguna consulta propia contra la base de siniestros
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: report-worker
      to:
        role: claims-store
    whyMissing: sigue existiendo una conexión directa entre el armador de informes y la base de siniestros.
    consequence: "el armador barre la base del día completa porque es lo único que puede hacer: nadie le dijo de qué aseguradora es cada expediente. De ahí sale un documento con los siniestros de todas, y ese documento después se entrega."
  - id: g-report-from-service
    label: el armador recibe cada siniestro del servicio que sabe de qué aseguradora es
    weight: 3
    predicate:
      op: path
      from:
        role: report-worker
      to:
        role: claims-service
    whyMissing: no hay ningún camino desde el armador de informes hasta el servicio de siniestros.
    consequence: cortar la consulta directa no alcanza si el armador se queda sin fuente. El dato del dueño existe y vive en el servicio de siniestros; el informe se arma bien cuando ese dato llega hasta el que produce el archivo, no cuando se imprime en la carátula.
  - id: g-download-through-service
    label: la descarga del informe pasa por el servicio que sabe de quién es el siniestro
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [object-storage]
      via:
        role: claims-service
    whyMissing: el único camino desde la puerta de entrada hasta el depósito de informes no pasa por el servicio de siniestros. Nadie mira de quién es el expediente antes de entregar el archivo.
    consequence: si nadie decide, cualquiera puede. Un archivo por siniestro sin nadie que mire quién pregunta sólo cambia la forma de la fuga, de un lote entero a un documento por vez.
  - id: g-report-still-produced
    label: el informe pericial se sigue produciendo y guardando
    weight: 1
    predicate:
      op: path
      from:
        role: report-worker
      to:
        type: [object-storage]
    whyMissing: no queda ningún camino desde el armador de informes hasta un depósito de archivos.
    consequence: dejar de producir el informe también hace desaparecer la mezcla, y deja al perito sin documento que firmar. El objetivo es que el archivo exista y contenga un solo siniestro.
  - id: g-claims-still-stored
    label: el expediente del siniestro se sigue guardando
    weight: 1
    predicate:
      op: path
      from:
        role: claims-service
      to:
        role: claims-store
    whyMissing: no queda ningún camino desde el servicio de siniestros hasta la base de siniestros.
    consequence: borrar el almacén también corta la consulta que mezclaba, y deja a la aseguradora sin expediente que peritar. Acotar el acceso es acotarlo, no dejar de guardar.
rubric:
  - dimension: nadie barre el almacén compartido sin saber de qué aseguradora pregunta
    signal:
      kind: predicate
      guaranteeId: g-no-direct-sweep
  - dimension: el dato del dueño llega hasta el que produce el archivo
    signal:
      kind: predicate
      guaranteeId: g-report-from-service
  - dimension: alguien decide, en cada descarga, si esta aseguradora puede ver este informe
    signal:
      kind: predicate
      guaranteeId: g-download-through-service
  - dimension: el peritaje se sigue entregando
    signal:
      kind: predicate
      guaranteeId: g-report-still-produced
  - dimension: el expediente sigue existiendo
    signal:
      kind: predicate
      guaranteeId: g-claims-still-stored
referenceSolutions:
  - label: el servicio de siniestros arma el pedido y entrega el archivo
    contextInversion: "que el servicio de siniestros haga las dos cosas (darle al armador el expediente que le toca y entregar el archivo terminado) conviene cuando las descargas son pocas y previsibles, un informe por siniestro mirado una o dos veces, porque deja una sola implementación de la regla \"este expediente es de esta aseguradora\" y ninguna pieza extra para operar. El costo es que una auditoría que baja seis meses de peritajes se cobra sobre el mismo servicio que atiende el mostrador."
    design:
      nodes:
        - id: operadora
          type: actor
          label: Operadora de siniestros
          zone: public
        - id: panel
          type: web-client
          label: Panel de la aseguradora
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de peritajes pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: perito
          type: worker
          label: Armador de informes
          zone: private
          role: report-worker
        - id: deposito
          type: object-storage
          label: Depósito de informes
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de siniestros
          zone: restricted
          role: claims-store
          props: { backup: "diario" }
      edges:
        - id: operadora-panel
          from: { node: operadora }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: personal
        - id: siniestros-base
          from: { node: siniestros }
          to: { node: base }
          dataClass: personal
        - id: siniestros-cola
          from: { node: siniestros }
          to: { node: cola }
          dataClass: personal
        - id: cola-perito
          from: { node: cola }
          to: { node: perito }
          dataClass: personal
        - id: perito-siniestros
          from: { node: perito }
          to: { node: siniestros }
          dataClass: personal
        - id: perito-deposito
          from: { node: perito }
          to: { node: deposito }
          dataClass: personal
        - id: siniestros-deposito
          from: { node: siniestros }
          to: { node: deposito }
          dataClass: personal
  - label: una capa de entrega que le pregunta al servicio de siniestros
    contextInversion: "mantener una capa de entrega aparte conviene cuando bajar documentos es un caso de uso propio y pesado, como auditorías, cierres de siniestro masivos o peritos externos que descargan carpetas enteras, porque esa carga se escala y se limita sin tocar el servicio que atiende el mostrador de siniestros. Se paga con una pieza más para operar y con un salto más entre el clic y el archivo: si la capa de entrega deja de preguntar, nadie se entera hasta que alguien hace scroll."
    design:
      nodes:
        - id: operadora
          type: actor
          label: Operadora de siniestros
          zone: public
        - id: panel
          type: web-client
          label: Panel de la aseguradora
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2" }
        - id: descargas
          type: service
          label: Servicio de descargas
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de peritajes pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: perito
          type: worker
          label: Armador de informes
          zone: private
          role: report-worker
        - id: deposito
          type: object-storage
          label: Depósito de informes
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de siniestros
          zone: restricted
          role: claims-store
          props: { backup: "diario" }
      edges:
        - id: operadora-panel
          from: { node: operadora }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: personal
        - id: gw-descargas
          from: { node: gw }
          to: { node: descargas }
          dataClass: personal
        - id: descargas-siniestros
          from: { node: descargas }
          to: { node: siniestros }
          dataClass: personal
        - id: siniestros-base
          from: { node: siniestros }
          to: { node: base }
          dataClass: personal
        - id: siniestros-cola
          from: { node: siniestros }
          to: { node: cola }
          dataClass: personal
        - id: cola-perito
          from: { node: cola }
          to: { node: perito }
          dataClass: personal
        - id: perito-siniestros
          from: { node: perito }
          to: { node: siniestros }
          dataClass: personal
        - id: perito-deposito
          from: { node: perito }
          to: { node: deposito }
          dataClass: personal
        - id: siniestros-deposito
          from: { node: siniestros }
          to: { node: deposito }
          dataClass: personal
status: PILOT
---

Una plataforma de gestión de siniestros que usan **58 aseguradoras**. Cada
siniestro con lesionados genera un informe pericial en PDF: fotos del
vehículo, diagnóstico médico, y el monto ofrecido según la póliza.

El armador de informes corre todas las noches. Barre los siniestros peritados
del día, arma **un documento con todos**, ordenado por número de siniestro, y
lo deja en el depósito. Cada aseguradora baja ese archivo desde su panel.

El visor del panel lo abre directo en la página del siniestro que la
operadora estaba mirando. Por eso funcionó durante catorce meses sin que
nadie dijera nada.

El 9 de abril, una operadora hizo scroll.

**74 informes de otras nueve aseguradoras**: nombre y diagnóstico del
lesionado, fotos, y el monto que cada una había ofrecido. Ese último dato es
el precio con el que compiten entre ellas.

El permiso de descarga estaba bien. Cada aseguradora bajaba un archivo que
tenía derecho a bajar. El problema estaba adentro del archivo.

El armador barre la base entera porque es lo único que sabe hacer: nadie le
dice de qué aseguradora es cada expediente. El servicio de siniestros sí lo
sabe, porque lo necesita para calcular el monto según la póliza, pero ese dato
nunca llegó hasta el que produce el documento.

El equipo tiene **7 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que el que produce el archivo sepa de quién es
cada siniestro antes de escribirlo, y para que alguien mire quién pregunta
antes de entregarlo.
