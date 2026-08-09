---
title: "El resumen que manda el ticket entero"
level: 10
role: calibration
domain: soporte
D1: 2
D2: 2
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 6
  monthlyUsd: 400
aiBudget: "libre, pero tu respuesta tiene que decir, en tus propias palabras, qué parte del ticket sale de la empresa y qué parte no."
lambda: 0.5
constraints:
  - metric: "tickets que se resumen por día"
    operator: ">="
    value: 900
    unit: tickets
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 6
    unit: unidades operativas
  - metric: "costo mensual del modelo"
    operator: "<="
    value: 200
    unit: dólares
hiddenFacts:
  - fact: "el proveedor del modelo procesa el texto en sus propios servidores, fuera de la infraestructura de la empresa y fuera del país."
    discoveryPath: "mirá de dónde a dónde va la conexión que sale del servicio de tickets y qué dice que viaja por ella. El motor marca esa conexión como bloqueante antes de darte cualquier puntaje: no es una advertencia que puedas ignorar."
  - fact: "el servicio de anonimización existe desde hace dos años. Se construyó para los reportes al ente regulador y nadie lo conectó al resumidor."
    discoveryPath: "el servicio ya está en el lienzo, sin ninguna conexión. Está ahí porque el equipo lo tiene; que no lo use el flujo nuevo es la decisión que este ejercicio te pide revisar."
startingDesign:
  nodes:
    - id: agente
      type: actor
      label: "Agente de soporte"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: consola
      type: web-client
      label: "Consola de tickets"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: tickets
      type: service
      label: "Servicio de tickets"
      zone: private
      role: ticket-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: anonimizador
      type: service
      label: "Servicio de anonimización"
      zone: private
      role: anonymizer
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: modelo
      type: ai-model
      label: "Modelo de resumen del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
  edges:
    - id: agente-consola
      from: { node: agente }
      to: { node: consola }
      dataClass: public
    - id: consola-gw
      from: { node: consola }
      to: { node: gw }
      dataClass: personal
    - id: gw-tickets
      from: { node: gw }
      to: { node: tickets }
      dataClass: personal
    - id: tickets-modelo
      from: { node: tickets }
      to: { node: modelo }
      dataClass: personal
guarantees:
  - id: g-sin-atajo-al-modelo
    label: "el servicio que guarda los datos del cliente no le habla directo al modelo"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: ticket-service
      to:
        type: [ai-model]
    whyMissing: "hay una conexión directa desde el servicio de tickets hasta el modelo, y por esa conexión viaja el ticket completo tal como lo escribió el cliente."
    consequence: "el nombre, el documento y el teléfono del cliente salen de la empresa cada vez que alguien pide un resumen. No hay forma de deshacer una transferencia que ya ocurrió, y hay que poder justificarla ante quien la pregunte."
  - id: g-anonimizado-antes-del-modelo
    label: "lo que llega al modelo pasó antes por el servicio de anonimización"
    weight: 3
    predicate:
      op: path
      from:
        role: ticket-service
      to:
        type: [ai-model]
      via:
        role: anonymizer
    whyMissing: "no existe ningún camino desde el servicio de tickets hasta el modelo que atraviese el servicio de anonimización."
    consequence: "el resumen se sigue pudiendo pedir, pero se pide con el texto crudo. La pieza que sabe qué campos hay que sacar queda mirando desde afuera, y la decisión de qué sale de la empresa la termina tomando el que escribió el ticket."
rubric:
  - dimension: "los datos del cliente no llegan al proveedor externo"
    signal:
      kind: predicate
      guaranteeId: g-sin-atajo-al-modelo
  - dimension: "hay una sola pieza que decide qué se le manda al modelo"
    signal:
      kind: predicate
      guaranteeId: g-anonimizado-antes-del-modelo
