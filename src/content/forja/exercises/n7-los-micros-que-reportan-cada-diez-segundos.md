---
title: "Los micros que reportan cada diez segundos"
level: 7
role: core
domain: transporte
D1: 2
D2: 3
D3: 2
D4: 2
D5: 3
D6: 3
D7: 2
D8: 0
D9: 3
prerequisiteLevels: [6]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir cuánto cuesta operar cada pieza que proponés. En este ejercicio hay dos respuestas correctas y se diferencian exactamente en eso."
lambda: 2.0
constraints:
  - metric: micros reportando posición
    operator: ">="
    value: 4100
    unit: micros
  - metric: consultas de pasajeros en la hora pico
    operator: ">="
    value: 900000
    unit: consultas
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "el pasajero sólo mira una cosa: dónde está el micro ahora. Nunca consulta dónde estuvo. El histórico existe para el informe de puntualidad que el municipio pide una vez por mes."
    discoveryPath: "seguí qué pregunta hace cada tipo de usuario. El pasajero pregunta por el presente y el municipio pregunta por el pasado, y hoy las dos preguntas golpean la misma base."
  - fact: "el servicio de informes corre cuatro minutos el primer lunes de cada mes y el resto del tiempo está despierto sin hacer nada. Cuesta lo mismo operarlo esos cuatro minutos que los 43.196 minutos restantes."
    discoveryPath: "mirá cada pieza y preguntate cuántos minutos por mes hace algo. Una pieza despierta cuesta lo mismo trabaje o no: es la única unidad de costo que el motor mide."
  - fact: "una posición de micro es información pública: va en la pantalla de la parada, en la app y en el sitio del municipio. No hay nada personal en ese dato."
    discoveryPath: "clasificá el dato antes de decidir dónde guardarlo. Lo que se puede publicar en una pantalla en la calle se puede servir desde cualquier lado, incluida una pieza que no cuesta nada operar."
startingDesign:
  nodes:
    - id: conductor
      type: actor
      label: Conductor
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tablet
      type: mobile-client
      label: Tablet del micro
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: viajero
      type: actor
      label: Pasajero
      zone: public
      given: true
      position: { x: 85, y: 190 }
    - id: pasajero
      type: web-client
      label: App del pasajero
      zone: public
      given: true
      position: { x: 445, y: 190 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 300 }
    - id: posiciones
      type: service
      label: Servicio de posiciones
      zone: private
      role: posiciones-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: consulta
      type: service
      label: Servicio de consulta al pasajero
      zone: private
      role: consulta-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 520 }
    - id: historico
      type: database
      label: Base del histórico de recorridos
      zone: restricted
      role: historico-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: informes
      type: service
      label: Servicio de informes de puntualidad
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 630 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: conductor-tablet
      from: { node: conductor }
      to: { node: tablet }
      dataClass: public
    - id: tablet-gw
      from: { node: tablet }
      to: { node: gw }
      dataClass: public
    - id: viajero-pasajero
      from: { node: viajero }
      to: { node: pasajero }
      dataClass: public
    - id: pasajero-gw
      from: { node: pasajero }
      to: { node: gw }
      dataClass: public
    - id: gw-posiciones
      from: { node: gw }
      to: { node: posiciones }
      dataClass: public
    - id: gw-consulta
      from: { node: gw }
      to: { node: consulta }
      dataClass: public
    - id: posiciones-historico
      from: { node: posiciones }
      to: { node: historico }
      dataClass: public
    - id: consulta-historico
      from: { node: consulta }
      to: { node: historico }
      dataClass: public
    - id: informes-historico
      from: { node: informes }
      to: { node: historico }
      dataClass: public
    - id: posiciones-obs
      from: { node: posiciones }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-consulta-barata
    label: la consulta del pasajero se responde desde una pieza barata de leer
    weight: 2
    predicate:
      op: path
      from:
        role: consulta-service
      to:
        type: [cache, object-storage]
    whyMissing: el servicio que atiende al pasajero no tiene de dónde leer la última posición salvo la base del histórico.
    consequence: "900.000 consultas en una hora contra una base que además está recibiendo una escritura por micro cada diez segundos. Las lecturas y las escrituras se pelean por la misma pieza, y la que pierde primero es la escritura: dejás de saber dónde están los micros justo cuando más gente pregunta."
  - id: g-copia-la-llena-quien-recibe
    label: la copia rápida la escribe el servicio que recibe las posiciones
    weight: 2
    predicate:
      op: path
      from:
        role: posiciones-service
      to:
        type: [cache, object-storage]
    whyMissing: hay una pieza barata de leer del lado de la consulta, pero ningún camino desde el servicio que recibe las posiciones hasta ella. Alguien la lee y nadie la llena.
    consequence: "el único componente que sabe dónde está cada micro es el que recibe el reporte cada diez segundos. Si no escribe la copia, la copia está vacía: la pantalla del pasajero contesta rápido, sin error y sin micros. El sistema parece sano y el dato no existe."
  - id: g-consulta-no-toca-historico
    label: la consulta del pasajero no entra a la base del histórico
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: consulta-service
      to:
        role: historico-db
    whyMissing: hay una conexión directa entre el servicio de consulta y la base del histórico.
    consequence: "el pasajero pregunta por el presente y la base del histórico guarda el pasado. Cada consulta obliga a esa base a buscar la última fila entre cuarenta millones que a nadie le importan."
  - id: g-historico-se-sigue-escribiendo
    label: el recorrido de cada micro se sigue guardando
    weight: 1
    predicate:
      op: path
      from:
        role: posiciones-service
      to:
        role: historico-db
    whyMissing: no hay ningún camino desde el servicio de posiciones hasta la base del histórico.
    consequence: "el informe de puntualidad que el municipio pide todos los meses es parte del contrato. Aliviar la base borrándola es resolver el pico rompiendo el negocio."
  - id: g-pasajero-entra
    label: el pasajero sigue llegando al servicio de consulta
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: consulta-service
    whyMissing: no hay ningún camino desde la app del pasajero hasta el servicio que le contesta.
    consequence: "sacar la consulta de encima de la base no puede significar sacarle la consulta al pasajero. Una app que no pregunta nada no genera carga y tampoco genera producto."
  - id: g-posiciones-observado
    label: el equipo se entera si los micros dejan de reportar
    weight: 1
    predicate:
      op: covered
      target:
        role: posiciones-service
      by:
        type: [observability]
    whyMissing: el servicio de posiciones no está conectado a ningún componente de monitoreo.
    consequence: "un micro que deja de reportar se ve igual que un micro detenido en un semáforo. Sin señal, la diferencia entre «no se mueve» y «no llega el dato» la descubre el pasajero en la parada."
