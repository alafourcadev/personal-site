---
title: "La convivencia que salió más cara que los dos sistemas juntos"
level: 11
role: trap
domain: gastos
D1: 4
D2: 3
D3: 3
D4: 4
D5: 2
D6: 4
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 4
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá el estado intermedio cuesta más que los dos sistemas por separado, y qué haría falta para que no fuera así."
lambda: 0.5
constraints:
  - metric: personas que usan la herramienta
    operator: "<="
    value: 60
    unit: personas
  - metric: personas disponibles para operar lo que se deje corriendo
    operator: "<="
    value: 2
    unit: personas
  - metric: duración de la exportación completa del historial
    operator: "<="
    value: 20
    unit: minutos
hiddenFacts:
  - fact: "el sistema viejo corre en un servidor alquilado que factura USD 2.400 por mes. El sistema nuevo entero, con su base, cuesta menos de la cuarta parte de eso. Cada mes de convivencia es un mes pagando el más caro de los dos."
    discoveryPath: "preguntá cuánto cuesta el mes de transición, no cuánto cuesta el destino. En una migración grande esa cifra es ruido; acá es la cifra más grande del proyecto, y crece sola con cada semana que la convivencia se estira."
  - fact: "hay 14 meses de rendiciones en total. La exportación completa tarda 20 minutos y entra en un archivo. No hay integraciones externas: la contabilidad se carga a mano desde un resumen mensual."
    discoveryPath: "preguntá cuánto dato hay que mover de verdad, no cuánto parece. La convivencia con sincronización existe para cuando no se puede parar a copiar. Acá se puede parar a copiar, y se tarda menos que una reunión."
  - fact: "la empresa cierra dos semanas completas en enero. Nadie rinde gastos con la empresa cerrada."
    discoveryPath: "preguntá cuándo el sistema no se usa. La convivencia es cara cuando existe una ventana de corte real; el problema del corte de golpe es que casi nunca hay ventana, y acá hay dos semanas enteras."
  - fact: "el equipo son dos personas y ya operan siete cosas. Una cola de sincronización entre las dos bases es una octava cosa que alguien tiene que mirar todos los días durante seis meses, y es la que menos se va a mirar porque no la usa ningún cliente."
    discoveryPath: "contá las piezas que quedan corriendo en cada plan y dividí por dos personas. La pieza de transición no es gratis: es una guardia más, y las piezas de transición son las que menos alarma tienen porque nadie planea que duren."
  - fact: "durante la convivencia el mismo gasto existe en dos bases. Contabilidad cierra el mes mirando una de las dos, y no hay ninguna regla escrita sobre cuál."
    discoveryPath: "preguntá quién decide cuál de las dos copias es la verdad cuando difieren. Si la respuesta es 'no debería pasar', todavía no hay respuesta: en seis meses de sincronización va a pasar, y va a pasar en el mes que alguien audite."
startingDesign:
  nodes:
    - id: persona
      type: actor
      label: Persona que rinde gastos
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de gastos
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: enrutador
      type: service
      label: Enrutador de gastos
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: viejo
      type: service
      label: Gastos (sistema viejo)
      zone: private
      role: legacy-expenses
      given: true
      props: { criticality: "high", replicas: "1" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Gastos (sistema nuevo)
      zone: private
      role: new-expenses
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: dbvieja
      type: database
      label: Base de gastos (vieja)
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: dbnueva
      type: database
      label: Base de gastos (nueva)
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
    - id: cola
      type: queue
      label: Cola de sincronización
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "no" }
      position: { x: 805, y: 290 }
    - id: archivo
      type: object-storage
      label: Archivo de rendiciones
      zone: private
      given: true
      position: { x: 805, y: 740 }
  edges:
    - id: persona-portal
      from: { node: persona }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: personal
    - id: viejo-dbvieja
      from: { node: viejo }
      to: { node: dbvieja }
      dataClass: personal
    - id: viejo-cola
      from: { node: viejo }
      to: { node: cola }
      dataClass: personal
    - id: cola-nuevo
      from: { node: cola }
      to: { node: nuevo }
      dataClass: personal
    - id: nuevo-dbnueva
      from: { node: nuevo }
      to: { node: dbnueva }
      dataClass: personal
guarantees:
  - id: g-new-serves
    label: el sistema nuevo atiende todas las rendiciones
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: new-expenses
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el sistema nuevo.
    consequence: "el sistema nuevo está terminado y no atendió una sola rendición. Un sistema que nadie usó no está migrado: lo que le falta se descubre el primer día que sesenta personas lo abren, y ese día conviene que sea uno elegido y no el que salga."
  - id: g-legacy-gone
    label: el sistema viejo ya no está desplegado
    weight: 2
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [service]
            role: legacy-expenses
    whyMissing: el sistema viejo sigue en el diseño, así que el servidor alquilado sigue facturando y el mismo gasto sigue existiendo en dos lugares.
    consequence: "ese servidor cuesta USD 2.400 por mes, más de cuatro veces lo que cuesta el sistema nuevo entero. Cada mes de convivencia es un mes pagando el más caro de los dos por la única razón de que todavía existe. Y mientras existan las dos bases, contabilidad cierra el mes mirando una de ellas sin ninguna regla escrita sobre cuál."
  - id: g-history-reachable
    label: los 14 meses de rendiciones siguen consultables desde la puerta de entrada
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde la puerta de entrada hasta un almacenamiento de archivos donde vivan las rendiciones anteriores.
    consequence: "apagar el sistema viejo sin dejar el historial en algún lado es perder catorce meses de rendiciones aprobadas, que es exactamente lo que mira una auditoría. El corte es barato porque la exportación tarda veinte minutos, no porque el historial sobre."
  - id: g-no-sync-lane
    label: no queda ninguna cola de sincronización corriendo
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [queue, stream]
    whyMissing: hay un servicio o un proceso de fondo escribiendo en una cola o en un registro de eventos, así que quedó una pieza de transición viva.
    consequence: "el equipo son dos personas que ya operan siete cosas. Una cola entre dos bases es una octava, y es la que menos se va a mirar porque no la usa ningún cliente: cuando se atrase, nadie se va a enterar hasta que un gasto no aparezca del lado en el que lo buscan."
