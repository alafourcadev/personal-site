---
title: "La reseña que nadie pidió resumir"
level: 1
role: core
domain: gastronomia
D1: 1
D2: 1
D3: 1
D4: 0
D5: 1
D6: 1
D7: 0
D8: 0
D9: 1
prerequisiteLevels: []
budget:
  opsUnits: 3
aiBudget: 'libre para redactar. Cerrada para lo que decide el ejercicio: si le preguntás a un modelo si conviene sumar un modelo, la respuesta ya la sabés. La pregunta real es quién firmó esa línea y qué presupuesto ocupa.'
lambda: 0.5
constraints:
  - metric: reservas confirmadas que no se pueden consultar el día del servicio
    operator: "="
    value: 0
    unit: reservas
  - metric: presupuesto operativo
    operator: "<="
    value: 3
    unit: unidades operativas
hiddenFacts:
  - fact: las reseñas de Google que el modelo resume son 11 por semana, y hoy las lee la dueña una por una mientras toma café. Nadie pidió un resumen.
    discoveryPath: buscá en el enunciado quién firmó cada línea y cuántas reseñas entran por semana. Once textos cortos por semana no son un problema de volumen. Son la lectura del lunes a la mañana.
  - fact: el presupuesto operativo son 3 unidades y las tres ya están ocupadas. Una la ocupa el modelo.
    discoveryPath: contá en el diagrama las piezas que cuestan operación y compará con el presupuesto declarado. Después contá lo que hace falta para que la reserva quede escrita. El número cierra sólo si sacás algo.
startingDesign:
  nodes:
    - id: comensal
      type: actor
      label: Comensal
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Web de reservas
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: reservas
      type: service
      label: Servicio de reservas
      zone: private
      role: reservations-service
      given: true
      position: { x: 445, y: 300 }
    - id: modelo
      type: ai-model
      label: Modelo que resume reseñas
      zone: private
      given: true
      props: { hosting: "external" }
      position: { x: 445, y: 410 }
  edges:
    - id: comensal-web
      from: { node: comensal }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-reservas
      from: { node: gw }
      to: { node: reservas }
      dataClass: personal
    - id: reservas-modelo
      from: { node: reservas }
      to: { node: modelo }
      dataClass: public
guarantees:
  - id: g-reserva-queda-escrita
    label: la reserva confirmada queda en un lugar que sobrevive a un reinicio
    weight: 2
    predicate:
      op: path
      from:
        role: reservations-service
      to:
        type: [database, object-storage]
    whyMissing: el servicio de reservas no llega a ningún lugar durable. Confirma la mesa, manda el correo y no escribe la reserva en ninguna parte que dure más que el proceso.
    consequence: 'el despliegue de la madrugada se lleva las reservas de la noche siguiente. El sábado a las nueve hay catorce personas con un correo de confirmación en el teléfono y un salón que no las espera: el correo prueba que el sistema contestó, no que la mesa existe.'
  - id: g-comensal-reserva
    label: el comensal sigue llegando al servicio de reservas por la puerta de entrada
    weight: 2
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: reservations-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde la web hasta el servicio de reservas que pase por la puerta de entrada.
    consequence: los tres locales sacaron la web para dejar de perder reservas en el contestador. Un sistema que guarda impecablemente las reservas que ya no puede tomar no resolvió nada.
  - id: g-sin-el-modelo-que-nadie-pidio
    label: el servicio de reservas no arrastra el modelo que nadie pidió
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: reservations-service
      to:
        type: [ai-model]
    whyMissing: el servicio de reservas está conectado a un modelo que resume reseñas, una pieza que ninguna de las dos líneas firmadas pide, y que ocupa la unidad operativa que necesita el lugar donde la reserva tiene que quedar escrita.
    consequence: 'son 11 reseñas por semana y las lee una persona en diez minutos. Esa pieza no está resolviendo ningún problema medido: está ocupando el lugar del requisito que sí está firmado. Una preferencia nunca se paga en la preferencia. Se paga en lo que queda afuera.'
rubric:
  - dimension: la reserva sobrevive al reinicio de la madrugada
    signal:
      kind: predicate
      guaranteeId: g-reserva-queda-escrita
  - dimension: la web sigue tomando reservas
    signal:
      kind: predicate
      guaranteeId: g-comensal-reserva
  - dimension: separar lo firmado de lo sugerido, y actuar en consecuencia
    signal:
      kind: predicate
      guaranteeId: g-sin-el-modelo-que-nadie-pidio
