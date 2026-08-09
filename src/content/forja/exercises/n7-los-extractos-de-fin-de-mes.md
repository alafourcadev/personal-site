---
title: "Los extractos de fin de mes"
level: 7
role: core
domain: banca
D1: 2
D2: 3
D3: 3
D4: 2
D5: 3
D6: 3
D7: 1
D8: 0
D9: 2
prerequisiteLevels: [6]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué piezas sacaste y por qué el trabajo que hacían no desaparece, sólo cambia de lugar."
lambda: 2.5
constraints:
  - metric: extractos pedidos el día 1 de cada mes
    operator: ">="
    value: 380000
    unit: extractos
  - metric: extractos pedidos un día cualquiera
    operator: "<="
    value: 38000
    unit: extractos
  - metric: presupuesto operativo del equipo (techo duro)
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "armar un extracto tarda entre 4 y 11 segundos: hay que leer doce meses de movimientos y componer un PDF. El cliente espera con la pantalla en blanco."
    discoveryPath: "medí cuánto tarda una respuesta y compará con cuánto está dispuesto a esperar alguien mirando una pantalla. Si el trabajo dura más que la paciencia, el problema no es la velocidad: es que el trabajo está en el lugar equivocado."
  - fact: "la base de plantillas tiene cuatro filas y cambia dos veces al año, cuando cambia el pie de página legal."
    discoveryPath: "mirá cuánto cuesta operar cada pieza y con qué frecuencia cambia lo que guarda. Una base con cuatro filas cuesta exactamente lo mismo de operar que la que tiene cuarenta millones de movimientos."
  - fact: "el 92 % de los extractos del día 1 se piden entre las 8 y las 11 de la mañana, y el 40 % se vuelve a pedir dentro de las 48 horas siguientes: el mismo extracto, del mismo mes, por el mismo cliente."
    discoveryPath: "seguí qué pasa con un extracto después de que se generó. Si el resultado no cambia nunca y se pide más de una vez, generarlo dos veces es trabajo que estás pagando dos veces."
startingDesign:
  nodes:
    - id: cliente
      type: mobile-client
      label: App del banco
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: extractos
      type: service
      label: Servicio de extractos
      zone: private
      role: extractos-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: render
      type: service
      label: Servicio de armado de PDF
      zone: private
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: movimientos
      type: database
      label: Base de movimientos
      zone: restricted
      role: libro-mayor
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: plantillas
      type: database
      label: Base de plantillas del extracto
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: obs
      type: observability
      label: Monitoreo
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: cliente-gw
      from: { node: cliente }
      to: { node: gw }
      dataClass: personal
    - id: gw-extractos
      from: { node: gw }
      to: { node: extractos }
      dataClass: personal
    - id: extractos-render
      from: { node: extractos }
      to: { node: render }
      dataClass: personal
    - id: render-movimientos
      from: { node: render }
      to: { node: movimientos }
      dataClass: regulated
    - id: render-plantillas
      from: { node: render }
      to: { node: plantillas }
      dataClass: public
    - id: extractos-obs
      from: { node: extractos }
      to: { node: obs }
      dataClass: public
guarantees:
  - id: g-armado-diferido
    label: el extracto se arma fuera del pedido y queda guardado como archivo
    weight: 3
    predicate:
      op: path
      from:
        role: extractos-service
      to:
        type: [object-storage]
      via:
        type: [queue, stream]
    whyMissing: el camino desde el servicio de extractos hasta un almacén de archivos no pasa por ninguna pieza donde el trabajo pueda esperar su turno, o directamente no hay almacén donde dejar el resultado.
    consequence: "un trabajo de once segundos dentro de un pedido ocupa un proceso once segundos. A 380.000 pedidos en tres horas, lo que se agota no es el procesador: son las conexiones. El sistema deja de responder también a los que sólo querían ver el saldo."
  - id: g-libro-alcanzable
    label: el extracto se sigue armando con los movimientos reales
    weight: 1
    predicate:
      op: path
      from:
        role: extractos-service
      to:
        role: libro-mayor
    whyMissing: no hay ningún camino desde el servicio de extractos hasta la base de movimientos.
    consequence: "un extracto que no lee el libro de movimientos es un PDF vacío entregado a tiempo. Mover el trabajo de lugar no puede significar dejar de hacerlo."
  - id: g-cliente-entra
    label: el cliente sigue llegando al servicio de extractos
    weight: 1
    predicate:
      op: path
      from:
        type: [mobile-client]
      to:
        role: extractos-service
    whyMissing: no hay ningún camino desde la app del banco hasta el servicio de extractos.
    consequence: "sacar piezas para entrar en el presupuesto no puede terminar cerrando la puerta. Un extracto que el cliente no puede pedir no es un extracto barato: es una funcionalidad apagada."
  - id: g-extractos-observado
    label: el equipo ve la acumulación del día 1 mientras pasa
    weight: 1
    predicate:
      op: covered
      target:
        role: extractos-service
      by:
        type: [observability]
    whyMissing: el servicio de extractos no está conectado a ningún componente de monitoreo.
    consequence: "el día 1 es el único día del mes en que este sistema trabaja distinto. Si no lo mirás mientras pasa, lo que te queda son 380.000 registros y un mes para el siguiente intento."
