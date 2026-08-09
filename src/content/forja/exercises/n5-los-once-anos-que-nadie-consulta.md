---
title: "Los once años que nadie consulta"
level: 5
role: tradeoff
domain: banca
tradeoffPairId: operacion-donde-vive-la-historia
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 3
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [4]
budget:
  opsUnits: 6
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá la base de historia se apaga, y por qué apagarla sería un error en el ejercicio hermano."
lambda: 0.5
constraints:
  - metric: pedidos de historia previa al año en curso, por año
    operator: "<="
    value: 40
    unit: pedidos/año
  - metric: años que la ley exige conservar cada movimiento
    operator: ">="
    value: 11
    unit: años
hiddenFacts:
  - fact: "los 40 pedidos del año pasado fueron todos de la misma forma: un oficio judicial pide todos los movimientos de una cuenta entre dos fechas y se entrega el lote completo. Ninguno pidió un movimiento suelto ni cruzó cuentas."
    discoveryPath: "mirá la forma de la pregunta, no el tamaño del dato. Una pregunta que siempre pide el lote entero se responde con una entrega. Una pregunta que filtra, ordena y cruza necesita un almacén que sepa buscar. Y eso es lo que este negocio no tiene."
  - fact: "la base de historia consume una unidad operativa entera del equipo: dos parches de seguridad por trimestre, una restauración de prueba por semestre y el 40 % del volumen total de copias nocturnas. Todo eso para responder cuarenta veces por año."
    discoveryPath: "dividí lo que una pieza cuesta por lo que se usa. Un almacén que el equipo mantiene 365 días para contestar 40 preguntas es la peor relación del sistema, y la unidad que libera es exactamente la que falta para todo lo demás."
startingDesign:
  nodes:
    - id: socio
      type: actor
      label: Socio
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App del socio
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: movimientos
      type: service
      label: Servicio de movimientos
      zone: private
      role: movimientos
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: basemovimientos
      type: database
      label: Base del ejercicio en curso
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: historial
      type: database
      label: Base de historia
      zone: restricted
      role: historial
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: socio-app
      from: { node: socio }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-movimientos
      from: { node: gw }
      to: { node: movimientos }
      dataClass: personal
    - id: movimientos-basemovimientos
      from: { node: movimientos }
      to: { node: basemovimientos }
      dataClass: personal
    - id: movimientos-historial
      from: { node: movimientos }
      to: { node: historial }
      dataClass: personal
guarantees:
  - id: g-cold-archive
    label: los once años quedan guardados en un archivo que el equipo no opera
    weight: 2
    predicate:
      op: path
      from:
        role: movimientos
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de movimientos hasta un almacenamiento de objetos, así que la historia no tiene dónde ir cuando la base que la sostenía se apague.
    consequence: "la ley pide once años y el negocio no tiene dónde ponerlos. Apagar la base de historia sin un archivo detrás no ahorra una unidad operativa: destruye la obligación legal que justifica todo el sistema."
  - id: g-no-warm-history
    label: la historia deja de vivir en un almacén que el equipo mantiene todos los días
    weight: 2
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [database]
            role: historial
    whyMissing: la base de historia sigue en pie, así que el equipo sigue pagándole dos parches por trimestre, una restauración de prueba por semestre y el 40 % del volumen de copias nocturnas.
    consequence: "la unidad operativa que consume esa base es la única que el equipo tiene libre. Mientras siga encendida, cualquier cosa que haga falta agregar el año que viene entra sobre un presupuesto que ya está lleno, y un sistema que el equipo no puede sostener se degrada solo."
  - id: g-operational-store
    label: el ejercicio en curso sigue viviendo en un almacén que se consulta
    weight: 1
    predicate:
      op: path
      from:
        role: movimientos
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de movimientos hasta una base de datos.
    consequence: el saldo de hoy, el débito de ayer y el movimiento de esta mañana se piden por cuenta y por fecha, miles de veces por día. Un archivo devuelve un lote entero cuando ya sabés cuál querés; no sostiene la app del socio. Bajar todo a archivo no es ahorrar, es apagar el producto.
  - id: g-store-observed
    label: el almacén que queda reporta su estado
    weight: 1
    predicate:
      op: covered
      target:
        type: [database]
      by:
        type: [observability]
    whyMissing: hay al menos una base de datos que no está conectada a ningún componente de monitoreo.
    consequence: quedarse con una sola base concentra todo el riesgo en ella. Un disco que se llena o una copia nocturna que falló en silencio son cosas que la base sabe y nadie más, y se descubren el día que hay que restaurar.
rubric:
  - dimension: los once años existen en algún lado que no cuesta capacidad operativa
    signal:
      kind: predicate
      guaranteeId: g-cold-archive
  - dimension: el almacén que se usa cuarenta veces por año deja de mantenerse trescientos sesenta y cinco
    signal:
      kind: predicate
      guaranteeId: g-no-warm-history
  - dimension: lo que se consulta todos los días sigue en un almacén que sabe buscar
    signal:
      kind: predicate
      guaranteeId: g-operational-store
  - dimension: la pieza en la que quedó concentrado el riesgo es la que más se mira
    signal:
      kind: predicate
      guaranteeId: g-store-observed
