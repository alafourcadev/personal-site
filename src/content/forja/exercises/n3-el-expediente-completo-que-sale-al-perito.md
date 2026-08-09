---
title: "El expediente completo que sale al perito"
level: 3
role: core
domain: seguros
D1: 2
D2: 1
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
aiBudget: "libre, pero tu respuesta tiene que enumerar qué necesita el perito para tasar un choque y qué le estamos mandando además, y decir quién decide esa diferencia en tu diseño."
lambda: 0.5
constraints:
  - metric: siniestros denunciados por mes
    operator: ">="
    value: 4200
    unit: siniestros
  - metric: años que el expediente debe conservarse
    operator: ">="
    value: 10
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "el estudio de peritaje es una empresa de doce personas contratada por acto. Recibe el expediente completo porque fue lo primero que se conectó en 2021 y nadie volvió a mirar qué contenía."
    discoveryPath: "seguí la conexión que sale del servicio de siniestros hacia afuera y mirá qué clase de dato declara. Sale un expediente entero hacia una empresa que no es la aseguradora."
  - fact: "el perito necesita las fotos del vehículo, el número de póliza y el lugar del hecho. No necesita el informe médico del lesionado ni el documento del asegurado, y no tiene forma de no verlos."
    discoveryPath: "el motor no bloquea esta conexión: ninguna regla la prohíbe. Lo que hay es la clase de dato declarada, y con eso alcanza para que alguien lea el diagrama y se dé cuenta de que sale de más."
  - fact: "el servicio de peritaje está en el lienzo desde el rediseño de marzo, sin una sola conexión. Se aprovisionó justamente para armar el paquete reducido y quedó a medio hacer."
    discoveryPath: "está en el lienzo suelto. Que una pieza esté sin conectar no significa que sobre: significa que alguien la puso y no terminó el trabajo."
  - fact: "en abril un perito adjuntó por error el informe médico a su presupuesto y se lo mandó al taller. La aseguradora no pudo decir qué le había entregado, porque no guardaba constancia de lo que salía."
    discoveryPath: "buscá en el lienzo dónde queda lo que se le entregó a un tercero. No está: cada envío existe sólo en el momento en que ocurre."
