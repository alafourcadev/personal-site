---
title: "Qué cuidar depende de lo que no podés permitirte que falle"
description: "El peor error del súper se arregla con una nota de crédito. En salud no hay rollback. Eso decide qué testear, no el catálogo de tests. #100ArchitectureDays"
tags: ["Java", "Architecture", "Testing", "100ArchitectureDays"]
date: 2026-08-25
readTime: "14 min read"
image: "/blog/day-026-criticidad-del-dominio-que-testear-v2.webp"
draft: false
day: 26
---

Un amigo te escribe un sábado a la tarde. "Che, armé una aplicación para un supermercado. Cajas, stock, precios, promociones. ¿De qué me tengo que cuidar?"

Es una pregunta honesta y la tentación es contestarla con una lista: tests unitarios para las reglas, de integración para la base, de contrato entre los servicios, algo de concurrencia, un end-to-end del checkout. Todo correcto. Todo inútil como respuesta, porque esa lista es la misma que le darías si en vez de un supermercado te hubiera escrito alguien que arma software para una clínica.

La pregunta que en realidad le hace falta no es de qué tipos de test disponés. Es **qué es lo peor que puede pasar en su sistema, y quién lo paga**. Las últimas dos entregas de esta serie fueron sobre causas puntuales de por qué [verificar se te vuelve el cuello de botella](/blog/cuello-de-botella-verificacion): [cada mock que escribís es una dependencia que no invertiste](/blog/mocks-dependencias-sin-invertir), y el estado que nunca fijaste. Hoy freno un escalón antes de esas dos, porque ambas asumen algo que nadie se preguntó primero: para qué parte de tu sistema vale la pena pagar ese precio.

## Sábado 19:40, caja 3

La fila en caja 3 tiene ocho personas. La cajera pasa la tarjeta del primero. El posnet queda en "procesando" y se congela: no imprime, no confirma, no dice nada. Con la fila mirando, la cajera vuelve a pasar la tarjeta. Esta vez sale el comprobante. El cliente se va con las bolsas. El lunes, revisando el resumen, tiene dos cargos de $47.300 por la misma compra. Nadie se equivocó: la cajera hizo lo que hace siempre y el sistema hizo lo que el código le decía. El problema es que, para ese sistema, "reintentar" y "cobrar de nuevo" eran la misma operación.

A las 19:41, caja 3 y caja 7 escanean el mismo código de barras a la vez: la última unidad de aceite en oferta. Las dos pantallas dicen "disponible". Las dos ventas se confirman. El stock queda en -1, un número que en la base no debería poder existir y que existe igual.

El cartel de la góndola dice $890. El ticket dice $1.050. El cartel lo actualizó una persona con una pistola de etiquetas a las 14:00. El precio del sistema de cobro lo actualiza un job que corre a las 3 de la mañana. Entre esas dos horas, la góndola y la caja cuentan la verdad de dos días distintos.

El cliente lleva dos paquetes de café en promoción 2x1 y además es socio del club, que da 15% sobre toda la compra. El sistema aplica primero el 2x1 (uno de los dos cafés queda a $0) y después el 15% del club sobre el total ya rebajado, café gratis incluido. El resultado es que paga menos que el costo de un solo café. Nadie definió qué pasa cuando dos reglas compiten por el mismo ítem: el código simplemente las aplicó en el orden en que estaban escritas.

A las 22:00 cierra la caja 3. La cajera cuenta el efectivo: $181.750. El sistema dice que debería haber $184.200. La diferencia de $2.450 no es un error de conteo, son dos ventas que el sistema de cobro registró pero que la caja nunca imprimió. Sin un cierre que compare dos fuentes independientes, esa plata faltante habría quedado adentro del reporte del día como si nunca hubiera pasado.

Cinco escenas, cinco categorías: idempotencia, concurrencia, consistencia entre sistemas que se actualizan en momentos distintos, composición de reglas, y una cuadratura que actúa de oráculo independiente del propio sistema de ventas. Esa es la lista real de "de qué te tenés que cuidar" en un supermercado.

