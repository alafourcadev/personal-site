---
title: "El expediente que la ventanilla no puede mostrar"
level: 6
role: core
domain: gobierno
D1: 2
D2: 2
D3: 2
D4: 1
D5: 2
D6: 1
D7: 3
D8: 0
D9: 3
prerequisiteLevels: [5]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir qué le contesta el empleado de ventanilla a la persona que tiene enfrente cuando el archivo provincial no responde, y de dónde salió esa respuesta."
lambda: 0.5
constraints:
  - metric: consultas de expediente en la mesa de entradas por día hábil
    operator: ">="
    value: 2400
    unit: consultas/día
  - metric: horas por mes en que el archivo provincial no responde
    operator: ">="
    value: 66
    unit: horas/mes
  - metric: presupuesto operativo del equipo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "el archivo provincial de expedientes se sincroniza con las otras once municipalidades entre las 8 y las 11 de la mañana, y durante esa ventana contesta a cuentagotas o no contesta. Son tres horas por día hábil, unas 66 al mes, siempre en el horario de mesa de entradas."
    discoveryPath: "preguntate cuándo se cae la pieza de la que dependés, no sólo cuánto. Un tercero que se apaga justo en tu horario de atención no es un tercero poco disponible: es un tercero cuya disponibilidad no está alineada con la tuya."
  - fact: "el estado de un expediente cambia, en promedio, dos veces por mes. La persona que viene a la ventanilla quiere saber en qué oficina está y desde cuándo, no el detalle de cada foja."
    discoveryPath: "compará cada cuánto se lee el dato con cada cuánto cambia. Si un expediente se consulta cien veces entre dos cambios de estado, preguntarle al archivo en cada consulta es pagar el peor caso para el caso más raro."
  - fact: "cuando la ventanilla no puede contestar, la persona no se va: se queda, o vuelve al día siguiente. La mesa de entradas mide 2.400 consultas por día hábil y en las mañanas de sincronización la cola llega a 40 minutos."
    discoveryPath: "seguí qué pasa con la persona, no con el pedido. El costo de no contestar no es un error en un tablero: es una fila que se acumula y vuelve mañana."
startingDesign:
  nodes:
    - id: ciudadano
      type: actor
      label: Persona en la mesa de entradas
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: terminal
      type: web-client
      label: Terminal de ventanilla
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: ventanilla
      type: service
      label: Servicio de mesa de entradas
      zone: private
      role: counter-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: archivo
      type: external-provider
      label: Archivo provincial de expedientes
      zone: dmz
      role: provincial-archive
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: ciudadano-terminal
      from: { node: ciudadano }
      to: { node: terminal }
      dataClass: public
    - id: terminal-gw
      from: { node: terminal }
      to: { node: gw }
      dataClass: personal
    - id: gw-ventanilla
      from: { node: gw }
      to: { node: ventanilla }
      dataClass: personal
    - id: ventanilla-archivo
      from: { node: ventanilla }
      to: { node: archivo }
      dataClass: personal
guarantees:
  - id: g-consulta-no-cruza-el-archivo
    label: la consulta de la ventanilla llega hasta un dato propio sin pasar por el archivo provincial
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [database, object-storage]
      forbid:
        role: provincial-archive
    whyMissing: el pedido que entra por la puerta termina siempre en el archivo provincial. No hay ningún camino que llegue a un dato guardado de este lado, así que cuando el archivo no contesta la ventanilla no tiene nada que decir.
    consequence: "entre las 8 y las 11, que es el horario de atención, la terminal muestra un error. La persona no se va: se queda en la fila o vuelve mañana, y la cola de la mesa de entradas llega a 40 minutos."
  - id: g-archivo-sigue-siendo-la-fuente
    label: la copia local se sigue alimentando del archivo provincial
    weight: 2
    predicate:
      op: path
      from:
        type: [service, worker]
      to:
        role: provincial-archive
    whyMissing: ninguna pieza del sistema llega al archivo provincial, así que la copia local no tiene de dónde actualizarse ni con qué contrastarse.
    consequence: un expediente que se movió en otra municipalidad nunca llega. La copia deja de ser una copia y pasa a ser una versión municipal de la verdad, que es justo el problema que el archivo provincial existía para resolver.
  - id: g-ventanilla-lee-la-copia
    label: el servicio de mesa de entradas es el que llega a la copia, no una pieza colgada al costado
    weight: 1
    predicate:
      op: path
      from:
        role: counter-service
      to:
        type: [database, object-storage]
    whyMissing: la copia existe pero el servicio que atiende la ventanilla no llega hasta ella. Quedó al costado del diagrama, alimentándose de algo que nadie consulta.
    consequence: "tener la contingencia y no usarla es peor que no tenerla: el equipo cree que está cubierto, el informe dice que hay copia local, y la terminal se sigue poniendo en rojo todas las mañanas."
rubric:
  - dimension: el camino de emergencia no pasa por la pieza que se cayó
    signal:
      kind: predicate
      guaranteeId: g-consulta-no-cruza-el-archivo
  - dimension: la copia tiene una fuente y no se convierte en un archivo paralelo
    signal:
      kind: predicate
      guaranteeId: g-archivo-sigue-siendo-la-fuente
  - dimension: la copia está en el camino real de la consulta
    signal:
      kind: predicate
      guaranteeId: g-ventanilla-lee-la-copia
