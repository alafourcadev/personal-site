---
title: "Las dos áreas que arrancan el mismo lunes"
level: 2
role: greenfield
domain: salud
D1: 1
D2: 2
D3: 2
D4: 0
D5: 2
D6: 1
D7: 0
D8: 2
D9: 2
prerequisiteLevels: [1]
budget:
  opsUnits: 6
aiBudget: 'libre. Pedile nombres de piezas y patrones todo lo que quieras. Lo que no le pidas es cuántas bases van, porque esa respuesta depende de un dato que el modelo no tiene: cuántas personas hay para restaurarlas.'
lambda: 0.5
constraints:
  - metric: fotos de factura guardadas dentro de filas de la base
    operator: "="
    value: 0
    unit: fotos
  - metric: presupuesto operativo
    operator: "<="
    value: 6
    unit: unidades operativas
hiddenFacts:
  - fact: el área de sistemas de la obra social son dos personas, y una de las dos se va de licencia en enero.
    discoveryPath: 'la consigna dice cuánta gente hay para operar esto. Cada base que dibujes tiene un respaldo que configurar, una restauración que probar y una madrugada que alguien va a pasar despierto. Contá las bases y multiplicá.'
  - fact: la foto de la factura pesa entre dos y cinco megabytes, y hay unos cuatrocientos reintegros por mes.
    discoveryPath: 'la consigna te da el peso de la foto y el volumen mensual. Multiplicá por doce meses y preguntate qué le pasa al respaldo diario de una base que además guarda eso adentro.'
startingDesign:
  nodes: []
  edges: []
guarantees:
  - id: g-alta-con-respaldo
    label: el alta del afiliado termina en una base que se puede restaurar
    weight: 2
    predicate:
      op: path
      from:
        type: [service]
      to:
        type: [database]
        propEquals: { backup: "diario" }
    whyMissing: no hay ningún camino desde un servicio hasta una base con respaldo configurado. O no hay base, o la que hay no tiene copia.
    consequence: 'una base sin respaldo se comporta igual que la otra todos los días, y se comporta distinto exactamente un día. El padrón de afiliados es el dato que la obra social no puede reconstruir preguntando: si se pierde, se pierde el derecho de la gente a atenderse.'
  - id: g-foto-en-archivo
    label: la foto de la factura vive en un archivo de objetos, no adentro de la base
    weight: 2
    predicate:
      op: path
      from:
        type: [service]
      to:
        type: [object-storage]
    whyMissing: no hay ningún camino desde un servicio hasta un almacenamiento de objetos, así que las fotos de las facturas están viviendo dentro de las filas de la base.
    consequence: el respaldo diario pasa a copiar gigabytes de imágenes todas las noches, y restaurar deja de ser una operación de minutos. Una base que tarda seis horas en volver es una base que, en la práctica, no se restaura en horario de atención.
  - id: g-afiliado-por-la-puerta
    label: el afiliado llega al servicio a través de una puerta de entrada
    weight: 1
    predicate:
      op: path
      from:
        type: [web-client, mobile-client]
      to:
        type: [service]
      via:
        type: [api-gateway]
    whyMissing: no hay un camino desde el portal del afiliado hasta un servicio que pase por una puerta de entrada.
    consequence: sin una puerta adelante no hay dónde comprobar quién es el afiliado antes de que el pedido entre. Todo lo que venga después va a confiar en un dato que nadie verificó.
  - id: g-cada-base-tiene-dueno
    label: toda base del diseño tiene alguien que la escribe
    weight: 1
    predicate:
      op: covered
      target:
        type: [database]
      by:
        type: [service, worker]
    whyMissing: hay al menos una base sin ningún servicio ni procesador conectado.
    consequence: 'una base que nadie escribe es una base vacía, y una base vacía no falla: contesta. Contesta que no hay nada, y del otro lado alguien concluye que el afiliado no existe.'
rubric:
  - dimension: el padrón se puede restaurar
    signal:
      kind: predicate
      guaranteeId: g-alta-con-respaldo
  - dimension: las imágenes no engordan el respaldo
    signal:
      kind: predicate
      guaranteeId: g-foto-en-archivo
  - dimension: cada almacén dibujado tiene quien lo llene
    signal:
      kind: predicate
      guaranteeId: g-cada-base-tiene-dueno
