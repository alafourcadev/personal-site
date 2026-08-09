---
title: "El centro oncológico que sí necesita lo suyo"
level: 8
role: counter-trap
domain: farmacia
D1: 3
D2: 3
D3: 3
D4: 2
D5: 3
D6: 2
D7: 1
D8: 1
D9: 3
prerequisiteLevels: [7]
budget:
  opsUnits: 9
aiBudget: "libre, pero tu respuesta tiene que explicar por qué acá aislar sí sale barato, y cuál es la diferencia concreta entre este cliente y los noventa y seis que se consolidaron el mes pasado."
lambda: 0.5
constraints:
  - metric: clientes que exigen almacén separado por convenio
    operator: "="
    value: 1
    unit: clientes
  - metric: años de retención exigidos para la receta oncológica
    operator: ">="
    value: 15
    unit: años
hiddenFacts:
  - fact: "el convenio con el ministerio dice que ningún proceso de la plataforma que sirva a otro cliente puede acceder al dato del centro, ni siquiera para contar. El reporte mensual de la plataforma cuenta."
    discoveryPath: "seguí qué componentes tocan el almacén del centro. Uno de ellos existe para armar el agregado de las otras noventa y cinco farmacias, y lo toca igual."
  - fact: "es un cliente, no noventa y seis. Un almacén propio se migra una vez, se respalda una vez y se audita en un solo lugar; la aritmética que hundió la consolidación anterior acá no aplica."
    discoveryPath: "compará las unidades operativas que pide aislar a este cliente contra el presupuesto declarado. El costo de aislar se multiplica por la cantidad de inquilinos aislados, y acá ese número es uno."
  - fact: "el centro no pide una plataforma aparte: pide que su dato no comparta almacén ni proceso con nadie. El mostrador, el catálogo y la facturación pueden seguir siendo los mismos."
    discoveryPath: "leé qué exige el convenio y qué no. Aislar el dato y duplicar el producto entero son dos decisiones distintas, y sólo una está firmada."
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
    - id: memoria
      type: cache
      label: Memoria del catálogo de medicamentos
      zone: private
      given: true
      props: { ttl: "300", eviction: "lru" }
      position: { x: 805, y: 450 }
    - id: cola
      type: queue
      label: Cola del reporte mensual
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 340 }
    - id: reportes
      type: worker
      label: Reporte mensual de la plataforma
      zone: private
      given: true
      role: reporting-worker
      position: { x: 445, y: 450 }
    - id: comun
      type: database
      label: Base común de la plataforma
      zone: restricted
      role: shared-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 560 }
    - id: oncologico
      type: database
      label: Almacén del centro oncológico
      zone: restricted
      role: oncology-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 670 }
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
    - id: dispensacion-memoria
      from: { node: dispensacion }
      to: { node: memoria }
      dataClass: public
    - id: dispensacion-comun
      from: { node: dispensacion }
      to: { node: comun }
      dataClass: regulated
    - id: dispensacion-cola
      from: { node: dispensacion }
      to: { node: cola }
      dataClass: regulated
    - id: cola-reportes
      from: { node: cola }
      to: { node: reportes }
      dataClass: regulated
    - id: reportes-comun
      from: { node: reportes }
      to: { node: comun }
      dataClass: regulated
    - id: reportes-oncologico
      from: { node: reportes }
      to: { node: oncologico }
      dataClass: regulated
