---
title: "El motor que hay que poder volver a encender"
level: 11
role: tradeoff
domain: reservas
tradeoffPairId: migracion-el-lugar-del-sistema-viejo
D1: 3
D2: 4
D3: 3
D4: 4
D5: 3
D6: 3
D7: 3
D8: 2
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 8
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá el motor viejo sigue trabajando, y por qué eso sería un error en el ejercicio que viene."
lambda: 0.5
constraints:
  - metric: reservas confirmadas por día en temporada alta
    operator: ">="
    value: 40000
    unit: reservas/día
  - metric: tiempo aceptable para devolver todo el tráfico al motor viejo
    operator: "<="
    value: 60
    unit: segundos
hiddenFacts:
  - fact: "la temporada alta dura once semanas y concentra el 63 % de la facturación del año. La migración se autorizó dentro de la temporada porque fuera de ella no hay volumen para probar nada: el motor nuevo necesita los picos para que aparezcan sus problemas."
    discoveryPath: "es la razón por la que este ejercicio prioriza volver atrás por encima de simplificar. Con el 63 % de la facturación en juego, una hora mala cuesta más que operar dos motores durante toda la temporada."
  - fact: "en la migración anterior de esta misma empresa, el sistema de pagos hace dos años, volver atrás llevó cinco horas: el motor viejo estaba encendido, pero su estado se había quedado en el momento del corte y hubo que reconciliar a mano."
    discoveryPath: "preguntate qué estado tiene el motor viejo en el minuto 59 después del corte. Si no procesó las reservas de esos 59 minutos, devolverle el tráfico no es un cambio de ruta: es una reconstrucción de datos."
  - fact: el motor viejo tiene una ventana de mantenimiento mensual de veinte minutos. Si la copia hacia él viaja en el mismo camino que la respuesta al huésped, esos veinte minutos son veinte minutos sin reservas.
    discoveryPath: "conectá el camino del huésped directo al motor viejo y contá cuántos sistemas tienen que estar arriba a la vez para que una reserva se confirme. Mantener el viejo al día no puede costar la disponibilidad del nuevo."
startingDesign:
  nodes:
    - id: huesped
      type: actor
      label: Huésped
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: web
      type: web-client
      label: Sitio de reservas
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: viejo
      type: service
      label: Motor de reservas (viejo)
      zone: private
      role: legacy-engine
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: nuevo
      type: service
      label: Motor de reservas (nuevo)
      zone: private
      role: new-engine
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: dbviejo
      type: database
      label: Base de reservas (vieja)
      zone: restricted
      role: legacy-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 430 }
    - id: dbnuevo
      type: database
      label: Base de reservas (nueva)
      zone: restricted
      role: new-store
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 540 }
  edges:
    - id: huesped-web
      from: { node: huesped }
      to: { node: web }
      dataClass: public
    - id: web-gw
      from: { node: web }
      to: { node: gw }
      dataClass: personal
    - id: gw-viejo
      from: { node: gw }
      to: { node: viejo }
      dataClass: personal
    - id: viejo-dbviejo
      from: { node: viejo }
      to: { node: dbviejo }
      dataClass: personal
    - id: nuevo-dbnuevo
      from: { node: nuevo }
      to: { node: dbnuevo }
      dataClass: personal
guarantees:
  - id: g-legacy-live
    label: el motor viejo sigue procesando las reservas de la temporada
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-engine
    whyMissing: no hay ningún camino desde el tráfico real hasta el motor viejo, así que su estado se congela en el momento del corte.
    consequence: "un motor encendido que no procesa no es una vuelta atrás disponible. En la migración de pagos de esta misma empresa la vuelta atrás llevó cinco horas por exactamente esto: el sistema viejo respondía, pero su estado era el del día del corte y hubo que reconciliar a mano lo que había pasado en el medio."
  - id: g-new-live
    label: el motor nuevo atiende reservas reales
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: new-engine
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el motor nuevo, así que sigue sin verse cómo se comporta con los picos de la temporada.
    consequence: "el motor nuevo se autorizó dentro de la temporada porque fuera de ella no hay volumen para que aparezcan sus problemas. Si no recibe tráfico real ahora, se va a estrenar en la temporada que viene, con un año más de cambios encima y sin nadie que recuerde el detalle."
  - id: g-single-switch
    label: la decisión de quién atiende vive en un solo lugar
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-engine
    whyMissing: la puerta de entrada sigue llamando al motor viejo directamente, así que hay más de un lugar donde se decide quién atiende una reserva.
    consequence: "devolver el tráfico en menos de sesenta segundos sólo es posible si hay un único lugar donde cambiarlo. Con la decisión repartida en dos, volver atrás es un despliegue coordinado, y un despliegue coordinado en temporada alta no dura sesenta segundos."
