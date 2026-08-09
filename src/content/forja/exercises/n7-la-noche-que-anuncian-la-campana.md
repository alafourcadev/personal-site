---
title: "La noche que anuncian la campaña"
level: 7
role: counter-trap
domain: salud
D1: 2
D2: 2
D3: 2
D4: 2
D5: 2
D6: 3
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que traer, otra vez, el número del pico y el número de un día normal, uno al lado del otro. Acá esos dos números dicen algo distinto de lo que decían la última vez, y el diseño cambia con ellos."
lambda: 2.5
constraints:
  - metric: visitas al listado de vacunatorios en los 40 minutos posteriores al anuncio
    operator: ">="
    value: 2900000
    unit: visitas
  - metric: visitas al listado de vacunatorios en un día normal
    operator: "<="
    value: 9000
    unit: visitas
  - metric: presupuesto operativo de la red (techo duro)
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "el listado de vacunatorios son 340 filas con dirección, horario y si tienen dosis. Es idéntico para todo el mundo: no se filtra por plan, ni por edad, ni por quién sos. Dos personas distintas ven exactamente la misma pantalla."
    discoveryPath: "abrí la pantalla con dos personas distintas y compará el resultado, igual que hiciste con la grilla de turnos. Acá el resultado sí es el mismo, y eso es exactamente lo que habilita repartirlo."
  - fact: "en los 40 minutos posteriores al anuncio entran 2.900.000 visitas al listado: unas 1.200 por segundo, sostenidas. Un día normal el listado recibe 9.000 visitas en total, repartidas en veinticuatro horas."
    discoveryPath: "pedí el número del pico y el del día normal antes de decidir. La última vez la diferencia era de un 7 % y no justificaba nada; acá es de trescientos a uno."
  - fact: "el listado cambia como mucho dos veces por día, cuando un vacunatorio abre, cierra o se queda sin dosis. Durante los 40 minutos del anuncio no cambia nunca."
    discoveryPath: "preguntá cuándo cambia el dato que estás sirviendo. Si no cambia durante el pico, no hace falta calcularlo durante el pico."
  - fact: "en esos mismos 40 minutos se reservan 31.000 turnos, y cada turno se firma con el documento de la persona. Ese camino no se puede repartir ni copiar: es personal y tiene que quedar escrito."
    discoveryPath: "separá el tráfico que es igual para todos del que depende de quién sos. Son dos problemas distintos, y la respuesta correcta para uno es la respuesta equivocada para el otro."
