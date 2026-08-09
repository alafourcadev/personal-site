---
title: "La lectura de medidores que dejó de llegar"
level: 5
role: core
domain: energia
D1: 2
D2: 2
D3: 3
D4: 1
D5: 2
D6: 2
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 8
aiBudget: "libre, pero tu respuesta tiene que explicar por qué guardar la lectura cruda antes de transformarla es lo que permite arreglar un error de cálculo sin pedirle nada a los medidores."
lambda: 0.5
constraints:
  - metric: medidores que reportan cada hora
    operator: ">="
    value: 240000
    unit: medidores
  - metric: tiempo aceptable entre que una región deja de reportar y el equipo se entera
    operator: "<="
    value: 60
    unit: minutos
  - metric: lecturas por hora que el servicio de facturación sostiene
    operator: "<="
    value: 9000
    unit: lecturas/hora
hiddenFacts:
  - fact: la ingesta no falló con un error. Siguió aceptando lecturas de todas las regiones menos una, y el promedio nacional se movió menos de un 3 por ciento.
    discoveryPath: "una caída total se nota; una caída parcial se esconde adentro del promedio. Conectá cada proceso al monitoreo por separado y vas a tener el ritmo de cada uno, no un número agregado que tapa el agujero."
  - fact: cuando encontraron el error de cálculo, la lectura original ya no existía en ninguna parte. La ingesta transformaba y guardaba sólo el resultado.
    discoveryPath: "seguí el camino de una lectura desde el medidor hasta la base y contá en qué punto deja de existir el dato original. Si no queda en ningún lado, un cálculo mal hecho es irreversible."
startingDesign:
  nodes:
    - id: medidores
      type: external-party
      label: Red de medidores
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: ingesta
      type: service
      label: Servicio de ingesta
      zone: private
      role: ingest
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: billing
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: basemedidas
      type: database
      label: Base de consumos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: medidores-gw
      from: { node: medidores }
      to: { node: gw }
      dataClass: personal
    - id: gw-ingesta
      from: { node: gw }
      to: { node: ingesta }
      dataClass: personal
    - id: ingesta-facturacion
      from: { node: ingesta }
      to: { node: facturacion }
      dataClass: personal
    - id: facturacion-basemedidas
      from: { node: facturacion }
      to: { node: basemedidas }
      dataClass: personal
guarantees:
  - id: g-raw-archived
    label: la lectura cruda queda guardada antes de transformarse
    weight: 2
    predicate:
      op: path
      from:
        role: ingest
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde la ingesta hasta un almacenamiento de objetos, así que lo único que sobrevive de una lectura es el número ya calculado.
    consequence: un error en la fórmula de cálculo no se puede rehacer. El dato original no existe y el medidor no lo vuelve a mandar, así que la corrección se hace con estimaciones sobre estimaciones.
  - id: g-buffered-to-billing
    label: la lectura no llega a facturación por una llamada directa
    weight: 2
    predicate:
      op: path
      from:
        role: ingest
      to:
        role: billing
      via:
        type: [queue, stream]
    whyMissing: no hay un camino desde la ingesta hasta la facturación que pase por una cola o por un registro de eventos.
    consequence: 240.000 lecturas por hora empujadas de a una contra el servicio de facturación lo saturan, y cuando se satura arrastra a la ingesta con él. Los medidores no reintentan indefinidamente, así que lo que no entra en ese momento se pierde.
  - id: g-processing-observed
    label: cada pieza que procesa una lectura reporta su propio ritmo
    weight: 2
    predicate:
      op: covered
      target:
        type: [service, worker]
      by:
        type: [observability]
    whyMissing: hay al menos una pieza que procesa lecturas, un servicio o un proceso de fondo, que no está conectada a ningún componente de monitoreo.
    consequence: una caída total se nota sola. Una caída parcial se esconde adentro del promedio, y esa es la que factura mal durante tres semanas.
  - id: g-buffer-observed
    label: alguien mira cuánto trabajo se está acumulando
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza donde se acumulan las lecturas pendientes no está conectada a ningún componente de monitoreo.
    consequence: la acumulación crece durante horas sin que nada se queje, hasta que la retención se llena y las lecturas más viejas se descartan en silencio.
