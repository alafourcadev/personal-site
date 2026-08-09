---
title: "La sesión que nunca caduca"
level: 9
role: core
domain: recursos-humanos
D1: 3
D2: 3
D3: 3
D4: 3
D5: 3
D6: 3
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 5
aiBudget: "libre, pero tu respuesta tiene que explicar por qué agregar un proveedor de identidad nuevo y dejar el viejo prendido no es una migración, es una entrada más."
lambda: 1
constraints:
  - metric: legajos con datos de salario y cuenta bancaria
    operator: ">="
    value: 6800
    unit: legajos
  - metric: tiempo máximo entre la baja de un empleado y el corte efectivo de su acceso
    operator: "<="
    value: 15
    unit: minutos
hiddenFacts:
  - fact: "el directorio heredado emite sesiones que no caducan mientras el navegador siga abierto. Hay sesiones vivas desde hace catorce meses."
    discoveryPath: "mirá los dos proveedores de identidad del diseño y compará qué promete cada uno. El que no rota la sesión no comprueba nada después del primer día: la sesión es la credencial."
  - fact: "la empresa compró el proveedor nuevo hace un año, migró el correo y dejó las dos consolas apuntando al viejo «hasta terminar la migración». La migración no tiene fecha."
    discoveryPath: "seguí a qué proveedor consulta cada entrada del sistema. Una migración de identidad no está terminada mientras exista una entrada que sigue preguntándole al viejo."
  - fact: "en la auditoría de junio se encontraron tres cuentas activas de personas que dejaron la empresa en 2024. Dos de ellas habían entrado a la consola de RRHH ese mismo mes."
    discoveryPath: "preguntate qué hace hoy el sistema cuando alguien se va. Si la baja se hace en un lugar y las sesiones viven en otro, la baja es un trámite administrativo, no un corte de acceso."
startingDesign:
  nodes:
    - id: empleado
      type: actor
      label: Empleado
      zone: public
      given: true
      position: { x: 85, y: 60 }
    - id: analista
      type: actor
      label: Analista de RRHH
      zone: public
      given: true
      position: { x: 85, y: 220 }
    - id: portal
      type: web-client
      label: Portal del empleado
      zone: public
      given: true
      position: { x: 445, y: 40 }
    - id: consola
      type: web-client
      label: Consola de RRHH
      zone: public
      given: true
      position: { x: 445, y: 150 }
    - id: gwempleados
      type: api-gateway
      label: Puerta del portal del empleado
      zone: dmz
      given: true
      position: { x: 445, y: 260 }
    - id: gwrrhh
      type: api-gateway
      label: Puerta de la consola de RRHH
      zone: dmz
      given: true
      position: { x: 445, y: 370 }
    - id: nomina
      type: service
      label: Servicio de nómina
      zone: private
      role: nomina-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 480 }
    - id: idpviejo
      type: identity-provider
      label: Directorio heredado
      zone: dmz
      given: true
      props: { mfa: "opcional", sessionRotation: "no" }
      position: { x: 805, y: 60 }
    - id: idpnuevo
      type: identity-provider
      label: Proveedor de identidad nuevo
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 180 }
    - id: basenomina
      type: database
      label: Base de nómina
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 320 }
  edges:
    - id: empleado-portal
      from: { node: empleado }
      to: { node: portal }
      dataClass: public
    - id: analista-consola
      from: { node: analista }
      to: { node: consola }
      dataClass: public
    - id: portal-gwempleados
      from: { node: portal }
      to: { node: gwempleados }
      dataClass: personal
    - id: consola-gwrrhh
      from: { node: consola }
      to: { node: gwrrhh }
      dataClass: personal
    - id: gwempleados-idpviejo
      from: { node: gwempleados }
      to: { node: idpviejo }
      dataClass: secret
    - id: gwrrhh-idpviejo
      from: { node: gwrrhh }
      to: { node: idpviejo }
      dataClass: secret
    - id: gwempleados-nomina
      from: { node: gwempleados }
      to: { node: nomina }
      dataClass: personal
    - id: gwrrhh-nomina
      from: { node: gwrrhh }
      to: { node: nomina }
      dataClass: regulated
    - id: nomina-basenomina
      from: { node: nomina }
      to: { node: basenomina }
      dataClass: regulated