referenceSolutions:
  - label: un solo servicio para los dos trámites
    contextInversion: 'un solo servicio gana mientras los dos trámites hablen del mismo afiliado y el equipo sea de dos personas. Un despliegue, un respaldo, una restauración que probar. Se paga el día que reintegros necesita un cambio de esquema y el alta de afiliados se despliega con él, quiera o no.'
    design:
      nodes:
        - id: afiliado
          type: actor
          label: Afiliado
          zone: public
        - id: portal
          type: web-client
          label: Portal del afiliado
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: afiliados
          type: service
          label: Servicio de afiliados
          zone: private
        - id: padron
          type: database
          label: Padrón de afiliados
          zone: restricted
          props: { backup: "diario" }
        - id: facturas
          type: object-storage
          label: Archivo de facturas
          zone: private
      edges:
        - id: afiliado-portal
          from: { node: afiliado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-afiliados
          from: { node: gw }
          to: { node: afiliados }
          dataClass: personal
        - id: afiliados-padron
          from: { node: afiliados }
          to: { node: padron }
          dataClass: personal
        - id: afiliados-facturas
          from: { node: afiliados }
          to: { node: facturas }
          dataClass: personal
  - label: un servicio y una base por área
    contextInversion: 'separar gana cuando los dos trámites tienen ritmos distintos de verdad. Reintegros se audita una vez por año y el padrón se toca todas las semanas: con dos bases, la auditoría no congela el padrón y la migración del padrón no tira abajo reintegros. Se paga con dos respaldos que configurar, dos restauraciones que probar y dos esquemas que mantener, con dos personas en sistemas y una de licencia en enero.'
    design:
      nodes:
        - id: afiliado
          type: actor
          label: Afiliado
          zone: public
        - id: portal
          type: web-client
          label: Portal del afiliado
          zone: public
        - id: gw
          type: api-gateway
          label: Puerta de entrada
          zone: dmz
        - id: altas
          type: service
          label: Servicio de altas
          zone: private
        - id: padron
          type: database
          label: Padrón de afiliados
          zone: restricted
          props: { backup: "diario" }
        - id: reintegros
          type: service
          label: Servicio de reintegros
          zone: private
        - id: pedidos
          type: database
          label: Base de reintegros
          zone: restricted
          props: { backup: "diario" }
        - id: facturas
          type: object-storage
          label: Archivo de facturas
          zone: private
      edges:
        - id: afiliado-portal
          from: { node: afiliado }
          to: { node: portal }
          dataClass: public
        - id: portal-gw
          from: { node: portal }
          to: { node: gw }
          dataClass: personal
        - id: gw-altas
          from: { node: gw }
          to: { node: altas }
          dataClass: personal
        - id: altas-padron
          from: { node: altas }
          to: { node: padron }
          dataClass: personal
        - id: gw-reintegros
          from: { node: gw }
          to: { node: reintegros }
          dataClass: personal
        - id: reintegros-pedidos
          from: { node: reintegros }
          to: { node: pedidos }
          dataClass: personal
        - id: reintegros-facturas
          from: { node: reintegros }
          to: { node: facturas }
          dataClass: personal
status: PILOT
---

Una obra social de cuarenta mil afiliados digitaliza dos trámites el mismo
lunes. El alta de un afiliado nuevo, que hoy se hace en ventanilla con una
carpeta. Y el pedido de reintegro, que hoy se hace entregando la factura en
papel y esperando quince días.

No hay nada construido. El lienzo está vacío de verdad.

Lo que se pidió, textual, en la reunión donde se aprobó el presupuesto:

> *"Que el afiliado se dé de alta desde el portal y que pueda mandar la foto de
> la factura sin venir hasta acá."*

**Ese enunciado no dice cuántas bases van, y esa es la decisión del ejercicio.**
Arreglar un diagrama te obliga a mirar lo que ya está dibujado. Acá lo que
decidís es qué se dibuja.

Los números que importan están en dos lados distintos. Son **400 reintegros por
mes** y cada foto de factura pesa entre 2 y 5 megabytes. Y en el área de
sistemas de la obra social hay **dos personas**, una de las cuales se toma
licencia todos los eneros.

Mariana, que dirige reintegros, quiere su propia base. Su argumento es correcto
y conviene leerlo entero: el día que auditen reintegros no quiere que nadie
toque el padrón, y el día que migren el padrón no quiere que se caiga
reintegros. Dos áreas que se auditan por separado y se rompen por separado.

El de sistemas dice que son dos personas y que dos bases son dos respaldos que
configurar, dos restauraciones que probar y dos madrugadas. También tiene razón,
y su razón es más fácil de comprobar: nadie prueba una restauración que no
tiene tiempo de probar.

Ninguno de los dos está exagerando. Elegí cuántas bases existen y decí qué te
llevaste puesto con esa elección.

**Lo que no es negociable.** La foto de la factura no va adentro de la base. Y
toda base que dibujes tiene que tener alguien que la escriba: una base sin
productor no falla, contesta que no hay nada, y del otro lado alguien concluye
que el afiliado no existe.
