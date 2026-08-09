---
title: "Las nueve causas que ninguna tabla acertó"
level: 10
role: counter-trap
domain: comercio
D1: 2
D2: 3
D3: 3
D4: 2
D5: 3
D6: 2
D7: 3
D8: 2
D9: 4
prerequisiteLevels: [9]
budget:
  opsUnits: 7
  monthlyUsd: 350
aiBudget: "libre, pero tu respuesta tiene que decir por qué acá sí y en el descuento no. Si la razón que das sirve para los dos casos, todavía no encontraste la razón."
lambda: 0.6
constraints:
  - metric: "devoluciones por día"
    operator: ">="
    value: 240
    unit: devoluciones
  - metric: "aciertos de la tabla de palabras clave"
    operator: "<="
    value: 38
    unit: por ciento
  - metric: "presupuesto operativo del equipo"
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: "la tabla de palabras clave tiene 14.000 reglas y acierta el 38 %. Cada campaña nueva la rompe: cuando entró la línea de bazar, 'se rompió' pasó a significar dos cosas distintas y hubo que reescribir 600 reglas."
    discoveryPath: "contá los casos posibles de la entrada, como hiciste con el descuento. Acá la entrada es texto libre escrito por 240.000 personas distintas: no se puede enumerar. Una tabla no lo cubre, lo aproxima, y la aproximación envejece con cada campaña."
  - fact: "el 22 % de las devoluciones entra por el botón 'me arrepentí' de la app, que manda siempre el mismo texto exacto. Ese 22 % no necesita que nadie lo interprete."
    discoveryPath: "separá lo que llega en texto libre de lo que llega desde un botón. Son dos entradas distintas por la misma puerta, y sólo una de las dos es ambigua."
  - fact: "son 240 devoluciones por día contra 6.800 pedidos. El proveedor cobra lo mismo por llamada en los dos flujos."
    discoveryPath: "multiplicá el costo por llamada por el volumen real de ESTE flujo, no por el de la tienda. El mismo precio por llamada es una factura seria en un flujo de 6.800 y es despreciable en uno de 240."
  - fact: "el modelo corre en la infraestructura de la tienda. El texto de una devolución trae direcciones, nombres de vecinos que recibieron el paquete y, cada tanto, un número de tarjeta que el cliente escribió a mano."
    discoveryPath: "mirá dónde está alojado el modelo y qué declara la conexión que le entra. Esa decisión ya está tomada en este sistema, y está tomada por lo que viaja, no por el precio."
  - fact: "la mesa de posventa son cinco personas. Hoy no reciben nada del sistema: abren la bandeja de correo y leen las devoluciones que el cliente insistió por segunda vez."
    discoveryPath: "está en el lienzo sin ninguna conexión. Un modelo que clasifica nueve causas va a devolver 'ninguna de las nueve' varias veces por día, y ese caso necesita a dónde ir."
startingDesign:
  nodes:
    - id: comprador
      type: actor
      label: "Cliente"
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: tienda
      type: web-client
      label: "Tienda en línea"
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: "Puerta de entrada"
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: devoluciones
      type: service
      label: "Servicio de devoluciones"
      zone: private
      role: devoluciones
      given: true
      props: { criticality: "high", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 410 }
    - id: tabla
      type: service
      label: "Servicio de reglas de palabras clave"
      zone: private
      role: tabla
      given: true
      props: { criticality: "medium", replicas: "2", idempotent: "sí" }
      position: { x: 445, y: 520 }
    - id: modelo
      type: ai-model
      label: "Modelo de clasificación propio"
      zone: private
      given: true
      props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
      position: { x: 445, y: 630 }
    - id: mesa
      type: worker
      label: "Mesa de posventa"
      zone: private
      role: mesa
      given: true
      props: { idempotent: "sí", retryPolicy: "exponential" }
      position: { x: 445, y: 300 }
  edges:
    - id: comprador-tienda
      from: { node: comprador }
      to: { node: tienda }
      dataClass: public
    - id: tienda-gw
      from: { node: tienda }
      to: { node: gw }
      dataClass: personal
    - id: gw-devoluciones
      from: { node: gw }
      to: { node: devoluciones }
      dataClass: personal
    - id: devoluciones-tabla
      from: { node: devoluciones }
      to: { node: tabla }
      dataClass: personal
