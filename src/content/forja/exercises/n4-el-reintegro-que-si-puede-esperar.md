---
title: "El reintegro que sí puede esperar"
level: 4
role: counter-trap
domain: farmacia
D1: 1
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
aiBudget: "libre, pero la respuesta tiene que decir qué cambió respecto de la receta controlada, y por qué acá el mismo gesto que allá estaba mal, acá está bien."
lambda: 0.5
constraints:
  - metric: tiempo aceptable para que el farmacéutico entregue el medicamento
    operator: "<="
    value: 900
    unit: ms
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: el sistema de la obra social responde entre 2 y 90 segundos, y los primeros días de cada mes, cuando se renuevan las autorizaciones, se cae durante horas.
    discoveryPath: "es el mismo comportamiento del proveedor de email del primer ejercicio del nivel. Conectá el despacho directo a la obra social y probá tu respuesta: el motor marca el salto sin testigo durable."
  - fact: el convenio con la obra social da 30 días corridos para presentar el consumo; lo que no se presenta en ese plazo, la farmacia lo pierde y lo absorbe como pérdida.
    discoveryPath: "mirá el plazo del convenio en el enunciado y comparalo con el plazo del mostrador. Uno se mide en milisegundos y el otro en días: son dos problemas distintos aunque salgan del mismo botón."
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
      position: { x: 445, y: 300 }
    - id: obrasocial
      type: external-provider
      label: Sistema de la obra social
      zone: dmz
      role: insurer
      given: true
      position: { x: 445, y: 410 }
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
    - id: despacho-obrasocial
      from: { node: despacho }
      to: { node: obrasocial }
      dataClass: personal
guarantees:
  - id: g-durable-handoff
    label: la presentación del consumo sobrevive a un reinicio del despacho
    weight: 3
    predicate:
      op: noVolatileCut
      from:
        role: dispensing-service
      to:
        role: insurer
    whyMissing: no hay ningún componente durable entre el servicio de despacho y el sistema de la obra social.
    consequence: si el proceso de despacho se reinicia mientras espera a la obra social, ese consumo no se presenta nunca. A los 30 días el convenio lo da por perdido y la farmacia se come el costo del medicamento que ya entregó.
  - id: g-not-blocking
    label: la entrega del medicamento no espera al sistema de la obra social
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: dispensing-service
      to:
        role: insurer
    whyMissing: hay una conexión directa entre el servicio de despacho y el sistema de la obra social.
    consequence: la obra social tarda hasta 90 segundos y los primeros días del mes se cae por horas. Con esa llamada en línea, el paciente espera en el mostrador por un trámite administrativo que no le importa a nadie más que a la farmacia.
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
    consequence: si las presentaciones dejan de salir, la farmacia se entera cuando concilia el mes, con los 30 días ya vencidos para una parte de los consumos.
rubric:
  - dimension: la presentación del consumo sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-durable-handoff
  - dimension: el paciente no espera al sistema de la obra social
    signal:
      kind: predicate
      guaranteeId: g-not-blocking
  - dimension: el equipo se entera antes del cierre de mes
    signal:
      kind: predicate
      guaranteeId: g-observability
referenceSolutions:
  - label: una cola de presentaciones pendientes
    contextInversion: es la elección correcta cuando la obra social es el único destinatario del consumo y lo que hay que garantizar es que ninguna presentación se pierda. Una cola con destino para los fallos convierte una caída de horas en un atraso de horas, no en una pérdida.
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
        - id: cola
          type: queue
          label: Cola de presentaciones
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: presentador
          type: worker
          label: Presentador de consumos
          zone: private
        - id: obrasocial
          type: external-provider
          label: Sistema de la obra social
          zone: dmz
          role: insurer
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
        - id: despacho-cola
          from: { node: despacho }
          to: { node: cola }
          dataClass: personal
        - id: cola-presentador
          from: { node: cola }
          to: { node: presentador }
        - id: presentador-obrasocial
          from: { node: presentador }
          to: { node: obrasocial }
          dataClass: personal
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
  - label: un registro de dispensas que la obra social y la contaduría leen
    contextInversion: conviene cuando la contaduría de la farmacia también necesita el mismo hecho para conciliar el mes, y quiere poder recalcular el período completo sin pedírselo a nadie. Cuesta lo mismo que la cola en piezas y a cambio el hecho queda releíble, algo que acá se puede porque el dato no sale de la farmacia hasta que el presentador lo envía.
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
          type: stream
          label: Registro de dispensas
          zone: private
          props: { retention: "45d", partitions: "1" }
        - id: presentador
          type: worker
          label: Presentador de consumos
          zone: private
        - id: obrasocial
          type: external-provider
          label: Sistema de la obra social
          zone: dmz
          role: insurer
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
        - id: registro-presentador
          from: { node: registro }
          to: { node: presentador }
        - id: presentador-obrasocial
          from: { node: presentador }
          to: { node: obrasocial }
          dataClass: personal
        - id: despacho-obs
          from: { node: despacho }
          to: { node: obs }
status: PILOT
---

La misma farmacia, el mismo mostrador, el mismo botón. Pero el paso que hay
que resolver es el otro: cuando el medicamento sale, la farmacia tiene que
**presentarle el consumo a la obra social** para cobrar el reintegro.

Los dos plazos de este mostrador no se parecen en nada:

El paciente espera **menos de un segundo** para llevarse su medicamento.
El convenio con la obra social da **30 días corridos** para presentar el
consumo, y lo que no se presenta en ese plazo la farmacia lo pierde: absorbe
el costo del medicamento que ya entregó.

El sistema de la obra social responde entre **2 y 90 segundos**, y los
primeros días de cada mes, cuando se renuevan las autorizaciones, se cae
durante horas. Hoy el servicio de despacho lo llama en línea y espera: el
paciente mira el techo mientras un trámite administrativo que no le importa
decide cuándo puede irse. Y si el proceso se reinicia en el medio, ese
consumo no se presenta nunca; nadie se entera hasta la conciliación del mes.

El presupuesto operativo de la farmacia es de **6 unidades operativas**.

**Rearmá el sistema** para que la entrega del medicamento deje de depender
del sistema de la obra social, sin que ninguna presentación de consumo se
pierda en el camino.
