---
title: "La alerta de frío que salió por un solo canal"
level: 6
role: core
domain: farmacia
D1: 2
D2: 1
D3: 2
D4: 1
D5: 2
D6: 2
D7: 4
D8: 0
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que explicar qué pasa con la alerta si se cae el canal de mensajes de texto, y qué pasa si se cae la pieza que los manda. No son la misma pregunta."
lambda: 0.5
constraints:
  - metric: cámaras de frío monitoreadas
    operator: ">="
    value: 38
    unit: cámaras
  - metric: tiempo máximo tolerable entre que una cámara sale de rango y alguien se entera
    operator: "<="
    value: 15
    unit: minutos
  - metric: valor de las vacunas perdidas la noche del incidente
    operator: ">="
    value: 180000
    unit: dólares
hiddenFacts:
  - fact: "el proveedor de mensajes de texto tuvo una caída de tres horas en marzo. La alerta se generó a las 23:40, el mensaje nunca salió, y la cámara 12 estuvo en +6 °C hasta que abrió el depósito a las 7."
    discoveryPath: "seguí el camino de una alerta desde el servicio hasta el teléfono del encargado. Contá cuántas piezas distintas tienen que estar vivas para que suene, y qué pasa si falla una sola."
  - fact: "el proveedor de llamadas de voz es de otra empresa, con otra red y otro contrato. Los dos no se caen por la misma razón. Es la única propiedad que hace que sumar el segundo sirva de algo."
    discoveryPath: "un segundo canal del mismo proveedor no es un segundo canal: es la misma caída con dos nombres. Preguntate qué comparten los dos caminos antes de contarlos como dos."
  - fact: "el despachador de mensajes de texto ya existe y funciona bien. El problema no es esa pieza: es que sea la única."
    discoveryPath: "el ejercicio no te pide reemplazar lo que hay. Fijate qué obligación se rompe si borrás el despachador actual en vez de agregarle un hermano."
