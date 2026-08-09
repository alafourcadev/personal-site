---
title: "Las noventa y seis bases que nadie actualizó"
level: 8
role: trap
domain: farmacia
D1: 4
D2: 3
D3: 3
D4: 2
D5: 3
D6: 3
D7: 1
D8: 1
D9: 3
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar qué exige el regulador exactamente y qué se inventó el equipo por su cuenta, y cuánto cuesta operar una decisión de aislamiento multiplicada por noventa y seis."
lambda: 0.6
constraints:
  - metric: farmacias sobre la misma plataforma
    operator: ">="
    value: 96
    unit: farmacias
  - metric: personas en el equipo de plataforma
    operator: "<="
    value: 2
    unit: personas
hiddenFacts:
  - fact: "la resolución del ministerio exige un campo nuevo en la receta electrónica y un registro consolidado de dispensación. En ninguna parte pide que cada farmacia tenga su propio almacén: eso lo decidió el equipo en 2019, cuando eran tres farmacias y sonaba prudente."
    discoveryPath: "leé qué pide el regulador y compará con lo que hay construido. La regla que gobierna el diseño de hoy no viene de afuera; viene de una decisión razonable tomada con tres clientes y nunca revisada con noventa y seis."
  - fact: "el cambio de esquema se aplica farmacia por farmacia. En marzo se aplicó en 85 de las 96. Las once que quedaron atrás emitieron 2.400 recetas sin el campo nuevo, y la obra social las rechazó todas."
    discoveryPath: "el lienzo muestra tres de los noventa y seis almacenes. Lo que haya que hacerle a estos tres, hay que hacérselo noventa y seis veces, con dos personas."
  - fact: "el respaldo se configuró almacén por almacén. En siete quedó sin configurar y nadie lo miró durante dos años, porque no hay un solo lugar donde mirar."
    discoveryPath: "revisá el respaldo de cada uno de los tres almacenes del lienzo. Una configuración que se repite noventa y seis veces a mano no es una configuración: es una lotería con noventa y seis boletos."
  - fact: "el envío a la obra social consulta los almacenes de las farmacias directamente, uno por uno, y arma el lote. Cuando se sumó la farmacia 97, nadie agregó su almacén a la lista y esa farmacia no cobró durante dos meses."
    discoveryPath: "seguí el camino del envío a la obra social. Un proceso que tiene que conocer la lista de todos los inquilinos se rompe en silencio cada vez que entra uno nuevo."
startingDesign:
  nodes:
    - id: farmaceutico
      type: actor
      label: Farmacéutico
      zone: public
      given: true
      position: { x: 85, y: 90 }
    - id: mostrador
      type: web-client
      label: Mostrador
      zone: public
      given: true
      position: { x: 445, y: 90 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 200 }
    - id: dispensacion
      type: service
      label: Servicio de dispensación
      zone: private
      role: dispensing-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 320 }
    - id: cola
      type: queue
      label: Cola de envíos a la obra social
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 320 }
    - id: envios
      type: worker
      label: Envío a la obra social
      zone: private
      role: claims-worker
      given: true
      position: { x: 445, y: 430 }
    - id: comun
      type: database
      label: Base común de la plataforma
      zone: restricted
      role: shared-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 540 }
    - id: norte
      type: database
      label: Base de Farmacia Norte
      zone: restricted
      role: norte-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 650 }
    - id: centro
      type: database
      label: Base de Farmacia Centro
      zone: restricted
      role: centro-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 760 }
    - id: sur
      type: database
      label: Base de Farmacia Sur
      zone: restricted
      role: sur-store
      given: true
      props: { backup: "none" }
      position: { x: 805, y: 870 }
  edges:
    - id: farmaceutico-mostrador
      from: { node: farmaceutico }
      to: { node: mostrador }
      dataClass: public
    - id: mostrador-gw
      from: { node: mostrador }
      to: { node: gw }
      dataClass: regulated
    - id: gw-dispensacion
      from: { node: gw }
      to: { node: dispensacion }
      dataClass: regulated
    - id: dispensacion-comun
      from: { node: dispensacion }
      to: { node: comun }
      dataClass: regulated
    - id: dispensacion-norte
      from: { node: dispensacion }
      to: { node: norte }
      dataClass: regulated
    - id: dispensacion-centro
      from: { node: dispensacion }
      to: { node: centro }
      dataClass: regulated
    - id: dispensacion-sur
      from: { node: dispensacion }
      to: { node: sur }
      dataClass: regulated
    - id: dispensacion-cola
      from: { node: dispensacion }
      to: { node: cola }
      dataClass: regulated
    - id: cola-envios
      from: { node: cola }
      to: { node: envios }
      dataClass: regulated
    - id: envios-norte
      from: { node: envios }
      to: { node: norte }
      dataClass: regulated
    - id: envios-centro
      from: { node: envios }
      to: { node: centro }
      dataClass: regulated
    - id: envios-sur
      from: { node: envios }
      to: { node: sur }
      dataClass: regulated
