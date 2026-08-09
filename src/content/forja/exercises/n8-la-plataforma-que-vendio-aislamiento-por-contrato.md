---
title: "La plataforma que vendió aislamiento por contrato"
level: 8
role: synthesis
domain: formacion
D1: 3
D2: 3
D3: 4
D4: 2
D5: 4
D6: 3
D7: 1
D8: 0
D9: 3
prerequisiteLevels: [7]
budget:
  opsUnits: 8
aiBudget: "libre, pero tu respuesta tiene que recorrer los cuatro caminos por los que un dato sale del sistema (la consulta, el análisis, el archivo y la publicación) y decir, en cada uno, qué componente sabe de qué empresa es lo que está entregando."
lambda: 0.6
constraints:
  - metric: empresas clientes sobre la misma plataforma
    operator: ">="
    value: 1100
    unit: empresas
  - metric: inscripciones acumuladas en la base compartida
    operator: ">="
    value: 2400000
    unit: inscripciones
  - metric: certificados de otra empresa accesibles sin permiso
    operator: "="
    value: 0
    unit: certificados
hiddenFacts:
  - fact: "el contrato marco dice, con esas palabras, que los datos de una empresa cliente no son accesibles por ninguna otra. Lo firmaron las 1.100. No dice nada de agregados anónimos, y por eso el informe de industria se pudo vender."
    discoveryPath: "es lo que separa \"apagar todo\" de \"rearmar\". Dos de las garantías piden que el análisis siga existiendo; ninguna pide que desaparezca."
  - fact: "el proceso de análisis recorre la base de las 1.100 empresas cada noche y la consulta la escribió el equipo de datos, que no participa de las revisiones de la plataforma."
    discoveryPath: "seguí la conexión del proceso de análisis hasta la base y preguntate quién la revisa cuando cambia. Es el mismo patrón que viste en los ejercicios anteriores del nivel, ahora conviviendo con los otros tres."
  - fact: "los certificados están detrás de una red de distribución desde el trimestre pasado, cuando el costo de las descargas se volvió el segundo renglón de la factura. Fue la decisión correcta para el problema de costo que tenían."
    discoveryPath: "el nivel anterior enseñó a poner esa red. Este enseña dónde no va. La red entrega cualquier archivo a cualquiera que sepa la dirección, y guarda una copia, así que revocar el permiso no borra lo distribuido."
  - fact: "los pedidos de certificado entran todos por una única cola ordenada. Una empresa con 40.000 empleados emite certificados de golpe al cerrar un plan anual de capacitación."
    discoveryPath: "mirá el tamaño del cliente más grande contra la cola que comparten todos. Ya lo viste antes en este nivel con colegios; acá el que espera es una empresa de doce personas."
startingDesign:
  nodes:
    - id: alumno
      type: actor
      label: Empleado en formación
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Campus de la empresa
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: cursos
      type: service
      label: Servicio de formación
      zone: private
      role: learning-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: cola
      type: queue
      label: Cola de certificados
      zone: private
      given: true
      props: { delivery: "at-least-once", dlq: "sí", ordering: "sí" }
      position: { x: 805, y: 300 }
    - id: certificador
      type: worker
      label: Emisor de certificados
      zone: private
      role: certificate-worker
      given: true
      position: { x: 445, y: 520 }
    - id: deposito
      type: object-storage
      label: Depósito de certificados
      zone: private
      role: certificate-store
      given: true
      props: { access: "public", durability: "99.999999999" }
      position: { x: 805, y: 520 }
    - id: red
      type: cdn
      label: Red de distribución
      zone: dmz
      given: true
      position: { x: 805, y: 190 }
    - id: analitica
      type: worker
      label: Proceso de análisis de industria
      zone: private
      role: analytics-worker
      given: true
      position: { x: 445, y: 410 }
    - id: base
      type: database
      label: Base de inscripciones
      zone: restricted
      role: learning-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
  edges:
    - id: alumno-portal
      from: { node: alumno }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-cursos
      from: { node: gw }
      to: { node: cursos }
      dataClass: personal
    - id: cursos-base
      from: { node: cursos }
      to: { node: base }
      dataClass: personal
    - id: cursos-cola
      from: { node: cursos }
      to: { node: cola }
      dataClass: personal
    - id: cola-certificador
      from: { node: cola }
      to: { node: certificador }
      dataClass: personal
    - id: certificador-deposito
      from: { node: certificador }
      to: { node: deposito }
      dataClass: personal
    - id: deposito-red
      from: { node: deposito }
      to: { node: red }
      dataClass: personal
    - id: analitica-base
      from: { node: analitica }
      to: { node: base }
      dataClass: personal
