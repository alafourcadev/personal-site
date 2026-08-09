---
title: "El descuento que ya estaba escrito en el contrato"
level: 10
role: trap
domain: comercio
D1: 3
D2: 3
D3: 3
D4: 3
D5: 2
D6: 4
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [9]
budget:
  opsUnits: 5
  monthlyUsd: 200
aiBudget: "libre, pero tu respuesta tiene que decir qué información tiene el modelo que la regla del contrato no tenga. Si no tiene ninguna, escribilo con esas palabras."
lambda: 1.2
constraints:
  - metric: "pedidos mayoristas por día"
    operator: ">="
    value: 6800
    unit: pedidos
  - metric: "pedidos con un descuento distinto al del contrato"
    operator: "<="
    value: 0
    unit: pedidos
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 5
    unit: unidades operativas
hiddenFacts:
  - fact: "la regla del descuento está escrita en el contrato marco que firma cada cliente mayorista: convenio vigente, doce unidades o más del mismo código, pago a treinta días. Tres condiciones, un porcentaje, sin excepciones."
    discoveryPath: "leé la regla y contá cuántos casos tiene. Si el conjunto de entradas se puede enumerar y no depende del texto libre de nadie, no queda nada que un modelo pueda decidir mejor que una comparación contra una tabla."
  - fact: "el servicio de condiciones comerciales ya calcula exactamente esto. Lo usa facturación para emitir la factura, y por eso la factura y el pedido a veces no coinciden: el mismo descuento se calcula dos veces, de dos formas distintas."
    discoveryPath: "está en el lienzo, conectado a la base de convenios y a nada más. Preguntá por qué la factura sí sabe calcular el descuento y el pedido no, y si el problema es que falta una pieza o que falta una conexión."
  - fact: "el modelo se conectó en enero con el objetivo de 'aplicar IA al proceso comercial'. Nadie escribió qué problema resolvía ni contra qué se iba a medir."
    discoveryPath: "buscá qué información tiene el modelo que la regla no tenga. Si la respuesta es ninguna, la pieza no agrega criterio: agrega varianza, latencia y una factura del proveedor."
  - fact: "uno de cada cuarenta pedidos salió con un descuento distinto al del contrato. Cuando un cliente reclamó, finanzas no pudo reconstruir por qué: el modelo no devuelve el porqué, devuelve un número."
    discoveryPath: "elegí un pedido cualquiera y preguntá cómo se explica su descuento delante de un cliente enojado. Una regla se explica leyendo tres condiciones; una respuesta de un modelo se explica diciendo que el modelo la dio."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: "Comprador mayorista"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tienda
      type: web-client
      label: "Portal de pedidos mayoristas"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: pedidos
      type: service
      label: "Servicio de pedidos"
      zone: private
      role: pedidos
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: basepedidos
      type: database
      label: "Base de pedidos"
      zone: restricted
      role: libro
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 520 }
    - id: condiciones
      type: service
      label: "Servicio de condiciones comerciales"
      zone: private
      role: condiciones
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: contratos
      type: database
      label: "Base de convenios y listas de precios"
      zone: restricted
      role: contratos
      given: true
      props: { backup: "diario", consistency: "strong", persistence: "durable" }
      position: { x: 805, y: 410 }
    - id: modelo
      type: ai-model
      label: "Modelo de descuentos del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
  edges:
    - id: comprador-tienda
      from: { node: comprador }
      to: { node: tienda }
      dataClass: public
    - id: tienda-gw
      from: { node: tienda }
      to: { node: gw }
      dataClass: personal
    - id: gw-pedidos
      from: { node: gw }
      to: { node: pedidos }
      dataClass: personal
    - id: pedidos-basepedidos
      from: { node: pedidos }
      to: { node: basepedidos }
      dataClass: personal
    - id: pedidos-modelo
      from: { node: pedidos }
      to: { node: modelo }
      dataClass: personal
    - id: condiciones-contratos
      from: { node: condiciones }
      to: { node: contratos }
      dataClass: public
