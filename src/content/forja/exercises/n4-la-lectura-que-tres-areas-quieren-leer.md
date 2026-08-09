---
title: "La lectura que tres áreas quieren leer"
level: 4
role: tradeoff
domain: energia
tradeoffPairId: energia-lectura-de-medidores
D1: 2
D2: 2
D3: 2
D4: 1
D5: 2
D6: 1
D7: 2
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá hace falta un registro que se pueda releer, y no una entrega punto a punto."
lambda: 0.5
constraints:
  - metric: lecturas de medidor recibidas por hora en el cierre de ciclo
    operator: ">="
    value: 40000
    unit: lecturas/hora
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: el ente regulador puede pedir que se reprocesen hasta tres meses de lecturas cuando audita un reclamo de facturación, y esa reconstrucción tiene que dar el mismo resultado que la primera vez.
    discoveryPath: es la razón por la que una entrega que se consume y se borra no alcanza acá. Si el mensaje desaparece al procesarlo, la única forma de reconstruir el cálculo es volver a pedirle los datos a la empresa de telemedición. Y eso no siempre se puede.
  - fact: el área de pérdidas técnicas se sumó como consumidora seis meses después que facturación, y el equipo tuvo que rehacer la integración entera porque el aviso original tenía un solo destinatario.
    discoveryPath: mirá cuántas áreas leen el mismo hecho en el enunciado, y preguntate qué pasa cuando aparece la cuarta. Si sumar un lector obliga a tocar al productor, el diseño ya te está cobrando el próximo pedido.
startingDesign:
  nodes:
    - id: telemedicion
      type: external-party
      label: Empresa de telemedición
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 80 }
    - id: medicion
      type: service
      label: Servicio de medición
      zone: private
      role: metering-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 190 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: billing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: perdidas
      type: service
      label: Servicio de pérdidas técnicas
      zone: private
      role: losses-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
  edges:
    - id: telemedicion-gw
      from: { node: telemedicion }
      to: { node: gw }
    - id: gw-medicion
      from: { node: gw }
      to: { node: medicion }
    - id: medicion-facturacion
      from: { node: medicion }
      to: { node: facturacion }
      dataClass: personal
    - id: medicion-perdidas
      from: { node: medicion }
      to: { node: perdidas }
      dataClass: personal
guarantees:
  - id: g-replayable-log
    label: la lectura queda en un registro que se puede volver a leer
    weight: 1
    predicate:
      op: exists
      node:
        type: [stream]
    whyMissing: no hay ningún registro de eventos en el diseño. Nada que un consumidor pueda releer después de haberlo procesado.
    consequence: cuando el regulador pide reconstruir tres meses de facturación, no hay de dónde. La única fuente vuelve a ser la empresa de telemedición, y su contrato no obliga a reenviar histórico.
  - id: g-billing-reads-log
    label: facturación se entera leyendo ese registro, no porque medición se lo avise
    weight: 2
    predicate:
      op: path
      from:
        role: metering-service
      to:
        role: billing-service
      via:
        type: [stream]
    whyMissing: no hay un camino desde el servicio de medición hasta el de facturación que pase por un registro de eventos.
    consequence: si medición le avisa a facturación de forma directa, medición tiene que conocer a cada uno de sus lectores. Sumar el cuarto es tocar y volver a desplegar el servicio que menos deberías tocar.
  - id: g-losses-reads-log
    label: pérdidas técnicas lee el mismo registro, sin depender de facturación
    weight: 2
    predicate:
      op: path
      from:
        role: metering-service
      to:
        role: losses-service
      via:
        type: [stream]
    whyMissing: no hay un camino desde el servicio de medición hasta el de pérdidas técnicas que pase por un registro de eventos.
    consequence: dos áreas leyendo el mismo hecho por caminos distintos terminan con dos versiones del mismo número, y la discusión sobre cuál es la buena dura más que el reclamo que la originó.
  - id: g-observability
    label: el servicio de medición está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: metering-service
      by:
        type: [observability]
    whyMissing: el servicio de medición no está conectado a ningún componente de observabilidad.
    consequence: si la ingesta de lecturas se frena, la primera señal es una factura mal emitida. El mes que viene.
rubric:
  - dimension: existe un registro de lecturas que se puede releer
    signal:
      kind: predicate
      guaranteeId: g-replayable-log
  - dimension: las dos áreas leen el mismo hecho del mismo lugar
    signal:
      kind: predicate
      guaranteeId: g-losses-reads-log
