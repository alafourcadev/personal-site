---
title: "El laboratorio que todavía entrega en mano"
level: 3
role: greenfield
domain: laboratorio
D1: 1
D2: 2
D3: 2
D4: 1
D5: 2
D6: 1
D7: 0
D8: 2
D9: 2
prerequisiteLevels: [2]
budget:
  opsUnits: 6
aiBudget: 'libre para nombrar piezas. No lo uses para decidir dónde vive el histórico: la retención de quince años es una obligación local, y un modelo entrenado con documentación de otro país te va a contestar con la normativa de ese otro país sin avisarte.'
lambda: 0.5
constraints:
  - metric: informes clínicos servidos por la red pública de distribución
    operator: "="
    value: 0
    unit: informes
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: el informe firmado se conserva quince años por obligación, y el laboratorio existe desde hace once.
    discoveryPath: 'la consigna dice desde cuándo funciona el laboratorio y cuántos años hay que conservar. Restá. La respuesta te dice que el histórico todavía no llegó a su tamaño final, y que la decisión que tomes hoy es la que vas a tener puesta cuando llegue.'
  - fact: el portal también publica folletos e instructivos de preparación, que son material público y no tienen nada que ver con el resultado de nadie.
    discoveryPath: 'la consigna nombra dos cosas que el portal entrega y no son iguales. Una lleva el nombre de un paciente y la otra no. Si las tratás igual, una de las dos va a estar mal tratada.'
startingDesign:
  nodes: []
  edges: []
guarantees:
  - id: g-resultado-con-respaldo
    label: el resultado clínico termina en una base que se puede restaurar
    weight: 2
    predicate:
      op: path
      from:
        type: [service]
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde un servicio hasta una base con respaldo configurado.
    consequence: 'la retención a quince años no es una promesa del motor de base, es una decisión tuya. Sin respaldo, esos quince años son una afirmación que nadie puede sostener el día que hay que sostenerla.'
  - id: g-informe-en-archivo
    label: el informe firmado vive en un archivo de objetos, no adentro de la base
    weight: 2
    predicate:
      op: path
      from:
        type: [service]
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde un servicio hasta un almacenamiento de objetos, así que los informes firmados están viviendo dentro de las filas de la base.
    consequence: quince años de documentos firmados adentro de la base convierten cada respaldo nocturno en una copia de gigabytes y cada restauración en una operación de horas. La base que sirve lo de hoy termina castigada por lo de 2014.
  - id: g-paciente-por-la-puerta
    label: el paciente llega al servicio a través de una puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        type: [service]
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el portal del paciente hasta un servicio que pase por una puerta de entrada.
    consequence: sin una puerta adelante no hay dónde comprobar que quien pide el resultado es la persona del resultado. Un identificador en la URL alcanza para leer el estudio de otro.
  - id: g-nada-clinico-por-la-red-publica
    label: ningún resultado se entrega por la red pública de distribución
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [service, object-storage]
      to:
        type: [cdn]
    whyMissing: hay una pieza del sistema entregando contenido a través de la red de distribución, y ahí adentro puede ir el informe de alguien.
    consequence: 'una red de distribución existe para copiar lo mismo en muchos lugares y servirlo rápido sin preguntar quién pide. Es exactamente la propiedad que querés para un folleto y exactamente la que no querés para un resultado con nombre y apellido.'
rubric:
  - dimension: el resultado se puede restaurar dentro de la retención obligada
    signal:
      kind: predicate
      guaranteeId: g-resultado-con-respaldo
  - dimension: los documentos firmados no engordan la base operativa
    signal:
      kind: predicate
      guaranteeId: g-informe-en-archivo
  - dimension: lo clínico no sale por donde sale lo público
    signal:
      kind: predicate
      guaranteeId: g-nada-clinico-por-la-red-publica
