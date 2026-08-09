---
title: "El tutor que corrige sin que nadie lo mire"
level: 10
role: synthesis
domain: educacion
D1: 3
D2: 3
D3: 4
D4: 3
D5: 4
D6: 3
D7: 2
D8: 1
D9: 4
prerequisiteLevels: [9]
budget:
  opsUnits: 9
  monthlyUsd: 700
aiBudget: "libre, pero tu respuesta tiene que sostener, sin ayuda, estas tres preguntas: qué sale de la plataforma, de dónde salió cada explicación que el tutor da, y qué pasa el día que el proveedor no contesta."
lambda: 0.7
constraints:
  - metric: "entregas de ejercicios por día"
    operator: ">="
    value: 18000
    unit: entregas
  - metric: "tiempo aceptable entre la entrega y la devolución al alumno"
    operator: "<="
    value: 15
    unit: minutos
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 9
    unit: unidades operativas
hiddenFacts:
  - fact: "la entrega que se le manda al modelo incluye el legajo y el nombre completo del alumno, porque el servicio de entregas manda el registro tal como lo tiene guardado."
    discoveryPath: "mirá qué declara la conexión que sale del servicio de entregas hacia el modelo. El motor la bloquea antes de calcular nada, así que es lo primero que hay que resolver: el resto del diseño no se puede evaluar hasta que eso deje de pasar."
  - fact: "el preparador de pedidos existe y ya lee el material del curso trazable. Se construyó para el generador de resúmenes que usan los profesores."
    discoveryPath: "está en el lienzo, conectado al material del curso y a nada del flujo del tutor. La pieza que necesitás para dos cosas distintas, quitar identificadores y traer el fragmento con su lección, ya está hecha."
  - fact: "en abril el proveedor estuvo caído una hora y cuarenta minutos en el horario de cierre de la semana 6. Nadie corrigió esas entregas, ni el modelo ni una persona."
    discoveryPath: "buscá si existe algún camino desde la entrega hasta la revisión docente que no pase por el modelo. La mesa de docentes está en el lienzo y no recibe nada: un camino que no existe no se puede usar el día que hace falta."
  - fact: "el modelo se llevó el 40 por ciento del presupuesto de infraestructura del trimestre."
    discoveryPath: "el modelo cuesta una unidad operativa y USD 200 por mes, más que cualquier otra pieza del catálogo. Cada pieza que agregues alrededor tiene que ganarse su lugar contra ese número."
startingDesign:
  nodes:
    - id: alumno
      type: actor
      label: "Alumno"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: aula
      type: web-client
      label: "Aula virtual"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: entregas
      type: service
      label: "Servicio de entregas"
      zone: private
      role: entregas
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: preparador
      type: service
      label: "Servicio preparador de pedidos"
      zone: private
      role: preparador
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: material
      type: vector-store
      label: "Material del curso con referencia a la lección"
      zone: private
      role: material
      given: true
      props: { sourceTraceability: "sí" }
      position: { x: 805, y: 410 }
    - id: modelo
      type: ai-model
      label: "Modelo de corrección del proveedor"
      zone: private
      given: true
      props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
      position: { x: 445, y: 520 }
    - id: revision
      type: worker
      label: "Mesa de revisión docente"
      zone: private
      role: revision-docente
      given: true
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 630 }
  edges:
    - id: alumno-aula
      from: { node: alumno }
      to: { node: aula }
      dataClass: public
    - id: aula-gw
      from: { node: aula }
      to: { node: gw }
      dataClass: personal
    - id: gw-entregas
      from: { node: gw }
      to: { node: entregas }
      dataClass: personal
    - id: entregas-modelo
      from: { node: entregas }
      to: { node: modelo }
      dataClass: personal
    - id: preparador-material
      from: { node: preparador }
      to: { node: material }
      dataClass: public
