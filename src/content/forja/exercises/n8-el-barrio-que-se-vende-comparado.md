---
title: "El barrio que se vende comparado"
level: 8
role: tradeoff
domain: gastronomia
tradeoffPairId: n8-el-dato-de-todos-o-el-dato-de-cada-uno
D1: 3
D2: 3
D3: 3
D4: 2
D5: 2
D6: 2
D7: 1
D8: 1
D9: 3
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar por qué acá juntar el dato de los 3.400 locales en una sola pieza es el producto y no un descuido, y qué se rompe el día que alguien lee esa pieza sin filtrar."
lambda: 0.5
constraints:
  - metric: locales sobre la misma plataforma
    operator: ">="
    value: 3400
    unit: locales
  - metric: locales distintos que tienen que entrar en cada comparación para que el promedio no sea el dato de uno
    operator: ">="
    value: 12
    unit: locales
hiddenFacts:
  - fact: "el informe comparativo se arma consultando en vivo la base de ventas de los 3.400 locales, en el momento en que el dueño abre el panel. Un domingo a las 21:40 esa consulta convive con el cobro con tarjeta."
    discoveryPath: "mirá qué componentes tocan la base de ventas y en qué momento. El cobro no puede esperar y el informe sí; hoy comparten el mismo almacén y el mismo instante."
  - fact: "la comparación es el producto que se paga. Sin el dato de los otros locales del radio no hay informe: no es un agregado interno, es lo que el cliente compró."
    discoveryPath: "la restricción dice cuántos locales distintos tienen que entrar en cada comparación. Un número mínimo de participantes sólo tiene sentido si el agregado se muestra afuera."
  - fact: "el extracto que junta a los 3.400 es una sola pieza con el dato de todos adentro. Nadie que lo lea sabe, por sí solo, de qué local es cada fila."
    discoveryPath: "es el costo que hay que aceptar acá y el que hace que el otro ejercicio del par tenga la respuesta contraria. Concentrar el dato resuelve la comparación y crea un único lugar donde una lectura mal escrita entrega todo."
startingDesign:
  nodes:
    - id: dueno
      type: actor
      label: Dueño del local
      zone: public
      given: true
      position: { x: 85, y: 90 }
    - id: panel
      type: web-client
      label: Panel del local
      zone: public
      given: true
      position: { x: 445, y: 90 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 200 }
    - id: ventas
      type: service
      label: Servicio de punto de venta
      zone: private
      role: tenant-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 320 }
    - id: informes
      type: service
      label: Servicio de informes
      zone: private
      role: insight-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 430 }
    - id: base
      type: database
      label: Base de ventas
      zone: restricted
      role: tenant-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 480 }
  edges:
    - id: dueno-panel
      from: { node: dueno }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-ventas
      from: { node: gw }
      to: { node: ventas }
      dataClass: personal
    - id: gw-informes
      from: { node: gw }
      to: { node: informes }
      dataClass: personal
    - id: ventas-base
      from: { node: ventas }
      to: { node: base }
      dataClass: personal
    - id: informes-base
      from: { node: informes }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-insight-on-extract
    label: el informe comparativo se sirve desde un extracto preparado para él
    weight: 3
    predicate:
      op: path
      from:
        role: insight-service
      to:
        type: [object-storage, database]
      forbid:
        role: tenant-store
    whyMissing: "el servicio de informes no llega a ningún extracto, así que el informe se arma con lo que hay en el sistema vivo en el momento en que alguien abre el panel. Un extracto es una copia ya agregada que vive FUERA de la base de ventas: sirve un almacenamiento de objetos y sirve una base aparte (las dos resuelven el problema), y lo que no sirve es la base de ventas, porque leerla es el defecto que hay que sacar."
    consequence: "una comparación necesita el dato de miles de locales a la vez. Pedirlo en vivo pone esa lectura al lado del cobro con tarjeta: el domingo a las 21:40 los dos compiten, y el que no puede esperar es el cobro."
  - id: g-insight-off-live-store
    label: el informe comparativo no abre ninguna consulta contra la base de ventas
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: insight-service
      to:
        role: tenant-store
    whyMissing: sigue existiendo una conexión directa entre el servicio de informes y la base de ventas.
    consequence: "el extracto no sirve de nada mientras el camino viejo siga abierto. Y hay algo peor que la carga: dos locales que piden el mismo informe con un minuto de diferencia obtienen números distintos, y soporte no tiene forma de explicar cuál era el correcto."
  - id: g-extract-is-produced
    label: alguien que sabe de qué local es cada ticket produce ese extracto
    weight: 2
    predicate:
      op: path
      from:
        role: tenant-service
      to:
        type: [object-storage, database]
      forbid:
        role: tenant-store
    whyMissing: "no hay ningún camino desde el punto de venta hasta el lugar donde vive el extracto, sea un almacenamiento de objetos o una base aparte. Existe el lugar donde leer y no existe nada que lo llene. Escribir en la base de ventas no cuenta: ahí ya está el ticket crudo, y el problema es justamente que es crudo."
    consequence: un extracto vacío cumple la forma y no el propósito. El informe compara contra un archivo que nadie escribe, y el número que ve el dueño no significa nada.
  - id: g-pos-still-writes
    label: el punto de venta sigue guardando cada ticket
    weight: 2
    predicate:
      op: path
      from:
        role: tenant-service
      to:
        role: tenant-store
    whyMissing: no queda ningún camino desde el punto de venta hasta la base de ventas.
    consequence: sacar el informe del sistema vivo también baja la carga si de paso se deja de registrar la venta, y entonces no hay negocio que administrar. Separar la lectura pesada es separarla, no apagar la escritura.
