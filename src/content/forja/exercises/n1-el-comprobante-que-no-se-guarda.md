---
title: "El comprobante que no se guarda en ningún lado"
level: 1
role: calibration
domain: facturacion
D1: 0
D2: 0
D3: 1
D4: 1
D5: 1
D6: 0
D7: 0
D8: 0
D9: 1
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: libre, pero antes de pedirle nada a un modelo, leé el requisito del contador y subrayá el verbo. Este ejercicio se gana leyendo, no generando.
lambda: 0.5
constraints:
  - metric: tiempo que el comprobante tiene que poder recuperarse
    operator: ">="
    value: 5
    unit: años
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: la agencia tributaria no devuelve copias. Lo que se le envía se le envía, y consultarlo después no es un servicio que ofrezca.
    discoveryPath: mirá el diagrama y preguntate de dónde saldría el comprobante del 12 de marzo si mañana lo pide un cliente. El único lugar donde estuvo es una conexión de salida hacia un tercero, y una conexión no guarda nada.
  - fact: en el lienzo ya hay dos piezas donde el comprobante podría quedar, y ninguna está conectada a nada.
    discoveryPath: probá tu respuesta tal como viene. La garantía que queda sin cumplir nombra un lugar durable. Ese lugar ya está puesto, dos veces, esperando una conexión.
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente del mostrador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: caja
      type: web-client
      label: Caja de la farmacia
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: billing-service
      given: true
      position: { x: 445, y: 410 }
    - id: agencia
      type: external-provider
      label: Agencia tributaria
      zone: dmz
      role: tax-agency
      given: true
      position: { x: 445, y: 300 }
    - id: archivo-db
      type: database
      label: Base de comprobantes
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: archivo-objetos
      type: object-storage
      label: Archivo de comprobantes en disco
      zone: private
      given: true
      position: { x: 805, y: 520 }
  edges:
    - id: cliente-caja
      from: { node: cliente }
      to: { node: caja }
      dataClass: public
    - id: caja-gw
      from: { node: caja }
      to: { node: gw }
      dataClass: personal
    - id: gw-facturacion
      from: { node: gw }
      to: { node: facturacion }
      dataClass: personal
    - id: facturacion-agencia
      from: { node: facturacion }
      to: { node: agencia }
      dataClass: regulated
guarantees:
  - id: g-comprobante-queda
    label: el comprobante queda en un lugar que sobrevive a un reinicio
    weight: 2
    predicate:
      op: path
      from:
        role: billing-service
      to:
        type: [database, object-storage]
    whyMissing: el servicio de facturación no llega a ningún lugar durable. Emite el comprobante, lo manda a la agencia y no lo escribe en ninguna parte.
    consequence: el comprobante existe durante el tiempo que dura la petición y después no existe más. A los cinco años, cuando lo pidan, no hay de dónde sacarlo. Y el requisito no era "emitirlo", era "poder recuperarlo".
  - id: g-envio-preservado
    label: el comprobante se sigue enviando a la agencia tributaria
    weight: 1
    predicate:
      op: path
      from:
        role: billing-service
      to:
        role: tax-agency
    whyMissing: se cortó el camino entre el servicio de facturación y la agencia tributaria.
    consequence: guardar el comprobante no reemplaza declararlo. Si en el camino desconectaste la salida hacia la agencia, la farmacia dejó de facturar legalmente para ganar un requisito de archivo.
  - id: g-caja-sigue-facturando
    label: la caja sigue llegando al servicio por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: billing-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde la caja hasta el servicio de facturación que pase por la puerta de entrada.
    consequence: agregar el archivo no puede costar la venta. Un sistema que conserva perfectamente los comprobantes que ya no puede emitir no resolvió nada.