guarantees:
  - id: g-el-descuento-sale-del-convenio
    label: "el servicio de pedidos llega al convenio del cliente sin ningún modelo en el medio"
    weight: 3
    predicate:
      op: path
      from:
        role: pedidos
      to:
        role: contratos
      forbid:
        type: [ai-model]
    whyMissing: "no hay ningún camino desde el servicio de pedidos hasta la base de convenios y listas de precios. El descuento que se aplica no se lee del contrato que el cliente firmó."
    consequence: "uno de cada cuarenta pedidos salió con un porcentaje distinto al pactado. Un descuento es una obligación contractual: cuando no coincide, o la empresa regala margen o el cliente paga de más y reclama. Las dos cosas se descubren en la conciliación de fin de mes, cuando ya se facturaron 200.000 pedidos."
  - id: g-en-este-flujo-no-hay-ningun-modelo
    label: "en este flujo no queda ningún modelo"
    weight: 3
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [ai-model]
    whyMissing: "todavía hay un modelo en el diseño, y el diseño no lo necesita para nada: la decisión que toma está enteramente escrita en el contrato."
    consequence: "el modelo aporta tres cosas y ninguna es criterio: una respuesta que cambia entre llamadas iguales, una factura del proveedor por 6.800 llamadas diarias, y el nombre y el domicilio fiscal del cliente saliendo hacia un tercero. Todo eso a cambio de una comparación de tres condiciones que un servicio propio hace en un milisegundo y sabe explicar."
  - id: g-el-pedido-queda-escrito
    label: "el pedido con su descuento queda escrito en la base de pedidos"
    weight: 2
    predicate:
      op: path
      from:
        role: pedidos
      to:
        role: libro
    whyMissing: "no hay ningún camino desde el servicio de pedidos hasta la base de pedidos, así que el descuento aplicado no queda registrado en ninguna parte."
    consequence: "cuando el cliente reclama por qué le cobraron distinto, la única respuesta posible es un pedido guardado con el porcentaje que se le aplicó y las condiciones que lo justificaban. Sin eso, la discusión se resuelve por quién grita más fuerte, y la empresa siempre pierde esa."
rubric:
  - dimension: "el descuento se calcula contra el contrato firmado"
    signal:
      kind: predicate
      guaranteeId: g-el-descuento-sale-del-convenio
  - dimension: "no se paga varianza donde había una regla"
    signal:
      kind: predicate
      guaranteeId: g-en-este-flujo-no-hay-ningun-modelo
  - dimension: "cada pedido se puede explicar seis meses después"
    signal:
      kind: predicate
      guaranteeId: g-el-pedido-queda-escrito
