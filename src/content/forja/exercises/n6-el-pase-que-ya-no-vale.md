---
title: "El pase que ya no vale"
level: 6
role: trap
domain: industria
D1: 3
D2: 3
D3: 2
D4: 2
D5: 2
D6: 1
D7: 3
D8: 1
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que decir qué pasa exactamente cuando alguien apoya la credencial en la puerta del área restringida y el sistema de habilitaciones no contesta, y quién se entera de eso en ese momento."
lambda: 0.5
constraints:
  - metric: accesos al área restringida por día
    operator: ">="
    value: 340
    unit: accesos/día
  - metric: minutos sin respuesta del sistema de habilitaciones en el último trimestre
    operator: ">="
    value: 190
    unit: minutos
  - metric: revocaciones de habilitación que se hacen efectivas el mismo día que se deciden
    operator: ">="
    value: 60
    unit: por ciento
hiddenFacts:
  - fact: "la copia local guarda solamente el número de credencial y un sí o un no. No guarda nombre, legajo ni motivo. Por eso pasó las revisiones de datos personales sin que nadie la discutiera."
    discoveryPath: "mirá qué viaja hacia la copia antes de discutir si la copia puede existir. Acá el problema no es qué dato guarda: es qué decisión toma con él."
  - fact: "el 60 % de las revocaciones se hacen efectivas el mismo día que se deciden, y la mitad de esas son por un incidente que acaba de ocurrir: una habilitación médica vencida esa mañana, un contratista desvinculado hace veinte minutos, una sanción de seguridad de la noche anterior."
    discoveryPath: "preguntate qué clase de dato es una habilitación. No es un valor que cambia despacio y se lee mucho: es un valor que cambia justo cuando importa, y el cambio siempre quita un permiso, nunca lo agrega."
  - fact: "en el último trimestre el sistema de habilitaciones estuvo 190 minutos sin responder, casi todos en ventanas de mantenimiento anunciadas de madrugada. En el turno noche entran 40 personas al área restringida."
    discoveryPath: "cruzá cuándo se cae la fuente con cuántos accesos hay en esa franja. La ventana de exposición no es «190 minutos»: es «190 minutos por la cantidad de gente que pasa en esos minutos»."
  - fact: "cuando la puerta no abre, el procedimiento de la planta ya existe: el operario llama al puesto de vigilancia, el supervisor de turno verifica en papel y acompaña. Tarda entre tres y seis minutos y está escrito desde 2019."
    discoveryPath: "preguntá qué hace hoy la planta cuando la puerta no abre por cualquier otro motivo. Si ya hay un procedimiento humano probado, la degradación correcta puede ser usarlo, no evitarlo."
startingDesign:
  nodes:
    - id: contratista
      type: actor
      label: Contratista
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: lector
      type: web-client
      label: Lector de la puerta
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: control
      type: service
      label: Servicio de control de acceso
      zone: private
      role: access-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: copia
      type: cache
      label: Copia local de habilitaciones
      zone: private
      given: true
      props: { ttl: "900" }
      position: { x: 805, y: 410 }
    - id: habilitaciones
      type: external-provider
      label: Sistema de habilitaciones de la planta
      zone: dmz
      role: clearance-source
      given: true
      position: { x: 445, y: 410 }
    - id: puesto
      type: external-provider
      label: Puesto de vigilancia
      zone: dmz
      role: guard-desk
      given: true
      position: { x: 445, y: 520 }
  edges:
    - id: contratista-lector
      from: { node: contratista }
      to: { node: lector }
      dataClass: public
    - id: lector-gw
      from: { node: lector }
      to: { node: gw }
      dataClass: public
    - id: gw-control
      from: { node: gw }
      to: { node: control }
      dataClass: public
    - id: control-copia
      from: { node: control }
      to: { node: copia }
      dataClass: public
    - id: control-habilitaciones
      from: { node: control }
      to: { node: habilitaciones }
      dataClass: personal
