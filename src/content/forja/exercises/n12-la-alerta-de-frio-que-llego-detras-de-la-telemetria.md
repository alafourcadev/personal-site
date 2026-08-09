---
title: "La alerta de frío que llegó detrás de la telemetría"
level: 12
role: core
domain: logistica
D1: 3
D2: 4
D3: 3
D4: 2
D5: 4
D6: 4
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 6
aiBudget: "libre para el diseño. La conversación con calidad no: si no podés explicar con tus palabras por qué un solo canal auditable es peor auditoría que dos canales, vas a perder la reunión aunque tu diagrama esté bien."
lambda: 4.0
constraints:
  - metric: tiempo entre que un equipo de frío falla y el jefe de tráfico lo ve
    operator: "<="
    value: 4
    unit: minutos
  - metric: lecturas de temperatura que llegan por minuto desde la flota
    operator: ">="
    value: 28800
    unit: lecturas/minuto
  - metric: retención de la curva de temperatura que exige el organismo sanitario
    operator: ">="
    value: 24
    unit: meses
  - metric: presupuesto operativo del equipo de tráfico
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el 3 de marzo se perdieron dos pallets de vacunas por 41.000 dólares. El equipo de frío del camión falló a las 02:14 y la alerta apareció en el tablero a las 02:47, cuando la carga ya estaba fuera de rango. La alerta no se perdió: estaba encolada detrás de la telemetría de la madrugada."
    discoveryPath: "mandá el aviso por el mismo camino que las lecturas y leé la regla que queda sin cumplir: pide que el aviso llegue sin atravesar nada que se pueda llenar."
  - fact: "el responsable de calidad exige un único canal porque su norma dice que la trazabilidad tiene que ser completa. Su lectura es que si la alerta no viaja por el canal auditado, la alerta no existe para el auditor."
    discoveryPath: "las dos reglas del ejercicio se contradicen si asumís un solo camino, y dejan de contradecirse con dos. Que el aviso salga por otro lado no lo saca del registro: el registro lo escribe el mismo evento por el otro camino."
  - fact: "el archivo de trazabilidad ya existe y está a la mitad: guarda los envíos internacionales, que son el 6 % del volumen, y nadie escribió nunca los nacionales."
    discoveryPath: "está en el lienzo desde el principio y no le entra ninguna conexión desde el servicio de cadena de frío. Un destino que recibe el 6 % de lo que tiene que probar no prueba nada."
