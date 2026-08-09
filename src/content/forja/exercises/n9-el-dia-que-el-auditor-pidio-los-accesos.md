---
title: "El día que el auditor pidió los accesos"
level: 9
role: synthesis
domain: fintech
D1: 3
D2: 4
D3: 4
D4: 2
D5: 4
D6: 3
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que sostener cuatro cosas al mismo tiempo: quién entra, con qué segundo factor, qué sale hacia afuera y qué queda registrado. Si una de las cuatro se cae, el resto no compensa."
lambda: 1
constraints:
  - metric: comercios adheridos que cobran por la plataforma
    operator: ">="
    value: 5600
    unit: comercios
  - metric: años de registros de acceso que la certificación exige conservar
    operator: ">="
    value: 2
    unit: años
  - metric: tiempo máximo entre revocar una credencial y el corte efectivo
    operator: "<="
    value: 60
    unit: segundos
hiddenFacts:
  - fact: "el directorio heredado emite sesiones que no caducan y permite el segundo factor como opción. El 62 % de los comercios nunca lo activó."
    discoveryPath: "compará los dos proveedores de identidad del diseño. El que deja el segundo factor como opción está midiendo la seguridad del comercio más distraído, no la del más cuidadoso."
  - fact: "el servicio de pagos le manda al procesador de tarjetas el registro completo de la operación, con el documento del comprador. El procesador necesita el número de tarjeta y el monto."
    discoveryPath: "seguí qué sale del sistema hacia el único componente que está afuera de la organización, y preguntate qué necesita realmente ese componente para hacer su trabajo."
  - fact: "la certificación exige poder mostrar quién accedió a un dato de tarjeta en los últimos dos años. Hoy eso vive en los registros del servicio de pagos, que rotan cada 30 días."
    discoveryPath: "preguntate de dónde sale la lista si te la piden mañana por una operación de hace catorce meses. Un registro que rota es un registro que existe hasta que hace falta."
  - fact: "el equipo tiene seis unidades operativas y el diseño de hoy usa exactamente seis. Cualquier pieza nueva entra sacando otra."
    discoveryPath: "contá lo que hay antes de agregar nada. La pieza más fácil de sacar es la que el ejercicio ya te está pidiendo apagar."
startingDesign:
  nodes:
    - id: usuario
      type: actor
      label: Comprador
      zone: public
      given: true
      position: { x: 85, y: 60 }
    - id: comercio
      type: external-party
      label: Comercio adherido
      zone: public
      given: true
      position: { x: 85, y: 220 }
    - id: app
      type: mobile-client
      label: App de pagos
      zone: public
      given: true
      position: { x: 445, y: 40 }
    - id: gwpublico
      type: api-gateway
      label: Puerta de la app
      zone: dmz
      given: true
      position: { x: 445, y: 150 }
    - id: gwcomercios
      type: api-gateway
      label: Puerta de comercios
      zone: dmz
      given: true
      position: { x: 445, y: 260 }
    - id: pagos
      type: service
      label: Servicio de pagos
      zone: private
      role: pagos-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 370 }
    - id: procesador
      type: external-provider
      label: Procesador de tarjetas
      zone: dmz
      given: true
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
      label: Proveedor de identidad con doble factor
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 180 }
    - id: basepagos
      type: database
      label: Base de operaciones
      zone: restricted
      role: base-pagos
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 320 }
  edges:
    - id: usuario-app
      from: { node: usuario }
      to: { node: app }
      dataClass: public
    - id: app-gwpublico
      from: { node: app }
      to: { node: gwpublico }
      dataClass: personal
    - id: gwpublico-idpviejo
      from: { node: gwpublico }
      to: { node: idpviejo }
      dataClass: secret
    - id: gwpublico-pagos
      from: { node: gwpublico }
      to: { node: pagos }
      dataClass: regulated
    - id: comercio-gwcomercios
      from: { node: comercio }
      to: { node: gwcomercios }
      dataClass: personal
    - id: gwcomercios-idpviejo
      from: { node: gwcomercios }
      to: { node: idpviejo }
      dataClass: secret
    - id: gwcomercios-pagos
      from: { node: gwcomercios }
      to: { node: pagos }
      dataClass: regulated
    - id: pagos-basepagos
      from: { node: pagos }
      to: { node: basepagos }
      dataClass: regulated
    - id: pagos-procesador
      from: { node: pagos }
      to: { node: procesador }
      dataClass: personal
