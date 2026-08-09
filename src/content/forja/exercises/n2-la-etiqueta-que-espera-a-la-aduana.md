---
title: "La etiqueta que espera a la aduana"
level: 2
role: core
domain: logistica
D1: 1
D2: 1
D3: 2
D4: 1
D5: 2
D6: 1
D7: 1
D8: 0
D9: 1
prerequisiteLevels: [1]
budget:
  opsUnits: 7
aiBudget: "libre, pero tu respuesta tiene que decir, en tus palabras, cada cuánto cambia la clasificación aduanera y cada cuánto se imprime una etiqueta. La diferencia entre esos dos números es todo el ejercicio."
lambda: 0.5
constraints:
  - metric: etiquetas impresas en un turno de depósito
    operator: ">="
    value: 5200
    unit: etiquetas/turno
  - metric: presupuesto operativo
    operator: "<="
    value: 7
    unit: unidades operativas
hiddenFacts:
  - fact: la clasificación aduanera de un producto cambia como mucho una vez por trimestre. La etiqueta se imprime miles de veces por turno.
    discoveryPath: "compará las dos frecuencias del enunciado. Una pieza que cambia una vez por trimestre no pertenece al camino de algo que ocurre miles de veces por día. La está frenando sin aportar nada nuevo."
  - fact: el servicio de aduana consulta un organismo externo con un tiempo de respuesta que va de 200 milisegundos a 40 segundos.
    discoveryPath: "seguí la única flecha que sale del sistema hacia afuera y fijate quién queda esperando detrás de ella. Todo lo que esté aguas arriba de esa flecha hereda su peor día."
startingDesign:
  nodes:
    - id: operador
      type: actor
      label: Operador de depósito
      zone: public
      given: true
      position: { x: 85, y: 80 }
    - id: panel
      type: web-client
      label: Panel de depósito
      zone: public
      given: true
      position: { x: 445, y: 80 }
    - id: gw
      type: api-gateway
      label: Puerta de entrada
      zone: dmz
      given: true
      position: { x: 445, y: 190 }
    - id: etiquetas
      type: service
      label: Servicio de etiquetas
      zone: private
      role: label-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 410 }
    - id: etiquetasdb
      type: database
      label: Base de etiquetas
      zone: restricted
      role: label-db
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 410 }
    - id: aduana
      type: service
      label: Servicio de clasificación aduanera
      zone: private
      role: customs-service
      given: true
      props: { criticality: "medium", replicas: "2" }
      position: { x: 445, y: 520 }
    - id: aduanadb
      type: database
      label: Base de clasificaciones
      zone: restricted
      given: true
      props: { backup: "diario" }
      position: { x: 805, y: 520 }
    - id: transportista
      type: external-provider
      label: Transportista
      zone: dmz
      role: carrier
      given: true
      position: { x: 445, y: 300 }
  edges:
    - id: operador-panel
      from: { node: operador }
      to: { node: panel }
      dataClass: public
    - id: panel-gw
      from: { node: panel }
      to: { node: gw }
      dataClass: personal
    - id: gw-etiquetas
      from: { node: gw }
      to: { node: etiquetas }
      dataClass: personal
    - id: etiquetas-etiquetasdb
      from: { node: etiquetas }
      to: { node: etiquetasdb }
      dataClass: personal
    - id: etiquetas-aduana
      from: { node: etiquetas }
      to: { node: aduana }
      dataClass: personal
    - id: aduana-aduanadb
      from: { node: aduana }
      to: { node: aduanadb }
      dataClass: public
    - id: aduana-transportista
      from: { node: aduana }
      to: { node: transportista }
      dataClass: personal
