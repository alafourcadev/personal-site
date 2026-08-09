---
title: "El domicilio que tiene que ser el de hoy"
level: 3
role: tradeoff
domain: logistica
tradeoffPairId: n3-copia-propia-o-preguntarle-al-dueno
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
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir en qué momento exacto se decide el domicilio que usa el repartidor, y qué pasa si ese momento es anoche."
lambda: 0.5
constraints:
  - metric: entregas por día
    operator: ">="
    value: 22000
    unit: entregas
  - metric: antigüedad tolerada del domicilio que usa el repartidor
    operator: "="
    value: 0
    unit: minutos
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "la base de reparto se sincroniza con la de clientes todas las noches a las tres. No es un error de configuración: es lo que se decidió cuando el reparto salía a las siete y las correcciones llegaban por teléfono."
    discoveryPath: "mirá la segunda base del lienzo y preguntate qué tiene adentro que no sea una copia de la primera. Una copia propia siempre es tan nueva como su última sincronización, y esa hora la eligió alguien hace años."
  - fact: "el 61 % de las correcciones de domicilio se hacen el mismo día que el paquete sale a la calle. El vecino corrige el piso, agrega el timbre, avisa que se mudó."
    discoveryPath: "es el número que da vuelta la decisión. Con correcciones semanales, una copia de anoche alcanza; con correcciones del mismo día, una copia de anoche es el problema."
  - fact: "en junio 900 paquetes volvieron al depósito por domicilio viejo. El domicilio nuevo estaba en el servicio de clientes desde las nueve de la mañana."
    discoveryPath: "es la consecuencia directa de tener dos verdades con distinta antigüedad. No hubo error que investigar: cada sistema devolvió lo que tenía."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente que recibe
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del cliente
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: clientes
      type: service
      label: Servicio de clientes
      zone: private
      role: owner-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: reparto
      type: service
      label: Servicio de reparto
      zone: private
      role: consumer-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: baseclientes
      type: database
      label: Base de clientes (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: basereparto
      type: database
      label: Base de reparto con copia de domicilios (respaldo diario)
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: cliente-portal
      from: { node: cliente }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-clientes
      from: { node: gw }
      to: { node: clientes }
      dataClass: personal
    - id: gw-reparto
      from: { node: gw }
      to: { node: reparto }
      dataClass: personal
    - id: clientes-base
      from: { node: clientes }
      to: { node: baseclientes }
      dataClass: personal
    - id: reparto-base
      from: { node: reparto }
      to: { node: basereparto }
      dataClass: personal
guarantees:
  - id: g-sin-copia-propia
    label: reparto no guarda su propia copia del domicilio
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: consumer-service
      to:
        type: [database]
    whyMissing: el servicio de reparto sigue escribiendo y leyendo una base propia, y lo que hay adentro es una copia del domicilio que administra otro.
    consequence: "una copia propia es tan nueva como su última sincronización, y esa hora la eligió alguien hace años pensando en otra operación. El domicilio correcto existe en el sistema desde las nueve de la mañana y el repartidor sale con el de las tres."
  - id: g-el-domicilio-lo-da-su-dueno
    label: el domicilio que usa el repartidor sale del servicio que lo administra
    weight: 2
    predicate:
      op: path
      from:
        role: consumer-service
      to:
        type: [database]
      via:
        role: owner-service
    whyMissing: no hay ningún camino desde el servicio de reparto hasta una base que pase por el servicio de clientes.
    consequence: "borrar la copia y no poner nada en su lugar deja al repartidor sin dirección a la que ir. Que el dato tenga dueño no significa que los demás dejen de necesitarlo: significa que se lo piden a él, en el momento en que lo van a usar."
rubric:
  - dimension: el consumidor no acumula una segunda verdad
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-propia
  - dimension: quitar la copia no deja al repartidor sin dirección
    signal:
      kind: predicate
      guaranteeId: g-el-domicilio-lo-da-su-dueno
referenceSolutions:
  - label: reparto le pregunta a clientes cada vez que necesita la dirección
    contextInversion: "preguntar en cada uso es lo correcto cuando el dato cambia el mismo día en que se usa y la respuesta tiene que ser la de ahora: cero piezas nuevas, cero copias que envejezcan, y el día que un cliente corrige el piso a las nueve el repartidor de las once ya lo tiene. Se paga con que una caída del servicio de clientes frena el reparto entero, y con una llamada más por cada entrega."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente que recibe
          zone: public
        - id: portal
          type: web-client
          label: Portal del cliente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: clientes
          type: service
          label: Servicio de clientes
          zone: private
          role: owner-service
          props: { criticality: "high", replicas: "2" }
        - id: reparto
          type: service
          label: Servicio de reparto
          zone: private
          role: consumer-service
          props: { criticality: "high", replicas: "2" }
        - id: baseclientes
          type: database
          label: Base de clientes (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-clientes
          from: { node: gw }
          to: { node: clientes }
          dataClass: personal
        - id: gw-reparto
          from: { node: gw }
          to: { node: reparto }
          dataClass: personal
        - id: clientes-base
          from: { node: clientes }
          to: { node: baseclientes }
          dataClass: personal
        - id: reparto-clientes
          from: { node: reparto }
          to: { node: clientes }
          dataClass: personal
  - label: reparto pregunta al armar la hoja de ruta y archiva la hoja emitida
    contextInversion: "preguntar al emitir la hoja y dejar constancia conviene cuando el repartidor sale del depósito con el celular en modo avión media jornada: la hoja se arma con el domicilio del momento en que se arma, y la copia que queda archivada no es una fuente para leer sino la prueba de qué dirección se usó el martes a las seis. Se paga con una ventana entre que se arma la hoja y se toca el timbre, que es exactamente el riesgo que el negocio acepta a cambio de poder repartir sin señal."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente que recibe
          zone: public
        - id: portal
          type: web-client
          label: Portal del cliente
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: clientes
          type: service
          label: Servicio de clientes
          zone: private
          role: owner-service
          props: { criticality: "high", replicas: "2" }
        - id: reparto
          type: service
          label: Servicio de reparto
          zone: private
          role: consumer-service
          props: { criticality: "high", replicas: "2" }
        - id: baseclientes
          type: database
          label: Base de clientes (respaldo diario)
          zone: restricted
          props: { backup: "diario" }
        - id: hojas
          type: object-storage
          label: Archivo de hojas de ruta emitidas
          zone: private
      edges:
        - id: cliente-portal
          from: { node: cliente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-clientes
          from: { node: gw }
          to: { node: clientes }
          dataClass: personal
        - id: gw-reparto
          from: { node: gw }
          to: { node: reparto }
          dataClass: personal
        - id: clientes-base
          from: { node: clientes }
          to: { node: baseclientes }
          dataClass: personal
        - id: reparto-clientes
          from: { node: reparto }
          to: { node: clientes }
          dataClass: personal
        - id: reparto-hojas
          from: { node: reparto }
          to: { node: hojas }
          dataClass: personal
status: PILOT
---

Una empresa de reparto de última milla: **22.000 entregas por día**. El
servicio de clientes es el dueño del domicilio: lo carga el cliente, lo corrige
el cliente, lo administra ese equipo. El servicio de reparto arma las hojas de
ruta.

Hace cuatro años reparto se armó **su propia base** con una copia de los
domicilios. Se sincroniza todas las noches a las tres. No fue una decisión
descuidada: en ese momento el reparto salía a las siete y las correcciones de
domicilio llegaban por teléfono, con días de anticipación.

Hoy el **61 % de las correcciones se hacen el mismo día** en que el paquete sale
a la calle. La gente corrige el piso, agrega el timbre, avisa que se mudó.
Todo desde el celular, mientras espera.

En junio **900 paquetes volvieron al depósito** por domicilio viejo. El
domicilio nuevo estaba en el servicio de clientes desde las nueve de la mañana.
La copia de reparto tenía el de las tres. No hubo error que investigar: cada
sistema devolvió lo que tenía.

El dueño de producto lo dijo sin vueltas: **el domicilio que usa el repartidor
es el de ahora**. Cero minutos de antigüedad.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que reparto deje de administrar una segunda verdad,
sin dejar al repartidor sin dirección a la que ir.

> Este ejercicio tiene una mitad gemela: *La tarifa que se firmó en marzo*.
> Misma empresa, misma pregunta (copia propia o pedírselo al dueño) y la
> decisión correcta al revés. Jugá los dos.