guarantees:
  - id: g-strong-doors
    label: todas las entradas comprueban identidad con segundo factor obligatorio
    weight: 3
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad que exige segundo factor.
    consequence: "el 62 % de los comercios nunca activó el segundo factor opcional. Dejarlo opcional no es dar libertad: es fijar la seguridad de la plataforma en el nivel del comercio más distraído, y la plataforma responde por todos."
  - id: g-no-weak-provider
    label: no queda prendido ningún proveedor de identidad sin segundo factor
    weight: 2
    predicate:
      op: not
      of:
        - op: exists
          node:
            type: [identity-provider]
            propEquals: { mfa: "opcional" }
    whyMissing: sigue existiendo en el diseño un proveedor de identidad que trata el segundo factor como opción.
    consequence: "un proveedor de identidad que queda prendido «por las dudas» es una entrada más, y es la que alguien va a seguir usando. Una migración de identidad a medias deja el agujero viejo y suma la complejidad del nuevo."
  - id: g-merchant-path
    label: el comercio sigue cobrando, y entra por una puerta del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [external-party]
      to:
        role: pagos-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el comercio adherido hasta el servicio de pagos que pase por una entrada del sistema.
    consequence: "5.600 comercios dejan de poder cobrar. Un control de acceso que apaga el negocio se revierte el mismo día, y se revierte volviendo exactamente al estado que este ejercicio quiere corregir."
  - id: g-no-direct-card-export
    label: el servicio que tiene la operación completa no le habla directo al procesador
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: pagos-service
      to:
        type: [external-provider]
    whyMissing: hay una conexión directa entre el servicio de pagos y el procesador externo, y por ahí sale todo lo que el servicio de pagos tiene.
    consequence: "el procesador necesita el número de tarjeta y el monto. Hoy recibe además el documento del comprador, porque el que arma el mensaje es el mismo que tiene el registro completo delante. Lo que sale no vuelve, y hay que poder justificar cada campo."
  - id: g-still-charges
    label: el cobro sigue llegando al procesador
    weight: 2
    predicate:
      op: path
      from:
        role: pagos-service
      to:
        type: [external-provider]
    whyMissing: no hay ningún camino desde el servicio de pagos hasta el procesador de tarjetas.
    consequence: "sin camino al procesador no hay cobro. Recortar lo que sale es el objetivo; cortar la salida es apagar la plataforma."
  - id: g-access-archive
    label: queda un archivo de accesos que sobrevive a la rotación de registros
    weight: 2
    predicate:
      op: path
      from:
        role: pagos-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de pagos hasta un archivo de objetos donde el registro de accesos quede guardado.
    consequence: "la certificación pide dos años de accesos y los registros del servicio rotan cada 30 días. El día que pidan una operación de hace catorce meses, la respuesta va a ser que existió pero no se puede probar quién la miró."
  - id: g-regulated-store
    label: la operación sigue viviendo en la base con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: pagos-service
      to:
        role: base-pagos
    whyMissing: no hay un camino desde el servicio de pagos hasta la base de operaciones.
    consequence: "el archivo de accesos es una prueba, no un sistema de registro. Un archivo devuelve lo que se le pidió guardar; no resuelve un saldo ni una devolución. Si desaparece la base, la plataforma deja de operar aunque el archivo esté completo."
rubric:
  - dimension: todas las entradas exigen segundo factor
    signal:
      kind: predicate
      guaranteeId: g-strong-doors
  - dimension: la migración de identidad termina y no deja una puerta vieja
    signal:
      kind: predicate
      guaranteeId: g-no-weak-provider
  - dimension: lo que sale hacia afuera no lo arma el que tiene todo
    signal:
      kind: predicate
      guaranteeId: g-no-direct-card-export
  - dimension: el negocio sigue cobrando después del cambio
    signal:
      kind: predicate
      guaranteeId: g-still-charges
  - dimension: hay una prueba de accesos que dura lo que la certificación pide
    signal:
      kind: predicate
      guaranteeId: g-access-archive
  - dimension: el sistema de registro sigue siendo la base de operaciones
    signal:
      kind: predicate
      guaranteeId: g-regulated-store