guarantees:
  - id: g-scoped-read
    label: la empresa llega a sus inscripciones por el servicio que sabe de quién son
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: learning-store
      via:
        role: learning-service
    whyMissing: no hay ningún camino desde la puerta de entrada hasta la base de inscripciones que pase por el servicio de formación.
    consequence: el servicio de formación es el único componente que recibe de qué empresa es la sesión. Cualquier otro camino a la base es un camino donde ese dato no viaja.
  - id: g-analysis-no-live-scan
    label: el análisis de industria no abre ninguna consulta propia contra una base
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: analytics-worker
      to:
        type: [database]
    whyMissing: sigue existiendo una conexión directa entre el proceso de análisis de industria y una base de datos.
    consequence: "esa consulta la escribió el equipo de datos y no pasa por las revisiones de la plataforma. Recorre las 1.100 empresas todas las noches, y el contrato marco que firmaron las 1.100 dice que los datos de una no son accesibles por ninguna otra."
  - id: g-analysis-on-extract
    label: el análisis de industria trabaja sobre un extracto preparado para él
    weight: 2
    predicate:
      op: path
      from:
        role: analytics-worker
      to:
        type: [object-storage]
      forbid:
        role: certificate-store
    whyMissing: "no hay ningún camino desde el proceso de análisis hasta un almacenamiento de objetos donde viva un extracto agregado. El depósito de certificados no cuenta: ahí están los diplomas de gente con nombre y apellido, no un agregado."
    consequence: el informe de industria es un producto vendido y el contrato no lo prohíbe. Apagarlo no es la respuesta. Un agregado que ya no permite reconstruir a un empleado concreto cumple el contrato y sostiene el producto; una consulta cruda sobre la base viva no cumple ninguno de los dos.
  - id: g-extract-is-produced
    label: alguien que sabe de qué empresa es cada inscripción produce ese extracto
    weight: 2
    predicate:
      op: path
      from:
        role: learning-service
      to:
        type: [object-storage]
      forbid:
        role: certificate-store
    whyMissing: hay un extracto para el análisis, pero ningún camino desde el servicio de formación (el único que recibe de qué empresa es cada sesión) hasta ese extracto.
    consequence: "un extracto que nadie llena es un depósito vacío. El informe de industria sale todas las noches sin fallar, sin avisar nada y sin datos: el sistema parece sano y el producto que se vendió no existe. Y agregar por empresa sólo lo puede hacer quien sabe de qué empresa es cada inscripción; si el extracto lo arma alguien que no lo sabe, es la consulta cruda otra vez con un archivo en el medio."
  - id: g-no-open-publication
    label: ningún depósito de certificados queda publicado detrás de una red de distribución
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [object-storage]
      to:
        type: [cdn]
    whyMissing: sigue habiendo un depósito de archivos publicado detrás de una red de distribución de contenido.
    consequence: la red entrega cualquier archivo a quien sepa la dirección, porque para eso existe, y guarda una copia cerca de quien la pidió. Revocar el permiso después no borra lo que ya se distribuyó.
  - id: g-partitioned-certificates
    label: los pedidos de certificado viajan por un registro de eventos dividido en tramos
    weight: 2
    predicate:
      op: path
      from:
        role: learning-service
      to:
        role: certificate-worker
      via:
        type: [stream]
    whyMissing: los pedidos de certificado van del servicio de formación al emisor por una única cola ordenada, no por un registro de eventos dividido en tramos.
    consequence: "una empresa de 40.000 empleados cierra su plan anual y emite todo de golpe. Con una sola cola, la empresa de doce personas que pidió un certificado a las 15:10 lo recibe cuando terminen los 40.000 de adelante: el tamaño de un cliente decide la espera de todos los demás."