guarantees:
  - id: g-no-store-per-tenant
    label: no queda ningún almacén dedicado a una sola farmacia
    weight: 3
    predicate:
      op: not
      of:
        - op: any
          of:
            - op: exists
              node:
                role: norte-store
            - op: exists
              node:
                role: centro-store
            - op: exists
              node:
                role: sur-store
    whyMissing: cada farmacia sigue teniendo su propio almacén, y el lienzo muestra tres de noventa y seis.
    consequence: "un cambio de esquema son noventa y seis migraciones, un respaldo son noventa y seis configuraciones y una auditoría son noventa y seis lugares donde mirar, con dos personas. En marzo se aplicaron 85: las once que quedaron atrás emitieron 2.400 recetas que la obra social rechazó. El aislamiento no falló por inseguro; falló porque nadie lo puede sostener."
  - id: g-claims-through-service
    label: el envío a la obra social llega a las recetas por un servicio, no por su cuenta
    weight: 3
    predicate:
      op: path
      from:
        role: claims-worker
      to:
        role: shared-store
      via:
        type: [service]
    whyMissing: no hay ningún camino desde el envío a la obra social hasta el almacén común que pase por un servicio.
    consequence: "un proceso que consulta los almacenes uno por uno tiene que conocer la lista de todos los inquilinos. Cuando entró la farmacia 97, nadie agregó su almacén a esa lista: la farmacia dispensó durante dos meses y no cobró un peso, y el sistema no reportó ningún error porque, desde su punto de vista, no faltaba nada."
  - id: g-claims-no-direct-store
    label: el envío a la obra social no abre ninguna consulta propia contra un almacén
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: claims-worker
      to:
        type: [database]
    whyMissing: el envío a la obra social sigue conectado directamente a los almacenes de las farmacias.
    consequence: consolidar los almacenes y dejar abierto el camino directo cambia el problema de lugar sin resolverlo. Ahora hay un solo almacén con las recetas de las noventa y seis, y un proceso que lo consulta sin que nadie le diga de qué farmacia está preguntando.
  - id: g-dispensing-still-recorded
    label: el registro de dispensación se sigue guardando en el almacén común de la plataforma
    weight: 2
    predicate:
      op: path
      from:
        role: dispensing-service
      to:
        role: shared-store
    whyMissing: no queda ningún camino desde el servicio de dispensación hasta el almacén común.
    consequence: borrar los noventa y seis almacenes también cumple lo demás, y deja al ministerio sin el registro consolidado que sí exige la resolución. Consolidar es mover el dato a un solo lugar, no dejar de guardarlo.
rubric:
  - dimension: la operación deja de multiplicarse por la cantidad de clientes
    signal:
      kind: predicate
      guaranteeId: g-no-store-per-tenant
  - dimension: nadie consulta el almacén compartido sin pasar por quien sabe de qué farmacia pregunta
    signal:
      kind: predicate
      guaranteeId: g-claims-through-service
  - dimension: no queda un camino lateral hacia el almacén
    signal:
      kind: predicate
      guaranteeId: g-claims-no-direct-store
  - dimension: el registro que sí exige el regulador se sigue produciendo
    signal:
      kind: predicate
      guaranteeId: g-dispensing-still-recorded