rubric:
  - dimension: la comparación se arma sobre una copia preparada, no sobre el sistema que cobra
    signal:
      kind: predicate
      guaranteeId: g-insight-on-extract
  - dimension: el camino viejo queda cerrado y el número deja de cambiar entre dos consultas
    signal:
      kind: predicate
      guaranteeId: g-insight-off-live-store
  - dimension: el extracto lo llena alguien que sabe de quién es cada fila
    signal:
      kind: predicate
      guaranteeId: g-extract-is-produced
  - dimension: el local sigue cobrando y registrando
    signal:
      kind: predicate
      guaranteeId: g-pos-still-writes
referenceSolutions:
  - label: un armador de extracto aparte, alimentado por el punto de venta
    contextInversion: "un armador aparte conviene cuando el extracto tiene que corregirse, recalcularse o reprocesarse sin tocar el punto de venta: el día que cambia la definición de \"ticket promedio\" se vuelve a correr sobre el histórico y nadie deja de cobrar. Se paga con dos piezas más para operar y con que el número del informe queda siempre un rato atrás del mostrador, algo que hay que decirle al cliente antes de que lo descubra."
    design:
      nodes:
        - id: dueno
          type: actor
          label: Dueño del local
          zone: public
        - id: panel
          type: web-client
          label: Panel del local
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de punto de venta
          zone: private
          role: tenant-service
          props: { criticality: "high", replicas: "2" }
        - id: informes
          type: service
          label: Servicio de informes
          zone: private
          role: insight-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de tickets cerrados
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: armador
          type: worker
          label: Armador del extracto de zona
          zone: private
        - id: extracto
          type: object-storage
          label: Extracto comparativo de zona
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de ventas
          zone: restricted
          role: tenant-store
          props: { backup: "diario" }
      edges:
        - id: dueno-panel
          from: { node: dueno }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: gw-informes
          from: { node: gw }
          to: { node: informes }
          dataClass: personal
        - id: ventas-base
          from: { node: ventas }
          to: { node: base }
          dataClass: personal
        - id: ventas-cola
          from: { node: ventas }
          to: { node: cola }
          dataClass: personal
        - id: cola-armador
          from: { node: cola }
          to: { node: armador }
          dataClass: personal
        - id: armador-extracto
          from: { node: armador }
          to: { node: extracto }
          dataClass: public
        - id: informes-extracto
          from: { node: informes }
          to: { node: extracto }
          dataClass: public
  - label: el punto de venta escribe el extracto al cerrar el ticket
    contextInversion: "que el mismo punto de venta escriba el extracto conviene cuando el equipo es chico y no puede operar dos piezas más, y cuando el informe se vende como \"al día\" y no como \"al minuto\": el dato sale del único lugar que ya sabe de qué local es cada ticket, sin cola ni armador en el medio. Se paga con que la lógica de la comparación vive dentro del servicio que cobra, así que cambiarla es tocar el camino crítico, y con que un ticket que se escribe en la base y falla al escribirse en el extracto deja las dos copias distintas sin que nadie se entere."
    design:
      nodes:
        - id: dueno
          type: actor
          label: Dueño del local
          zone: public
        - id: panel
          type: web-client
          label: Panel del local
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: ventas
          type: service
          label: Servicio de punto de venta
          zone: private
          role: tenant-service
          props: { criticality: "high", replicas: "2" }
        - id: informes
          type: service
          label: Servicio de informes
          zone: private
          role: insight-service
          props: { criticality: "high", replicas: "2" }
        - id: extracto
          type: object-storage
          label: Extracto comparativo de zona
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de ventas
          zone: restricted
          role: tenant-store
          props: { backup: "diario" }
      edges:
        - id: dueno-panel
          from: { node: dueno }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-ventas
          from: { node: gw }
          to: { node: ventas }
          dataClass: personal
        - id: gw-informes
          from: { node: gw }
          to: { node: informes }
          dataClass: personal
        - id: ventas-base
          from: { node: ventas }
          to: { node: base }
          dataClass: personal
        - id: ventas-extracto
          from: { node: ventas }
          to: { node: extracto }
          dataClass: public
        - id: informes-extracto
          from: { node: informes }
          to: { node: extracto }
          dataClass: public