guarantees:
  - id: g-sin-copia-en-la-decision
    label: ninguna pieza del control de acceso decide con una copia
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        type: [cache]
    whyMissing: hay una pieza del control de acceso que lee una copia de habilitaciones. Mientras exista ese camino, en algún momento la puerta va a abrir por lo que la copia recuerda, y va a ser exactamente cuando el sistema de habilitaciones no conteste.
    consequence: "una habilitación revocada hace veinte minutos abre la puerta igual. El 60 % de las revocaciones se hacen efectivas el mismo día que se deciden, y la mitad de esas son por un incidente que acaba de ocurrir: son justo las que la copia todavía no sabe."
  - id: g-fuente-en-el-momento
    label: la habilitación se le pregunta al sistema de habilitaciones en el momento del acceso
    weight: 2
    predicate:
      op: path
      from:
        role: access-service
      to:
        role: clearance-source
    whyMissing: no hay ningún camino desde el servicio de control de acceso hasta el sistema de habilitaciones. Sin la fuente, la puerta decide con lo que tenga a mano, y lo que tiene a mano no es la habilitación vigente.
    consequence: la planta no puede demostrarle a nadie, ni al auditor de seguridad ni al gremio, con qué información abrió esa puerta. Un registro de acceso que no puede decir contra qué se validó no es evidencia de nada.
  - id: g-vigilancia-se-entera
    label: cuando la puerta no abre, el puesto de vigilancia se entera en el momento
    weight: 1
    predicate:
      op: path
      from:
        role: access-service
      to:
        role: guard-desk
    whyMissing: el servicio de control de acceso no llega al puesto de vigilancia. Cuando la puerta no abre, el sistema no le avisa a nadie.
    consequence: "el operario se queda golpeando una puerta y el supervisor se entera cuando alguien camina hasta la garita. La degradación correcta acá es humana y ya está escrita desde 2019, tres a seis minutos con acompañamiento, pero sólo arranca si alguien la dispara."
rubric:
  - dimension: reconocer cuándo el dato viejo no es una versión peor sino una versión falsa
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-en-la-decision
  - dimension: la decisión que abre una puerta sale de la fuente, no de un recuerdo
    signal:
      kind: predicate
      guaranteeId: g-fuente-en-el-momento
  - dimension: degradar es cambiar de camino, no quedarse sin ninguno
    signal:
      kind: predicate
      guaranteeId: g-vigilancia-se-entera
referenceSolutions:
  - label: la puerta pregunta siempre, y el intento queda en una base consultable
    contextInversion: "guardar los intentos en una base conviene cuando lo que la planta necesita después es responder preguntas: quién quiso entrar, a qué hora, con qué credencial y por qué no pudo. Después de un incidente de seguridad esa consulta se hace en minutos y con las herramientas que el equipo ya tiene. El aviso al puesto de vigilancia sale del mismo servicio que decide, así que no hay ninguna pieza intermedia que pueda demorarlo. El costo es una base más para respaldar y para retener, con dato personal adentro y todo lo que eso arrastra."
    design:
      nodes:
        - id: contratista
          type: actor
          label: Contratista
          zone: public
        - id: lector
          type: web-client
          label: Lector de la puerta
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: control
          type: service
          label: Servicio de control de acceso
          zone: private
          role: access-service
          props: { criticality: "high", replicas: "2" }
        - id: intentos
          type: database
          label: Base de intentos de acceso
          zone: restricted
          props: { backup: "diario" }
        - id: habilitaciones
          type: external-provider
          label: Sistema de habilitaciones de la planta
          zone: dmz
          role: clearance-source
        - id: puesto
          type: external-provider
          label: Puesto de vigilancia
          zone: dmz
          role: guard-desk
      edges:
        - id: contratista-lector
          from: { node: contratista }
          to: { node: lector }
          dataClass: public
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-control
          from: { node: gw }
          to: { node: control }
          dataClass: public
        - id: control-habilitaciones
          from: { node: control }
          to: { node: habilitaciones }
          dataClass: personal
        - id: control-intentos
          from: { node: control }
          to: { node: intentos }
          dataClass: personal
        - id: control-puesto
          from: { node: control }
          to: { node: puesto }
          dataClass: personal
  - label: la puerta pregunta siempre, y el tablero de operación mira la tasa de rechazos
    contextInversion: "un archivo de eventos con un tablero encima conviene cuando lo que importa no es el intento suelto sino la forma de la curva: si la tasa de puertas que no abren se dispara a las 3 de la mañana, el problema no es una credencial, es el sistema de habilitaciones, y esa diferencia se ve en un gráfico y no en una tabla. Además el archivo de eventos no suma carga operativa. Se paga con una pieza de observación que hay que configurar y atender de verdad, porque un tablero que nadie mira es una unidad operativa tirada, y con un registro que no se consulta por credencial sin exportarlo primero."
    design:
      nodes:
        - id: contratista
          type: actor
          label: Contratista
          zone: public
        - id: lector
          type: web-client
          label: Lector de la puerta
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: control
          type: service
          label: Servicio de control de acceso
          zone: private
          role: access-service
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: object-storage
          label: Archivo de eventos de puerta
          zone: private
        - id: tablero
          type: observability
          label: Tablero de operación de accesos
          zone: private
        - id: habilitaciones
          type: external-provider
          label: Sistema de habilitaciones de la planta
          zone: dmz
          role: clearance-source
        - id: puesto
          type: external-provider
          label: Puesto de vigilancia
          zone: dmz
          role: guard-desk
      edges:
        - id: contratista-lector
          from: { node: contratista }
          to: { node: lector }
          dataClass: public
        - id: lector-gw
          from: { node: lector }
          to: { node: gw }
          dataClass: public
        - id: gw-control
          from: { node: gw }
          to: { node: control }
          dataClass: public
        - id: control-habilitaciones
          from: { node: control }
          to: { node: habilitaciones }
          dataClass: personal
        - id: control-registro
          from: { node: control }
          to: { node: registro }
          dataClass: personal
        - id: control-tablero
          from: { node: control }
          to: { node: tablero }
          dataClass: public
        - id: control-puesto
          from: { node: control }
          to: { node: puesto }
          dataClass: personal
