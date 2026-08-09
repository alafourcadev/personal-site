---
title: "El laboratorio que manda el historial entero"
level: 9
role: core
domain: salud
D1: 3
D2: 3
D3: 3
D4: 2
D5: 3
D6: 3
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar qué se le manda al tercero y qué se queda adentro. Un ejercicio sobre cumplimiento se responde con la lista de campos, no con la topología."
lambda: 0.75
constraints:
  - metric: informes de laboratorio impresos y enviados por correo postal al mes
    operator: ">="
    value: 12400
    unit: informes
  - metric: campos del historial que el impresor necesita para imprimir y despachar
    operator: "<="
    value: 4
    unit: campos
hiddenFacts:
  - fact: "el contrato con la imprenta se firmó en 2021 y dice que el proveedor recibe «los datos necesarios para el despacho». Nadie definió nunca cuáles son. Hoy recibe el registro completo, con diagnóstico y antecedentes."
    discoveryPath: "mirá qué componente del diseño está afuera de la organización y seguí para atrás el camino del dato que le llega. Lo que sale por esa conexión es todo lo que el servicio tiene, porque nadie puso nada en el medio que recorte."
  - fact: "el impresor guarda cada archivo recibido 90 días «por si hay que reimprimir». Son 90 días de historiales clínicos completos en una infraestructura que el laboratorio no audita ni puede apagar."
    discoveryPath: "un dato que salió no vuelve. Preguntate qué pasa con lo que mandaste el mes pasado si mañana rescindís el contrato: la transferencia ya ocurrió y tenés que poder justificarla."
  - fact: "el impresor necesita exactamente cuatro campos: nombre, dirección, código del informe y cantidad de hojas. El diagnóstico no se imprime en el sobre."
    discoveryPath: "la restricción del ejercicio lo dice: cuatro campos. Todo lo que viaje además de esos cuatro es exposición que no compra nada."
