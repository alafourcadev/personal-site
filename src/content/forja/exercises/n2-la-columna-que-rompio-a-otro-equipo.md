---
title: "La columna que rompió a otro equipo"
level: 2
role: core
domain: retail
D1: 1
D2: 1
D3: 2
D4: 1
D5: 1
D6: 1
D7: 0
D8: 0
D9: 1
prerequisiteLevels: [1]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, qué le pasa a promociones el día que catálogo cambie la forma de sus datos."
lambda: 0.5
constraints:
  - metric: productos publicados en el catálogo
    operator: ">="
    value: 42000
    unit: productos
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: promociones no sólo lee la base de catálogo, también escribe ahí el precio con descuento. Los dos equipos escriben la misma fila.
    discoveryPath: "mirá la única conexión del diagrama que entra a una base desde un servicio que no la creó. Todo lo que viaja por esa flecha es forma interna de otro equipo."
  - fact: catálogo despliega dos veces por semana; promociones despliega todos los días durante campañas.
    discoveryPath: "preguntate qué tiene que pasar para desplegar una campaña. Si la respuesta incluye 'avisarle al otro equipo', el límite está mal puesto, no el proceso."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
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
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: catalogodb
      type: database
      label: Base de catálogo
      zone: restricted
      role: catalog-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: promociones
      type: service
      label: Servicio de promociones
      zone: private
      role: promo-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
  edges:
    - id: comprador-web
      from: { node: comprador }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: public
    - id: gw-catalogo
      from: { node: gw }
      to: { node: catalogo }
      dataClass: public
    - id: catalogo-catalogodb
      from: { node: catalogo }
      to: { node: catalogodb }
      dataClass: public
    - id: gw-promociones
      from: { node: gw }
      to: { node: promociones }
      dataClass: public
    - id: promociones-catalogodb
      from: { node: promociones }
      to: { node: catalogodb }
      dataClass: public
guarantees:
  - id: g-no-cross-store
    label: promociones no entra a la base de catálogo
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: promo-service
      to:
        role: catalog-db
    whyMissing: hay una conexión que sale del servicio de promociones y entra directo a la base de catálogo.
    consequence: la estructura interna de la base de catálogo se vuelve una interfaz pública sin que nadie lo haya decidido. Un renombre de columna, un cambio de tipo o una tabla partida en dos rompen a un equipo que ni siquiera aparece en el pull request.
  - id: g-promo-owns-store
    label: promociones guarda sus reglas en un almacenamiento propio
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: promo-service
        - op: covered
          target:
            role: promo-service
          by:
            type: [database]
    whyMissing: el servicio de promociones no existe, o no está conectado a ninguna base de datos propia donde guardar sus reglas de descuento.
    consequence: "una campaña sin almacenamiento propio se guarda donde se pueda, y donde se puede siempre es la base de otro. El límite vuelve a desaparecer en la primera urgencia: es el mismo problema, dos meses después."
  - id: g-catalog-owner
    label: la base de catálogo la sigue escribiendo su dueño
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: catalog-db
        - op: covered
          target:
            role: catalog-db
          by:
            role: catalog-service
    whyMissing: la base de catálogo no existe, o no está conectada al servicio de catálogo.
    consequence: separar no es repartir el dato entre todos. Si la base de catálogo se queda sin dueño, el problema no se resolvió, se distribuyó.
rubric:
  - dimension: ningún servicio lee ni escribe el almacenamiento de otro
    signal:
      kind: predicate
      guaranteeId: g-no-cross-store
  - dimension: cada responsabilidad guarda su propio dato
    signal:
      kind: predicate
      guaranteeId: g-promo-owns-store
  - dimension: el catálogo conserva un único dueño
    signal:
      kind: predicate
      guaranteeId: g-catalog-owner
