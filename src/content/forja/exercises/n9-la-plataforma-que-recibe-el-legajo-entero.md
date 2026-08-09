---
title: "La plataforma de exámenes que recibe el legajo entero"
level: 9
role: core
domain: educacion
D1: 4
D2: 3
D3: 3
D4: 2
D5: 3
D6: 2
D7: 2
D8: 2
D9: 2
prerequisiteLevels: [8]
budget:
  opsUnits: 6
aiBudget: "libre, pero tu respuesta tiene que explicar qué campo del legajo necesita la plataforma para hacer su trabajo y por qué mandarle el resto no es generosidad sino una transferencia de datos que alguien va a tener que justificar."
lambda: 0.75
constraints:
  - metric: alumnos con legajo en el sistema académico
    operator: ">="
    value: 41000
    unit: alumnos
  - metric: exámenes supervisados en línea por período
    operator: ">="
    value: 26000
    unit: exámenes
hiddenFacts:
  - fact: "el contrato de integración con la plataforma de supervisión se armó en 2022 copiando el que ya existía con la biblioteca. La biblioteca necesitaba nombre, documento y domicilio para reclamar libros; la supervisión de exámenes hereda esos campos sin haberlos pedido nunca."
    discoveryPath: "mirá qué componente le habla al tercero. Si el que le habla es el mismo que guarda el legajo completo, lo que sale es todo lo que ese componente tiene, no lo que el tercero necesita."
  - fact: "la plataforma de supervisión guarda lo que recibe fuera del país durante 36 meses. La universidad se enteró en la renovación del contrato, no en la firma."
    discoveryPath: "preguntate qué pasa con el dato una vez que cruzó el límite. Un dato que salió no vuelve: lo que mandás define cuánto tenés que poder explicar después."
  - fact: "la plataforma sólo consulta un campo para operar: si el alumno está habilitado a rendir ese examen. El historial de notas y la situación de beca nunca se leen del lado del proveedor: llegan, se guardan y quedan."
    discoveryPath: "es la razón por la que el ejercicio pide una pieza intermedia y no un permiso más fino en el contrato. Un acuerdo dice qué se puede usar; una pieza en el medio decide qué se puede recibir, y sólo la segunda se puede auditar mirando el sistema."
startingDesign:
  nodes:
    - id: alumno
      type: actor
      label: Alumno
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: portal
      type: web-client
      label: Portal del alumno
      zone: public
      given: true
      position: { x: 445, y: 60 }
    - id: gw
      type: api-gateway
      label: Puerta del campus
      zone: dmz
      given: true
      position: { x: 445, y: 180 }
    - id: academico
      type: service
      label: Servicio académico
      zone: private
      role: academico-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: identidad
      type: identity-provider
      label: Proveedor de identidad de la universidad
      zone: dmz
      given: true
      props: { mfa: "obligatorio", sessionRotation: "sí" }
      position: { x: 805, y: 80 }
    - id: baselegajos
      type: database
      label: Base de legajos
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 300 }
    - id: supervision
      type: external-provider
      label: Plataforma de supervisión de exámenes
      zone: dmz
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: alumno-portal
      from: { node: alumno }
      to: { node: portal }
      dataClass: public
    - id: portal-gw
      from: { node: portal }
      to: { node: gw }
      dataClass: personal
    - id: gw-identidad
      from: { node: gw }
      to: { node: identidad }
      dataClass: secret
    - id: gw-academico
      from: { node: gw }
      to: { node: academico }
      dataClass: personal
    - id: academico-baselegajos
      from: { node: academico }
      to: { node: baselegajos }
      dataClass: regulated
    - id: academico-supervision
      from: { node: academico }
      to: { node: supervision }
      dataClass: personal
