---
title: "El resultado de laboratorio que pasa por tres sistemas"
level: 4
role: core
domain: laboratorio
D1: 1
D2: 1
D3: 2
D4: 1
D5: 2
D6: 1
D7: 2
D8: 0
D9: 1
prerequisiteLevels: [3]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que decir qué paso dejaste en línea y por qué ese no se puede diferir."
lambda: 0.5
constraints:
  - metric: tiempo aceptable para que el bioquímico vea el resultado validado
    operator: "<="
    value: 2
    unit: segundos
  - metric: presupuesto operativo
    operator: "<="
    value: 8
    unit: unidades operativas
hiddenFacts:
  - fact: el servicio de avisos al paciente depende de un proveedor de mensajería que se cae unas dos veces por mes, y hoy esa caída deja al bioquímico esperando en pantalla aunque el resultado ya esté validado.
    discoveryPath: dejá los tres sistemas encadenados y probá tu respuesta. El motor marca la cadena síncrona profunda y explica por qué la caída del último eslabón se le cobra al primero.
  - fact: el aviso al paciente tiene una ventana de tolerancia de dos horas acordada con la dirección médica; la historia clínica, en cambio, no puede quedar sin el resultado cuando el médico de guardia la abre.
    discoveryPath: el enunciado dice cuál de los dos pasos tiene ventana y cuál no. El que tiene ventana es el que podés sacar de la cadena sin discutirlo con nadie.
startingDesign:
  nodes:
    - id: bioquimico
      type: actor
      label: Bioquímico
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: panel
      type: web-client
      label: Panel de validación
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: resultados
      type: service
      label: Servicio de resultados
      zone: private
      role: results-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: historia
      type: service
      label: Servicio de historia clínica
      zone: private
      role: records-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: avisos
      type: service
      label: Servicio de avisos al paciente
      zone: private
      role: notice-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
  edges:
    - id: bioquimico-panel
      from: { node: bioquimico }
      to: { node: panel }
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
    - id: gw-resultados
      from: { node: gw }
      to: { node: resultados }
    - id: resultados-historia
      from: { node: resultados }
      to: { node: historia }
      dataClass: personal
    - id: historia-avisos
      from: { node: historia }
      to: { node: avisos }
      dataClass: personal
guarantees:
  - id: g-no-sync-chain
    label: la validación no depende de tres sistemas encadenados en línea
    weight: 2
    predicate:
      op: ruleSilent
      rule: sync-chain-depth
    whyMissing: hay tres o más servicios encadenados uno detrás del otro, cada uno esperando al siguiente antes de contestar.
    consequence: la disponibilidad se multiplica y la caída del último eslabón la paga el primero. El bioquímico se queda mirando una pantalla girando por un aviso que ni siquiera es urgente.
  - id: g-records-reached
    label: el resultado sigue llegando a la historia clínica
    weight: 2
    predicate:
      op: path
      from:
        role: results-service
      to:
        role: records-service
    whyMissing: no hay ningún camino desde el servicio de resultados hasta el de historia clínica.
    consequence: "un resultado validado que no está en la historia clínica es un resultado que el médico de guardia no ve a las tres de la mañana. Cortar la cadena borrando el destino no la arregla: la empeora."
  - id: g-notice-reached
    label: el aviso al paciente sigue teniendo un camino
    weight: 1
    predicate:
      op: path
      from:
        role: results-service
      to:
        role: notice-service
    whyMissing: no hay ningún camino desde el servicio de resultados hasta el de avisos al paciente.
    consequence: el paciente se entera de que su resultado está listo cuando llama a preguntar. Diferir el aviso es legítimo; perderlo, no.
  - id: g-observability
    label: el servicio de resultados está observado
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: results-service
      by:
        type: [observability]
    whyMissing: el servicio de resultados no está conectado a ningún componente de observabilidad.
    consequence: si el paso que diferiste deja de avanzar, no hay ninguna señal. Los avisos se acumulan y nadie lo nota hasta que un paciente reclama.
rubric:
  - dimension: la validación dejó de depender de la cadena completa
    signal:
      kind: predicate
      guaranteeId: g-no-sync-chain
  - dimension: el resultado sigue llegando a la historia clínica
    signal:
      kind: predicate
      guaranteeId: g-records-reached
  - dimension: el equipo se entera antes que el paciente
    signal:
      kind: predicate
      guaranteeId: g-observability
