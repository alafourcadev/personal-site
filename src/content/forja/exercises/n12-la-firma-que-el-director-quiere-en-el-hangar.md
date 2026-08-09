---
title: "La firma que el director quiere dar en el hangar"
level: 12
role: core
domain: aviacion
D1: 3
D2: 4
D3: 4
D4: 3
D5: 3
D6: 3
D7: 3
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 6
aiBudget: "libre para el diseño. La conversación con el director no la delegues: si no entendés por qué su atajo es imposible y no sólo indeseable, no vas a poder sostener la alternativa cuando te diga que en su empresa anterior funcionaba."
lambda: 3.0
constraints:
  - metric: tiempo máximo entre que el mecánico firma y la firma queda asentada
    operator: "<="
    value: 2
    unit: segundos
  - metric: retención exigida por la autoridad aeronáutica para el registro de aeronavegabilidad
    operator: ">="
    value: 7
    unit: años
  - metric: disponibilidad declarada del portal de la autoridad aeronáutica
    operator: "<="
    value: 97
    unit: por ciento
  - metric: presupuesto operativo del equipo de mantenimiento
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "la tableta del hangar trabaja con conectividad intermitente: el hangar tiene estructura metálica y la señal se corta entre los aviones. Cuando se corta, la tableta reintenta sola."
    discoveryPath: "está declarado en la tableta que trae el ejercicio. Un cliente que reintenta contra un servicio que no distingue reintentos de firmas nuevas produce inspecciones firmadas dos veces."
  - fact: "el portal de la autoridad aeronáutica tiene 97 % de disponibilidad declarada: unos once días de indisponibilidad al año, repartidos en ventanas de mantenimiento que anuncian con poca antelación."
    discoveryPath: "está en las restricciones. Si tu diseño le habla directo al portal, esos once días son once días en los que la firma del mecánico se pierde."
  - fact: "el atajo que pide el director, que la tableta escriba directo en el sistema de mantenimiento, no es una mala práctica discutible: el motor lo rechaza dos veces, por salto de zona y por contrato de puertos."
    discoveryPath: "probá el diseño tal como viene. No vas a recibir un puntaje bajo: no vas a recibir puntaje. Esa diferencia es el argumento que le llevás."
startingDesign:
  nodes:
    - id: mecanico
      type: actor
      label: Mecánico de línea
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tableta
      type: mobile-client
      label: Tableta del hangar
      zone: public
      given: true
      props: { connectivity: "intermittent", offlineCapable: "sí" }
      position: { x: 445, y: 80 }
    - id: mantenimiento
      type: service
      label: Servicio de mantenimiento
      zone: private
      role: maintenance-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 300 }
    - id: registro
      type: database
      label: Registro de aeronavegabilidad
      zone: restricted
      role: airworthiness-record
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: autoridad
      type: external-provider
      label: Portal de la autoridad aeronáutica
      zone: dmz
      role: authority-portal
      given: true
      props: { availability: "97.0", slaMinutes: "240" }
      position: { x: 445, y: 190 }
  edges:
    - id: mecanico-tableta
      from: { node: mecanico }
      to: { node: tableta }
      dataClass: personal
    - id: tableta-mantenimiento
      from: { node: tableta }
      to: { node: mantenimiento }
      dataClass: regulated
    - id: mantenimiento-registro
      from: { node: mantenimiento }
      to: { node: registro }
      dataClass: regulated
    - id: mantenimiento-autoridad
      from: { node: mantenimiento }
      to: { node: autoridad }
      dataClass: regulated