guarantees:
  - id: g-no-full-record-out
    label: el componente que guarda el legajo completo no le habla directo a la plataforma externa
    weight: 5
    predicate:
      op: edgeAbsent
      from:
        role: academico-service
      to:
        type: [external-provider]
    whyMissing: hay una conexión directa desde el servicio académico, el que tiene el legajo entero, hasta la plataforma de supervisión.
    consequence: "lo que sale por esa conexión no lo decide el contrato: lo decide qué campos tiene a mano el componente que la abre. Hoy salen domicilio, historial de notas y situación de beca de 41.000 alumnos hacia un proveedor que los guarda 36 meses fuera del país. El día que haya que explicar por qué, no va a haber ninguna pieza del sistema que respalde la explicación."
  - id: g-still-supervised
    label: la plataforma sigue recibiendo lo que necesita para supervisar
    weight: 1
    predicate:
      op: path
      from:
        role: academico-service
      to:
        type: [external-provider]
    whyMissing: no queda ningún camino desde el servicio académico hasta la plataforma de supervisión, así que la plataforma no puede saber si el alumno está habilitado a rendir.
    consequence: "cortar la integración cierra el problema de datos y abre uno peor: 26.000 exámenes por período que nadie puede supervisar. La universidad vuelve a tomar examen presencial o supervisa sin verificar habilitación, y las dos salidas cuestan más que el problema original."
  - id: g-student-path
    label: el alumno sigue llegando a su legajo por una entrada del sistema
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client]
      to:
        role: academico-service
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el portal del alumno hasta el servicio académico que pase por una entrada del sistema.
    consequence: reordenar lo que sale hacia el proveedor no puede costar el canal por el que el alumno consulta su propia inscripción. Un cambio de privacidad que deja a 41.000 alumnos sin portal se revierte el lunes y vuelve todo como estaba.
  - id: g-door-identity
    label: la entrada al campus comprueba identidad con doble factor
    weight: 1
    predicate:
      op: covered
      target:
        type: [api-gateway]
      by:
        type: [identity-provider]
        propEquals: { mfa: "obligatorio" }
    whyMissing: hay una entrada al sistema que no consulta al proveedor de identidad de la universidad con segundo factor obligatorio.
    consequence: "el legajo tiene la nota, la beca y el domicilio de un alumno. Una entrada que sólo pide usuario y clave convierte una contraseña filtrada en acceso completo al expediente de una persona, y no deja forma de decir quién lo miró."
  - id: g-record-store
    label: el legajo vive en un almacenamiento con copia de respaldo
    weight: 1
    predicate:
      op: path
      from:
        role: academico-service
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay un camino desde el servicio académico hasta una base de datos con copia de respaldo declarada.
    consequence: "un legajo académico se conserva por ley mientras el título tenga validez, que es siempre. Sin copia, la conservación es una intención que se descubre incumplida el día que alguien pide un certificado de una carrera de hace doce años."
rubric:
  - dimension: el tercero no recibe más de lo que necesita
    signal:
      kind: predicate
      guaranteeId: g-no-full-record-out
  - dimension: el examen se sigue pudiendo supervisar
    signal:
      kind: predicate
      guaranteeId: g-still-supervised
  - dimension: el alumno sigue teniendo su canal
    signal:
      kind: predicate
      guaranteeId: g-student-path
  - dimension: la entrada identifica a la persona
    signal:
      kind: predicate
      guaranteeId: g-door-identity
  - dimension: el legajo queda donde se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-record-store
