---
title: "La cadena que no entra en el promedio"
level: 8
role: tradeoff
domain: gastronomia
tradeoffPairId: n8-el-dato-de-todos-o-el-dato-de-cada-uno
D1: 3
D2: 3
D3: 3
D4: 2
D5: 2
D6: 3
D7: 1
D8: 1
D9: 3
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar por qué acá el extracto que junta a todos es exactamente lo que no puede existir para este cliente, y de dónde sale entonces su informe."
lambda: 0.5
constraints:
  - metric: locales de la cadena sobre la plataforma
    operator: "="
    value: 40
    unit: locales
  - metric: barrios donde la cadena es el único local de su categoría
    operator: ">="
    value: 14
    unit: barrios
hiddenFacts:
  - fact: "en catorce barrios la cadena es el único local de su categoría. Ahí, el promedio de la zona no se parece a su facturación: es su facturación, dividida por uno."
    discoveryPath: "un promedio anonimiza cuando hay muchos adentro. Con un solo participante, el agregado y el dato individual son el mismo número, y publicarlo es publicarlo."
  - fact: "el contrato de renovación de la cadena, que es el 18 % de la facturación de la plataforma, dice que su dato no puede entrar en ningún agregado que se le muestre a un tercero. No dice \"anonimizado\": dice que no entre."
    discoveryPath: "la restricción de barrios explica por qué el contrato está escrito así y no de otra manera. El cliente ya sabe que en su caso anonimizar no alcanza."
  - fact: "la cadena sigue queriendo su propio informe: ticket promedio por local, hora pico, comparación entre sus cuarenta sucursales. Ese informe se arma con su dato y con nada más."
    discoveryPath: "sacar a la cadena del extracto compartido y dejarla sin informes son dos cosas distintas. Preguntate quién sabe de qué local es cada ticket y si hace falta juntarlo con el de otros para responderle."
startingDesign:
  nodes:
    - id: dueno
      type: actor
      label: Responsable de la cadena
      zone: public
      given: true
      position: { x: 85, y: 90 }
    - id: panel
      type: web-client
      label: Panel de la cadena
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
    - id: cola
      type: queue
      label: Cola de tickets cerrados
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí" }
      position: { x: 805, y: 420 }
    - id: armador
      type: worker
      label: Armador del extracto de zona
      zone: private
      role: insight-worker
      given: true
      position: { x: 445, y: 540 }
    - id: extracto
      type: object-storage
      label: Extracto comparativo de zona
      zone: private
      given: true
      props: { access: "signed", durability: "99.999999999" }
      position: { x: 805, y: 530 }
    - id: base
      type: database
      label: Base de ventas
      zone: restricted
      role: tenant-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 640 }
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
    - id: armador-base
      from: { node: armador }
      to: { node: base }
      dataClass: personal
    - id: armador-extracto
      from: { node: armador }
      to: { node: extracto }
      dataClass: public
    - id: informes-extracto
      from: { node: informes }
      to: { node: extracto }
      dataClass: public
guarantees:
  - id: g-extract-never-reads-the-store
    label: el armador del extracto de zona no toca la base de ventas
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: insight-worker
      to:
        role: tenant-store
    whyMissing: sigue existiendo una conexión directa entre el armador del extracto y la base de ventas, que es de donde salen las cuarenta sucursales de la cadena.
    consequence: "en catorce barrios la cadena es el único local de su categoría. Su ticket promedio entra al extracto, sale como \"promedio de la zona\" y lo compra el competidor que abre enfrente. El agregado de un conjunto de uno no anonimiza nada."
  - id: g-chain-report-from-own-data
    label: el informe de la cadena se arma leyendo su propio dato, por el servicio que sabe de qué local es cada ticket
    weight: 3
    predicate:
      op: path
      from:
        role: insight-service
      to:
        role: tenant-store
    whyMissing: no hay ningún camino desde el servicio de informes hasta la base de ventas. El único informe que este diseño sabe armar es el que sale del extracto compartido.
    consequence: sacar a la cadena del extracto y dejarla sin informes son dos cosas distintas, y sólo una está en el contrato. Sus cuarenta sucursales se comparan entre ellas sin necesitar el dato de nadie más.
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
    consequence: cortar todo lo que lee la base también cumple la letra del contrato, y deja a cuarenta locales sin registrar una venta. Lo que hay que sacar es al tercero, no al dueño del dato.
