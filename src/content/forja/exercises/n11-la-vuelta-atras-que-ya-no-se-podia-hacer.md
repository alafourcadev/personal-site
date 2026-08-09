---
title: "La vuelta atrás que ya no se podía hacer"
level: 11
role: core
domain: prestamos
D1: 3
D2: 3
D3: 3
D4: 4
D5: 3
D6: 2
D7: 3
D8: 1
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que explicar qué tendría que pasar para poder devolver el tráfico al motor viejo un martes a las tres de la tarde, sin perder ni una decisión."
lambda: 0.5
constraints:
  - metric: solicitudes de préstamo evaluadas por día
    operator: ">="
    value: 22000
    unit: solicitudes/día
  - metric: antigüedad máxima aceptable del historial del motor viejo para poder volver a él
    operator: "<="
    value: 15
    unit: minutos
hiddenFacts:
  - fact: "el motor viejo sigue desplegado y sigue respondiendo, pero su historial se quedó congelado el día del corte: hace doce días que no evalúa una sola solicitud."
    discoveryPath: "está en el lienzo con su base y sin ninguna conexión entrante. Un sistema que sigue encendido pero que no recibe trabajo no es una vuelta atrás disponible: es un sistema desactualizado que se ve igual que uno vivo."
  - fact: el motor nuevo aprobó durante nueve días con un umbral mal calibrado. El error se detectó por la cartera, no por el sistema. Ninguna de las dos versiones se estaba comparando con la otra.
    discoveryPath: "preguntate quién evaluó cada solicitud durante la convivencia. Si sólo una de las dos versiones vio cada caso, no hay con qué comparar y el único detector del error es el resultado del negocio, semanas después."
  - fact: escribir en el motor viejo de forma sincrónica desde el camino de la solicitud le suma su disponibilidad a la del nuevo. El día que el viejo tuvo mantenimiento, las solicitudes fallaban aunque el nuevo estuviera perfecto.
    discoveryPath: "conectá el camino del cliente directo al motor viejo y contá cuántos sistemas tienen que estar arriba a la vez para que una solicitud termine. La copia hacia el viejo no puede estar en el camino de la respuesta."
startingDesign:
  nodes:
    - id: solicitante
      type: actor
      label: Solicitante
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de préstamos
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: nuevo
      type: service
      label: Motor de evaluación (nuevo)
      zone: private
      role: new-scoring
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: viejo
      type: service
      label: Motor de evaluación (viejo)
      zone: private
      role: legacy-scoring
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: dbnuevo
      type: database
      label: Historial de decisiones (nuevo)
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 540 }
    - id: dbviejo
      type: database
      label: Historial de decisiones (viejo)
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 430 }
  edges:
    - id: solicitante-app
      from: { node: solicitante }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-nuevo
      from: { node: gw }
      to: { node: nuevo }
      dataClass: personal
    - id: nuevo-dbnuevo
      from: { node: nuevo }
      to: { node: dbnuevo }
      dataClass: personal
    - id: viejo-dbviejo
      from: { node: viejo }
      to: { node: dbviejo }
      dataClass: personal
guarantees:
  - id: g-legacy-still-fed
    label: el motor viejo sigue evaluando cada solicitud, y se entera por una cola o un registro de eventos
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-scoring
      via:
        type: [queue, stream]
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el motor viejo que pase por una cola o por un registro de eventos.
    consequence: "sin ese camino el motor viejo se queda atrás un día por día, y la vuelta atrás deja de ser una decisión de minutos para convertirse en una reconstrucción de datos de varios días. Si el camino existiera pero fuera sincrónico, el problema sería el otro: la solicitud sólo termina cuando los dos motores respondieron, así que un mantenimiento del viejo tira abajo al nuevo."
  - id: g-new-serves
    label: el motor nuevo es el que responde al solicitante
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: new-scoring
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el motor nuevo. Nadie está usando lo que se construyó.
    consequence: "la convivencia deja de ser convivencia y pasa a ser dos sistemas apagados en distinto grado. El costo de operar dos motores se paga igual, y el beneficio de haber migrado no llega nunca."
  - id: g-single-switch
    label: la puerta de entrada no habla con el motor viejo
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-scoring
    whyMissing: la puerta de entrada tiene una conexión directa al motor viejo, así que hay dos lugares distintos que deciden quién evalúa una solicitud.
    consequence: "cuando la decisión de a quién le toca cada solicitud vive en dos lugares, volver atrás significa cambiar los dos y esperar que nadie se olvide de uno. Los incidentes de migración que duran horas casi siempre son eso: un camino que quedó apuntando a donde ya no debía."
  - id: g-legacy-history-current
    label: el historial del motor viejo se mantiene al día
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-store
    whyMissing: no hay ningún camino desde el tráfico real hasta el historial del motor viejo, así que ese historial es una foto del día del corte.
    consequence: "volver atrás con un historial de doce días de antigüedad significa reevaluar a mano todo lo que pasó en el medio, con reglas distintas de las que se aplicaron. Los clientes de esos doce días quedan con dos decisiones diferentes sobre el mismo caso."
rubric:
  - dimension: el sistema viejo sigue haciendo el trabajo, no sólo encendido
    signal:
      kind: predicate
      guaranteeId: g-legacy-still-fed
  - dimension: la copia hacia el sistema viejo no está en el camino de la respuesta
    signal:
      kind: predicate
      guaranteeId: g-legacy-still-fed
  - dimension: el motor nuevo atiende tráfico real
    signal:
      kind: predicate
      guaranteeId: g-new-serves
  - dimension: la decisión de quién atiende vive en un solo lugar
    signal:
      kind: predicate
      guaranteeId: g-single-switch
  - dimension: el historial de la versión vieja no envejece durante la convivencia
    signal:
      kind: predicate
      guaranteeId: g-legacy-history-current
