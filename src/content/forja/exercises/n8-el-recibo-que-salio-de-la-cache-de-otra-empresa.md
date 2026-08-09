---
title: "El recibo que salió de la caché de otra empresa"
level: 8
role: core
domain: nomina
D1: 4
D2: 3
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 0
D9: 2
prerequisiteLevels: [7]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que decir qué identifica a un recibo de forma única en tu diseño, y por qué ese identificador no puede repetirse entre dos empresas clientes."
lambda: 0.5
constraints:
  - metric: empresas clientes sobre la misma plataforma
    operator: ">="
    value: 480
    unit: empresas
  - metric: consultas de recibos en el pico del día 28
    operator: ">="
    value: 41000
    unit: consultas por hora
hiddenFacts:
  - fact: "la caché guarda el recibo ya renderizado y la clave es el documento del empleado más el mes. Nadie puso la empresa en la clave porque, cuando se escribió, un documento identificaba a una persona y una persona trabajaba en un lugar."
    discoveryPath: "es la razón por la que la garantía prohíbe la caché compartida en vez de pedir que se le agregue una clave. Con el editor de propiedades que hoy no existe, cambiarle la clave sería un gesto; sin él, la única forma de sacar el problema del diseño es sacar la pieza."
  - fact: "la conexión a la caché está declarada como dato público porque el equipo lo razonó así: el recibo ya renderizado es texto, no una tabla de la base. Por eso el motor no dice nada."
    discoveryPath: "mirá qué clase de dato declara esa conexión y compará con lo que realmente viaja. Un recibo de sueldo con nombre, documento y monto es dato personal aunque esté en HTML. El motor cree lo que le declarás; el auditor, no."
  - fact: "el pico del día 28 es real y es el motivo por el que la caché existe. Sacarlo sin poner otra cosa en su lugar devuelve el problema que la caché vino a resolver, con 41.000 consultas por hora contra la misma base."
    discoveryPath: "es la razón por la que una garantía pide que el recibo quede guardado como archivo. Un recibo de un mes cerrado no cambia nunca más: calcularlo una vez y guardarlo resuelve el pico sin compartir memoria entre empresas."
  - fact: "el proceso de cierre mensual recorre la base de todas las empresas en un solo barrido, para armar los recibos de los que ya tienen la liquidación aprobada."
    discoveryPath: "seguí la conexión del proceso de cierre y preguntate quién le dice de qué empresa es cada fila que lee. La respuesta es nadie."
