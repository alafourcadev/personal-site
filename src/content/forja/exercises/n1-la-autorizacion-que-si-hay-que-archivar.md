---
title: "La autorización que sí hay que archivar"
level: 1
role: counter-trap
domain: hoteleria
D1: 1
D2: 1
D3: 1
D4: 1
D5: 1
D6: 0
D7: 0
D8: 0
D9: 2
prerequisiteLevels: []
budget:
  opsUnits: 3
aiBudget: 'libre. Y esta vez no hay pregunta escondida: el requisito dice conservar, el que hoy lo tiene no lo conserva, y hay que ponerle un lugar. Lo que se practica acá no es desconfiar del enunciado. Es leerlo.'
lambda: 0.5
constraints:
  - metric: tiempo que la autorización firmada tiene que poder recuperarse
    operator: ">="
    value: 18
    unit: meses
  - metric: presupuesto operativo
    operator: "<="
    value: 3
    unit: unidades operativas
hiddenFacts:
  - fact: la pasarela de pagos conserva la transacción, no el papel firmado. Cuando llega un contracargo, lo que pide la marca de tarjeta es la autorización con la firma del huésped, y eso la pasarela no lo tiene.
    discoveryPath: 'seguí el cargo en el diagrama hasta el tercero y preguntate qué guarda ese tercero. Guarda que se cobró: monto, fecha, tarjeta. Nadie le mandó nunca el papel que el huésped firmó, así que no puede devolverlo.'
  - fact: la marca de tarjeta da 7 días para responder un contracargo y admite reclamos de hasta 540 días de antigüedad. El hotel perdió 11 contracargos el año pasado por no poder presentar nada.
    discoveryPath: compará el plazo del reclamo con el tiempo que la autorización sobrevive hoy en el sistema. Hoy sobrevive lo que dura la petición. El reclamo puede llegar dieciocho meses después.
startingDesign:
  nodes:
    - id: huesped
      type: actor
      label: Huésped
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: recepcion
      type: web-client
      label: Mostrador de recepción
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: cargos
      type: service
      label: Servicio de cargos
      zone: private
      role: charges-service
      given: true
      position: { x: 445, y: 410 }
    - id: pasarela
      type: external-provider
      label: Pasarela de pagos
      zone: dmz
      role: payment-gateway
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: huesped-recepcion
      from: { node: huesped }
      to: { node: recepcion }
      dataClass: public
    - id: recepcion-gw
      from: { node: recepcion }
      to: { node: gw }
      dataClass: personal
    - id: gw-cargos
      from: { node: gw }
      to: { node: cargos }
      dataClass: personal
    - id: cargos-pasarela
      from: { node: cargos }
      to: { node: pasarela }
      dataClass: personal
guarantees:
  - id: g-autorizacion-queda
    label: la autorización firmada queda en un lugar que sobrevive a un reinicio
    weight: 3
    predicate:
      op: path
      from:
        role: charges-service
      to:
        type: [object-storage, database]
    whyMissing: el servicio de cargos no llega a ningún lugar durable. Toma la autorización firmada, cobra, y no la escribe en ninguna parte que dure más que la petición.
    consequence: 'la autorización existe durante el tiempo que tarda el cobro y después no existe más. Cuando el contracargo llega catorce meses después, el hotel tiene siete días para presentar la firma del huésped y no tiene de dónde sacarla. El año pasado eso pasó 11 veces, y las 11 se perdieron sin discusión.'
  - id: g-cobro-sigue-saliendo
    label: el cargo se sigue enviando a la pasarela de pagos
    weight: 1
    predicate:
      op: path
      from:
        role: charges-service
      to:
        role: payment-gateway
    whyMissing: se cortó el camino entre el servicio de cargos y la pasarela de pagos.
    consequence: guardar la autorización no reemplaza cobrar. Un hotel que archiva impecablemente las autorizaciones de cargos que ya no ejecuta no resolvió nada. Resolvió la mitad que no da plata.
  - id: g-recepcion-cobra
    label: la recepción sigue llegando al servicio de cargos por la puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        role: charges-service
      via:
        type: [api-gateway]
    whyMissing: no quedó un camino desde el mostrador de recepción hasta el servicio de cargos que pase por la puerta de entrada.
    consequence: el cargo se toma con el huésped presente, que es el único momento en que puede firmar. Si la recepción no llega al sistema en ese momento, la firma no se toma nunca.
rubric:
  - dimension: la autorización se puede presentar dieciocho meses después
    signal:
      kind: predicate
      guaranteeId: g-autorizacion-queda
  - dimension: el cobro sigue ejecutándose
    signal:
      kind: predicate
      guaranteeId: g-cobro-sigue-saliendo
  - dimension: la recepción sigue pudiendo cobrar
    signal:
      kind: predicate
      guaranteeId: g-recepcion-cobra
