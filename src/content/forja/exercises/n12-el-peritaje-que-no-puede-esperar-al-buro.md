---
title: "El peritaje que no puede esperar al buró"
level: 12
role: core
domain: seguros
D1: 4
D2: 3
D3: 4
D4: 3
D5: 3
D6: 3
D7: 4
D8: 4
D9: 2
prerequisiteLevels: [11]
budget:
  opsUnits: 6
aiBudget: "libre para explorar el diseño. La parte que no se delega es el número: si no podés decir cuántos peritajes al año quedan colgados por el 4 % del buró, la discusión con comercial la vas a dar con adjetivos."
lambda: 4.0
constraints:
  - metric: tiempo máximo entre que el perito cierra el acta y el acta queda asentada
    operator: "<="
    value: 3
    unit: segundos
  - metric: retención del acta de peritaje exigida por la superintendencia
    operator: ">="
    value: 10
    unit: años
  - metric: disponibilidad declarada del buró de fraude contratado
    operator: "<="
    value: 96
    unit: por ciento
  - metric: presupuesto operativo del equipo de siniestros
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: "la tableta del perito trabaja con conectividad intermitente: los peritajes se hacen en banquinas de ruta, playas de depósito y estacionamientos subterráneos. Cuando la señal vuelve, la tableta reenvía sola lo que quedó pendiente."
    discoveryPath: "está declarado en la tableta que trae el ejercicio. Un cliente que reenvía solo contra un servicio que no distingue reenvíos de actas nuevas produce el mismo siniestro peritado dos veces, con dos números distintos."
  - fact: "el buró declara 96 % de disponibilidad: unos catorce días al año. Con 1.100 peritajes por mes son cerca de 500 actas al año que, si el cierre depende del buró en ese instante, quedan a mitad de camino."
    discoveryPath: "está en las restricciones. Multiplicá el volumen mensual por el porcentaje faltante antes de entrar a la reunión: ese número es el argumento."
  - fact: "lo que pide el director comercial, que la tableta consulte el buró desde la calle, no es una mala práctica discutible. El buró no expone ninguna puerta que acepte una conexión de una tableta: sólo habla con sistemas, no con dispositivos de campo."
    discoveryPath: "probá el diseño tal como viene. No vas a recibir un puntaje bajo: no vas a recibir puntaje, y el motor va a nombrar la conexión imposible. Esa diferencia es lo que le llevás."
startingDesign:
  nodes:
    - id: perito
      type: actor
      label: Perito de siniestros
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tableta
      type: mobile-client
      label: Tableta de peritaje
      zone: public
      given: true
      props: { connectivity: "intermittent", offlineCapable: "sí" }
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      props: { authn: "sí", rateLimit: "sí" }
      position: { x: 445, y: 190 }
    - id: siniestros
      type: service
      label: Servicio de siniestros
      zone: private
      role: claims-service
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: actas
      type: database
      label: Base de actas de peritaje
      zone: restricted
      role: claims-record
      given: true
      props: { backup: "diario", consistency: "strong" }
      position: { x: 805, y: 410 }
    - id: buro
      type: external-provider
      label: Buró de fraude
      zone: dmz
      role: fraud-bureau
      given: true
      props: { availability: "96.0", slaMinutes: "120" }
      position: { x: 445, y: 300 }
  edges:
    - id: perito-tableta
      from: { node: perito }
      to: { node: tableta }
      dataClass: personal
    - id: tableta-gw
      from: { node: tableta }
      to: { node: gw }
      dataClass: regulated
    - id: gw-siniestros
      from: { node: gw }
      to: { node: siniestros }
      dataClass: regulated
    - id: tableta-buro
      from: { node: tableta }
      to: { node: buro }
      dataClass: personal
    - id: siniestros-actas
      from: { node: siniestros }
      to: { node: actas }
      dataClass: regulated
    - id: siniestros-buro
      from: { node: siniestros }
      to: { node: buro }
      dataClass: regulated
