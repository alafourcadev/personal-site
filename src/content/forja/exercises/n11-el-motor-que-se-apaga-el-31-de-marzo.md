---
title: "El motor que se apaga el 31 de marzo"
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
D7: 2
D8: 2
D9: 3
prerequisiteLevels: [10]
budget:
  opsUnits: 7
aiBudget: "libre, pero la respuesta tiene que explicar por qué acá el motor viejo deja de recibir escrituras, y por qué eso sería un error en el ejercicio anterior."
lambda: 0.5
constraints:
  - metric: fecha límite en que el motor viejo deja de tener licencia
    operator: "<="
    value: 0
    unit: prórrogas concedidas
  - metric: historial de reservas que debe seguir siendo consultable
    operator: ">="
    value: 10
    unit: años
hiddenFacts:
  - fact: "el motor viejo corre sobre una plataforma licenciada cuyo contrato termina el 31 de marzo. El proveedor ya rechazó por escrito la prórroga: no es una fecha interna que se pueda mover en una reunión."
    discoveryPath: "es la restricción que da vuelta la decisión respecto del ejercicio anterior. Cuando volver atrás deja de ser una opción disponible, todo lo que se hacía para conservarla pasa a ser costo puro."
  - fact: "cada reserva que sigue entrando al motor viejo es trabajo que va a haber que migrar dos veces: una ahora y otra antes del 31 de marzo. Al ritmo actual son 40.000 reservas por día de deuda que crece sola."
    discoveryPath: "preguntate qué pasa con lo que el motor viejo escriba mañana. Si el motor se apaga en una fecha fija, cada escritura nueva de ese lado es una migración pendiente más, no un respaldo."
  - fact: "el tráfico del sitio no es el único que entra al motor viejo: el canal de agencias, que trae el 30 % de las reservas, también le escribe. Es la fuente que nadie mira porque no pasa por la pantalla que todos usan."
    discoveryPath: "seguí todas las flechas que terminan en el motor viejo, no sólo la que sale de la puerta de entrada. La deuda de migración la alimenta cualquiera que escriba de ese lado."
  - fact: "diez años de historial de reservas viven en la base vieja y siguen haciendo falta: reclamos, auditorías de facturación y disputas con agencias se resuelven mirando reservas de hace años."
    discoveryPath: "apagá el acceso a la base vieja y preguntate quién pierde. El historial no es un archivo muerto: es lo que se consulta cada vez que alguien discute una factura de hace tres años."
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
    - id: canal
      type: service
      label: Canal de agencias
      zone: private
      given: true
      props: { criticality: "high", replicas: "2" }
      position: { x: 445, y: 520 }
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
    - id: gw-canal
      from: { node: gw }
      to: { node: canal }
      dataClass: personal
    - id: canal-viejo
      from: { node: canal }
      to: { node: viejo }
      dataClass: personal
guarantees:
  - id: g-legacy-frozen
    label: ningún sistema le manda trabajo nuevo al motor viejo
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        type: [service, worker]
      to:
        role: legacy-engine
    whyMissing: hay un servicio o un proceso de fondo que le sigue mandando trabajo al motor viejo.
    consequence: "cada reserva que entra al motor viejo es trabajo que va a haber que migrar dos veces: una ahora y otra antes del 31 de marzo. A 40.000 reservas por día, mantenerlo al día no es un respaldo, es una deuda que crece sola y vence en una fecha que nadie puede mover."
  - id: g-legacy-standing
    label: el motor viejo sigue desplegado hasta que termine la exportación
    weight: 1
    predicate:
      op: exists
      node:
        type: [service]
        role: legacy-engine
    whyMissing: el motor viejo no está en el diseño. Congelarlo no es lo mismo que borrarlo.
    consequence: "el motor viejo es lo único que sabe interpretar diez años de reservas con su lógica de tarifas, cancelaciones y penalidades. Darlo de baja antes de terminar la exportación deja los datos escritos y el sentido perdido: quedan filas que nadie sabe leer."
  - id: g-history-reachable
    label: los diez años de historial se consultan sin pasar por el motor viejo
    weight: 2
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: legacy-store
      forbid:
        role: legacy-engine
    whyMissing: el único camino desde la puerta de entrada hasta la base vieja pasa por el motor viejo, o directamente no hay camino. El historial tiene que poder leerse de la base congelada sin depender del sistema que se apaga.
    consequence: "reclamos, auditorías de facturación y disputas con agencias se resuelven mirando reservas de hace años. Si esa lectura viaja por el motor viejo, el 31 de marzo el historial se apaga junto con él: los datos siguen en el disco y nadie los puede consultar. Y sin ningún camino, cada consulta pasa a ser un pedido manual al equipo de datos, y una discusión de facturación que se resolvía en un minuto tarda una semana."
  - id: g-no-front-door-to-legacy
    label: la puerta de entrada ya no llama al motor viejo
    weight: 1
    predicate:
      op: edgeAbsent
      from:
        type: [api-gateway]
      to:
        role: legacy-engine
    whyMissing: la puerta de entrada sigue teniendo una conexión directa al motor viejo, así que el tráfico de reservas todavía puede terminar del lado que se apaga.
    consequence: "el 31 de marzo esa conexión deja de responder. No hay despliegue que la salve ni prórroga que la postergue: la parte del tráfico que todavía la use deja de funcionar ese día, y el diagrama de hoy es la única oportunidad de encontrarla."
  - id: g-new-live
    label: el motor nuevo atiende todas las reservas
    weight: 1
    predicate:
      op: path
      from:
        type: [api-gateway]
      to:
        role: new-engine
    whyMissing: no hay ningún camino desde la puerta de entrada hasta el motor nuevo.
    consequence: "con una fecha de apagado fija, cada día que el motor nuevo no atiende es un día menos para descubrir sus problemas. El margen no se recupera: el 31 de marzo llega igual, con el motor nuevo probado o sin probar."
