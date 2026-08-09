---
title: "Los dos tableros que no vieron nada"
level: 5
role: trap
domain: transporte
D1: 3
D2: 2
D3: 3
D4: 1
D5: 2
D6: 3
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué pieza sacaste y por qué esa y no otra. Una respuesta que sólo suma monitoreo no resolvió este ejercicio: lo empeoró."
lambda: 0.5
constraints:
  - metric: unidades de la flota reportando posición
    operator: ">="
    value: 310
    unit: unidades
  - metric: personas que operan el sistema
    operator: "="
    value: 2
    unit: personas
  - metric: tiempo aceptable entre que la posición deja de actualizarse y el equipo se entera
    operator: "<="
    value: 10
    unit: minutos
hiddenFacts:
  - fact: "el tablero de plataforma lo dejó configurado una consultora que terminó su contrato en 2023. Nadie del equipo tiene acceso de administrador y las alertas van a una casilla de correo que ya no existe."
    discoveryPath: "preguntá quién mira cada tablero y a quién despierta. Un tablero que no despierta a nadie no es monitoreo: es una unidad operativa que el equipo paga para producir una pantalla que nadie abre."
  - fact: "el 4 de mayo el servicio de posiciones se reinició cuatro veces por despliegues normales. Cada reinicio se llevó las posiciones que estaban entre 'recibida' y 'guardada'. Los dos tableros estuvieron en verde las tres horas."
    discoveryPath: "seguí el camino de una posición desde que entra hasta que se guarda y contá en qué punto deja de existir si el proceso se apaga. Los tableros informan lo que pasó; no guardan lo que se estaba haciendo."
  - fact: el equipo ya está usando las seis unidades operativas que tiene. Cualquier pieza que se agregue tiene que entrar en lugar de otra.
    discoveryPath: "sumá lo que hay que mantener despierto hoy y compará con la capacidad declarada. Si el total ya iguala el presupuesto, sumar monitoreo (el gesto que este nivel te enseñó) no cabe, y el ejercicio empieza recién ahí."
startingDesign:
  nodes:
    - id: flota
      type: external-party
      label: Unidades de la flota
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
      role: ingesta
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: posiciones
      type: service
      label: Servicio de posiciones
      zone: private
      role: posiciones
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: baseposiciones
      type: database
      label: Base de posiciones
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
    - id: tableroplataforma
      type: observability
      label: Tablero de plataforma
      zone: private
      given: true
      position: { x: 805, y: 410 }
    - id: tableroops
      type: observability
      label: Tablero de operaciones
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: flota-gw
      from: { node: flota }
      to: { node: gw }
      dataClass: public
    - id: gw-ingesta
      from: { node: gw }
      to: { node: ingesta }
      dataClass: public
    - id: ingesta-posiciones
      from: { node: ingesta }
      to: { node: posiciones }
      dataClass: public
    - id: posiciones-baseposiciones
      from: { node: posiciones }
      to: { node: baseposiciones }
      dataClass: public
    - id: ingesta-tableroplataforma
      from: { node: ingesta }
      to: { node: tableroplataforma }
      dataClass: public
    - id: baseposiciones-tableroops
      from: { node: baseposiciones }
      to: { node: tableroops }
      dataClass: public
