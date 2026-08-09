---
title: "Las cocheras libres del subsuelo"
level: 3
role: trap
domain: movilidad
D1: 2
D2: 2
D3: 2
D4: 1
D5: 2
D6: 2
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir qué comprás y qué pagás por guardar el número de cocheras libres, y por qué la respuesta no es la misma que para el cobro."
lambda: 0.5
constraints:
  - metric: escrituras del conteo por minuto
    operator: ">="
    value: 4300
    unit: escrituras
  - metric: años que el cobro debe conservarse
    operator: ">="
    value: 10
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "el número de cocheras libres se recalcula cada veinte segundos con las barreras de entrada y salida. Después de veinte segundos el valor viejo no es una versión anterior del dato: es un dato equivocado."
    discoveryPath: "preguntate qué harías con el conteo de anoche si mañana el sistema arranca de cero. Mostrar 340 libres porque era lo que había a las once de la noche manda gente al subsuelo a dar vueltas."
  - fact: "el conteo y el cobro se escriben hoy en la misma base porque cuando se armó el sistema eran dos líneas del mismo servicio. El respaldo diario copia 6 GB de conteos que nadie vuelve a leer nunca."
    discoveryPath: "mirá cuántas flechas entran a la base y de dónde vienen. Dos datos con obligaciones distintas escribiendo en el mismo lugar es una decisión que alguien no tomó."
  - fact: "las 4.300 escrituras por minuto del conteo compiten con las escrituras del cobro. En el pico de las siete de la tarde el cobro tarda 900 milisegundos y la barrera queda levantada."
    discoveryPath: "es la consecuencia de que un dato que no importa esté peleando por la misma base que uno que sí. El costo de guardar de más no se paga en disco: se paga en la operación que sí importaba."
  - fact: "la respuesta que aprendiste en los ocho ejercicios anteriores, la de ponerle una base con respaldo a todo lo que se pierde en un reinicio, acá te hace comprar durabilidad para un número que vale veinte segundos, y te deja sin presupuesto para separarlo del cobro."
    discoveryPath: "sumá las unidades operativas de tu diseño antes de probarlo. La durabilidad no es gratis y el presupuesto del ejercicio está puesto justo donde se nota."
startingDesign:
  nodes:
    - id: conductor
      type: actor
      label: Conductor
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
    - id: ocupacion
      type: service
      label: Servicio de ocupación
      zone: private
      role: occupancy-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: cobro
      type: service
      label: Servicio de cobro de barrera
      zone: private
      role: toll-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: basecobros
      type: database
      label: Base de cobros (respaldo diario)
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
      dataClass: public
    - id: gw-ocupacion
      from: { node: gw }
      to: { node: ocupacion }
      dataClass: public
    - id: gw-cobro
      from: { node: gw }
      to: { node: cobro }
      dataClass: personal
    - id: ocupacion-base
      from: { node: ocupacion }
      to: { node: basecobros }
      dataClass: public
    - id: cobro-base
      from: { node: cobro }
      to: { node: basecobros }
      dataClass: regulated
guarantees:
  - id: g-conteo-en-copia-rapida
    label: el conteo de cocheras libres se apoya en un almacenamiento que se vacía solo
    weight: 2
    predicate:
      op: path
      from:
        role: occupancy-service
      to:
        type: [cache]
    whyMissing: no hay ningún camino desde el servicio de ocupación hasta un almacenamiento rápido, así que el número que vale veinte segundos sigue viviendo donde vive lo que hay que conservar diez años.
    consequence: "un dato que se recalcula cada veinte segundos no gana nada sobreviviendo a un reinicio: el valor de anoche no es una versión anterior, es un número equivocado que manda gente a dar vueltas al subsuelo. Lo que sí gana es todo lo que le saca a la base que sí importa."
  - id: g-conteo-fuera-de-la-base
    label: el conteo no escribe en la base donde viven los cobros
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: occupancy-service
      to:
        type: [database]
    whyMissing: el servicio de ocupación sigue escribiendo en una base de datos.
    consequence: "4.300 escrituras por minuto de un número descartable compiten con el cobro que abre la barrera. A las siete de la tarde el cobro tarda 900 milisegundos y la barrera queda levantada, y el respaldo diario copia 6 GB de conteos que nadie va a volver a leer."
  - id: g-cobro-respaldado
    label: el cobro sigue viviendo en una base que se puede restaurar
    weight: 2
    predicate:
      op: path
      from:
        role: toll-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde el servicio de cobro hasta una base con respaldo configurado.
    consequence: "separar los dos datos no significa tratarlos igual del otro lado. El cobro es plata del cliente y hay que conservarlo diez años: es exactamente el dato que sí merece la base con respaldo que el conteo no merece."
rubric:
  - dimension: el dato descartable vive donde le corresponde
    signal:
      kind: predicate
      guaranteeId: g-conteo-en-copia-rapida
  - dimension: lo que no hay que conservar no compite con lo que sí
    signal:
      kind: predicate
      guaranteeId: g-conteo-fuera-de-la-base
  - dimension: la durabilidad se gasta donde hace falta
    signal:
      kind: predicate
      guaranteeId: g-cobro-respaldado
