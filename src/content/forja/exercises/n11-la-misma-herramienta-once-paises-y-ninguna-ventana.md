---
title: "La misma herramienta, once países y ninguna ventana"
level: 11
role: counter-trap
domain: gastos
D1: 3
D2: 3
D3: 3
D4: 4
D5: 3
D6: 2
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 6
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá la convivencia sí es la respuesta correcta, y qué del ejercicio anterior dejó de valer."
lambda: 0.5
constraints:
  - metric: personas que usan la herramienta
    operator: ">="
    value: 9200
    unit: personas
  - metric: años que la ley obliga a conservar las rendiciones
    operator: ">="
    value: 10
    unit: años
  - metric: horas al día en que ningún país está trabajando
    operator: "<="
    value: 0
    unit: horas
hiddenFacts:
  - fact: "la operación cubre once países. Cuando cierra la jornada en Manila abre la de Santiago: no existe ninguna hora del día ni ningún día del año en que la herramienta no esté siendo usada por alguien."
    discoveryPath: "buscá la ventana de corte. En el ejercicio anterior había dos semanas de empresa cerrada; acá la pregunta no tiene respuesta, y una migración sin ventana no puede terminar en un corte de golpe."
  - fact: "cada país tiene su propia integración contable, con su formato, su calendario de cierre y su organismo fiscal. Son once integraciones distintas y el sistema nuevo tiene tres terminadas."
    discoveryPath: "preguntá qué sabe hacer hoy el sistema nuevo y para quiénes. Si sabe atender a tres países de once, apagar el viejo no es un corte: es dejar a ocho países sin poder cerrar el mes."
  - fact: "hay seis años de rendiciones y la ley obliga a conservarlas diez. No es una exportación de veinte minutos: son once esquemas contables distintos que nadie unificó nunca."
    discoveryPath: "preguntá cuánto tarda de verdad copiar el historial y en qué formato queda. Cuando la respuesta es 'depende del país', el archivo único no existe todavía y no va a existir antes del corte."
  - fact: "el equipo son once personas, con guardia por franja horaria. Operar una pieza de transición más no es la restricción que decide este diseño."
    discoveryPath: "contá las piezas por persona, como en el ejercicio anterior, y fijate que la cuenta ahora da otra cosa. La misma pieza que allá era una guardia insostenible acá es una fracción de lo que el equipo ya opera."
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
      label: Enrutador por país
      zone: private
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 410 }
    - id: viejo
      type: service
      label: Gastos (sistema del grupo)
      zone: private
      role: legacy-expenses
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Gastos (sistema nuevo)
      zone: private
      role: new-expenses
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 520 }
    - id: dbvieja
      type: database
      label: Base de rendiciones (vieja)
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: dbnueva
      type: database
      label: Base de rendiciones (nueva)
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 630 }
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
    - id: nuevo-dbnueva
      from: { node: nuevo }
      to: { node: dbnueva }
      dataClass: personal
    - id: nuevo-dbvieja
      from: { node: nuevo }
      to: { node: dbvieja }
      dataClass: personal
guarantees:
  - id: g-legacy-standing
    label: el sistema del grupo sigue desplegado y entero
    weight: 1
    predicate:
      op: exists
      node:
        type: [service]
        role: legacy-expenses
    whyMissing: el sistema viejo no está en el diseño.
    consequence: "es el único que sabe cerrar el mes en ocho de los once países: sus formatos, sus calendarios fiscales, sus organismos. Apagarlo antes de que el sistema nuevo aprenda esas ocho integraciones no acelera nada: deja a ocho países sin poder presentar sus declaraciones, que es un problema con multa y con fecha."
  - id: g-both-serving
    label: las dos versiones atienden rendiciones reales al mismo tiempo
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: legacy-expenses
        - op: path
          from:
            type: [api-gateway]
          to:
            role: new-expenses
    whyMissing: falta el camino desde la puerta de entrada hasta una de las dos versiones.
    consequence: "no hay ninguna hora del día en que nadie esté rindiendo: cuando cierra Manila abre Santiago. Sin ventana de corte, la única forma de que el sistema nuevo procese carga real es que la procese mientras el viejo sigue atendiendo a los países que él todavía no sabe atender."
  - id: g-single-switch
    label: qué país atiende cada versión se decide en un solo lugar
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-expenses
    whyMissing: la puerta de entrada sigue llamando al sistema del grupo directamente, así que el reparto por país está escrito en la puerta.
    consequence: "la migración avanza país por país durante meses y cada paso se puede tener que deshacer: si el cierre de marzo en México sale mal, ese país vuelve al sistema viejo esa misma tarde. Con el reparto escrito en la puerta de entrada, volver es un despliegue en el camino de 9.200 personas de once husos horarios, y no hay hora buena para hacerlo."
  - id: g-history-reachable
    label: los seis años de rendiciones siguen consultables desde la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-store
    whyMissing: no hay ningún camino desde la puerta de entrada hasta la base de rendiciones vieja.
    consequence: "la ley obliga a conservar diez años y hay seis cargados, en once esquemas contables que nadie unificó nunca. No hay archivo único al que exportarlos antes del corte, así que durante la convivencia la base vieja sigue siendo la forma de consultarlos, y las auditorías fiscales no esperan a que termine la migración."
  - id: g-new-not-on-legacy-store
    label: el sistema nuevo no se acopla a la base vieja
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: new-expenses
      to:
        role: legacy-store
    whyMissing: el sistema nuevo tiene una conexión directa a la base de rendiciones vieja.
    consequence: "una convivencia larga premia el atajo: leer la base vieja hoy ahorra una semana. La paga el equipo que dentro de dos años tenga que apagar esa base y descubra que el sistema nuevo la necesita para funcionar, sin que quede ningún registro de cuándo ni por qué se conectó."