guarantees:
  - id: g-entry
    label: la tableta entra por la puerta de entrada y no habla directo con nada más
    weight: 3
    predicate:
      op: all
      of:
        - op: path
          from:
            type: [mobile-client]
          to:
            role: claims-service
          via:
            type: [api-gateway]
        - op: edgeAbsent
          from:
            type: [mobile-client]
          to:
            type: [service, database, external-provider]
    whyMissing: "o la tableta le habla directo a un servicio, a una base o a un tercero, o ya no queda camino desde la tableta hasta el servicio de siniestros pasando por una puerta de entrada."
    consequence: "la tableta trabaja en la calle, con la credencial de un perito que rota entre tres estudios contratados. Sin una puerta que autentique y limite el ritmo, cada tableta perdida es acceso directo a todo lo que esa tableta sabía alcanzar, y una de las cosas que alcanza es un contrato con un tercero que se factura por consulta."
  - id: g-score-durable
    label: el cierre del acta no depende de que el buró esté disponible en ese instante
    weight: 2
    predicate:
      op: all
      of:
        - op: noVolatileCut
          from:
            role: claims-service
          to:
            role: fraud-bureau
        - op: edgeAbsent
          from:
            role: claims-service
          to:
            role: fraud-bureau
    whyMissing: "el servicio de siniestros le habla directo al buró, o el camino hasta el buró no atraviesa ninguna pieza que sobreviva a un reinicio."
    consequence: "el buró declara 96 %: unos catorce días al año. Con 1.100 peritajes por mes eso son cerca de 500 actas que quedan a mitad de camino, y el perito ya se fue del lugar del siniestro. La foto del paragolpes no se saca de nuevo en marzo."
  - id: g-record-kept
    label: el acta sigue llegando a la base que la conserva diez años
    weight: 2
    predicate:
      op: path
      from:
        role: claims-service
      to:
        role: claims-record
    whyMissing: no quedó ningún camino desde el servicio de siniestros hasta la base de actas de peritaje.
    consequence: "la superintendencia exige poder reconstruir cualquier acta de los últimos diez años. Un sistema que consulta el buró impecablemente y ya no guarda el acta cambió una obligación regulatoria por un puntaje de riesgo."
  - id: g-observed
    label: todos los servicios reportan lo que les pasa
    weight: 1
    predicate:
      op: covered
      target:
        type: [service]
      by:
        type: [observability]
    whyMissing: hay al menos un servicio que no está conectado a ningún componente de monitoreo.
    consequence: "una tableta con conectividad intermitente reenvía sola. Si nadie mide cuántos reenvíos llegan, la primera noticia de que algo va mal es un siniestro peritado dos veces con dos números distintos, descubierto por el liquidador tres semanas después."
rubric:
  - dimension: la entrada está controlada aunque el lugar de trabajo no lo esté
    signal:
      kind: predicate
      guaranteeId: g-entry
  - dimension: el cierre del acta sobrevive a la caída de un tercero
    signal:
      kind: predicate
      guaranteeId: g-score-durable
  - dimension: la obligación de conservar no se pierde en el rediseño
    signal:
      kind: predicate
      guaranteeId: g-record-kept
  - dimension: el comportamiento de una red inestable es visible
    signal:
      kind: predicate
      guaranteeId: g-observed
  - dimension: el diseño entra en el presupuesto del equipo de siniestros
    signal:
      kind: metric
      metric: opsUnits totales del diseño
      operator: "<="
      value: 6
      unit: unidades operativas