referenceSolutions:
  - label: la historia clínica queda en línea, el aviso sale por una cola
    contextInversion: es la elección correcta cuando la dirección médica exige que el resultado esté en la historia clínica en el mismo acto de validarlo, no un segundo después, y lo único diferible es el aviso. Una sola pieza nueva, y el salto que no se puede diferir sigue siendo síncrono, con su costo de disponibilidad asumido a propósito.
    design:
      nodes:
        - id: bioquimico
          type: actor
          label: Bioquímico
          zone: public
        - id: panel
          type: web-client
          label: Panel de validación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: resultados
          type: service
          label: Servicio de resultados
          zone: private
          role: results-service
          props: { criticality: "high", replicas: "2" }
        - id: historia
          type: service
          label: Servicio de historia clínica
          zone: private
          role: records-service
          props: { criticality: "high", replicas: "2" }
        - id: cola
          type: queue
          label: Cola de avisos al paciente
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: notificador
          type: worker
          label: Notificador de resultados
          zone: private
        - id: avisos
          type: service
          label: Servicio de avisos al paciente
          zone: private
          role: notice-service
          props: { criticality: "medium", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: bioquimico-panel
          from: { node: bioquimico }
          to: { node: panel }
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
        - id: gw-resultados
          from: { node: gw }
          to: { node: resultados }
        - id: resultados-historia
          from: { node: resultados }
          to: { node: historia }
          dataClass: personal
        - id: resultados-cola
          from: { node: resultados }
          to: { node: cola }
          dataClass: personal
        - id: cola-notificador
          from: { node: cola }
          to: { node: notificador }
        - id: notificador-avisos
          from: { node: notificador }
          to: { node: avisos }
        - id: resultados-obs
          from: { node: resultados }
          to: { node: obs }
  - label: un registro de resultados validados que los dos sistemas leen
    contextInversion: "conviene cuando la historia clínica tolera unos segundos de retraso, porque el médico de guardia consulta minutos después y no en el mismo instante, y el laboratorio ya sabe que va a aparecer un tercer lector: el tablero de trazabilidad que el ente regulador pide poder reconstruir. Cuesta una pieza más y a cambio ningún sistema de destino puede frenar la validación."
    design:
      nodes:
        - id: bioquimico
          type: actor
          label: Bioquímico
          zone: public
        - id: panel
          type: web-client
          label: Panel de validación
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: resultados
          type: service
          label: Servicio de resultados
          zone: private
          role: results-service
          props: { criticality: "high", replicas: "2" }
        - id: eventos
          type: stream
          label: Registro de resultados validados
          zone: private
          props: { retention: "7d", partitions: "3" }
        - id: archivista
          type: worker
          label: Archivador de resultados
          zone: private
        - id: notificador
          type: worker
          label: Notificador de resultados
          zone: private
        - id: historia
          type: service
          label: Servicio de historia clínica
          zone: private
          role: records-service
          props: { criticality: "high", replicas: "2" }
        - id: avisos
          type: service
          label: Servicio de avisos al paciente
          zone: private
          role: notice-service
          props: { criticality: "medium", replicas: "2" }
        - id: obs
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: bioquimico-panel
          from: { node: bioquimico }
          to: { node: panel }
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
        - id: gw-resultados
          from: { node: gw }
          to: { node: resultados }
        - id: resultados-eventos
          from: { node: resultados }
          to: { node: eventos }
          dataClass: personal
        - id: eventos-archivista
          from: { node: eventos }
          to: { node: archivista }
        - id: eventos-notificador
          from: { node: eventos }
          to: { node: notificador }
        - id: archivista-historia
          from: { node: archivista }
          to: { node: historia }
          dataClass: personal
        - id: notificador-avisos
          from: { node: notificador }
          to: { node: avisos }
        - id: resultados-obs
          from: { node: resultados }
          to: { node: obs }
status: PILOT
---

Un laboratorio de análisis clínicos. Cuando el bioquímico valida un
resultado en su panel, hoy pasa esto en línea: el **servicio de resultados**
llama al de **historia clínica**, y la historia clínica llama al de
**avisos al paciente**. Recién cuando el último contesta, el bioquímico ve
"resultado validado" y puede pasar al siguiente.

El servicio de avisos depende de un proveedor de mensajería que **se cae
unas dos veces por mes**. Cada una de esas caídas deja al bioquímico
esperando frente a una pantalla girando, por un mensaje que ni siquiera es
urgente. Mientras tanto, el resultado ya estaba validado.

La dirección médica puso los dos plazos por escrito, y son distintos: el
aviso al paciente tiene una **ventana de dos horas**; la historia clínica
**no tiene ventana**, porque el médico de guardia la abre cuando la
necesita y el resultado tiene que estar ahí.

El presupuesto operativo del laboratorio es de **8 unidades operativas**.

**Rearmá el sistema** para que validar un resultado deje de depender de los
tres sistemas encadenados. La historia clínica y el aviso al paciente tienen
que seguir recibiendo el resultado.
