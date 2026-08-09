---
title: "El saldo del abonado"
level: 3
role: counter-trap
domain: movilidad
D1: 2
D2: 1
D3: 2
D4: 2
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 4
aiBudget: "libre, pero tu respuesta tiene que decir en qué se parece este número al conteo de cocheras libres y en qué no, y por qué esa diferencia manda."
lambda: 0.5
constraints:
  - metric: consultas de saldo por minuto en pico
    operator: ">="
    value: 9000
    unit: consultas
  - metric: tiempo máximo para que la barrera decida
    operator: "<="
    value: 300
    unit: milisegundos
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: "el saldo del abonado prepago es plata que el cliente ya pagó. No se recalcula desde ningún lado: es el resultado acumulado de recargas y consumos que ocurrieron una sola vez cada uno."
    discoveryPath: "preguntate cómo se reconstruye este número si mañana no está. El conteo de cocheras se rehace solo en veinte segundos mirando las barreras; el saldo no se rehace con nada, porque no hay ninguna otra fuente que lo tenga."
  - fact: "en abril un reinicio de rutina dejó a 380 abonados en cero. Se reconstruyó a mano durante nueve días, cruzando comprobantes de recarga en papel, y hubo catorce reclamos que se pagaron sin poder verificarlos."
    discoveryPath: "es la consecuencia de que la única casa del saldo sea una pieza cuyo trabajo es olvidar. El sistema no falló: la copia rápida hizo exactamente lo que promete hacer."
  - fact: "la base de abonados existe desde el principio y guarda el nombre, la patente y el plan. El saldo nunca se movió ahí porque la copia rápida contestaba en 4 milisegundos y la base en 30."
    discoveryPath: "está en el lienzo sin ninguna conexión. Que una pieza esté suelta no significa que sobre: significa que la decisión se tomó mirando un solo número, el de los milisegundos."
  - fact: "cambiar la etiqueta de la conexión no cambia lo que viaja por ella. Declarar el saldo como dato público para que el motor deje de protestar deja el mismo saldo en el mismo lugar."
    discoveryPath: "probalo: el bloqueante desaparece y el problema no. La etiqueta es la única señal que tenías para verlo, no la causa."
