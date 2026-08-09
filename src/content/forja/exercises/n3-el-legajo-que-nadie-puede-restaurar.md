---
title: "El legajo que nadie puede restaurar"
level: 3
role: core
domain: recursos-humanos
D1: 1
D2: 1
D3: 3
D4: 1
D5: 2
D6: 1
D7: 1
D8: 0
D9: 1
prerequisiteLevels: [2]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar por qué agregar una base nueva al lienzo no resuelve nada por sí solo."
lambda: 0.5
constraints:
  - metric: legajos activos
    operator: ">="
    value: 2400
    unit: legajos
  - metric: años que el legajo debe conservarse por ley
    operator: ">="
    value: 10
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "la base temporal se levantó en una migración de 2023 y quedó como base definitiva. No tiene respaldo configurado: si se pierde, se pierde entera."
    discoveryPath: "dejá el legajo entrando ahí y probá tu respuesta: el motor rechaza el diseño y nombra la base. Un dato con obligación legal de conservarse diez años apoyado en algo que nadie puede restaurar no es un riesgo, es un incumplimiento."
  - fact: "una base que agregás vos al lienzo nace sin respaldo. El respaldo no es una propiedad del motor de base: es una decisión que alguien tomó y configuró en una base concreta."
    discoveryPath: "probá conectar el servicio a una base nueva que agregues vos: la garantía sigue sin cumplirse. La base con respaldo diario ya está en el lienzo, aprovisionada y sin conectar."
  - fact: "el 38 % del peso de un legajo son escaneos: contratos firmados, certificados, altas médicas."
    discoveryPath: "es la razón por la que una de las garantías pide un archivo de objetos además de la base. Un PDF de nueve megas dentro de una fila hace que el respaldo diario de la base tarde cuatro veces más y que restaurarla tarde lo mismo."
startingDesign:
  nodes:
    - id: empleado
      type: actor
      label: Empleado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del empleado
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: legajos
      type: service
      label: Servicio de legajos
      zone: private
      role: hr-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: basetemporal
      type: database
      label: Base temporal de legajos (sin respaldo)
      zone: restricted
      given: true
      props: { backup: "none" }
      position: { x: 805, y: 410 }
    - id: baserespaldada
      type: database
      label: Base de legajos con respaldo diario
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: empleado-portal
      from: { node: empleado }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-legajos
      from: { node: gw }
      to: { node: legajos }
      dataClass: personal
    - id: legajos-basetemporal
      from: { node: legajos }
      to: { node: basetemporal }
      dataClass: regulated
guarantees:
  - id: g-legajo-respaldado
    label: el legajo termina en una base que se puede restaurar
    weight: 2
    predicate:
      op: path
      from:
        role: hr-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde el servicio de legajos hasta una base con respaldo configurado.
    consequence: la obligación legal de conservar diez años se sostiene sobre una copia que nadie puede producir. El día que hay que mostrarle un legajo a un inspector, el sistema no lo tiene y la empresa tampoco.
  - id: g-sin-base-sin-respaldo
    label: ningún legajo se escribe en una base sin respaldo
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: hr-service
      to:
        type: [database]
        propEquals: { backup: "none" }
    whyMissing: el servicio de legajos sigue escribiendo en una base sin respaldo configurado.
    consequence: una base sin respaldo no avisa que no lo tiene. Se comporta igual que la otra todos los días, y se comporta distinto exactamente un día.
  - id: g-escaneos-en-archivo
    label: los escaneos del legajo van a un archivo de objetos, no adentro de la base
    weight: 1
    predicate:
      op: path
      from:
        role: hr-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de legajos hasta un almacenamiento de objetos, así que los contratos y certificados escaneados viven dentro de las filas de la base.
    consequence: el respaldo diario pasa a copiar gigabytes de PDF todas las noches y restaurar deja de ser una operación de minutos. Una base que tarda seis horas en volver es una base que en la práctica no se restaura durante el horario laboral.
rubric:
  - dimension: el dato con obligación legal se apoya en algo que se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-legajo-respaldado
  - dimension: ninguna escritura queda apoyada en una base sin copia
    signal:
      kind: predicate
      guaranteeId: g-sin-base-sin-respaldo
  - dimension: cada clase de contenido vive en el almacenamiento que le corresponde
    signal:
      kind: predicate
      guaranteeId: g-escaneos-en-archivo
