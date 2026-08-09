---
title: "El catálogo que miran todos"
level: 3
role: tradeoff
domain: comercio
tradeoffPairId: n3-copia-rapida-segun-la-clase-de-dato
D1: 1
D2: 2
D3: 2
D4: 1
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir qué clase de dato viaja hacia la copia rápida y por qué eso es lo que la hace admisible."
lambda: 0.5
constraints:
  - metric: consultas al catálogo por minuto en pico
    operator: ">="
    value: 40000
    unit: consultas
  - metric: desactualización tolerada del precio publicado
    operator: "<="
    value: 5
    unit: minutos
  - metric: presupuesto operativo
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "el 96 % de las consultas son a los mismos 400 productos y devuelven exactamente lo mismo: nombre, foto, descripción y precio de lista. Nada de eso es de nadie en particular."
    discoveryPath: "es la razón por la que este ejercicio admite una copia rápida y el otro del par no. Preguntate de quién es el dato que viaja: si la respuesta es 'de cualquiera que entre a la tienda', es público."
  - fact: "el precio de lista lo cambia el equipo comercial dos o tres veces por día, en horario de oficina."
    discoveryPath: "es lo que hace tolerable que la copia esté hasta cinco minutos vieja. Si el precio cambiara cada segundo, la misma decisión sería incorrecta y el par se daría vuelta por otra razón."
  - fact: "la base de catálogo sostiene hoy las 40.000 consultas por minuto al 91 % de su capacidad. En el pico de noviembre no las sostuvo."
    discoveryPath: "el número está en el enunciado. Una base al 91 % en un martes común es una base caída el día que el tráfico se duplica."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: Comprador
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
      role: read-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: basecatalogo
      type: database
      label: Base de catálogo (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: comprador-tienda
      from: { node: comprador }
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
    - id: catalogo-base
      from: { node: catalogo }
      to: { node: basecatalogo }
      dataClass: public
guarantees:
  - id: g-copia-rapida
    label: la lectura del catálogo se apoya en una copia rápida y no en la base en cada consulta
    weight: 2
    predicate:
      op: path
      from:
        role: read-service
      to:
        type: [cache]
    whyMissing: no hay ningún camino desde el servicio de catálogo hasta un almacenamiento rápido, así que cada una de las 40.000 consultas por minuto termina en la base.
    consequence: "la base sostiene el tráfico común al 91 % de su capacidad. El día que el tráfico se duplica, la que deja de responder no es la ficha de producto: es la base, y con ella se cae también el checkout que la comparte."
  - id: g-fuente-de-verdad
    label: la base sigue siendo el lugar donde el catálogo existe de verdad
    weight: 2
    predicate:
      op: path
      from:
        role: read-service
      to:
        type: [database]
    whyMissing: no hay ningún camino desde el servicio de catálogo hasta una base de datos.
    consequence: una copia rápida no conserva nada y no promete conservar nada. Si la única casa del precio es la copia, el primer reinicio deja la tienda sin catálogo y sin nada desde donde reconstruirlo.
rubric:
  - dimension: la lectura masiva no cae toda sobre la base
    signal:
      kind: predicate
      guaranteeId: g-copia-rapida
  - dimension: la copia se suma a la fuente de verdad, no la reemplaza
    signal:
      kind: predicate
      guaranteeId: g-fuente-de-verdad
referenceSolutions:
  - label: copia rápida al lado del servicio
    contextInversion: "la copia al lado del servicio es la elección correcta cuando lo que se repite es la consulta entera y el equipo quiere una sola pieza nueva que entender: el servicio busca en la copia, y si no está, va a la base y la deja lista para el próximo. Se paga con una pieza más para operar y con hasta cinco minutos de precio viejo, que es exactamente lo que el negocio dijo que tolera."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
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
          role: read-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Copia rápida del catálogo
          zone: private
          props: { ttl: "300", eviction: "lru" }
        - id: basecatalogo
          type: database
          label: Base de catálogo (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: comprador-tienda
          from: { node: comprador }
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
        - id: catalogo-copia
          from: { node: catalogo }
          to: { node: copia }
          dataClass: public
        - id: catalogo-base
          from: { node: catalogo }
          to: { node: basecatalogo }
          dataClass: public
  - label: copia rápida para el precio y red de distribución para las fotos
    contextInversion: "separar las fotos conviene cuando el peso del tráfico no es la consulta sino la imagen: la ficha de producto son dos kilobytes y la foto son cuatrocientos, así que sacar las fotos de la infraestructura propia baja el pico real sin sumar carga operativa, porque una red de distribución y un almacén de objetos no agregan unidades para operar. Se paga con dos lugares desde donde se publica la misma ficha, y con la disciplina de invalidar los dos cuando cambia un producto."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
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
          role: read-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Copia rápida de precios
          zone: private
          props: { ttl: "300", eviction: "lru" }
        - id: basecatalogo
          type: database
          label: Base de catálogo (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: fotos
          type: object-storage
          label: Almacén de fotos de producto
          zone: private
        - id: red
          type: cdn
          label: Red de distribución
          zone: dmz
      edges:
        - id: comprador-tienda
          from: { node: comprador }
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
        - id: catalogo-copia
          from: { node: catalogo }
          to: { node: copia }
          dataClass: public
        - id: catalogo-base
          from: { node: catalogo }
          to: { node: basecatalogo }
          dataClass: public
        - id: catalogo-fotos
          from: { node: catalogo }
          to: { node: fotos }
          dataClass: public
        - id: fotos-red
          from: { node: fotos }
          to: { node: red }
          dataClass: public
status: PILOT
---

Una tienda online con **40.000 consultas al catálogo por minuto** en el pico
de la tarde. El **96 %** de esas consultas son a los mismos 400 productos, y
devuelven siempre lo mismo: nombre, foto, descripción y precio de lista.

Cada una de esas consultas llega hoy a la base de catálogo. La base las
sostiene, al **91 % de su capacidad** en un martes cualquiera. En el pico de
noviembre pasado no las sostuvo: 40 minutos con la ficha de producto caída, y
con ella el checkout, que usa la misma base.

El precio de lista lo cambia el equipo comercial dos o tres veces por día, en
horario de oficina. El dueño de producto dice, con todas las letras, que un
precio **hasta cinco minutos viejo** no es un problema del negocio: el
problema del negocio es la tienda caída.

Este es un dato que no es de nadie. Cualquiera que entre a la tienda ve
exactamente lo mismo, con sesión o sin sesión.

El equipo tiene **5 unidades operativas** y hoy usa 3.

**Rearmá el sistema** para que la lectura masiva deje de caer entera sobre la
base, sin que el catálogo pase a existir únicamente en una pieza que se vacía
sola.

> Este ejercicio tiene una mitad gemela: *El saldo que solo mira su dueño*.
> Mismo problema de lectura, mismo tamaño de equipo, y la decisión correcta al
> revés. Jugá los dos.
