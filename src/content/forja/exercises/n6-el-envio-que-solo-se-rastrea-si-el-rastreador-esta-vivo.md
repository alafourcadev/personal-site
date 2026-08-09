---
title: "El envío que sólo se rastrea si el rastreador está vivo"
level: 6
role: core
domain: logistica
D1: 2
D2: 2
D3: 2
D4: 2
D5: 3
D6: 2
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que nombrar qué se sigue pudiendo hacer cuando el servicio de rastreo no está, y qué deja de poderse hacer. Si tu respuesta es «todo sigue igual», revisala."
lambda: 0.5
constraints:
  - metric: consultas de rastreo por día
    operator: ">="
    value: 310000
    unit: consultas/día
  - metric: despliegues del servicio de rastreo por semana
    operator: ">="
    value: 3
    unit: despliegues/semana
  - metric: llamadas al centro de atención en la hora posterior a una caída del rastreo
    operator: ">="
    value: 1900
    unit: llamadas
hiddenFacts:
  - fact: "el centro de atención usa la misma pantalla que el cliente, contra el mismo servicio. Cuando el rastreo se cae, el cliente no puede consultar y el operador que lo atiende tampoco: las 1.900 llamadas entran a un centro que está tan ciego como quien llama."
    discoveryPath: "fijate cuántos caminos distintos llegan hoy al estado del envío. Si es uno solo, todos los que consultan comparten exactamente el mismo destino cuando ese camino falla."
  - fact: "el estado del envío cambia entre 4 y 9 veces en su vida y se escribe en la base; consultarlo es leer una fila. La escritura es la parte difícil, la lectura no."
    discoveryPath: "separá lo que escribe de lo que lee y preguntate si las dos necesitan la misma pieza. Un camino de lectura que no comparte destino con el de escritura sigue en pie cuando el otro se cae."
  - fact: "el servicio de rastreo se despliega tres veces por semana porque es donde se integran los transportistas nuevos. Cada despliegue son entre 40 y 90 segundos sin responder."
    discoveryPath: "la pieza que más se cae no es la más frágil: es la que más se toca. Preguntate cuál del diagrama cambia todas las semanas."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Página de rastreo
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: rastreo
      type: service
      label: Servicio de rastreo
      zone: private
      role: tracking-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: base
      type: database
      label: Base de envíos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: cliente-web
      from: { node: cliente }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-rastreo
      from: { node: gw }
      to: { node: rastreo }
      dataClass: personal
    - id: rastreo-base
      from: { node: rastreo }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-segundo-camino
    label: hay un camino desde la puerta de entrada hasta el estado del envío que no pasa por el servicio de rastreo
    weight: 3
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        type: [database]
      forbid:
        role: tracking-service
    whyMissing: todos los caminos desde la puerta de entrada hasta el dato del envío atraviesan el servicio de rastreo. No hay ninguna forma de leer un estado sin que esa pieza esté viva.
    consequence: "los 40 a 90 segundos de cada despliegue son 40 a 90 segundos en que nadie puede ver dónde está un paquete, ni el cliente ni el operador que lo atiende. Con 310.000 consultas por día, cada despliegue produce su propio pico de llamadas."
  - id: g-rastreo-sigue-en-pie
    label: el servicio de rastreo sigue existiendo y sigue llegando al dato
    weight: 1
    predicate:
      op: path
      from:
        role: tracking-service
      to:
        type: [database]
    whyMissing: "el servicio de rastreo no llega a ninguna base. Agregar un segundo camino no es reemplazar el primero: la pieza que integra a los transportistas y escribe los estados tiene que seguir ahí."
    consequence: sin la pieza que escribe, el segundo camino lee una base que nadie actualiza. Un camino de lectura perfecto sobre un dato congelado es una respuesta rápida y equivocada.
  - id: g-caminos-independientes
    label: ninguno de los dos caminos cuelga del otro
    weight: 1
    predicate:
      op: all
      of:
        - op: edgeAbsent
          from:
            type: [service]
          to:
            role: tracking-service
        - op: edgeAbsent
          from:
            role: tracking-service
          to:
            type: [service]
    whyMissing: "hay un servicio que llama al servicio de rastreo, o el rastreo llama a otro servicio. Un segundo camino que pasa por el primero no es un segundo camino: es el mismo camino con una escala más."
    consequence: "el día que el rastreo se cae, la pieza «alternativa» se cae con él y con un agravante: ahora hay dos equipos convencidos de que había redundancia."