rubric:
  - dimension: el trabajo largo salió del camino del pedido
    signal:
      kind: predicate
      guaranteeId: g-armado-diferido
  - dimension: el extracto sigue diciendo la verdad
    signal:
      kind: predicate
      guaranteeId: g-libro-alcanzable
  - dimension: el cliente sigue pudiendo pedir su extracto
    signal:
      kind: predicate
      guaranteeId: g-cliente-entra
  - dimension: el pico mensual es visible mientras ocurre
    signal:
      kind: predicate
      guaranteeId: g-extractos-observado
  - dimension: el diseño entra en el presupuesto operativo del equipo
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: cola, procesador de fondo, y la descarga desde la red de distribución
    contextInversion: "sacar la descarga hacia una red de distribución es lo correcto cuando el mismo extracto se pide más de una vez: el 40 % de las descargas del día 1 son repeticiones, y ninguna de esas repeticiones tiene por qué tocar tu infraestructura. Es la variante que más tráfico saca de encima. Se paga con que el archivo queda accesible por una dirección firmada que vos no controlás pedido a pedido, así que la caducidad del enlace es la única barrera que te queda."
    design:
      nodes:
        - id: cliente
          type: mobile-client
          label: App del banco
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: extractos
          type: service
          label: Servicio de extractos
          zone: private
          role: extractos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: Cola de extractos pendientes
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: generador
          type: worker
          label: Generador de extractos
          zone: private
        - id: movimientos
          type: database
          label: Base de movimientos
          zone: restricted
          role: libro-mayor
          props: { backup: "diario" }
        - id: archivos
          type: object-storage
          label: Almacén de extractos generados
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
        - id: cliente-gw
          from: { node: cliente }
          to: { node: gw }
          dataClass: personal
        - id: gw-extractos
          from: { node: gw }
          to: { node: extractos }
          dataClass: personal
        - id: extractos-cola
          from: { node: extractos }
          to: { node: cola }
          dataClass: personal
        - id: cola-generador
          from: { node: cola }
          to: { node: generador }
          dataClass: personal
        - id: generador-movimientos
          from: { node: generador }
          to: { node: movimientos }
          dataClass: regulated
        - id: generador-archivos
          from: { node: generador }
          to: { node: archivos }
          dataClass: regulated
        - id: archivos-distribucion
          from: { node: archivos }
          to: { node: distribucion }
          dataClass: regulated
        - id: extractos-obs
          from: { node: extractos }
          to: { node: obs }
          dataClass: public
        - id: cola-obs
          from: { node: cola }
          to: { node: obs }
          dataClass: public
  - label: un registro de eventos y la descarga por el propio servicio
    contextInversion: "que la descarga pase por el servicio de extractos es lo correcto cuando cada acceso a un extracto tiene que quedar registrado con nombre y hora, que en un banco suele ser una obligación, no una preferencia. Un registro de eventos, además, te deja volver a generar los extractos de un mes entero releyendo lo que ya pasó, cosa que una cola consumida no te permite. Se paga con que las descargas repetidas sí entran a tu infraestructura, y con retención: los eventos ocupan lugar aunque nadie los vuelva a leer."
    design:
      nodes:
        - id: cliente
          type: mobile-client
          label: App del banco
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: extractos
          type: service
          label: Servicio de extractos
          zone: private
          role: extractos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: eventos
          type: stream
          label: Registro de extractos pedidos
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: generador
          type: worker
          label: Generador de extractos
          zone: private
        - id: movimientos
          type: database
          label: Base de movimientos
          zone: restricted
          role: libro-mayor
          props: { backup: "diario" }
        - id: archivos
          type: object-storage
          label: Almacén de extractos generados
          zone: private
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: cliente-gw
          from: { node: cliente }
          to: { node: gw }
          dataClass: personal
        - id: gw-extractos
          from: { node: gw }
          to: { node: extractos }
          dataClass: personal
        - id: extractos-eventos
          from: { node: extractos }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-generador
          from: { node: eventos }
          to: { node: generador }
          dataClass: personal
        - id: generador-movimientos
          from: { node: generador }
          to: { node: movimientos }
          dataClass: regulated
        - id: generador-archivos
          from: { node: generador }
          to: { node: archivos }
          dataClass: regulated
        - id: extractos-archivos
          from: { node: extractos }
          to: { node: archivos }
          dataClass: regulated
        - id: extractos-obs
          from: { node: extractos }
          to: { node: obs }
          dataClass: public
        - id: eventos-obs
          from: { node: eventos }
          to: { node: obs }
          dataClass: public
status: PILOT
---

Un banco digital atiende **38.000 pedidos de extracto** un día cualquiera.
El día 1 de cada mes atiende **380.000**, y el 92 % de esos entra entre las
ocho y las once de la mañana.

Diez veces el tráfico, doce veces al año, con fecha conocida.

Armar un extracto tarda entre cuatro y once segundos: hay que leer doce
meses de movimientos y componer un PDF. Hoy eso pasa **dentro del pedido**,
con el cliente esperando la pantalla en blanco.

El mes pasado, entre las 9 y las 10, la app dejó de responder también para
consultar el saldo. Nadie estaba pidiendo saldos de más: los procesos
estaban todos ocupados armando PDFs.

El sistema tiene seis piezas despiertas: la puerta de entrada, el servicio
de extractos, el servicio de armado, la base de movimientos, la base de
plantillas y el monitoreo. **El presupuesto es exactamente seis**. Cualquier
cosa que entre obliga a que salga otra.

Dos datos que ya están sobre la mesa y que la mayoría no mira: la base de
plantillas tiene **cuatro filas** y cambia dos veces al año. Y el 40 % de los
extractos del día 1 se vuelve a pedir dentro de las 48 horas: **el mismo
archivo, generado otra vez**.

**Sacá el trabajo largo del camino del pedido, sin pasarte de seis unidades
operativas.** El trabajo no desaparece: cambia de lugar, y de paso deja un
resultado que se puede volver a entregar sin volver a hacerlo.