status: PILOT
---

Una plataforma de punto de venta que usan **3.400 restaurantes**. Cobra, emite
la factura, controla el stock. Nada de eso es lo que se paga.

Lo que se paga es el informe **"cómo te fue contra tu zona"**: ticket
promedio, hora pico y rotación de mesas del local, comparados contra los otros
locales de su radio de ocho cuadras y su categoría. El 71 % de los clientes
está en el plan que lo incluye.

Ese informe hoy se arma consultando, en el momento en que el dueño abre el
panel, la base de ventas de los 3.400.

El domingo 12 de mayo a las 21:40, un informe corrió una consulta de noventa
segundos sobre la base. Durante cuatro minutos, **200 locales no pudieron
cobrar con tarjeta**. Un domingo a las 21:40.

Hay un segundo problema que soporte no puede explicar: dos dueños que piden el
mismo informe con un minuto de diferencia obtienen números distintos, porque
la base viva se movió entre las dos consultas. Uno de los dos llamó para
preguntar cuál era el correcto.

El producto exige juntar el dato de todos. No es un agregado interno que se
podría evitar: es lo que el cliente compró, y el contrato dice que ninguna
comparación se muestra con menos de **doce locales adentro**, justamente para
que el promedio no sea el dato de uno.

Juntarlo tiene un costo, y hay que asumirlo con los ojos abiertos: una sola
pieza con el dato de 3.400 locales adentro es un único lugar donde una lectura
mal escrita entrega todo.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que la comparación deje de correr sobre el sistema
que cobra, sin que el local deje de registrar sus ventas.

La comparación se sirve de un extracto: una copia **ya agregada** que vive
fuera de la base de ventas. Dónde la dejes es tu decisión y las dos opciones
son correctas: un almacenamiento de objetos sale más barato de operar y encaja
si el agregado se rehace entero cada vez; una base aparte te deja consultarlo
por zona y por período sin releer el archivo completo, y cuesta una unidad
operativa más. Lo único que no es un extracto es la base de ventas: ahí está el
ticket crudo, y el ticket crudo es el problema.