guarantees:
  - id: g-el-texto-libre-llega-al-modelo
    label: "el texto que escribió el cliente llega al modelo de clasificación"
    weight: 3
    predicate:
      op: path
      from:
        role: devoluciones
      to:
        type: [ai-model]
    whyMissing: "no hay ningún camino desde el servicio de devoluciones hasta el modelo de clasificación, que está en el lienzo sin recibir nada."
    consequence: "la causa de una devolución llega escrita por el cliente, con sus palabras: 'me mandaron un talle que no pedí y la caja venía abierta'. Eso no se enumera en una tabla, y las 14.000 reglas que lo intentaron aciertan el 38 %. El 62 % restante se rutea mal, vuelve como reclamo y termina en la mesa de posventa dos días tarde."
  - id: g-la-tabla-sale-del-camino-de-entrada
    label: "el servicio de devoluciones ya no rutea con la tabla de palabras clave"
    weight: 3
    predicate:
      op: edgeAbsent
      from:
        role: devoluciones
      to:
        role: tabla
    whyMissing: "el servicio de devoluciones sigue conectado directo a la tabla de palabras clave, que es la pieza que produce el 62 % de errores."
    consequence: "una tabla de palabras clave sobre texto libre no es determinismo: es una aproximación con apariencia de regla. Cada campaña nueva le cambia el significado a una palabra y hay que reescribir seiscientas reglas, que es exactamente el trabajo que nadie tiene tiempo de hacer. Determinista y correcto no son la misma cosa."
  - id: g-lo-que-no-encaja-llega-a-una-persona
    label: "hay un camino desde el servicio de devoluciones hasta la mesa de posventa"
    weight: 2
    predicate:
      op: path
      from:
        role: devoluciones
      to:
        role: mesa
    whyMissing: "no hay ningún camino desde el servicio de devoluciones hasta la mesa de posventa, que hoy está en el lienzo sin recibir nada."
    consequence: "un clasificador de nueve causas devuelve 'ninguna de las nueve' varias veces por día, y ese caso necesita a dónde ir. Sin ese camino, las cinco personas de posventa se siguen enterando por la bandeja de correo, cuando el cliente insiste por segunda vez."
rubric:
  - dimension: "la interpretación del texto libre la hace quien puede hacerla"
    signal:
      kind: predicate
      guaranteeId: g-el-texto-libre-llega-al-modelo
  - dimension: "la falsa regla deja de decidir"
    signal:
      kind: predicate
      guaranteeId: g-la-tabla-sale-del-camino-de-entrada
  - dimension: "lo que el modelo no puede clasificar tiene salida humana"
    signal:
      kind: predicate
      guaranteeId: g-lo-que-no-encaja-llega-a-una-persona
