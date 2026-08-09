---
title: "El turno que sale de una copia"
level: 1
role: core
domain: salud
D1: 1
D2: 1
D3: 1
D4: 1
D5: 1
D6: 1
D7: 0
D8: 0
D9: 1
prerequisiteLevels: []
budget:
  opsUnits: 4
aiBudget: 'libre, pero si le preguntás a un modelo "¿conviene una copia rápida acá?", te va a decir que sí, porque casi siempre conviene. La pregunta correcta no es esa: es qué dice el requisito que el paciente tiene que ver.'
lambda: 0.5
constraints:
  - metric: tiempo aceptable para que el paciente vea los horarios libres
    operator: "<="
    value: 2
    unit: segundos
  - metric: turnos ofrecidos que en realidad ya estaban tomados
    operator: "="
    value: 0
    unit: turnos
  - metric: presupuesto operativo
    operator: "<="
    value: 4
    unit: unidades operativas
hiddenFacts:
  - fact: el listado de horarios libres, consultado contra el registro real, tarda 310 milisegundos medidos. El requisito acepta 2 segundos.
    discoveryPath: compará los dos números del enunciado. Uno está medido y el otro está firmado. Si el medido entra seis veces en el firmado, la pieza que se agregó para acelerarlo no está resolviendo ningún requisito.
  - fact: la copia se refresca cada 60 segundos, y en ese minuto la clínica toma en promedio 4 turnos por el teléfono del mostrador.
    discoveryPath: 'preguntate quién más escribe en el registro además del sistema. La recepcionista atiende el teléfono: sus turnos entran por otro lado y la copia no se entera hasta el próximo refresco.'
startingDesign:
  nodes:
    - id: paciente
      type: actor
      label: Paciente
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: app
      type: mobile-client
      label: App de la clínica
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: turnos
      type: service
      label: Servicio de turnos
      zone: private
      role: appointments-service
      given: true
      position: { x: 445, y: 300 }
    - id: agenda
      type: database
      label: Agenda de la clínica
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: copia
      type: cache
      label: Copia rápida de horarios
      zone: private
      given: true
      position: { x: 805, y: 300 }
  edges:
    - id: paciente-app
      from: { node: paciente }
      to: { node: app }
      dataClass: public
    - id: app-gw
      from: { node: app }
      to: { node: gw }
      dataClass: personal
    - id: gw-turnos
      from: { node: gw }
      to: { node: turnos }
      dataClass: personal
    - id: turnos-agenda
      from: { node: turnos }
      to: { node: agenda }
      dataClass: personal
    - id: turnos-copia
      from: { node: turnos }
      to: { node: copia }
      dataClass: public
guarantees:
  - id: g-turno-en-el-registro
    label: el servicio de turnos llega al registro real de la agenda
    weight: 1
    predicate:
      op: path
      from:
        role: appointments-service
      to:
        type: [database]
    whyMissing: el servicio de turnos no llega a ningún registro durable donde la agenda exista de verdad.
    consequence: sin registro no hay turno. Lo que el paciente vio en pantalla deja de existir en cuanto se reinicia el proceso, y en la clínica aparece un paciente que jura que tenía hora.
  - id: g-paciente-llega
    label: el paciente llega al servicio de turnos por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [mobile-client, web-client]
      to:
        role: appointments-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde la app del paciente hasta el servicio de turnos que pase por la puerta de entrada.
    consequence: la clínica sacó la aplicación para dejar de atender turnos por teléfono. Si el camino se corta, vuelven las 300 llamadas diarias que la app venía a evitar.
  - id: g-sin-copia-de-horarios
    label: los horarios que se ofrecen no salen de una copia que se vacía sola
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: appointments-service
      to:
        type: [cache]
    whyMissing: el servicio de turnos está apoyado en una copia volátil de los horarios libres, una pieza que nadie pidió y que puede quedar atrasada respecto del registro real.
    consequence: 'la copia se refresca cada minuto y en ese minuto entran los turnos que toma la recepcionista por teléfono. El paciente elige un horario que la copia todavía ve libre y la agenda ya tiene ocupado: dos personas, un médico, las 10:30.'