rubric:
  - dimension: la deuda de migración deja de crecer
    signal:
      kind: predicate
      guaranteeId: g-legacy-frozen
  - dimension: el sistema viejo se congela sin borrarse
    signal:
      kind: predicate
      guaranteeId: g-legacy-standing
  - dimension: el historial se lee de la base congelada, no del sistema que se apaga
    signal:
      kind: predicate
      guaranteeId: g-history-reachable
  - dimension: no queda ninguna ruta de tráfico apuntando a lo que se apaga
    signal:
      kind: predicate
      guaranteeId: g-no-front-door-to-legacy
  - dimension: el motor nuevo acumula tiempo real de vuelo antes de la fecha
    signal:
      kind: predicate
      guaranteeId: g-new-live
referenceSolutions:
  - label: el motor nuevo lee el historial congelado
    contextInversion: "que el propio motor nuevo lea la base congelada conviene cuando el historial se consulta desde la misma pantalla que las reservas vivas: el huésped y el operador ven una sola línea de tiempo, sin saber que la mitad viene de un lado que ya no escribe. Es la forma más barata de operar, una pieza menos, y el precio es que el motor nuevo se acopla al esquema de la base vieja, así que la exportación final va a tener que cambiarlo a él también."
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
        - id: nuevo
          type: service
          label: Motor de reservas (nuevo)
          zone: private
          role: new-engine
          props: { criticality: "high", replicas: "2" }
        - id: viejo
          type: service
          label: Motor de reservas (viejo, congelado)
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
        - id: huesped-web
          from: { node: huesped }
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
        - id: nuevo-dbnuevo
          from: { node: nuevo }
          to: { node: dbnuevo }
          dataClass: personal
        - id: nuevo-dbviejo
          from: { node: nuevo }
          to: { node: dbviejo }
          dataClass: personal
        - id: viejo-dbviejo
          from: { node: viejo }
          to: { node: dbviejo }
          dataClass: personal
  - label: un servicio de consulta histórica aparte
    contextInversion: "separar la consulta del historial en su propio servicio conviene cuando la exportación va a durar meses y no querés que el motor nuevo, el que tiene que estar impecable el 31 de marzo, cargue con el esquema de la base vieja: el día que la exportación termine, se apaga ese servicio y nadie más se entera. Se paga con una unidad operativa más y con dos caminos de lectura que el operador tiene que entender como uno solo."
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
        - id: nuevo
          type: service
          label: Motor de reservas (nuevo)
          zone: private
          role: new-engine
          props: { criticality: "high", replicas: "2" }
        - id: historico
          type: service
          label: Consulta de historial
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: viejo
          type: service
          label: Motor de reservas (viejo, congelado)
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
        - id: gw-nuevo
          from: { node: gw }
          to: { node: nuevo }
          dataClass: personal
        - id: gw-historico
          from: { node: gw }
          to: { node: historico }
          dataClass: personal
        - id: historico-dbviejo
          from: { node: historico }
          to: { node: dbviejo }
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

La misma cadena hotelera, el mismo motor de reservas nuevo. Cambió una sola
cosa, y da vuelta la respuesta entera.

El motor viejo corre sobre una plataforma licenciada. **El contrato termina
el 31 de marzo** y el proveedor ya rechazó la prórroga por escrito. No es una
fecha interna que se mueva en una reunión: es una fecha en la que el sistema
deja de tener derecho a ejecutarse.

Eso convierte en costo puro todo lo que en el ejercicio anterior era
prudencia. Mantener al motor viejo al día servía para poder volver a él.
**Acá no hay a dónde volver.** Cada reserva que le sigue entrando es trabajo
que va a haber que migrar dos veces: una ahora y otra antes de marzo. A
40.000 reservas por día, eso es una deuda que crece sola y vence en una fecha
que nadie puede mover.

Y el sitio no es el único que le escribe. **El canal de agencias trae el 30 %
de las reservas** y también termina en el motor viejo. Es el que nadie mira,
porque no pasa por la pantalla que todos usan.

Pero congelarlo no es borrarlo, y ahí está la segunda mitad del problema.

**Diez años de historial de reservas viven en la base vieja** y siguen
haciendo falta todos los días: reclamos, auditorías de facturación, disputas
con agencias. Se resuelven mirando reservas de hace años. El motor viejo se
queda desplegado hasta que termine la exportación, porque es lo único que sabe
interpretar esas filas con su lógica de tarifas, cancelaciones y penalidades.

Pero **el historial no se puede leer a través de él.** El 31 de marzo el motor
viejo deja de tener derecho a ejecutarse: si la consulta de historial viaja por
ahí, ese día el historial se apaga junto con el motor. Los datos siguen en el
disco y nadie los puede mirar.

Hay una tercera cosa, y es la que se olvida. El 31 de marzo, cualquier
conexión que todavía apunte al motor viejo deja de responder. No hay
despliegue que la salve. **El diagrama de hoy es la única oportunidad de
encontrarlas todas.**

**Rearmá el sistema** para que el motor nuevo atienda todas las reservas, para
que ningún sistema le siga mandando trabajo al viejo, y para que los diez años
de historial se sigan consultando desde la base congelada, sin pasar por el
motor viejo, mientras éste, congelado, espera el final de la exportación.
