---
title: "El saldo que no puede llegar con tres segundos de atraso"
level: 11
role: tradeoff
domain: telefonia
tradeoffPairId: migracion-de-donde-lee-el-sistema-nuevo
D1: 3
D2: 4
D3: 3
D4: 4
D5: 3
D6: 3
D7: 3
D8: 2
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 6
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá el motor nuevo lee el saldo donde el saldo es verdad, y qué contexto daría vuelta esa decisión."
lambda: 0.5
constraints:
  - metric: llamadas tarificadas por hora en el pico
    operator: ">="
    value: 900000
    unit: llamadas/hora
  - metric: atraso tolerable entre el saldo real y el saldo que ve el motor que tarifica
    operator: "<="
    value: 0
    unit: segundos
hiddenFacts:
  - fact: "el saldo de prepago es la única cifra del sistema que se descuenta y se recarga desde cuatro lugares distintos al mismo tiempo: la llamada en curso, los datos, la recarga en el kiosco y la promoción automática de fin de mes."
    discoveryPath: "preguntate cuántas cosas escriben ese número por segundo. Un dato que sólo escribe un sistema se puede copiar; uno que escriben cuatro, copiado, deja de ser el mismo dato en cuanto la copia sale."
  - fact: "ya hay un registro de consumo desplegado que copia el saldo hacia el lado nuevo. Lo armó el equipo de datos para un tablero de reportes, y alguien propuso reusarlo para tarificar."
    discoveryPath: "está en el lienzo, conectado, funcionando. Sirve perfecto para un tablero que se mira una vez por día. Preguntate qué significan sus tres segundos de atraso cuando lo que hay del otro lado no es un gráfico sino la decisión de dejar hablar o cortar."
  - fact: "en el pico se tarifican 900.000 llamadas por hora. Tres segundos de atraso son 750 llamadas decididas contra un saldo que ya no existe."
    discoveryPath: "multiplicá el atraso por el caudal. El error de una copia atrasada no es 'a veces se equivoca': es una cantidad exacta de llamadas por minuto que se cobran mal, y se cobran mal siempre en la misma dirección."
startingDesign:
  nodes:
    - id: abonado
      type: actor
      label: Abonado prepago
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la línea
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: viejo
      type: service
      label: Motor de tarificación (viejo)
      zone: private
      role: legacy-rating
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Motor de tarificación (nuevo)
      zone: private
      role: new-rating
      given: true
      props: { criticality: "high", replicas: "3" }
      position: { x: 445, y: 410 }
    - id: canal
      type: stream
      label: Registro de consumo
      zone: private
      given: true
      props: { retention: "7d", ordering: "sí" }
      position: { x: 805, y: 300 }
    - id: saldos
      type: database
      label: Base de saldos
      zone: restricted
      role: balance-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 440 }
    - id: dbnueva
      type: database
      label: Base del motor nuevo
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 550 }
  edges:
    - id: abonado-app
      from: { node: abonado }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: personal
    - id: viejo-saldos
      from: { node: viejo }
      to: { node: saldos }
      dataClass: personal
    - id: viejo-canal
      from: { node: viejo }
      to: { node: canal }
      dataClass: personal
    - id: canal-nuevo
      from: { node: canal }
      to: { node: nuevo }
      dataClass: personal
    - id: nuevo-dbnueva
      from: { node: nuevo }
      to: { node: dbnueva }
      dataClass: personal
guarantees:
  - id: g-exact-read
    label: el motor nuevo consulta el saldo donde el saldo es verdad
    weight: 2
    predicate:
      op: path
      from:
        role: new-rating
      to:
        role: balance-store
    whyMissing: no hay ningún camino desde el motor nuevo hasta la base de saldos, ni directo ni a través del motor viejo.
    consequence: "el saldo lo escriben cuatro cosas a la vez: la llamada en curso, los datos, la recarga en el kiosco y la promoción de fin de mes. Cualquier lectura que no sea contra esa base es una foto vieja, y una foto vieja del saldo autoriza llamadas que no había plata para pagar."
  - id: g-no-copy-lane
    label: no hay ninguna copia asíncrona del saldo alimentando la decisión de tarificar
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [queue, stream]
    whyMissing: hay un servicio o un proceso de fondo escribiendo en una cola o en un registro de eventos, así que existe una copia del saldo que viaja con atraso.
    consequence: "en el pico se tarifican 900.000 llamadas por hora: tres segundos de atraso son 750 llamadas decididas contra un saldo que ya no existe. Y el error va siempre en la misma dirección, se deja hablar a quien no tenía saldo y nunca al revés, así que no se compensa con el tiempo: se acumula."
  - id: g-new-serves
    label: el motor nuevo tarifica llamadas reales
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: new-rating
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el motor nuevo.
    consequence: "un motor de tarificación que nunca decidió sobre una llamada real no está migrado: está escrito. Lo que le falta se descubre el primer viernes a las nueve de la noche, que es cuando el caudal es máximo y el margen para pensar es mínimo."
  - id: g-legacy-standing
    label: el motor viejo sigue desplegado durante la convivencia
    weight: 1
    predicate:
      op: exists
      node:
        type: [service]
        role: legacy-rating
    whyMissing: el motor viejo no está en el diseño.
    consequence: "el motor viejo es el único que hoy sabe aplicar las promociones heredadas y los planes corporativos con tarifa negociada. Sacarlo del diagrama antes de que el nuevo los sepa hacer no acelera la migración: la termina de golpe y mal, del lado de los clientes que más facturan."