startingDesign:
  nodes:
    - id: gestor
      type: actor
      label: Responsable de nómina
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal de nómina
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: nomina
      type: service
      label: Servicio de nómina
      zone: private
      role: payroll-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: cachecompartido
      type: cache
      label: Caché de recibos
      zone: private
      given: true
      props: { persistence: "volatile", ttl: "86400", eviction: "lru" }
      position: { x: 805, y: 300 }
    - id: lotes
      type: worker
      label: Proceso de cierre mensual
      zone: private
      role: payroll-batch
      given: true
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de liquidaciones
      zone: restricted
      role: payroll-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: gestor-portal
      from: { node: gestor }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-nomina
      from: { node: gw }
      to: { node: nomina }
      dataClass: personal
    - id: nomina-base
      from: { node: nomina }
      to: { node: base }
      dataClass: personal
    - id: nomina-cache
      from: { node: nomina }
      to: { node: cachecompartido }
      dataClass: public
    - id: lotes-base
      from: { node: lotes }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-no-shared-cache
    label: el servicio de nómina no consulta ninguna memoria compartida entre empresas
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: payroll-service
      to:
        type: [cache]
    whyMissing: sigue existiendo una conexión entre el servicio de nómina y una caché compartida por todas las empresas clientes.
    consequence: "la clave de la caché es el documento del empleado más el mes, y el mismo documento puede estar en dos empresas: un contratista, alguien que cambió de trabajo a mitad de mes. La segunda consulta recibe el recibo que dejó la primera, con el sueldo de la otra empresa."
  - id: g-scoped-read
    label: la consulta de un recibo llega a la base pasando por el servicio que sabe de qué empresa es
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: payroll-store
      via:
        role: payroll-service
    whyMissing: no hay ningún camino desde la puerta de entrada hasta la base de liquidaciones que pase por el servicio de nómina.
    consequence: el servicio de nómina es el único componente que recibe de qué empresa es la sesión. Cualquier otro camino a la base es un camino donde ese dato no viaja, y donde el aislamiento depende de que la consulta esté bien escrita.
  - id: g-receipt-is-stored
    label: el recibo se calcula una vez y queda guardado como documento
    weight: 2
    predicate:
      op: path
      from:
        role: payroll-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de nómina hasta un almacenamiento de objetos donde el recibo quede escrito.
    consequence: "sacar la caché sin poner nada en su lugar devuelve las 41.000 consultas por hora del día 28 contra la base. Un recibo de un mes cerrado no cambia nunca más: recalcularlo en cada consulta es trabajo que se paga todos los meses para obtener siempre el mismo resultado."
  - id: g-batch-through-service
    label: el cierre mensual le pide los datos al servicio de nómina
    weight: 1
    predicate:
      op: path
      from:
        role: payroll-batch
      to:
        role: payroll-service
    whyMissing: no hay ningún camino desde el proceso de cierre mensual hasta el servicio de nómina.
    consequence: el cierre necesita saber de qué empresa es cada liquidación que procesa. Si no se lo pregunta al componente que lo sabe, se lo tiene que inventar, y lo inventa una consulta escrita a mano.
  - id: g-batch-no-direct-scan
    label: el cierre mensual no abre ninguna consulta propia contra la base
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        role: payroll-batch
      to:
        role: payroll-store
    whyMissing: sigue existiendo una conexión directa entre el proceso de cierre mensual y la base de liquidaciones.
    consequence: el cierre recorre las 480 empresas en un solo barrido. Un error de agrupación ahí no muestra el sueldo de alguien en la pantalla equivocada, lo escribe en el recibo equivocado, y ese documento se manda por correo.
rubric:
  - dimension: ninguna memoria compartida guarda el dato de una empresa donde otra puede pedirlo
    signal:
      kind: predicate
      guaranteeId: g-no-shared-cache
  - dimension: toda lectura pasa por el componente que conoce al dueño
    signal:
      kind: predicate
      guaranteeId: g-scoped-read
  - dimension: el pico se absorbe sin compartir memoria entre clientes
    signal:
      kind: predicate
      guaranteeId: g-receipt-is-stored
  - dimension: el proceso masivo entra por la misma puerta que todos
    signal:
      kind: predicate
      guaranteeId: g-batch-through-service
  - dimension: no queda ningún barrido crudo sobre el almacén compartido
    signal:
      kind: predicate
      guaranteeId: g-batch-no-direct-scan