rubric:
  - dimension: existe una forma de leer el estado que no depende de la pieza que más se despliega
    signal:
      kind: predicate
      guaranteeId: g-segundo-camino
  - dimension: la redundancia se agrega, no se consigue borrando lo que molestaba
    signal:
      kind: predicate
      guaranteeId: g-rastreo-sigue-en-pie
  - dimension: los dos caminos no comparten la pieza que puede caerse
    signal:
      kind: predicate
      guaranteeId: g-caminos-independientes
referenceSolutions:
  - label: dos servicios sobre la misma base
    contextInversion: "dos servicios contra la misma base es lo correcto cuando el problema real es el despliegue, no la base: el dato es uno solo, siempre fresco, y lo único que se duplica es la pieza que se toca tres veces por semana. Es la topología con menos piezas que cumple las tres obligaciones y deja dos unidades operativas de margen. El costo es que la base sigue siendo compartida: si el problema fuera la base, esto no lo resuelve."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: web
          type: web-client
          label: Página de rastreo
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: rastreo
          type: service
          label: Servicio de rastreo
          zone: private
          role: tracking-service
          props: { criticality: "high", replicas: "2" }
        - id: consultas
          type: service
          label: Servicio de consultas de estado
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: base
          type: database
          label: Base de envíos
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-rastreo
          from: { node: gw }
          to: { node: rastreo }
          dataClass: personal
        - id: gw-consultas
          from: { node: gw }
          to: { node: consultas }
          dataClass: personal
        - id: rastreo-base
          from: { node: rastreo }
          to: { node: base }
          dataClass: personal
        - id: consultas-base
          from: { node: consultas }
          to: { node: base }
          dataClass: personal
  - label: registro de cambios de estado y una copia de lectura propia
    contextInversion: "publicar cada cambio de estado en un registro y proyectarlo a una copia de lectura conviene cuando el pico de consulta (310.000 por día contra 9 escrituras por envío) no puede compartir la base con la escritura, y cuando querés poder reconstruir la copia entera desde cero después de un error de datos. La lectura queda separada hasta en el almacenamiento. Se paga con dos piezas más, con todo el margen del presupuesto consumido, y con una ventana de segundos en la que la copia de lectura va atrás del registro."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: web
          type: web-client
          label: Página de rastreo
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: rastreo
          type: service
          label: Servicio de rastreo
          zone: private
          role: tracking-service
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Registro de cambios de estado
          zone: private
          props: { retention: "30d", partitions: "6" }
        - id: proyector
          type: worker
          label: Proyector de estados
          zone: private
        - id: copia
          type: database
          label: Copia de lectura de envíos
          zone: restricted
          props: { backup: "diario" }
        - id: consultas
          type: service
          label: Servicio de consultas de estado
          zone: private
          props: { criticality: "high", replicas: "2" }
      edges:
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-rastreo
          from: { node: gw }
          to: { node: rastreo }
          dataClass: personal
        - id: rastreo-eventos
          from: { node: rastreo }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-proyector
          from: { node: eventos }
          to: { node: proyector }
          dataClass: personal
        - id: proyector-copia
          from: { node: proyector }
          to: { node: copia }
          dataClass: personal
        - id: gw-consultas
          from: { node: gw }
          to: { node: consultas }
          dataClass: personal
        - id: consultas-copia
          from: { node: consultas }
          to: { node: copia }
          dataClass: personal
status: PILOT
---

Una empresa de envíos con **310.000 consultas de rastreo por día**. El
cliente escribe su código de seguimiento en la página, la página le pregunta
al servicio de rastreo, y el servicio de rastreo lee la fila del envío en la
base.

El servicio de rastreo se despliega **tres veces por semana**: es donde se
integran los transportistas nuevos, y siempre hay transportistas nuevos.
Cada despliegue son entre 40 y 90 segundos sin responder.

En esos segundos no falla el rastreo de un transportista. Falla el rastreo.
Y falla también para el centro de atención, que usa la misma pantalla contra
el mismo servicio: las **1.900 llamadas** que entran en la hora siguiente
las atienden operadores que están tan ciegos como el que llama.

El dato, mientras tanto, está intacto. El estado de un envío cambia entre 4
y 9 veces en toda su vida y ya está escrito en la base. Consultarlo es leer
una fila. Lo que se cayó no fue el dato: fue la única puerta que había para
llegar a él.

El equipo tiene **6 unidades operativas** y hoy usa 3.

**Rearmá el sistema** para que exista una forma de leer el estado de un envío
que no dependa de la pieza que se despliega tres veces por semana, sin
borrar esa pieza, que es la que escribe los estados, y sin que el segundo
camino termine colgando del primero.
