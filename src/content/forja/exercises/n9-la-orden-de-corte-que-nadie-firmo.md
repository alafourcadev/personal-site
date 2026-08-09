---
title: "La orden de corte que nadie firmó"
level: 9
role: core
domain: energia
D1: 3
D2: 3
D3: 4
D4: 2
D5: 3
D6: 3
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar la diferencia entre comprobar quién entra y poder decir después quién entró, y por qué la primera sin la segunda no sirve delante de un regulador."
lambda: 1
constraints:
  - metric: suministros que el sistema puede cortar y reconectar de forma remota
    operator: ">="
    value: 1200000
    unit: suministros
  - metric: horas dentro de las que el regulador exige identificar el origen de una maniobra
    operator: "<="
    value: 48
    unit: horas
hiddenFacts:
  - fact: "en agosto se cortó el suministro de un hospital privado durante 40 minutos por una orden de maniobra que nadie reconoce haber dado. La distribuidora no pudo decir quién la originó y la multa se aplicó por eso, no por el corte."
    discoveryPath: "preguntate qué queda escrito cuando alguien pasa por una entrada del sistema. Si la respuesta es cuántos pasaron pero no quiénes, el sistema comprueba identidad y después la tira."
  - fact: "las dos entradas comprueban identidad contra el mismo proveedor con segundo factor. El problema nunca fue la autenticación: la orden la dio alguien autenticado."
    discoveryPath: "mirá qué está bien resuelto antes de buscar qué falta. Si todas las entradas ya preguntan quién sos, lo que falta no es preguntar: es guardar la respuesta."
  - fact: "la cuadrilla de campo usa una aplicación móvil que también puede cortar y reconectar. Ese camino tiene menos registro que el de la mesa de control, porque se agregó en 2023 y nadie replicó lo que sí tenía el camino viejo."
    discoveryPath: "contá cuántos caminos llegan al componente que ejecuta la maniobra. Un registro que cubre uno de dos caminos no responde la pregunta del regulador: responde la mitad."
startingDesign:
  nodes:
    - id: operador
      type: actor
      label: Operador de la mesa de control
      zone: public
      given: true
      position: { x: 85, y: 60 }
    - id: cuadrilla
      type: actor
      label: Cuadrilla de campo
      zone: public
      given: true
      position: { x: 85, y: 320 }
    - id: consola
      type: web-client
      label: Consola de maniobras
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: app
      type: mobile-client
      label: Aplicación de campo
      zone: public
      given: true
      position: { x: 445, y: 400 }
    - id: gwcontrol
      type: api-gateway
      label: Puerta de la mesa de control
      zone: dmz
      given: true
      position: { x: 445, y: 170 }
    - id: gwcampo
      type: api-gateway
      label: Puerta de campo
      zone: dmz
      given: true
      position: { x: 445, y: 510 }
    - id: maniobras
      type: service
      label: Servicio de maniobras
      zone: private
      role: maniobras-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 290 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad de la distribuidora
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 80 }
    - id: basesuministro
      type: database
      label: Base de suministros
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 290 }
  edges:
    - id: operador-consola
      from: { node: operador }
      to: { node: consola }
      dataClass: public
    - id: consola-gwcontrol
      from: { node: consola }
      to: { node: gwcontrol }
      dataClass: personal
    - id: gwcontrol-identidad
      from: { node: gwcontrol }
      to: { node: identidad }
      dataClass: secret
    - id: gwcontrol-maniobras
      from: { node: gwcontrol }
      to: { node: maniobras }
      dataClass: regulated
    - id: cuadrilla-app
      from: { node: cuadrilla }
      to: { node: app }
      dataClass: public
    - id: app-gwcampo
      from: { node: app }
      to: { node: gwcampo }
      dataClass: personal
    - id: gwcampo-identidad
      from: { node: gwcampo }
      to: { node: identidad }
      dataClass: secret
    - id: gwcampo-maniobras
      from: { node: gwcampo }
      to: { node: maniobras }
      dataClass: regulated
    - id: maniobras-basesuministro
      from: { node: maniobras }
      to: { node: basesuministro }
      dataClass: regulated
