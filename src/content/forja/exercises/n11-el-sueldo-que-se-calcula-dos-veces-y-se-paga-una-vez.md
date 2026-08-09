---
title: "El sueldo que se calcula dos veces y se paga una vez"
level: 11
role: core
domain: nomina
D1: 3
D2: 3
D3: 3
D4: 4
D5: 3
D6: 3
D7: 3
D8: 1
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que explicar por qué el motor nuevo calcula todos los sueldos y no paga ninguno."
lambda: 0.5
constraints:
  - metric: personas liquidadas cada mes
    operator: ">="
    value: 6200
    unit: liquidaciones/mes
  - metric: liquidaciones que el motor nuevo tiene que haber calculado antes de pagar la primera
    operator: ">="
    value: 3
    unit: cierres mensuales
hiddenFacts:
  - fact: "el motor nuevo ya está desplegado y conectado a su propia base, pero no recibe una sola liquidación. Se terminó hace cuatro meses y nunca hubo forma de darle trabajo sin que ese trabajo fuera el sueldo real de alguien."
    discoveryPath: "está en el lienzo desde el principio y no tiene ninguna conexión entrante. Un motor de cálculo que nadie alimentó no tiene resultados que comparar, así que la decisión de encenderlo no se puede tomar con evidencia: se toma con fe."
  - fact: "hay una conexión del motor nuevo al banco que quedó de una prueba de enero. Nadie la sacó porque nadie recordaba que estuviera."
    discoveryPath: "seguí las flechas que salen del motor nuevo. Una de ellas termina en el banco: el día que ese motor procese una liquidación de verdad, la orden de pago sale, y sale además de la que ya mandó el motor viejo."
  - fact: "las diferencias entre los dos motores no aparecen en el sueldo promedio: aparecen en el 3 % de los casos con convenio especial, licencias sin goce y embargos judiciales. Ese 3 % son 186 personas por mes."
    discoveryPath: "preguntate qué se compara y contra qué. Si el resultado del motor nuevo no queda escrito en ningún lado, la comparación es lo que alguien recuerde de la corrida de ayer, y las diferencias que importan son las que aparecen una vez cada tres meses."
startingDesign:
  nodes:
    - id: analista
      type: actor
      label: Analista de nómina
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de liquidaciones
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: recepcion
      type: service
      label: Servicio de liquidación
      zone: private
      role: intake-payroll
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: motorviejo
      type: worker
      label: Motor de cálculo (viejo)
      zone: private
      role: legacy-payroll
      given: true
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 410 }
    - id: motornuevo
      type: worker
      label: Motor de cálculo (nuevo)
      zone: private
      role: new-payroll
      given: true
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 520 }
    - id: liquidaciones
      type: database
      label: Base de liquidaciones
      zone: restricted
      role: payroll-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 530 }
    - id: comparacion
      type: database
      label: Base de resultados del motor nuevo
      zone: restricted
      role: shadow-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 640 }
    - id: banco
      type: external-provider
      label: Banco pagador
      zone: dmz
      given: true
      position: { x: 445, y: 650 }
  edges:
    - id: analista-portal
      from: { node: analista }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-recepcion
      from: { node: gw }
      to: { node: recepcion }
      dataClass: personal
    - id: recepcion-motorviejo
      from: { node: recepcion }
      to: { node: motorviejo }
      dataClass: personal
    - id: motorviejo-liquidaciones
      from: { node: motorviejo }
      to: { node: liquidaciones }
      dataClass: personal
    - id: motorviejo-banco
      from: { node: motorviejo }
      to: { node: banco }
      dataClass: personal
    - id: motornuevo-comparacion
      from: { node: motornuevo }
      to: { node: comparacion }
      dataClass: personal
    - id: motornuevo-banco
      from: { node: motornuevo }
      to: { node: banco }
      dataClass: personal