referenceSolutions:
  - label: un servicio de habilitación que responde sí o no
    contextInversion: "poner un servicio propio entre el legajo y el proveedor conviene cuando la respuesta que el tercero necesita se puede calcular en el momento y es corta: la plataforma pregunta si este alumno puede rendir este examen, el servicio de habilitación mira el legajo y contesta. Lo que cruza el límite deja de ser un registro y pasa a ser una respuesta. El costo es una pieza más para operar y una dependencia en el camino del examen: si el servicio de habilitación no responde, la supervisión se frena aunque el legajo esté perfecto."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Alumno
          zone: public
        - id: portal
          type: web-client
          label: Portal del alumno
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta del campus
          zone: dmz
        - id: academico
          type: service
          label: Servicio académico
          zone: private
          role: academico-service
          props: { criticality: "high", replicas: "2" }
        - id: habilitacion
          type: service
          label: Servicio de habilitación para rendir
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la universidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: baselegajos
          type: database
          label: Base de legajos
          zone: restricted
          props: { backup: "diario" }
        - id: supervision
          type: external-provider
          label: Plataforma de supervisión de exámenes
          zone: dmz
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-academico
          from: { node: gw }
          to: { node: academico }
          dataClass: personal
        - id: academico-baselegajos
          from: { node: academico }
          to: { node: baselegajos }
          dataClass: regulated
        - id: academico-habilitacion
          from: { node: academico }
          to: { node: habilitacion }
          dataClass: regulated
        - id: habilitacion-supervision
          from: { node: habilitacion }
          to: { node: supervision }
          dataClass: public
  - label: una publicación de habilitaciones que el proveedor consume
    contextInversion: "publicar la habilitación por detrás conviene cuando la lista de quién puede rendir se cierra días antes del examen y no cambia durante la mesa: la universidad publica el padrón de habilitados una sola vez, un trabajador se lo entrega al proveedor, y el día del examen no hay ninguna consulta en vivo que pueda fallar. Además desacopla los horarios: un pico de 26.000 exámenes no toca el servicio académico. Se paga con dos piezas más de infraestructura y con una ventana real de desactualización: si a un alumno se le levanta una deuda dos horas antes, el padrón ya salió."
    design:
      nodes:
        - id: alumno
          type: actor
          label: Alumno
          zone: public
        - id: portal
          type: web-client
          label: Portal del alumno
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta del campus
          zone: dmz
        - id: academico
          type: service
          label: Servicio académico
          zone: private
          role: academico-service
          props: { criticality: "high", replicas: "2" }
        - id: colahabilitados
          type: queue
          label: Cola de habilitaciones publicadas
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: publicador
          type: worker
          label: Publicador de padrón
          zone: private
        - id: identidad
          type: identity-provider
          label: Proveedor de identidad de la universidad
          zone: dmz
          props: { mfa: "obligatorio", sessionRotation: "sí" }
        - id: baselegajos
          type: database
          label: Base de legajos
          zone: restricted
          props: { backup: "diario" }
        - id: supervision
          type: external-provider
          label: Plataforma de supervisión de exámenes
          zone: dmz
      edges:
        - id: alumno-portal
          from: { node: alumno }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-identidad
          from: { node: gw }
          to: { node: identidad }
          dataClass: secret
        - id: gw-academico
          from: { node: gw }
          to: { node: academico }
          dataClass: personal
        - id: academico-baselegajos
          from: { node: academico }
          to: { node: baselegajos }
          dataClass: regulated
        - id: academico-colahabilitados
          from: { node: academico }
          to: { node: colahabilitados }
          dataClass: personal
        - id: colahabilitados-publicador
          from: { node: colahabilitados }
          to: { node: publicador }
          dataClass: personal
        - id: publicador-supervision
          from: { node: publicador }
          to: { node: supervision }
          dataClass: public
status: PILOT
---

Una universidad con **41.000 alumnos** y **26.000 exámenes supervisados en
línea** por período. La supervisión la hace una plataforma externa: mira la
cámara, detecta si el alumno abre otra ventana, marca los incidentes.

Para que funcione, el servicio académico le manda a la plataforma el legajo
del alumno. El legajo entero: nombre, documento, foto, domicilio, historial
de notas, situación de beca.

Nadie decidió eso. El contrato de integración se armó en 2022 **copiando el
que ya existía con la biblioteca**, que necesitaba domicilio y documento
para reclamar libros. Los campos viajaron de un contrato al otro y nadie los
volvió a mirar.

En la renovación de este año apareció el dato que faltaba: la plataforma
**guarda lo que recibe durante 36 meses y lo guarda fuera del país**. Y
apareció el otro: para operar, la plataforma consulta **un solo campo**, si
el alumno está habilitado a rendir ese examen. El historial de notas y la
situación de beca llegan, se guardan y quedan. Nunca se leen.

La secretaría académica pide que no se toque la integración a mitad de
período, y tiene razón: la mesa de exámenes empieza en tres semanas y una
supervisión caída significa exámenes anulados. Pero el área legal ya no
puede firmar la renovación con los campos como están.

El equipo tiene **6 unidades operativas** y hoy usa 4.

**Rearmá el sistema** para que lo que cruza hacia la plataforma sea lo que
la plataforma necesita para trabajar. Los exámenes se tienen que seguir
supervisando y el alumno tiene que seguir entrando a su legajo.