referenceSolutions:
  - label: una sola base para los quince años
    contextInversion: 'una sola base gana mientras once años de estudios sigan entrando en una tabla que responde rápido. Un lugar, una copia, una restauración, y cuando un juez pide un estudio de 2013 nadie tiene que explicar que ese estudio está en otro lado. Se paga más adelante, el día que la tabla tarda cuarenta segundos en contestar lo de ayer porque adentro tiene lo de hace una década.'
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal de resultados
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: resultados
          type: service
          label: Servicio de resultados
          zone: private
        - id: base
          type: database
          label: Base de resultados
          zone: restricted
          props: { backup: "diario" }
        - id: informes
          type: object-storage
          label: Archivo de informes firmados
          zone: private
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-resultados
          from: { node: gw }
          to: { node: resultados }
          dataClass: regulated
        - id: resultados-base
          from: { node: resultados }
          to: { node: base }
          dataClass: regulated
        - id: resultados-informes
          from: { node: resultados }
          to: { node: informes }
          dataClass: regulated
  - label: base operativa y base histórica, con un archivador en el medio
    contextInversion: 'separar el histórico gana cuando el estudio de ayer y el estudio de 2014 tienen usos distintos. Lo de ayer se consulta mil veces por día desde el portal y lo viejo se consulta cuando lo pide un juez o una auditoría. Dos bases dejan que la operativa siga siendo chica y rápida para siempre. Se paga con un archivador que hay que operar y con la pregunta que aparece en cada consulta vieja: en cuál de las dos está.'
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: portal
          type: web-client
          label: Portal de resultados
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: resultados
          type: service
          label: Servicio de resultados
          zone: private
        - id: operativa
          type: database
          label: Base de resultados del año
          zone: restricted
          props: { backup: "diario" }
        - id: archivador
          type: worker
          label: Archivador de estudios cerrados
          zone: private
        - id: historico
          type: database
          label: Base histórica de quince años
          zone: restricted
          props: { backup: "diario" }
        - id: informes
          type: object-storage
          label: Archivo de informes firmados
          zone: private
      edges:
        - id: paciente-portal
          from: { node: paciente }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-resultados
          from: { node: gw }
          to: { node: resultados }
          dataClass: regulated
        - id: resultados-operativa
          from: { node: resultados }
          to: { node: operativa }
          dataClass: regulated
        - id: resultados-archivador
          from: { node: resultados }
          to: { node: archivador }
          dataClass: regulated
        - id: archivador-historico
          from: { node: archivador }
          to: { node: historico }
          dataClass: regulated
        - id: resultados-informes
          from: { node: resultados }
          to: { node: informes }
          dataClass: regulated
status: PILOT
---

Un laboratorio de análisis clínicos funciona desde hace **once años** y todavía
entrega los resultados en mano, en un sobre, en el mostrador. Van a abrir un
portal para que el paciente los baje.

No hay portal, no hay servicio, no hay base. Empezás con el lienzo vacío.

Lo que hay que sostener son tres cosas, y ninguna es opinable:

> *"El resultado se conserva quince años. El informe firmado es el documento
> legal, no la fila de la base. Y el paciente baja el suyo, no el de otro."*

**Nadie te dice cuántas bases van ni dónde vive el informe.** Eso es lo que
elegís acá, y es la pregunta que ningún ejercicio de reparación te hace: cuando
el diagrama ya existe, alguien decidió eso antes que vos.

El portal también publica folletos e instructivos de preparación para los
estudios. Material público, sin nombre de nadie adentro. La tentación va a
aparecer sola: si ya hay una red de distribución para los folletos, meter el
informe ahí y que baje rápido. Una red de distribución copia lo mismo en muchos
lugares y lo sirve sin preguntar quién pide. Es justo lo que querés para el
folleto y justo lo que no querés para un análisis con nombre y apellido.

Y está la discusión de fondo, que tiene dos lados correctos.

La jefa de laboratorio quiere todo en un solo lugar. Su argumento es bueno:
cuando un juez pide un estudio de 2013 no quiere explicarle a nadie que ese
estudio está en otro sistema, ni descubrir en ese momento que la copia de lo
viejo nunca se probó. Un lugar es una restauración y una respuesta.

El que va a operar esto dice que en cuatro años más la tabla va a tener quince
años de estudios adentro y va a tardar en contestar lo de ayer. También tiene
razón, y su razón se puede medir hoy con una consulta.

Elegí dónde vive el histórico. Después decí, en una frase, qué perdiste.
