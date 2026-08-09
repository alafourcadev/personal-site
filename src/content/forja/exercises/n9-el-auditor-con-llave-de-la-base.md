---
title: "El auditor con llave de la base"
level: 9
role: core
domain: banca
D1: 4
D2: 3
D3: 4
D4: 2
D5: 3
D6: 2
D7: 2
D8: 3
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que explicar qué le da al auditor la copia que no le da la base, y por qué eso no es una molestia burocrática sino la diferencia entre una prueba y una consulta."
lambda: 1
constraints:
  - metric: años de movimientos que el regulador puede pedir en cualquier momento
    operator: ">="
    value: 5
    unit: años
  - metric: movimientos registrados por día hábil
    operator: ">="
    value: 260000
    unit: movimientos
hiddenFacts:
  - fact: "el auditor externo tiene desde 2018 un usuario de sólo lectura sobre la base de movimientos. Es el mismo usuario para los cuatro auditores de la firma y nadie sabe cuál de ellos lo usa."
    discoveryPath: "seguí el camino que hace hoy el auditor y fijate dónde termina. Si termina en el mismo almacenamiento donde el banco escribe, el auditor está mirando el sistema vivo, no una prueba."
  - fact: "en 2023 una consulta del auditor sobre doce meses de movimientos bloqueó la base durante nueve minutos en horario bancario. El banco perdió 3.100 operaciones."
    discoveryPath: "preguntate qué pasa cuando alguien que no controlás lanza una consulta pesada sobre el almacenamiento del que depende la operación del día."
  - fact: "el regulador no pide los movimientos: pide poder demostrar que los movimientos no cambiaron desde que ocurrieron. Una consulta contra la base viva no prueba eso, porque la base viva se puede escribir."
    discoveryPath: "es la razón por la que el ejercicio pide un archivo alimentado por el sistema y leído por el auditor, y no un permiso más fino sobre la base. Un lugar donde sólo se agrega no se parece en nada a un lugar donde se corrige."
startingDesign:
  nodes:
    - id: operador
      type: actor
      label: Operador de mesa
      zone: public
      given: true
      position: { x: 85, y: 60 }
    - id: auditor
      type: external-party
      label: Auditor externo
      zone: public
      given: true
      position: { x: 85, y: 220 }
    - id: consola
      type: web-client
      label: Consola de operaciones
      zone: public
      given: true
      position: { x: 445, y: 40 }
    - id: gwbanco
      type: api-gateway
      label: Puerta de operaciones
      zone: dmz
      given: true
      position: { x: 445, y: 150 }
    - id: gwauditor
      type: api-gateway
      label: Puerta de auditoría
      zone: dmz
      given: true
      position: { x: 445, y: 260 }
    - id: movimientos
      type: service
      label: Servicio de movimientos
      zone: private
      role: movimientos-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 370 }
    - id: consulta
      type: service
      label: Servicio de consulta de auditoría
      zone: private
      role: consulta-auditoria
      given: true
      props: { criticality: "medium", replicas: "1" }
      position: { x: 445, y: 480 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 60 }
    - id: basemovimientos
      type: database
      label: Base de movimientos
      zone: restricted
      role: base-movimientos
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 200 }
  edges:
    - id: operador-consola
      from: { node: operador }
      to: { node: consola }
      dataClass: public
    - id: consola-gwbanco
      from: { node: consola }
      to: { node: gwbanco }
      dataClass: personal
    - id: gwbanco-identidad
      from: { node: gwbanco }
      to: { node: identidad }
      dataClass: secret
    - id: gwbanco-movimientos
      from: { node: gwbanco }
      to: { node: movimientos }
      dataClass: regulated
    - id: movimientos-basemovimientos
      from: { node: movimientos }
      to: { node: basemovimientos }
      dataClass: regulated
    - id: auditor-gwauditor
      from: { node: auditor }
      to: { node: gwauditor }
      dataClass: personal
    - id: gwauditor-identidad
      from: { node: gwauditor }
      to: { node: identidad }
      dataClass: secret
    - id: gwauditor-consulta
      from: { node: gwauditor }
      to: { node: consulta }
      dataClass: personal
    - id: consulta-basemovimientos
      from: { node: consulta }
      to: { node: basemovimientos }
      dataClass: regulated