referenceSolutions:
  - label: el propio servicio deja el lote en el archivo
    contextInversion: "que el servicio de movimientos escriba el archivo es lo correcto cuando el cierre es un trabajo mensual, ordenado y que ya corre dentro de ese servicio: se agrega un destino más al cierre que ya existía, cero piezas nuevas que operar, y quedan dos unidades de margen para lo que venga. El costo es que la escritura del archivo queda dentro del proceso de cierre: si el almacenamiento se pone lento esa noche, el cierre se pone lento con él, y un cierre que no termina antes de la apertura es un problema de mostrador."
    design:
      nodes:
        - id: socio
          type: actor
          label: Socio
          zone: public
        - id: app
          type: mobile-client
          label: App del socio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: movimientos
          type: service
          label: Servicio de movimientos
          zone: private
          role: movimientos
          props: { criticality: "high", replicas: "2" }
        - id: basemovimientos
          type: database
          label: Base del ejercicio en curso
          zone: restricted
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de once años
          zone: private
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: socio-app
          from: { node: socio }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-movimientos
          from: { node: gw }
          to: { node: movimientos }
          dataClass: personal
        - id: movimientos-basemovimientos
          from: { node: movimientos }
          to: { node: basemovimientos }
          dataClass: personal
        - id: movimientos-archivo
          from: { node: movimientos }
          to: { node: archivo }
          dataClass: personal
        - id: movimientos-monitoreo
          from: { node: movimientos }
          to: { node: monitoreo }
          dataClass: public
        - id: basemovimientos-monitoreo
          from: { node: basemovimientos }
          to: { node: monitoreo }
          dataClass: public
  - label: una cola y un exportador que puede reintentar
    contextInversion: "un exportador aparte conviene cuando el volcado de once años no puede robarle tiempo al cierre y cuando exportar es un trabajo que a veces falla a la mitad y hay que retomarlo: la cola guarda lo que quedó pendiente, el exportador reintenta sin que el cierre se entere, y el equipo puede pausarlo un martes a la tarde sin tocar el servicio que atiende al socio. Se paga con dos unidades operativas más, que es exactamente la que se acaba de liberar más el margen entero: el equipo termina en el mismo lugar donde empezó, pero con la historia fuera del camino crítico en vez de adentro."
    design:
      nodes:
        - id: socio
          type: actor
          label: Socio
          zone: public
        - id: portal
          type: web-client
          label: Portal del socio
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: movimientos
          type: service
          label: Servicio de movimientos
          zone: private
          role: movimientos
          props: { criticality: "high", replicas: "2" }
        - id: basemovimientos
          type: database
          label: Base del ejercicio en curso
          zone: restricted
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de lotes por exportar
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: exportador
          type: worker
          label: Exportador de historia
          zone: private
        - id: archivo
          type: object-storage
          label: Archivo de once años
          zone: private
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: socio-portal
          from: { node: socio }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-movimientos
          from: { node: gw }
          to: { node: movimientos }
          dataClass: personal
        - id: movimientos-basemovimientos
          from: { node: movimientos }
          to: { node: basemovimientos }
          dataClass: personal
        - id: movimientos-cola
          from: { node: movimientos }
          to: { node: cola }
          dataClass: personal
        - id: cola-exportador
          from: { node: cola }
          to: { node: exportador }
          dataClass: personal
        - id: exportador-archivo
          from: { node: exportador }
          to: { node: archivo }
          dataClass: personal
        - id: movimientos-monitoreo
          from: { node: movimientos }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: exportador-monitoreo
          from: { node: exportador }
          to: { node: monitoreo }
          dataClass: public
        - id: basemovimientos-monitoreo
          from: { node: basemovimientos }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

El mismo tipo de cooperativa, el mismo servicio de movimientos, la misma
base de historia. Todo lo que cambia es quién pregunta y cuántas veces.

Acá no hay mostrador físico: el socio se atiende solo desde la app y **la
app no muestra nada anterior al 1 de enero**. Nadie se quejó nunca. Lo que
sí existe es la obligación legal de conservar **once años** de movimientos,
y **cuarenta pedidos al año**: siempre un oficio judicial, siempre "todos
los movimientos de esta cuenta entre estas dos fechas", siempre el lote
entero. Ninguno pidió un movimiento suelto. Ninguno cruzó cuentas.

La base de historia responde esos cuarenta pedidos. Para eso el equipo le
paga, todo el año: **dos parches de seguridad por trimestre, una
restauración de prueba por semestre y el 40 % del volumen de copias
nocturnas.** Es una unidad operativa entera, y es la única que el equipo
tiene libre.

Este ejercicio y su hermano son la misma decisión mirada desde dos negocios
distintos: **dónde vive la historia**. Allá vivía en línea porque se
consultaba 2.100 veces por día contra reloj. Acá la respuesta es la
contraria, y también con los ojos abiertos: **la historia baja a un archivo
que el equipo no opera**, y con eso se pierde la consulta. Si mañana
apareciera una pregunta que filtra, ordena o cruza cuentas, no hay con qué
responderla: hay que bajar el lote y buscar a mano.

Vale la pena, porque esa pregunta no existe en este negocio, y la unidad
que se libera es la diferencia entre poder agregar algo el año que viene y
no poder.

Dos cosas no se negocian, y las dos son lo que separa "apagar una base" de
"perder once años":

**El archivo tiene que existir antes.** Apagar la base sin nada detrás no
ahorra una unidad: destruye la obligación legal que justifica el sistema
entero.

**El ejercicio en curso se queda donde está.** El saldo de hoy y el débito
de ayer se piden por cuenta y por fecha miles de veces por día. Bajar todo
a archivo no es ahorrar: es apagar el producto.

**Armá el sistema** para que los once años queden guardados fuera de la
capacidad operativa del equipo, para que el almacén que se usa cuarenta
veces por año deje de mantenerse trescientos sesenta y cinco, y para que la
base que queda, donde ahora está concentrado todo el riesgo, sea la que más
se mira.
