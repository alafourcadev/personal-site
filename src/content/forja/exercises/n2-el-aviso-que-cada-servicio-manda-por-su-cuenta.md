---
title: "El aviso que cada servicio manda por su cuenta"
level: 2
role: core
domain: recursos-humanos
D1: 1
D2: 1
D3: 2
D4: 1
D5: 2
D6: 1
D7: 0
D8: 0
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, cuántos lugares hay que tocar hoy para cambiar de proveedor de mensajería, y cuántos después de tu cambio."
lambda: 0.5
constraints:
  - metric: mensajes salientes en un cierre de mes
    operator: ">="
    value: 14000
    unit: mensajes/mes
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: los dos servicios tienen la credencial del proveedor en su propia configuración, y la plantilla del mensaje duplicada con dos redacciones distintas.
    discoveryPath: "contá cuántas flechas del diagrama salen hacia el proveedor de mensajería. Cada una es una copia de la credencial, del formato del número y del texto."
  - fact: la empresa está evaluando cambiar de proveedor por precio. La migración se estimó en tres semanas.
    discoveryPath: "preguntate qué habría que tocar para reemplazar la caja de la derecha. Si la respuesta es 'todos los servicios que le apuntan', el proveedor no es un detalle de implementación, es parte del diseño de cada equipo."
  - fact: en el cierre de junio nómina mandó 4.200 mensajes en once minutos y el proveedor empezó a rechazar por límite de tasa. Personal, que comparte la misma cuenta, dejó de poder mandar sus avisos durante media hora.
    discoveryPath: "fijate qué comparten dos piezas que no se conocen entre sí. Comparten la cuenta del proveedor, y por lo tanto comparten su límite."
startingDesign:
  nodes:
    - id: empleado
      type: actor
      label: Empleado
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de personal
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: personal
      type: service
      label: Servicio de personal
      zone: private
      role: hr-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: personaldb
      type: database
      label: Base de personal
      zone: restricted
      role: hr-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: nomina
      type: service
      label: Servicio de nómina
      zone: private
      role: payroll-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: nominadb
      type: database
      label: Base de nómina
      zone: restricted
      role: payroll-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: mensajeria
      type: external-provider
      label: Proveedor de mensajería
      zone: dmz
      role: sms-provider
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: empleado-app
      from: { node: empleado }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-personal
      from: { node: gw }
      to: { node: personal }
      dataClass: personal
    - id: gw-nomina
      from: { node: gw }
      to: { node: nomina }
      dataClass: personal
    - id: personal-personaldb
      from: { node: personal }
      to: { node: personaldb }
      dataClass: personal
    - id: nomina-nominadb
      from: { node: nomina }
      to: { node: nominadb }
      dataClass: personal
    - id: personal-mensajeria
      from: { node: personal }
      to: { node: mensajeria }
      dataClass: personal
    - id: nomina-mensajeria
      from: { node: nomina }
      to: { node: mensajeria }
      dataClass: personal
guarantees:
  - id: g-hr-no-direct-send
    label: el servicio de personal no habla con el proveedor de mensajería
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: hr-service
      to:
        role: sms-provider
    whyMissing: hay una conexión que sale del servicio de personal y entra directo al proveedor de mensajería.
    consequence: la credencial, el formato del número de teléfono y la redacción del mensaje viven dentro de un servicio que existe para otra cosa. Cambiar de proveedor deja de ser un cambio y pasa a ser una migración en cada equipo que alguna vez mandó un aviso.
  - id: g-payroll-no-direct-send
    label: el servicio de nómina no habla con el proveedor de mensajería
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: payroll-service
      to:
        role: sms-provider
    whyMissing: hay una conexión que sale del servicio de nómina y entra directo al proveedor de mensajería.
    consequence: "en el cierre de mes nómina consume sola el límite de tasa de la cuenta compartida y personal deja de poder avisar nada. Dos equipos que no se conocen comparten un cupo: el que dispara primero apaga al otro."
  - id: g-hr-can-still-notify
    label: personal sigue pudiendo avisarle al empleado
    weight: 1
    predicate:
      op: path
      from:
        role: hr-service
      to:
        role: sms-provider
    whyMissing: no queda ningún camino desde el servicio de personal hasta el proveedor de mensajería.
    consequence: cortar la dependencia no puede costar la funcionalidad. Un empleado que no recibe el aviso de su cambio de licencia se entera en la oficina, tres días tarde.
  - id: g-payroll-can-still-notify
    label: nómina sigue pudiendo avisarle al empleado
    weight: 1
    predicate:
      op: path
      from:
        role: payroll-service
      to:
        role: sms-provider
    whyMissing: no queda ningún camino desde el servicio de nómina hasta el proveedor de mensajería.
    consequence: el aviso de recibo disponible es el que evita 300 consultas al área de personal cada cierre. Sin él, el costo no desaparece, se muda al teléfono de otra persona.
rubric:
  - dimension: la integración con el proveedor tiene un único dueño
    signal:
      kind: predicate
      guaranteeId: g-hr-no-direct-send
  - dimension: ningún equipo consume el cupo compartido de otro
    signal:
      kind: predicate
      guaranteeId: g-payroll-no-direct-send
  - dimension: personal conserva la capacidad de avisar
    signal:
      kind: predicate
      guaranteeId: g-hr-can-still-notify
  - dimension: nómina conserva la capacidad de avisar
    signal:
      kind: predicate
      guaranteeId: g-payroll-can-still-notify