referenceSolutions:
  - label: promociones guarda sus reglas y le pregunta al catálogo el producto
    contextInversion: "preguntarle al dueño en el momento es lo correcto cuando el precio de lista tiene que ser el de este segundo, en un catálogo que cambia precios varias veces por hora, y cuando el equipo prefiere dos piezas simples antes que tres piezas y una copia que mantener. Se paga con que armar la página de una campaña depende de que el servicio de catálogo esté respondiendo."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
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
          props: { criticality: "medium", replicas: "2" }
        - id: catalogodb
          type: database
          label: Base de catálogo
          zone: restricted
          role: catalog-db
          props: { backup: "diario" }
        - id: promociones
          type: service
          label: Servicio de promociones
          zone: private
          role: promo-service
          props: { criticality: "medium", replicas: "2" }
        - id: promocionesdb
          type: database
          label: Base de promociones
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: comprador-web
          from: { node: comprador }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: public
        - id: gw-catalogo
          from: { node: gw }
          to: { node: catalogo }
          dataClass: public
        - id: catalogo-catalogodb
          from: { node: catalogo }
          to: { node: catalogodb }
          dataClass: public
        - id: gw-promociones
          from: { node: gw }
          to: { node: promociones }
          dataClass: public
        - id: promociones-promocionesdb
          from: { node: promociones }
          to: { node: promocionesdb }
          dataClass: public
        - id: promociones-catalogo
          from: { node: promociones }
          to: { node: catalogo }
          dataClass: public
  - label: promociones mantiene su propia copia de los productos
    contextInversion: "la copia propia conviene cuando promociones tiene que responder aunque catálogo esté caído. El viernes de una campaña grande catálogo cae y las promos siguen. También conviene cuando un producto de hace unos segundos es igual de bueno que el de ahora. Se paga con dos piezas más para operar y con la obligación de aceptar que la copia siempre está un poco atrás."
    design:
      nodes:
        - id: comprador
          type: actor
          label: Comprador
          zone: public
        - id: web
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
          props: { criticality: "medium", replicas: "2" }
        - id: catalogodb
          type: database
          label: Base de catálogo
          zone: restricted
          role: catalog-db
          props: { backup: "diario" }
        - id: promociones
          type: service
          label: Servicio de promociones
          zone: private
          role: promo-service
          props: { criticality: "medium", replicas: "2" }
        - id: promocionesdb
          type: database
          label: Base de promociones
          zone: restricted
          props: { backup: "diario" }
        - id: eventos
          type: stream
          label: Registro de cambios de catálogo
          zone: private
          props: { retention: "7d", partitions: "3" }
        - id: copiador
          type: worker
          label: Copiador de productos
          zone: private
      edges:
        - id: comprador-web
          from: { node: comprador }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: public
        - id: gw-catalogo
          from: { node: gw }
          to: { node: catalogo }
          dataClass: public
        - id: catalogo-catalogodb
          from: { node: catalogo }
          to: { node: catalogodb }
          dataClass: public
        - id: gw-promociones
          from: { node: gw }
          to: { node: promociones }
          dataClass: public
        - id: promociones-promocionesdb
          from: { node: promociones }
          to: { node: promocionesdb }
          dataClass: public
        - id: catalogo-eventos
          from: { node: catalogo }
          to: { node: eventos }
          dataClass: public
        - id: eventos-copiador
          from: { node: eventos }
          to: { node: copiador }
          dataClass: public
        - id: copiador-promocionesdb
          from: { node: copiador }
          to: { node: promocionesdb }
          dataClass: public
status: PILOT
---

Una tienda con **42.000 productos publicados**. Dos equipos: catálogo, que
mantiene el producto y su precio de lista, y promociones, que arma campañas y
calcula descuentos.

Cuando empezaron, promociones necesitaba leer el producto y lo más rápido fue
**conectarse a la base de catálogo**. Después necesitó guardar el precio con
descuento y lo guardó ahí mismo, en una columna nueva de la misma tabla.
Nadie discutió: era una línea de configuración.

Hoy los dos equipos escriben la misma fila. Catálogo despliega dos veces por
semana; promociones despliega **todos los días** durante campañas. La semana
pasada catálogo partió la tabla de productos en dos para acelerar una consulta
y promociones dejó de funcionar durante la campaña de invierno. La migración
duró once minutos. La campaña, cuatro horas menos de lo previsto.

El dueño de producto pide una sola cosa: que **catálogo pueda cambiar la forma
de sus datos sin coordinar con nadie**, y que promociones siga pudiendo armar
una campaña. El equipo tiene **7 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que cada equipo sea dueño de lo que guarda, y para
que lo que el otro necesite viaje por algo que sí es un contrato.
