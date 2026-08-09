---
title: "El andén que se queda en blanco"
level: 6
role: calibration
domain: transporte
D1: 1
D2: 1
D3: 2
D4: 1
D5: 1
D6: 1
D7: 3
D8: 0
D9: 2
prerequisiteLevels: [5]
budget:
  opsUnits: 4
aiBudget: "libre, pero tu respuesta tiene que decir qué muestra la pantalla durante los siete minutos en que el sistema de planificación no contesta, y por qué eso es mejor que no mostrar nada."
lambda: 0.5
constraints:
  - metric: pasajeros que pasan por la terminal en un día de semana
    operator: ">="
    value: 41000
    unit: pasajeros/día
  - metric: tiempo que el sistema de planificación estuvo sin responder el mes pasado
    operator: ">="
    value: 214
    unit: minutos
hiddenFacts:
  - fact: "el sistema de planificación reinicia todas las noches y algunas veces al mediodía. Cada reinicio son entre cuatro y once minutos sin responder, y en esos minutos las salidas siguen siendo exactamente las mismas que un minuto antes."
    discoveryPath: "seguí el camino de un pedido de la pantalla hasta el dato. Si el único lugar del que sale la salida es el sistema de planificación, cuando ese sistema no contesta la pantalla no tiene nada que mostrar. Ni siquiera lo que mostró hace un minuto."
  - fact: "la información de salidas de esta terminal es pública: andén, destino y hora. No hay nombres de pasajeros en la pantalla."
    discoveryPath: "está en el enunciado, y decide qué tipo de copia local es admisible acá. Con dato público, guardar la última versión conocida no expone a nadie."
startingDesign:
  nodes:
    - id: pasajero
      type: actor
      label: Pasajero
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: pantalla
      type: web-client
      label: Pantalla de andén
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: salidas
      type: service
      label: Servicio de salidas
      zone: private
      role: departures-service
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 300 }
    - id: planificacion
      type: external-provider
      label: Sistema de planificación de la flota
      zone: dmz
      role: schedule-source
      given: true
      position: { x: 445, y: 410 }
  edges:
    - id: pasajero-pantalla
      from: { node: pasajero }
      to: { node: pantalla }
      dataClass: public
    - id: pantalla-gw
      from: { node: pantalla }
      to: { node: gw }
      dataClass: public
    - id: gw-salidas
      from: { node: gw }
      to: { node: salidas }
      dataClass: public
    - id: salidas-planificacion
      from: { node: salidas }
      to: { node: planificacion }
      dataClass: public
guarantees:
  - id: g-copia-local
    label: la pantalla puede mostrar la última salida conocida sin preguntarle al sistema de planificación
    weight: 2
    predicate:
      op: any
      of:
        - op: path
          from:
            role: departures-service
          to:
            type: [cache]
        - op: path
          from:
            role: departures-service
          to:
            type: [database]
    whyMissing: el servicio de salidas no llega a ningún almacenamiento propio. Ni una copia en memoria ni una tabla local. Lo único que sabe de las salidas es lo que el sistema de planificación le acaba de contestar.
    consequence: "cuando el sistema de planificación reinicia, la pantalla no muestra un dato viejo: no muestra nada. Cuarenta mil personas por día se enteran de que el sistema se cayó porque el andén quedó en blanco."
  - id: g-fuente-viva
    label: la copia se sigue alimentando del sistema de planificación
    weight: 1
    predicate:
      op: path
      from:
        type: [service, worker]
      to:
        role: schedule-source
    whyMissing: ninguna pieza del sistema llega al sistema de planificación, así que la copia local no tiene de dónde actualizarse.
    consequence: una copia que nadie refresca deja de ser una copia y se vuelve una versión inventada. A las dos horas la pantalla miente con total seguridad, que es peor que estar en blanco.
rubric:
  - dimension: la pantalla degrada a "lo último que sé" en vez de apagarse
    signal:
      kind: predicate
      guaranteeId: g-copia-local
  - dimension: la copia local tiene una fuente y no se queda congelada para siempre
    signal:
      kind: predicate
      guaranteeId: g-fuente-viva