guarantees:
  - id: g-auditor-not-operational
    label: el auditor no llega al almacenamiento del que depende la operación del día
    weight: 3
    predicate:
      op: not
      of:
        - op: path
          from:
            type: [external-party]
          to:
            role: base-movimientos
    whyMissing: existe un camino desde el auditor externo hasta la base de movimientos, que es el mismo almacenamiento donde el banco escribe mientras opera.
    consequence: "una consulta de doce meses lanzada por alguien que no controlás bloquea la base en horario bancario. Ya pasó: nueve minutos, 3.100 operaciones. Y no compra nada a cambio, porque una lectura sobre un almacenamiento que se puede escribir no prueba que el movimiento no haya cambiado."
  - id: g-auditor-reads-archive
    label: el auditor llega a un archivo hecho para ser auditado
    weight: 2
    predicate:
      op: path
      from:
        type: [external-party]
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el auditor externo hasta un archivo de objetos.
    consequence: "sin un lugar propio donde leer, el auditor vuelve a pedir la llave de la base, y esta vez con razón: nadie le puede negar el acceso al dato que la ley lo obliga a revisar. El control se cae por el lado del que tiene la obligación."
  - id: g-archive-fed
    label: el archivo lo escribe el sistema, no una persona
    weight: 2
    predicate:
      op: path
      from:
        role: movimientos-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de movimientos hasta un archivo de objetos, así que el archivo que lee el auditor no lo alimenta nadie.
    consequence: "un archivo que alguien llena a mano cada trimestre es un informe, no un registro. La diferencia la nota el regulador la primera vez que pide un movimiento que quedó fuera del corte."
  - id: g-every-door
    label: las dos entradas comprueban identidad con doble factor
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad con segundo factor obligatorio.
    consequence: "el usuario del auditor lo comparten cuatro personas de la firma. Sin segundo factor no hay forma de decir cuál de las cuatro miró qué, y eso es justamente lo que la auditoría existe para poder decir."
  - id: g-operational-store
    label: el sistema de registro del banco sigue siendo la base de movimientos
    weight: 1
    predicate:
      op: path
      from:
        role: movimientos-service
      to:
        role: base-movimientos
    whyMissing: no hay un camino desde el servicio de movimientos hasta la base de movimientos.
    consequence: "el archivo de auditoría es una prueba, no un sistema de registro. Un archivo devuelve lo que se le pidió guardar; no sostiene el saldo de una cuenta en tiempo real ni resuelve una transferencia. Si desaparece la base, el banco deja de operar aunque el archivo esté completo."
rubric:
  - dimension: el que audita no toca el almacenamiento del que depende la operación
    signal:
      kind: predicate
      guaranteeId: g-auditor-not-operational
  - dimension: el auditor sigue pudiendo hacer su trabajo
    signal:
      kind: predicate
      guaranteeId: g-auditor-reads-archive
  - dimension: la prueba la genera el sistema, no una persona
    signal:
      kind: predicate
      guaranteeId: g-archive-fed
  - dimension: cada entrada identifica a la persona, no a la firma
    signal:
      kind: predicate
      guaranteeId: g-every-door
  - dimension: el banco conserva su sistema de registro
    signal:
      kind: predicate
      guaranteeId: g-operational-store
