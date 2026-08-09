---
title: "El taller que todavía anota en papel"
level: 1
role: greenfield
domain: industria
D1: 1
D2: 1
D3: 1
D4: 0
D5: 2
D6: 1
D7: 0
D8: 2
D9: 2
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: 'libre, y acá conviene decir para qué sirve. Un modelo te va a devolver una arquitectura completa en tres segundos. Lo que no te va a decir es cuál de las dos personas del enunciado tiene razón, porque las dos la tienen. Usalo para nombrar piezas, no para elegir.'
lambda: 0.5
constraints:
  - metric: consultas de estado que terminan en una llamada telefónica
    operator: "="
    value: 0
    unit: consultas
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: el sábado a la mañana el taller contesta cuarenta veces más consultas de estado que altas de órdenes.
    discoveryPath: 'la consigna te da dos números sobre el mismo taller. Uno mide lo que se escribe y el otro mide lo que se lee. No son el mismo número ni de lejos, y en un lienzo vacío esa diferencia es lo único que decide cuántas piezas dibujás.'
  - fact: en el taller trabajan tres personas y ninguna se dedica a sistemas.
    discoveryPath: 'contá las personas que nombra la consigna. Cada pieza que dibujes es algo que alguna de esas tres va a tener que mirar el día que deje de contestar.'
startingDesign:
  nodes: []
  edges: []
guarantees:
  - id: g-orden-queda
    label: la orden de trabajo queda escrita en un registro durable
    weight: 2
    predicate:
      op: path
      from:
        type: [service]
      to:
        type: [database]
    whyMissing: no hay ningún camino desde un servicio hasta una base de datos. Lo que el cliente deja registrado no llega a ningún lado que sobreviva a un reinicio.
    consequence: 'el cuaderno tenía un defecto y una virtud: se podía perder, pero mientras existiera nadie lo vaciaba solo. Un sistema sin registro durable pierde la virtud y conserva el defecto.'
  - id: g-cliente-por-la-puerta
    label: el cliente llega al servicio a través de una puerta de entrada
    weight: 2
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        type: [service]
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el cliente hasta un servicio que pase por una puerta de entrada.
    consequence: sin una puerta adelante, el servicio queda escuchando en una red donde no controlás quién llega. No hay dónde autenticar ni dónde poner un límite antes de que el pedido entre.
  - id: g-estado-no-sale-de-copia
    label: el estado no se contesta desde una copia que se vacía sola
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [service]
      to:
        type: [cache]
    whyMissing: hay un servicio escribiendo o leyendo una copia volátil, y el estado del equipo es exactamente el dato que no puede estar viejo.
    consequence: una respuesta de "todavía no" con cinco minutos de atraso manda a alguien a manejar veinte kilómetros por un equipo que ya estaba listo. El error no se ve nunca del lado del sistema, se ve del lado del mostrador.
rubric:
  - dimension: la orden queda escrita en algo que sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-orden-queda
  - dimension: nadie llega al servicio sin pasar por la puerta
    signal:
      kind: predicate
      guaranteeId: g-cliente-por-la-puerta
  - dimension: el estado sale del registro real
    signal:
      kind: predicate
      guaranteeId: g-estado-no-sale-de-copia
referenceSolutions:
  - label: una sola ventanilla
    contextInversion: 'una sola ventanilla gana mientras el taller siga siendo tres personas y treinta órdenes por día. Una pieza que desplegar, una que mirar cuando algo falla, un solo lugar donde buscar el error. Se paga el sábado a la mañana, cuando la consulta de estado y el alta de una orden compiten por el mismo servicio y el que está cargando espera detrás.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente del taller
          zone: public
        - id: consulta
          type: web-client
          label: Consulta web de estado
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ordenes
          type: service
          label: Servicio de órdenes
          zone: private
        - id: registro
          type: database
          label: Registro de órdenes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-consulta
          from: { node: cliente }
          to: { node: consulta }
          dataClass: public
        - id: consulta-gw
          from: { node: consulta }
          to: { node: gw }
          dataClass: personal
        - id: gw-ordenes
          from: { node: gw }
          to: { node: ordenes }
          dataClass: personal
        - id: ordenes-registro
          from: { node: ordenes }
          to: { node: registro }
          dataClass: personal
  - label: dos ventanillas sobre el mismo registro
    contextInversion: 'dos ventanillas ganan cuando el número que manda deja de ser treinta órdenes por día y pasa a ser mil doscientas consultas un sábado. La consulta no puede frenar el alta de una orden nueva, y separarlas es la única forma de conseguirlo sin copiar el dato a ningún lado. Se paga con dos servicios que desplegar y dos que mirar, en un taller de tres personas donde ninguna es de sistemas.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente del taller
          zone: public
        - id: consulta
          type: web-client
          label: Consulta web de estado
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: altas
          type: service
          label: Servicio de altas de órdenes
          zone: private
        - id: estados
          type: service
          label: Servicio de consulta de estado
          zone: private
        - id: registro
          type: database
          label: Registro de órdenes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-consulta
          from: { node: cliente }
          to: { node: consulta }
          dataClass: public
        - id: consulta-gw
          from: { node: consulta }
          to: { node: gw }
          dataClass: personal
        - id: gw-altas
          from: { node: gw }
          to: { node: altas }
          dataClass: personal
        - id: altas-registro
          from: { node: altas }
          to: { node: registro }
          dataClass: personal
        - id: gw-estados
          from: { node: gw }
          to: { node: estados }
          dataClass: personal
        - id: estados-registro
          from: { node: estados }
          to: { node: registro }
          dataClass: personal
status: PILOT
---

Un taller de reparación de electrodomésticos recibe **30 órdenes por día**. Todo
se anota en un cuaderno con espiral. Cuando el cliente quiere saber si su equipo
está listo, llama por teléfono y alguien busca en el cuaderno.

No hay sistema. Este lienzo está vacío porque el taller también lo está.

Lo que necesitan, en una frase del dueño:

> *"Que la orden quede escrita y que el cliente pueda ver en qué anda sin
> llamarnos."*

Eso es todo el requisito. Lo que no dice es qué piezas van, y esa es justamente
la parte que te toca. **Los ejercicios anteriores te dieron un diagrama roto
para arreglar. Este te pregunta algo que arreglar nunca te pregunta: qué debería
existir.**

Hay dos personas en el taller que quieren cosas distintas, y las dos tienen
razón.

Ramón atiende el mostrador. Cuenta que un sábado a la mañana el teléfono suena
unas **1.200 veces** para preguntar por un estado, contra 30 altas de órdenes en
todo el día. Dice que consultar y cargar no pueden ser la misma cosa. Tiene
razón: el sábado, la persona que está cargando una orden nueva espera detrás de
la cola de los que preguntan.

El dueño dice que son tres y ninguna se dedica a sistemas, así que no quiere dos
cosas que mantener. También tiene razón: cada pieza que dibujes es algo que
alguno de los tres va a tener que mirar un martes a la noche, cuando deje de
contestar y no haya nadie más.

Ninguno de los dos está equivocado. Elegí, y sostené qué perdés.

**Una advertencia sobre el atajo.** Va a aparecer la idea de poner una copia
adelante para que el sábado no duela. El estado de una reparación es el dato que
menos puede estar viejo de todo el taller: una respuesta de "todavía no" con
cinco minutos de atraso manda a alguien a manejar veinte kilómetros por un
equipo que ya estaba listo. Acá el estado se contesta desde el registro real.