guarantees:
  - id: g-rotating-identity
    label: todas las entradas comprueban identidad contra un proveedor que rota la sesión
    weight: 3
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { sessionRotation: "sí" }
    whyMissing: hay una entrada al sistema que no consulta a ningún proveedor de identidad que renueve la sesión periódicamente.
    consequence: "una sesión que no se renueva nunca deja de ser una credencial temporal y pasa a ser una llave permanente. Dar de baja al empleado no le saca la llave: sólo impide que pida una nueva."
  - id: g-no-stale-provider
    label: no queda ningún proveedor de identidad que mantenga la sesión viva para siempre
    weight: 2
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [identity-provider]
            propEquals: { sessionRotation: "no" }
    whyMissing: sigue existiendo en el diseño un proveedor de identidad que no renueva la sesión.
    consequence: "mientras el viejo siga prendido, alguien lo va a seguir usando: una consola que nadie migró, un script, una integración de 2019. Un proveedor de identidad apagado a medias es el proveedor por el que se entra."
  - id: g-employee-path
    label: el empleado y el analista siguen llegando a la nómina por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: nomina-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde una consola o portal hasta el servicio de nómina que pase por una entrada del sistema.
    consequence: "el día de pago no se puede posponer. Una migración de identidad que deja sin acceso al que liquida sueldos se revierte esa misma tarde, y se revierte volviendo al proveedor viejo."
  - id: g-payroll-store
    label: el legajo con salario y cuenta bancaria vive en un almacenamiento con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: nomina-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio de nómina hasta una base de datos con copia de respaldo declarada.
    consequence: un legajo laboral tiene un plazo de conservación fijado por ley. Sin copia, ese plazo es una intención del equipo, no una capacidad del sistema.
rubric:
  - dimension: ninguna entrada queda apuntando a un proveedor que no caduca sesiones
    signal:
      kind: predicate
      guaranteeId: g-rotating-identity
  - dimension: la migración de identidad termina, no queda a medias
    signal:
      kind: predicate
      guaranteeId: g-no-stale-provider
  - dimension: el negocio sigue funcionando el día de pago
    signal:
      kind: predicate
      guaranteeId: g-employee-path
  - dimension: el dato regulado queda donde se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-payroll-store