referenceSolutions:
  - label: una pieza dueña de los avisos, a la que los demás le piden
    contextInversion: "un servicio de avisos al que se le llama en el momento es lo correcto cuando el aviso es parte de la operación y el equipo quiere saber ahí mismo si salió, como en un alta de empleado que necesita confirmación inmediata. Se paga con que un proveedor lento se siente en el servicio que llamó, y con una unidad operativa más."
    design:
      nodes:
        - id: empleado
          type: actor
          label: Empleado
          zone: public
        - id: app
          type: mobile-client
          label: App de personal
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: personal
          type: service
          label: Servicio de personal
          zone: private
          role: hr-service
          props: { criticality: "medium", replicas: "2" }
        - id: personaldb
          type: database
          label: Base de personal
          zone: restricted
          role: hr-db
          props: { backup: "diario" }
        - id: nomina
          type: service
          label: Servicio de nómina
          zone: private
          role: payroll-service
          props: { criticality: "medium", replicas: "2" }
        - id: nominadb
          type: database
          label: Base de nómina
          zone: restricted
          role: payroll-db
          props: { backup: "diario" }
        - id: avisos
          type: service
          label: Servicio de avisos
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: mensajeria
          type: external-provider
          label: Proveedor de mensajería
          zone: dmz
          role: sms-provider
      edges:
        - id: empleado-app
          from: { node: empleado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-personal
          from: { node: gw }
          to: { node: personal }
          dataClass: personal
        - id: gw-nomina
          from: { node: gw }
          to: { node: nomina }
          dataClass: personal
        - id: personal-personaldb
          from: { node: personal }
          to: { node: personaldb }
          dataClass: personal
        - id: nomina-nominadb
          from: { node: nomina }
          to: { node: nominadb }
          dataClass: personal
        - id: personal-avisos
          from: { node: personal }
          to: { node: avisos }
          dataClass: personal
        - id: nomina-avisos
          from: { node: nomina }
          to: { node: avisos }
          dataClass: personal
        - id: avisos-mensajeria
          from: { node: avisos }
          to: { node: mensajeria }
          dataClass: personal
  - label: los avisos se dejan en una cola y un solo proceso los despacha
    contextInversion: "dejar el aviso encolado conviene cuando el pico manda, con 4.200 mensajes en once minutos en el cierre de mes, porque el despachador consume a su propio ritmo y absorbe el límite de tasa del proveedor sin frenar a quien generó el aviso. Se paga con dos piezas para operar en vez de una y con que nadie sabe en el acto si el mensaje salió."
    design:
      nodes:
        - id: empleado
          type: actor
          label: Empleado
          zone: public
        - id: app
          type: mobile-client
          label: App de personal
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: personal
          type: service
          label: Servicio de personal
          zone: private
          role: hr-service
          props: { criticality: "medium", replicas: "2" }
        - id: personaldb
          type: database
          label: Base de personal
          zone: restricted
          role: hr-db
          props: { backup: "diario" }
        - id: nomina
          type: service
          label: Servicio de nómina
          zone: private
          role: payroll-service
          props: { criticality: "medium", replicas: "2" }
        - id: nominadb
          type: database
          label: Base de nómina
          zone: restricted
          role: payroll-db
          props: { backup: "diario" }
        - id: cola
          type: queue
          label: Cola de avisos al empleado
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: despachador
          type: worker
          label: Despachador de avisos
          zone: private
        - id: mensajeria
          type: external-provider
          label: Proveedor de mensajería
          zone: dmz
          role: sms-provider
      edges:
        - id: empleado-app
          from: { node: empleado }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-personal
          from: { node: gw }
          to: { node: personal }
          dataClass: personal
        - id: gw-nomina
          from: { node: gw }
          to: { node: nomina }
          dataClass: personal
        - id: personal-personaldb
          from: { node: personal }
          to: { node: personaldb }
          dataClass: personal
        - id: nomina-nominadb
          from: { node: nomina }
          to: { node: nominadb }
          dataClass: personal
        - id: personal-cola
          from: { node: personal }
          to: { node: cola }
          dataClass: personal
        - id: nomina-cola
          from: { node: nomina }
          to: { node: cola }
          dataClass: personal
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: personal
        - id: despachador-mensajeria
          from: { node: despachador }
          to: { node: mensajeria }
          dataClass: personal
status: PILOT
---

Una empresa de 900 empleados manda **14.000 mensajes por cierre de mes**:
recibos disponibles, cambios de licencia, avisos de vencimiento.

Dos servicios los mandan. El de personal, cuando alguien aprueba una licencia.
El de nómina, cuando el recibo queda publicado. Cada uno **habla directo con el
proveedor de mensajería**, con su propia credencial, su propio formato de
número de teléfono y su propia redacción del texto. Las dos redacciones son
distintas y ninguna de las dos es la que aprobó legales.

En el cierre de junio, nómina mandó 4.200 mensajes en once minutos y el
proveedor empezó a rechazar por límite de tasa. Personal, que usa **la misma
cuenta**, dejó de poder avisar nada durante media hora. Los dos equipos
abrieron un incidente. Ninguno de los dos entendía por qué el otro aparecía en
el suyo.

Ahora la empresa quiere cambiar de proveedor por precio. La estimación es de
**tres semanas**, y es tres semanas porque hay que tocar los dos servicios,
probar los dos, y desplegar los dos el mismo día.

El equipo tiene **7 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que mandar un aviso sea una responsabilidad con un
dueño, y para que cambiar de proveedor sea un cambio en un solo lugar.