rubric:
  - dimension: el motor viejo se mantiene al día, no sólo encendido
    signal:
      kind: predicate
      guaranteeId: g-legacy-live
  - dimension: el motor nuevo se prueba contra los picos reales de la temporada
    signal:
      kind: predicate
      guaranteeId: g-new-live
  - dimension: volver atrás es una decisión de operación, no un despliegue
    signal:
      kind: predicate
      guaranteeId: g-single-switch
referenceSolutions:
  - label: el enrutador manda cada reserva a los dos motores
    contextInversion: "mandar cada reserva a los dos motores en el mismo momento es lo correcto cuando la ventana de vuelta atrás se mide en segundos y no hay tolerancia a que el motor viejo esté atrasado: los dos estados son el mismo estado, siempre, y devolver el tráfico es cambiar una ruta. Se paga caro y se sabe: la reserva se confirma cuando los dos motores contestaron, así que la disponibilidad de los dos se multiplica y la ventana de mantenimiento del viejo es una ventana sin reservas. En temporada alta, con el 63 % de la facturación en juego, ese precio se paga."
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: web
          type: web-client
          label: Sitio de reservas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador de reservas
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Motor de reservas (viejo)
          zone: private
          role: legacy-engine
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Motor de reservas (nuevo)
          zone: private
          role: new-engine
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Base de reservas (vieja)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Base de reservas (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: huesped-web
          from: { node: huesped }
          to: { node: web }
          dataClass: public
        - id: web-gw
          from: { node: web }
          to: { node: gw }
          dataClass: personal
        - id: gw-enrutador
          from: { node: gw }
          to: { node: enrutador }
          dataClass: personal
        - id: enrutador-viejo
          from: { node: enrutador }
          to: { node: viejo }
          dataClass: personal
        - id: enrutador-nuevo
          from: { node: enrutador }
          to: { node: nuevo }
          dataClass: personal
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: personal
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: personal
  - label: el motor viejo se mantiene al día por un registro de reservas
    contextInversion: "mantener al viejo por un registro durable conviene cuando la ventana de mantenimiento del motor viejo no puede convertirse en una caída del nuevo: la reserva se confirma con el motor nuevo solo, y el viejo se pone al día leyendo el registro a su ritmo, incluso después de haber estado veinte minutos abajo. Se paga con dos piezas más para operar y con un atraso real, de segundos pero real, entre los dos estados: volver atrás en ese instante significa aceptar que las reservas de los últimos segundos todavía no llegaron al viejo."
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: app
          type: mobile-client
          label: App de reservas
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: enrutador
          type: service
          label: Enrutador de reservas
          zone: private
          props: { criticality: "high", replicas: "2" }
        - id: nuevo
          type: service
          label: Motor de reservas (nuevo)
          zone: private
          role: new-engine
          props: { criticality: "high", replicas: "2" }
        - id: registro
          type: stream
          label: Registro de reservas
          zone: private
          props: { retention: "7d", partitions: "12" }
        - id: repetidor
          type: worker
          label: Repetidor hacia el motor viejo
          zone: private
        - id: viejo
          type: service
          label: Motor de reservas (viejo)
          zone: private
          role: legacy-engine
          props: { criticality: "high", replicas: "2" }
        - id: dbviejo
          type: database
          label: Base de reservas (vieja)
          zone: restricted
          role: legacy-store
          props: { backup: "diario" }
        - id: dbnuevo
          type: database
          label: Base de reservas (nueva)
          zone: restricted
          role: new-store
          props: { backup: "diario" }
      edges:
        - id: huesped-app
          from: { node: huesped }
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
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: personal
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: personal
status: PILOT
---

Una cadena hotelera confirma **40.000 reservas por día en temporada alta**.
La temporada dura once semanas y concentra el **63 % de la facturación del
año**.

El motor de reservas nuevo está listo hace cuatro meses. La migración se
autorizó **dentro de la temporada**, y la razón no es imprudencia: fuera de
la temporada no hay volumen para que aparezcan los problemas del motor nuevo.
Si no se estrena con los picos reales, se estrena el año que viene, con un
año más de cambios encima y sin nadie que recuerde el detalle.

La condición que puso la dirección tiene un número: **si el motor nuevo
empieza a confirmar mal, se devuelve todo el tráfico al viejo en menos de
sesenta segundos**.

Ese número no salió de la nada. Hace dos años esta misma empresa migró su
sistema de pagos y volver atrás llevó **cinco horas**. El motor viejo estaba
encendido, todos lo habían verificado, pero su estado se había quedado en el
momento del corte, y las operaciones de las horas del medio hubo que
reconciliarlas a mano.

Un motor encendido no es una vuelta atrás disponible. **Un motor al día, sí.**

Hay una restricción más: el motor viejo tiene una ventana de mantenimiento
mensual de veinte minutos. Mantenerlo al día no puede costar la
disponibilidad del nuevo, o esos veinte minutos son veinte minutos sin
reservas en plena temporada.

**Rearmá el sistema** para que el motor nuevo atienda reservas reales, el motor
viejo siga procesando cada reserva de la temporada, y la decisión de quién
atiende viva en un solo lugar que se pueda cambiar en sesenta segundos.