rubric:
  - dimension: la pregunta del pasajero se responde donde es barata
    signal:
      kind: predicate
      guaranteeId: g-consulta-barata
  - dimension: la lectura del presente no pelea con la escritura del pasado
    signal:
      kind: predicate
      guaranteeId: g-consulta-no-toca-historico
  - dimension: la obligación con el municipio sigue en pie
    signal:
      kind: predicate
      guaranteeId: g-historico-se-sigue-escribiendo
  - dimension: el pasajero sigue pudiendo preguntar
    signal:
      kind: predicate
      guaranteeId: g-pasajero-entra
  - dimension: la ausencia de dato es distinguible de la ausencia de movimiento
    signal:
      kind: predicate
      guaranteeId: g-posiciones-observado
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: la última posición en memoria, y el servicio de informes fuera
    contextInversion: "guardar la última posición en memoria es lo correcto cuando el pasajero tiene que ver el micro moverse de verdad: la posición se actualiza en cuanto llega y la consulta la lee al instante. Cuesta una unidad operativa, y esa unidad hay que sacarla de algún lado: sale del servicio de informes, que trabaja cuatro minutos por mes y se puede reemplazar por una consulta que alguien corre a mano el primer lunes. Se paga con que el informe deja de estar automatizado, y con que si esa memoria se reinicia, la app queda sin posiciones hasta el siguiente reporte de cada micro."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Conductor
          zone: public
        - id: tablet
          type: mobile-client
          label: Tablet del micro
          zone: public
        - id: viajero
          type: actor
          label: Pasajero
          zone: public
        - id: pasajero
          type: web-client
          label: App del pasajero
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: posiciones
          type: service
          label: Servicio de posiciones
          zone: private
          role: posiciones-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: consulta
          type: service
          label: Servicio de consulta al pasajero
          zone: private
          role: consulta-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: ultima
          type: cache
          label: Última posición de cada micro
          zone: private
          props: { ttl: "60", eviction: "lru" }
        - id: historico
          type: database
          label: Base del histórico de recorridos
          zone: restricted
          role: historico-db
          props: { backup: "diario" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: conductor-tablet
          from: { node: conductor }
          to: { node: tablet }
          dataClass: public
        - id: tablet-gw
          from: { node: tablet }
          to: { node: gw }
          dataClass: public
        - id: viajero-pasajero
          from: { node: viajero }
          to: { node: pasajero }
          dataClass: public
        - id: pasajero-gw
          from: { node: pasajero }
          to: { node: gw }
          dataClass: public
        - id: gw-posiciones
          from: { node: gw }
          to: { node: posiciones }
          dataClass: public
        - id: gw-consulta
          from: { node: gw }
          to: { node: consulta }
          dataClass: public
        - id: posiciones-historico
          from: { node: posiciones }
          to: { node: historico }
          dataClass: public
        - id: posiciones-ultima
          from: { node: posiciones }
          to: { node: ultima }
          dataClass: public
        - id: consulta-ultima
          from: { node: consulta }
          to: { node: ultima }
          dataClass: public
        - id: posiciones-obs
          from: { node: posiciones }
          to: { node: obs }
          dataClass: public
  - label: un mapa publicado como archivo, y el servicio de informes se queda
    contextInversion: "publicar el mapa de posiciones como un archivo servido por una red de distribución es lo correcto cuando el pasajero tolera que la posición tenga diez o quince segundos: el archivo cuesta cero unidades operativas y absorbe las 900.000 consultas sin que ninguna llegue a tu infraestructura. Esa unidad que no gastás es la que te deja conservar el servicio de informes automatizado. Se paga en frescura: el micro que ves en pantalla estuvo ahí hace unos segundos. Y en que ahora dependés de que la publicación no se atrase, porque nadie va a notar un archivo viejo servido rapidísimo."
    design:
      nodes:
        - id: conductor
          type: actor
          label: Conductor
          zone: public
        - id: tablet
          type: mobile-client
          label: Tablet del micro
          zone: public
        - id: viajero
          type: actor
          label: Pasajero
          zone: public
        - id: pasajero
          type: web-client
          label: App del pasajero
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: posiciones
          type: service
          label: Servicio de posiciones
          zone: private
          role: posiciones-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: consulta
          type: service
          label: Servicio de consulta al pasajero
          zone: private
          role: consulta-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: mapa
          type: object-storage
          label: Mapa de posiciones publicado
          zone: private
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: historico
          type: database
          label: Base del histórico de recorridos
          zone: restricted
          role: historico-db
          props: { backup: "diario" }
        - id: informes
          type: service
          label: Servicio de informes de puntualidad
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: conductor-tablet
          from: { node: conductor }
          to: { node: tablet }
          dataClass: public
        - id: tablet-gw
          from: { node: tablet }
          to: { node: gw }
          dataClass: public
        - id: viajero-pasajero
          from: { node: viajero }
          to: { node: pasajero }
          dataClass: public
        - id: pasajero-gw
          from: { node: pasajero }
          to: { node: gw }
          dataClass: public
        - id: gw-posiciones
          from: { node: gw }
          to: { node: posiciones }
          dataClass: public
        - id: gw-consulta
          from: { node: gw }
          to: { node: consulta }
          dataClass: public
        - id: posiciones-historico
          from: { node: posiciones }
          to: { node: historico }
          dataClass: public
        - id: posiciones-mapa
          from: { node: posiciones }
          to: { node: mapa }
          dataClass: public
        - id: consulta-mapa
          from: { node: consulta }
          to: { node: mapa }
          dataClass: public
        - id: mapa-distribucion
          from: { node: mapa }
          to: { node: distribucion }
          dataClass: public
        - id: informes-historico
          from: { node: informes }
          to: { node: historico }
          dataClass: public
        - id: posiciones-obs
          from: { node: posiciones }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Una empresa de transporte urbano pasó de 410 a **4.100 micros**. Cada uno
reporta su posición cada diez segundos. En la hora pico, los pasajeros hacen
**900.000 consultas** de "¿dónde está mi micro?".

Diez veces el tráfico, pero no por unas horas: para siempre. Esta vez el
pico no pasa.

Hoy todo golpea la misma pieza. La base del histórico recibe una escritura
por micro cada diez segundos, unas 35 millones por día, y además atiende
cada una de las 900.000 consultas de los pasajeros. En la última hora pico
los micros dejaron de reportar durante seis minutos: no se cayó nada, la
base simplemente estaba ocupada contestándole a la gente.

El sistema tiene seis piezas despiertas y **el presupuesto es exactamente
seis**. No hay una séptima.

Antes de decidir, mirá quién pregunta qué. El pasajero pregunta **dónde está
el micro ahora** y nunca pregunta dónde estuvo. El municipio pregunta dónde
estuvo, una vez por mes, y para eso hay un servicio de informes despierto
todo el año que trabaja cuatro minutos. Y una posición de micro es
información pública: va en la pantalla de la parada.

**Sacá la consulta del pasajero de encima de la base del histórico, sin
pasarte de seis unidades operativas y sin dejar de guardar los recorridos.**
Hay dos respuestas que llegan a cien y se diferencian en una sola cosa:
cuánto cuesta operar la pieza desde la que le contestás al pasajero.
