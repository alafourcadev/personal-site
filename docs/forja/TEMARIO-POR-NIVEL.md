# La Forja — temario de los 12 niveles

> Cada nivel lo escribe un autor distinto. Este archivo es lo que evita que doce
> autores produzcan doce currículos sueltos. Define qué enseña cada nivel, qué
> concepto del nivel anterior lo habilita, y con qué herramientas del motor se
> puede expresar.
>
> Las bandas y techos están calculados con el código real (`difficulty.ts`), no
> a ojo. La columna "expresable con" lista los predicados y reglas que hacen
> jugable ese tema — si tu ejercicio no entra en ninguno, cambiá el ángulo
> antes de pedir un motor nuevo.

---

## Regla de oro de la progresión

> **El tema y su prerrequisito deciden en qué nivel vive un ejercicio.
> La carga cognitiva decide qué lugar ocupa DENTRO del nivel.**

Las bandas de dificultad se solapan a propósito. Un ejercicio del nivel 9 no es
"más difícil" que uno del 8: es uno que **no se puede plantear** sin el concepto
que enseñó el 8. Si tu ejercicio se entiende sin haber jugado el nivel anterior,
está en el nivel equivocado.

---

## Nivel 1 — Pensar antes de diseñar

**Banda [2, 10]** · todos los ejes ≤2 · sin prerrequisito

Antes de dibujar nada: qué pide el negocio, qué es un requisito y qué es una
preferencia disfrazada, qué falta por preguntar. El jugador llega sin
vocabulario y sale sabiendo leer un enunciado con desconfianza.

El diseño inicial viene **casi completo**. El trabajo no es construir: es
detectar la pieza que el enunciado pide y nadie puso, o la que sobra porque
nadie la justificó.

> **Nota de producto:** el mapa de niveles describe este nivel como "sin
> canvas". Hoy el esquema exige diseño inicial y soluciones de referencia, así
> que se autora **con** canvas en su forma más simple. Es una decisión
> reversible del dueño, no una regla del motor.

**Expresable con:** `exists` (falta la pieza que el requisito pide),
`edgeAbsent` (esa conexión que nadie justificó), `path` corto.

---

## Nivel 2 — Acoplamiento, cohesión y límites

**Banda [4, 12]** · todos los ejes ≤2 · habilitado por: *requisitos, para decidir qué agrupar*

Qué va junto y qué va separado, y por qué. Un límite mal puesto se paga en cada
cambio futuro. Acá aparece la primera decisión con costo diferido: separar de
más multiplica la operación, separar de menos convierte dos cambios en uno solo
que nadie quiere tocar.

**Expresable con:** `path` con `forbid` (este servicio no debería llegar hasta
allá), `edgeAbsent` (dependencia que cruza un límite que no debería cruzar),
`covered`.

---

## Nivel 3 — Datos, integridad y clasificación

**Banda [6, 14]** · D3≤3, resto ≤2 · habilitado por: *límites, para saber quién es dueño de qué*

Quién es dueño del dato, qué clase de dato viaja por cada conexión, y qué
sobrevive un reinicio. Acá el jugador conoce las cuatro clases (`public`,
`personal`, `regulated`, `secret`) y descubre que declararlas no es burocracia:
es lo que hace visible una exposición.

Es el primer nivel donde el motor **bloquea** por una decisión de datos: dato
personal a un cache, dato regulado a una base sin respaldo.

**Expresable con:** `noVolatileCut` (el dato no puede depender de algo
volátil), `edgeAbsent` sobre `cache`, `exists` con `propEquals: { backup: ... }`,
las reglas `volatile-durable-mismatch` y `regulated-without-backup`.

---

## Nivel 4 — Comunicación entre servicios ✅ TERMINADO

**Banda [8, 16]** · D3≤3, D7≤3, resto ≤2 · habilitado por: *integridad — la idempotencia necesita "la misma operación"*

Síncrono contra asíncrono, colas, streams, reintentos e idempotencia. Ya está
escrito: sus 8 ejercicios son el modelo de referencia para todos los demás.

---

## Nivel 5 — Producción y operación

**Banda [10, 18]** · D1,D2,D3,D5,D6,D7≤3 · habilitado por: *algo que falle en silencio, que motive observar*

Un sistema correcto que nadie mira es un sistema que se degrada solo. Detección,
señales, respaldo, punto único de falla, y la capacidad real del equipo de
sostener lo que construyó.

**La trampa de este nivel:** observabilidad y punto único de falla son
**advertencias**, y las advertencias cuestan cero puntos. Si querés que operar
bien dé puntaje, expresalo como **garantía**.