guarantees:
  - id: g-signal-exists
    label: el sistema sigue teniendo dónde reportar
    weight: 1
    predicate:
      op: exists
      node:
        type: [observability]
    whyMissing: no quedó ningún componente de monitoreo en el sistema.
    consequence: "ajustar el presupuesto no puede terminar en apagar la señal entera. Un sistema sin ningún lugar donde reportar vuelve al punto de partida: el equipo se entera cuando llama un pasajero."
  - id: g-services-observed
    label: todos los servicios reportan lo que les pasa
    weight: 2
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: "el 4 de mayo el servicio de posiciones no reportaba a ninguno de los dos tableros. Tener dos tableros no hizo que estuviera observado: la cobertura no se cuenta en pantallas, se cuenta en piezas conectadas."
  - id: g-buffer-observed
    label: alguien mira cuánto trabajo se está acumulando
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza donde se acumulan las posiciones pendientes no está conectada a ningún componente de monitoreo.
    consequence: "los mensajes se acumulan hasta llenar la retención y después se descartan. El sistema parece funcionar: nadie ve el error hasta que falta el dato."
  - id: g-position-durable
    label: la posición recibida sobrevive a un reinicio del servicio que la guarda
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: ingesta
      to:
        role: posiciones
    whyMissing: no hay ninguna pieza durable entre la ingesta y el servicio de posiciones. Hoy la posición viaja en el mismo pedido que la recibió, y si el proceso se reinicia en el medio no queda rastro de que había algo por guardar.
    consequence: "el 4 de mayo hubo cuatro despliegues normales y tres horas de huecos en el recorrido de 310 unidades. Ninguno de los dos tableros lo mostró, porque no hubo error: hubo ausencia. Un tablero informa lo que pasó; no guarda lo que se estaba haciendo."
rubric:
  - dimension: el ajuste de presupuesto no termina en apagar la señal
    signal:
      kind: predicate
      guaranteeId: g-signal-exists
  - dimension: la cobertura se cuenta en piezas conectadas, no en pantallas
    signal:
      kind: predicate
      guaranteeId: g-services-observed
  - dimension: la acumulación de trabajo pendiente es visible
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
  - dimension: la posición sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-position-durable
referenceSolutions:
  - label: un solo tablero, y la unidad liberada compra la cola
    contextInversion: "consolidar en un tablero es lo correcto cuando el mismo equipo de dos personas opera todo: una sola pantalla, una sola guardia, y correlacionar un error de la ingesta con uno del servicio de posiciones no cuesta nada porque están juntos. El segundo tablero no compraba una segunda mirada: lo dejó configurado una consultora que ya no está, sus alertas van a una casilla que no existe y ninguna de las dos personas tiene acceso de administrador. Esa unidad se convierte en la cola, que es la única pieza que hace que un reinicio no se lleve la posición. Lo que se pierde es la separación de umbrales: cuando el equipo crezca y la plataforma la opere otra persona, ese tablero va a hacer falta de nuevo."
    design:
      nodes:
        - id: flota
          type: external-party
          label: Unidades de la flota
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ingesta
          type: service
          label: Servicio de ingesta
          zone: private
          role: ingesta
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de posiciones por guardar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: posiciones
          type: service
          label: Servicio de posiciones
          zone: private
          role: posiciones
          props: { criticality: "high", replicas: "2" }
        - id: baseposiciones
          type: database
          label: Base de posiciones
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Tablero de operaciones
          zone: private
      edges:
        - id: flota-gw
          from: { node: flota }
          to: { node: gw }
          dataClass: public
        - id: gw-ingesta
          from: { node: gw }
          to: { node: ingesta }
          dataClass: public
        - id: ingesta-cola
          from: { node: ingesta }
          to: { node: cola }
          dataClass: public
        - id: cola-posiciones
          from: { node: cola }
          to: { node: posiciones }
          dataClass: public
        - id: posiciones-baseposiciones
          from: { node: posiciones }
          to: { node: baseposiciones }
          dataClass: public
        - id: ingesta-monitoreo
          from: { node: ingesta }
          to: { node: monitoreo }
          dataClass: public
        - id: posiciones-monitoreo
          from: { node: posiciones }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: baseposiciones-monitoreo
          from: { node: baseposiciones }
          to: { node: monitoreo }
          dataClass: public
  - label: los dos tableros se quedan, y la unidad sale del almacén
    contextInversion: "conservar los dos tableros es lo correcto si el equipo recupera el acceso de administrador del primero y decide que la plataforma y la operación tienen umbrales distintos: quién despierta a quién es una decisión organizativa, y sostenerla cuesta una unidad. Entonces la unidad tiene que salir de otro lado, y la candidata es el almacén: una posición se escribe una vez, se lee por día y por unidad, y nunca se busca por clave. Eso es un archivo, y un archivo no consume capacidad operativa. Lo que se pierde es la consulta puntual, la de 'dónde estaba la unidad 47 a las 14:12', que ahora obliga a bajar el archivo del día entero."
    design:
      nodes:
        - id: flota
          type: external-party
          label: Unidades de la flota
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ingesta
          type: service
          label: Servicio de ingesta
          zone: private
          role: ingesta
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de posiciones por guardar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: posiciones
          type: service
          label: Servicio de posiciones
          zone: private
          role: posiciones
          props: { criticality: "high", replicas: "2" }
        - id: archivo
          type: object-storage
          label: Archivo de recorridos por día
          zone: private
        - id: tableroplataforma
          type: observability
          label: Tablero de plataforma
          zone: private
        - id: tableroops
          type: observability
          label: Tablero de operaciones
          zone: private
      edges:
        - id: flota-gw
          from: { node: flota }
          to: { node: gw }
          dataClass: public
        - id: gw-ingesta
          from: { node: gw }
          to: { node: ingesta }
          dataClass: public
        - id: ingesta-cola
          from: { node: ingesta }
          to: { node: cola }
          dataClass: public
        - id: cola-posiciones
          from: { node: cola }
          to: { node: posiciones }
          dataClass: public
        - id: posiciones-archivo
          from: { node: posiciones }
          to: { node: archivo }
          dataClass: public
        - id: gw-tableroplataforma
          from: { node: gw }
          to: { node: tableroplataforma }
          dataClass: public
        - id: ingesta-tableroplataforma
          from: { node: ingesta }
          to: { node: tableroplataforma }
          dataClass: public
        - id: cola-tableroplataforma
          from: { node: cola }
          to: { node: tableroplataforma }
          dataClass: public
        - id: posiciones-tableroops
          from: { node: posiciones }
          to: { node: tableroops }
          dataClass: public
