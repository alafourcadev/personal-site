---
title: "El precio que tiene que aguantar el viernes"
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
  - metric: antigüedad admitida del precio que ve el visitante
    operator: "<="
    value: 60
    unit: segundos
  - metric: visitas simultáneas que la ficha de producto tiene que sostener
    operator: ">="
    value: 40000
    unit: visitas por minuto
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: el 94 % del tráfico del viernes son lecturas de ocho productos, los mismos ocho que están en la publicidad. Nadie compra nada distinto en esa franja.
    discoveryPath: mirá la proporción entre lecturas y compras en el enunciado. Cuando casi todo el tráfico lee lo mismo, la pregunta deja de ser cómo hacer más rápida cada lectura y pasa a ser cómo dejar de repetirla.
  - fact: el registro de precios aguanta 900 lecturas por segundo antes de degradarse, y el pico proyectado del viernes es de 627 por segundo sólo en esos ocho productos.
    discoveryPath: 'compará el pico proyectado con lo que el registro aguanta: entran, pero sin margen para nada más. Ni para las compras, ni para la administración, ni para el pico dentro del pico.'
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Visitante
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
guarantees:
  - id: g-copia-mas-cerca
    label: la lectura repetida se responde desde una copia, no desde el registro
    weight: 3
    predicate:
      op: path
      from:
        role: catalog-service
      to:
        type: [cache, cdn]
    whyMissing: no hay ninguna copia entre el servicio de catálogo y quien lee. Cada una de las 40.000 visitas por minuto termina siendo una consulta al registro de precios.
    consequence: 'el registro aguanta 900 lecturas por segundo y el pico proyectado es de 627 sólo de esos ocho productos. Entran, y no queda nada: el registro se pasa el viernes contestando 627 veces por segundo la misma pregunta, y el margen que se come es el que necesitan las compras, que usan el mismo registro.'
  - id: g-registro-sigue-siendo-la-fuente
    label: el registro de precios sigue siendo la fuente y el cliente sigue llegando a él
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        type: [database]
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde la tienda hasta el registro de precios pasando por la puerta de entrada.
    consequence: una copia sin fuente no es una copia, es un invento. Si el camino al registro desaparece, el sistema sirve rápido un precio que ya nadie puede corregir ni auditar.
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
    consequence: la copia la tiene que llenar alguien que sepa qué es un producto. Si la puerta deja de llegar al catálogo, no queda nadie del lado de adentro que arme la ficha que se va a copiar.
rubric:
  - dimension: el pico del viernes no se contesta 627 veces por segundo contra el registro
    signal:
      kind: predicate
      guaranteeId: g-copia-mas-cerca
  - dimension: el registro sigue siendo la fuente del precio
    signal:
      kind: predicate
      guaranteeId: g-registro-sigue-siendo-la-fuente
  - dimension: el catálogo sigue teniendo dueño del lado de adentro
    signal:
      kind: predicate
      guaranteeId: g-catalogo-en-el-camino
referenceSolutions:
  - label: una copia del lado del servidor
    contextInversion: 'la copia adentro gana cuando el precio depende de quién pregunta: listas por cliente mayorista, promociones por región, carritos con descuento acumulado. Ahí la respuesta no es la misma para todos y no se puede publicar en el borde. El servicio decide qué guardar y por cuánto tiempo, y puede invalidar la copia en el momento exacto en que el área comercial cambia un precio. Se paga con una unidad operativa que hay que dimensionar, vigilar y vaciar cuando se llena.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Visitante
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
        - id: copia
          type: cache
          label: Copia rápida del catálogo
          zone: private
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
  - label: la ficha publicada en el borde
    contextInversion: 'publicar la ficha en una red de distribución gana cuando la respuesta es idéntica para todo el mundo, que es exactamente el caso de los ocho productos de la publicidad: una sola versión, servida desde el borde, sin que la petición entre siquiera al sistema. Es la opción más barata de operar y la que más tráfico absorbe. Se paga con el control: la ficha vive fuera de tu zona privada, corregir un precio depende de que la publicación se propague, y lo que se publicó ya no se puede personalizar por cliente.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Visitante
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
        - id: borde
          type: cdn
          label: Distribución de fichas en el borde
          zone: dmz
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
        - id: catalogo-borde
          from: { node: catalogo }
          to: { node: borde }
          dataClass: public
status: PILOT
---

La misma tienda de electrodomésticos del ejercicio anterior. El mismo servicio
de catálogo, el mismo registro de precios, la misma ficha de producto.

Cambió el contexto, y sólo el contexto.

Este viernes hay una campaña de televisión. La proyección del área comercial es
de **40.000 visitas por minuto** durante tres horas, contra las 900 de un
martes cualquiera. El **94 %** de ese tráfico son lecturas de los mismos **ocho
productos**: los que aparecen en el aviso.

El registro de precios aguanta **900 lecturas por segundo** antes de empezar a
degradarse. El pico proyectado sólo de esos ocho productos es de **627 por
segundo**. Entran, pero sin margen para las compras, que usan el mismo
registro, y sin margen para el pico dentro del pico.

Y esta vez el requisito de precio dice otra cosa:

> *"El visitante puede ver un precio de hasta 60 segundos de antigüedad. Al
> confirmar la compra se cobra el precio registrado en ese instante."*

Leelo dos veces. **Autoriza** una copia. No la tolera, la autoriza, porque
alguien se sentó a separar el momento en que se mira del momento en que se
cobra, y descubrió que sólo el segundo tiene que ser exacto.

**Poné la copia.** Y elegí de qué lado del sistema va, que es donde está la
decisión de verdad.

> Este es el gemelo del ejercicio anterior. Mismo diagrama, requisito distinto,
> conclusión opuesta. Si te sirvió el mismo razonamiento en los dos, uno de los
> dos lo resolviste de memoria.