referenceSolutions:
  - label: las dos entradas migradas, el directorio viejo apagado
    contextInversion: "mantener dos entradas separadas conviene cuando los dos públicos tienen exposiciones distintas: el portal del empleado está abierto a internet y a seis mil personas, la consola de RRHH la usan nueve analistas desde la oficina. Poder aplicar límites de tasa, horarios y reglas de bloqueo distintos a cada una vale una pieza más para operar, sobre todo el día que haya que cerrar el portal público sin cortarle el acceso al equipo que liquida sueldos."
    design:
      nodes:
        - id: empleado
          type: actor
          label: Empleado
          zone: public
        - id: analista
          type: actor
          label: Analista de RRHH
          zone: public
        - id: portal
          type: web-client
          label: Portal del empleado
          zone: public
        - id: consola
          type: web-client
          label: Consola de RRHH
          zone: public
        - id: gwempleados
          type: api-gateway
          label: Puerta del portal del empleado
          zone: dmz
        - id: gwrrhh
          type: api-gateway
          label: Puerta de la consola de RRHH
          zone: dmz
        - id: nomina
          type: service
          label: Servicio de nómina
          zone: private
          role: nomina-service
          props: { criticality: "high", replicas: "2" }
        - id: idpnuevo
          type: identity-provider
          label: Proveedor de identidad nuevo
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basenomina
          type: database
          label: Base de nómina
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: empleado-portal
          from: { node: empleado }
          to: { node: portal }
          dataClass: public
        - id: analista-consola
          from: { node: analista }
          to: { node: consola }
          dataClass: public
        - id: portal-gwempleados
          from: { node: portal }
          to: { node: gwempleados }
          dataClass: personal
        - id: consola-gwrrhh
          from: { node: consola }
          to: { node: gwrrhh }
          dataClass: personal
        - id: gwempleados-idpnuevo
          from: { node: gwempleados }
          to: { node: idpnuevo }
          dataClass: secret
        - id: gwrrhh-idpnuevo
          from: { node: gwrrhh }
          to: { node: idpnuevo }
          dataClass: secret
        - id: gwempleados-nomina
          from: { node: gwempleados }
          to: { node: nomina }
          dataClass: personal
        - id: gwrrhh-nomina
          from: { node: gwrrhh }
          to: { node: nomina }
          dataClass: regulated
        - id: nomina-basenomina
          from: { node: nomina }
          to: { node: basenomina }
          dataClass: regulated
  - label: una sola entrada para los dos públicos
    contextInversion: "una entrada única conviene cuando el equipo de plataforma son tres personas y la evidencia dice que el problema no fue la configuración sino el olvido: dos entradas fueron dos oportunidades de dejar una apuntando al lugar viejo, y una de las dos quedó. Con una sola, la pregunta «¿migramos todo?» tiene una respuesta que se verifica de un vistazo, y quedan dos piezas menos para operar. Se paga con acoplamiento: el portal público y la consola interna comparten límites y ventana de mantenimiento."
    design:
      nodes:
        - id: empleado
          type: actor
          label: Empleado
          zone: public
        - id: analista
          type: actor
          label: Analista de RRHH
          zone: public
        - id: portal
          type: web-client
          label: Portal del empleado
          zone: public
        - id: consola
          type: web-client
          label: Consola de RRHH
          zone: public
        - id: gwunico
          type: api-gateway
          label: Puerta única de entrada
          zone: dmz
        - id: nomina
          type: service
          label: Servicio de nómina
          zone: private
          role: nomina-service
          props: { criticality: "high", replicas: "2" }
        - id: idpnuevo
          type: identity-provider
          label: Proveedor de identidad nuevo
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basenomina
          type: database
          label: Base de nómina
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: empleado-portal
          from: { node: empleado }
          to: { node: portal }
          dataClass: public
        - id: analista-consola
          from: { node: analista }
          to: { node: consola }
          dataClass: public
        - id: portal-gwunico
          from: { node: portal }
          to: { node: gwunico }
          dataClass: personal
        - id: consola-gwunico
          from: { node: consola }
          to: { node: gwunico }
          dataClass: personal
        - id: gwunico-idpnuevo
          from: { node: gwunico }
          to: { node: idpnuevo }
          dataClass: secret
        - id: gwunico-nomina
          from: { node: gwunico }
          to: { node: nomina }
          dataClass: regulated
        - id: nomina-basenomina
          from: { node: nomina }
          to: { node: basenomina }
          dataClass: regulated
status: PILOT
---

Una empresa de servicios con **6.800 legajos**: salario, cuenta bancaria,
descuentos, embargos. Dos formas de entrar: el portal donde el empleado ve
su recibo y la consola donde nueve analistas liquidan sueldos.

Las dos entradas preguntan quién sos. Las dos le preguntan al mismo lugar:
un directorio heredado que **emite sesiones que no caducan mientras el
navegador siga abierto**. Hay sesiones vivas desde hace catorce meses.

Hace un año la empresa compró un proveedor de identidad nuevo, con segundo
factor y rotación de sesión. Migró el correo. Las dos consolas quedaron
apuntando al viejo *«hasta terminar la migración»*. La migración no tiene
fecha.

En la auditoría de junio aparecieron **tres cuentas activas de personas que
dejaron la empresa en 2024**. Dos de ellas habían entrado a la consola de
RRHH ese mismo mes. La baja se había hecho: existe el trámite, con firma y
fecha. Lo que no había ocurrido nunca es el corte del acceso, porque la
sesión abierta no le pregunta a nadie si el empleado sigue trabajando ahí.

La política nueva exige que una baja corte el acceso en **menos de 15
minutos**. El responsable de sistemas resiste el apagado del directorio
viejo con un argumento real: no sabe qué otras cosas le preguntan, y
apagarlo un lunes puede dejar sin entrar a gente que sí trabaja ahí.

El equipo tiene **5 unidades operativas** y el diseño actual usa 6: ya está
sosteniendo una pieza más de las que puede.

**Rearmá el sistema** para que ninguna entrada dependa de un proveedor que
no caduca sesiones, y para que no quede prendido un segundo lugar por donde
entrar.