guarantees:
  - id: g-label-reaches-carrier
    label: la etiqueta llega al transportista sin pasar por la clasificación aduanera
    weight: 2
    predicate:
      op: path
      from:
        role: label-service
      to:
        role: carrier
      forbid:
        role: customs-service
    whyMissing: no hay ningún camino desde el servicio de etiquetas hasta el transportista que no atraviese el servicio de clasificación aduanera.
    consequence: "el peor día de la aduana pasa a ser el peor día del depósito. Cuando el organismo externo tarda 40 segundos, la cinta de empaque se detiene por algo que no tiene nada que ver con empacar: la disponibilidad de una pieza que cambia una vez por trimestre gobierna una operación que ocurre miles de veces por turno."
  - id: g-no-customs-call
    label: el servicio de etiquetas no llama a la clasificación aduanera
    weight: 2
    predicate:
      op: edgeAbsent
      from:
        role: label-service
      to:
        role: customs-service
    whyMissing: hay una conexión que sale del servicio de etiquetas y entra al servicio de clasificación aduanera.
    consequence: mientras esa llamada exista, cada despliegue de aduana es una ventana de riesgo para el empaque, y cada incidente de aduana se abre como incidente de depósito. Dos ritmos de cambio distintos comparten un solo destino de falla.
  - id: g-label-owns-store
    label: el servicio de etiquetas conserva su propio almacenamiento
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: label-db
        - op: covered
          target:
            role: label-db
          by:
            role: label-service
    whyMissing: la base de etiquetas no existe, o no está conectada al servicio de etiquetas.
    consequence: sin su propio registro, el depósito no puede reimprimir una etiqueta ni decir qué se despachó cuando el transportista reclama. Cortar una dependencia no puede costar el dato del que sí somos dueños.
  - id: g-customs-still-there
    label: la clasificación aduanera sigue existiendo y con su dato conectado
    weight: 1
    predicate:
      op: all
      of:
        - op: exists
          node:
            role: customs-service
        - op: covered
          target:
            role: customs-service
          by:
            type: [database, service, worker]
    whyMissing: el servicio de clasificación aduanera no existe, o quedó suelto sin ninguna pieza conectada.
    consequence: la clasificación es una obligación legal del importador, no una función opcional. Sacarla del camino de la etiqueta es la decisión correcta; borrarla es una multa.
rubric:
  - dimension: el camino crítico no hereda la latencia de lo que no le pertenece
    signal:
      kind: predicate
      guaranteeId: g-label-reaches-carrier
  - dimension: dos ritmos de cambio distintos no comparten destino de falla
    signal:
      kind: predicate
      guaranteeId: g-no-customs-call
  - dimension: cada pieza conserva el dato del que responde
    signal:
      kind: predicate
      guaranteeId: g-label-owns-store
  - dimension: sacar del camino no es borrar la obligación
    signal:
      kind: predicate
      guaranteeId: g-customs-still-there
