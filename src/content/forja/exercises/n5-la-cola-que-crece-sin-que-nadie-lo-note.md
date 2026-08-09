---
title: "La cola que crece sin que nadie lo note"
level: 5
role: core
domain: facturacion
D1: 2
D2: 1
D3: 3
D4: 1
D5: 2
D6: 2
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué señal habría hecho sonar la alarma la madrugada del 14 y por qué."
lambda: 0.5
constraints:
  - metric: facturas emitidas en un día hábil
    operator: ">="
    value: 6200
    unit: facturas/día
  - metric: tiempo aceptable entre que el emisor deja de procesar y el equipo se entera
    operator: "<="
    value: 15
    unit: minutos
hiddenFacts:
  - fact: la cola retiene los mensajes 4 días y después los descarta sin avisar. El emisor estuvo caído 6.
    discoveryPath: "es la cuenta que explica el agujero: no se perdieron las facturas que fallaron, se perdieron las que nadie llegó a intentar."
  - fact: el emisor no se cayó con un error ruidoso. Se quedó esperando una respuesta que nunca llegó y siguió vivo, consumiendo cero mensajes.
    discoveryPath: "un proceso vivo que no hace nada no dispara ninguna alarma de proceso caído. Conectá el emisor a un componente de monitoreo y fijate qué señal cambia: el ritmo de trabajo, no la existencia del proceso."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de facturación
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: billing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: cola
      type: queue
      label: Cola de facturas por emitir
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 520 }
    - id: emisor
      type: worker
      label: Emisor de facturas
      zone: private
      given: true
      position: { x: 445, y: 410 }
    - id: libro
      type: database
      label: Libro contable
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: fisco
      type: external-provider
      label: Organismo fiscal
      zone: dmz
      role: tax-authority
      given: true
      position: { x: 445, y: 190 }
  edges:
    - id: cliente-portal
      from: { node: cliente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-facturacion
      from: { node: gw }
      to: { node: facturacion }
      dataClass: personal
    - id: facturacion-cola
      from: { node: facturacion }
      to: { node: cola }
      dataClass: personal
    - id: cola-emisor
      from: { node: cola }
      to: { node: emisor }
      dataClass: personal
    - id: emisor-fisco
      from: { node: emisor }
      to: { node: fisco }
      dataClass: personal
    - id: emisor-libro
      from: { node: emisor }
      to: { node: libro }
      dataClass: personal
guarantees:
  - id: g-buffer-observed
    label: alguien mira cuánto trabajo se está acumulando
    weight: 2
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza donde se acumulan las facturas pendientes no está conectada a ningún componente de monitoreo, así que el tamaño de la acumulación no es una señal para nadie.
    consequence: "los mensajes se acumulan hasta llenar la retención y después se descartan. El sistema parece funcionar: nadie ve el error hasta que falta el dato."
  - id: g-processing-observed
    label: todo lo que procesa una factura reporta su ritmo de trabajo
    weight: 1
    predicate:
      op: covered
      target:
        type: [service, worker]
      by:
        type: [observability]
    whyMissing: hay al menos una pieza que procesa facturas, un servicio o un proceso de fondo, que no está conectada a ningún componente de monitoreo.
    consequence: un proceso que sigue vivo pero dejó de trabajar no dispara ninguna alarma de proceso caído. Sin la señal de cuántas facturas emitió en la última hora, "vivo" y "funcionando" se vuelven la misma cosa, y no lo son.
  - id: g-invoice-durable
    label: el comprobante llega al organismo fiscal aunque el proceso se reinicie
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: billing-service
      to:
        role: tax-authority
    whyMissing: no hay ninguna pieza durable entre el servicio de facturación y el organismo fiscal. Si el proceso se reinicia mientras espera el sellado, no queda registro de que había un comprobante por enviar.
    consequence: el cliente recibe un producto sin factura válida y la contabilidad cierra el mes con un agujero que sólo aparece en la conciliación, semanas después.
rubric:
  - dimension: la acumulación de trabajo pendiente es una señal visible
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
  - dimension: distingue "el proceso está vivo" de "el proceso está trabajando"
    signal:
      kind: predicate
      guaranteeId: g-processing-observed
  - dimension: el comprobante sobrevive a un reinicio del emisor
    signal:
      kind: predicate
      guaranteeId: g-invoice-durable
referenceSolutions:
  - label: la cola que ya existía, ahora observada
    contextInversion: "dejar la cola y sumarle señal es lo correcto cuando el único consumidor del evento es la emisión de la factura: no hay nadie más que necesite releer ese evento, y una cola con una sola boca de salida es la pieza más barata de operar que hace el trabajo."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: portal
          type: web-client
          label: Portal de facturación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de facturas por emitir
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: emisor
          type: worker
          label: Emisor de facturas
          zone: private
        - id: libro
          type: database
          label: Libro contable
          zone: restricted
          props: { backup: "diario" }
        - id: fisco
          type: external-provider
          label: Organismo fiscal
          zone: dmz
          role: tax-authority
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-cola
          from: { node: facturacion }
          to: { node: cola }
          dataClass: personal
        - id: cola-emisor
          from: { node: cola }
          to: { node: emisor }
          dataClass: personal
        - id: emisor-fisco
          from: { node: emisor }
          to: { node: fisco }
          dataClass: personal
        - id: emisor-libro
          from: { node: emisor }
          to: { node: libro }
          dataClass: personal
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: emisor-monitoreo
          from: { node: emisor }
          to: { node: monitoreo }
          dataClass: public
        - id: facturacion-monitoreo
          from: { node: facturacion }
          to: { node: monitoreo }
          dataClass: public
  - label: un registro de eventos que dos procesos leen por separado
    contextInversion: "un registro de eventos releíble conviene cuando el hecho de que se facturó le sirve a más de un proceso: uno emite la factura y otro concilia contra el banco, cada uno con su propio ritmo y su propia posición de lectura. Se paga con una unidad operativa más y con la obligación de mirar dos consumidores en vez de uno, pero permite reprocesar un rango de eventos sin pedirle nada al servicio de facturación."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: app
          type: mobile-client
          label: App de facturación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Registro de eventos de facturación
          zone: private
          props: { retention: "30d", partitions: "6" }
        - id: emisor
          type: worker
          label: Emisor de facturas
          zone: private
        - id: conciliador
          type: worker
          label: Conciliador contra el banco
          zone: private
        - id: libro
          type: database
          label: Libro contable
          zone: restricted
          props: { backup: "diario" }
        - id: fisco
          type: external-provider
          label: Organismo fiscal
          zone: dmz
          role: tax-authority
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-app
          from: { node: cliente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-eventos
          from: { node: facturacion }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-emisor
          from: { node: eventos }
          to: { node: emisor }
          dataClass: personal
        - id: eventos-conciliador
          from: { node: eventos }
          to: { node: conciliador }
          dataClass: personal
        - id: emisor-fisco
          from: { node: emisor }
          to: { node: fisco }
          dataClass: personal
        - id: emisor-libro
          from: { node: emisor }
          to: { node: libro }
          dataClass: personal
        - id: conciliador-libro
          from: { node: conciliador }
          to: { node: libro }
          dataClass: personal
        - id: eventos-monitoreo
          from: { node: eventos }
          to: { node: monitoreo }
          dataClass: public
        - id: emisor-monitoreo
          from: { node: emisor }
          to: { node: monitoreo }
          dataClass: public
        - id: conciliador-monitoreo
          from: { node: conciliador }
          to: { node: monitoreo }
          dataClass: public
        - id: facturacion-monitoreo
          from: { node: facturacion }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una empresa de software factura **6.200 comprobantes por día hábil**. El
servicio de facturación deja el comprobante pendiente en una cola y un
proceso aparte (el emisor) lo toma, lo manda al organismo fiscal para que
lo selle, y recién con el sellado lo escribe en el libro contable.

El 14 del mes pasado, a las 03:40, el emisor **dejó de consumir**. No se
cayó: se quedó esperando una respuesta del organismo fiscal que nunca
llegó, y siguió vivo. El chequeo de salud respondía "ok" cada treinta
segundos, porque el proceso existía. Simplemente no hacía nada.

La cola siguió aceptando comprobantes durante **seis días**. La retención
es de cuatro. **Se descartaron 12.400 facturas** sin un solo error en
ningún registro, porque no hubo error: hubo ausencia. El equipo se enteró
el día 22, cuando contabilidad cerró el mes y faltaba plata.

El dueño de producto pide dos cosas y las dos son de operación, no de
funcionalidad: que **la acumulación de trabajo pendiente sea algo que
alguien vea** antes de que la retención la borre, y que se pueda
**distinguir un proceso vivo de un proceso que trabaja**. El equipo tiene
**7 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que la próxima vez que el emisor se quede
esperando, la señal salga del sistema y no de la conciliación de fin de mes.
