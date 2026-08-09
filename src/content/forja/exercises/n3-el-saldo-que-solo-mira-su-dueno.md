---
title: "El saldo que solo mira su dueño"
level: 3
role: tradeoff
domain: comercio
tradeoffPairId: n3-copia-rapida-segun-la-clase-de-dato
D1: 1
D2: 2
D3: 3
D4: 1
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que explicar por qué volver a dibujar la misma conexión sin declarar la clase de dato no cambia absolutamente nada."
lambda: 0.5
constraints:
  - metric: consultas de saldo por minuto en pico
    operator: ">="
    value: 38000
    unit: consultas
  - metric: desactualización tolerada del saldo mostrado
    operator: "="
    value: 0
    unit: minutos
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "cada consulta de saldo devuelve un número distinto para cada vendedor, junto con su identificación fiscal y las últimas veinte liquidaciones. No hay dos respuestas iguales y ninguna es de cualquiera."
    discoveryPath: "es la razón por la que este ejercicio rechaza la copia rápida y su gemelo la exige. La forma del problema es idéntica; lo que cambia es de quién es el dato."
  - fact: "la copia rápida de saldos se agregó copiando el diseño del catálogo, que funcionaba muy bien. Nadie preguntó qué clase de dato iba a viajar por la conexión nueva."
    discoveryPath: "probá el diseño tal como viene: el motor lo rechaza y nombra la conexión. La pieza no está mal por sí misma, y en la mitad gemela de este par es la respuesta correcta. Está mal para este dato."
  - fact: "borrar la conexión y volver a dibujarla sin declarar qué viaja no cambia nada de lo que pasa en producción."
    discoveryPath: "la garantía no mira la clase declarada: mira si la conexión existe. Dejar de declarar qué viaja no cambia lo que viaja, sólo apaga la única señal que tenías para verlo."
  - fact: "un vendedor vio el saldo de otro durante once minutos en febrero. La copia había quedado indexada por número de sesión y dos sesiones reutilizaron el mismo número."
    discoveryPath: "es la consecuencia concreta de tener el dato de una persona en una pieza pensada para servir lo mismo a todos, rápido."