referenceSolutions:
  - label: el mismo servicio mantiene y lee la tabla local
    contextInversion: "que el servicio de mesa de entradas escriba y lea su propia tabla es lo correcto cuando la consulta es por número de expediente y por documento, y cuando querés poder buscar, filtrar y auditar quién miró qué con las herramientas que la municipalidad ya tiene. Es la topología con menos piezas y un solo lugar donde mirar cuando algo falla. El costo es que el mismo servicio hace las dos cosas, atender la ventanilla y refrescarse contra el archivo provincial, y una mañana de sincronización lenta se le nota en las dos."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Persona en la mesa de entradas
          zone: public
        - id: terminal
          type: web-client
          label: Terminal de ventanilla
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventanilla
          type: service
          label: Servicio de mesa de entradas
          zone: private
          role: counter-service
          props: { criticality: "high", replicas: "2" }
        - id: tabla
          type: database
          label: Tabla local de estados de expediente
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: external-provider
          label: Archivo provincial de expedientes
          zone: dmz
          role: provincial-archive
      edges:
        - id: ciudadano-terminal
          from: { node: ciudadano }
          to: { node: terminal }
          dataClass: public
        - id: terminal-gw
          from: { node: terminal }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventanilla
          from: { node: gw }
          to: { node: ventanilla }
          dataClass: personal
        - id: ventanilla-tabla
          from: { node: ventanilla }
          to: { node: tabla }
          dataClass: personal
        - id: ventanilla-archivo
          from: { node: ventanilla }
          to: { node: archivo }
          dataClass: personal
  - label: un sincronizador aparte escribe la tabla, la ventanilla sólo lee
    contextInversion: "separar al que refresca del que atiende conviene cuando la sincronización con el archivo provincial es lenta y desprolija, con tres horas de respuestas a cuentagotas, y no querés que compita nunca por los recursos que tienen a una persona esperando enfrente: si el sincronizador se traba, la ventanilla sigue contestando con lo último que hay. Además el servicio de mesa de entradas deja de salir a la red externa, que es una superficie menos. Se paga con una pieza más para operar y con dos dueños sobre la misma tabla, que es una conversación que hay que tener antes y no después."
    design:
      nodes:
        - id: ciudadano
          type: actor
          label: Persona en la mesa de entradas
          zone: public
        - id: terminal
          type: web-client
          label: Terminal de ventanilla
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventanilla
          type: service
          label: Servicio de mesa de entradas
          zone: private
          role: counter-service
          props: { criticality: "high", replicas: "2" }
        - id: tabla
          type: database
          label: Tabla local de estados de expediente
          zone: restricted
          props: { backup: "diario" }
        - id: sincronizador
          type: worker
          label: Sincronizador con el archivo provincial
          zone: private
        - id: archivo
          type: external-provider
          label: Archivo provincial de expedientes
          zone: dmz
          role: provincial-archive
      edges:
        - id: ciudadano-terminal
          from: { node: ciudadano }
          to: { node: terminal }
          dataClass: public
        - id: terminal-gw
          from: { node: terminal }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventanilla
          from: { node: gw }
          to: { node: ventanilla }
          dataClass: personal
        - id: ventanilla-tabla
          from: { node: ventanilla }
          to: { node: tabla }
          dataClass: personal
        - id: sincronizador-tabla
          from: { node: sincronizador }
          to: { node: tabla }
          dataClass: personal
        - id: sincronizador-archivo
          from: { node: sincronizador }
          to: { node: archivo }
          dataClass: personal
status: PILOT
---

Una municipalidad con **2.400 consultas por día hábil** en la mesa de entradas.
La persona llega con su número de expediente, el empleado lo escribe en la
terminal, y el servicio de mesa de entradas le pregunta al archivo provincial en
qué oficina está y desde cuándo.

El archivo provincial se sincroniza con las otras once municipalidades **entre
las 8 y las 11 de la mañana**. En esa ventana contesta a cuentagotas o no
contesta. Son tres horas por día hábil: unas **66 horas por mes**, siempre
dentro del horario de atención.

En esas horas la terminal no muestra un estado viejo. Muestra un error. Y la
persona que tiene el empleado enfrente no se va a su casa: se queda en la fila, o
vuelve mañana. En las mañanas de sincronización la cola llega a **40 minutos**.

Mientras tanto, el estado de un expediente cambia **dos veces por mes**. Entre
dos cambios puede consultarse cien veces, y las cien veces la respuesta es la
misma.

El secretario de gobierno lo puso por escrito en el pedido: *"Prefiero que la
ventanilla diga «está en Obras Particulares desde el martes, dato de ayer a las
19» antes que un cartel rojo. El vecino entiende una fecha; no entiende una
pantalla que no anda."*

El equipo tiene **5 unidades operativas** y hoy usa 2.

**Rearmá el sistema** para que la consulta de la ventanilla pueda resolverse sin
tocar el archivo provincial, para que la copia local se siga alimentando de él
cuando vuelve, y para que sea el servicio que atiende, y no una pieza colgada al
costado, el que la lea.