referenceSolutions:
  - label: copia en memoria, se pierde en un reinicio y alcanza igual
    contextInversion: "una copia en memoria es lo correcto cuando el dato se vuelve a traer en segundos y no importa perderlo: si el servicio de salidas reinicia, la primera consulta lo repuebla. Es la pieza más barata de operar y la que menos promete. El costo es que un reinicio simultáneo de los dos sistemas, el de salidas y el de planificación, deja la pantalla vacía otra vez, y eso pasó una vez en dos años."
    design:
      nodes:
        - id: pasajero
          type: actor
          label: Pasajero
          zone: public
        - id: pantalla
          type: web-client
          label: Pantalla de andén
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: salidas
          type: service
          label: Servicio de salidas
          zone: private
          role: departures-service
          props: { criticality: "high", replicas: "2" }
        - id: copia
          type: cache
          label: Última tabla de salidas conocida
          zone: private
        - id: planificacion
          type: external-provider
          label: Sistema de planificación de la flota
          zone: dmz
          role: schedule-source
      edges:
        - id: pasajero-pantalla
          from: { node: pasajero }
          to: { node: pantalla }
          dataClass: public
        - id: pantalla-gw
          from: { node: pantalla }
          to: { node: gw }
          dataClass: public
        - id: gw-salidas
          from: { node: gw }
          to: { node: salidas }
          dataClass: public
        - id: salidas-copia
          from: { node: salidas }
          to: { node: copia }
          dataClass: public
        - id: salidas-planificacion
          from: { node: salidas }
          to: { node: planificacion }
          dataClass: public
  - label: copia en una tabla local que sobrevive al reinicio
    contextInversion: "una tabla local es lo correcto cuando la terminal tiene que poder abrir a las 4 de la mañana con el sistema de planificación todavía apagado: el dato de ayer a la noche sigue ahí después de reiniciar todo. Se paga con una pieza más que respaldar y que mantener, y con la tentación muy real de que alguien empiece a escribirle cosas que no vinieron del sistema de planificación."
    design:
      nodes:
        - id: pasajero
          type: actor
          label: Pasajero
          zone: public
        - id: pantalla
          type: web-client
          label: Pantalla de andén
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: salidas
          type: service
          label: Servicio de salidas
          zone: private
          role: departures-service
          props: { criticality: "high", replicas: "2" }
        - id: tablero
          type: database
          label: Tabla local de salidas del día
          zone: restricted
          props: { backup: "diario" }
        - id: planificacion
          type: external-provider
          label: Sistema de planificación de la flota
          zone: dmz
          role: schedule-source
      edges:
        - id: pasajero-pantalla
          from: { node: pasajero }
          to: { node: pantalla }
          dataClass: public
        - id: pantalla-gw
          from: { node: pantalla }
          to: { node: gw }
          dataClass: public
        - id: gw-salidas
          from: { node: gw }
          to: { node: salidas }
          dataClass: public
        - id: salidas-tablero
          from: { node: salidas }
          to: { node: tablero }
          dataClass: public
        - id: salidas-planificacion
          from: { node: salidas }
          to: { node: planificacion }
          dataClass: public
status: PILOT
---

Una terminal de ómnibus por la que pasan **41.000 pasajeros en un día de
semana**. Las pantallas de andén muestran destino, hora y andén: el servicio
de salidas le pregunta al sistema de planificación de la flota cada vez que
una pantalla se refresca.

El sistema de planificación reinicia todas las noches y, algunas veces,
también al mediodía. Cada reinicio son entre cuatro y once minutos sin
responder. El mes pasado sumaron **214 minutos**.

En esos minutos las pantallas no muestran una hora vieja. Muestran nada. Y
las salidas, mientras tanto, son exactamente las mismas que eran un minuto
antes: los ómnibus no cambian de andén porque un sistema esté reiniciando.

El jefe de terminal lo dice sin vueltas: *"Prefiero una pantalla que diga
'actualizado hace 6 minutos' antes que una pantalla apagada con cuarenta
personas preguntándome a mí."*

El equipo tiene **4 unidades operativas** y hoy usa 2.

**Agregá una pieza** para que la pantalla pueda seguir mostrando la última
tabla de salidas que conoce mientras el sistema de planificación no contesta,
y para que esa copia se siga actualizando cuando el sistema vuelve.