## La misma aplicación, pero de salud

Tu amigo te vuelve a escribir seis meses después. Ahora construye el mismo tipo de sistema (carga de datos, reglas de negocio, un cálculo que depende de varias cosas) pero para una clínica: pacientes, dosis, turnos, historia clínica. Le preguntás lo mismo y las categorías son exactamente las mismas cinco. Lo que cambia es la letra chica de cada una.

El sistema calcula la próxima dosis según la hora de la última toma. El servidor corre en UTC. El profesional que carga el dato está en el huso horario local, cuatro horas atrás. Esa diferencia mueve el cálculo de "corresponde en 40 minutos" a "corresponde ahora". Es el mismo problema del posnet: dos fuentes de verdad que no están de acuerdo sobre qué pasó y cuándo. En el supermercado esa discrepancia sale en el resumen de la tarjeta. Acá sale en un horario de medicación.

Dos pacientes se llaman María Fernández. Una tiene 34 años, la otra 71. El sistema las distingue por un ID interno que el buscador de la recepción no siempre usa, porque a veces se busca por nombre y el nombre no alcanza. Es el mismo problema de las dos cajas vendiendo la última unidad: dos registros compitiendo por representar "la misma persona", sin una regla que decida cuál gana antes de que alguien actúe sobre el equivocado.

Falta un dato: el peso del paciente. En vez de bloquear la carga, el sistema usa el último peso registrado, de hace ocho meses. Es la misma decisión de diseño que el precio de góndola desactualizado: convivir con un dato viejo como si fuera vigente. En el supermercado eso genera un reclamo. Acá genera un cálculo hecho sobre un dato que dejó de describir a la persona.

Un mes después, alguien pregunta quién vio la historia clínica de un paciente puntual, y cuándo. El sistema no tiene esa respuesta, porque nunca se guardó: la pantalla mostraba el dato, pero nadie decidió que "quién lo vio" fuera algo que había que persistir. Es la misma falta de cierre de caja del supermercado: sin un registro independiente de lo que pasó, no hay forma de reconstruirlo después. Con una diferencia: acá "quién vio qué" no es una buena práctica de auditoría, es un requisito legal.

## El corte que decide todo

Ordená las diez escenas de arriba con una sola pregunta, no diez: ¿se puede deshacer, y quién carga el costo mientras se deshace?

El doble cobro del posnet se arregla con una nota de crédito o una reversión en el gateway. Tarda un día, incomoda al cliente, pero la plata vuelve. El -1 de stock se corrige con un ajuste manual y una alerta al depósito. El precio mal cobrado se resuelve en la próxima visita o con una devolución en caja. El café regalado por la mala composición de reglas se corrige mañana en el motor de descuentos, y el peor caso es que el supermercado pierde margen en algunos tickets de un día. Las cinco tienen camino de vuelta.

La dosis mal calculada, la historia cruzada entre dos pacientes, el peso de hace ocho meses usado para calcular algo hoy: no tienen ese camino. Lo que pasó, pasó. No existe una operación que diga "deshacer la administración de una dosis". Y el registro de quién vio una historia clínica, si nunca se guardó, no se reconstruye siete meses después preguntándole a alguien qué recuerda.

En el supermercado el peor error se arregla con una nota de crédito. En la aplicación médica no hay rollback.

Esa asimetría, reversible contra irreversible, es la respuesta que tu amigo necesitaba, no la lista de tipos de test. El catálogo (unitarios, de integración, de contrato, de concurrencia, end-to-end) es el mismo para las dos aplicaciones. Lo que cambia es dónde lo aplicás con fuerza y dónde no vale la pena, y esa decisión no la toma el catálogo: la toma la severidad de lo que hay del otro lado.

## Por qué esto es arquitectura, no QA

La criticidad del dominio no es un dato que le pasás a QA al final para que decida cuántos casos escribir. Es un input que entra al diseño desde el primer diagrama, porque mueve decisiones que no tienen nada que ver con testing.