rubric:
  - dimension: el dato original sobrevive a su propia transformación
    signal:
      kind: predicate
      guaranteeId: g-raw-archived
  - dimension: la ingesta no le pasa su volumen a la facturación de a una llamada
    signal:
      kind: predicate
      guaranteeId: g-buffered-to-billing
  - dimension: la señal es por proceso, no un promedio que tapa el agujero
    signal:
      kind: predicate
      guaranteeId: g-processing-observed
  - dimension: la acumulación de lecturas pendientes es visible
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
referenceSolutions:
  - label: la ingesta guarda el crudo y encola el trabajo
    contextInversion: "que la ingesta escriba el crudo y después encole es lo correcto cuando el archivo tiene que quedar escrito antes de que nadie transforme nada: si el guardado del crudo falla, la lectura se rechaza en el momento y el medidor la reintenta. El orden es explícito y hay una sola pieza que consume. Se paga con la escritura del archivo dentro del camino de la ingesta."
    design:
      nodes:
        - id: medidores
          type: external-party
          label: Red de medidores
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ingesta
          type: service
          label: Servicio de ingesta
          zone: private
          role: ingest
          props: { criticality: "high", replicas: "2" }
        - id: crudo
          type: object-storage
          label: Archivo de lecturas crudas
          zone: private
        - id: cola
          type: queue
          label: Cola de lecturas por procesar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: transformador
          type: worker
          label: Transformador de lecturas
          zone: private
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing
          props: { criticality: "high", replicas: "2" }
        - id: basemedidas
          type: database
          label: Base de consumos
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: medidores-gw
          from: { node: medidores }
          to: { node: gw }
          dataClass: personal
        - id: gw-ingesta
          from: { node: gw }
          to: { node: ingesta }
          dataClass: personal
        - id: ingesta-crudo
          from: { node: ingesta }
          to: { node: crudo }
          dataClass: personal
        - id: ingesta-cola
          from: { node: ingesta }
          to: { node: cola }
          dataClass: personal
        - id: cola-transformador
          from: { node: cola }
          to: { node: transformador }
          dataClass: personal
        - id: transformador-facturacion
          from: { node: transformador }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-basemedidas
          from: { node: facturacion }
          to: { node: basemedidas }
          dataClass: personal
        - id: ingesta-monitoreo
          from: { node: ingesta }
          to: { node: monitoreo }
          dataClass: public
        - id: facturacion-monitoreo
          from: { node: facturacion }
          to: { node: monitoreo }
          dataClass: public
        - id: transformador-monitoreo
          from: { node: transformador }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: un registro de eventos con dos lectores independientes
    contextInversion: "un registro de eventos con un archivador y un transformador leyendo por separado conviene cuando la ingesta no puede quedarse esperando ninguna escritura: publica una vez y sigue. El archivado deja de estar en el camino del medidor, y si el transformador tiene un error de fórmula se puede reprocesar el rango desde el registro sin tocar el archivo. Se paga con una unidad operativa más y con dos consumidores que hay que mirar por separado."
    design:
      nodes:
        - id: medidores
          type: external-party
          label: Red de medidores
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ingesta
          type: service
          label: Servicio de ingesta
          zone: private
          role: ingest
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Registro de lecturas
          zone: private
          props: { retention: "14d", partitions: "12" }
        - id: archivador
          type: worker
          label: Archivador de crudo
          zone: private
        - id: transformador
          type: worker
          label: Transformador de lecturas
          zone: private
        - id: crudo
          type: object-storage
          label: Archivo de lecturas crudas
          zone: private
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing
          props: { criticality: "high", replicas: "2" }
        - id: basemedidas
          type: database
          label: Base de consumos
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: medidores-gw
          from: { node: medidores }
          to: { node: gw }
          dataClass: personal
        - id: gw-ingesta
          from: { node: gw }
          to: { node: ingesta }
          dataClass: personal
        - id: ingesta-eventos
          from: { node: ingesta }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-archivador
          from: { node: eventos }
          to: { node: archivador }
          dataClass: personal
        - id: archivador-crudo
          from: { node: archivador }
          to: { node: crudo }
          dataClass: personal
        - id: eventos-transformador
          from: { node: eventos }
          to: { node: transformador }
          dataClass: personal
        - id: transformador-facturacion
          from: { node: transformador }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-basemedidas
          from: { node: facturacion }
          to: { node: basemedidas }
          dataClass: personal
        - id: ingesta-monitoreo
          from: { node: ingesta }
          to: { node: monitoreo }
          dataClass: public
        - id: facturacion-monitoreo
          from: { node: facturacion }
          to: { node: monitoreo }
          dataClass: public
        - id: archivador-monitoreo
          from: { node: archivador }
          to: { node: monitoreo }
          dataClass: public
        - id: transformador-monitoreo
          from: { node: transformador }
          to: { node: monitoreo }
          dataClass: public
        - id: eventos-monitoreo
          from: { node: eventos }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una distribuidora eléctrica lee **240.000 medidores inteligentes cada
hora**. La lectura entra por la puerta de entrada, la ingesta la
transforma en consumo facturable y la facturación la guarda.

En marzo, la ingesta **dejó de aceptar lecturas de una sola región**:
Itapúa, 19.000 medidores. Fue un certificado vencido del lado del
concentrador regional. No hubo caída. No hubo error en ningún tablero,
porque no hay tablero. El volumen nacional bajó menos del 3 por ciento y
ese número no le llamó la atención a nadie.

Tres semanas después, **1.800 clientes de esa región recibieron una factura
estimada** en vez de una real. La mitad estimada de más. El centro de atención
recibió 400 reclamos en dos días y el ente regulador pidió explicaciones.

Cuando el equipo quiso recalcular esas facturas con los datos verdaderos,
encontró la segunda mitad del problema: **la lectura original ya no
existía**. La ingesta transformaba y guardaba solamente el resultado. El
medidor no reenvía historia. Lo único que quedaba era el número mal
calculado.

El equipo tiene **8 unidades operativas** y hoy usa 4.

Y hay una tercera cosa que el equipo aprendió a los golpes en el pico de
julio: **el servicio de facturación aguanta 9.000 lecturas por hora**, no
240.000. Cuando la ingesta se las empuja de a una, la facturación se satura
y arrastra a la ingesta con ella. Los medidores no reintentan
indefinidamente: lo que no entra en ese momento no vuelve.

**Rearmá el sistema** con tres cosas en la cabeza. Una: la lectura cruda
tiene que quedar guardada antes de que alguien la transforme, porque es lo
único que hace reversible un error de cálculo. Dos: entre la ingesta y la
facturación tiene que haber algo que absorba la diferencia de ritmo. Tres:
la señal tiene que ser por proceso y no un promedio, porque el promedio es
exactamente lo que escondió a Itapúa durante tres semanas.