guarantees:
  - id: g-onco-own-door
    label: la receta del centro llega a su almacén sin pasar por el servicio que atiende a las otras noventa y cinco farmacias
    weight: 3
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: oncology-store
      forbid:
        role: dispensing-service
    whyMissing: el único camino desde la puerta de entrada hasta el almacén del centro pasa por el servicio de dispensación compartido. Hoy el centro entra por la misma puerta y es atendido por el mismo proceso que las otras noventa y cinco farmacias.
    consequence: "el convenio no habla sólo de dónde se guarda: dice que ningún proceso que sirva a otro cliente puede tocar ese dato. Un servicio compartido que elige el almacén según el inquilino cumple mientras la línea que elige esté bien escrita, y deja de cumplir el día que alguien la toca sin saber qué protegía."
  - id: g-no-platform-sweep
    label: el proceso que arma el reporte de toda la plataforma no toca el almacén del centro
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: reporting-worker
      to:
        role: oncology-store
    whyMissing: el reporte mensual de la plataforma sigue conectado al almacén del centro oncológico.
    consequence: "ese proceso existe para agregar a las otras noventa y cinco farmacias y lee el almacén del centro de paso, para contar. El convenio dice ni siquiera para contar. Es la clase de acceso que nadie recuerda haber concedido y que aparece en la primera auditoría."
  - id: g-platform-report-alive
    label: el reporte mensual de las otras noventa y cinco farmacias se sigue armando
    weight: 2
    predicate:
      op: path
      from:
        role: reporting-worker
      to:
        role: shared-store
    whyMissing: no queda ningún camino desde el reporte mensual hasta el almacén común.
    consequence: borrar el proceso que molesta también cumple el convenio, y deja a noventa y cinco farmacias sin el reporte que presentan a la obra social. Aislar a un cliente es sacarlo del alcance de lo compartido, no apagar lo compartido.
  - id: g-shared-platform-alive
    label: las otras noventa y cinco farmacias siguen guardando en el almacén común
    weight: 2
    predicate:
      op: path
      from:
        role: dispensing-service
      to:
        role: shared-store
    whyMissing: no queda ningún camino desde el servicio de dispensación hasta el almacén común de la plataforma.
    consequence: "darle infraestructura propia a un cliente no es empezar a dársela a todos: ese camino ya se recorrió y terminó en noventa y seis almacenes que dos personas no podían actualizar. Lo que se aísla acá es uno, y el resto se queda como está."
rubric:
  - dimension: el cliente que lo necesita queda fuera del alcance de lo compartido
    signal:
      kind: predicate
      guaranteeId: g-onco-own-door
  - dimension: ningún proceso de la plataforma toca su dato, ni para contar
    signal:
      kind: predicate
      guaranteeId: g-no-platform-sweep
  - dimension: el reporte de las demás farmacias sobrevive al aislamiento
    signal:
      kind: predicate
      guaranteeId: g-platform-report-alive
  - dimension: la plataforma compartida sigue siendo compartida
    signal:
      kind: predicate
      guaranteeId: g-shared-platform-alive