referenceSolutions:
  - label: la autorización se guarda como documento
    contextInversion: 'guardar la autorización como documento gana porque eso es lo que es: un papel firmado que se escribe una vez, no se modifica nunca y se lee sólo el día del reclamo. Cuesta cero unidades operativas y deja el presupuesto libre para lo que venga. Se paga con que buscar "todas las autorizaciones de este huésped" deja de ser una consulta y pasa a ser un recorrido, y con que hay que decidir a mano cuándo se borra lo que ya pasó los 540 días.'
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: recepcion
          type: web-client
          label: Mostrador de recepción
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cargos
          type: service
          label: Servicio de cargos
          zone: private
          role: charges-service
        - id: pasarela
          type: external-provider
          label: Pasarela de pagos
          zone: dmz
          role: payment-gateway
        - id: archivo
          type: object-storage
          label: Archivo de autorizaciones firmadas
          zone: private
      edges:
        - id: huesped-recepcion
          from: { node: huesped }
          to: { node: recepcion }
          dataClass: public
        - id: recepcion-gw
          from: { node: recepcion }
          to: { node: gw }
          dataClass: personal
        - id: gw-cargos
          from: { node: gw }
          to: { node: cargos }
          dataClass: personal
        - id: cargos-pasarela
          from: { node: cargos }
          to: { node: pasarela }
          dataClass: personal
        - id: cargos-archivo
          from: { node: cargos }
          to: { node: archivo }
          dataClass: personal
  - label: la autorización se guarda como registro consultable
    contextInversion: 'guardar la autorización en una base gana cuando el contracargo no llega solo: la marca reclama por lote, el hotel tiene que responder ocho casos en la misma semana y necesita cruzarlos por huésped, por fecha y por monto sin abrir carpeta por carpeta. También permite saber cuántas autorizaciones se tomaron sin firma antes de que aparezca el reclamo. Se paga con la unidad operativa completa, y con la obligación de que el respaldo exista de verdad: una base con firmas de clientes y sin copia es una promesa de retención sin nada que la sostenga.'
    design:
      nodes:
        - id: huesped
          type: actor
          label: Huésped
          zone: public
        - id: recepcion
          type: web-client
          label: Mostrador de recepción
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: cargos
          type: service
          label: Servicio de cargos
          zone: private
          role: charges-service
        - id: pasarela
          type: external-provider
          label: Pasarela de pagos
          zone: dmz
          role: payment-gateway
        - id: base
          type: database
          label: Base de autorizaciones
          zone: restricted
          props: { backup: "diario" }
      edges:
        - id: huesped-recepcion
          from: { node: huesped }
          to: { node: recepcion }
          dataClass: public
        - id: recepcion-gw
          from: { node: recepcion }
          to: { node: gw }
          dataClass: personal
        - id: gw-cargos
          from: { node: gw }
          to: { node: cargos }
          dataClass: personal
        - id: cargos-pasarela
          from: { node: cargos }
          to: { node: pasarela }
          dataClass: personal
        - id: cargos-base
          from: { node: cargos }
          to: { node: base }
          dataClass: personal
status: PILOT
---

El mismo hotel del ejercicio anterior. Las mismas 140 habitaciones, el mismo
mostrador, el mismo huésped parado ahí a las once de la noche.

Cambió el documento, y sólo el documento.

Al hacer el check-in, el huésped firma una autorización: el hotel puede cargar
a su tarjeta el consumo de la estadía y los daños, hasta un tope. Esa firma se
toma en el mostrador, con el huésped presente, y es el único momento en que se
puede tomar.

Recién saliste de un ejercicio donde la respuesta era **no** guardar. Este es
el otro, y acá **hay que leer, no desconfiar**:

> *"La autorización firmada del huésped tiene que poder recuperarse durante 18
> meses desde el cargo."* Política de la administración, escrita después de
> perder once contracargos.

Mirá el diagrama y buscá dónde queda. **No queda en ningún lado.** El servicio
de cargos toma la autorización, la manda a cobrar y termina.

Y ojo con la pieza de la derecha, porque ahí está la única trampa real de este
ejercicio: la pasarela de pagos **no es un archivo**. Guarda la transacción
(monto, fecha, tarjeta), no el papel firmado. Nadie le mandó nunca esa firma,
así que no puede devolverla.

Los números: la marca de tarjeta da **7 días** para responder un contracargo y
admite reclamos de hasta **540 días** de antigüedad. Hoy la autorización
sobrevive lo que dura la petición. El año pasado el hotel perdió **11
contracargos** por presentarse sin nada.

**Poné el lugar donde la autorización queda, y sostené por qué ese y no el
otro.** Los dos llegan a 100: no hay una respuesta escondida, hay dos
decisiones con costos distintos.

> En el ejercicio anterior la respuesta obvia era la equivocada. Acá es la
> correcta, y por el mismo motivo: la obligación de conservar es del que la
> tiene firmada. Allá era del registro oficial. Acá es del hotel. La regla no
> es desconfiar del reflejo. Es preguntar de quién es la obligación antes de
> aplicarlo.