**Expresable con:** `covered` (todo servicio crítico tocando observabilidad),
`exists` con `propEquals: { replicas: '2' }`, `ruleSilent`.

---

## Nivel 6 — Resiliencia y fallo parcial

**Banda [12, 20]** · D7≤4, D4,D9≤3, resto ≤3 · habilitado por: *señales — no se recupera lo que no se detecta*

Qué pasa cuando **una parte** se cae, no todo. Degradar en vez de morir. Aislar
el fallo para que no se propague. Acá el jugador aprende que "disponible" no es
binario y que la respuesta correcta muchas veces es servir peor, no servir nada.

**Expresable con:** `any` (hay más de un camino a este resultado), `noVolatileCut`,
`path` con `forbid` (el camino de emergencia no depende de la pieza que se cayó).

---

## Nivel 7 — Escala, capacidad y costo

**Banda [14, 22]** · D6≤4, resto ≤3 · habilitado por: *degradación — a 10x lo que se rompe es parcial*

Diez veces el tráfico. Qué se rompe primero, cuánto cuesta que no se rompa, y
cuándo la respuesta correcta es no escalar. Es el nivel donde el presupuesto
deja de ser un número y se vuelve la restricción que decide el diseño.

**Expresable con:** `budget.opsUnits` ajustado y `lambda` alto (el acantilado de
presupuesto muerde), `exists` sobre `cdn` y `cache`, `covered`.

---

## Nivel 8 — Datos a gran escala y multi-tenencia

**Banda [16, 24]** · D1,D3,D5≤4, resto ≤3 · habilitado por: *capacidad y clasificación de datos*

Muchos clientes sobre la misma infraestructura. Aislamiento, particionado, y el
dato de un cliente que jamás puede aparecer en la consulta de otro.

**Expresable con:** `edgeAbsent` (el camino que filtraría datos entre clientes),
`path` con `forbid`, `exists` con `propEquals` sobre particionado.

---

## Nivel 9 — Seguridad, identidad y cumplimiento

**Banda [18, 26]** · D2≤4, D8≤3, resto ≤3/4 · habilitado por: *multi-tenencia — aislamiento es medio control de acceso*

Quién es quién, quién puede qué, y qué hay que poder demostrarle a un auditor.
El nivel donde las zonas de confianza dejan de ser una regla del tablero y se
vuelven el tema.

**Expresable con:** `covered` por `identity-provider`, `edgeAbsent` sobre saltos
de zona, `exists` con `propEquals: { mfa: ... }`, las reglas de zona y la de
dato regulado sin respaldo.

---

## Nivel 10 — Arquitectura con IA

**Banda [20, 28]** · D9≤4, resto ≤3/4 · habilitado por: *seguridad, resiliencia y costo*

Un modelo es un componente externo, caro, no determinista y con un riesgo de
datos propio. Trazabilidad de la fuente, qué se le manda y qué pasa cuando
responde cualquier cosa o no responde.

**Expresable con:** la regla `pii-to-external-model`, `exists` sobre
`vector-store` con `propEquals: { sourceTraceability: 'sí' }`, `path` con
`forbid` sobre el modelo, `noVolatileCut`.

---

## Nivel 11 — Evolución y migración

**Banda [22, 30]** · todos ≤4 · habilitado por: *todo lo anterior — se migra un sistema, no un componente*

Cambiar el motor del avión en vuelo. Convivencia de dos versiones, vuelta atrás,
y el estado intermedio que dura más de lo que nadie planeó.

**Expresable con:** `any` (los dos caminos coexisten), `path` con `via` (el
tráfico pasa por la pieza de transición), `edgeAbsent` (el camino viejo ya no se
usa).

---

## Nivel 12 — Liderazgo técnico y defensa

**Banda [24, 32]** · todos ≤4 · habilitado por: *decisiones irreversibles que defender*

Decidir con información incompleta y **sostener la decisión** frente a alguien
que empuja para el otro lado. D8 (oposición) llega a 4 sólo acá.

> **Riesgo abierto:** defender una decisión es argumentar, no diagramar. Con las
> herramientas de hoy este nivel se expresa como *diseños con restricciones
> contradictorias* donde el `contextInversion` de cada solución de referencia es
> la defensa. Si al escribirlo se vuelve forzado, hay que reportarlo antes de
> seguir: puede ser el segundo nivel, junto con el 1, que pida un tipo de
> ejercicio nuevo.

**Expresable con:** `constraints` en conflicto real, `budget` ajustado con
`lambda` alto, y garantías de peso distinto que no se pueden maximizar todas a
la vez.
