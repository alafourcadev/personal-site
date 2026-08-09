---
title: "El minuto a minuto que puede esperar treinta segundos"
level: 7
role: tradeoff
domain: deportes
tradeoffPairId: n7-el-minuto-a-minuto
D1: 2
D2: 3
D3: 2
D4: 2
D5: 2
D6: 3
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir cuántos segundos de retraso aceptás y por qué el negocio los tolera. Un diseño sin ese número no se puede defender."
lambda: 2.5
constraints:
  - metric: espectadores simultáneos en la ficha del partido
    operator: ">="
    value: 640000
    unit: espectadores
  - metric: retraso tolerado en el minuto a minuto
    operator: "<="
    value: 30
    unit: segundos
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "los 640.000 espectadores ven exactamente la misma ficha. El minuto a minuto no está personalizado y no hay nada en esa pantalla que dependa de quién sos."
    discoveryPath: "abrí la ficha con dos sesiones distintas durante el partido: mismo HTML, mismo texto, mismo minuto. Lo que es igual para todos se puede copiar una vez y repartir."
  - fact: "el redactor carga una jugada cada 40 o 50 segundos. La pantalla del espectador se refresca sola cada 15."
    discoveryPath: "compará el ritmo al que cambia el dato con el ritmo al que se lo pedís. Si preguntás tres veces por cada cambio, dos de esas tres respuestas son una copia de la anterior."
  - fact: "la sección de comentarios sí es personal y sí necesita la puerta de entrada: cada comentario se firma con la cuenta de quien lo escribe. Son unos 900 comentarios por partido contra 640.000 espectadores."
    discoveryPath: "separá el tráfico que es igual para todos del que depende de quién sos. Son dos problemas distintos y la respuesta correcta para uno es la respuesta equivocada para el otro."
startingDesign:
  nodes:
    - id: lector
      type: web-client
      label: Navegador del espectador
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: vivo
      type: service
      label: Servicio del minuto a minuto
      zone: private
      role: vivo-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: comentarios
      type: service
      label: Servicio de comentarios
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: redaccion
      type: database
      label: Base de la redacción
      zone: restricted
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
    - id: lector-gw
      from: { node: lector }
      to: { node: gw }
      dataClass: public
    - id: gw-vivo
      from: { node: gw }
      to: { node: vivo }
      dataClass: public
    - id: gw-comentarios
      from: { node: gw }
      to: { node: comentarios }
      dataClass: personal
    - id: vivo-redaccion
      from: { node: vivo }
      to: { node: redaccion }
      dataClass: public
    - id: comentarios-redaccion
      from: { node: comentarios }
      to: { node: redaccion }
      dataClass: personal
    - id: vivo-obs
      from: { node: vivo }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-vivo-publicado
    label: el minuto a minuto llega a una red de distribución
    weight: 3
    predicate:
      op: path
      from:
        role: vivo-service
      to:
        type: [cdn]
    whyMissing: lo que arma el servicio del minuto a minuto no llega a ninguna red de distribución.
    consequence: "640.000 pantallas refrescando cada quince segundos son más de 40.000 pedidos por segundo contra un servicio que además consulta la base de la redacción. No hay presupuesto en este ejercicio que sostenga eso adentro."
  - id: g-vivo-fuera-del-camino
    label: la puerta de entrada ya no llama al servicio del minuto a minuto
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: vivo-service
    whyMissing: la puerta de entrada sigue teniendo una conexión directa al servicio del minuto a minuto, así que el pico de lectura le sigue llegando.
    consequence: "poner una red de distribución y dejar el camino viejo abierto no saca a nadie de encima: el tráfico entra por donde encuentra. Mientras exista esa conexión, el servicio sigue siendo el techo de todo el sistema."
  - id: g-interactivo-sigue-entrando
    label: la parte personal del sitio sigue teniendo puerta de entrada
    weight: 1
    predicate:
      op: exists
      node:
        type: [api-gateway]
    whyMissing: no hay ninguna puerta de entrada en el diseño.
    consequence: "los comentarios se firman con la cuenta de quien escribe, y eso no se puede servir desde una copia repartida. Sacar la puerta de entrada resuelve el pico apagando la única parte del producto donde el espectador hace algo."
  - id: g-vivo-tiene-de-donde-leer
    label: el minuto a minuto sale de algo que persiste
    weight: 1
    predicate:
      op: path
      from:
        role: vivo-service
      to:
        type: [database]
    whyMissing: el servicio del minuto a minuto no llega a ninguna base, así que no tiene de dónde sacar lo que publica.
    consequence: "una página publicada que no lee nada es una página que se queda en el minuto en que la publicaste. El redactor carga una jugada cada 40 segundos y esa jugada tiene que llegar a la pantalla."