referenceSolutions:
  - label: el enrutador responde con el nuevo y encola una copia para el viejo
    contextInversion: "que la copia salga del enrutador y no del motor nuevo conviene cuando querés que la solicitud que se le manda al viejo sea exactamente la que entró, sin pasar por la interpretación del motor nuevo: si el nuevo transforma mal un campo, la comparación entre los dos sigue siendo válida y el error se ve. Se paga con una pieza más en el camino crítico y con un enrutador que ahora también es productor de mensajes."
    design:
      nodes:
        - id: solicitante
          type: actor
          label: Solicitante
          zone: public
        - id: app
          type: mobile-client
          label: App de préstamos
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador de solicitudes
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Motor de evaluación (nuevo)
          zone: private
          role: new-scoring
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de copias para el motor viejo
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: repetidor
          type: worker
          label: Repetidor hacia el motor viejo
          zone: private
        - id: viejo
          type: service
          label: Motor de evaluación (viejo)
          zone: private
          role: legacy-scoring
          props: { criticality: "high", replicas: "2" }
        - id: dbnuevo
          type: database
          label: Historial de decisiones (nuevo)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: dbviejo
          type: database
          label: Historial de decisiones (viejo)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
      edges:
        - id: solicitante-app
          from: { node: solicitante }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-enrutador
          from: { node: gw }
          to: { node: enrutador }
          dataClass: personal
        - id: enrutador-nuevo
          from: { node: enrutador }
          to: { node: nuevo }
          dataClass: personal
        - id: enrutador-cola
          from: { node: enrutador }
          to: { node: cola }
          dataClass: personal
        - id: cola-repetidor
          from: { node: cola }
          to: { node: repetidor }
          dataClass: personal
        - id: repetidor-viejo
          from: { node: repetidor }
          to: { node: viejo }
          dataClass: personal
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: personal
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: personal
  - label: el motor nuevo publica su propio registro de decisiones
    contextInversion: "que el registro salga del motor nuevo conviene cuando la decisión evaluada es lo que hay que replicar, no la solicitud cruda: el mismo registro le sirve al motor viejo para mantenerse al día y a cualquier otro consumidor que aparezca (comparación, auditoría, análisis de cartera) sin que nadie tenga que coordinarse con nadie, porque un registro de eventos se relee. Se paga con el motor nuevo convertido en el único punto por donde entra todo, y con la obligación de no perder eventos si él se equivoca."
    design:
      nodes:
        - id: solicitante
          type: actor
          label: Solicitante
          zone: public
        - id: web
          type: web-client
          label: Portal de préstamos
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: nuevo
          type: service
          label: Motor de evaluación (nuevo)
          zone: private
          role: new-scoring
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: stream
          label: Registro de decisiones
          zone: private
          props: { retention: "7d", partitions: "6" }
        - id: repetidor
          type: worker
          label: Repetidor hacia el motor viejo
          zone: private
        - id: viejo
          type: service
          label: Motor de evaluación (viejo)
          zone: private
          role: legacy-scoring
          props: { criticality: "high", replicas: "2" }
        - id: dbnuevo
          type: database
          label: Historial de decisiones (nuevo)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
        - id: dbviejo
          type: database
          label: Historial de decisiones (viejo)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
      edges:
        - id: solicitante-web
          from: { node: solicitante }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: nuevo-registro
          from: { node: nuevo }
          to: { node: registro }
          dataClass: personal
        - id: registro-repetidor
          from: { node: registro }
          to: { node: repetidor }
          dataClass: personal
        - id: repetidor-viejo
          from: { node: repetidor }
          to: { node: viejo }
          dataClass: personal
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: personal
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: personal
status: PILOT
---

Una financiera evalúa **22.000 solicitudes de préstamo por día**. El motor
que decide quién califica tiene nueve años, está escrito en un lenguaje que
en la empresa maneja una sola persona, y funciona.

Hace doce días se hizo el corte. La puerta de entrada dejó de llamar al
motor viejo y empezó a llamar al nuevo, de un día para el otro, como se
había planeado. El motor viejo **quedó desplegado**, encendido, respondiendo
si alguien le pregunta. Eso es lo que todos entendieron por "podemos volver
atrás si algo sale mal".

El día nueve apareció el problema: el motor nuevo venía aprobando con un
umbral mal calibrado. No lo detectó ningún sistema, lo detectó el área de
riesgo mirando la cartera, porque durante la convivencia **cada solicitud la
vio una sola de las dos versiones** y no había con qué comparar.

Y entonces se descubrió lo otro. Volver al motor viejo era imposible: su
historial estaba congelado en el día del corte. Nueve días de decisiones que
él nunca vio, con clientes que ya habían firmado. Devolverle el tráfico no
era mover una configuración, era reconstruir a mano nueve días de cartera.

El motor viejo estaba encendido. **Nunca estuvo disponible.**

Hay una restricción más, y la aprendió el equipo el día que el motor viejo
tuvo su ventana de mantenimiento mensual: si la copia hacia él viaja en el
mismo camino que la respuesta al solicitante, entonces la solicitud sólo
termina cuando los dos motores contestaron. Ese día fallaron solicitudes que
el motor nuevo había resuelto perfectamente.

**Rearmá el sistema** para que el motor nuevo siga atendiendo, el viejo siga
evaluando cada solicitud con un historial que nunca tenga más de quince
minutos de atraso, y la copia hacia el viejo no pueda hacer fallar una
solicitud que el nuevo ya resolvió.