guarantees:
  - id: g-sin-identificadores-al-proveedor
    label: "el servicio que guarda las entregas no le habla directo al modelo"
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: entregas
      to:
        type: [ai-model]
    whyMissing: "hay una conexión directa desde el servicio de entregas hasta el modelo, y por ahí viaja el registro de la entrega tal como está guardado, con nombre y legajo."
    consequence: "el proveedor recibe quién escribió cada ejercicio, cuántas veces se equivocó y en qué. Es el legajo académico de una persona en la infraestructura de un tercero, y esa transferencia no se deshace."
  - id: g-el-preparador-arma-el-pedido
    label: "lo que llega al modelo pasó antes por el preparador de pedidos"
    weight: 3
    predicate:
      op: path
      from:
        role: entregas
      to:
        type: [ai-model]
      via:
        role: preparador
    whyMissing: "no existe ningún camino desde el servicio de entregas hasta el modelo que atraviese el preparador de pedidos."
    consequence: "sin esa pieza en el medio hay dos cosas que no ocurren: nadie quita los identificadores del alumno y nadie adjunta el fragmento del material del que tiene que salir la explicación. El tutor sigue corrigiendo, pero corrige de memoria y con nombre y apellido."
  - id: g-la-explicacion-tiene-fuente
    label: "el preparador lee del material que conserva a qué lección pertenece cada fragmento"
    weight: 2
    predicate:
      op: covered
      target:
        role: preparador
      by:
        type: [vector-store]
        propEquals: { sourceTraceability: "sí" }
    whyMissing: "el preparador de pedidos no está conectado a ningún índice del material que conserve a qué lección pertenece cada fragmento."
    consequence: "la devolución le dice al alumno que repase, pero no qué. Una explicación sin lección de origen no se puede verificar cuando está mal ni seguir cuando está bien, y el docente que la revisa tiene que rehacer el trabajo entero."
  - id: g-la-entrega-sobrevive-al-proveedor
    label: "la entrega queda escrita en algo durable antes de llegar al modelo"
    weight: 2
    predicate:
      op: noVolatileCut
      from:
        role: entregas
      to:
        type: [ai-model]
    whyMissing: "entre el servicio de entregas y el modelo no hay ninguna pieza que sobreviva a un reinicio, así que el pedido de corrección vive sólo mientras el proceso que lo atiende siga vivo."
    consequence: "en abril el proveedor estuvo caído una hora y cuarenta minutos, justo en el cierre de la semana 6. Las entregas de esa hora y media no se corrigieron y nadie supo cuáles eran para volver a intentarlo."
  - id: g-camino-que-no-pasa-por-el-modelo
    label: "hay un camino desde la entrega hasta la mesa de revisión docente que no pasa por el modelo"
    weight: 3
    predicate:
      op: path
      from:
        role: entregas
      to:
        role: revision-docente
      forbid:
        type: [ai-model]
    whyMissing: "todo camino desde el servicio de entregas hasta la mesa de revisión docente atraviesa el modelo, o directamente no existe."
    consequence: "el día que el proveedor no contesta, la entrega no tiene a dónde ir. Un curso donde nadie corrige nada durante dos horas es un curso caído, aunque todos los servidores estén encendidos."
rubric:
  - dimension: "el proveedor no recibe nada que identifique al alumno"
    signal:
      kind: predicate
      guaranteeId: g-sin-identificadores-al-proveedor
  - dimension: "hay una sola pieza que arma lo que se le manda al modelo"
    signal:
      kind: predicate
      guaranteeId: g-el-preparador-arma-el-pedido
  - dimension: "cada explicación se puede rastrear hasta su lección"
    signal:
      kind: predicate
      guaranteeId: g-la-explicacion-tiene-fuente
  - dimension: "una caída del proveedor no se lleva las entregas"
    signal:
      kind: predicate
      guaranteeId: g-la-entrega-sobrevive-al-proveedor
  - dimension: "el curso sigue corrigiendo con el modelo apagado"
    signal:
      kind: predicate
      guaranteeId: g-camino-que-no-pasa-por-el-modelo
