---
title: "Los diez años que la base no guarda"
level: 9
role: counter-trap
domain: retail
D1: 3
D2: 3
D3: 3
D4: 3
D5: 3
D6: 2
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir qué obligación corre en este caso, borrar o conservar, y por qué esa sola pregunta invierte cuál es la respuesta correcta."
lambda: 0.75
constraints:
  - metric: años que la ley fiscal obliga a conservar cada comprobante emitido
    operator: ">="
    value: 10
    unit: años
  - metric: meses de comprobantes que la base de facturación conserva hoy
    operator: "<="
    value: 18
    unit: meses
hiddenFacts:
  - fact: "la base de facturación se purga a los 18 meses. La purga la puso el equipo de plataforma en 2021 porque la tabla de comprobantes había pasado los 400 millones de filas y los cierres mensuales tardaban seis horas. Nadie lo cruzó con la obligación fiscal de diez años."
    discoveryPath: "compará el plazo que exige la norma con el plazo que sostiene el almacenamiento. Si el segundo es más corto, el sistema ya está incumpliendo aunque nada se haya roto todavía."
  - fact: "la base de facturación se corrige todos los días: notas de crédito, anulaciones, reprocesos de lotes que fallaron. Un comprobante consultado hoy puede no ser byte a byte el que se emitió."
    discoveryPath: "preguntate qué puede cambiar en el lugar donde el inspector está mirando. Si ese lugar se escribe todos los días, lo que ve es el estado actual, no el comprobante que se emitió."
  - fact: "el inspector no viene a leer comprobantes: viene a comprobar que el comprobante que la empresa exhibe es el mismo que se emitió. Una consulta contra un almacenamiento que se puede escribir nunca prueba eso, por muy restringido que esté el permiso."
    discoveryPath: "separá las dos preguntas: quién puede leer, y qué prueba lo que lee. Endurecer el permiso responde la primera y no toca la segunda."
startingDesign:
  nodes:
    - id: cliente
      type: actor
      label: Cliente
      zone: public
      given: true
      position: { x: 85, y: 60 }
    - id: inspector
      type: external-party
      label: Inspector fiscal
      zone: public
      given: true
      position: { x: 85, y: 380 }
    - id: tienda
      type: web-client
      label: Tienda en línea
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: gwtienda
      type: api-gateway
      label: Puerta de la tienda
      zone: dmz
      given: true
      position: { x: 445, y: 170 }
    - id: gwfisco
      type: api-gateway
      label: Puerta de inspección
      zone: dmz
      given: true
      position: { x: 445, y: 390 }
    - id: facturacion
      type: service
      label: Servicio de facturación
      zone: private
      role: facturacion-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 280 }
    - id: consulta
      type: service
      label: Servicio de consulta fiscal
      zone: private
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 500 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad de la cadena
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 40 }
    - id: basefacturas
      type: database
      label: Base de facturación
      zone: restricted
      role: base-facturas
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 260 }
  edges:
    - id: cliente-tienda
      from: { node: cliente }
      to: { node: tienda }
      dataClass: public
    - id: tienda-gwtienda
      from: { node: tienda }
      to: { node: gwtienda }
      dataClass: personal
    - id: gwtienda-identidad
      from: { node: gwtienda }
      to: { node: identidad }
      dataClass: secret
    - id: gwtienda-facturacion
      from: { node: gwtienda }
      to: { node: facturacion }
      dataClass: personal
    - id: facturacion-basefacturas
      from: { node: facturacion }
      to: { node: basefacturas }
      dataClass: regulated
    - id: inspector-gwfisco
      from: { node: inspector }
      to: { node: gwfisco }
      dataClass: personal
    - id: gwfisco-identidad
      from: { node: gwfisco }
      to: { node: identidad }
      dataClass: secret
    - id: gwfisco-consulta
      from: { node: gwfisco }
      to: { node: consulta }
      dataClass: personal
    - id: consulta-basefacturas
      from: { node: consulta }
      to: { node: basefacturas }
      dataClass: regulated