**Dónde cortás la transacción.** En el supermercado podés confirmar el cobro y reintentar el envío del ticket por mail de forma asíncrona, porque si el mail falla el cliente ya se fue con la compra y la plata está cobrada: el peor caso es reenviar un correo. En salud, la administración de una dosis y el registro de que se administró tienen que quedar en la misma transacción atómica, porque un mundo donde "se dio la dosis pero no quedó registrada" es peor que rechazar la operación y obligar a reintentar. Ganás disponibilidad en un caso y la sacrificás en el otro, porque ahí el costo de un dato inconsistente pesa más que el costo de un reintento.

**Si el sistema puede inferir o tiene que exigir el dato.** Usar el último precio conocido mientras el job de sincronización todavía no corrió es una inferencia razonable en el supermercado: peor caso, alguien paga de más y se resuelve en el momento. Usar el último peso conocido para calcular algo en salud no es una inferencia, es una apuesta con un dato que dejó de ser cierto. Ahí el diseño correcto no es "inferir mejor": es bloquear la operación y exigir el dato actualizado, aceptando el costo de una fricción más en la carga.

**Qué guardás para poder reconstruir qué pasó.** El supermercado puede vivir sin loguear cada consulta de precio: si algo sale mal, el ticket impreso ya alcanza como evidencia. El sistema de salud necesita un registro append-only de cada acceso y cada cambio, porque "¿quién vio esto y cuándo?" tiene que poder responderse meses después, no reconstruirse de memoria. Eso no es logging por prolijidad: es una tabla que diseñás desde el modelo de datos, sabiendo de antemano que alguien la va a auditar.

**Si un fallo puede ser silencioso o tiene que ser ruidoso.** Un stock que no se sincronizó a tiempo puede resolverse con un `WARN` que alguien revisa el lunes. La misma clase de inconsistencia en salud tiene que frenar la operación con una excepción visible en la pantalla de quien carga el dato, porque un log que nadie mira a tiempo, ahí, no es una demora: es un dato perdido. De la diferencia entre un log que espera y un fallo que interrumpe ya hablamos en [el día que nadie miraba los logs a las 3 de la mañana](/blog/logging-strategy). La decisión de cuál de las dos te conviene no la toma el logger: la toma cuánto te cuesta que ese fallo pase desapercibido.

## El método: cuatro preguntas antes de elegir con qué testear

Esto es lo que le contestás a tu amigo, y lo que se lleva usable el lunes a una reunión de diseño o a un ADR:

1. **Escribí, en una frase, qué es lo peor que puede pasar** en esta parte del sistema. No "que falle": específico. Qué dato queda mal, qué operación queda a medias.
2. **Escribí quién lo paga**, y si esa persona (cliente, paciente, la empresa) puede revertirlo por su cuenta o necesita que el sistema intervenga.
3. **Escribí qué propiedad tiene que ser cierta** para que ese peor caso no ocurra. Por ejemplo: "un cobro nunca se procesa dos veces con el mismo intento" o "una dosis y su registro se confirman juntas, o ninguna de las dos".
4. **Recién ahí elegís con qué la verificás**: un test de idempotencia con reintentos simulados, un test de concurrencia con locks, una reconciliación batch contra otra fuente, o directamente nada automatizado porque el costo de que falle es menor que el costo de mantener el test.

Con qué la verificás cambia según tu stack: en Java capaz es un test de integración con una base real levantada para la corrida; en otro lenguaje es otra herramienta. Lo que no cambia es la pregunta que te hiciste antes de elegirla.

El orden importa. Si arrancás por el paso 4, terminás aplicándole el mismo rigor a todo, porque el catálogo de tests no distingue supermercado de salud por sí solo. El catálogo es la respuesta. Los pasos 1 a 3 son la pregunta, y sin la pregunta la respuesta es gasto sin criterio.

## Tabla: el mismo método, cinco dominios