referenceSolutions:
  - label: un solo almacén y una sola puerta
    contextInversion: "que el mismo servicio de dispensación sea la única puerta del almacén conviene cuando la regla \"toda consulta lleva la farmacia\" tiene que existir en un solo lugar y el equipo son dos personas: una implementación, un despliegue, una migración. Se paga con que el envío a la obra social, que corre de noche y lee mucho, y el mostrador, que no puede esperar, comparten el mismo servicio, y un lote pesado se nota en la caja."
    design:
      nodes:
        - id: farmaceutico
          type: actor
          label: Farmacéutico
          zone: public
        - id: mostrador
          type: web-client
          label: Mostrador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: dispensacion
          type: service
          label: Servicio de dispensación
          zone: private
          role: dispensing-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de envíos a la obra social
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: envios
          type: worker
          label: Envío a la obra social
          zone: private
          role: claims-worker
        - id: comun
          type: database
          label: Base común de la plataforma
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
      edges:
        - id: farmaceutico-mostrador
          from: { node: farmaceutico }
          to: { node: mostrador }
          dataClass: public
        - id: mostrador-gw
          from: { node: mostrador }
          to: { node: gw }
          dataClass: regulated
        - id: gw-dispensacion
          from: { node: gw }
          to: { node: dispensacion }
          dataClass: regulated
        - id: dispensacion-comun
          from: { node: dispensacion }
          to: { node: comun }
          dataClass: regulated
        - id: dispensacion-cola
          from: { node: dispensacion }
          to: { node: cola }
          dataClass: regulated
        - id: cola-envios
          from: { node: cola }
          to: { node: envios }
          dataClass: regulated
        - id: envios-dispensacion
          from: { node: envios }
          to: { node: dispensacion }
          dataClass: regulated
  - label: un servicio de lectura aparte para el envío a la obra social
    contextInversion: "separar un servicio de lectura conviene cuando el lote nocturno lee millones de recetas y no puede robarle capacidad al mostrador: se escala, se limita y se pausa sin tocar el servicio que atiende al farmacéutico. Se paga con una pieza más para operar, que con dos personas ya es una decisión y no un detalle, y con que la regla \"toda consulta lleva la farmacia\" pasa a vivir en dos servicios, que es exactamente el tipo de cosa que se desincroniza sin que nadie lo note."
    design:
      nodes:
        - id: farmaceutico
          type: actor
          label: Farmacéutico
          zone: public
        - id: mostrador
          type: web-client
          label: Mostrador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: dispensacion
          type: service
          label: Servicio de dispensación
          zone: private
          role: dispensing-service
          props: { criticality: "high", replicas: "2" }
        - id: lecturas
          type: service
          label: Servicio de lectura de recetas
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de envíos a la obra social
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: envios
          type: worker
          label: Envío a la obra social
          zone: private
          role: claims-worker
        - id: comun
          type: database
          label: Base común de la plataforma
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
      edges:
        - id: farmaceutico-mostrador
          from: { node: farmaceutico }
          to: { node: mostrador }
          dataClass: public
        - id: mostrador-gw
          from: { node: mostrador }
          to: { node: gw }
          dataClass: regulated
        - id: gw-dispensacion
          from: { node: gw }
          to: { node: dispensacion }
          dataClass: regulated
        - id: dispensacion-comun
          from: { node: dispensacion }
          to: { node: comun }
          dataClass: regulated
        - id: dispensacion-cola
          from: { node: dispensacion }
          to: { node: cola }
          dataClass: regulated
        - id: cola-envios
          from: { node: cola }
          to: { node: envios }
          dataClass: regulated
        - id: envios-lecturas
          from: { node: envios }
          to: { node: lecturas }
          dataClass: regulated
        - id: lecturas-comun
          from: { node: lecturas }
          to: { node: comun }
          dataClass: regulated
status: PILOT
---

Una plataforma de gestión para **96 farmacias independientes**. Receta,
dispensación, stock y el envío mensual a la obra social. El equipo son **dos
personas**.

En 2019, cuando eran tres farmacias, se tomó una decisión que sonaba
prudente: **cada farmacia con su propio almacén**. El dato de una receta no se
mezcla con el de nadie.

Hoy son noventa y seis almacenes.

En marzo salió una resolución del ministerio: un campo nuevo obligatorio en la
receta electrónica. El cambio de esquema se aplica almacén por almacén. Se
aplicó en **85**. Las once que quedaron atrás emitieron **2.400 recetas sin el
campo**, y la obra social las rechazó todas. Nadie se enteró hasta que
llamaron once dueños distintos.

El respaldo también se configura almacén por almacén. En **siete** quedó sin
configurar. Estuvo así dos años, porque no hay un solo lugar donde mirar.

Y el envío a la obra social consulta los almacenes de a uno, con la lista de
las noventa y seis adentro. Cuando entró la farmacia 97, nadie la agregó a esa
lista. Dispensó dos meses y no cobró un peso. El sistema no reportó ningún
error: desde su punto de vista, no faltaba nada.

El lienzo muestra **tres** de los noventa y seis. Lo que le hagas a estos
tres, hay que hacérselo noventa y seis veces.

Vale la pena leer la resolución antes de diseñar. Pide un campo en la receta y
un registro consolidado de dispensación. No pide, en ninguna parte, que cada
farmacia tenga su propio almacén.

El equipo declara **6 unidades operativas**. El diseño de hoy, con los tres
almacenes del lienzo, ya pide 8. Con los noventa y seis pide 101.

**Rearmá el sistema** para que operar la plataforma deje de costar lo que
cuesta multiplicado por la cantidad de clientes, y para que nadie consulte el
almacén que queda sin decir de qué farmacia está preguntando.