startingDesign:
  nodes:
    - id: sensores
      type: external-party
      label: Red de sensores de las cámaras
      zone: public
      given: true
      position: { x: 85, y: 190 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: alertas
      type: service
      label: Servicio de alertas de temperatura
      zone: private
      role: alerts-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: despachador-sms
      type: worker
      label: Despachador de mensajes de texto
      zone: private
      role: sms-dispatcher
      given: true
      position: { x: 445, y: 410 }
    - id: proveedor-sms
      type: external-provider
      label: Proveedor de mensajes de texto
      zone: dmz
      role: sms-channel
      given: true
      position: { x: 445, y: 520 }
    - id: proveedor-voz
      type: external-provider
      label: Proveedor de llamadas de voz
      zone: dmz
      role: voice-channel
      given: true
      position: { x: 445, y: 630 }
  edges:
    - id: sensores-gw
      from: { node: sensores }
      to: { node: gw }
      dataClass: public
    - id: gw-alertas
      from: { node: gw }
      to: { node: alertas }
      dataClass: public
    - id: alertas-despachador
      from: { node: alertas }
      to: { node: despachador-sms }
      dataClass: public
    - id: despachador-proveedor
      from: { node: despachador-sms }
      to: { node: proveedor-sms }
      dataClass: personal
guarantees:
  - id: g-canal-actual
    label: el canal de mensajes de texto sigue funcionando, por el despachador que ya existe
    weight: 1
    predicate:
      op: path
      from:
        role: alerts-service
      to:
        role: sms-channel
      via:
        role: sms-dispatcher
    whyMissing: "la alerta ya no llega al proveedor de mensajes de texto pasando por el despachador que el equipo tiene funcionando. Resolver la falta de un segundo canal apagando el primero no agrega resiliencia: cambia de único punto de falla."
    consequence: el canal que hoy funciona el 99 % del tiempo deja de estar. Ganás un camino nuevo y perdés el conocido, con la misma cantidad de caminos que antes.
  - id: g-segundo-canal-independiente
    label: la alerta llega a un segundo canal por un camino que no pasa por el despachador de mensajes
    weight: 3
    predicate:
      op: path
      from:
        role: alerts-service
      to:
        role: voice-channel
      forbid:
        role: sms-dispatcher
    whyMissing: no hay ningún camino desde el servicio de alertas hasta el proveedor de llamadas de voz que evite el despachador de mensajes de texto. Un segundo canal que sale de la misma pieza se cae con esa pieza.
    consequence: "la noche de marzo la alerta se generó a las 23:40 y nunca sonó. La cámara 12 estuvo en +6 °C hasta las 7 de la mañana: 180.000 dólares en vacunas y un solo camino de aviso."
  - id: g-canales-separados
    label: la pieza que manda mensajes de texto no es también la que llama por teléfono
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: sms-dispatcher
      to:
        role: voice-channel
    whyMissing: el despachador de mensajes de texto es el que llama también al proveedor de voz. Los dos canales comparten la pieza que los dispara, así que la caída de esa pieza apaga los dos a la vez.
    consequence: "dos proveedores distintos y un solo lugar donde se rompe todo. El informe posterior al incidente va a decir «teníamos redundancia», y va a ser cierto en el papel y falso en producción."
rubric:
  - dimension: agregar un camino, no reemplazar el que había
    signal:
      kind: predicate
      guaranteeId: g-canal-actual
  - dimension: el camino de emergencia no depende de la pieza que puede caerse
    signal:
      kind: predicate
      guaranteeId: g-segundo-canal-independiente
  - dimension: dos canales que comparten disparador son un canal contado dos veces
    signal:
      kind: predicate
      guaranteeId: g-canales-separados
referenceSolutions:
  - label: un despachador de voz propio, colgado del mismo servicio
    contextInversion: "un segundo despachador colgado directo del servicio de alertas es lo correcto cuando lo que importa es el tiempo: la alerta sale por los dos caminos en el mismo instante, sin ninguna pieza compartida entre ellos más que el servicio que las genera. Es la topología con menos latencia y menos partes móviles. El costo es que si el servicio de alertas está caído no sale nada por ninguno de los dos, y que una alerta que no se pudo entregar en el momento no queda en ningún lado para reintentarla."
    design:
      nodes:
        - id: sensores
          type: external-party
          label: Red de sensores de las cámaras
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: alertas
          type: service
          label: Servicio de alertas de temperatura
          zone: private
          role: alerts-service
          props: { criticality: "high", replicas: "2" }
        - id: despachador-sms
          type: worker
          label: Despachador de mensajes de texto
          zone: private
          role: sms-dispatcher
        - id: despachador-voz
          type: worker
          label: Despachador de llamadas de voz
          zone: private
        - id: proveedor-sms
          type: external-provider
          label: Proveedor de mensajes de texto
          zone: dmz
          role: sms-channel
        - id: proveedor-voz
          type: external-provider
          label: Proveedor de llamadas de voz
          zone: dmz
          role: voice-channel
      edges:
        - id: sensores-gw
          from: { node: sensores }
          to: { node: gw }
          dataClass: public
        - id: gw-alertas
          from: { node: gw }
          to: { node: alertas }
          dataClass: public
        - id: alertas-despachador
          from: { node: alertas }
          to: { node: despachador-sms }
          dataClass: public
        - id: alertas-despachador-voz
          from: { node: alertas }
          to: { node: despachador-voz }
          dataClass: public
        - id: despachador-proveedor
          from: { node: despachador-sms }
          to: { node: proveedor-sms }
          dataClass: personal
        - id: despachador-voz-proveedor
          from: { node: despachador-voz }
          to: { node: proveedor-voz }
          dataClass: personal
  - label: un registro de alertas del que leen los dos despachadores
    contextInversion: "publicar la alerta en un registro durable y que cada despachador la lea por su cuenta conviene cuando una alerta no entregada no puede desaparecer: el hecho queda escrito, cada canal avanza a su ritmo, y se puede volver a pasar una noche entera de alertas para auditar qué se avisó y qué no. Es lo que se elige después de un incidente que hubo que reconstruir a mano. Se paga con una pieza más para operar, con unos segundos de demora hasta que cada despachador lee, y con una dependencia nueva: el registro pasa a ser compartido por los dos canales."
    design:
      nodes:
        - id: sensores
          type: external-party
          label: Red de sensores de las cámaras
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: alertas
          type: service
          label: Servicio de alertas de temperatura
          zone: private
          role: alerts-service
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: stream
          label: Registro de alertas emitidas
          zone: private
          props: { retention: "30d", partitions: "3" }
        - id: despachador-sms
          type: worker
          label: Despachador de mensajes de texto
          zone: private
          role: sms-dispatcher
        - id: despachador-voz
          type: worker
          label: Despachador de llamadas de voz
          zone: private
        - id: proveedor-sms
          type: external-provider
          label: Proveedor de mensajes de texto
          zone: dmz
          role: sms-channel
        - id: proveedor-voz
          type: external-provider
          label: Proveedor de llamadas de voz
          zone: dmz
          role: voice-channel
      edges:
        - id: sensores-gw
          from: { node: sensores }
          to: { node: gw }
          dataClass: public
        - id: gw-alertas
          from: { node: gw }
          to: { node: alertas }
          dataClass: public
        - id: alertas-registro
          from: { node: alertas }
          to: { node: registro }
          dataClass: public
        - id: registro-despachador-sms
          from: { node: registro }
          to: { node: despachador-sms }
          dataClass: public
        - id: registro-despachador-voz
          from: { node: registro }
          to: { node: despachador-voz }
          dataClass: public
        - id: despachador-proveedor
          from: { node: despachador-sms }
          to: { node: proveedor-sms }
          dataClass: personal
        - id: despachador-voz-proveedor
          from: { node: despachador-voz }
          to: { node: proveedor-voz }
          dataClass: personal
status: PILOT
---

Un depósito farmacéutico con **38 cámaras de frío**. Los sensores reportan
temperatura, y cuando una cámara sale de rango el servicio de alertas le pide
al despachador de mensajes de texto que avise al encargado de turno. El
compromiso interno es de **15 minutos** entre que una cámara sale de rango y
alguien se entera.

En marzo el proveedor de mensajes de texto estuvo caído tres horas.

La alerta se generó a las 23:40. El sistema hizo todo bien: leyó el sensor,
evaluó el rango, emitió la alerta y se la pasó al despachador. El mensaje
nunca salió. La cámara 12 estuvo en **+6 °C hasta las 7 de la mañana**,
cuando abrió el depósito.

**180.000 dólares** en vacunas. Ninguna pieza del sistema falló, salvo la
única que hacía sonar el teléfono.

El equipo ya contrató un proveedor de llamadas de voz, de otra empresa, con
otra red y otro contrato: la única propiedad que hace que sumarlo sirva de
algo es que no se caen por la misma razón. Está contratado y no está
conectado a nada.

Dos advertencias del jefe de depósito, en sus palabras: *"El canal de
mensajes anda bien el 99 % del tiempo, no me lo saquen"*, y *"si los dos
avisos salen del mismo lugar, no tengo dos avisos"*.

El equipo tiene **5 unidades operativas** y hoy usa 3.

**Rearmá el sistema** para que la alerta llegue al segundo canal por un
camino que no dependa de la pieza que despacha el primero, sin apagar el
canal que ya funciona.