rubric:
  - dimension: el turno queda escrito donde vive la agenda de verdad
    signal:
      kind: predicate
      guaranteeId: g-turno-en-el-registro
  - dimension: el paciente sigue pudiendo sacar turno desde la app
    signal:
      kind: predicate
      guaranteeId: g-paciente-llega
  - dimension: lo que se ofrece coincide con lo que está libre
    signal:
      kind: predicate
      guaranteeId: g-sin-copia-de-horarios
referenceSolutions:
  - label: el sistema queda más chico
    contextInversion: 'dejar el lugar libre gana cuando el equipo es una persona de guardia y cada pieza que existe es una que hay que actualizar, respaldar y entender a las 2 de la mañana. La consulta tarda 310 ms contra el registro real y el requisito acepta 2 segundos: no hay nada que optimizar todavía. Se paga con la tentación de volver a agregarla el día que el volumen crezca, sin volver a medir.'
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: app
          type: mobile-client
          label: App de la clínica
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: appointments-service
        - id: agenda
          type: database
          label: Agenda de la clínica
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: paciente-app
          from: { node: paciente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: turnos-agenda
          from: { node: turnos }
          to: { node: agenda }
          dataClass: personal
  - label: el lugar que se libera se gasta en saber qué pasa
    contextInversion: 'gastar la unidad liberada en señal gana cuando la clínica ya se quemó una vez: el sistema estuvo devolviendo error un sábado entero y se enteraron el lunes. Sacar la copia no es un ahorro, es un lugar disponible. Ponerlo en algo que el equipo sí pidió vale más que dejarlo vacío. Se paga con una pieza más que operar, que en un equipo de una persona no es gratis.'
    design:
      nodes:
        - id: paciente
          type: actor
          label: Paciente
          zone: public
        - id: app
          type: mobile-client
          label: App de la clínica
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: turnos
          type: service
          label: Servicio de turnos
          zone: private
          role: appointments-service
        - id: agenda
          type: database
          label: Agenda de la clínica
          zone: restricted
          props: { backup: "diario" }
        - id: monitoreo
          type: observability
          label: Monitoreo
          zone: private
      edges:
        - id: paciente-app
          from: { node: paciente }
          to: { node: app }
          dataClass: public
        - id: app-gw
          from: { node: app }
          to: { node: gw }
          dataClass: personal
        - id: gw-turnos
          from: { node: gw }
          to: { node: turnos }
          dataClass: personal
        - id: turnos-agenda
          from: { node: turnos }
          to: { node: agenda }
          dataClass: personal
        - id: turnos-monitoreo
          from: { node: turnos }
          to: { node: monitoreo }
          dataClass: public
status: DRAFT
---

Una clínica de barrio con cuatro consultorios. La app saca turnos: el paciente
abre, ve los horarios libres del día y elige uno. **190 turnos por semana**, y
otros tantos que la recepcionista sigue tomando por teléfono en el mostrador.

La lista de requisitos que dejó la administradora tiene tres líneas y media:

> 1. *El paciente saca turno desde el celular.*
> 2. *Los horarios libres cargan en menos de 2 segundos.*
> 3. *No se puede ofrecer un horario que ya está tomado.*
> 4. *"Queremos Redis, para que sea rápido."*

Tres de esas líneas son requisitos: dicen qué tiene que pasar y se puede
verificar si pasó. La cuarta dice qué herramienta usar. Nadie preguntó por qué,
nadie midió nada, y la pieza terminó en el diagrama igual.

Los números que sí existen: la consulta de horarios libres contra la agenda real
tarda **310 milisegundos**. El requisito acepta **2 segundos**. La copia se
refresca cada **60 segundos**, y en cada uno de esos minutos la recepcionista
toma en promedio **4 turnos por teléfono** que la copia no ve.

Así que la pieza que se agregó para cumplir un requisito que ya se cumplía es la
misma que rompe el tercero.

**Sacala.** Y después decidí qué hacés con el lugar que queda libre en el
presupuesto. Dejarlo vacío también es una decisión, y hay que poder defenderla.