rubric:
  - dimension: el pico de lectura se sirve desde fuera de tu infraestructura
    signal:
      kind: predicate
      guaranteeId: g-vivo-publicado
  - dimension: el camino viejo quedó cerrado, no sólo evitado
    signal:
      kind: predicate
      guaranteeId: g-vivo-fuera-del-camino
  - dimension: lo personal sigue entrando por donde tiene que entrar
    signal:
      kind: predicate
      guaranteeId: g-interactivo-sigue-entrando
  - dimension: lo que se publica sigue saliendo de la redacción
    signal:
      kind: predicate
      guaranteeId: g-vivo-tiene-de-donde-leer
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 5
      unit: unidades operativas
referenceSolutions:
  - label: la red de distribución le pide la ficha al servicio
    contextInversion: "que la red de distribución le pida la ficha al servicio cuando le vence la copia es lo correcto cuando el partido cambia solo y sin aviso: nadie tiene que acordarse de publicar, y una corrección del redactor aparece al vencer la copia siguiente. Se paga con que el servicio recibe un pedido por cada vencimiento y tiene que estar vivo durante todo el partido."
    design:
      nodes:
        - id: lector
          type: web-client
          label: Navegador del espectador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: vivo
          type: service
          label: Servicio del minuto a minuto
          zone: private
          role: vivo-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: comentarios
          type: service
          label: Servicio de comentarios
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: redaccion
          type: database
          label: Base de la redacción
          zone: restricted
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
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-comentarios
          from: { node: gw }
          to: { node: comentarios }
          dataClass: personal
        - id: vivo-redaccion
          from: { node: vivo }
          to: { node: redaccion }
          dataClass: public
        - id: comentarios-redaccion
          from: { node: comentarios }
          to: { node: redaccion }
          dataClass: personal
        - id: vivo-distribucion
          from: { node: vivo }
          to: { node: distribucion }
          dataClass: public
        - id: vivo-obs
          from: { node: vivo }
          to: { node: obs }
          dataClass: public
  - label: el servicio publica la ficha como archivo y la red sirve el archivo
    contextInversion: "publicar la ficha como archivo en un almacén de objetos y que la red sirva sólo de ahí es lo correcto cuando querés que el partido siga viéndose aunque el servicio se caiga: lo último publicado sigue online sin nadie detrás. Es la variante que menos depende de que algo tuyo esté vivo durante las dos horas del partido. Se paga con un paso más de publicación, y con que si ese paso se traba, la ficha se queda congelada sin que nada se vea roto."
    design:
      nodes:
        - id: lector
          type: web-client
          label: Navegador del espectador
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: vivo
          type: service
          label: Servicio del minuto a minuto
          zone: private
          role: vivo-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: comentarios
          type: service
          label: Servicio de comentarios
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: redaccion
          type: database
          label: Base de la redacción
          zone: restricted
          props: { backup: "diario" }
        - id: publicado
          type: object-storage
          label: Ficha publicada
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
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-comentarios
          from: { node: gw }
          to: { node: comentarios }
          dataClass: personal
        - id: vivo-redaccion
          from: { node: vivo }
          to: { node: redaccion }
          dataClass: public
        - id: comentarios-redaccion
          from: { node: comentarios }
          to: { node: redaccion }
          dataClass: personal
        - id: vivo-publicado
          from: { node: vivo }
          to: { node: publicado }
          dataClass: public
        - id: publicado-distribucion
          from: { node: publicado }
          to: { node: distribucion }
          dataClass: public
        - id: vivo-obs
          from: { node: vivo }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Una plataforma de deportes transmite la ficha del partido: formaciones,
goles y el minuto a minuto que escribe un redactor desde la cancha. En un
clásico llega a **640.000 espectadores simultáneos**, contra los 62.000 de un
partido de media semana.

El redactor carga una jugada cada 40 o 50 segundos. La pantalla del
espectador se refresca sola cada 15. Y el producto tiene un número que el
área editorial ya fijó: **treinta segundos de retraso son aceptables**. Nadie
se entera de un gol por esta ficha; se entera por el televisor.

El sistema son cinco piezas: puerta de entrada, servicio del minuto a
minuto, servicio de comentarios, base de la redacción y monitoreo. **El
presupuesto es exactamente cinco**.

Los 640.000 espectadores ven exactamente la misma ficha. La sección de
comentarios, en cambio, es personal: cada comentario se firma con la cuenta
de quien lo escribe, y son unos 900 por partido.

**Sacá el pico de lectura de encima de tu infraestructura, sin pasarte de
cinco unidades operativas y sin apagar los comentarios.** No alcanza con
poner una pieza nueva adelante: mientras el camino viejo siga abierto, el
tráfico lo va a encontrar.
