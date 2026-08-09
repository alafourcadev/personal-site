---
title: "La alarma y el expediente no van por el mismo caño"
level: 12
role: core
domain: energia
D1: 3
D2: 4
D3: 3
D4: 3
D5: 3
D6: 4
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 6
aiBudget: "libre. Advertencia honesta: pedirle a un modelo 'la mejor arquitectura' acá devuelve una sola tubería para las dos cosas, porque es la respuesta más frecuente en el mundo. Es también la que produjo el incidente que vas a leer abajo."
lambda: 4.0
constraints:
  - metric: tiempo entre que un alimentador se dispara y suena el teléfono de la guardia
    operator: "<="
    value: 90
    unit: segundos
  - metric: plazo del regulador para el informe con las mediciones del corte
    operator: "<="
    value: 15
    unit: minutos
  - metric: mediciones que llegan por minuto desde la red de medidores
    operator: ">="
    value: 220000
    unit: mediciones/minuto
  - metric: presupuesto operativo de la sala de control
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "en el corte del 11 de julio la alarma existió y llegó tarde: había quedado detrás de 3,2 millones de mediciones en el mismo caño que se usa para el informe del regulador. La sala se enteró por un llamado de la municipalidad."
    discoveryPath: "mandá la alarma por el mismo camino que las mediciones y leé la garantía que queda sin cumplir: pide explícitamente que el aviso no atraviese nada que se pueda llenar."
  - fact: "el director de operaciones prohibió por escrito 'las colas' después de ese corte. La prohibición es correcta para la alarma y ruinosa para el informe: 220.000 mediciones por minuto escritas en línea son un servicio de red caído por una razón que no tiene que ver con la red."
    discoveryPath: "las dos garantías del ejercicio se contradicen en la superficie: una prohíbe el intermediario y la otra lo exige. No se contradicen si son dos caminos distintos, y ese es el diseño que tenés que poder defender."
  - fact: "el archivo de evidencia existe hace un año y está vacío. Se creó para la auditoría anterior y nadie escribió nunca en él."
    discoveryPath: "está en el lienzo desde el principio, sin ninguna conexión entrante. Un destino que nadie usa no prueba nada."