referenceSolutions:
  - label: "una cola para corregir y una salida directa a la mesa docente"
    contextInversion: "una cola con un solo consumidor y una conexión aparte hacia la mesa docente conviene cuando las dos vías tienen dueños distintos y ritmos distintos: la corrección automática se acumula y se procesa al ritmo que el proveedor aguante, mientras que la entrega que el sistema no puede corregir, la del alumno con adaptación curricular o la del ejercicio de defensa oral, se le manda al docente en el momento, sin esperar turno detrás de 18.000 entregas. Se paga con dos caminos que hay que mirar por separado y con que reprocesar un lote entero no es releer: es volver a encolar."
    design:
      nodes:
        - id: alumno
          type: actor
          label: "Alumno"
          zone: public
        - id: aula
          type: web-client
          label: "Aula virtual"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: entregas
          type: service
          label: "Servicio de entregas"
          zone: private
          role: entregas
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: "Cola de entregas por corregir"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: preparador
          type: service
          label: "Servicio preparador de pedidos"
          zone: private
          role: preparador
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: material
          type: vector-store
          label: "Material del curso con referencia a la lección"
          zone: private
          role: material
          props: { sourceTraceability: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de corrección del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: revision
          type: worker
          label: "Mesa de revisión docente"
          zone: private
          role: revision-docente
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: monitoreo
          type: observability
          label: "Monitoreo"
          zone: private
      edges:
        - id: alumno-aula
          from: { node: alumno }
          to: { node: aula }
          dataClass: public
        - id: aula-gw
          from: { node: aula }
          to: { node: gw }
          dataClass: personal
        - id: gw-entregas
          from: { node: gw }
          to: { node: entregas }
          dataClass: personal
        - id: entregas-cola
          from: { node: entregas }
          to: { node: cola }
          dataClass: personal
        - id: cola-preparador
          from: { node: cola }
          to: { node: preparador }
          dataClass: personal
        - id: preparador-material
          from: { node: preparador }
          to: { node: material }
          dataClass: public
        - id: preparador-modelo
          from: { node: preparador }
          to: { node: modelo }
          dataClass: public
        - id: entregas-revision
          from: { node: entregas }
          to: { node: revision }
          dataClass: personal
        - id: entregas-monitoreo
          from: { node: entregas }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
        - id: preparador-monitoreo
          from: { node: preparador }
          to: { node: monitoreo }
          dataClass: public
  - label: "un registro de entregas que leen el tutor y la mesa docente"
    contextInversion: "un solo registro de entregas con dos lectores independientes conviene cuando lo que importa es poder rehacer: el día que se corrige el enunciado del pedido, o el día que el proveedor devolvió mal una hora y media entera, se relee el rango y se vuelve a correr, sin pedirle nada a los alumnos y sin tocar la mesa docente. La revisión humana deja de ser una excepción que alguien tiene que disparar y pasa a ser un lector más del mismo hecho. Se paga con que el registro conserva las entregas durante su retención, y una entrega trae texto escrito por un alumno."
    design:
      nodes:
        - id: alumno
          type: actor
          label: "Alumno"
          zone: public
        - id: aula
          type: web-client
          label: "Aula virtual"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: entregas
          type: service
          label: "Servicio de entregas"
          zone: private
          role: entregas
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: stream
          label: "Registro de entregas"
          zone: private
          props: { retention: "14d", partitions: "8", ordering: "sí" }
        - id: preparador
          type: service
          label: "Servicio preparador de pedidos"
          zone: private
          role: preparador
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: material
          type: vector-store
          label: "Material del curso con referencia a la lección"
          zone: private
          role: material
          props: { sourceTraceability: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de corrección del proveedor"
          zone: private
          props: { hosting: "external", deterministic: "no", piiPolicy: "none" }
        - id: revision
          type: worker
          label: "Mesa de revisión docente"
          zone: private
          role: revision-docente
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: monitoreo
          type: observability
          label: "Monitoreo"
          zone: private
      edges:
        - id: alumno-aula
          from: { node: alumno }
          to: { node: aula }
          dataClass: public
        - id: aula-gw
          from: { node: aula }
          to: { node: gw }
          dataClass: personal
        - id: gw-entregas
          from: { node: gw }
          to: { node: entregas }
          dataClass: personal
        - id: entregas-registro
          from: { node: entregas }
          to: { node: registro }
          dataClass: personal
        - id: registro-preparador
          from: { node: registro }
          to: { node: preparador }
          dataClass: personal
        - id: preparador-material
          from: { node: preparador }
          to: { node: material }
          dataClass: public
        - id: preparador-modelo
          from: { node: preparador }
          to: { node: modelo }
          dataClass: public
        - id: registro-revision
          from: { node: registro }
          to: { node: revision }
          dataClass: personal
        - id: entregas-monitoreo
          from: { node: entregas }
          to: { node: monitoreo }
          dataClass: public
        - id: registro-monitoreo
          from: { node: registro }
          to: { node: monitoreo }
          dataClass: public
        - id: preparador-monitoreo
          from: { node: preparador }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una plataforma de formación técnica con **60.000 alumnos** y **18.000 entregas
de ejercicios por día**. Desde febrero, cada entrega la corrige un tutor
automático: devuelve qué está mal, por qué, y qué conviene repasar. El alumno
tiene la devolución en menos de quince minutos y las inscripciones subieron un
30 por ciento. El tutor es hoy el producto.

Cuatro cosas de este sistema están mal, y ninguna de las cuatro se nota en la
demo.

**Lo que sale.** El servicio de entregas le manda al modelo el registro tal como
lo tiene guardado: el código del alumno, su nombre completo, su legajo y el
texto que escribió. El modelo corre en la infraestructura del proveedor. Lo que
sale de la plataforma es el legajo académico de una persona: cuántas veces se
equivocó, en qué y cuándo.

**De dónde sale la explicación.** El modelo explica de memoria. Cuando dice
"repasá punteros", no dice qué lección, y a veces la lección que describe no es
la que da el curso. El **preparador de pedidos**, que ya lee el **material del
curso con referencia a la lección** porque se construyó para el generador de
resúmenes de los profesores, no participa de este flujo.

**Cuando el proveedor no contesta.** En abril estuvo caído **una hora y cuarenta
minutos**, en el cierre de la semana 6. Las entregas de esa hora y media no se
corrigieron: ni el modelo ni una persona. La **mesa de revisión docente** existe,
con tres docentes por turno, y no recibe nada.

**Lo que cuesta.** El modelo se llevó el **40 por ciento** del presupuesto de
infraestructura del trimestre. El equipo tiene un techo de **9 unidades
operativas** y hoy usa 6.

**Rearmá el sistema.** No hay una sola forma de hacerlo bien: hay varias, y cada
una paga algo distinto. Lo que no se negocia es que el proveedor no vea quién
escribió el ejercicio, que cada explicación se pueda rastrear hasta la lección
de la que salió, que una caída de dos horas no se lleve las entregas de esas dos
horas, y que el día que el modelo no esté siga habiendo alguien que corrija.