rubric:
  - dimension: el comprobante se puede recuperar cinco años después
    signal:
      kind: predicate
      guaranteeId: g-comprobante-queda
  - dimension: la obligación fiscal de declarar sigue cumpliéndose
    signal:
      kind: predicate
      guaranteeId: g-envio-preservado
  - dimension: la farmacia sigue pudiendo facturar
    signal:
      kind: predicate
      guaranteeId: g-caja-sigue-facturando
referenceSolutions:
  - label: el comprobante se escribe en una base
    contextInversion: 'la base gana cuando la farmacia necesita buscar por cliente, por fecha o por producto, sin abrir comprobante por comprobante. Se paga con una unidad operativa que hay que respaldar y vigilar, y con la obligación de que ese respaldo exista de verdad: una base con dato fiscal y sin copia es una promesa de retención sin nada que la sostenga.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente del mostrador
          zone: public
        - id: caja
          type: web-client
          label: Caja de la farmacia
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
        - id: agencia
          type: external-provider
          label: Agencia tributaria
          zone: dmz
          role: tax-agency
        - id: archivo-db
          type: database
          label: Base de comprobantes
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-caja
          from: { node: cliente }
          to: { node: caja }
          dataClass: public
        - id: caja-gw
          from: { node: caja }
          to: { node: gw }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-agencia
          from: { node: facturacion }
          to: { node: agencia }
          dataClass: regulated
        - id: facturacion-archivo
          from: { node: facturacion }
          to: { node: archivo-db }
          dataClass: regulated
  - label: el comprobante se guarda como archivo
    contextInversion: 'guardar el comprobante como archivo gana cuando nadie lo consulta salvo el día que la agencia pide uno puntual: el documento se escribe una vez, no se modifica nunca y se lee casi nunca. Cuesta menos de operar y deja libre una unidad del presupuesto, a cambio de que buscar "todos los comprobantes de marzo de este cliente" deje de ser una consulta y pase a ser un recorrido.'
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente del mostrador
          zone: public
        - id: caja
          type: web-client
          label: Caja de la farmacia
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: billing-service
        - id: agencia
          type: external-provider
          label: Agencia tributaria
          zone: dmz
          role: tax-agency
        - id: archivo-objetos
          type: object-storage
          label: Archivo de comprobantes en disco
          zone: private
      edges:
        - id: cliente-caja
          from: { node: cliente }
          to: { node: caja }
          dataClass: public
        - id: caja-gw
          from: { node: caja }
          to: { node: gw }
          dataClass: personal
        - id: gw-facturacion
          from: { node: gw }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-agencia
          from: { node: facturacion }
          to: { node: agencia }
          dataClass: regulated
        - id: facturacion-archivo
          from: { node: facturacion }
          to: { node: archivo-objetos }
          dataClass: regulated
status: PILOT
---

Una cadena de cuatro farmacias emite **3.200 comprobantes por día**. El cajero
cobra, la caja llama al servicio de facturación, el servicio arma el comprobante
y lo envía a la agencia tributaria. Funciona: hace once meses que no falla.

El contador de la cadena escribió el requisito en una línea, y es la única línea
que importa acá:

> *"Un comprobante tiene que poder recuperarse durante cinco años."*

Leelo despacio. No dice *emitirse*. No dice *enviarse*. Dice **recuperarse**:
que dentro de cuatro años alguien pueda pedir el comprobante del 12 de marzo y
que ese comprobante aparezca.

Mirá el diagrama y buscá dónde queda. La agencia tributaria no es un archivo:
es un destino. Le mandás el comprobante y no te lo devuelve. El servicio de
facturación lo arma en memoria, lo manda y termina. Cuando el proceso se
reinicia esta noche no queda nada. Y se reinicia todas las noches, en el
despliegue de las 3 de la mañana.

En el lienzo hay dos piezas donde el comprobante podría quedar. Las dos están
puestas y ninguna está conectada. **Elegí una, conectala, y sostené por qué esa
y no la otra.** Las dos llegan a 100: no hay una respuesta escondida, hay dos
decisiones con costos distintos.