rubric:
  - dimension: toda consulta en vivo pasa por el componente que conoce al dueño
    signal:
      kind: predicate
      guaranteeId: g-scoped-read
  - dimension: el barrido nocturno dejó de existir como camino propio
    signal:
      kind: predicate
      guaranteeId: g-analysis-no-live-scan
  - dimension: el producto de análisis sobrevive, sobre un dato que ya no identifica a nadie
    signal:
      kind: predicate
      guaranteeId: g-analysis-on-extract
  - dimension: el archivo de un cliente deja de estar publicado abiertamente
    signal:
      kind: predicate
      guaranteeId: g-no-open-publication
  - dimension: el tamaño de un cliente deja de decidir la espera de los demás
    signal:
      kind: predicate
      guaranteeId: g-partitioned-certificates
referenceSolutions:
  - label: el servicio de formación deja el extracto y el análisis lo lee
    contextInversion: "que el propio servicio de formación escriba el extracto conviene cuando el agregado es simple y se recalcula una vez por día: no agrega ninguna pieza para operar, deja el presupuesto con margen, y el extracto lo escribe el único componente que ya sabe de qué empresa es cada inscripción. El costo es que ese trabajo corre dentro del servicio que atiende el campus, y un agregado que crece con los 2,4 millones de inscripciones va a empezar a notarse ahí."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Empleado en formación
          zone: public
        - id: portal
          type: web-client
          label: Campus de la empresa
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cursos
          type: service
          label: Servicio de formación
          zone: private
          role: learning-service
          props: { criticality: "high", replicas: "2" }
        - id: flujo
          type: stream
          label: Registro de certificados pedidos
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: certificador
          type: worker
          label: Emisor de certificados
          zone: private
          role: certificate-worker
        - id: deposito
          type: object-storage
          label: Depósito de certificados
          zone: private
          role: certificate-store
          props: { access: "signed", durability: "99.999999999" }
        - id: extracto
          type: object-storage
          label: Extracto agregado por industria
          zone: private
        - id: analitica
          type: worker
          label: Proceso de análisis de industria
          zone: private
          role: analytics-worker
        - id: base
          type: database
          label: Base de inscripciones
          zone: restricted
          role: learning-store
          props: { backup: "diario" }
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-cursos
          from: { node: gw }
          to: { node: cursos }
          dataClass: personal
        - id: cursos-base
          from: { node: cursos }
          to: { node: base }
          dataClass: personal
        - id: cursos-flujo
          from: { node: cursos }
          to: { node: flujo }
          dataClass: personal
        - id: flujo-certificador
          from: { node: flujo }
          to: { node: certificador }
          dataClass: personal
        - id: certificador-deposito
          from: { node: certificador }
          to: { node: deposito }
          dataClass: personal
        - id: cursos-deposito
          from: { node: cursos }
          to: { node: deposito }
          dataClass: personal
        - id: cursos-extracto
          from: { node: cursos }
          to: { node: extracto }
          dataClass: public
        - id: analitica-extracto
          from: { node: analitica }
          to: { node: extracto }
          dataClass: public
  - label: un exportador propio arma el extracto desde el mismo registro
    contextInversion: "un exportador dedicado conviene cuando el agregado recorre 2,4 millones de inscripciones y no puede robarle capacidad al campus: se escala, se pausa y se reintenta sin tocar el servicio de formación, y el equipo de datos gana un lugar donde su lógica vive y se revisa. Se paga con una pieza más para operar, que en este presupuesto es casi todo el margen que queda, y con que el informe muestra el estado de anoche."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Empleado en formación
          zone: public
        - id: portal
          type: web-client
          label: Campus de la empresa
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cursos
          type: service
          label: Servicio de formación
          zone: private
          role: learning-service
          props: { criticality: "high", replicas: "2" }
        - id: flujo
          type: stream
          label: Registro de novedades de formación
          zone: private
          props: { retention: "7d", partitions: "3", ordering: "sí" }
        - id: certificador
          type: worker
          label: Emisor de certificados
          zone: private
          role: certificate-worker
        - id: exportador
          type: worker
          label: Exportador de agregados
          zone: private
        - id: deposito
          type: object-storage
          label: Depósito de certificados
          zone: private
          role: certificate-store
          props: { access: "signed", durability: "99.999999999" }
        - id: extracto
          type: object-storage
          label: Extracto agregado por industria
          zone: private
        - id: analitica
          type: worker
          label: Proceso de análisis de industria
          zone: private
          role: analytics-worker
        - id: base
          type: database
          label: Base de inscripciones
          zone: restricted
          role: learning-store
          props: { backup: "diario" }
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-cursos
          from: { node: gw }
          to: { node: cursos }
          dataClass: personal
        - id: cursos-base
          from: { node: cursos }
          to: { node: base }
          dataClass: personal
        - id: cursos-flujo
          from: { node: cursos }
          to: { node: flujo }
          dataClass: personal
        - id: flujo-certificador
          from: { node: flujo }
          to: { node: certificador }
          dataClass: personal
        - id: flujo-exportador
          from: { node: flujo }
          to: { node: exportador }
          dataClass: personal
        - id: exportador-extracto
          from: { node: exportador }
          to: { node: extracto }
          dataClass: public
        - id: certificador-deposito
          from: { node: certificador }
          to: { node: deposito }
          dataClass: personal
        - id: cursos-deposito
          from: { node: cursos }
          to: { node: deposito }
          dataClass: personal
        - id: analitica-extracto
          from: { node: analitica }
          to: { node: extracto }
          dataClass: public