startingDesign:
  nodes:
    - id: vendedor
      type: actor
      label: Vendedor
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: panel
      type: web-client
      label: Panel del vendedor
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: saldos
      type: service
      label: Servicio de saldos
      zone: private
      role: read-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: copia
      type: cache
      label: Copia rápida de saldos
      zone: private
      given: true
      position: { x: 805, y: 300 }
    - id: basesaldos
      type: database
      label: Base de saldos (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: vendedor-panel
      from: { node: vendedor }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-saldos
      from: { node: gw }
      to: { node: saldos }
      dataClass: personal
    - id: saldos-base
      from: { node: saldos }
      to: { node: basesaldos }
      dataClass: regulated
    - id: saldos-copia
      from: { node: saldos }
      to: { node: copia }
      dataClass: personal
guarantees:
  - id: g-sin-copia-rapida
    label: el saldo del vendedor no se copia a un almacenamiento volátil
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: read-service
      to:
        type: [cache]
    whyMissing: el servicio de saldos sigue conectado a una copia rápida.
    consequence: un almacenamiento volátil sirve lo mismo a quien lo pida, rápido, y no lleva registro de quién pidió qué. En febrero eso fue once minutos de un vendedor mirando el saldo de otro, y el sistema no tuvo forma de contarlo después.
  - id: g-lectura-desde-la-fuente-respaldada
    label: el saldo se lee de la base respaldada, que es donde existe de verdad
    weight: 2
    predicate:
      op: path
      from:
        role: read-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde el servicio de saldos hasta una base con respaldo configurado.
    consequence: "sacar la copia rápida y dejar al servicio sin fuente no muestra un saldo viejo: no muestra ningún saldo. Y si la fuente que queda es una base sin respaldo, la cifra que el vendedor ve (y sobre la que factura) no se puede reconstruir el día que se pierde."
rubric:
  - dimension: el dato personal no vive en una pieza que sirve igual a todos
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-rapida
  - dimension: quitar la copia deja al vendedor viendo su saldo igual
    signal:
      kind: predicate
      guaranteeId: g-lectura-desde-la-fuente-respaldada
referenceSolutions:
  - label: el servicio consulta la base en cada pedido
    contextInversion: "leer la base en cada pedido es lo correcto cuando la respuesta es distinta para cada persona y no se repite: una copia que nunca acierta dos veces no ahorra nada y sí agrega un lugar más donde el dato de alguien queda. Cero piezas nuevas, cero superficie nueva. Se paga con carga real sobre la base, que es la razón por la que esta decisión se revisa el día que las consultas por vendedor se repiten de verdad."
    design:
      nodes:
        - id: vendedor
          type: actor
          label: Vendedor
          zone: public
        - id: panel
          type: web-client
          label: Panel del vendedor
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: saldos
          type: service
          label: Servicio de saldos
          zone: private
          role: read-service
          props: { criticality: "high", replicas: "2" }
        - id: basesaldos
          type: database
          label: Base de saldos (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: vendedor-panel
          from: { node: vendedor }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-saldos
          from: { node: gw }
          to: { node: saldos }
          dataClass: personal
        - id: saldos-base
          from: { node: saldos }
          to: { node: basesaldos }
          dataClass: regulated
  - label: un servicio de consultas separado sobre la misma base
    contextInversion: "separar la consulta conviene cuando las lecturas del panel y las escrituras de la liquidación se pisan: el servicio de consultas se dimensiona para el pico de las nueve de la mañana sin tocar el que registra los movimientos, y el permiso de sólo lectura queda escrito en el diseño y no en la buena memoria de quien despliega. Se paga con una pieza más para operar y con una llamada más entre el panel y el dato."
    design:
      nodes:
        - id: vendedor
          type: actor
          label: Vendedor
          zone: public
        - id: panel
          type: web-client
          label: Panel del vendedor
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: saldos
          type: service
          label: Servicio de saldos
          zone: private
          role: read-service
          props: { criticality: "high", replicas: "2" }
        - id: consultas
          type: service
          label: Servicio de consultas de saldo
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: basesaldos
          type: database
          label: Base de saldos (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: vendedor-panel
          from: { node: vendedor }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-saldos
          from: { node: gw }
          to: { node: saldos }
          dataClass: personal
        - id: saldos-consultas
          from: { node: saldos }
          to: { node: consultas }
          dataClass: personal
        - id: consultas-base
          from: { node: consultas }
          to: { node: basesaldos }
          dataClass: regulated
status: PILOT
---

El mismo marketplace de la mitad gemela de este par, un piso más abajo: el
**panel del vendedor**. **38.000 consultas de saldo por minuto** a las nueve
de la mañana, cuando todos entran a ver cuánto les liquidaron.

El número de consultas es casi el mismo que el del catálogo. El tamaño del
equipo es el mismo. El presupuesto es el mismo. Lo que no es lo mismo es el
dato: cada consulta devuelve **un saldo distinto por vendedor**, con su
identificación fiscal y sus últimas veinte liquidaciones.

Hace ocho meses alguien copió el diseño del catálogo, que funcionaba muy bien,
y le puso una copia rápida adelante. La pregunta que no se hizo fue de quién
era el dato que iba a pasar por ahí.

En **febrero un vendedor vio el saldo de otro durante once minutos**. La
copia estaba indexada por número de sesión y dos sesiones reutilizaron el
mismo número. Nadie pudo decir después cuántas veces había pasado antes: una
copia rápida no lleva registro de quién pidió qué.

Y hay algo que conviene entender antes de empezar: **dejar de declarar qué
viaja por una conexión no cambia lo que viaja**. Apaga la única señal que
tenías para verlo.

El dueño de producto no tolera un saldo viejo: **cero minutos**. Un vendedor
que ve una cifra de hace cinco minutos y factura contra ella factura mal.

El equipo tiene **5 unidades operativas**.

**Rearmá el sistema** para que el saldo deje de tener una segunda casa que
sirve igual a todos, sin que el vendedor se quede sin ver su saldo.

> Este ejercicio tiene una mitad gemela: *El catálogo que miran todos*. Mismo
> problema de lectura, misma pieza sobre la mesa, y la decisión correcta al
> revés. Jugá los dos y comparalos.