startingDesign:
  nodes:
    - id: conductor
      type: actor
      label: Abonado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App del estacionamiento
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
      label: Servicio de saldos del abono
      zone: private
      role: balance-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: copia
      type: cache
      label: Copia rápida de saldos
      zone: private
      given: true
      position: { x: 805, y: 300 }
    - id: baseabonados
      type: database
      label: Base de abonados (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: conductor-app
      from: { node: conductor }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-saldos
      from: { node: gw }
      to: { node: saldos }
      dataClass: personal
    - id: saldos-copia
      from: { node: saldos }
      to: { node: copia }
      dataClass: personal
guarantees:
  - id: g-saldo-en-base-respaldada
    label: el saldo del abonado vive en una base que se puede restaurar
    weight: 2
    predicate:
      op: path
      from:
        role: balance-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde el servicio de saldos hasta una base con respaldo configurado, así que el saldo existe únicamente donde existe hoy.
    consequence: "este número no se recalcula desde ninguna parte: es el acumulado de recargas y consumos que ocurrieron una sola vez cada uno. Cuando no está, no hay de dónde sacarlo, y reconstruirlo son nueve días cruzando comprobantes de papel."
  - id: g-saldo-fuera-de-la-copia-rapida
    label: el saldo no tiene como casa un almacenamiento que se vacía solo
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: balance-service
      to:
        type: [cache]
    whyMissing: el servicio de saldos sigue conectado a la copia rápida, que es donde el saldo vive hoy.
    consequence: "una copia rápida no promete conservar nada y no tiene por qué prometerlo. En abril eso fueron 380 abonados en cero después de un reinicio de rutina, catorce reclamos pagados sin poder verificarlos, y ninguna falla que reportar: la pieza hizo exactamente su trabajo."
rubric:
  - dimension: el dato que no se puede reconstruir tiene una casa que lo conserva
    signal:
      kind: predicate
      guaranteeId: g-saldo-en-base-respaldada
  - dimension: la velocidad no compra el derecho a perder plata del cliente
    signal:
      kind: predicate
      guaranteeId: g-saldo-fuera-de-la-copia-rapida
referenceSolutions:
  - label: el saldo se lee y se escribe en la base de abonados
    contextInversion: "escribir y leer directo en la base es lo correcto cuando el saldo es un número por abonado que cambia en cada paso por la barrera y se consulta en el mismo instante en que cambia: no hay nada que copiar porque la respuesta nunca se repite, y los 30 milisegundos de la base entran de sobra en los 300 que la barrera tolera. Cero piezas nuevas y una sola casa del dato. Se paga con carga real sobre la base, que es la razón por la que esta decisión se revisa el día que el estacionamiento pase de mil doscientas cocheras a diez mil."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Abonado
          zone: public
        - id: app
          type: mobile-client
          label: App del estacionamiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: saldos
          type: service
          label: Servicio de saldos del abono
          zone: private
          role: balance-service
          props: { criticality: "high", replicas: "2" }
        - id: baseabonados
          type: database
          label: Base de abonados (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: conductor-app
          from: { node: conductor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-saldos
          from: { node: gw }
          to: { node: saldos }
          dataClass: personal
        - id: saldos-base
          from: { node: saldos }
          to: { node: baseabonados }
          dataClass: regulated
  - label: el saldo en la base y cada movimiento archivado aparte
    contextInversion: "archivar el movimiento además del saldo conviene cuando el reclamo típico no es '¿cuánto tengo?' sino '¿por qué me descontaron esto el jueves?': el saldo es un número y el movimiento es la historia que lo explica, y guardar la historia en un archivo de objetos no suma nada para operar ni engorda el respaldo de la base. Se paga con dos lugares donde queda rastro del abonado, y eso significa acordarse de los dos el día que hay que borrarlo."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Abonado
          zone: public
        - id: app
          type: mobile-client
          label: App del estacionamiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: saldos
          type: service
          label: Servicio de saldos del abono
          zone: private
          role: balance-service
          props: { criticality: "high", replicas: "2" }
        - id: baseabonados
          type: database
          label: Base de abonados (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: movimientos
          type: object-storage
          label: Archivo de movimientos del abono
          zone: private
      edges:
        - id: conductor-app
          from: { node: conductor }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-saldos
          from: { node: gw }
          to: { node: saldos }
          dataClass: personal
        - id: saldos-base
          from: { node: saldos }
          to: { node: baseabonados }
          dataClass: regulated
        - id: saldos-movimientos
          from: { node: saldos }
          to: { node: movimientos }
          dataClass: regulated
status: PILOT
---

El mismo estacionamiento de *Las cocheras libres del subsuelo*, la otra
pantalla: el **abono prepago**. El abonado carga plata, pasa por la barrera y se
le descuenta. **9.000 consultas de saldo por minuto** en el pico, y la barrera
tiene **300 milisegundos** para decidir si abre.

Se parece muchísimo al otro número. Es un entero, se lee todo el tiempo, cambia
a cada rato, y hoy vive en una copia rápida por la misma razón: contestaba en 4
milisegundos y la base en 30.

Y acá viene lo que hay que ver, porque el ejercicio anterior te enseñó a
desconfiar del reflejo: **la sospecha original acertaba**.

El conteo de cocheras se rehace solo en veinte segundos mirando las barreras. El
saldo **no se rehace con nada**. No es una vista de otra cosa: es el acumulado de
recargas y consumos que ocurrieron una sola vez cada uno. Cuando no está, no hay
de dónde sacarlo.

En **abril un reinicio de rutina dejó a 380 abonados en cero**. Nueve días
reconstruyendo a mano, cruzando comprobantes de recarga en papel. Catorce
reclamos se pagaron sin poder verificarlos. No hubo falla que reportar: la copia
rápida hizo exactamente lo que promete hacer.

La base de abonados existe desde el principio y guarda el nombre, la patente y
el plan, pero **el saldo nunca se movió ahí**. La decisión se tomó mirando un
solo número: los milisegundos.

Un aviso, porque ya pasó: **cambiar la etiqueta de la conexión no cambia lo que
viaja por ella**. Declarar el saldo como dato público hace callar al motor y deja
el mismo saldo en el mismo lugar.

El equipo tiene **4 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que el saldo tenga una casa que lo conserve, sin
dejar al abonado esperando en la barrera.

> Este ejercicio y *Las cocheras libres del subsuelo* hacen la misma pregunta y
> la responden al revés: ¿este número merece que gastes durabilidad en él? La
> diferencia no está en la forma del dato, está en si se puede reconstruir.