rubric:
  - dimension: la lectura del saldo es exacta en el momento de decidir
    signal:
      kind: predicate
      guaranteeId: g-exact-read
  - dimension: no se introduce una copia con atraso en el camino crítico
    signal:
      kind: predicate
      guaranteeId: g-no-copy-lane
  - dimension: el motor nuevo acumula tiempo real de vuelo
    signal:
      kind: predicate
      guaranteeId: g-new-serves
  - dimension: el motor viejo sigue en pie mientras haga falta
    signal:
      kind: predicate
      guaranteeId: g-legacy-standing
referenceSolutions:
  - label: el motor nuevo lee la base de saldos directamente
    contextInversion: "leer la base de saldos directo conviene cuando el dato tiene que ser exacto en el instante de decidir y la base aguanta la carga: no hay pieza en el medio, no hay atraso, y el motor nuevo ve exactamente lo mismo que el viejo. Se paga con acoplamiento, porque el motor nuevo queda atado al esquema de una base que en algún momento se va a querer apagar, y con conexiones nuevas contra un almacenamiento que nadie dimensionó para dos motores."
    design:
      nodes:
        - id: abonado
          type: actor
          label: Abonado prepago
          zone: public
        - id: app
          type: mobile-client
          label: App de la línea
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: viejo
          type: service
          label: Motor de tarificación (viejo)
          zone: private
          role: legacy-rating
          props: { criticality: "high", replicas: "3" }
        - id: nuevo
          type: service
          label: Motor de tarificación (nuevo)
          zone: private
          role: new-rating
          props: { criticality: "high", replicas: "3" }
        - id: saldos
          type: database
          label: Base de saldos
          zone: restricted
          role: balance-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base del motor nuevo
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: abonado-app
          from: { node: abonado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-viejo
          from: { node: gw }
          to: { node: viejo }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: viejo-saldos
          from: { node: viejo }
          to: { node: saldos }
          dataClass: personal
        - id: nuevo-saldos
          from: { node: nuevo }
          to: { node: saldos }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
  - label: el motor nuevo le pide el saldo al motor viejo
    contextInversion: "pedirle el saldo al motor viejo conviene cuando el saldo no es sólo un número sino un número con reglas encima (promociones heredadas, planes corporativos, bonificaciones que vencen) y esas reglas todavía viven del lado viejo: el motor nuevo pregunta y recibe la respuesta ya interpretada, sin copiar once años de lógica. Sigue siendo exacto porque sigue siendo una lectura sincrónica contra la verdad. Se paga con una llamada más en el camino de cada tarificación y con una dependencia de disponibilidad: si el motor viejo no responde, el nuevo tampoco."
    design:
      nodes:
        - id: abonado
          type: actor
          label: Abonado prepago
          zone: public
        - id: app
          type: mobile-client
          label: App de la línea
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Motor de tarificación (nuevo)
          zone: private
          role: new-rating
          props: { criticality: "high", replicas: "3" }
        - id: viejo
          type: service
          label: Motor de tarificación (viejo)
          zone: private
          role: legacy-rating
          props: { criticality: "high", replicas: "3" }
        - id: saldos
          type: database
          label: Base de saldos
          zone: restricted
          role: balance-store
          props: { backup: "diario" }
        - id: dbnueva
          type: database
          label: Base del motor nuevo
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: abonado-app
          from: { node: abonado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
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
        - id: viejo-saldos
          from: { node: viejo }
          to: { node: saldos }
          dataClass: personal
        - id: nuevo-dbnueva
          from: { node: nuevo }
          to: { node: dbnueva }
          dataClass: personal
status: PILOT
---

Un operador móvil tiene **4,1 millones de líneas prepagas**. El motor que
tarifica las llamadas tiene doce años. El reemplazo está listo y hay que
empezar a mandarle tráfico.

El saldo de una línea prepaga es un número raro: **lo escriben cuatro cosas al
mismo tiempo**. La llamada en curso lo descuenta por segundo, el consumo de
datos lo descuenta en paralelo, la recarga en el kiosco lo sube, y la
promoción automática de fin de mes lo toca a las 23:59 de todos los últimos
días del mes.

En el pico se tarifican **900.000 llamadas por hora**.

Ya hay un registro de consumo desplegado que copia ese saldo hacia el lado nuevo.
Lo armó el equipo de datos para un tablero de reportes y funciona perfecto
para lo que fue hecho: un gráfico que alguien mira una vez por día. Su atraso
típico es de tres segundos, y para un gráfico tres segundos no significan
nada.

Alguien propuso reusarlo para tarificar.

Hacé la cuenta antes de contestar. Tres segundos de atraso, a 900.000 llamadas
por hora, son **750 llamadas decididas contra un saldo que ya no existe**.
Y el error va siempre en la misma dirección: se deja hablar a quien ya se
quedó sin plata, nunca al revés. No se compensa con el tiempo. Se acumula, y
la primera vez que aparece es en la conciliación de fin de mes.

Hay algo que el motor viejo todavía tiene que seguir haciendo: es el único que
sabe aplicar las promociones heredadas y los planes corporativos con tarifa
negociada, que son, además, los clientes que más facturan.

**Rearmá el sistema** para que el motor nuevo tarifique llamadas reales
leyendo el saldo donde el saldo es verdad, y para que ninguna copia con
atraso quede en el camino de decidir si una llamada sigue o se corta.