referenceSolutions:
  - label: "el anonimizador en el camino del pedido"
    contextInversion: "poner el anonimizador en el medio, en la misma llamada, conviene cuando el agente espera el resumen en pantalla: el resumen tarda lo que tarda el modelo y ni un segundo más. Se paga con que una caída del proveedor se le aparece al agente como un error en la pantalla, no como un resumen que llega tarde."
    design:
      nodes:
        - id: agente
          type: actor
          label: "Agente de soporte"
          zone: public
        - id: consola
          type: web-client
          label: "Consola de tickets"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: tickets
          type: service
          label: "Servicio de tickets"
          zone: private
          role: ticket-service
          props: { criticality: "high", replicas: "2" }
        - id: anonimizador
          type: service
          label: "Servicio de anonimización"
          zone: private
          role: anonymizer
          props: { criticality: "medium", replicas: "2" }
        - id: modelo
          type: ai-model
          label: "Modelo de resumen del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: agente-consola
          from: { node: agente }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-tickets
          from: { node: gw }
          to: { node: tickets }
          dataClass: personal
        - id: tickets-anonimizador
          from: { node: tickets }
          to: { node: anonimizador }
          dataClass: personal
        - id: anonimizador-modelo
          from: { node: anonimizador }
          to: { node: modelo }
          dataClass: public
  - label: "el resumen se pide en diferido"
    contextInversion: "encolar el pedido conviene cuando el resumen no se mira mientras el agente atiende, sino cuando cierra el ticket: el proveedor puede estar lento o caído media hora y el agente ni se entera, porque el pedido espera guardado. Se paga con una pieza más para operar y con que el resumen no está listo en el momento."
    design:
      nodes:
        - id: agente
          type: actor
          label: "Agente de soporte"
          zone: public
        - id: consola
          type: web-client
          label: "Consola de tickets"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: tickets
          type: service
          label: "Servicio de tickets"
          zone: private
          role: ticket-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: "Cola de resúmenes pendientes"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: anonimizador
          type: service
          label: "Servicio de anonimización"
          zone: private
          role: anonymizer
          props: { criticality: "medium", replicas: "2" }
        - id: modelo
          type: ai-model
          label: "Modelo de resumen del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      edges:
        - id: agente-consola
          from: { node: agente }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: gw-tickets
          from: { node: gw }
          to: { node: tickets }
          dataClass: personal
        - id: tickets-cola
          from: { node: tickets }
          to: { node: cola }
          dataClass: personal
        - id: cola-anonimizador
          from: { node: cola }
          to: { node: anonimizador }
          dataClass: personal
        - id: anonimizador-modelo
          from: { node: anonimizador }
          to: { node: modelo }
          dataClass: public
status: PILOT
---

Una empresa de telecomunicaciones con **900 tickets de soporte por día**. El
mes pasado el equipo conectó un modelo de lenguaje para que resuma cada ticket
antes de que lo tome un agente: en vez de leer cuarenta líneas de ida y vuelta,
el agente lee tres.

Funciona. Los agentes están contentos. El resumen sale en menos de dos
segundos.

Lo que se le manda al modelo es **el ticket entero**: el texto tal como lo
escribió el cliente, con su nombre, su número de documento, su teléfono y, la
mitad de las veces, la dirección de la casa donde hay que ir a cambiar el
módem. El modelo no corre en la empresa. Corre en la infraestructura del
proveedor, que factura **USD 200 por mes** y procesa el texto en otro país.

Hay una pieza más en el lienzo que conviene mirar antes de tocar nada: el
**servicio de anonimización**. Existe desde hace dos años. Se construyó para
los reportes que la empresa le manda al ente regulador, sabe exactamente qué
campos hay que reemplazar y está probado. No está conectado a nada de este
flujo.

El equipo opera hoy **6 unidades operativas** como techo, y el resumidor tiene
que seguir andando: nadie va a aceptar volver a leer cuarenta líneas.

**Rearmá el sistema** para que el resumen siga saliendo y el proveedor nunca
vea un dato que identifique a la persona que abrió el ticket.