El método no cambia entre dominios. Lo que cambia es la respuesta a cada paso. Así se ve aplicado:

| Dominio | Peor caso | Quién lo paga | ¿Reversible? | Qué propiedad cuidar | Con qué se verifica |
|---|---|---|---|---|---|
| E-commerce / retail | Cobro duplicado o venta de stock que no existe | El cliente, con el reclamo; la empresa, con la devolución | Sí, nota de crédito o reintegro | Idempotencia del cobro + stock consistente entre cajas concurrentes | Test de integración con reintentos simulados + test de concurrencia sobre el ajuste de stock |
| Fintech / pagos | Una transferencia se ejecuta pero el asiento contable no queda registrado, o al revés | El usuario, y la fintech, con el reclamo regulatorio | Parcial: dentro de la ventana legal sí, después no | Atomicidad entre el movimiento y su asiento contable | Test de contrato sobre el evento de transferencia + reconciliación batch diaria contra el libro mayor |
| Salud | Un dato clínico o una dosis queda mal registrado o cruzado entre pacientes | El paciente, con su salud | No | Identidad inequívoca del paciente en cada operación + registro append-only de cada acceso y cambio | Chequeos de integridad referencial estrictos, sin inferencia de datos faltantes, y auditoría cableada al modelo, no al log de aplicación |
| Logística | Un paquete queda asignado a dos rutas, o se pierde su estado | El cliente, con la demora; la empresa, con el reproceso | Sí, reasignación y reenvío, con costo de tiempo | Cada paquete tiene un solo estado válido a la vez, como máquina de estados, no como flag | Test de transición de estado + test de concurrencia sobre la asignación de rutas |
| Herramienta interna (ej. dashboard de métricas del equipo) | Un número sale mal en un reporte que solo ve el equipo | Quien lee el dashboard, con confusión hasta que alguien lo corrige a mano | Sí, trivialmente | Ninguna crítica: el dato se puede recalcular | Ninguna automatizada más allá de un smoke test de que la página carga; el resto es code review |

Fijate la última fila. Escribir tests de concurrencia para ese dashboard no es prolijidad: es plata del equipo gastada en proteger algo que no le cuesta nada a nadie que salga mal. La fila de salud es la contraparte exacta: automatizar menos que eso ahí no es pragmatismo, es negligencia con otro nombre.

## La regla

Volvé a tu amigo. No le contestás "necesitás unitarios, de integración y end-to-end", porque esa lista es la misma para cualquier sistema y no le sirve para decidir nada. Le preguntás qué es lo peor que le puede pasar a un cliente en su supermercado, y diseñás transacciones, inferencia de datos, auditoría y ruido de fallos a partir de esa respuesta, antes de escribir el primer test.

La regla generalizable: el catálogo de tipos de test es la respuesta. La pregunta es qué es lo peor que puede pasar en tu dominio y quién lo paga si pasa. Contestá eso primero, y con qué lo verificás deja de ser una discusión de gustos.

Todo lo de arriba define qué proteger. Cómo se arma en la práctica la infraestructura que lo prueba, sobre todo cuando el peor caso vive en un flujo de UI real (el checkout del supermercado, la pantalla donde el profesional carga la dosis), es un oficio aparte. Adriana Troche Robles lo desarrolla de punta a punta en [harness de UI, del cero al primer flujo verde](https://calidadsinhumo.com/posts/harness-de-ui-del-cero-al-primer-flujo-verde/). Acá me quedo en la decisión de qué merece esa infraestructura y qué no.

---

Este día no lleva ejercicio de código, y no es un descuido: la decisión se toma antes de escribir el primer test. Los días que sí traen código están en [el repo de los 100 días](https://github.com/alafourcadev/100-architecture-days). Si la serie te está sirviendo, dejame una ⭐. Es gratis y ayuda a que más gente lo encuentre.

Si querés recibir una lección semanal de arquitectura, producción e IA sin filtros, suscribite a La Bitácora Sin Filtros.