referenceSolutions:
  - label: dos puertas y un servicio que arma lo que sale
    contextInversion: "mantener las dos entradas y poner un componente sincrónico entre el pago y el procesador conviene cuando el cobro tiene que confirmarse en el momento, porque el comprador está mirando la pantalla, y cuando los dos públicos tienen contratos distintos: la app pública y los 5.600 comercios no comparten límites de tasa ni ventana de mantenimiento. El componente del medio es además el único lugar donde está escrito qué campos salen, y eso es lo que se le muestra al certificador. El costo es que si el procesador se pone lento, el comprador espera, y que la pieza nueva entra sacando otra."
    design:
      nodes:
        - id: usuario
          type: actor
          label: Comprador
          zone: public
        - id: comercio
          type: external-party
          label: Comercio adherido
          zone: public
        - id: app
          type: mobile-client
          label: App de pagos
          zone: public
        - id: gwpublico
          type: api-gateway
          label: Puerta de la app
          zone: dmz
        - id: gwcomercios
          type: api-gateway
          label: Puerta de comercios
          zone: dmz
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: pagos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: tokenizador
          type: service
          label: Servicio de tokenización
          zone: private
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: procesador
          type: external-provider
          label: Procesador de tarjetas
          zone: dmz
        - id: idpnuevo
          type: identity-provider
          label: Proveedor de identidad con doble factor
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basepagos
          type: database
          label: Base de operaciones
          zone: restricted
          role: base-pagos
          props: { backup: "diario" }
        - id: archivoaccesos
          type: object-storage
          label: Archivo de accesos
          zone: private
      edges:
        - id: usuario-app
          from: { node: usuario }
          to: { node: app }
          dataClass: public
        - id: app-gwpublico
          from: { node: app }
          to: { node: gwpublico }
          dataClass: personal
        - id: gwpublico-idpnuevo
          from: { node: gwpublico }
          to: { node: idpnuevo }
          dataClass: secret
        - id: gwpublico-pagos
          from: { node: gwpublico }
          to: { node: pagos }
          dataClass: regulated
        - id: comercio-gwcomercios
          from: { node: comercio }
          to: { node: gwcomercios }
          dataClass: personal
        - id: gwcomercios-idpnuevo
          from: { node: gwcomercios }
          to: { node: idpnuevo }
          dataClass: secret
        - id: gwcomercios-pagos
          from: { node: gwcomercios }
          to: { node: pagos }
          dataClass: regulated
        - id: pagos-basepagos
          from: { node: pagos }
          to: { node: basepagos }
          dataClass: regulated
        - id: pagos-tokenizador
          from: { node: pagos }
          to: { node: tokenizador }
          dataClass: regulated
        - id: tokenizador-procesador
          from: { node: tokenizador }
          to: { node: procesador }
          dataClass: personal
        - id: pagos-archivoaccesos
          from: { node: pagos }
          to: { node: archivoaccesos }
          dataClass: regulated
  - label: una puerta única y un liquidador que sale por detrás
    contextInversion: "una sola entrada y un camino asincrónico hacia el procesador conviene cuando el cobro se confirma después, porque el comercio acepta la operación y la liquidación corre en la madrugada, y cuando el equipo prefiere una superficie de entrada chica: una puerta es un solo lugar donde comprobar identidad y un solo registro de accesos que mostrar. El trabajo que sale hacia afuera no lleva sesión de nadie, reintenta lo que el procesador rechazó y deja el pendiente a la vista. Se paga con latencia real en la liquidación y con la pérdida del aislamiento entre los dos públicos: un pico de comercios se siente en la app."
    design:
      nodes:
        - id: usuario
          type: actor
          label: Comprador
          zone: public
        - id: comercio
          type: external-party
          label: Comercio adherido
          zone: public
        - id: app
          type: mobile-client
          label: App de pagos
          zone: public
        - id: gwunico
          type: api-gateway
          label: Puerta única de entrada
          zone: dmz
        - id: pagos
          type: service
          label: Servicio de pagos
          zone: private
          role: pagos-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: colaliquidacion
          type: queue
          label: Cola de liquidaciones
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: liquidador
          type: worker
          label: Liquidador
          zone: private
        - id: procesador
          type: external-provider
          label: Procesador de tarjetas
          zone: dmz
        - id: idpnuevo
          type: identity-provider
          label: Proveedor de identidad con doble factor
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basepagos
          type: database
          label: Base de operaciones
          zone: restricted
          role: base-pagos
          props: { backup: "diario" }
        - id: archivoaccesos
          type: object-storage
          label: Archivo de accesos
          zone: private
      edges:
        - id: usuario-app
          from: { node: usuario }
          to: { node: app }
          dataClass: public
        - id: app-gwunico
          from: { node: app }
          to: { node: gwunico }
          dataClass: personal
        - id: comercio-gwunico
          from: { node: comercio }
          to: { node: gwunico }
          dataClass: personal
        - id: gwunico-idpnuevo
          from: { node: gwunico }
          to: { node: idpnuevo }
          dataClass: secret
        - id: gwunico-pagos
          from: { node: gwunico }
          to: { node: pagos }
          dataClass: regulated
        - id: pagos-basepagos
          from: { node: pagos }
          to: { node: basepagos }
          dataClass: regulated
        - id: pagos-colaliquidacion
          from: { node: pagos }
          to: { node: colaliquidacion }
          dataClass: regulated
        - id: colaliquidacion-liquidador
          from: { node: colaliquidacion }
          to: { node: liquidador }
          dataClass: regulated
        - id: liquidador-procesador
          from: { node: liquidador }
          to: { node: procesador }
          dataClass: personal
        - id: liquidador-archivoaccesos
          from: { node: liquidador }
          to: { node: archivoaccesos }
          dataClass: regulated