referenceSolutions:
  - label: el servicio escribe el recibo en el momento de calcularlo
    contextInversion: "escribir el recibo en el mismo acto en que se lo calcula conviene cuando la liquidación se aprueba de a una empresa por vez y el volumen por empresa es chico: el documento queda escrito en el instante exacto en que el dato es válido, y no hay ninguna pieza intermedia que pueda quedarse a mitad de camino. El costo es que la escritura del archivo queda dentro del pedido del responsable de nómina: si el almacenamiento se pone lento, la aprobación se pone lenta."
    design:
      nodes:
        - id: gestor
          type: actor
          label: Responsable de nómina
          zone: public
        - id: portal
          type: web-client
          label: Portal de nómina
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nomina
          type: service
          label: Servicio de nómina
          zone: private
          role: payroll-service
          props: { criticality: "high", replicas: "2" }
        - id: lotes
          type: worker
          label: Proceso de cierre mensual
          zone: private
          role: payroll-batch
        - id: recibos
          type: object-storage
          label: Archivo de recibos
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de liquidaciones
          zone: restricted
          role: payroll-store
          props: { backup: "diario" }
      edges:
        - id: gestor-portal
          from: { node: gestor }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-nomina
          from: { node: gw }
          to: { node: nomina }
          dataClass: personal
        - id: nomina-base
          from: { node: nomina }
          to: { node: base }
          dataClass: personal
        - id: nomina-recibos
          from: { node: nomina }
          to: { node: recibos }
          dataClass: personal
        - id: lotes-nomina
          from: { node: lotes }
          to: { node: nomina }
          dataClass: personal
  - label: el cierre encarga los recibos por una cola y los escribe el proceso de lotes
    contextInversion: "encargar la escritura por una cola conviene el día 28, cuando se cierran 480 empresas casi al mismo tiempo: el pedido queda anotado, el proceso de lotes escribe a su ritmo, y un recibo que falla se reintenta sin que nadie mire una pantalla en blanco. Se paga con una pieza más para operar y con que el recibo aparece unos minutos después de aprobada la liquidación, no en el mismo instante."
    design:
      nodes:
        - id: gestor
          type: actor
          label: Responsable de nómina
          zone: public
        - id: portal
          type: web-client
          label: Portal de nómina
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nomina
          type: service
          label: Servicio de nómina
          zone: private
          role: payroll-service
          props: { criticality: "high", replicas: "2" }
        - id: pendientes
          type: queue
          label: Cola de recibos por emitir
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: lotes
          type: worker
          label: Proceso de cierre mensual
          zone: private
          role: payroll-batch
        - id: recibos
          type: object-storage
          label: Archivo de recibos
          zone: private
          props: { access: "signed", durability: "99.999999999" }
        - id: base
          type: database
          label: Base de liquidaciones
          zone: restricted
          role: payroll-store
          props: { backup: "diario" }
      edges:
        - id: gestor-portal
          from: { node: gestor }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-nomina
          from: { node: gw }
          to: { node: nomina }
          dataClass: personal
        - id: nomina-base
          from: { node: nomina }
          to: { node: base }
          dataClass: personal
        - id: nomina-pendientes
          from: { node: nomina }
          to: { node: pendientes }
          dataClass: personal
        - id: pendientes-lotes
          from: { node: pendientes }
          to: { node: lotes }
          dataClass: personal
        - id: lotes-nomina
          from: { node: lotes }
          to: { node: nomina }
          dataClass: personal
        - id: lotes-recibos
          from: { node: lotes }
          to: { node: recibos }
          dataClass: personal
status: PILOT
---

Una plataforma de liquidación de sueldos que usan **480 empresas**. Todas
sobre la misma base. El día 28 de cada mes, cuando se aprueban las
liquidaciones, la plataforma atiende **41.000 consultas de recibos por
hora**.

Para sobrevivir a ese pico, hace dos años se puso una caché delante del
servicio de nómina. Guarda el recibo ya armado. La clave es el documento del
empleado más el mes. Funcionó: el pico dejó de doler.

En febrero, la responsable de nómina de una consultora abrió el recibo de un
contratista y encontró un sueldo que no era el que había firmado. Era el que
esa misma persona cobra en otra empresa cliente de la plataforma.

El mismo documento. El mismo mes. Una sola clave.

Nadie se equivocó al escribir el código. Cuando esa clave se eligió, un
documento identificaba a una persona y una persona trabajaba en un lugar. La
multi-tenencia no rompió el código: rompió el supuesto.

Hay dos detalles más, y los dos importan.

La conexión a la caché está declarada como dato público. El equipo lo razonó
así porque el recibo ya renderizado es texto, no una tabla. Por eso nadie
recibió ninguna advertencia. Un recibo de sueldo con nombre, documento y
monto es dato personal aunque esté en HTML.

Y el proceso de cierre mensual recorre la base de las 480 empresas en un solo
barrido. Nadie le dice de qué empresa es cada fila que lee: lo deduce de una
consulta escrita a mano.

El pico del día 28 es real. Sacar la caché y no poner nada en su lugar
devuelve las 41.000 consultas por hora contra la base.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que ninguna memoria compartida guarde el dato de
una empresa donde otra pueda pedirlo, para que el pico se siga absorbiendo, y
para que el cierre mensual entre por la misma puerta que todos.