rubric:
  - dimension: el sistema viejo sigue en pie mientras siga siendo el único que sabe
    signal:
      kind: predicate
      guaranteeId: g-legacy-standing
  - dimension: las dos versiones conviven atendiendo tráfico real
    signal:
      kind: predicate
      guaranteeId: g-both-serving
  - dimension: el avance país por país se hace y se deshace sin desplegar
    signal:
      kind: predicate
      guaranteeId: g-single-switch
  - dimension: el historial fiscal sigue disponible durante toda la convivencia
    signal:
      kind: predicate
      guaranteeId: g-history-reachable
  - dimension: la convivencia no crea dependencias nuevas hacia lo que se va a apagar
    signal:
      kind: predicate
      guaranteeId: g-new-not-on-legacy-store
referenceSolutions:
  - label: un enrutador que reparte por país
    contextInversion: "una pieza dedicada que reparte por país conviene cuando el orden de la migración lo decide el negocio y cambia sobre la marcha: se mueve México, se lo devuelve porque el cierre de marzo salió mal, se mueve Perú en su lugar. Todo eso vive en un solo lugar y ninguno de los dos sistemas se entera. Se paga con una unidad operativa más y con una pieza en el camino de las rendiciones de once países."
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
        - id: enrutador
          type: service
          label: Enrutador por país
          zone: private
          props: { criticality: "high", replicas: "3" }
        - id: viejo
          type: service
          label: Gastos (sistema del grupo)
          zone: private
          role: legacy-expenses
          props: { criticality: "high", replicas: "3" }
        - id: nuevo
          type: service
          label: Gastos (sistema nuevo)
          zone: private
          role: new-expenses
          props: { criticality: "high", replicas: "3" }
        - id: dbvieja
          type: database
          label: Base de rendiciones (vieja)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base de rendiciones (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: persona-portal
          from: { node: persona }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-enrutador
          from: { node: gw }
          to: { node: enrutador }
          dataClass: personal
        - id: enrutador-viejo
          from: { node: enrutador }
          to: { node: viejo }
          dataClass: personal
        - id: enrutador-nuevo
          from: { node: enrutador }
          to: { node: nuevo }
          dataClass: personal
        - id: viejo-dbvieja
          from: { node: viejo }
          to: { node: dbvieja }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
  - label: el sistema nuevo adelante, delegando los países que todavía no sabe
    contextInversion: "poner el sistema nuevo adelante y que delegue en el viejo los ocho países que todavía no sabe cerrar conviene cuando la migración avanza por integración contable y no por decisión comercial: el día que el sistema nuevo termina la integración de un país, deja de delegarlo y no hay que tocar ninguna otra pieza ni avisarle a nadie. Es una unidad operativa menos. El precio es que el sistema nuevo queda en el camino de los once países desde el primer día, incluidos los ocho que él no sabe atender: si se cae, se cae también lo que funcionaba bien."
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
          props: { criticality: "high", replicas: "3" }
        - id: viejo
          type: service
          label: Gastos (sistema del grupo)
          zone: private
          role: legacy-expenses
          props: { criticality: "high", replicas: "3" }
        - id: dbvieja
          type: database
          label: Base de rendiciones (vieja)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base de rendiciones (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
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
        - id: nuevo-viejo
          from: { node: nuevo }
          to: { node: viejo }
          dataClass: personal
        - id: viejo-dbvieja
          from: { node: viejo }
          to: { node: dbvieja }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
status: PILOT
---

La misma herramienta de rendición de gastos. La misma decisión: convivencia
con una pieza en el medio, o corte.

Cambió la empresa. **9.200 personas en once países.**

Buscá la ventana de corte antes que ninguna otra cosa. En la herramienta de
sesenta personas había dos semanas de empresa cerrada en enero. Acá, **cuando
cierra la jornada en Manila abre la de Santiago**: no hay una hora del día ni
un día del año en que la herramienta no esté siendo usada. La pregunta "¿cuándo
paramos a copiar?" no tiene respuesta.

Cada país tiene su propia integración contable: su formato, su calendario de
cierre, su organismo fiscal. Son **once integraciones distintas y el sistema
nuevo tiene tres terminadas**. Apagar el viejo hoy no es un corte: es dejar a
ocho países sin poder presentar sus declaraciones, con multa y con fecha.

El historial tampoco es un archivo de veinte minutos. Son **seis años de
rendiciones**, que por ley hay que conservar diez, en once esquemas contables
que nadie unificó nunca. Las auditorías fiscales llegan durante la migración,
no después.

Y la cuenta que en el otro caso decidía todo, piezas corriendo dividido
personas del equipo, acá da distinto: el equipo son **once personas con guardia
por franja horaria**. Una pieza de transición más no es la restricción que
decide este diseño.

Acá la respuesta obvia es la correcta, y conviene entender por qué: no porque
la convivencia sea buena en sí, sino porque **las tres cosas que hacían barato
el corte (una ventana real, una exportación chica, un solo destino) no existe
ninguna**.

Queda una sola advertencia, y es la que se cobra tarde: en una convivencia
larga el atajo tienta. Conectar el sistema nuevo directo a la base vieja ahorra
una semana ahora y se la cobra al equipo que dentro de dos años tenga que
apagarla.

**Rearmá el sistema** para que las dos versiones atiendan al mismo tiempo, para
que mover un país, o devolverlo la tarde que su cierre salga mal, sea una
decisión de operación y no un despliegue, y para que los seis años de historial
sigan consultables sin que el sistema nuevo se ate a la base que los guarda.
