---
title: "El tablero que leía la base de todas las clínicas"
level: 8
role: core
domain: salud
D1: 3
D2: 3
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué dato ve el tablero comparativo en tu diseño, y por qué ese dato ya no permite reconstruir el turno de un paciente concreto."
lambda: 0.5
constraints:
  - metric: clínicas sobre la misma plataforma
    operator: ">="
    value: 62
    unit: clínicas
  - metric: tiempo aceptable para reservar un turno en horario pico
    operator: "<="
    value: 3
    unit: segundos
hiddenFacts:
  - fact: "la consulta del tablero agrupa por clínica y recorre trece meses de turnos. Tarda entre 40 y 90 segundos y toma bloqueos de lectura sobre la misma tabla que usa la reserva."
    discoveryPath: "es la razón por la que una garantía prohíbe la conexión directa entre el tablero y la base viva, y otra pide que el tablero lea de un extracto. El nivel anterior ya mostró qué pasa cuando una consulta pesada comparte capacidad con el camino que atienden los usuarios."
  - fact: "el filtro que deja sólo la clínica propia se aplica en el código del tablero, después de traer las filas de las 62. Las filas de las otras 61 pasan por la red y quedan en memoria del proceso."
    discoveryPath: "mirá quién arma la comparación y con qué datos. Un tablero que compara contra el promedio necesita el promedio, no las filas que lo componen. La diferencia entre esas dos cosas es todo el ejercicio."
  - fact: "el contrato con las clínicas dice que los datos de una nunca salen hacia otra. No dice nada sobre promedios agregados, y por eso el producto comparativo se pudo vender."
    discoveryPath: "es la razón por la que la respuesta correcta no es apagar el tablero. Un extracto agregado cumple el contrato y sostiene el producto; una consulta cruda sobre la base viva no cumple ninguno de los dos."
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
      label: Portal de turnos
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: turnos
      type: service
      label: Servicio de turnos
      zone: private
      role: booking-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: tablero
      type: service
      label: Tablero comparativo
      zone: private
      role: analytics-service
      given: true
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de turnos
      zone: restricted
      role: clinic-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: paciente-portal
      from: { node: paciente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-turnos
      from: { node: gw }
      to: { node: turnos }
      dataClass: personal
    - id: gw-tablero
      from: { node: gw }
      to: { node: tablero }
      dataClass: personal
    - id: turnos-base
      from: { node: turnos }
      to: { node: base }
      dataClass: personal
    - id: tablero-base
      from: { node: tablero }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-analytics-reads-extract
    label: el tablero comparativo trabaja sobre un extracto, no sobre la base de turnos
    weight: 2
    predicate:
      op: path
      from:
        role: analytics-service
      to:
        type: [object-storage, database]
      forbid:
        role: clinic-store
    whyMissing: "el tablero no llega a ningún extracto. Un extracto es una copia ya agregada que vive FUERA de la base de turnos: sirve un almacenamiento de objetos y sirve una base aparte (las dos resuelven el problema), y lo que no sirve es leer la base viva, porque eso es exactamente lo que hay que sacar."
    consequence: "la comparación se calcula recorriendo trece meses de turnos reales cada vez que alguien abre la pantalla. Es caro, es lento, y para calcular un promedio hay que traer las filas que lo componen: las de las 62 clínicas."
  - id: g-no-live-scan
    label: no queda ninguna consulta del tablero contra la base de turnos
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: analytics-service
      to:
        role: clinic-store
    whyMissing: sigue existiendo una conexión directa entre el tablero comparativo y la base de turnos.
    consequence: "mientras exista, una pantalla de comparación puede tomar bloqueos de lectura sobre la tabla que usa la reserva de turnos. La clínica que no usa el tablero paga la lentitud de la que sí lo usa, y las filas de las 61 restantes siguen viajando hasta un proceso que después las descarta."
  - id: g-booking-path-independent
    label: la reserva de turnos llega a la base sin depender del tablero
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: clinic-store
      forbid:
        role: analytics-service
    whyMissing: el único camino desde la puerta de entrada hasta la base de turnos pasa por el tablero comparativo.
    consequence: un producto de análisis que se cae no puede llevarse puesta la reserva de un turno. Si el camino que da de comer depende del que es lindo de mostrar, la prioridad quedó al revés.
  - id: g-extract-is-produced
    label: alguien que sabe de qué clínica es cada fila produce ese extracto
    weight: 1
    predicate:
      op: path
      from:
        role: booking-service
      to:
        type: [object-storage, database]
      forbid:
        role: clinic-store
    whyMissing: "no hay ningún camino desde el servicio de turnos hasta el lugar donde vive el extracto, sea un almacenamiento de objetos o una base aparte, así que el extracto que el tablero necesita no lo produce nadie. Escribir en la base de turnos no cuenta: ahí ya está el dato crudo, y el problema es justamente que es crudo."
    consequence: un extracto que nadie escribe es una carpeta vacía. Y si lo escribiera un componente que no sabe de qué clínica es cada fila, el problema se mudó de lugar en vez de resolverse.
rubric:
  - dimension: el análisis se separa del sistema que atiende a los pacientes
    signal:
      kind: predicate
      guaranteeId: g-analytics-reads-extract
  - dimension: la consulta que cruzaba clínicas dejó de existir
    signal:
      kind: predicate
      guaranteeId: g-no-live-scan
  - dimension: reservar un turno no depende del producto de análisis
    signal:
      kind: predicate
      guaranteeId: g-booking-path-independent
  - dimension: el extracto lo produce quien conoce al dueño del dato
    signal:
      kind: predicate
      guaranteeId: g-extract-is-produced
referenceSolutions:
  - label: el servicio de turnos deja el extracto y el tablero lo lee
    contextInversion: "que el propio servicio de turnos escriba el extracto conviene cuando el agregado es chico y se recalcula una vez por día: cero piezas nuevas para operar y el extracto queda escrito por el único componente que ya sabe de qué clínica es cada turno. El costo es que ese trabajo corre dentro del servicio que atiende reservas: si un día tarda más de lo previsto, se nota en el portal."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal de turnos
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: booking-service
          props: { criticality: "high", replicas: "2" }
        - id: tablero
          type: service
          label: Tablero comparativo
          zone: private
          role: analytics-service
        - id: extracto
          type: object-storage
          label: Extracto agregado por clínica
          zone: private
        - id: base
          type: database
          label: Base de turnos
          zone: restricted
          role: clinic-store
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
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: gw-tablero
          from: { node: gw }
          to: { node: tablero }
          dataClass: public
        - id: turnos-base
          from: { node: turnos }
          to: { node: base }
          dataClass: personal
        - id: turnos-extracto
          from: { node: turnos }
          to: { node: extracto }
          dataClass: public
        - id: tablero-extracto
          from: { node: tablero }
          to: { node: extracto }
          dataClass: public
  - label: un exportador nocturno arma el extracto fuera del camino de la reserva
    contextInversion: "un exportador aparte conviene cuando el agregado recorre trece meses y tarda minutos: corre a las 3 de la mañana, se puede pausar un martes sin tocar el servicio de turnos, y si falla se reintenta sin que ningún paciente lo note. Se paga con dos piezas más para operar y con que el número del tablero es el de anoche, no el de recién."
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal de turnos
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: booking-service
          props: { criticality: "high", replicas: "2" }
        - id: tablero
          type: service
          label: Tablero comparativo
          zone: private
          role: analytics-service
        - id: cola
          type: queue
          label: Cola de extractos pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: exportador
          type: worker
          label: Exportador nocturno
          zone: private
        - id: extracto
          type: object-storage
          label: Extracto agregado por clínica
          zone: private
        - id: base
          type: database
          label: Base de turnos
          zone: restricted
          role: clinic-store
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
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: gw-tablero
          from: { node: gw }
          to: { node: tablero }
          dataClass: public
        - id: turnos-base
          from: { node: turnos }
          to: { node: base }
          dataClass: personal
        - id: turnos-cola
          from: { node: turnos }
          to: { node: cola }
          dataClass: personal
        - id: cola-exportador
          from: { node: cola }
          to: { node: exportador }
          dataClass: personal
        - id: exportador-extracto
          from: { node: exportador }
          to: { node: extracto }
          dataClass: public
        - id: tablero-extracto
          from: { node: tablero }
          to: { node: extracto }
          dataClass: public
status: PILOT
---

Una plataforma de turnos que usan **62 clínicas**. Todas sobre la misma base
de datos. El paciente entra al portal, elige horario, y el turno queda
reservado en menos de tres segundos.

El año pasado el equipo comercial vendió un producto nuevo: un tablero donde
cada clínica ve cómo se compara su tiempo de espera contra el promedio del
resto. Se construyó apuntando el tablero directamente a la base de turnos.
Salió rápido y funcionó.

Funcionó hasta que se descubrieron dos cosas.

La primera la vio operaciones. La consulta del tablero agrupa por clínica y
recorre **trece meses** de turnos. Tarda entre 40 y 90 segundos, y toma
bloqueos de lectura sobre la misma tabla donde se reserva. Todos los martes a
las 9 de la mañana, cuando los directores médicos abren el tablero, reservar
un turno pasa de dos segundos a once. Las clínicas que se quejan casi nunca
son las que abrieron el tablero.

La segunda la vio una auditoría. Para calcular el promedio del resto, la
consulta trae las filas de las 62 clínicas y descarta las ajenas **después**,
en el código del tablero. El contrato con cada clínica dice que sus datos no
salen hacia otra. Las filas ya habían salido: viajaron por la red y
estuvieron en memoria de un proceso compartido.

El contrato no dice nada sobre promedios agregados. Por eso el producto se
pudo vender, y por eso apagarlo no es la respuesta.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que el tablero deje de tocar la base viva y trabaje
sobre un extracto que produce el componente que sabe de qué clínica es cada
fila, sin que reservar un turno dependa nunca de que el tablero esté sano.

Un extracto acá es una copia **ya agregada** que vive fuera de la base de
turnos. Dónde la dejes es tu decisión y las dos opciones son correctas: un
almacenamiento de objetos sale más barato de operar y encaja si el agregado se
recalcula entero cada vez; una base aparte te deja consultarlo por clínica y
por mes sin releer el archivo completo, y cuesta una unidad operativa más. Lo
único que no es un extracto es la base de turnos: ahí está el dato crudo, y el
dato crudo es el problema.