referenceSolutions:
  - label: "el servicio de devoluciones clasifica en el momento y la tabla se va"
    contextInversion: "clasificar dentro de la misma llamada conviene cuando el cliente está mirando la pantalla: escribe por qué devuelve, y en el mismo paso ve a dónde va el paquete y qué tiene que imprimir. Con 240 devoluciones diarias y el modelo corriendo adentro, el ritmo entra sin amortiguación y el diseño queda en cuatro piezas para operar, tres menos que el techo. Se paga con que una demora del modelo se le nota al cliente, y con que se pierde el atajo barato del 22 % que entra por el botón: todo pasa por el clasificador."
    design:
      nodes:
        - id: comprador
          type: actor
          label: "Cliente"
          zone: public
        - id: tienda
          type: web-client
          label: "Tienda en línea"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: devoluciones
          type: service
          label: "Servicio de devoluciones"
          zone: private
          role: devoluciones
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de clasificación propio"
          zone: private
          props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
        - id: mesa
          type: worker
          label: "Mesa de posventa"
          zone: private
          role: mesa
          props: { idempotent: "sí", retryPolicy: "exponential" }
      edges:
        - id: comprador-tienda
          from: { node: comprador }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-devoluciones
          from: { node: gw }
          to: { node: devoluciones }
          dataClass: personal
        - id: devoluciones-modelo
          from: { node: devoluciones }
          to: { node: modelo }
          dataClass: personal
        - id: devoluciones-mesa
          from: { node: devoluciones }
          to: { node: mesa }
          dataClass: personal
  - label: "una cola, un clasificador, y la tabla degradada a atajo del botón"
    contextInversion: "diferir la clasificación conviene porque el cliente ya se fue: apretó devolver, imprimió la etiqueta y el paquete tarda dos días en llegar al depósito. Nada se decide en ese segundo. El proceso de clasificación puede entonces preguntarle primero a la tabla, porque el 22 % que entra por el botón 'me arrepentí' manda siempre el mismo texto y se resuelve sin llamar a nadie, y usar el modelo sólo para el texto libre, que es donde hace falta. Se paga con las siete unidades operativas completas y con dos piezas más que un equipo chico tiene que sostener."
    design:
      nodes:
        - id: comprador
          type: actor
          label: "Cliente"
          zone: public
        - id: tienda
          type: web-client
          label: "Tienda en línea"
          zone: public
        - id: gw
          type: api-gateway
          label: "Puerta de entrada"
          zone: dmz
        - id: devoluciones
          type: service
          label: "Servicio de devoluciones"
          zone: private
          role: devoluciones
          props: { criticality: "high", replicas: "2", idempotent: "sí" }
        - id: cola
          type: queue
          label: "Cola de devoluciones por clasificar"
          zone: private
          props: { delivery: "at-least-once", dlq: "sí" }
        - id: clasificador
          type: worker
          label: "Proceso de clasificación"
          zone: private
          props: { idempotent: "sí", retryPolicy: "exponential" }
        - id: tabla
          type: service
          label: "Servicio de reglas de palabras clave"
          zone: private
          role: tabla
          props: { criticality: "medium", replicas: "2", idempotent: "sí" }
        - id: modelo
          type: ai-model
          label: "Modelo de clasificación propio"
          zone: private
          props: { hosting: "interno", deterministic: "no", piiPolicy: "restricted" }
        - id: mesa
          type: worker
          label: "Mesa de posventa"
          zone: private
          role: mesa
          props: { idempotent: "sí", retryPolicy: "exponential" }
      edges:
        - id: comprador-tienda
          from: { node: comprador }
          to: { node: tienda }
          dataClass: public
        - id: tienda-gw
          from: { node: tienda }
          to: { node: gw }
          dataClass: personal
        - id: gw-devoluciones
          from: { node: gw }
          to: { node: devoluciones }
          dataClass: personal
        - id: devoluciones-cola
          from: { node: devoluciones }
          to: { node: cola }
          dataClass: personal
        - id: cola-clasificador
          from: { node: cola }
          to: { node: clasificador }
          dataClass: personal
        - id: clasificador-tabla
          from: { node: clasificador }
          to: { node: tabla }
          dataClass: personal
        - id: clasificador-modelo
          from: { node: clasificador }
          to: { node: modelo }
          dataClass: personal
        - id: devoluciones-mesa
          from: { node: devoluciones }
          to: { node: mesa }
          dataClass: personal
status: PILOT
---

La misma distribuidora, otro flujo. **240 devoluciones por día**, y cada una
llega con el cliente explicando por qué:

> *"me mandaron un talle que no pedí y encima la caja venía abierta, el
> precinto estaba cortado"*

Hay **nueve causas** posibles y cada una manda el paquete a un lugar distinto:
falla de fábrica va al proveedor, error de armado vuelve al depósito, daño en
tránsito abre un reclamo al transportista, arrepentimiento va directo a
reintegro. La causa decide quién paga.

El equipo viene del episodio del descuento y aprendió la lección al revés.
Cuando alguien propuso un modelo, la respuesta fue: *"no, hagamos una tabla,
las tablas se explican"*. La tabla existe: **14.000 reglas de palabras clave**
y **38 % de aciertos**. Cuando entró la línea de bazar, "se rompió" pasó a
significar dos cosas distintas y hubo que reescribir seiscientas reglas.

El 62 % que la tabla rutea mal vuelve como reclamo y termina, dos días después,
en la **mesa de posventa**: cinco personas que hoy no reciben nada del sistema
y se enteran cuando el cliente insiste por segunda vez.

Tres datos para tener a mano. El **22 %** de las devoluciones entra por el botón
*"me arrepentí"* de la app, que manda siempre el mismo texto exacto. El modelo
de clasificación **corre en la infraestructura de la tienda**, porque el texto
trae direcciones, nombres de vecinos y a veces un número de tarjeta escrito a
mano. Y son 240 llamadas por día, no 6.800: el mismo precio por llamada que
allá era una factura seria, acá es despreciable.

El equipo tiene un techo de **7 unidades operativas** y hoy usa 5.

Antes de mover una conexión, contestá la misma pregunta que la vez pasada:
**¿qué información tiene el modelo que la regla no tenga?** Acá la respuesta es
distinta, y la diferencia no está en el modelo: está en la entrada. Un texto
libre escrito por 240.000 personas no se enumera, y lo que no se enumera no
tiene tabla: sólo tiene aproximaciones que envejecen.

**Rearmá el sistema** para que la causa de cada devolución la decida la pieza
que puede leer texto libre, para que la tabla deje de rutear lo que no sabe
rutear, y para que lo que no encaje en ninguna de las nueve causas llegue a una
persona.