referenceSolutions:
  - label: el depósito le habla directo al transportista
    contextInversion: "hablarle directo al transportista es lo correcto cuando hay un solo transportista con un contrato estable y el equipo no quiere pagar una pieza intermedia que sólo traduce. Se paga con que el día que entre un segundo transportista, el cambio se hace adentro del servicio de etiquetas, que es la pieza que menos querés tocar."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de depósito
          zone: public
        - id: panel
          type: web-client
          label: Panel de depósito
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: etiquetas
          type: service
          label: Servicio de etiquetas
          zone: private
          role: label-service
          props: { criticality: "medium", replicas: "2" }
        - id: etiquetasdb
          type: database
          label: Base de etiquetas
          zone: restricted
          role: label-db
          props: { backup: "diario" }
        - id: aduana
          type: service
          label: Servicio de clasificación aduanera
          zone: private
          role: customs-service
          props: { criticality: "medium", replicas: "2" }
        - id: aduanadb
          type: database
          label: Base de clasificaciones
          zone: restricted
          props: { backup: "diario" }
        - id: transportista
          type: external-provider
          label: Transportista
          zone: dmz
          role: carrier
      edges:
        - id: operador-panel
          from: { node: operador }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-etiquetas
          from: { node: gw }
          to: { node: etiquetas }
          dataClass: personal
        - id: etiquetas-etiquetasdb
          from: { node: etiquetas }
          to: { node: etiquetasdb }
          dataClass: personal
        - id: etiquetas-transportista
          from: { node: etiquetas }
          to: { node: transportista }
          dataClass: personal
        - id: gw-aduana
          from: { node: gw }
          to: { node: aduana }
          dataClass: public
        - id: aduana-aduanadb
          from: { node: aduana }
          to: { node: aduanadb }
          dataClass: public
  - label: una pieza que se queda con la integración del transportista
    contextInversion: "aislar la integración conviene cuando hay más de un transportista, o cuando se sabe que va a haber uno más: el formato de etiqueta, los reintentos y las particularidades de cada transportista quedan en una pieza que se puede cambiar sin abrir el servicio de etiquetas. Se paga con una unidad operativa más y con un salto adicional en un camino que corre miles de veces por turno."
    design:
      nodes:
        - id: operador
          type: actor
          label: Operador de depósito
          zone: public
        - id: panel
          type: web-client
          label: Panel de depósito
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: etiquetas
          type: service
          label: Servicio de etiquetas
          zone: private
          role: label-service
          props: { criticality: "medium", replicas: "2" }
        - id: etiquetasdb
          type: database
          label: Base de etiquetas
          zone: restricted
          role: label-db
          props: { backup: "diario" }
        - id: integracion
          type: service
          label: Integración con transportistas
          zone: private
          props: { criticality: "medium", replicas: "2" }
        - id: aduana
          type: service
          label: Servicio de clasificación aduanera
          zone: private
          role: customs-service
          props: { criticality: "medium", replicas: "2" }
        - id: aduanadb
          type: database
          label: Base de clasificaciones
          zone: restricted
          props: { backup: "diario" }
        - id: transportista
          type: external-provider
          label: Transportista
          zone: dmz
          role: carrier
      edges:
        - id: operador-panel
          from: { node: operador }
          to: { node: panel }
          dataClass: public
        - id: panel-gw
          from: { node: panel }
          to: { node: gw }
          dataClass: personal
        - id: gw-etiquetas
          from: { node: gw }
          to: { node: etiquetas }
          dataClass: personal
        - id: etiquetas-etiquetasdb
          from: { node: etiquetas }
          to: { node: etiquetasdb }
          dataClass: personal
        - id: etiquetas-integracion
          from: { node: etiquetas }
          to: { node: integracion }
          dataClass: personal
        - id: integracion-transportista
          from: { node: integracion }
          to: { node: transportista }
          dataClass: personal
        - id: gw-aduana
          from: { node: gw }
          to: { node: aduana }
          dataClass: public
        - id: aduana-aduanadb
          from: { node: aduana }
          to: { node: aduanadb }
          dataClass: public
status: PILOT
---

Un depósito de comercio exterior imprime **5.200 etiquetas por turno**. El
operador escanea el bulto, el sistema arma la etiqueta y la manda al
transportista, que devuelve el número de seguimiento.

Cuando se armó el sistema, alguien notó que la etiqueta lleva la posición
arancelaria del producto. Y como el servicio de clasificación aduanera ya
sabía eso, la etiqueta se armó **desde ahí**: etiquetas llama a aduana, aduana
consulta el organismo externo, y de paso aduana habla con el transportista.

La posición arancelaria de un producto **cambia como mucho una vez por
trimestre**. El organismo externo responde entre 200 milisegundos y **40
segundos**, y el martes pasado estuvo caído dos horas y diez minutos. En esas
dos horas no se imprimió una sola etiqueta, aunque la clasificación de todos
los productos del depósito estaba guardada desde marzo.

El jefe de depósito pide una cosa concreta: que **empacar no dependa de la
aduana**. El responsable de comercio exterior pide la otra mitad: que la
clasificación se siga haciendo, porque es una obligación del importador y una
multa si falta.

El equipo tiene **7 unidades operativas** y hoy usa 5.

**Rearmá el sistema** para que el camino de la etiqueta no atraviese algo que
cambia mil veces menos seguido que ella.