startingDesign:
  nodes:
    - id: paciente
      type: actor
      label: Paciente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de resultados
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 170 }
    - id: historias
      type: service
      label: Servicio de informes clínicos
      zone: private
      role: historias-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 280 }
    - id: imprenta
      type: external-provider
      label: Imprenta y despacho postal
      zone: dmz
      given: true
      position: { x: 445, y: 400 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 80 }
    - id: baseinformes
      type: database
      label: Base de informes
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 220 }
  edges:
    - id: paciente-portal
      from: { node: paciente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-identidad
      from: { node: gw }
      to: { node: identidad }
      dataClass: secret
    - id: gw-historias
      from: { node: gw }
      to: { node: historias }
      dataClass: regulated
    - id: historias-baseinformes
      from: { node: historias }
      to: { node: baseinformes }
      dataClass: regulated
    - id: historias-imprenta
      from: { node: historias }
      to: { node: imprenta }
      dataClass: regulated
guarantees:
  - id: g-no-direct-export
    label: el servicio que tiene el historial completo no le habla directo al tercero
    weight: 5
    predicate:
      op: edgeAbsent
      from:
        role: historias-service
      to:
        type: [external-provider]
    whyMissing: hay una conexión directa entre el servicio de informes clínicos y un proveedor externo, y por esa conexión sale todo lo que el servicio tiene.
    consequence: "quien puede leer el historial entero es el que decide qué mandar afuera, y lo decide en el mismo lugar donde es más fácil mandar todo. La transferencia ya ocurrió: aunque el proveedor prometa borrarlo, el laboratorio tiene que poder justificar cada campo que salió."
  - id: g-still-delivers
    label: el informe sigue llegando a la imprenta
    weight: 1
    predicate:
      op: path
      from:
        role: historias-service
      to:
        type: [external-provider]
    whyMissing: no hay ningún camino desde el servicio de informes clínicos hasta el proveedor externo de impresión.
    consequence: "12.400 informes al mes dejan de despacharse. Cortar la conexión no es proteger el dato: es dejar de prestar el servicio, y a la semana alguien va a mandar los archivos a mano por correo, sin registro y sin recorte."
  - id: g-door-identity
    label: la entrada al portal comprueba identidad con doble factor
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad con segundo factor obligatorio.
    consequence: un resultado de laboratorio es dato de salud. Si alcanza con adivinar una contraseña para verlo, el resto de los controles son ornamentales.
  - id: g-patient-path
    label: el paciente sigue viendo su resultado por el portal
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: historias-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el portal de resultados hasta el servicio de informes clínicos que pase por una entrada del sistema.
    consequence: el canal que hoy funciona es el más fácil de romper cuando se reordena todo lo demás. Un paciente que no ve su resultado llama al laboratorio, y esa llamada se atiende leyendo el informe en voz alta por teléfono, sin identificar a nadie.
  - id: g-regulated-store
    label: el informe clínico vive en un almacenamiento con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: historias-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio de informes clínicos hasta una base de datos con copia de respaldo declarada.
    consequence: la retención de un dato de salud es una obligación con plazo. Sin copia, el plazo es una intención.
rubric:
  - dimension: el dato regulado no sale directo del lugar donde está completo
    signal:
      kind: predicate
      guaranteeId: g-no-direct-export
  - dimension: el servicio al paciente sigue funcionando después del cambio
    signal:
      kind: predicate
      guaranteeId: g-still-delivers
  - dimension: la entrada al historial exige segundo factor
    signal:
      kind: predicate
      guaranteeId: g-door-identity
  - dimension: endurecer la salida no rompe la entrada
    signal:
      kind: predicate
      guaranteeId: g-patient-path
  - dimension: el dato regulado queda donde se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-regulated-store
referenceSolutions:
  - label: un servicio de despacho que arma el sobre y nada más
    contextInversion: "un componente sincrónico en el medio conviene cuando el despacho tiene que confirmarse en el momento, porque el operador aprieta «enviar» y quiere saber si la imprenta lo aceptó, y cuando el volumen es estable. La pieza intermedia es el único lugar del sistema que conoce los cuatro campos que salen, así que la lista de campos deja de ser una decisión repartida en el código de todos y pasa a ser un archivo que se puede leer en una auditoría. El costo es que si la imprenta se pone lenta, el operador espera."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal de resultados
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: historias
          type: service
          label: Servicio de informes clínicos
          zone: private
          role: historias-service
          props: { criticality: "high", replicas: "2" }
        - id: despacho
          type: service
          label: Servicio de despacho postal
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: imprenta
          type: external-provider
          label: Imprenta y despacho postal
          zone: dmz
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: baseinformes
          type: database
          label: Base de informes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: regulated
        - id: historias-baseinformes
          from: { node: historias }
          to: { node: baseinformes }
          dataClass: regulated
        - id: historias-despacho
          from: { node: historias }
          to: { node: despacho }
          dataClass: personal
        - id: despacho-imprenta
          from: { node: despacho }
          to: { node: imprenta }
          dataClass: personal
  - label: una cola de despachos y un exportador que recorta
    contextInversion: "el camino asincrónico conviene cuando imprimir no es parte de la consulta médica y la imprenta tiene ventanas de corte: los despachos se acumulan, el exportador los toma a su ritmo y reintenta el que la imprenta rechazó, sin que nadie del laboratorio se entere. Además deja el pendiente a la vista: se puede contar cuántos informes quedaron sin despachar. Se paga con dos piezas más para operar y con la aceptación de que el operador no sabe en el momento si el sobre salió."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal de resultados
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: historias
          type: service
          label: Servicio de informes clínicos
          zone: private
          role: historias-service
          props: { criticality: "high", replicas: "2" }
        - id: coladespacho
          type: queue
          label: Cola de despachos pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: exportador
          type: worker
          label: Exportador de despachos
          zone: private
        - id: imprenta
          type: external-provider
          label: Imprenta y despacho postal
          zone: dmz
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: baseinformes
          type: database
          label: Base de informes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-historias
          from: { node: gw }
          to: { node: historias }
          dataClass: regulated
        - id: historias-baseinformes
          from: { node: historias }
          to: { node: baseinformes }
          dataClass: regulated
        - id: historias-coladespacho
          from: { node: historias }
          to: { node: coladespacho }
          dataClass: personal
        - id: coladespacho-exportador
          from: { node: coladespacho }
          to: { node: exportador }
          dataClass: personal
        - id: exportador-imprenta
          from: { node: exportador }
          to: { node: imprenta }
          dataClass: personal
status: PILOT
---

Un laboratorio de análisis clínicos imprime y despacha por correo postal
**12.400 informes al mes**. La impresión y el envío los hace una imprenta
contratada, que no es parte de la organización.

El contrato se firmó en 2021. Dice que la imprenta recibe *«los datos
necesarios para el despacho»*. Nadie definió nunca cuáles son.

Lo que recibe hoy es el registro completo: nombre, dirección, código de
informe, cantidad de hojas, **y también el diagnóstico, los valores y los
antecedentes**. La imprenta necesita cuatro campos. Le llegan todos.

Hay un detalle que en la revisión de riesgos costó una tarde entera de
discusión: la imprenta **guarda cada archivo 90 días** por si hay que
reimprimir. Son noventa días de historiales clínicos completos en una
infraestructura que el laboratorio no audita, no puede apagar y no va a
recuperar si mañana rescinde el contrato. Un dato que salió no vuelve.

El jefe de operaciones se opone a tocar el flujo con un argumento que hay
que tomar en serio: el despacho funciona, no falló nunca, y cualquier pieza
nueva en el medio es una pieza nueva que puede romperse un viernes a la
tarde con 400 informes esperando.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que el servicio que tiene el historial completo
no sea el que le habla al proveedor externo, sin dejar de despachar los
informes.