referenceSolutions:
  - label: el servicio escribe el legajo y deja el escaneo en el archivo
    contextInversion: "que el propio servicio escriba las dos cosas es lo correcto con este volumen, unos noventa legajos nuevos por mes, porque no agrega ninguna pieza para operar y el legajo y su escaneo quedan escritos en el mismo momento en que el alta es válida. Se paga con la subida del escaneo adentro del pedido del empleado: si el archivo se pone lento, el alta se pone lenta."
    design:
      nodes:
        - id: empleado
          type: actor
          label: Empleado
          zone: public
        - id: portal
          type: web-client
          label: Portal del empleado
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: legajos
          type: service
          label: Servicio de legajos
          zone: private
          role: hr-service
          props: { criticality: "high", replicas: "2" }
        - id: baserespaldada
          type: database
          label: Base de legajos con respaldo diario
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de escaneos
          zone: private
      edges:
        - id: empleado-portal
          from: { node: empleado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-legajos
          from: { node: gw }
          to: { node: legajos }
          dataClass: personal
        - id: legajos-base
          from: { node: legajos }
          to: { node: baserespaldada }
          dataClass: regulated
        - id: legajos-archivo
          from: { node: legajos }
          to: { node: archivo }
          dataClass: regulated
  - label: un trabajo aparte deposita el escaneo
    contextInversion: "sacar la subida del camino del empleado conviene cuando los escaneos son grandes y llegan de a muchos, como en una incorporación de cuarenta personas en un día, y cuando depositar el archivo es un trabajo que a veces falla y hay que reintentar. El alta responde en cuanto la base la aceptó, el trabajo aparte reintenta solo, y el equipo lo puede pausar sin tocar el servicio. Se paga con dos piezas más para operar."
    design:
      nodes:
        - id: empleado
          type: actor
          label: Empleado
          zone: public
        - id: portal
          type: web-client
          label: Portal del empleado
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: legajos
          type: service
          label: Servicio de legajos
          zone: private
          role: hr-service
          props: { criticality: "high", replicas: "2" }
        - id: baserespaldada
          type: database
          label: Base de legajos con respaldo diario
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de escaneos pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: depositador
          type: worker
          label: Depositador de escaneos
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo de escaneos
          zone: private
      edges:
        - id: empleado-portal
          from: { node: empleado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-legajos
          from: { node: gw }
          to: { node: legajos }
          dataClass: personal
        - id: legajos-base
          from: { node: legajos }
          to: { node: baserespaldada }
          dataClass: regulated
        - id: legajos-cola
          from: { node: legajos }
          to: { node: cola }
          dataClass: regulated
        - id: cola-depositador
          from: { node: cola }
          to: { node: depositador }
          dataClass: regulated
        - id: depositador-archivo
          from: { node: depositador }
          to: { node: archivo }
          dataClass: regulated
status: DRAFT
---

Una empresa con **2.400 legajos activos**. El legajo tiene el contrato
firmado, los certificados de estudio, las altas médicas y el historial de
sanciones. Por ley hay que conservarlo **diez años** después de que la
persona se va.

Todo eso se escribe hoy en una base que se llama, literalmente, *base
temporal*. La levantaron durante una migración en 2023 para que el sistema
volviera a andar el mismo día. Quedó.

Nadie le configuró respaldo. Hace dos años y medio que funciona perfecto,
que es exactamente lo que hace una base sin respaldo todos los días menos
uno.

En marzo el equipo aprovisionó una segunda base, con respaldo diario y con
la restauración probada dos veces. Está aprovisionada, está paga y **no está
conectada a nada**. La migración quedó en la lista de pendientes debajo de
cosas más urgentes durante cinco meses.

Hay un detalle más: **el 38 % del peso de un legajo son escaneos**. Contratos
en PDF de nueve megas, certificados fotografiados. Están adentro de la base,
en las mismas filas que el nombre y el número de documento.

El equipo tiene **6 unidades operativas**.

**Rearmá el sistema** para que el legajo termine en un lugar que alguien pueda
restaurar de verdad, para que ninguna escritura quede apoyada en una base sin
copia, y para que los escaneos dejen de hacer del respaldo diario una
operación de seis horas.