status: PILOT
---

Una plataforma de formación corporativa. **1.100 empresas clientes**, **2,4
millones de inscripciones** acumuladas, todo sobre la misma base.

El contrato marco que firmaron las 1.100 dice, con esas palabras, que los
datos de una empresa cliente no son accesibles por ninguna otra. Es la frase
que cierra las ventas grandes.

Hoy hay cuatro caminos por los que un dato sale de esa base. Tres se
construyeron por buenas razones y ninguno de los tres respeta esa frase.

**El primero funciona.** El empleado entra al campus de su empresa, y el
servicio de formación, que recibe de qué empresa es la sesión, consulta la
base con ese dato adentro. Este camino no hay que tocarlo.

**El segundo es el análisis de industria.** Un producto que se vende: cada
empresa ve cómo se compara su tasa de finalización contra el promedio de su
sector. El proceso recorre la base de las 1.100 cada noche. La consulta la
escribió el equipo de datos, que no participa de las revisiones de la
plataforma. El contrato no prohíbe los agregados anónimos, así que el
producto es legítimo. La consulta cruda, no.

**El tercero son los certificados.** Se emiten como PDF y viven en un
depósito publicado detrás de una red de distribución, decisión del trimestre
pasado, cuando las descargas se volvieron el segundo renglón de la factura.
Fue la respuesta correcta al problema de costo. La red entrega cualquier
archivo a quien sepa la dirección, y guarda una copia cerca de quien la pidió.

**El cuarto es la emisión.** Todos los pedidos de certificado entran por una
única cola ordenada. Una empresa con **40.000 empleados** cierra su plan
anual y emite todo de golpe. La empresa de doce personas que pidió el suyo a
las 15:10 lo recibe cuando terminen los 40.000 de adelante.

El equipo tiene **8 unidades operativas** y hoy usa 6. El margen alcanza para
una o dos piezas, no para tres.

**Rearmá el sistema** para que los cuatro caminos respeten la frase del
contrato: que toda consulta en vivo pase por el componente que conoce al
dueño, que el análisis siga existiendo pero sobre un dato que ya no identifica
a nadie, que el certificado deje de estar publicado abierto, y que el tamaño
de una empresa deje de decidir la espera de las otras 1.099.