referenceSolutions:
  - label: un servicio propio para el centro, sobre su propio almacén
    contextInversion: "un servicio propio y un almacén propio, con el resto de la plataforma intacto, conviene cuando lo que hay que aislar es el camino del dato y el agregado mensual del centro puede armarse aparte, a mano o fuera de línea: es una pieza más para operar, una sola vez, para un solo cliente. Se paga con que la regla de negocio de la dispensación ahora vive en dos servicios, el compartido y el del centro, y va a haber un día en que se corrija en uno solo."
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
        - id: oncologia
          type: service
          label: Servicio de dispensación del centro
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: memoria
          type: cache
          label: Memoria del catálogo de medicamentos
          zone: private
          props: { ttl: "300", eviction: "lru" }
        - id: cola
          type: queue
          label: Cola del reporte mensual
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: reportes
          type: worker
          label: Reporte mensual de la plataforma
          zone: private
          role: reporting-worker
        - id: comun
          type: database
          label: Base común de la plataforma
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
        - id: oncologico
          type: database
          label: Almacén del centro oncológico
          zone: restricted
          role: oncology-store
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
        - id: gw-oncologia
          from: { node: gw }
          to: { node: oncologia }
          dataClass: regulated
        - id: dispensacion-memoria
          from: { node: dispensacion }
          to: { node: memoria }
          dataClass: public
        - id: dispensacion-comun
          from: { node: dispensacion }
          to: { node: comun }
          dataClass: regulated
        - id: dispensacion-cola
          from: { node: dispensacion }
          to: { node: cola }
          dataClass: regulated
        - id: cola-reportes
          from: { node: cola }
          to: { node: reportes }
          dataClass: regulated
        - id: reportes-comun
          from: { node: reportes }
          to: { node: comun }
          dataClass: regulated
        - id: oncologia-oncologico
          from: { node: oncologia }
          to: { node: oncologico }
          dataClass: regulated
  - label: el centro con su propio camino de reporte, de punta a punta
    contextInversion: "darle además su propia cola y su propio proceso de reporte conviene cuando el convenio se audita de verdad y hay que poder mostrar que ningún componente compartido tocó ese dato en ningún momento, ni siquiera para agregarlo: la respuesta a \"¿quién leyó esto?\" es una lista corta y toda del centro. Se paga con dos piezas más para operar y con dos implementaciones del mismo reporte mensual, que se van a desincronizar el día que cambie la definición de una métrica."
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
        - id: oncologia
          type: service
          label: Servicio de dispensación del centro
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola del reporte mensual
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: reportes
          type: worker
          label: Reporte mensual de la plataforma
          zone: private
          role: reporting-worker
        - id: cola-onco
          type: queue
          label: Cola del reporte del centro
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: reportes-onco
          type: worker
          label: Reporte mensual del centro
          zone: private
        - id: comun
          type: database
          label: Base común de la plataforma
          zone: restricted
          role: shared-store
          props: { backup: "diario" }
        - id: oncologico
          type: database
          label: Almacén del centro oncológico
          zone: restricted
          role: oncology-store
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
        - id: gw-oncologia
          from: { node: gw }
          to: { node: oncologia }
          dataClass: regulated
        - id: dispensacion-comun
          from: { node: dispensacion }
          to: { node: comun }
          dataClass: regulated
        - id: dispensacion-cola
          from: { node: dispensacion }
          to: { node: cola }
          dataClass: regulated
        - id: cola-reportes
          from: { node: cola }
          to: { node: reportes }
          dataClass: regulated
        - id: reportes-comun
          from: { node: reportes }
          to: { node: comun }
          dataClass: regulated
        - id: oncologia-oncologico
          from: { node: oncologia }
          to: { node: oncologico }
          dataClass: regulated
        - id: oncologia-cola-onco
          from: { node: oncologia }
          to: { node: cola-onco }
          dataClass: regulated
        - id: cola-onco-reportes-onco
          from: { node: cola-onco }
          to: { node: reportes-onco }
          dataClass: regulated
        - id: reportes-onco-oncologico
          from: { node: reportes-onco }
          to: { node: oncologico }
          dataClass: regulated
status: PILOT
---

La misma plataforma de farmacias, tres meses después. Los noventa y seis
almacenes se consolidaron en uno. El equipo sigue siendo de dos personas y
ahora una migración es una migración.

Entra un cliente nuevo: el **centro oncológico ambulatorio del hospital
provincial**. Uno.

Su receta no se parece a las otras. Medicación de alto costo, diagnóstico
asociado, retención obligatoria de **quince años**. Y un convenio con el
ministerio, firmado, que dice que **ningún proceso de la plataforma que sirva
a otro cliente puede acceder a ese dato, ni siquiera para contar**.

El equipo viene de aprender, caro, que aislar por cliente multiplica la
operación por la cantidad de clientes. La tentación ahora es la contraria:
meter al centro en el almacén común como a los demás y confiar en que la
consulta filtre bien.

Los números de este caso no son los del mes pasado. Aislar noventa y seis
clientes eran noventa y seis migraciones, noventa y seis respaldos y noventa y
seis lugares donde mirar. Aislar a este son **uno**, **uno** y **uno**.

Hoy el centro entra por la misma puerta, lo atiende el mismo servicio de
dispensación y su almacén (que existe, porque el convenio obligó a crearlo)
lo lee cada mes el proceso que arma el reporte agregado de las otras noventa y
cinco farmacias. Ese proceso no guarda el dato del centro: lo cuenta. El
convenio dice ni siquiera para contar.

El centro no pidió una plataforma aparte. Pidió que su dato no comparta
almacén ni proceso con nadie. El mostrador, el catálogo y la facturación
pueden seguir siendo los mismos.

El equipo tiene **9 unidades operativas** y hoy usa 7.

**Rearmá el sistema** para que el dato del centro quede fuera del alcance de
todo lo que sirve a otro cliente, sin tocar lo que ya funciona para las otras
noventa y cinco.
