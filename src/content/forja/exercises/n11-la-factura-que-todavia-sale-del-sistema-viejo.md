---
title: "La factura que todavía sale del sistema viejo"
level: 11
role: calibration
domain: facturacion
D1: 2
D2: 2
D3: 3
D4: 4
D5: 3
D6: 2
D7: 2
D8: 1
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 6
aiBudget: "libre, pero la respuesta tiene que explicar por qué el sistema viejo sigue en pie después de que el nuevo empieza a facturar."
lambda: 0.5
constraints:
  - metric: facturas emitidas por mes
    operator: ">="
    value: 180000
    unit: facturas/mes
  - metric: tiempo aceptable para volver al sistema viejo si el nuevo emite mal
    operator: "<="
    value: 5
    unit: minutos
hiddenFacts:
  - fact: el servicio nuevo se terminó hace siete semanas y no emitió una sola factura real. Nadie encontró el momento de mandarle tráfico porque la única forma de probarlo era apagar el viejo.
    discoveryPath: "está en el lienzo desde el principio, conectado a la base de facturas y sin una sola conexión entrante. Un servicio que nadie llama no es un servicio migrado: es código que todavía no se ejecutó nunca en producción."
  - fact: hay un enrutador desplegado hace un mes que tampoco recibe tráfico. Lo puso el equipo de plataforma para este corte y quedó ahí.
    discoveryPath: "también está en el lienzo sin conexiones. Es la pieza que permite mover el tráfico sin tocar ni el sistema viejo ni el nuevo, y también la que permite devolverlo."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente de la empresa
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Portal de facturación
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: enrutador
      type: service
      label: Enrutador de facturación
      zone: private
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: viejo
      type: service
      label: Facturación (sistema viejo)
      zone: private
      role: legacy-billing
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Facturación (sistema nuevo)
      zone: private
      role: new-billing
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: facturas
      type: database
      label: Base de facturas
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
  edges:
    - id: cliente-web
      from: { node: cliente }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: personal
    - id: viejo-facturas
      from: { node: viejo }
      to: { node: facturas }
      dataClass: personal
    - id: nuevo-facturas
      from: { node: nuevo }
      to: { node: facturas }
      dataClass: personal
guarantees:
  - id: g-transition-piece
    label: el tráfico llega al sistema viejo, pero ya no entra directo desde la puerta
    weight: 2
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [api-gateway]
          to:
            role: legacy-billing
        - op: edgeAbsent
          from:
            type: [api-gateway]
          to:
            role: legacy-billing
    whyMissing: la puerta de entrada sigue llamando al sistema viejo directamente, sin ninguna pieza en el medio que decida a dónde va cada factura.
    consequence: "mover una sola factura al sistema nuevo obliga a tocar la puerta de entrada, y volver atrás obliga a tocarla otra vez. El corte deja de ser una decisión de operación y pasa a ser un despliegue: se hace en horas, no en minutos, y en el medio hay una ventana donde nadie sabe qué está sirviendo qué."
  - id: g-new-serves
    label: el sistema nuevo emite facturas de verdad
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: new-billing
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el sistema nuevo. Está desplegado, conectado a la base, y nunca recibió una petición real.
    consequence: "un servicio que nadie llamó todavía no está migrado, está escrito. Lo que falta descubrir de él se descubre el día que recibe las 180.000 facturas del mes, que es exactamente el peor día para descubrirlo."
rubric:
  - dimension: el tráfico pasa por una pieza que se puede mover sin desplegar
    signal:
      kind: predicate
      guaranteeId: g-transition-piece
  - dimension: el sistema nuevo procesa carga real antes de que el viejo se apague
    signal:
      kind: predicate
      guaranteeId: g-new-serves
referenceSolutions:
  - label: el enrutador reparte entre los dos
    contextInversion: "repartir desde una pieza dedicada es lo correcto cuando querés mover el tráfico por porcentaje o por tipo de cliente sin tocar ninguno de los dos sistemas: el enrutador es el único lugar donde vive la decisión, y devolver el tráfico al viejo es cambiar ese lugar. Se paga con una unidad operativa más y con una pieza en el camino crítico de cada factura."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente de la empresa
          zone: public
        - id: web
          type: web-client
          label: Portal de facturación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador de facturación
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Facturación (sistema viejo)
          zone: private
          role: legacy-billing
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Facturación (sistema nuevo)
          zone: private
          role: new-billing
          props: { criticality: "high", replicas: "2" }
        - id: facturas
          type: database
          label: Base de facturas
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-enrutador
          from: { node: gw }
          to: { node: enrutador }
          dataClass: personal
        - id: enrutador-viejo
          from: { node: enrutador }
          to: { node: viejo }
          dataClass: personal
        - id: enrutador-nuevo
          from: { node: enrutador }
          to: { node: nuevo }
          dataClass: personal
        - id: viejo-facturas
          from: { node: viejo }
          to: { node: facturas }
          dataClass: personal
        - id: nuevo-facturas
          from: { node: nuevo }
          to: { node: facturas }
          dataClass: personal
  - label: el sistema nuevo adelante, delegando lo que todavía no sabe hacer
    contextInversion: "poner el sistema nuevo adelante y que él delegue en el viejo lo que todavía no migró conviene cuando la migración va por funcionalidad y no por porcentaje de tráfico: cada vez que el nuevo aprende a hacer algo, deja de delegarlo, y el viejo se va quedando sin trabajo solo. Es una pieza menos que operar, y el precio es que el sistema nuevo está en el camino de absolutamente todo desde el primer día: si se cae, no hay a dónde devolver el tráfico sin desplegar."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente de la empresa
          zone: public
        - id: web
          type: web-client
          label: Portal de facturación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Facturación (sistema nuevo)
          zone: private
          role: new-billing
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Facturación (sistema viejo)
          zone: private
          role: legacy-billing
          props: { criticality: "high", replicas: "2" }
        - id: facturas
          type: database
          label: Base de facturas
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: cliente-web
          from: { node: cliente }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: nuevo-viejo
          from: { node: nuevo }
          to: { node: viejo }
          dataClass: personal
        - id: nuevo-facturas
          from: { node: nuevo }
          to: { node: facturas }
          dataClass: personal
        - id: viejo-facturas
          from: { node: viejo }
          to: { node: facturas }
          dataClass: personal
status: PILOT
---

Una empresa de servicios emite **180.000 facturas por mes**. El sistema que
las emite tiene once años y lo mantiene una persona que entiende sus
particularidades. Nadie lo quiere tocar y nadie lo quiere apagar.

Hace siete semanas se terminó el reemplazo. Está desplegado, está conectado
a la base de facturas, y **no emitió una sola factura real**. La razón es
simple y es la de siempre: la única forma que hay hoy de probarlo es apagar
el viejo, porque la puerta de entrada llama al viejo directamente y no
existe ningún lugar donde decir "esta factura la hace el nuevo".

Hay también un enrutador desplegado hace un mes por el equipo de
plataforma, esperando este corte. Tampoco recibe tráfico.

La dirección puso una condición para autorizar el arranque: **si el sistema
nuevo emite mal, se tiene que poder volver al viejo en menos de cinco
minutos**. Cinco minutos es el tiempo de una decisión de operación, no el de
un despliegue: descarta cualquier plan donde volver atrás signifique
reconstruir y publicar algo.

**Rearmá el sistema** para que el sistema nuevo empiece a emitir facturas de
verdad, para que el viejo siga en pie y siga sirviendo, y para que la
decisión de quién atiende cada factura viva en un solo lugar que se pueda
cambiar sin desplegar nada.