guarantees:
  - id: g-entry
    label: la tableta entra por la puerta de entrada y no habla directo con nada de adentro
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [mobile-client]
          to:
            role: maintenance-service
          via:
            type: [api-gateway]
        - op: edgeAbsent
          from:
            type: [mobile-client]
          to:
            type: [service, database]
    whyMissing: o la tableta le habla directo a un servicio o a una base, o ya no queda camino desde la tableta hasta el servicio de mantenimiento pasando por una puerta de entrada.
    consequence: "el hangar es una red que no controlás: entra personal de tres empresas contratistas con sus propios equipos. Sin una puerta que autentique y limite el ritmo, cualquiera que llegue a esa red llega al servicio que decide si un avión puede volar."
  - id: g-signature-durable
    label: la firma no depende de que el portal de la autoridad esté disponible en ese instante
    weight: 2
    predicate:
      op: all
      of:
        - op: noVolatileCut
          from:
            role: maintenance-service
          to:
            role: authority-portal
        - op: edgeAbsent
          from:
            role: maintenance-service
          to:
            role: authority-portal
    whyMissing: "el servicio de mantenimiento le habla directo al portal de la autoridad, o el camino hasta el portal no atraviesa ninguna pieza que sobreviva a un reinicio."
    consequence: "el portal declara 97 % de disponibilidad: once días al año en los que la presentación falla. Sin una pieza durable en el medio, esos once días son firmas de mecánicos que se hicieron y no llegaron, y la única forma de descubrirlo es una auditoría que encuentra el hueco meses después."
  - id: g-observed
    label: el servicio de mantenimiento reporta lo que le pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
        role: maintenance-service
      by:
        type: [observability]
    whyMissing: el servicio de mantenimiento no está conectado a ningún componente de monitoreo.
    consequence: "una tableta con conectividad intermitente reintenta sola. Si nadie mide cuántos reintentos llegan, la primera noticia de que algo va mal es una inspección que figura firmada dos veces y nadie sabe cuál de las dos es."