startingDesign:
  nodes:
    - id: operador
      type: actor
      label: Operador de sala
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tablero
      type: web-client
      label: Tablero de sala de control
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: scada
      type: service
      label: Servicio de supervisión de red
      zone: private
      role: scada-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: mediciones
      type: database
      label: Base de mediciones
      zone: restricted
      role: readings
      given: true
      props: { backup: "cada hora", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: evidencia
      type: object-storage
      label: Archivo de evidencia regulatoria
      zone: private
      role: evidence-archive
      given: true
      props: { durability: "99.999999999", access: "signed" }
      position: { x: 805, y: 520 }
  edges:
    - id: operador-tablero
      from: { node: operador }
      to: { node: tablero }
      dataClass: public
    - id: tablero-gw
      from: { node: tablero }
      to: { node: gw }
      dataClass: public
    - id: gw-scada
      from: { node: gw }
      to: { node: scada }
      dataClass: public
    - id: scada-mediciones
      from: { node: scada }
      to: { node: mediciones }
      dataClass: regulated
guarantees:
  - id: g-alarm-direct
    label: la alarma llega al monitoreo sin atravesar nada que se pueda llenar
    weight: 3
    predicate:
      op: path
      from:
        role: scada-service
      to:
        type: [observability]
      forbid:
        type: [queue, stream, database, object-storage]
    whyMissing: no hay un camino desde el servicio de supervisión hasta un componente de monitoreo que no pase por una cola, un registro de eventos, una base o un archivo.
    consequence: "el 11 de julio la alarma se generó y quedó detrás de 3,2 millones de mediciones en el mismo caño. Llegó al tablero cuando la cuadrilla ya estaba en la calle porque llamó la municipalidad. Un aviso que comparte camino con lo que estás vigilando llega justo cuando ya no sirve."
  - id: g-trail-buffered
    label: las mediciones llegan al archivo de evidencia pasando por un intermediario que absorbe el volumen
    weight: 2
    predicate:
      op: path
      from:
        role: scada-service
      to:
        role: evidence-archive
      via:
        type: [queue, stream]
    whyMissing: no hay un camino desde el servicio de supervisión hasta el archivo de evidencia que pase por una cola o por un registro de eventos.
    consequence: "220.000 mediciones por minuto escritas en línea desde el servicio de supervisión ponen el almacenamiento en el camino crítico de la red eléctrica. Un pico de escritura del archivo se convierte en un servicio de supervisión lento, y un servicio de supervisión lento es una sala de control que ve el estado de la red con retraso."
  - id: g-buffer-observed
    label: alguien mira cuánto se acumula en ese intermediario
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza que absorbe el volumen de mediciones no está conectada a ningún componente de monitoreo.
    consequence: "los mensajes se acumulan hasta llenar la retención y después se descartan. El sistema parece funcionar: nadie ve el error hasta que el regulador pide las mediciones de un corte y faltan las de la hora exacta."
rubric:
  - dimension: el aviso no depende de la pieza que se tapa cuando el sistema se degrada
    signal:
      kind: predicate
      guaranteeId: g-alarm-direct
  - dimension: el volumen regulatorio no está en el camino crítico de la red
    signal:
      kind: predicate
      guaranteeId: g-trail-buffered
  - dimension: la acumulación es visible antes de que la retención la borre
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
  - dimension: el diseño entra en el presupuesto operativo de la sala
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: cola y archivador de fondo
    contextInversion: "la cola con un archivador de fondo se defiende cuando el único consumidor de la medición es el archivo: la cola entrega, el archivador escribe, el mensaje se va, y no hay nadie más que quiera leerlo. Es la topología más barata de operar que corta la dependencia entre la red eléctrica y el almacenamiento, y con seis unidades exactas eso importa. Al director de operaciones le decís que su prohibición se respeta donde vale, porque la alarma no toca ninguna cola, y que el informe del regulador sí va por una, porque el problema del 11 de julio no fue la cola: fue haber puesto las dos cosas en la misma. Lo que aceptás a cambio: si mañana alguien quiere leer las mismas mediciones para otra cosa, no puede sin coordinarse con este archivador."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de sala
          zone: public
        - id: tablero
          type: web-client
          label: Tablero de sala de control
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: scada
          type: service
          label: Servicio de supervisión de red
          zone: private
          role: scada-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: mediciones
          type: database
          label: Base de mediciones
          zone: restricted
          role: readings
          props: { backup: "cada hora", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de mediciones a archivar
          zone: private
          props: { delivery: "at-least-once", dlq: "no", ordering: "no" }
        - id: archivador
          type: worker
          label: Archivador de mediciones
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: evidencia
          type: object-storage
          label: Archivo de evidencia regulatoria
          zone: private
          role: evidence-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: operador-tablero
          from: { node: operador }
          to: { node: tablero }
          dataClass: public
        - id: tablero-gw
          from: { node: tablero }
          to: { node: gw }
          dataClass: public
        - id: gw-scada
          from: { node: gw }
          to: { node: scada }
          dataClass: public
        - id: scada-mediciones
          from: { node: scada }
          to: { node: mediciones }
          dataClass: regulated
        - id: scada-monitoreo
          from: { node: scada }
          to: { node: monitoreo }
          dataClass: public
        - id: scada-cola
          from: { node: scada }
          to: { node: cola }
          dataClass: regulated
        - id: cola-archivador
          from: { node: cola }
          to: { node: archivador }
          dataClass: regulated
        - id: archivador-evidencia
          from: { node: archivador }
          to: { node: evidencia }
          dataClass: regulated
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: registro releíble y servicio de evidencia
    contextInversion: "el registro releíble con un servicio de evidencia se defiende cuando el formato del informe todavía no está cerrado: el regulador cambió las columnas pedidas dos veces en tres años, y con un registro que se puede volver a leer, rehacer el informe del mes pasado es reprocesar una ventana, no explicar por qué no se puede. Que el consumidor sea un servicio y no un proceso de fondo agrega algo concreto: el auditor consulta el archivo por su cuenta y deja de pedirle exportaciones al equipo. Lo que aceptás a cambio: un registro releíble guarda todo durante su retención, incluidas mediciones que ya no querés, y esa retención es una decisión que alguien va a tener que defender ante el área legal."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de sala
          zone: public
        - id: tablero
          type: web-client
          label: Tablero de sala de control
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: scada
          type: service
          label: Servicio de supervisión de red
          zone: private
          role: scada-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: mediciones
          type: database
          label: Base de mediciones
          zone: restricted
          role: readings
          props: { backup: "cada hora", consistency: "strong" }
        - id: registro
          type: stream
          label: Registro de mediciones
          zone: private
          props: { retention: "7d", partitions: "24", ordering: "sí" }
        - id: evidenciaSvc
          type: service
          label: Servicio de evidencia regulatoria
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: evidencia
          type: object-storage
          label: Archivo de evidencia regulatoria
          zone: private
          role: evidence-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: operador-tablero
          from: { node: operador }
          to: { node: tablero }
          dataClass: public
        - id: tablero-gw
          from: { node: tablero }
          to: { node: gw }
          dataClass: public
        - id: gw-scada
          from: { node: gw }
          to: { node: scada }
          dataClass: public
        - id: scada-mediciones
          from: { node: scada }
          to: { node: mediciones }
          dataClass: regulated
        - id: scada-monitoreo
          from: { node: scada }
          to: { node: monitoreo }
          dataClass: public
        - id: scada-registro
          from: { node: scada }
          to: { node: registro }
          dataClass: regulated
        - id: registro-evidenciaSvc
          from: { node: registro }
          to: { node: evidenciaSvc }
          dataClass: regulated
        - id: evidenciaSvc-evidencia
          from: { node: evidenciaSvc }
          to: { node: evidencia }
          dataClass: regulated
        - id: registro-monitoreo
          from: { node: registro }
          to: { node: monitoreo }
          dataClass: public
        - id: evidenciaSvc-monitoreo
          from: { node: evidenciaSvc }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una distribuidora eléctrica. La red manda **220.000 mediciones por minuto**
desde los medidores, y el servicio de supervisión las escribe en la base.
Cuando un alimentador se dispara, el acuerdo con la sala de control es de
**90 segundos** hasta que suena el teléfono de la guardia. El regulador,
por su lado, pide el informe con las mediciones del corte en **15 minutos**
y ese informe tiene que salir del archivo de evidencia.

El 11 de julio se cortó el suministro de un barrio entero durante dos horas
y cuarenta minutos. La alarma **existió**: se generó a las 19:04. Lo que
pasó es que viajaba por el mismo caño que las mediciones, y a esa hora
había **3,2 millones de mediciones** delante. La sala se enteró a las 19:31
por un llamado de la municipalidad.

Después de ese corte el director de operaciones prohibió las colas por
escrito. Su frase, textual, fue: *"nada se pone en el medio del aviso"*.

Tiene razón, y su regla aplicada a todo el sistema es ruinosa. 220.000
mediciones por minuto escritas en línea desde el servicio de supervisión
ponen el almacenamiento en el camino crítico de la red eléctrica: un pico
de escritura del archivo se convierte en una sala de control que ve el
estado de la red con retraso.

Las dos exigencias se contradicen sólo si asumís **un caño**. Con dos
caminos distintos no se contradicen, y esa es la conversación que vas a
tener que sostener con él: no le estás llevando la contra, le estás
diciendo dónde termina su regla.

El archivo de evidencia, por cierto, existe hace un año y **está vacío**.
La sala de control sostiene **seis piezas** y ni una más.

**Armá el sistema** para que la alarma llegue al monitoreo sin atravesar
nada que se pueda llenar, para que las mediciones lleguen al archivo de
evidencia pasando por un intermediario que absorba el volumen, y para que
alguien vea cuánto se acumula en ese intermediario.