guarantees:
  - id: g-doors-watched
    label: todas las entradas quedan registradas por un componente que las observa
    weight: 3
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [observability]
    whyMissing: hay al menos una entrada al sistema que no está conectada a ningún componente de observabilidad, así que lo que pasa por ahí no queda escrito en ningún lado.
    consequence: "el regulador no preguntó si la orden estaba autorizada: preguntó quién la dio. Una entrada que comprueba identidad y no la registra responde bien en el momento y no responde nada 48 horas después. La multa de agosto se aplicó por eso, no por los 40 minutos de corte."
  - id: g-service-watched
    label: el componente que ejecuta la maniobra también queda observado
    weight: 2
    predicate:
      op: covered
      target:
        role: maniobras-service
      by:
        type: [observability]
    whyMissing: el servicio de maniobras no está conectado a ningún componente de observabilidad, así que lo que ejecutó no queda registrado del lado del que ejecuta.
    consequence: "registrar sólo en la entrada deja un hueco: lo que entró y lo que se ejecutó no son lo mismo si algo se reintentó, se transformó o falló a mitad de camino. Reconstruir un corte a partir del registro de la puerta es reconstruirlo a partir de la intención, no del hecho."
  - id: g-doors-identity
    label: todas las entradas comprueban identidad con doble factor
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad con segundo factor obligatorio.
    consequence: "un registro de accesos sin identidad detrás guarda una dirección de red y una hora. Eso no nombra a nadie. Registrar sin identificar produce un archivo que parece una prueba y no lo es."
  - id: g-operator-path
    label: el operador de la mesa sigue llegando a la maniobra por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: maniobras-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde la consola de maniobras hasta el servicio de maniobras que pase por una entrada del sistema.
    consequence: "una distribuidora que no puede reconectar de forma remota manda una cuadrilla a cada suministro. Endurecer el registro no puede costar la operación: un control que deja a la mesa de control sin maniobrar se apaga la primera noche de tormenta."
  - id: g-field-path
    label: la cuadrilla de campo sigue llegando a la maniobra por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [mobile-client]
      to:
        role: maniobras-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde la aplicación de campo hasta el servicio de maniobras que pase por una entrada del sistema.
    consequence: "el camino de la cuadrilla es el que menos registro tiene, y por eso es el primero que alguien propone apagar. Apagarlo no arregla nada: la cuadrilla sigue teniendo que reconectar en la calle y va a hacerlo por teléfono, pidiéndole la maniobra a la mesa de control. El acceso no desaparece, se muda a un canal donde ya no queda ni el registro parcial que había."
  - id: g-supply-store
    label: el estado del suministro vive en un almacenamiento con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: maniobras-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio de maniobras hasta una base de datos con copia de respaldo declarada.
    consequence: "el estado de corte de 1.200.000 suministros es el dato del que depende saber a quién hay que reconectar. Sin copia, una restauración parcial deja casas sin luz que el sistema cree conectadas, y nadie se entera hasta que llaman."
rubric:
  - dimension: ninguna entrada queda sin registro
    signal:
      kind: predicate
      guaranteeId: g-doors-watched
  - dimension: lo que se ejecutó también queda escrito
    signal:
      kind: predicate
      guaranteeId: g-service-watched
  - dimension: el registro tiene un nombre detrás
    signal:
      kind: predicate
      guaranteeId: g-doors-identity
  - dimension: la mesa de control sigue operando
    signal:
      kind: predicate
      guaranteeId: g-operator-path
  - dimension: la cuadrilla sigue operando en la calle
    signal:
      kind: predicate
      guaranteeId: g-field-path
  - dimension: el estado del suministro se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-supply-store