status: PILOT
---

Una planta con un área restringida (reactores, tableros de media tensión,
depósito de reactivos) por la que pasan **340 accesos por día**. El contratista
apoya la credencial en el lector, el servicio de control de acceso le pregunta al
sistema de habilitaciones si esa persona puede entrar, y la puerta abre o no
abre.

En el último trimestre el sistema de habilitaciones estuvo **190 minutos** sin
responder, casi todos en ventanas de mantenimiento de madrugada. En esos minutos
la puerta no abría para nadie, y en el turno noche entran 40 personas.

El equipo ya sabe qué hacer con esto. Lo aprendió en los cinco ejercicios
anteriores: **si la fuente no contesta, servís lo último que conocés**. Pusieron
una copia local de habilitaciones con quince minutos de vida, la puerta dejó de
trabarse de madrugada, y el indicador de disponibilidad del control de acceso
pasó de 99,1 % a 99,97 %.

La copia guarda apenas el número de credencial y un sí o un no. Sin nombre, sin
legajo, sin motivo: pasó la revisión de datos personales sin que nadie la
discutiera.

Ahora el número que nadie miró: **el 60 %** de las revocaciones de habilitación
se hacen efectivas **el mismo día** en que se deciden. Y la mitad de esas son por
algo que acaba de pasar: una habilitación médica que venció esa mañana, un
contratista desvinculado hace veinte minutos, una sanción de seguridad de la
noche anterior.

Una habilitación no es un dato que cambia despacio y se lee mucho. Es un dato que
cambia **justo cuando importa**, y cuyo cambio siempre quita un permiso, nunca lo
agrega. La copia de hace quince minutos no está un poco desactualizada: está
diciendo que sí donde la fuente ya dice que no.

Y hay algo más, que estaba desde antes: cuando la puerta no abre, la planta ya
tiene un procedimiento. El operario llama al puesto de vigilancia, el supervisor
de turno verifica en papel y lo acompaña. Tarda entre tres y seis minutos y está
escrito desde 2019. Hoy nadie lo dispara, porque el sistema no le avisa a nadie:
el operario se queda golpeando la puerta hasta que alguien camina hasta la
garita.

El jefe de seguridad industrial lo dice de una manera que no deja lugar: *"Que la
puerta no abra es un problema de tres minutos. Que abra para alguien que no
puede entrar es un problema que se cuenta en un informe con nombres."*

El equipo tiene **5 unidades operativas** y hoy usa 3.

**Rearmá el control de acceso** para que la decisión de abrir salga siempre del
sistema de habilitaciones, para que ninguna pieza la tome desde una copia, y para
que cuando la puerta no abra el puesto de vigilancia se entere en ese momento y
no cuando alguien llegue caminando.