referenceSolutions:
  - label: cola de consultas y despachador de fondo
    contextInversion: "el despachador de fondo se defiende cuando el puntaje del buró no cambia lo que el perito hace en el lugar: el acta se cierra, el puntaje entra después y lo que dispara es una revisión del liquidador, no una decisión de campo. Es la topología más barata de operar que corta la dependencia entre el cierre del acta y los catorce días del buró, y con seis unidades exactas eso importa. Al director comercial le decís que su atajo no es más rápido, es imposible: el buró no expone ninguna puerta que acepte una tableta. Y que su objetivo real, que el perito no espere, lo conseguís igual, porque el acta se cierra apenas la cola acepta el mensaje. Lo que aceptás a cambio: entre el cierre y el puntaje hay un retraso que puede ser de horas, y el liquidador tiene que saber que un acta sin puntaje todavía no es un acta limpia."
    design:
      nodes:
        - id: perito
          type: actor
          label: Perito de siniestros
          zone: public
        - id: tableta
          type: mobile-client
          label: Tableta de peritaje
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "sí" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: actas
          type: database
          label: Base de actas de peritaje
          zone: restricted
          role: claims-record
          props: { backup: "diario", consistency: "strong" }
        - id: cola
          type: queue
          label: Cola de consultas al buró
          zone: private
          props: { delivery: "at-least-once", dlq: "sí", ordering: "no" }
        - id: despachador
          type: worker
          label: Despachador al buró
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: buro
          type: external-provider
          label: Buró de fraude
          zone: dmz
          role: fraud-bureau
          props: { availability: "96.0", slaMinutes: "120" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: perito-tableta
          from: { node: perito }
          to: { node: tableta }
          dataClass: personal
        - id: tableta-gw
          from: { node: tableta }
          to: { node: gw }
          dataClass: regulated
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: regulated
        - id: siniestros-actas
          from: { node: siniestros }
          to: { node: actas }
          dataClass: regulated
        - id: siniestros-cola
          from: { node: siniestros }
          to: { node: cola }
          dataClass: regulated
        - id: cola-despachador
          from: { node: cola }
          to: { node: despachador }
          dataClass: regulated
        - id: despachador-buro
          from: { node: despachador }
          to: { node: buro }
          dataClass: regulated
        - id: siniestros-monitoreo
          from: { node: siniestros }
          to: { node: monitoreo }
          dataClass: public
        - id: cola-monitoreo
          from: { node: cola }
          to: { node: monitoreo }
          dataClass: public
  - label: registro de peritajes y servicio de verificación
    contextInversion: "el registro releíble con un servicio de verificación se defiende cuando alguien tiene que poder preguntar en qué estado quedó un caso: el liquidador quiere saber si el peritaje del martes ya tiene puntaje, y un proceso de fondo no responde preguntas. El servicio sí, y además puede releer una ventana completa cuando el buró cambia su modelo y pide reprocesar el mes, cosa que pasó dos veces en cuatro años. Al director comercial le llevás el mismo argumento sobre la conexión imposible, y le agregás que su equipo de liquidación deja de llamarte para preguntar por casos sueltos. Lo que aceptás a cambio: una pieza más para operar dentro del mismo techo de seis, así que algo tuvo que salir, y el registro conserva actas completas durante su retención, lo que convierte un pedido de borrado en una conversación con el área legal."
    design:
      nodes:
        - id: perito
          type: actor
          label: Perito de siniestros
          zone: public
        - id: tableta
          type: mobile-client
          label: Tableta de peritaje
          zone: public
          props: { connectivity: "intermittent", offlineCapable: "sí" }
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
          props: { authn: "sí", rateLimit: "sí" }
        - id: siniestros
          type: service
          label: Servicio de siniestros
          zone: private
          role: claims-service
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: actas
          type: database
          label: Base de actas de peritaje
          zone: restricted
          role: claims-record
          props: { backup: "diario", consistency: "strong" }
        - id: registro
          type: stream
          label: Registro de peritajes
          zone: private
          props: { retention: "30d", partitions: "8", ordering: "sí" }
        - id: verificacion
          type: service
          label: Servicio de verificación
          zone: private
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: buro
          type: external-provider
          label: Buró de fraude
          zone: dmz
          role: fraud-bureau
          props: { availability: "96.0", slaMinutes: "120" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: perito-tableta
          from: { node: perito }
          to: { node: tableta }
          dataClass: personal
        - id: tableta-gw
          from: { node: tableta }
          to: { node: gw }
          dataClass: regulated
        - id: gw-siniestros
          from: { node: gw }
          to: { node: siniestros }
          dataClass: regulated
        - id: siniestros-actas
          from: { node: siniestros }
          to: { node: actas }
          dataClass: regulated
        - id: siniestros-registro
          from: { node: siniestros }
          to: { node: registro }
          dataClass: regulated
        - id: registro-verificacion
          from: { node: registro }
          to: { node: verificacion }
          dataClass: regulated
        - id: verificacion-buro
          from: { node: verificacion }
          to: { node: buro }
          dataClass: regulated
        - id: siniestros-monitoreo
          from: { node: siniestros }
          to: { node: monitoreo }
          dataClass: public
        - id: verificacion-monitoreo
          from: { node: verificacion }
          to: { node: monitoreo }
          dataClass: public
        - id: registro-monitoreo
          from: { node: registro }
          to: { node: monitoreo }
          dataClass: public
status: PILOT
---

Una aseguradora de automotores. **1.100 peritajes por mes**. El perito llega
al lugar del siniestro con una tableta, saca las fotos, carga el acta y la
cierra ahí mismo: el acuerdo interno dice **3 segundos** entre que la cierra
y queda asentada. La superintendencia exige poder reconstruir cualquier acta
de los **últimos 10 años**.

Hace cuatro meses la empresa contrató un **buró de fraude**: devuelve un
puntaje de riesgo por siniestro y ya evitó pagos por una cifra que el
director comercial repite en cada reunión. El buró declara **96 % de
disponibilidad**: unos catorce días al año en los que no contesta.

El director comercial quiere dos cosas y las argumenta bien. La primera:
que la tableta consulte el buró **desde la calle**, para que el perito sepa
en el lugar si el caso es sospechoso. La segunda: que el acta **no se cierre**
hasta que el buró haya respondido, porque, dice, cerrar sin puntaje es
volver a donde estábamos.

La primera no es una mala práctica discutible: **es imposible**. El buró
sólo expone puertas para sistemas, no para dispositivos de campo, y el motor
no te va a dar un puntaje bajo por intentarlo: no te va a dar puntaje. Eso
te da el argumento y te deja el problema.

La segunda sí es una decisión, y es la que tenés que dar vuelta con un
número: catorce días al año sobre 1.100 peritajes mensuales son cerca de
**500 actas al año** que quedan a mitad de camino con el perito ya fuera del
lugar. La foto del paragolpes no se saca de nuevo en marzo.

Hay un detalle que la tableta arrastra desde el primer día: la señal se
corta en banquinas y subsuelos, y cuando vuelve la tableta **reenvía sola**.

El equipo de siniestros sostiene **seis piezas**.

**Armá el sistema** para que la tableta entre por una puerta de entrada y no
hable directo con nada más, para que el cierre del acta no dependa de que el
buró esté disponible en ese instante, para que el acta siga llegando a la
base que la conserva diez años, y para que todos los servicios reporten lo
que les pasa.