guarantees:
  - id: g-paying-lane
    label: la liquidación que se paga sigue saliendo del motor viejo
    weight: 2
    predicate:
      op: path
      from:
        role: intake-payroll
      to:
        role: payroll-store
      via:
        role: legacy-payroll
    whyMissing: no hay ningún camino desde el servicio de liquidación hasta la base de liquidaciones que pase por el motor viejo.
    consequence: "el motor viejo es el único que lleva once años de parches de convenio, licencias y embargos encima. Sacarlo del camino que paga antes de tener evidencia de que el nuevo calcula igual no es migrar: es apostar el sueldo de 6.200 personas a que no hay ningún caso raro."
  - id: g-shadow-fed
    label: el motor nuevo recibe las mismas liquidaciones, y las recibe por algo que sobrevive a un reinicio
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: intake-payroll
      to:
        role: new-payroll
    whyMissing: el motor nuevo no recibe nada, o lo recibe por un camino donde no hay ninguna pieza durable en el medio.
    consequence: "un motor que nadie alimentó no produce diferencias que comparar: la decisión de encenderlo se toma sin datos. Y si el trabajo le llega por un camino sin nada durable en el medio, la corrida que se cayó a las tres de la mañana no se puede repetir: se perdió el mes entero de evidencia."
  - id: g-shadow-never-pays
    label: el motor nuevo no escribe la liquidación que se paga ni le habla al banco
    weight: 2
    predicate:
      op: all
      of:
        - op: edgeAbsent
          from:
            role: new-payroll
          to:
            role: payroll-store
        - op: edgeAbsent
          from:
            role: new-payroll
          to:
            type: [external-provider]
    whyMissing: el motor nuevo todavía puede escribir en la base que se paga, o todavía tiene una conexión al banco.
    consequence: "una corrida en sombra que puede pagar no es una corrida en sombra: es un segundo sistema de pagos que nadie autorizó. El día que el motor nuevo procese una liquidación de verdad salen dos órdenes al banco por la misma persona, y el error se descubre por el lado del que cobró dos veces."
  - id: g-shadow-recorded
    label: el resultado del motor nuevo queda escrito para poder compararlo
    weight: 1
    predicate:
      op: path
      from:
        role: new-payroll
      to:
        role: shadow-store
    whyMissing: el motor nuevo calcula y su resultado no termina en ningún almacenamiento propio.
    consequence: "las diferencias que importan están en el 3 % de casos con convenio especial, licencias y embargos: 186 personas por mes. Sin el resultado escrito, la comparación es lo que alguien se acuerde de la corrida de ayer, y ese 3 % aparece de a poco a lo largo de varios cierres."
  - id: g-bank-from-legacy
    label: la orden de pago al banco sigue saliendo del motor viejo
    weight: 1
    predicate:
      op: path
      from:
        role: legacy-payroll
      to:
        type: [external-provider]
    whyMissing: el motor viejo ya no llega al banco, así que nadie está pagando los sueldos.
    consequence: "congelar el motor nuevo no sirve de nada si en el camino se cortó el que sí paga. La convivencia tiene una sola regla que no se negocia: el mes que viene los sueldos se acreditan igual que este mes."
rubric:
  - dimension: la vía que paga queda intacta
    signal:
      kind: predicate
      guaranteeId: g-paying-lane
  - dimension: el motor nuevo procesa carga real por una pieza durable
    signal:
      kind: predicate
      guaranteeId: g-shadow-fed
  - dimension: la corrida en sombra no puede producir efectos
    signal:
      kind: predicate
      guaranteeId: g-shadow-never-pays
  - dimension: hay evidencia escrita para comparar los dos motores
    signal:
      kind: predicate
      guaranteeId: g-shadow-recorded
  - dimension: los sueldos se siguen pagando durante toda la convivencia
    signal:
      kind: predicate
      guaranteeId: g-bank-from-legacy