referenceSolutions:
  - label: el conteo vive en la copia rápida y se rehace solo en veinte segundos
    contextInversion: "dejar que la copia se rehaga sola es lo correcto cuando el dato se puede reconstruir más rápido de lo que tarda alguien en notar que falta: después de un reinicio el cartel muestra un guion durante veinte segundos y después el número correcto, que es infinitamente mejor que mostrar el de anoche con cara de actual. Se paga con esos veinte segundos sin número, que es lo que el negocio acepta a cambio de no gastar durabilidad donde no rinde."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Conductor
          zone: public
        - id: app
          type: mobile-client
          label: App del estacionamiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ocupacion
          type: service
          label: Servicio de ocupación
          zone: private
          role: occupancy-service
          props: { criticality: "medium", replicas: "2" }
        - id: cobro
          type: service
          label: Servicio de cobro de barrera
          zone: private
          role: toll-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Copia rápida del conteo
          zone: private
          props: { ttl: "60", eviction: "lru" }
        - id: basecobros
          type: database
          label: Base de cobros (respaldo diario)
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
          dataClass: public
        - id: gw-ocupacion
          from: { node: gw }
          to: { node: ocupacion }
          dataClass: public
        - id: gw-cobro
          from: { node: gw }
          to: { node: cobro }
          dataClass: personal
        - id: ocupacion-copia
          from: { node: ocupacion }
          to: { node: copia }
          dataClass: public
        - id: cobro-base
          from: { node: cobro }
          to: { node: basecobros }
          dataClass: regulated
  - label: el conteo vive en la copia rápida y al arrancar se lo pide al cobro
    contextInversion: "reconstruir desde el servicio de cobro conviene cuando el estacionamiento no tolera ni veinte segundos sin número, como un centro comercial un sábado, con el cartel de la calle decidiendo si el auto entra o sigue de largo: al arrancar, ocupación le pregunta al dueño de las entradas y salidas cuántos autos hay adentro y llena la copia de una. Se paga con una dependencia más en el arranque y con carga extra sobre el servicio que abre la barrera, que es el que menos conviene molestar."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Conductor
          zone: public
        - id: app
          type: mobile-client
          label: App del estacionamiento
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ocupacion
          type: service
          label: Servicio de ocupación
          zone: private
          role: occupancy-service
          props: { criticality: "medium", replicas: "2" }
        - id: cobro
          type: service
          label: Servicio de cobro de barrera
          zone: private
          role: toll-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Copia rápida del conteo
          zone: private
          props: { ttl: "60", eviction: "lru" }
        - id: basecobros
          type: database
          label: Base de cobros (respaldo diario)
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
          dataClass: public
        - id: gw-ocupacion
          from: { node: gw }
          to: { node: ocupacion }
          dataClass: public
        - id: gw-cobro
          from: { node: gw }
          to: { node: cobro }
          dataClass: personal
        - id: ocupacion-copia
          from: { node: ocupacion }
          to: { node: copia }
          dataClass: public
        - id: ocupacion-cobro
          from: { node: ocupacion }
          to: { node: cobro }
          dataClass: public
        - id: cobro-base
          from: { node: cobro }
          to: { node: basecobros }
          dataClass: regulated
status: PILOT
---

Un centro comercial con **1.200 cocheras** en el subsuelo. Dos números salen del
mismo sistema y hoy los trata igual.

El primero es el **cobro**. Cada auto que sale paga en la barrera. Es plata del
cliente, hay comprobante fiscal y hay que conservarlo **diez años**.

El segundo es **cuántas cocheras hay libres**. Un entero entre 0 y 1.200 que se
recalcula cada veinte segundos con las barreras de entrada y salida, y que se
muestra en el cartel de la calle y en la app.

Los dos se escriben en la misma base. Fueron dos líneas del mismo servicio
cuando el sistema se armó, y quedó.

Los números de hoy: **4.300 escrituras por minuto** del conteo compitiendo con
las del cobro. A las siete de la tarde el cobro tarda **900 milisegundos** y la
barrera queda levantada. El respaldo diario copia **6 GB de conteos** que nadie
vuelve a leer nunca.

Y ahora la parte incómoda. Venís de ocho ejercicios donde la respuesta fue casi
siempre la misma: si un dato se pierde en un reinicio, ponele una casa que
sobreviva. Acá ese reflejo te hace comprar durabilidad para un número que vale
veinte segundos.

Pensalo desde el otro lado: si esta noche el sistema arranca de cero, **¿qué
querés que muestre el cartel?** ¿El 340 de anoche, con cara de actual, mandando
autos a dar vueltas al subsuelo? ¿O nada durante veinte segundos y después el
número de verdad?

El equipo tiene **5 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que el conteo deje de pelearle la base al cobro y
para que el cobro siga estando donde tiene que estar. La pregunta que ordena
todo es cuál de los dos merece que gastes durabilidad en él.
