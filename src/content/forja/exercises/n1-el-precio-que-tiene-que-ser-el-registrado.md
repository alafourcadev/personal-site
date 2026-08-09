---
title: "El precio que tiene que ser el registrado"
level: 1
role: tradeoff
domain: comercio
tradeoffPairId: n1-catalogo-de-precios
D1: 1
D2: 2
D3: 1
D4: 1
D5: 1
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: 'libre, pero este ejercicio tiene un gemelo con el mismo diagrama y la conclusión contraria. Un modelo que no sepa cuál de los dos contextos estás resolviendo va a acertar la mitad de las veces.'
lambda: 0.5
constraints:
  - metric: diferencia admitida entre el precio mostrado y el precio registrado
    operator: "="
    value: 0
    unit: guaraníes
  - metric: tiempo aceptable de carga de la ficha de producto
    operator: "<="
    value: 3
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: la copia rápida se refresca cada 5 minutos, y el área comercial corrige precios varias veces por día, a veces a la baja, por una promoción que ya salió publicada.
    discoveryPath: preguntate cuánto tiempo puede pasar entre que el precio cambia en el registro y que la copia se entera. Ese número es exactamente el tiempo durante el cual el sistema puede mostrar un precio que ya no existe.
  - fact: la ficha de producto, leída contra el registro real, carga en 480 milisegundos. El requisito acepta 3 segundos.
    discoveryPath: 'compará los dos números del enunciado antes de defender la copia por velocidad: la copia no está resolviendo el requisito de tiempo, que ya se cumplía sin ella.'
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tienda
      type: web-client
      label: Tienda online
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: catalogo
      type: service
      label: Servicio de catálogo
      zone: private
      role: catalog-service
      given: true
      position: { x: 445, y: 300 }
    - id: precios
      type: database
      label: Registro de precios
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: copia
      type: cache
      label: Copia rápida del catálogo
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: cliente-tienda
      from: { node: cliente }
      to: { node: tienda }
      dataClass: public
    - id: tienda-gw
      from: { node: tienda }
      to: { node: gw }
      dataClass: public
    - id: gw-catalogo
      from: { node: gw }
      to: { node: catalogo }
      dataClass: public
    - id: catalogo-precios
      from: { node: catalogo }
      to: { node: precios }
      dataClass: public
    - id: catalogo-copia
      from: { node: catalogo }
      to: { node: copia }
      dataClass: public
guarantees:
  - id: g-precio-desde-el-registro
    label: el precio que se muestra viene del registro, no de una copia
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: catalog-service
      to:
        type: [cache, cdn]
    whyMissing: el servicio de catálogo se apoya en una copia del catálogo. Una copia siempre está un poco atrás del registro, y "un poco" acá es el tiempo entre dos refrescos.
    consequence: 'el cliente ve un precio que el área comercial cambió hace tres minutos y la ley de defensa del consumidor obliga a respetarlo. La copia no es un error de programación: es una decisión que le regala descuentos a quien entre en el momento equivocado.'
  - id: g-cliente-llega-al-registro
    label: el cliente llega al registro de precios pasando por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        type: [database]
      via:
        type: [api-gateway]
      forbid:
        type: [cache, cdn]
    whyMissing: no quedó un camino desde la tienda hasta el registro de precios que pase por la puerta de entrada sin apoyarse en ninguna copia.
    consequence: sacar la copia sin dejar el camino directo al registro deja la tienda mostrando fichas vacías. El requisito no era eliminar una pieza, era que el precio publicado sea el registrado.
  - id: g-catalogo-en-el-camino
    label: el servicio de catálogo sigue siendo por donde se entra al catálogo
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: catalog-service
    whyMissing: la puerta de entrada ya no llega al servicio de catálogo.
    consequence: si la puerta deja de llegar al catálogo, no importa cuán correcto sea el precio guardado. No hay nadie del lado de adentro que sepa armar una ficha de producto.
rubric:
  - dimension: el precio publicado y el registrado son el mismo número siempre
    signal:
      kind: predicate
      guaranteeId: g-precio-desde-el-registro
  - dimension: la ficha de producto se sigue pudiendo abrir
    signal:
      kind: predicate
      guaranteeId: g-cliente-llega-al-registro
  - dimension: el catálogo sigue teniendo dueño del lado de adentro
    signal:
      kind: predicate
      guaranteeId: g-catalogo-en-el-camino
referenceSolutions:
  - label: un servicio que lee el registro
    contextInversion: 'un solo servicio leyendo el registro gana cuando el catálogo lo mantiene el mismo equipo que lo publica: menos piezas, un solo lugar donde se define qué es un precio válido, y la lectura tarda 480 ms contra los 3 segundos que el requisito acepta. Se paga con que toda la lógica de precios vive en el mismo servicio que arma la ficha: promociones, listas por cliente, redondeos. Y ese servicio crece.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: tienda
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: catalogo
          type: service
          label: Servicio de catálogo
          zone: private
          role: catalog-service
        - id: precios
          type: database
          label: Registro de precios
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: public
        - id: gw-catalogo
          from: { node: gw }
          to: { node: catalogo }
          dataClass: public
        - id: catalogo-precios
          from: { node: catalogo }
          to: { node: precios }
          dataClass: public
  - label: el precio lo responde quien lo administra
    contextInversion: 'separar el precio en su propio servicio gana cuando la lista de precios la maneja el área comercial con sus propias reglas y su propio calendario de cambios: el equipo de catálogo deja de tener que entender promociones para poder publicar una ficha. Se paga con una unidad operativa más y con una llamada extra en el camino de cada lectura: dos servicios encadenados, dos disponibilidades que se multiplican.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: tienda
          type: web-client
          label: Tienda online
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: catalogo
          type: service
          label: Servicio de catálogo
          zone: private
          role: catalog-service
        - id: servicio-precios
          type: service
          label: Servicio de precios
          zone: private
        - id: precios
          type: database
          label: Registro de precios
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: public
        - id: gw-catalogo
          from: { node: gw }
          to: { node: catalogo }
          dataClass: public
        - id: catalogo-servicio-precios
          from: { node: catalogo }
          to: { node: servicio-precios }
          dataClass: public
        - id: servicio-precios-registro
          from: { node: servicio-precios }
          to: { node: precios }
          dataClass: public
status: PILOT
---

Una tienda online de electrodomésticos, **1.100 fichas de producto**, tráfico
parejo todo el año. El cliente abre una ficha y ve un precio.

El área legal escribió el requisito después de una multa:

> *"El precio publicado tiene que ser exactamente el precio registrado, en todo
> momento."*

En todo momento. No "casi siempre", no "con un margen de unos minutos". La ley
de defensa del consumidor obliga a respetar el precio publicado, así que un
precio viejo en pantalla no es un defecto cosmético: es plata que sale.

En el diagrama hay una copia rápida del catálogo. Se refresca cada 5 minutos.
El área comercial corrige precios varias veces por día. Hacé la cuenta: hay
ventanas de hasta 5 minutos en las que la tienda publica un número que el
registro ya no tiene.

El argumento con el que entró la copia fue la velocidad. Los números: la ficha
leída contra el registro carga en **480 ms** y el requisito acepta **3
segundos**. La copia no está resolviendo el requisito de tiempo. Ese ya se
cumplía.

**Sacá la copia del camino del precio y dejá la tienda funcionando.**

> Este ejercicio tiene un gemelo: el mismo catálogo, la misma tienda, otro
> contexto. Ahí la conclusión se da vuelta. Si tu respuesta acá te parece
> obviamente correcta *siempre*, todavía no leíste el otro.