startingDesign:
  nodes:
    - id: trafico
      type: actor
      label: Jefe de tráfico
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tablero
      type: web-client
      label: Tablero de flota
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      props: { authn: "sí", rateLimit: "sí" }
      position: { x: 445, y: 190 }
    - id: frio
      type: service
      label: Servicio de cadena de frío
      zone: private
      role: cold-chain-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: envios
      type: database
      label: Base de envíos
      zone: restricted
      role: shipment-record
      given: true
      props: { backup: "cada hora", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: trazabilidad
      type: object-storage
      label: Archivo de trazabilidad
      zone: private
      role: traceability-archive
      given: true
      props: { durability: "99.999999999", access: "signed" }
      position: { x: 805, y: 520 }
  edges:
    - id: trafico-tablero
      from: { node: trafico }
      to: { node: tablero }
      dataClass: public
    - id: tablero-gw
      from: { node: tablero }
      to: { node: gw }
      dataClass: public
    - id: gw-frio
      from: { node: gw }
      to: { node: frio }
      dataClass: public
    - id: frio-envios
      from: { node: frio }
      to: { node: envios }
      dataClass: regulated
guarantees:
  - id: g-alert-direct
    label: el aviso de temperatura llega al monitoreo sin atravesar nada que se pueda llenar
    weight: 3
    predicate:
      op: path
      from:
        role: cold-chain-service
      to:
        type: [observability]
      forbid:
        type: [queue, stream, database, object-storage]
    whyMissing: no hay un camino desde el servicio de cadena de frío hasta un componente de monitoreo que no pase por una cola, un registro de eventos, una base o un archivo.
    consequence: "el 3 de marzo el aviso se generó a las 02:14 y apareció a las 02:47, detrás de la telemetría de la madrugada. Cuarenta y un mil dólares de vacunas se perdieron con el aviso escrito y guardado. Un aviso que comparte camino con lo que estás vigilando llega tarde exactamente el día que hay mucho que vigilar."
  - id: g-trace-buffered
    label: las lecturas llegan al archivo de trazabilidad pasando por un intermediario que absorbe el volumen
    weight: 2
    predicate:
      op: path
      from:
        role: cold-chain-service
      to:
        role: traceability-archive
      via:
        type: [queue, stream]
    whyMissing: no hay un camino desde el servicio de cadena de frío hasta el archivo de trazabilidad que pase por una cola o por un registro de eventos.
    consequence: "28.800 lecturas por minuto escritas en línea ponen el almacenamiento en el camino crítico de la flota. Un pico de escritura del archivo se convierte en un servicio de cadena de frío lento, y un servicio lento es un tablero que muestra la temperatura de hace diez minutos."
  - id: g-buffer-observed
    label: alguien mira cuánto se acumula en ese intermediario
    weight: 1
    predicate:
      op: covered
      target:
        type: [queue, stream]
      by:
        type: [observability]
    whyMissing: la pieza que absorbe el volumen de lecturas no está conectada a ningún componente de monitoreo.
    consequence: "los mensajes se acumulan hasta llenar la retención y después se descartan. El sistema parece funcionar: nadie ve el error hasta que el organismo pide la curva completa de un envío y falta la franja de las horas pico."
rubric:
  - dimension: el aviso no depende de la pieza que se tapa cuando el sistema se satura
    signal:
      kind: predicate
      guaranteeId: g-alert-direct
  - dimension: el volumen de la trazabilidad no está en el camino crítico de la flota
    signal:
      kind: predicate
      guaranteeId: g-trace-buffered
  - dimension: la acumulación es visible antes de que la retención la borre
    signal:
      kind: predicate
      guaranteeId: g-buffer-observed
  - dimension: el diseño entra en el presupuesto operativo del equipo de tráfico
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: registro releíble y archivador de fondo
    contextInversion: "el registro releíble se defiende cuando la definición del informe todavía se está discutiendo: el organismo cambió el intervalo de muestreo exigido el año pasado y va a volver a cambiarlo cuando entre la norma nueva. Con un registro que se puede volver a leer, rehacer la trazabilidad de un mes es reprocesar una ventana; sin él, es escribirle al organismo que ese mes no se puede reconstruir. Al responsable de calidad le mostrás que el evento de temperatura entra al registro igual que hoy, así que su trazabilidad no pierde una sola lectura, y que lo único que sale por otro lado es el aviso, que no es un dato de trazabilidad sino una interrupción a una persona. Lo que aceptás a cambio: el registro guarda todo durante su retención, incluida la telemetría de camiones que ya no operás, y esa retención va a tener que defenderla alguien delante del área legal."
    design:
      nodes:
        - id: trafico
          type: actor
          label: Jefe de tráfico
          zone: public
        - id: tablero
          type: web-client
          label: Tablero de flota
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: frio
          type: service
          label: Servicio de cadena de frío
          zone: private
          role: cold-chain-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: envios
          type: database
          label: Base de envíos
          zone: restricted
          role: shipment-record
          props: { backup: "cada hora", consistency: "strong" }
        - id: registro
          type: stream
          label: Registro de lecturas
          zone: private
          props: { retention: "14d", partitions: "32", ordering: "sí" }
        - id: archivador
          type: worker
          label: Archivador de lecturas
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: trazabilidad
          type: object-storage
          label: Archivo de trazabilidad
          zone: private
          role: traceability-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: trafico-tablero
          from: { node: trafico }
          to: { node: tablero }
          dataClass: public
        - id: tablero-gw
          from: { node: tablero }
          to: { node: gw }
          dataClass: public
        - id: gw-frio
          from: { node: gw }
          to: { node: frio }
          dataClass: public
        - id: frio-envios
          from: { node: frio }
          to: { node: envios }
          dataClass: regulated
        - id: frio-monitoreo
          from: { node: frio }
          to: { node: monitoreo }
          dataClass: public
        - id: frio-registro
          from: { node: frio }
          to: { node: registro }
          dataClass: regulated
        - id: registro-archivador
          from: { node: registro }
          to: { node: archivador }
          dataClass: regulated
        - id: archivador-trazabilidad
          from: { node: archivador }
          to: { node: trazabilidad }
          dataClass: regulated
        - id: registro-monitoreo
          from: { node: registro }
          to: { node: monitoreo }
          dataClass: public
  - label: cola y servicio de trazabilidad consultable
    contextInversion: "la cola con un servicio de trazabilidad se defiende cuando el que consulta es alguien de afuera: el organismo sanitario audita cuatro veces al año y hoy cada auditoría son once días de un analista exportando datos a mano. Un servicio que sirve la curva de un envío convierte eso en una consulta, y de paso el responsable de calidad deja de depender del equipo de tráfico para responderle a su auditor, que es lo que realmente le duele de esta discusión. Lo que aceptás a cambio: una cola entrega el mensaje una vez y se lo olvida, así que si mañana aparece un segundo consumidor, y el equipo de mantenimiento predictivo ya lo pidió, hay que rediseñar esta parte, no agregarle un lector."
    design:
      nodes:
        - id: trafico
          type: actor
          label: Jefe de tráfico
          zone: public
        - id: tablero
          type: web-client
          label: Tablero de flota
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: frio
          type: service
          label: Servicio de cadena de frío
          zone: private
          role: cold-chain-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: envios
          type: database
          label: Base de envíos
          zone: restricted
          role: shipment-record
          props: { backup: "cada hora", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de lecturas a archivar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí", ordering: "no" }
        - id: trazaSvc
          type: service
          label: Servicio de trazabilidad
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: trazabilidad
          type: object-storage
          label: Archivo de trazabilidad
          zone: private
          role: traceability-archive
          props: { durability: "99.999999999", access: "signed" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: trafico-tablero
          from: { node: trafico }
          to: { node: tablero }
          dataClass: public
        - id: tablero-gw
          from: { node: tablero }
          to: { node: gw }
          dataClass: public
        - id: gw-frio
          from: { node: gw }
          to: { node: frio }
          dataClass: public
        - id: frio-envios
          from: { node: frio }
          to: { node: envios }
          dataClass: regulated
        - id: frio-monitoreo
          from: { node: frio }
          to: { node: monitoreo }
          dataClass: public
        - id: frio-cola
          from: { node: frio }
          to: { node: cola }
          dataClass: regulated
        - id: cola-trazaSvc
          from: { node: cola }
          to: { node: trazaSvc }
          dataClass: regulated
        - id: trazaSvc-trazabilidad
          from: { node: trazaSvc }
          to: { node: trazabilidad }
          dataClass: regulated
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: trazaSvc-monitoreo
          from: { node: trazaSvc }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Un operador logístico de cadena de frío. **400 camiones**, seis sensores por
camión, una lectura cada cinco segundos: **28.800 lecturas por minuto** que
entran al servicio de cadena de frío y terminan en la base de envíos.

Hay dos compromisos escritos y los dos son reales. El primero es con el
cliente: cuando un equipo de frío falla, el jefe de tráfico tiene que verlo
en **4 minutos**, porque a partir de ahí hay dieciocho minutos hasta que la
carga sale de rango. El segundo es con el organismo sanitario: la curva
completa de temperatura de cada envío, conservada **24 meses**, y esa curva
sale del archivo de trazabilidad.

El 3 de marzo se perdieron dos pallets de vacunas: **41.000 dólares**. El
equipo de frío falló a las 02:14. El aviso apareció en el tablero a las
02:47. No se perdió, no se cayó nada, nadie se equivocó de umbral: el aviso
viajaba por el mismo camino que la telemetría de la madrugada y llegó cuando
le tocó.

El responsable de calidad leyó el informe del incidente y sacó la conclusión
contraria a la tuya. Su norma dice que la trazabilidad tiene que ser
completa, y su lectura es que **si el aviso no viaja por el canal auditado,
el aviso no existe para el auditor**. Quiere un único canal, y quiere que
esté escrito.

Su norma es correcta y su conclusión no se sigue de ella. El evento entra al
registro igual: lo que se separa es la interrupción a una persona, que no es
un dato de trazabilidad. Esa es la frase que vas a tener que sostener en una
reunión donde él tiene la norma impresa y vos tenés un diagrama.

El archivo de trazabilidad, por cierto, ya existe y guarda el **6 %** de lo
que debería: sólo los envíos internacionales. El equipo de tráfico sostiene
**seis piezas**.

**Armá el sistema** para que el aviso de temperatura llegue al monitoreo sin
atravesar nada que se pueda llenar, para que las lecturas lleguen al archivo
de trazabilidad pasando por un intermediario que absorba el volumen, y para
que alguien vea cuánto se acumula en ese intermediario.