status: PILOT
---

Una plataforma de pagos con **5.600 comercios adheridos**. La certificación
anual llega en once semanas y el auditor mandó por adelantado tres preguntas.
Las tres se responden con el mismo diagrama.

**La primera: ¿cómo entran los comercios?** Por una puerta que le pregunta a
un directorio heredado, donde el segundo factor es opcional. El 62 % de los
comercios nunca lo activó. Esa misma puerta emite sesiones que no caducan.
La plataforma compró un proveedor nuevo, con segundo factor obligatorio y
rotación de sesión, y lo dejó conectado a nada.

**La segunda: ¿qué sale de la plataforma hacia el procesador de tarjetas?**
El procesador necesita el número de tarjeta y el monto. Recibe el registro
completo de la operación, con el documento del comprador, porque el mensaje
lo arma el mismo servicio que tiene todo delante.

**La tercera: ¿quién accedió a un dato de tarjeta en los últimos dos años?**
La certificación exige dos años. Los registros del servicio de pagos rotan
cada 30 días. Para una operación de hace catorce meses, la plataforma puede
demostrar que ocurrió, pero no quién la miró.

El equipo de negocio pone una condición y es razonable: **nada de esto puede
dejar de cobrar**. Ya hubo un intento de endurecer el acceso de comercios en
2024 que se revirtió a las cuarenta y ocho horas, y volvió todo al estado
que este ejercicio tiene que corregir.

Y hay un límite que no se negocia: el equipo tiene **6 unidades operativas y
el diseño de hoy usa exactamente 6**. Cualquier pieza nueva entra sacando
otra.

**Rearmá el sistema** para responder las tres preguntas del auditor al mismo
tiempo: que ninguna entrada acepte identidad sin segundo factor, que lo que
sale hacia afuera no lo arme el componente que tiene el registro completo, y
que quede un archivo de accesos que dure lo que la certificación pide, sin
apagar el cobro y sin pasarte del presupuesto.