referenceSolutions:
  - label: dos entradas, un solo lugar donde queda escrito
    contextInversion: "mantener las dos entradas y colgar las dos del mismo componente de observabilidad conviene cuando los dos públicos ya funcionan y lo único que falta es el registro: la mesa de control y la cuadrilla siguen con sus límites de tasa y sus horarios, y el cambio es aditivo, se puede desplegar un martes sin tocar el camino de la maniobra. El costo es que un solo componente de observabilidad se vuelve el lugar donde vive la prueba: si se queda sin espacio o se cae, las dos entradas siguen funcionando y nadie se entera de que dejó de haber registro."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de la mesa de control
          zone: public
        - id: cuadrilla
          type: actor
          label: Cuadrilla de campo
          zone: public
        - id: consola
          type: web-client
          label: Consola de maniobras
          zone: public
        - id: app
          type: mobile-client
          label: Aplicación de campo
          zone: public
        - id: gwcontrol
          type: api-gateway
          label: Puerta de la mesa de control
          zone: dmz
        - id: gwcampo
          type: api-gateway
          label: Puerta de campo
          zone: dmz
        - id: maniobras
          type: service
          label: Servicio de maniobras
          zone: private
          role: maniobras-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la distribuidora
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: registroaccesos
          type: observability
          label: Registro de accesos y maniobras
          zone: private
          props: { logs: "sí", alerting: "sí" }
        - id: basesuministro
          type: database
          label: Base de suministros
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: operador-consola
          from: { node: operador }
          to: { node: consola }
          dataClass: public
        - id: consola-gwcontrol
          from: { node: consola }
          to: { node: gwcontrol }
          dataClass: personal
        - id: gwcontrol-identidad
          from: { node: gwcontrol }
          to: { node: identidad }
          dataClass: secret
        - id: gwcontrol-maniobras
          from: { node: gwcontrol }
          to: { node: maniobras }
          dataClass: regulated
        - id: gwcontrol-registroaccesos
          from: { node: gwcontrol }
          to: { node: registroaccesos }
          dataClass: personal
        - id: cuadrilla-app
          from: { node: cuadrilla }
          to: { node: app }
          dataClass: public
        - id: app-gwcampo
          from: { node: app }
          to: { node: gwcampo }
          dataClass: personal
        - id: gwcampo-identidad
          from: { node: gwcampo }
          to: { node: identidad }
          dataClass: secret
        - id: gwcampo-maniobras
          from: { node: gwcampo }
          to: { node: maniobras }
          dataClass: regulated
        - id: gwcampo-registroaccesos
          from: { node: gwcampo }
          to: { node: registroaccesos }
          dataClass: personal
        - id: maniobras-registroaccesos
          from: { node: maniobras }
          to: { node: registroaccesos }
          dataClass: regulated
        - id: maniobras-basesuministro
          from: { node: maniobras }
          to: { node: basesuministro }
          dataClass: regulated
  - label: una sola entrada y un servicio de órdenes que deja la orden escrita antes de ejecutarla
    contextInversion: "colapsar las dos entradas y meter un servicio de órdenes delante de la maniobra conviene cuando lo que hay que poder demostrar no es sólo quién entró sino qué se pidió y en qué orden: la orden se registra como orden, con su autor, su motivo y su suministro, antes de que nadie abra un interruptor, y la maniobra pasa a ser la consecuencia de un pedido que ya existe escrito. Es la forma que resiste la pregunta del regulador sin depender de correlacionar dos registros por hora. Se paga con una pieza más en el camino crítico y con acoplamiento entre los dos públicos: la mesa de control y la cuadrilla comparten entrada, límites y ventana de mantenimiento."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de la mesa de control
          zone: public
        - id: cuadrilla
          type: actor
          label: Cuadrilla de campo
          zone: public
        - id: consola
          type: web-client
          label: Consola de maniobras
          zone: public
        - id: app
          type: mobile-client
          label: Aplicación de campo
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta única de maniobras
          zone: dmz
        - id: ordenes
          type: service
          label: Servicio de órdenes de maniobra
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: maniobras
          type: service
          label: Servicio de maniobras
          zone: private
          role: maniobras-service
          props: { criticality: "high", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la distribuidora
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: registroaccesos
          type: observability
          label: Registro de accesos y maniobras
          zone: private
          props: { logs: "sí", alerting: "sí" }
        - id: basesuministro
          type: database
          label: Base de suministros
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: operador-consola
          from: { node: operador }
          to: { node: consola }
          dataClass: public
        - id: consola-gw
          from: { node: consola }
          to: { node: gw }
          dataClass: personal
        - id: cuadrilla-app
          from: { node: cuadrilla }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-ordenes
          from: { node: gw }
          to: { node: ordenes }
          dataClass: regulated
        - id: gw-registroaccesos
          from: { node: gw }
          to: { node: registroaccesos }
          dataClass: personal
        - id: ordenes-registroaccesos
          from: { node: ordenes }
          to: { node: registroaccesos }
          dataClass: regulated
        - id: ordenes-maniobras
          from: { node: ordenes }
          to: { node: maniobras }
          dataClass: regulated
        - id: maniobras-registroaccesos
          from: { node: maniobras }
          to: { node: registroaccesos }
          dataClass: regulated
        - id: maniobras-basesuministro
          from: { node: maniobras }
          to: { node: basesuministro }
          dataClass: regulated
status: PILOT
---

Una distribuidora eléctrica que puede cortar y reconectar **1.200.000
suministros** de forma remota. Dos caminos llegan a esa capacidad: la mesa
de control, desde una consola web, y la cuadrilla de campo, desde una
aplicación móvil.

Las dos entradas comprueban identidad contra el mismo proveedor, con segundo
factor. Ese trabajo está hecho y está bien hecho.

En agosto se cortó el suministro de un hospital privado durante **40
minutos** por una orden de maniobra que nadie reconoce haber dado. La
distribuidora investigó, reconstruyó lo que pudo y **no pudo decir quién la
originó**. El regulador exige poder identificar el origen de una maniobra
dentro de **48 horas**. La multa se aplicó por eso: no por el corte, sino
por no poder nombrar a nadie.

Cuando el equipo fue a buscar el registro encontró lo que había: cuántas
llamadas pasó cada entrada, cuánto tardaron y cuántas fallaron. Números de
tráfico. La identidad se comprueba en el momento y después se descarta,
porque nadie definió nunca dónde tenía que quedar escrita.

El camino de la cuadrilla es peor que el de la mesa: se agregó en 2023 y
nadie replicó lo poco que el camino viejo sí tenía.

El jefe de operaciones tiene una objeción y no es menor: cada componente que
se mete en el camino de una maniobra es un componente que puede fallar
durante una tormenta, y en una tormenta la maniobra remota es lo único que
evita mandar cuadrillas a la calle.

El equipo tiene **6 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que cualquier maniobra se pueda atribuir a una
persona 48 horas después, por los dos caminos, sin dejar a la mesa de
control sin operar.