guarantees:
  - id: g-archive-fed-by-system
    label: existe un archivo de comprobantes y lo escribe el sistema
    weight: 3
    predicate:
      op: path
      from:
        role: facturacion-service
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el servicio de facturación hasta un archivo de objetos, así que no existe ninguna copia de los comprobantes fuera del almacenamiento que se purga a los 18 meses.
    consequence: "la ley fiscal obliga a conservar diez años y la base de facturación conserva dieciocho meses. La empresa ya está incumpliendo aunque nada se haya roto: el incumplimiento aparece el día que el inspector pide un comprobante de 2019 y la respuesta es que la fila no existe. Un archivo que sólo se agrega es el único almacenamiento donde ese plazo se sostiene sin frenar los cierres mensuales."
  - id: g-inspector-reads-archive
    label: el inspector llega al archivo de comprobantes
    weight: 2
    predicate:
      op: path
      from:
        type: [external-party]
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde el inspector fiscal hasta un archivo de objetos.
    consequence: "un archivo que nadie de afuera puede leer obliga a que alguien de la empresa lo abra, lo filtre y lo entregue. Eso convierte la prueba en un informe hecho por la parte interesada, que es exactamente lo que la inspección existe para no aceptar."
  - id: g-inspector-not-live
    label: el inspector no llega al almacenamiento que la empresa corrige todos los días
    weight: 2
    predicate:
      op: not
      of:
        - op: path
          from:
            type: [external-party]
          to:
            role: base-facturas
    whyMissing: existe un camino desde el inspector fiscal hasta la base de facturación, que es el mismo almacenamiento donde la empresa emite, anula y reprocesa.
    consequence: "el inspector no viene a leer comprobantes: viene a comprobar que el comprobante exhibido es el que se emitió. La base se corrige todos los días (notas de crédito, anulaciones, reprocesos), así que lo que él ve es el estado de ahora. Por muy restringido que esté el permiso, una lectura sobre un almacenamiento que se puede escribir no prueba nada."
  - id: g-live-store
    label: la facturación del día sigue viviendo en la base
    weight: 1
    predicate:
      op: path
      from:
        role: facturacion-service
      to:
        role: base-facturas
    whyMissing: no hay un camino desde el servicio de facturación hasta la base de facturación.
    consequence: "el archivo es una prueba, no un sistema operativo. Un archivo devuelve lo que se le pidió guardar; no resuelve una nota de crédito, no sostiene el cierre mensual y no responde cuánto se facturó hoy. Si desaparece la base, la cadena deja de facturar aunque el archivo esté completo."
  - id: g-store-keeps-selling
    label: el cliente sigue comprando por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: facturacion-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde la tienda en línea hasta el servicio de facturación que pase por una entrada del sistema.
    consequence: "el comprobante que hay que archivar diez años nace de una venta. Un diseño que resuelve la conservación y deja la tienda sin poder emitir no tiene nada que conservar: la obligación fiscal se cumple sola el día que la empresa deja de facturar, y eso no es cumplir."
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
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad de la cadena con segundo factor obligatorio.
    consequence: "una inspección deja rastro de qué se le mostró a quién, y ese rastro es lo primero que se revisa cuando dos inspecciones no coinciden. Una entrada que no identifica hace imposible responder cuál de los inspectores vio qué."
rubric:
  - dimension: existe una copia que cubre el plazo legal
    signal:
      kind: predicate
      guaranteeId: g-archive-fed-by-system
  - dimension: el inspector puede leer sin intermediarios humanos
    signal:
      kind: predicate
      guaranteeId: g-inspector-reads-archive
  - dimension: lo que se exhibe no es el almacenamiento que se corrige
    signal:
      kind: predicate
      guaranteeId: g-inspector-not-live
  - dimension: la cadena sigue facturando
    signal:
      kind: predicate
      guaranteeId: g-live-store
  - dimension: la tienda sigue vendiendo
    signal:
      kind: predicate
      guaranteeId: g-store-keeps-selling
  - dimension: ninguna entrada queda sin comprobar identidad
    signal:
      kind: predicate
      guaranteeId: g-doors-identity