startingDesign:
  nodes:
    - id: asegurado
      type: actor
      label: Asegurado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de denuncia de siniestro
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: siniestros
      type: service
      label: Servicio de siniestros
      zone: private
      role: claims-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: peritaje
      type: service
      label: Servicio de peritaje
      zone: private
      role: appraisal-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: baseexpedientes
      type: database
      label: Base de expedientes (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: perito
      type: external-provider
      label: Estudio de peritaje externo
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: asegurado-app
      from: { node: asegurado }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-siniestros
      from: { node: gw }
      to: { node: siniestros }
      dataClass: personal
    - id: siniestros-base
      from: { node: siniestros }
      to: { node: baseexpedientes }
      dataClass: regulated
    - id: siniestros-perito
      from: { node: siniestros }
      to: { node: perito }
      dataClass: regulated
guarantees:
  - id: g-expediente-no-sale-entero
    label: el expediente no sale directamente hacia el estudio externo
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: claims-service
      to:
        type: [external-provider]
    whyMissing: el servicio de siniestros sigue conectado directo con el estudio de peritaje externo, y lo que le manda es el expediente que tiene, no el que el perito necesita.
    consequence: "una empresa de doce personas contratada por acto recibe el informe médico del lesionado porque venía en el mismo sobre. Nadie decidió mandárselo: el sobre era lo que había."
  - id: g-por-el-paquete-reducido
    label: lo que llega al perito lo arma una pieza cuyo trabajo es decidir qué sale
    weight: 2
    predicate:
      op: path
      from:
        role: claims-service
      to:
        type: [external-provider]
      via:
        role: appraisal-service
    whyMissing: no hay ningún camino desde el servicio de siniestros hasta el estudio externo que pase por el servicio de peritaje.
    consequence: "cortar la conexión y no poner nada en su lugar deja 4.200 siniestros por mes sin tasar. Reducir lo que sale no es sacar la conexión: es que exista alguien que decide qué entra en el paquete, y que esa decisión esté escrita en el diseño y no en la buena voluntad de quien lo armó."
  - id: g-constancia-de-lo-entregado
    label: queda constancia de qué se le entregó al perito
    weight: 1
    predicate:
      op: path
      from:
        role: appraisal-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de peritaje hasta un almacenamiento de objetos, así que cada envío existe sólo en el instante en que ocurre.
    consequence: el día que un perito filtra algo, la aseguradora no puede decir qué le entregó. Sin constancia, la diferencia entre "se lo mandamos" y "no se lo mandamos" es la palabra de dos empresas.
  - id: g-expediente-conservado
    label: el expediente sigue viviendo en una base que se puede restaurar
    weight: 1
    predicate:
      op: path
      from:
        role: claims-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde el servicio de siniestros hasta una base con respaldo configurado.
    consequence: "reducir lo que sale no puede costar el lugar donde el expediente existe. La obligación de conservarlo diez años no depende de quién lo mira afuera: depende de que adentro haya una copia que alguien pueda restaurar."
rubric:
  - dimension: el dato regulado no cruza entero hacia un tercero
    signal:
      kind: predicate
      guaranteeId: g-expediente-no-sale-entero
  - dimension: alguien decide explícitamente qué clase de dato sale
    signal:
      kind: predicate
      guaranteeId: g-por-el-paquete-reducido
  - dimension: lo que salió queda registrado tal como salió
    signal:
      kind: predicate
      guaranteeId: g-constancia-de-lo-entregado
  - dimension: el expediente sigue teniendo dónde vivir
    signal:
      kind: predicate
      guaranteeId: g-expediente-conservado
referenceSolutions:
  - label: el peritaje arma el paquete en el momento en que se denuncia
    contextInversion: "armar el paquete en el momento es lo correcto cuando el peritaje tiene que arrancar el mismo día, como en un choque con lesionados donde el vehículo se va a taller en 48 horas, y cuando el volumen es parejo: cero piezas nuevas para operar y una sola línea de responsabilidad desde la denuncia hasta el envío. Se paga con que una caída del estudio externo demore la denuncia, porque el envío pasa por el mismo pedido que la carga."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: app
          type: mobile-client
          label: App de denuncia de siniestro
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2" }
        - id: peritaje
          type: service
          label: Servicio de peritaje
          zone: private
          role: appraisal-service
          props: { criticality: "medium", replicas: "2" }
        - id: baseexpedientes
          type: database
          label: Base de expedientes (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: paquetes
          type: object-storage
          label: Archivo de paquetes entregados
          zone: private
        - id: perito
          type: external-provider
          label: Estudio de peritaje externo
          zone: dmz
      edges:
        - id: asegurado-app
          from: { node: asegurado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: personal
        - id: siniestros-base
          from: { node: siniestros }
          to: { node: baseexpedientes }
          dataClass: regulated
        - id: siniestros-peritaje
          from: { node: siniestros }
          to: { node: peritaje }
          dataClass: regulated
        - id: peritaje-paquetes
          from: { node: peritaje }
          to: { node: paquetes }
          dataClass: personal
        - id: peritaje-perito
          from: { node: peritaje }
          to: { node: perito }
          dataClass: personal
  - label: la denuncia deja el pedido en una cola y el peritaje lo arma después
    contextInversion: "sacar el envío del camino de la denuncia conviene cuando el estudio externo atiende de nueve a seis y la app recibe denuncias a cualquier hora, y cuando un granizo deja mil doscientos siniestros en una tarde: la denuncia se acepta igual, el paquete se arma al ritmo que el perito puede recibir, y una caída del estudio no se le nota al asegurado. Se paga con una pieza más para operar y con una ventana en la que el siniestro está denunciado y todavía no se pidió el peritaje."
    design:
      nodes:
        - id: asegurado
          type: actor
          label: Asegurado
          zone: public
        - id: app
          type: mobile-client
          label: App de denuncia de siniestro
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de peritajes pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: peritaje
          type: service
          label: Servicio de peritaje
          zone: private
          role: appraisal-service
          props: { criticality: "medium", replicas: "2" }
        - id: baseexpedientes
          type: database
          label: Base de expedientes (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: paquetes
          type: object-storage
          label: Archivo de paquetes entregados
          zone: private
        - id: perito
          type: external-provider
          label: Estudio de peritaje externo
          zone: dmz
      edges:
        - id: asegurado-app
          from: { node: asegurado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: personal
        - id: siniestros-base
          from: { node: siniestros }
          to: { node: baseexpedientes }
          dataClass: regulated
        - id: siniestros-cola
          from: { node: siniestros }
          to: { node: cola }
          dataClass: regulated
        - id: cola-peritaje
          from: { node: cola }
          to: { node: peritaje }
          dataClass: regulated
        - id: peritaje-paquetes
          from: { node: peritaje }
          to: { node: paquetes }
          dataClass: personal
        - id: peritaje-perito
          from: { node: peritaje }
          to: { node: perito }
          dataClass: personal
status: PILOT
---

Una aseguradora con **4.200 siniestros denunciados por mes**. Cuando alguien
choca, la app le pide fotos del vehículo, el lugar del hecho y, si hay
lesionados, el informe médico. Todo eso arma el expediente, que por ley hay que
conservar **diez años**.

Para tasar el daño, la aseguradora contrata a un **estudio de peritaje
externo**: doce personas, contratadas por acto. Desde 2021 el servicio de
siniestros les manda el expediente. No una parte: el expediente.

El perito necesita las fotos del vehículo, el número de póliza y el lugar del
hecho. Recibe además el informe médico del lesionado y el documento del
asegurado, y **no tiene forma de no verlos**. Nadie decidió mandárselos: era lo
que venía en el mismo sobre.

El motor **no bloquea esta conexión**. Ninguna regla la prohíbe. Lo único que
hay es la clase de dato declarada ahí, y con eso alcanza para que alguien mire
el diagrama y vea que sale de más. Para eso se declara.

En abril un perito adjuntó por error el informe médico a su presupuesto y se lo
mandó al taller. Cuando la aseguradora quiso reconstruir qué le había
entregado, no pudo: **no guarda constancia de lo que sale**.

Desde el rediseño de marzo hay un **servicio de peritaje** en el lienzo, sin una
sola conexión. Se aprovisionó justamente para armar el paquete reducido y quedó
a medio hacer.

El equipo tiene **5 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que al estudio externo le llegue lo que necesita y
no el expediente entero, sin dejar 4.200 siniestros por mes sin tasar, y para
que quede registro de qué se entregó cada vez.