referenceSolutions:
  - label: "pedidos consulta las condiciones y guarda el pedido valorizado"
    contextInversion: "que el servicio de pedidos siga siendo el único que escribe conviene cuando el pedido ya tiene dueño claro y todo el equipo sabe dónde mirar: hay un solo lugar donde se arma el pedido, un solo lugar donde se guarda y una sola pieza que hay que revisar cuando algo sale raro. Se paga con que pedidos tiene que acordarse siempre de preguntar: nada en el diseño le impide guardar un pedido sin haber consultado el convenio."
    design:
      nodes:
        - id: comprador
          type: actor
          label: "Comprador mayorista"
          zone: public
        - id: tienda
          type: web-client
          label: "Portal de pedidos mayoristas"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: pedidos
          type: service
          label: "Servicio de pedidos"
          zone: private
          role: pedidos
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: condiciones
          type: service
          label: "Servicio de condiciones comerciales"
          zone: private
          role: condiciones
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: contratos
          type: database
          label: "Base de convenios y listas de precios"
          zone: restricted
          role: contratos
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: basepedidos
          type: database
          label: "Base de pedidos"
          zone: restricted
          role: libro
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
      edges:
        - id: comprador-tienda
          from: { node: comprador }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
          dataClass: personal
        - id: pedidos-condiciones
          from: { node: pedidos }
          to: { node: condiciones }
          dataClass: personal
        - id: condiciones-contratos
          from: { node: condiciones }
          to: { node: contratos }
          dataClass: public
        - id: pedidos-basepedidos
          from: { node: pedidos }
          to: { node: basepedidos }
          dataClass: personal
  - label: "las condiciones valorizan y escriben, y dejan copia del cálculo"
    contextInversion: "que el pedido lo escriba el servicio de condiciones conviene cuando lo que más duele es la discusión con el cliente: ningún pedido puede quedar guardado por un camino que no consultó el convenio, porque el que guarda es el mismo que calcula. La copia inmutable de cada cálculo no cuesta unidades operativas y le da a finanzas exactamente lo que necesita seis meses después. Se paga con que el servicio de condiciones deja de ser una consulta y pasa a ser parte del camino de escritura de 6.800 pedidos diarios: si se cae, no entra ningún pedido."
    design:
      nodes:
        - id: comprador
          type: actor
          label: "Comprador mayorista"
          zone: public
        - id: tienda
          type: web-client
          label: "Portal de pedidos mayoristas"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: pedidos
          type: service
          label: "Servicio de pedidos"
          zone: private
          role: pedidos
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: condiciones
          type: service
          label: "Servicio de condiciones comerciales"
          zone: private
          role: condiciones
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: contratos
          type: database
          label: "Base de convenios y listas de precios"
          zone: restricted
          role: contratos
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: basepedidos
          type: database
          label: "Base de pedidos"
          zone: restricted
          role: libro
          props: { backup: "diario", consistency: "strong", persistence: "durable" }
        - id: copia
          type: object-storage
          label: "Copia inmutable de cada cálculo"
          zone: private
          props: { durability: "99.999999999", access: "signed" }
      edges:
        - id: comprador-tienda
          from: { node: comprador }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-pedidos
          from: { node: gw }
          to: { node: pedidos }
          dataClass: personal
        - id: pedidos-condiciones
          from: { node: pedidos }
          to: { node: condiciones }
          dataClass: personal
        - id: condiciones-contratos
          from: { node: condiciones }
          to: { node: contratos }
          dataClass: public
        - id: condiciones-basepedidos
          from: { node: condiciones }
          to: { node: basepedidos }
          dataClass: personal
        - id: condiciones-copia
          from: { node: condiciones }
          to: { node: copia }
          dataClass: personal
status: PILOT
---

Una distribuidora mayorista recibe **6.800 pedidos por día** por su portal.
Cada pedido puede llevar un descuento, y el descuento no es una opinión: está
escrito en el contrato marco que firmó el cliente.

> Convenio vigente **+** doce unidades o más del mismo código **+** pago a
> treinta días **→** 12 %.

Tres condiciones y un porcentaje. Sin excepciones, sin criterio, sin zona gris.

En **enero** el equipo conectó un modelo del proveedor para "aplicar IA al
proceso comercial". Nadie escribió qué problema resolvía. Desde entonces, el
descuento de cada pedido lo decide el modelo leyendo el pedido entero.

**Uno de cada cuarenta pedidos** salió con un porcentaje distinto al pactado.
Cuando un cliente reclamó, finanzas no pudo reconstruir por qué: el modelo no
devuelve el porqué, devuelve un número. Y en cada una de esas 6.800 llamadas
diarias sale hacia el proveedor el nombre y el domicilio fiscal del cliente.

En el lienzo hay una pieza que este flujo no usa. El **servicio de condiciones
comerciales** ya calcula este descuento: lo usa facturación para emitir la
factura. Por eso la factura y el pedido a veces no coinciden: el mismo
descuento se calcula dos veces, de dos maneras distintas, y sólo una de las dos
sabe explicarse.

El equipo tiene un techo de **5 unidades operativas** y hoy usa 6. Está por
encima del techo desde enero.

Antes de mover una sola conexión, contestá una pregunta: **¿qué información
tiene el modelo que la regla del contrato no tenga?**

**Rearmá el sistema** para que el descuento de cada pedido salga del convenio
que el cliente firmó, para que se pueda explicar seis meses después, y para que
el equipo pueda volver a operar lo que tiene.