rubric:
  - dimension: el dato de la cadena deja de entrar en un agregado que se muestra afuera
    signal:
      kind: predicate
      guaranteeId: g-extract-never-reads-the-store
  - dimension: la cadena sigue teniendo su informe, armado con lo suyo
    signal:
      kind: predicate
      guaranteeId: g-chain-report-from-own-data
  - dimension: los cuarenta locales siguen cobrando y registrando
    signal:
      kind: predicate
      guaranteeId: g-pos-still-writes
referenceSolutions:
  - label: sin extracto para este cliente, el informe lee su propio dato en vivo
    contextInversion: "leer el dato en vivo por el servicio que sabe de qué local es cada ticket conviene cuando el universo del informe es un solo cliente: cuarenta locales entran en una consulta acotada, no en un barrido de 3.400, y no hay ninguna copia intermedia que alguien pueda leer mal. Se paga con que la lectura del informe y el cobro comparten el mismo almacén, así que si un día la cadena pide diez años de historia lo va a sentir el mostrador, y con que se pierde la pieza que hacía posible el producto comparativo, que este cliente no compra."
    design:
      nodes:
        - id: dueno
          type: actor
          label: Responsable de la cadena
          zone: public
        - id: panel
          type: web-client
          label: Panel de la cadena
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
        - id: informes-base
          from: { node: informes }
          to: { node: base }
          dataClass: personal
  - label: un resumen propio de la cadena, armado desde sus propios tickets
    contextInversion: "precalcular un resumen que sale de los tickets de la cadena y de nadie más conviene cuando el informe se mira todos los días y la consulta en vivo empieza a pesar sobre el almacén que cobra: el resumen se arma una vez, con lo que el punto de venta ya publicó, y el armador nunca abre una consulta contra la base. Se paga con dos piezas más para operar y con un resumen que hay que borrar y rehacer cada vez que se corrige un ticket, porque ahora el mismo número vive en dos lugares."
    design:
      nodes:
        - id: dueno
          type: actor
          label: Responsable de la cadena
          zone: public
        - id: panel
          type: web-client
          label: Panel de la cadena
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
          label: Armador del resumen de la cadena
          zone: private
          role: insight-worker
        - id: resumen
          type: object-storage
          label: Resumen de las cuarenta sucursales
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
        - id: armador-resumen
          from: { node: armador }
          to: { node: resumen }
          dataClass: personal
        - id: informes-resumen
          from: { node: informes }
          to: { node: resumen }
          dataClass: personal
        - id: informes-base
          from: { node: informes }
          to: { node: base }
          dataClass: personal
status: PILOT
---

La misma plataforma de punto de venta. El extracto comparativo de zona ya está
construido y funciona: junta el dato de los 3.400 locales, y el informe "cómo
te fue contra tu zona" se sirve desde ahí.

Ahora entra un cliente que no se parece a los otros. Una cadena de **cuarenta
parrillas**, el 18 % de la facturación de la plataforma.

En **catorce** de los barrios donde opera, es el único local de su categoría.

Ahí el promedio de la zona no se parece a su facturación: **es** su
facturación, dividida por uno. Cualquier competidor que abra enfrente y pague
el plan comparativo lee su ticket promedio con dos decimales, su hora pico y
cuánto le rinde una mesa. El extracto lo anonimiza en el sentido de que no
escribe el nombre, y no lo anonimiza en ningún otro sentido.

El contrato de renovación, firmado hace tres semanas, dice que el dato de la
cadena no puede entrar en ningún agregado que se le muestre a un tercero. No
dice "anonimizado". Dice que no entre.

Y la cadena sigue queriendo su informe: ticket promedio por local, hora pico,
y sobre todo la comparación entre sus cuarenta sucursales, que es la única que
le importa para decidir dónde abre la próxima.

El equipo tiene **6 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que el dato de la cadena deje de alimentar el
agregado que se vende afuera, sin que la cadena se quede sin el informe que
paga.