startingDesign:
  nodes:
    - id: vecino
      type: web-client
      label: Navegador del vecino
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: puntos
      type: service
      label: Servicio del listado de vacunatorios
      zone: private
      role: puntos-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: turnos
      type: service
      label: Servicio de turnos
      zone: private
      role: turnos-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: agenda
      type: database
      label: Base de la agenda y del padrón de vacunatorios
      zone: restricted
      role: agenda-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: vecino-gw
      from: { node: vecino }
      to: { node: gw }
      dataClass: public
    - id: gw-puntos
      from: { node: gw }
      to: { node: puntos }
      dataClass: public
    - id: gw-turnos
      from: { node: gw }
      to: { node: turnos }
      dataClass: personal
    - id: puntos-agenda
      from: { node: puntos }
      to: { node: agenda }
      dataClass: public
    - id: turnos-agenda
      from: { node: turnos }
      to: { node: agenda }
      dataClass: personal
    - id: turnos-obs
      from: { node: turnos }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-listado-repartido
    label: el listado de vacunatorios llega a una red de distribución
    weight: 3
    predicate:
      op: path
      from:
        role: puntos-service
      to:
        type: [cdn]
    whyMissing: lo que arma el servicio del listado no llega a ninguna red de distribución, así que los 2.900.000 pedidos terminan dentro de tu infraestructura.
    consequence: "1.200 pedidos por segundo, sostenidos durante cuarenta minutos, contra un servicio que consulta la misma base donde se están reservando 31.000 turnos. Lo primero que se cae no es el listado: es la base, y con la base se cae la reserva, que era lo único que la campaña necesitaba que funcionara."
  - id: g-listado-fuera-de-la-puerta
    label: la puerta de entrada ya no llama al servicio del listado
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: puntos-service
    whyMissing: la puerta de entrada sigue teniendo una conexión directa al servicio del listado, así que el pico de lectura le sigue llegando igual.
    consequence: "poner una pieza nueva adelante y dejar el camino viejo abierto no saca a nadie de encima: el tráfico entra por donde encuentra. Mientras exista esa conexión, tu puerta de entrada sigue siendo el techo de toda la campaña."
  - id: g-turno-sigue-entrando
    label: la reserva de turno sigue entrando por la puerta de entrada
    weight: 2
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: turnos-service
    whyMissing: no hay ningún camino desde el navegador del vecino hasta el servicio de turnos.
    consequence: "el turno se firma con el documento de la persona: no se puede servir desde una copia repartida ni desde ningún lado que no sepa quién está del otro lado. Sacar la puerta de entrada resuelve el pico apagando la única parte de la campaña donde alguien hace algo."
  - id: g-turno-persiste
    label: el turno reservado queda escrito en algo que sobrevive a un reinicio
    weight: 1
    predicate:
      op: noVolatileCut
      from:
        role: turnos-service
      to:
        role: agenda-db
    whyMissing: entre el servicio de turnos y la base de la agenda no queda ninguna pieza que sobreviva a un reinicio, o directamente no hay camino entre los dos.
    consequence: "treinta y un mil personas que creen tener turno y un vacunatorio que no las espera es una cola en la vereda a las siete de la mañana. En una campaña, el turno perdido no se reintenta: se convierte en una persona que no se vacuna."
  - id: g-turnos-observado
    label: el equipo ve la noche del anuncio mientras pasa
    weight: 1
    predicate:
      op: covered
      target:
        role: turnos-service
      by:
        type: [observability]
    whyMissing: el servicio de turnos no está conectado a ningún componente de monitoreo.
    consequence: "la campaña se anuncia una vez y el pico dura cuarenta minutos. Si te enterás al día siguiente de que las reservas fallaban, lo que te queda no es un incidente: es una franja horaria de vacunación vacía y una nota en el noticiero."