rubric:
  - dimension: la entrada al sistema está controlada aunque el hangar no lo esté
    signal:
      kind: predicate
      guaranteeId: g-entry
  - dimension: la firma sobrevive a la caída de un tercero
    signal:
      kind: predicate
      guaranteeId: g-signature-durable
  - dimension: el comportamiento de una red inestable es visible
    signal:
      kind: predicate
      guaranteeId: g-observed
  - dimension: el diseño entra en el presupuesto del equipo de mantenimiento
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: cola de presentaciones y despachador de fondo
    contextInversion: "el despachador de fondo se defiende cuando la presentación a la autoridad no tiene lectura: se manda, se confirma, se olvida. La cola absorbe los once días de portal caído sin que el mecánico se entere, y el proceso de fondo reintenta con espera creciente hasta que el portal vuelve. Al director le decís que su atajo no es una discusión de estilo: la tableta escribiendo en el sistema de mantenimiento salta dos zonas de confianza y no existe puerto que lo acepte, así que lo que él pide no es más rápido, es imposible; lo que sí conseguís es su objetivo real, que la firma responda en menos de dos segundos, porque ahora responde apenas la cola acepta el mensaje. Lo que aceptás a cambio: entre la firma y su presentación efectiva hay un retraso que puede ser de horas, y hay que decírselo a la autoridad antes de que lo descubra."
    design:
      nodes:
        - id: mecanico
          type: actor
          label: Mecánico de línea
          zone: public
        - id: tableta
          type: mobile-client
          label: Tableta del hangar
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "sí" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: mantenimiento
          type: service
          label: Servicio de mantenimiento
          zone: private
          role: maintenance-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: database
          label: Registro de aeronavegabilidad
          zone: restricted
          role: airworthiness-record
          props: { backup: "diario", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de presentaciones
          zone: private
          props: { delivery: "at-least-once", dlq: "no", ordering: "no" }
        - id: despachador
          type: worker
          label: Despachador a la autoridad
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: autoridad
          type: external-provider
          label: Portal de la autoridad aeronáutica
          zone: dmz
          role: authority-portal
          props: { availability: "97.0", slaMinutes: "240" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: mecanico-tableta
          from: { node: mecanico }
          to: { node: tableta }
          dataClass: personal
        - id: tableta-gw
          from: { node: tableta }
          to: { node: gw }
          dataClass: regulated
        - id: gw-mantenimiento
          from: { node: gw }
          to: { node: mantenimiento }
          dataClass: regulated
        - id: mantenimiento-registro
          from: { node: mantenimiento }
          to: { node: registro }
          dataClass: regulated
        - id: mantenimiento-cola
          from: { node: mantenimiento }
          to: { node: cola }
          dataClass: regulated
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: regulated
        - id: despachador-autoridad
          from: { node: despachador }
          to: { node: autoridad }
          dataClass: regulated
        - id: mantenimiento-monitoreo
          from: { node: mantenimiento }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: registro de firmas y servicio de presentaciones
    contextInversion: "el registro releíble con un servicio de presentaciones se defiende cuando alguien tiene que poder preguntar por el estado de una firma: el jefe de hangar quiere saber si la inspección del martes ya está presentada, y un proceso de fondo no responde preguntas. El servicio sí, y además puede releer la ventana completa cuando la autoridad rechaza un lote entero por un cambio de formato, cosa que pasó dos veces en cinco años. Al director le llevás el mismo argumento sobre su atajo, y le agregás que ahora su jefe de hangar deja de llamarte por teléfono para preguntar. Lo que aceptás a cambio: el registro guarda todas las firmas durante su retención, así que el borrado de un dato personal a pedido deja de ser una operación de una línea."
    design:
      nodes:
        - id: mecanico
          type: actor
          label: Mecánico de línea
          zone: public
        - id: tableta
          type: mobile-client
          label: Tableta del hangar
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "sí" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: mantenimiento
          type: service
          label: Servicio de mantenimiento
          zone: private
          role: maintenance-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: registro
          type: database
          label: Registro de aeronavegabilidad
          zone: restricted
          role: airworthiness-record
          props: { backup: "diario", consistency: "strong" }
        - id: firmas
          type: stream
          label: Registro de firmas
          zone: private
          props: { retention: "30d", partitions: "6", ordering: "sí" }
        - id: presentaciones
          type: service
          label: Servicio de presentaciones
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: autoridad
          type: external-provider
          label: Portal de la autoridad aeronáutica
          zone: dmz
          role: authority-portal
          props: { availability: "97.0", slaMinutes: "240" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: mecanico-tableta
          from: { node: mecanico }
          to: { node: tableta }
          dataClass: personal
        - id: tableta-gw
          from: { node: tableta }
          to: { node: gw }
          dataClass: regulated
        - id: gw-mantenimiento
          from: { node: gw }
          to: { node: mantenimiento }
          dataClass: regulated
        - id: mantenimiento-registro
          from: { node: mantenimiento }
          to: { node: registro }
          dataClass: regulated
        - id: mantenimiento-firmas
          from: { node: mantenimiento }
          to: { node: firmas }
          dataClass: regulated
        - id: firmas-presentaciones
          from: { node: firmas }
          to: { node: presentaciones }
          dataClass: regulated
        - id: presentaciones-autoridad
          from: { node: presentaciones }
          to: { node: autoridad }
          dataClass: regulated
        - id: mantenimiento-monitoreo
          from: { node: mantenimiento }
          to: { node: monitoreo }
          dataClass: public
        - id: firmas-monitoreo
          from: { node: firmas }
          to: { node: monitoreo }
          dataClass: public
        - id: presentaciones-monitoreo
          from: { node: presentaciones }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una aerolínea regional con **catorce aviones**. Después de cada inspección
el mecánico firma en una tableta, en el hangar, y esa firma es lo que
habilita al avión a volar. La autoridad aeronáutica exige poder reconstruir
cualquier firma de los **últimos 7 años**, y su portal, por donde se
presentan, declara **97 % de disponibilidad**: unos once días al año
en los que no está.

El director de operaciones quiere una cosa muy concreta y la argumenta bien:
que la tableta escriba directo en el sistema de mantenimiento. Su razón es
que cada salto agrega latencia, que el mecánico firma de pie con guantes y
que dos segundos son dos segundos. En su empresa anterior, dice, funcionaba
así.

Su atajo no es una mala práctica discutible. **Es imposible**: la tableta
está en la red del hangar y el sistema de mantenimiento está en la red
interna; entre las dos hay dos zonas de confianza, y no existe puerto en el
sistema de mantenimiento que acepte una conexión de una tableta. El motor
no te va a dar un puntaje bajo por eso: no te va a dar puntaje.

Eso te da el argumento y te deja el problema. Porque **su objetivo sí es
legítimo**: dos segundos entre la firma y el asentamiento. Y hay un segundo
objetivo que él no está mirando: el hangar es una red donde trabaja personal
de tres empresas contratistas con sus propios equipos, y la señal se corta
entre los aviones, así que la tableta reintenta sola.

El equipo de mantenimiento sostiene **seis piezas**.

**Armá el sistema** para que la tableta entre por una puerta de entrada y no
hable directo con nada de adentro, para que la firma no dependa de que el
portal de la autoridad esté disponible en ese instante, y para que el
servicio de mantenimiento reporte lo que le pasa.