rubric:
  - dimension: el sistema nuevo queda atendiendo de verdad
    signal:
      kind: predicate
      guaranteeId: g-new-serves
  - dimension: el estado intermedio no sobrevive al cambio
    signal:
      kind: predicate
      guaranteeId: g-legacy-gone
  - dimension: el historial se conserva sin conservar el sistema
    signal:
      kind: predicate
      guaranteeId: g-history-reachable
  - dimension: no queda una pieza de transición para operar
    signal:
      kind: predicate
      guaranteeId: g-no-sync-lane
referenceSolutions:
  - label: el sistema nuevo lee el archivo del historial
    contextInversion: "que el propio sistema nuevo lea el archivo conviene cuando el historial se consulta desde la misma pantalla que las rendiciones vivas: la persona ve una sola lista y no sabe, ni le importa, que la mitad vieja viene de un archivo. Es lo más barato de operar: tres piezas para dos personas. Se paga con que el sistema nuevo carga con el formato viejo adentro, y el día que ese formato ya no haga falta hay que sacarlo de ahí."
    design:
      nodes:
        - id: persona
          type: actor
          label: Persona que rinde gastos
          zone: public
        - id: portal
          type: web-client
          label: Portal de gastos
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Gastos (sistema nuevo)
          zone: private
          role: new-expenses
          props: { criticality: "high", replicas: "2" }
        - id: dbnueva
          type: database
          label: Base de gastos (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de rendiciones
          zone: private
      edges:
        - id: persona-portal
          from: { node: persona }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
        - id: nuevo-archivo
          from: { node: nuevo }
          to: { node: archivo }
          dataClass: personal
  - label: una consulta de archivo aparte
    contextInversion: "separar la consulta del historial en su propia pieza conviene cuando quien mira las rendiciones viejas no es quien las carga: contabilidad y auditoría entran una vez por trimestre, con otro permiso y otra pantalla. El sistema nuevo queda limpio del formato viejo y esa pieza se apaga sola el día que los catorce meses dejen de importar. Se paga con una unidad operativa más sobre un equipo de dos personas, que es exactamente lo que este presupuesto puede absorber y ni una más."
    design:
      nodes:
        - id: persona
          type: actor
          label: Persona que rinde gastos
          zone: public
        - id: portal
          type: web-client
          label: Portal de gastos
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Gastos (sistema nuevo)
          zone: private
          role: new-expenses
          props: { criticality: "high", replicas: "2" }
        - id: consulta
          type: service
          label: Consulta de rendiciones anteriores
          zone: private
          props: { criticality: "medium", replicas: "1" }
        - id: dbnueva
          type: database
          label: Base de gastos (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de rendiciones
          zone: private
      edges:
        - id: persona-portal
          from: { node: persona }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: gw-consulta
          from: { node: gw }
          to: { node: consulta }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
        - id: consulta-archivo
          from: { node: consulta }
          to: { node: archivo }
          dataClass: personal
status: PILOT
---

Una herramienta interna de rendición de gastos. **60 personas**, de nueve a
seis, de lunes a viernes. El sistema tiene siete años, lo escribió alguien que
ya no está, y el reemplazo está terminado desde hace un mes.

El plan que llegó a la mesa es el que a esta altura ya sabés armar: una pieza
en el medio que reparta, los dos sistemas vivos, una cola que mantenga las dos
bases al día, y seis meses de convivencia para migrar por equipos. Es el plan
correcto para casi todos los ejercicios de este nivel.

Antes de dibujarlo, cuatro números.

El sistema viejo corre en un **servidor alquilado que factura USD 2.400 por
mes**. El sistema nuevo entero, con su base, cuesta menos de la cuarta parte.
Cada mes de convivencia es un mes pagando el más caro de los dos.

Hay **14 meses de rendiciones**. La exportación completa tarda **20 minutos** y
entra en un archivo. No hay integraciones externas: la contabilidad se carga a
mano desde un resumen mensual.

La empresa **cierra dos semanas completas en enero**. Nadie rinde gastos con
la empresa cerrada.

El equipo son **dos personas** y ya operan siete cosas.

Y hay una quinta que no es un número. Durante la convivencia el mismo gasto
existe en dos bases. Contabilidad cierra el mes mirando una de las dos, y no
hay ninguna regla escrita sobre cuál. "No debería pasar que difieran" no es
una regla: en seis meses de sincronización van a diferir, y va a ser el mes que
alguien audite.

La convivencia existe para cuando no se puede parar a copiar y no hay ventana
de corte. **Acá se puede parar a copiar en veinte minutos y hay dos semanas de
ventana.** El estado intermedio no es el camino más seguro: es el más caro, el
que más piezas deja corriendo sobre dos personas, y el único de los dos planes
que crea el problema de no saber cuál de las dos copias es la verdad.

**Rearmá el sistema** que queda después del corte: el sistema nuevo atendiendo,
el viejo apagado, los catorce meses de rendiciones consultables, y ninguna
pieza de transición viva para que alguien la mire todos los días.