rubric:
  - dimension: el tráfico que es igual para todos salió de tu infraestructura
    signal:
      kind: predicate
      guaranteeId: g-listado-repartido
  - dimension: el camino viejo quedó cerrado, no sólo evitado
    signal:
      kind: predicate
      guaranteeId: g-listado-fuera-de-la-puerta
  - dimension: lo personal sigue entrando por donde tiene que entrar
    signal:
      kind: predicate
      guaranteeId: g-turno-sigue-entrando
  - dimension: el turno reservado sobrevive a un reinicio
    signal:
      kind: predicate
      guaranteeId: g-turno-persiste
  - dimension: la noche del anuncio es visible mientras ocurre
    signal:
      kind: predicate
      guaranteeId: g-turnos-observado
  - dimension: el diseño entra en el presupuesto operativo de la red
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: la red de distribución le pide el listado al servicio
    contextInversion: "que la red de distribución le pida el listado al servicio cuando le vence la copia es lo correcto cuando un vacunatorio puede quedarse sin dosis en cualquier momento y la corrección tiene que propagarse sola: nadie del equipo de campaña tiene que acordarse de publicar nada, y el cambio aparece al vencer la copia siguiente. Se paga con que el servicio del listado tiene que estar vivo durante toda la noche, recibiendo poco tráfico pero real, y con que si se cae justo cuando vence una copia, esa parte del listado se cae con él."
    design:
      nodes:
        - id: vecino
          type: web-client
          label: Navegador del vecino
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: puntos
          type: service
          label: Servicio del listado de vacunatorios
          zone: private
          role: puntos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: turnos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: agenda
          type: database
          label: Base de la agenda y del padrón de vacunatorios
          zone: restricted
          role: agenda-db
          props: { backup: "diario" }
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: vecino-gw
          from: { node: vecino }
          to: { node: gw }
          dataClass: public
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: puntos-agenda
          from: { node: puntos }
          to: { node: agenda }
          dataClass: public
        - id: puntos-distribucion
          from: { node: puntos }
          to: { node: distribucion }
          dataClass: public
        - id: turnos-agenda
          from: { node: turnos }
          to: { node: agenda }
          dataClass: personal
        - id: turnos-obs
          from: { node: turnos }
          to: { node: obs }
          dataClass: public
  - label: el listado se publica como archivo cada vez que cambia
    contextInversion: "publicar el listado como un archivo y que la red sirva sólo de ahí es lo correcto cuando querés que la campaña se siga viendo aunque tu sistema no esté: la noche del anuncio es el peor momento posible para depender de que algo tuyo siga vivo, y el último listado publicado sigue online sin nadie detrás. Como el listado cambia dos veces por día, republicar es barato y previsible. Se paga con un paso más: si la publicación se traba, el listado se congela sin que nada se vea roto. Y se paga con que un vacunatorio que se queda sin dosis a las 21:10 sigue apareciendo como disponible hasta la siguiente publicación."
    design:
      nodes:
        - id: vecino
          type: web-client
          label: Navegador del vecino
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: puntos
          type: service
          label: Servicio del listado de vacunatorios
          zone: private
          role: puntos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: turnos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: agenda
          type: database
          label: Base de la agenda y del padrón de vacunatorios
          zone: restricted
          role: agenda-db
          props: { backup: "diario" }
        - id: publicado
          type: object-storage
          label: Listado publicado
          zone: private
        - id: distribucion
          type: cdn
          label: Red de distribución
          zone: dmz
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: vecino-gw
          from: { node: vecino }
          to: { node: gw }
          dataClass: public
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: puntos-agenda
          from: { node: puntos }
          to: { node: agenda }
          dataClass: public
        - id: puntos-publicado
          from: { node: puntos }
          to: { node: publicado }
          dataClass: public
        - id: publicado-distribucion
          from: { node: publicado }
          to: { node: distribucion }
          dataClass: public
        - id: turnos-agenda
          from: { node: turnos }
          to: { node: agenda }
          dataClass: personal
        - id: turnos-obs
          from: { node: turnos }
          to: { node: obs }
          dataClass: public
status: PILOT
---

La misma red de salud, cuatro meses después. El ministerio anuncia la campaña
de vacunación antigripal en la cadena de las nueve de la noche.

En los **cuarenta minutos** siguientes, **2.900.000 personas** abren la pantalla
"¿dónde me vacuno?". Un día normal esa pantalla recibe nueve mil visitas en
veinticuatro horas.

El equipo llega a la reunión con la lección del lunes a las ocho todavía
puesta y la propuesta de siempre les da desconfianza: la última vez, sacar la
pantalla de la infraestructura era la respuesta equivocada. Así que esta vez
alguien pide los números antes de decidir. Bien.

- Pico: **1.200 pedidos por segundo**, sostenidos cuarenta minutos.
- Día normal: **nueve mil visitas en todo el día**.

Trescientos a uno. No es un martes con mala prensa: es un pico real, medido, y
con fecha y hora conocidas.

Y las dos preguntas que la vez pasada hundieron la idea, acá se contestan al
revés:

- **¿Es la misma pantalla para todos?** Sí. Son 340 filas con dirección,
  horario y si tienen dosis. No se filtra por plan, ni por edad, ni por quién
  sos.
- **¿Cambia durante el pico?** No. Cambia como mucho dos veces por día, cuando
  un vacunatorio abre, cierra o se queda sin dosis.

Al mismo tiempo, en esos mismos cuarenta minutos se reservan **31.000 turnos**,
y cada uno se firma con el documento de la persona. Ese camino no se reparte
ni se copia: entra por la puerta de entrada y queda escrito.

El sistema son cinco piezas despiertas y **el presupuesto es exactamente
cinco**. La buena noticia es que la pieza que resuelve esto no cuesta ninguna.

**Sacá el pico de lectura de encima de tu infraestructura, sin pasarte de
cinco unidades operativas y sin tocar el camino de la reserva.** Esta vez la
respuesta obvia es la correcta, y saber por qué lo es acá y no lo era allá es
todo el ejercicio.