referenceSolutions:
  - label: el servicio de facturación escribe el archivo
    contextInversion: "que el propio servicio de facturación escriba el comprobante en el archivo conviene cuando lo que hay que poder afirmar es que el comprobante quedó archivado en el mismo instante en que fue válido: no hay ninguna pieza en el medio que pueda quedarse atrás, y lo que está en la base y lo que está en el archivo se escriben en el mismo acto. Es el diseño con menos partes y el más fácil de explicar delante de una inspección. El costo es que el que emite es también el que archiva, y un cambio en la lógica de emisión puede cambiar en silencio qué queda archivado."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: inspector
          type: external-party
          label: Inspector fiscal
          zone: public
        - id: tienda
          type: web-client
          label: Tienda en línea
          zone: public
        - id: gwtienda
          type: api-gateway
          label: Puerta de la tienda
          zone: dmz
        - id: gwfisco
          type: api-gateway
          label: Puerta de inspección
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: facturacion-service
          props: { criticality: "high", replicas: "2" }
        - id: consulta
          type: service
          label: Servicio de consulta fiscal
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la cadena
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basefacturas
          type: database
          label: Base de facturación
          zone: restricted
          role: base-facturas
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de comprobantes emitidos
          zone: private
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gwtienda
          from: { node: tienda }
          to: { node: gwtienda }
          dataClass: personal
        - id: gwtienda-identidad
          from: { node: gwtienda }
          to: { node: identidad }
          dataClass: secret
        - id: gwtienda-facturacion
          from: { node: gwtienda }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-basefacturas
          from: { node: facturacion }
          to: { node: basefacturas }
          dataClass: regulated
        - id: facturacion-archivo
          from: { node: facturacion }
          to: { node: archivo }
          dataClass: regulated
        - id: inspector-gwfisco
          from: { node: inspector }
          to: { node: gwfisco }
          dataClass: personal
        - id: gwfisco-identidad
          from: { node: gwfisco }
          to: { node: identidad }
          dataClass: secret
        - id: gwfisco-consulta
          from: { node: gwfisco }
          to: { node: consulta }
          dataClass: personal
        - id: consulta-archivo
          from: { node: consulta }
          to: { node: archivo }
          dataClass: regulated
  - label: un servicio de archivo que es el único que escribe la prueba
    contextInversion: "separar el que emite del que archiva conviene cuando la exigencia es de segregación de funciones: el equipo que despliega la lógica de facturación no despliega el que escribe el archivo, así que un cambio en cómo se emite un comprobante no puede cambiar en silencio qué queda guardado como prueba. Es lo que una auditoría externa espera de una cadena con diez años de obligación. Se paga con una pieza más para operar y con una ventana, chica pero real, entre la emisión y su archivado."
    design:
      nodes:
        - id: cliente
          type: actor
          label: Cliente
          zone: public
        - id: inspector
          type: external-party
          label: Inspector fiscal
          zone: public
        - id: tienda
          type: web-client
          label: Tienda en línea
          zone: public
        - id: gwtienda
          type: api-gateway
          label: Puerta de la tienda
          zone: dmz
        - id: gwfisco
          type: api-gateway
          label: Puerta de inspección
          zone: dmz
        - id: facturacion
          type: service
          label: Servicio de facturación
          zone: private
          role: facturacion-service
          props: { criticality: "high", replicas: "2" }
        - id: archivador
          type: service
          label: Servicio de archivo de comprobantes
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: consulta
          type: service
          label: Servicio de consulta fiscal
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la cadena
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: basefacturas
          type: database
          label: Base de facturación
          zone: restricted
          role: base-facturas
          props: { backup: "diario" }
        - id: archivo
          type: object-storage
          label: Archivo de comprobantes emitidos
          zone: private
      edges:
        - id: cliente-tienda
          from: { node: cliente }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gwtienda
          from: { node: tienda }
          to: { node: gwtienda }
          dataClass: personal
        - id: gwtienda-identidad
          from: { node: gwtienda }
          to: { node: identidad }
          dataClass: secret
        - id: gwtienda-facturacion
          from: { node: gwtienda }
          to: { node: facturacion }
          dataClass: personal
        - id: facturacion-basefacturas
          from: { node: facturacion }
          to: { node: basefacturas }
          dataClass: regulated
        - id: facturacion-archivador
          from: { node: facturacion }
          to: { node: archivador }
          dataClass: regulated
        - id: archivador-archivo
          from: { node: archivador }
          to: { node: archivo }
          dataClass: regulated
        - id: inspector-gwfisco
          from: { node: inspector }
          to: { node: gwfisco }
          dataClass: personal
        - id: gwfisco-identidad
          from: { node: gwfisco }
          to: { node: identidad }
          dataClass: secret
        - id: gwfisco-consulta
          from: { node: gwfisco }
          to: { node: consulta }
          dataClass: personal
        - id: consulta-archivo
          from: { node: consulta }
          to: { node: archivo }
          dataClass: regulated
status: PILOT
---

La misma cadena de retail, seis meses después del caso del archivo de
marketing, y una obligación que corre en la dirección contraria.

La ley fiscal obliga a conservar **diez años** cada comprobante emitido, y a
poder exhibir cualquiera de ellos cuando el organismo lo pida.

La base de facturación conserva **dieciocho meses**. La purga la puso el
equipo de plataforma en 2021, cuando la tabla de comprobantes pasó los 400
millones de filas y el cierre mensual empezó a tardar seis horas. Fue una
decisión razonable de rendimiento que nadie cruzó nunca con el plazo legal.

Hay un segundo problema y es más incómodo que el primero. La base de
facturación **se corrige todos los días**: notas de crédito, anulaciones,
reprocesos de lotes que fallaron. Un comprobante consultado hoy puede no ser
byte a byte el que se emitió. Y el inspector no viene a leer comprobantes:
viene a comprobar que el comprobante que la empresa exhibe es el que se
emitió. Una lectura sobre un almacenamiento que se puede escribir no prueba
eso, por muy restringido que esté el permiso.

Hoy el inspector entra por su propia puerta, con doble factor, contra un
servicio de consulta que lee la base viva. El control de acceso está bien
resuelto. No es el problema.

El jefe de datos frena la propuesta con una objeción que suena sensata:
*"acabamos de sacar un archivo intermedio por el caso de marketing y ahora
proponen crear otro. ¿No estamos repitiendo el mismo error?"*

No. En marketing la obligación era que el dato pudiera desaparecer, y una
copia que sólo se agrega hacía imposible cumplirla. Acá la obligación es que
el dato **no** pueda desaparecer ni cambiar. Una copia no es buena ni mala:
lo que decide es si la ley te obliga a borrar o a conservar.

El equipo tiene **7 unidades operativas** y hoy usa 6.

**Rearmá el sistema** para que exista un comprobante archivado que cubra
diez años y que el inspector pueda leer sin tocar el almacenamiento que la
empresa corrige, sin dejar a la cadena sin facturar.