status: PILOT
---

Un operador de transporte urbano con **310 unidades** reportando posición
cada quince segundos. Lo operan **dos personas**.

El 4 de mayo, entre las 09:00 y las 12:00, el recorrido de la flota quedó
lleno de huecos. Hubo cuatro despliegues normales del servicio de
posiciones, y cada reinicio se llevó lo que estaba entre "recibida" y
"guardada". Tres horas de datos que no existen.

**Los dos tableros estuvieron en verde las tres horas.**

A esta altura del nivel el reflejo ya está aprendido, y es un buen reflejo:
cuando algo se rompe en silencio, se agrega señal. La reunión del lunes
terminó con la propuesta obvia: un tercer tablero, dedicado al canal de
posiciones. Y esa propuesta es la que este ejercicio te pide que no tomes.

Dos razones, y ninguna es "el monitoreo está mal".

**La primera es de aritmética.** El equipo ya usa **las seis unidades
operativas que tiene**: la puerta de entrada, la ingesta, el servicio de
posiciones, la base, y **dos tableros**. No hay una séptima. Sumar es un
gesto que en este sistema no existe: todo lo que entra, entra en lugar de
otra cosa.

**La segunda es de diagnóstico.** El 4 de mayo no faltó señal: faltó
memoria. La posición viajaba en el mismo pedido que la recibió, así que un
reinicio se la llevaba antes de que hubiera nada que reportar. Un tablero
te cuenta lo que pasó; no guarda lo que se estaba haciendo. Un tercer
tablero habría mostrado los mismos huecos, un poco antes, con la misma
cantidad de datos perdidos.

Y hay algo más, que es la parte incómoda: **el tablero de plataforma lo
dejó configurado una consultora que terminó su contrato en 2023.** Nadie
del equipo tiene acceso de administrador. Las alertas van a una casilla que
ya no existe. Esa pantalla cuesta una unidad operativa todos los meses y no
despierta a nadie. Observar cuesta, y **observar de más es una pieza más
que se puede caer sin que nadie lo note.**

**Rearmá el sistema.** El equipo tiene seis unidades y las seis están
usadas. La posición recibida tiene que sobrevivir a un reinicio, los dos
servicios tienen que reportar de verdad y lo que se acumule tiene que ser
visible. Algo tiene que salir para que eso entre, y la pregunta del
ejercicio es cuál, no "cuánto monitoreo más".