referenceSolutions:
  - label: la reserva vive adentro y el salón la consulta
    contextInversion: 'quedarse con la reserva adentro gana cuando el salón trabaja con las pantallas de la casa y no hay ningún sistema previo que respetar: un solo lugar donde vive la verdad de quién come esta noche, y el mozo mira lo mismo que confirmó el comensal. Se paga con que el equipo tiene que construir y sostener la pantalla del salón, que no es el producto por el que la dueña pagó.'
    design:
      nodes:
        - id: comensal
          type: actor
          label: Comensal
          zone: public
        - id: web
          type: web-client
          label: Web de reservas
          zone: public
        - id: mozo
          type: actor
          label: Encargado de salón
          zone: public
        - id: tablet
          type: web-client
          label: Tablero del salón
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reservas
          type: service
          label: Servicio de reservas
          zone: private
          role: reservations-service
        - id: base
          type: database
          label: Base de reservas
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: comensal-web
          from: { node: comensal }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: mozo-tablet
          from: { node: mozo }
          to: { node: tablet }
          dataClass: public
        - id: tablet-gw
          from: { node: tablet }
          to: { node: gw }
          dataClass: personal
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: reservas-base
          from: { node: reservas }
          to: { node: base }
          dataClass: personal
  - label: la reserva se escribe y se le pasa al sistema de mesas que el local ya usa
    contextInversion: 'empujar la reserva al sistema de mesas gana cuando el local ya trabaja con uno y no lo va a dejar: los mozos aprendieron esa pantalla, el cierre de caja sale de ahí, y pelear contra eso es pedirle al negocio que cambie para que el sistema no cambie. La base propia sigue existiendo porque el registro de qué se confirmó tiene que ser tuyo. Se paga con una integración que mantener y con dos lugares donde la misma mesa aparece nombrada distinto.'
    design:
      nodes:
        - id: comensal
          type: actor
          label: Comensal
          zone: public
        - id: web
          type: web-client
          label: Web de reservas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: reservas
          type: service
          label: Servicio de reservas
          zone: private
          role: reservations-service
        - id: base
          type: database
          label: Base de reservas
          zone: restricted
          props: { backup: "diario" }
        - id: mesas
          type: external-provider
          label: Sistema de mesas del local
          zone: dmz
      edges:
        - id: comensal-web
          from: { node: comensal }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-reservas
          from: { node: gw }
          to: { node: reservas }
          dataClass: personal
        - id: reservas-base
          from: { node: reservas }
          to: { node: base }
          dataClass: personal
        - id: reservas-mesas
          from: { node: reservas }
          to: { node: mesas }
          dataClass: personal
status: PILOT
---

Tres restaurantes de la misma dueña, **640 reservas por mes**. El comensal entra
a la web, elige día y hora, y recibe un correo de confirmación.

La lista que llegó al equipo tiene tres líneas:

> 1. *El comensal reserva desde la web.* **Firmada por la dueña.**
> 2. *Toda reserva confirmada tiene que poder consultarse el día del servicio, aunque el sistema se haya reiniciado.* **Firmada por la dueña.**
> 3. *Vamos a usar IA para resumir las reseñas de Google.* Lo pidió la agencia de marketing, en el mismo documento.

Las tres están bajo el mismo título. Ninguna viene marcada.

Ahora los números. Las reseñas de Google que el modelo resume son **11 por
semana**, y hoy las lee la dueña una por una el lunes a la mañana. El
presupuesto operativo son **3 unidades** y las tres ya están ocupadas: la puerta
de entrada, el servicio de reservas y el modelo.

Seguí la reserva en el diagrama. Entra por la web, pasa por la puerta, llega al
servicio, se confirma. Y ahí termina. **No hay ningún lugar donde quede
escrita.** El servicio se reinicia todas las madrugadas en el despliegue, y con
él se van las reservas del día siguiente.

El punto 2 dice *consultarse*, y dice *aunque el sistema se haya reiniciado*.
Esa segunda mitad de la frase es todo el requisito.

**Poné el lugar donde la reserva queda, dentro del presupuesto.** Vas a
descubrir que no entra hasta que saques lo que nadie firmó. Y que decidir eso
es el trabajo, no el trámite previo al trabajo.