referenceSolutions:
  - label: el servicio de movimientos escribe el archivo
    contextInversion: "que el propio servicio de movimientos escriba el archivo conviene cuando el registro tiene que quedar escrito en el mismo instante en que el movimiento es válido, sin ninguna pieza en el medio que pueda quedarse atrás: lo que está en la base y lo que está en el archivo se escriben juntos o no se escribe ninguno. El costo es que quien mueve la plata es también quien escribe la prueba de que la movió, y eso es exactamente lo que un auditor estricto va a cuestionar."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de mesa
          zone: public
        - id: auditor
          type: external-party
          label: Auditor externo
          zone: public
        - id: consola
          type: web-client
          label: Consola de operaciones
          zone: public
        - id: gwbanco
          type: api-gateway
          label: Puerta de operaciones
          zone: dmz
        - id: gwauditor
          type: api-gateway
          label: Puerta de auditoría
          zone: dmz
        - id: movimientos
          type: service
          label: Servicio de movimientos
          zone: private
          role: movimientos-service
          props: { criticality: "high", replicas: "2" }
        - id: consulta
          type: service
          label: Servicio de consulta de auditoría
          zone: private
          role: consulta-auditoria
          props: { criticality: "medium", replicas: "1" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basemovimientos
          type: database
          label: Base de movimientos
          zone: restricted
          role: base-movimientos
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de movimientos para auditoría
          zone: private
      edges:
        - id: operador-consola
          from: { node: operador }
          to: { node: consola }
          dataClass: public
        - id: consola-gwbanco
          from: { node: consola }
          to: { node: gwbanco }
          dataClass: personal
        - id: gwbanco-identidad
          from: { node: gwbanco }
          to: { node: identidad }
          dataClass: secret
        - id: gwbanco-movimientos
          from: { node: gwbanco }
          to: { node: movimientos }
          dataClass: regulated
        - id: movimientos-basemovimientos
          from: { node: movimientos }
          to: { node: basemovimientos }
          dataClass: regulated
        - id: movimientos-archivo
          from: { node: movimientos }
          to: { node: archivo }
          dataClass: regulated
        - id: auditor-gwauditor
          from: { node: auditor }
          to: { node: gwauditor }
          dataClass: personal
        - id: gwauditor-identidad
          from: { node: gwauditor }
          to: { node: identidad }
          dataClass: secret
        - id: gwauditor-consulta
          from: { node: gwauditor }
          to: { node: consulta }
          dataClass: personal
        - id: consulta-archivo
          from: { node: consulta }
          to: { node: archivo }
          dataClass: regulated
  - label: un servicio de registro que es el único que escribe la prueba
    contextInversion: "separar el que registra del que opera conviene cuando la exigencia es de segregación de funciones: el equipo que despliega el servicio de movimientos no despliega el que escribe el archivo, así que un cambio en la lógica de negocio no puede cambiar en silencio qué queda registrado. Es lo que el regulador espera de un banco grande. Se paga con una pieza más para operar y con una ventana, chica pero real, entre el movimiento y su registro."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de mesa
          zone: public
        - id: auditor
          type: external-party
          label: Auditor externo
          zone: public
        - id: consola
          type: web-client
          label: Consola de operaciones
          zone: public
        - id: gwbanco
          type: api-gateway
          label: Puerta de operaciones
          zone: dmz
        - id: gwauditor
          type: api-gateway
          label: Puerta de auditoría
          zone: dmz
        - id: movimientos
          type: service
          label: Servicio de movimientos
          zone: private
          role: movimientos-service
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: service
          label: Servicio de registro de auditoría
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: consulta
          type: service
          label: Servicio de consulta de auditoría
          zone: private
          role: consulta-auditoria
          props: { criticality: "medium", replicas: "1" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basemovimientos
          type: database
          label: Base de movimientos
          zone: restricted
          role: base-movimientos
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de movimientos para auditoría
          zone: private
      edges:
        - id: operador-consola
          from: { node: operador }
          to: { node: consola }
          dataClass: public
        - id: consola-gwbanco
          from: { node: consola }
          to: { node: gwbanco }
          dataClass: personal
        - id: gwbanco-identidad
          from: { node: gwbanco }
          to: { node: identidad }
          dataClass: secret
        - id: gwbanco-movimientos
          from: { node: gwbanco }
          to: { node: movimientos }
          dataClass: regulated
        - id: movimientos-basemovimientos
          from: { node: movimientos }
          to: { node: basemovimientos }
          dataClass: regulated
        - id: movimientos-registro
          from: { node: movimientos }
          to: { node: registro }
          dataClass: regulated
        - id: registro-archivo
          from: { node: registro }
          to: { node: archivo }
          dataClass: regulated
        - id: auditor-gwauditor
          from: { node: auditor }
          to: { node: gwauditor }
          dataClass: personal
        - id: gwauditor-identidad
          from: { node: gwauditor }
          to: { node: identidad }
          dataClass: secret
        - id: gwauditor-consulta
          from: { node: gwauditor }
          to: { node: consulta }
          dataClass: personal
        - id: consulta-archivo
          from: { node: consulta }
          to: { node: archivo }
          dataClass: regulated
status: PILOT
---

Un banco registra **260.000 movimientos por día hábil**. El regulador puede
pedir cualquier movimiento de los últimos **cinco años**, y puede pedirlo un
martes a las diez de la mañana.

Desde 2018 la firma auditora tiene un usuario de sólo lectura sobre la base
de movimientos. Un usuario, cuatro auditores. Nadie sabe cuál de los cuatro
consultó qué, porque la base ve una sola cuenta.

En 2023 una consulta de doce meses lanzada desde ese usuario **bloqueó la
base durante nueve minutos** en horario bancario. Se perdieron 3.100
operaciones. La discusión que siguió terminó en un permiso más restrictivo
y en una recomendación de "consultar fuera de horario", que nadie puede
hacer cumplir.

Pero el problema real apareció en la revisión siguiente, y no es de
rendimiento. **El regulador no pide los movimientos: pide poder demostrar
que los movimientos no cambiaron desde que ocurrieron.** Una consulta contra
la base viva no demuestra eso. La base viva se escribe todo el día: lo que
el auditor ve es el estado de ahora, no la prueba de entonces.

El socio a cargo de la auditoría se opone a perder el acceso directo, y su
argumento es sólido: cualquier copia intermedia que arme el banco es una
copia que el banco controla, y él tiene la obligación legal de revisar el
dato, no una versión del dato. Alguien tiene que resolver eso sin dejarle la
llave del sistema vivo.

El equipo tiene **7 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que el auditor deje de leer el almacenamiento del
que depende la operación del día y siga pudiendo auditar. Lo que lea tiene que
haberlo escrito el sistema, no una persona.