referenceSolutions:
  - label: un solo registro de eventos que alimenta a los dos motores
    contextInversion: "un único registro con dos consumidores conviene cuando lo que se compara tiene que ser exactamente el mismo insumo: los dos motores leen el mismo mensaje, en el mismo orden, así que una diferencia en el resultado sólo puede venir del cálculo y nunca de que uno recibió algo distinto. Se paga con acoplamiento operativo: si ese registro se atrasa, se atrasan los dos motores a la vez, incluido el que paga."
    design:
      nodes:
        - id: analista
          type: actor
          label: Analista de nómina
          zone: public
        - id: portal
          type: web-client
          label: Portal de liquidaciones
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: recepcion
          type: service
          label: Servicio de liquidación
          zone: private
          role: intake-payroll
          props: { criticality: "high", replicas: "2" }
        - id: canal
          type: stream
          label: Registro de liquidaciones
          zone: private
          props: { retention: "30d", ordering: "sí" }
        - id: motorviejo
          type: worker
          label: Motor de cálculo (viejo)
          zone: private
          role: legacy-payroll
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: motornuevo
          type: worker
          label: Motor de cálculo (nuevo, en sombra)
          zone: private
          role: new-payroll
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: liquidaciones
          type: database
          label: Base de liquidaciones
          zone: restricted
          role: payroll-store
          props: { backup: "diario" }
        - id: comparacion
          type: database
          label: Base de resultados del motor nuevo
          zone: restricted
          role: shadow-store
          props: { backup: "diario" }
        - id: banco
          type: external-provider
          label: Banco pagador
          zone: dmz
        - id: obs
          type: observability
          label: Observabilidad de los dos motores
          zone: private
      edges:
        - id: analista-portal
          from: { node: analista }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-recepcion
          from: { node: gw }
          to: { node: recepcion }
          dataClass: personal
        - id: recepcion-canal
          from: { node: recepcion }
          to: { node: canal }
          dataClass: personal
        - id: canal-motorviejo
          from: { node: canal }
          to: { node: motorviejo }
          dataClass: personal
        - id: canal-motornuevo
          from: { node: canal }
          to: { node: motornuevo }
          dataClass: personal
        - id: motorviejo-liquidaciones
          from: { node: motorviejo }
          to: { node: liquidaciones }
          dataClass: personal
        - id: motorviejo-banco
          from: { node: motorviejo }
          to: { node: banco }
          dataClass: personal
        - id: motornuevo-comparacion
          from: { node: motornuevo }
          to: { node: comparacion }
          dataClass: personal
        - id: motorviejo-obs
          from: { node: motorviejo }
          to: { node: obs }
          dataClass: public
        - id: motornuevo-obs
          from: { node: motornuevo }
          to: { node: obs }
          dataClass: public
  - label: dos colas separadas, una por motor
    contextInversion: "dar a cada motor su propia cola conviene cuando la corrida en sombra no puede tener ninguna chance de frenar a la que paga: el motor nuevo puede atrasarse una semana, llenarse, reprocesarse entero, y del otro lado no se entera nadie. El precio es que ya no hay garantía de que los dos hayan leído lo mismo, así que una diferencia de resultado obliga primero a probar que el insumo era el mismo, y esa investigación cuesta más que la unidad operativa que se ahorró."
    design:
      nodes:
        - id: analista
          type: actor
          label: Analista de nómina
          zone: public
        - id: portal
          type: web-client
          label: Portal de liquidaciones
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: recepcion
          type: service
          label: Servicio de liquidación
          zone: private
          role: intake-payroll
          props: { criticality: "high", replicas: "2" }
        - id: colaviejo
          type: queue
          label: Cola del motor viejo
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: colanuevo
          type: queue
          label: Cola del motor nuevo
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: motorviejo
          type: worker
          label: Motor de cálculo (viejo)
          zone: private
          role: legacy-payroll
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: motornuevo
          type: worker
          label: Motor de cálculo (nuevo, en sombra)
          zone: private
          role: new-payroll
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: liquidaciones
          type: database
          label: Base de liquidaciones
          zone: restricted
          role: payroll-store
          props: { backup: "diario" }
        - id: comparacion
          type: database
          label: Base de resultados del motor nuevo
          zone: restricted
          role: shadow-store
          props: { backup: "diario" }
        - id: banco
          type: external-provider
          label: Banco pagador
          zone: dmz
      edges:
        - id: analista-portal
          from: { node: analista }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-recepcion
          from: { node: gw }
          to: { node: recepcion }
          dataClass: personal
        - id: recepcion-colaviejo
          from: { node: recepcion }
          to: { node: colaviejo }
          dataClass: personal
        - id: recepcion-colanuevo
          from: { node: recepcion }
          to: { node: colanuevo }
          dataClass: personal
        - id: colaviejo-motorviejo
          from: { node: colaviejo }
          to: { node: motorviejo }
          dataClass: personal
        - id: colanuevo-motornuevo
          from: { node: colanuevo }
          to: { node: motornuevo }
          dataClass: personal
        - id: motorviejo-liquidaciones
          from: { node: motorviejo }
          to: { node: liquidaciones }
          dataClass: personal
        - id: motorviejo-banco
          from: { node: motorviejo }
          to: { node: banco }
          dataClass: personal
        - id: motornuevo-comparacion
          from: { node: motornuevo }
          to: { node: comparacion }
          dataClass: personal
status: PILOT
---

Una empresa liquida **6.200 sueldos por mes**. El motor que los calcula tiene
once años y adentro están, uno arriba del otro, todos los convenios que se
firmaron desde entonces: adicionales por antigüedad, licencias sin goce,
embargos judiciales, un régimen especial para el personal de planta que
ingresó antes de 2016.

El motor nuevo se terminó hace cuatro meses. Está desplegado, tiene su propia
base, y **no calculó una sola liquidación**. La razón no es técnica: no hubo
manera de darle trabajo sin que ese trabajo fuera el sueldo real de alguien.
Un error del motor viejo se arregla con una nota de crédito el mes siguiente.
Un error del motor nuevo en su primera corrida es 6.200 personas mirando el
depósito de su sueldo.

Dirección financiera puso una condición razonable y explícita: **el motor
nuevo tiene que haber calculado tres cierres completos, contra los datos
reales, antes de pagar el primero**. No una muestra, no un entorno de prueba
con datos de hace dos años: los tres cierres reales, con los mismos insumos
que usó el motor viejo.

Hay dos cosas más que conviene mirar antes de tocar nada.

La primera: las diferencias entre los dos motores no van a aparecer en el
sueldo promedio. Van a aparecer en el **3 % de casos con convenio especial,
licencia o embargo**: 186 personas por mes, repartidas de manera despareja a
lo largo del año. Comparar de memoria no alcanza.

La segunda: hay una conexión del motor nuevo al banco que quedó de una prueba
de enero. Está en el diagrama. Nadie la sacó porque nadie se acordaba de que
estuviera ahí.

**Rearmá el sistema** para que el motor nuevo procese todas las liquidaciones
reales, para que su resultado quede escrito y comparable, y para que no pueda
tocar ni la liquidación que se paga ni el banco hasta que alguien decida,
con tres cierres de evidencia encima, que ya está.