referenceSolutions:
  - label: cada área con su propio lector del registro
    contextInversion: conviene cuando las dos áreas procesan a ritmos muy distintos, con facturación en ráfagas al cierre de ciclo y pérdidas técnicas de corrido, y no querés que la lenta le marque el paso a la rápida. Cuesta dos piezas de proceso en vez de ninguna, y a cambio cada área avanza y se atrasa por su cuenta.
    design:
      nodes:
        - id: telemedicion
          type: external-party
          label: Empresa de telemedición
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: medicion
          type: service
          label: Servicio de medición
          zone: private
          role: metering-service
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: stream
          label: Registro de lecturas
          zone: private
          props: { retention: "90d", partitions: "6" }
        - id: lector-facturacion
          type: worker
          label: Lector de facturación
          zone: private
        - id: lector-perdidas
          type: worker
          label: Lector de pérdidas técnicas
          zone: private
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: perdidas
          type: service
          label: Servicio de pérdidas técnicas
          zone: private
          role: losses-service
          props: { criticality: "medium", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: telemedicion-gw
          from: { node: telemedicion }
          to: { node: gw }
        - id: gw-medicion
          from: { node: gw }
          to: { node: medicion }
        - id: medicion-registro
          from: { node: medicion }
          to: { node: registro }
          dataClass: personal
        - id: registro-lector-facturacion
          from: { node: registro }
          to: { node: lector-facturacion }
        - id: registro-lector-perdidas
          from: { node: registro }
          to: { node: lector-perdidas }
        - id: lector-facturacion-facturacion
          from: { node: lector-facturacion }
          to: { node: facturacion }
          dataClass: personal
        - id: lector-perdidas-perdidas
          from: { node: lector-perdidas }
          to: { node: perdidas }
          dataClass: personal
        - id: medicion-obs
          from: { node: medicion }
          to: { node: obs }
  - label: cada servicio lee el registro por sí mismo
    contextInversion: conviene cuando los dos servicios ya saben leer un registro de eventos y llevar su propia posición de lectura. Son dos piezas menos que operar, con el costo de que esa lógica de avance ahora vive dentro de cada servicio de negocio en vez de en un proceso aparte que podés reiniciar solo.
    design:
      nodes:
        - id: telemedicion
          type: external-party
          label: Empresa de telemedición
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: medicion
          type: service
          label: Servicio de medición
          zone: private
          role: metering-service
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: stream
          label: Registro de lecturas
          zone: private
          props: { retention: "90d", partitions: "6" }
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: perdidas
          type: service
          label: Servicio de pérdidas técnicas
          zone: private
          role: losses-service
          props: { criticality: "medium", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: telemedicion-gw
          from: { node: telemedicion }
          to: { node: gw }
        - id: gw-medicion
          from: { node: gw }
          to: { node: medicion }
        - id: medicion-registro
          from: { node: medicion }
          to: { node: registro }
          dataClass: personal
        - id: registro-facturacion
          from: { node: registro }
          to: { node: facturacion }
          dataClass: personal
        - id: registro-perdidas
          from: { node: registro }
          to: { node: perdidas }
          dataClass: personal
        - id: medicion-obs
          from: { node: medicion }
          to: { node: obs }
status: PILOT
---

Una distribuidora eléctrica. Una empresa de telemedición contratada le
envía las lecturas de los medidores: en el cierre de ciclo llegan **más de
40.000 por hora**. Hoy el servicio de medición las recibe y le avisa,
directo, a dos áreas: **facturación** y **pérdidas técnicas**.

Dos cosas que el equipo ya vivió:

Cuando el ente regulador audita un reclamo de facturación, pide reconstruir
hasta **tres meses** de lecturas, y la reconstrucción tiene que dar el mismo
número que la primera vez. Hoy, una vez procesada, la lectura no está en
ningún lado desde donde volver a leerla.

Y pérdidas técnicas apareció como segunda interesada **seis meses después**
que facturación. Sumarla obligó a tocar el servicio de medición, que es
justamente el que nadie quiere tocar. El área comercial ya avisó que va a
querer una tercera vista, para detección de fraude.

El presupuesto operativo es de **8 unidades operativas**.

**Rearmá el sistema** para que las dos áreas se enteren leyendo el mismo
hecho de un lugar que se puede volver a leer, y no porque el servicio de
medición conozca a cada una de ellas por su nombre.
