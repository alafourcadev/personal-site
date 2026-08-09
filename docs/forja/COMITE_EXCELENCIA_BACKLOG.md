# Comité de Excelencia de La Forja — backlog de cierre

Ronda 4. Cierra el trabajo de 12 especialistas sobre el build de producción de `feat/la-forja`.
Todo lo que sigue tiene evidencia ejecutada o verificada contra el filesystem. Lo que no la tenía
no está acá.

---

## 1. Veredicto en 5 líneas

1. La narrativa de los ejercicios es **la parte fuerte del producto** y no hay que tocarla: lo que
   está escrito por un robot es **el último párrafo**, que en 122 de 169 archivos es el array
   `guarantees` transcrito con `para que` entre medio.
2. Lo que rompe la lectura no es el texto: es el render. `ExerciseBrief.astro:42` pide
   `prose prose-invert` y **ese plugin no está instalado** — los 6 párrafos de todo brief salen a
   `14px/20px` con **0px de separación entre ellos**.
3. El layout tiene un defecto de producción medible: a **1133px** el lienzo cae a 299px y zoom 0.28,
   y en un MacBook de 13" o 14" **evaluar hace desaparecer el lienzo** (`display:none`).
4. Hay **612 párrafos de `consequence`** escritos, obligatorios en el tipo, y jamás renderizados.
   Es la mejor relación beneficio/costo del comité: dos líneas de código.
5. **Empezá por F01** (el test que ata los tres literales de layout). Sin ese test, todo el trabajo
   de layout se puede romper sin un solo test rojo — que es exactamente cómo llegó acá el defecto.

---

## 2. Las tres correcciones de diagnóstico

Tres creencias iniciales resultaron falsas. Cambian dónde se gasta el esfuerzo, por eso van arriba.

**(a) "Los ejercicios están mal escritos."** Falso a nivel narrativa. Cinco de seis briefs de los
niveles 9-12 los reconocería un arquitecto senior como problemas reales, y los seis mejores del corpus
**pasan** el techo de 260 palabras que se había propuesto imponerles (277, 289, 369, 282, 359, 373).
El defecto está **localizado en el párrafo del pedido**: ahí `que`/oración salta de 0.68 global a
**3.61**, y las palabras por oración de 17.3 a **38** (máx 76). En `n12-el-cobro-que-tres-areas-quieren-distinto`
la cobertura léxica entre el pedido y las etiquetas de garantía mide **1.00**: es la serialización
literal del array. → **El esfuerzo va al último párrafo, no a los 169 cuerpos.**

**(b) "El motion ya está resuelto."** Falso para la herramienta. El `.15s`/`.3s` que la primera ronda
midió venía de las páginas editoriales del sitio. En el lienzo, `transitionDuration` medido es
**0s en submit, undo, reset, tab, `.react-flow__edge-path` y handle**; la palabra `transition` aparece
**una sola vez** en todo `ForjaCanvas.tsx`. → **Hay que construirlo, no ajustarlo — y el presupuesto es
180ms, no 300: el motor responde en 12,6 ms.**

**(c) "El contraste es un problema."** Falso, y protegerlo importa. Todo pasa WCAG 1.4.3 con margen:
cuerpo 6,69:1 · H1 13,92:1 · `aiBudget` 5,18:1 · anillo de foco 6,76:1 (llega a **AAA** en 2.4.13).
El secundario `#94a3b8` sobre `#0a0f1a` da **7,47:1**, mejor que el 7,24:1 de syde.cc. El problema es
que el **0,21 de proporción primario:secundario** no deja dos niveles de lectura. → **Nadie toca los
colores de texto. Se agrega jerarquía, no contraste.**

---

## 3. La plantilla de consigna — lista para aprobar

Es el entregable que el dueño pidió primero. Resuelve sus prioridades #1 y #2 de una vez: el pedido
deja de ser prosa libre y pasa a ser un contrato con forma fija, verificable por tests.

### 3.1 El schema

En `src/lib/forja/content/exercise-schema.ts`:

```ts
const askSchema = z.object({
  goal: z.string().min(1),                             // 1 oración, ≤22 palabras, en negocio
  mustHold: z.array(z.string().min(1)).min(2).max(5),  // ≤14 palabras c/u
  wontCount: z.string().min(1),                        // el atajo falso y lo que cuesta
})

// en exerciseSchema:
ask: askSchema.optional(),           // opcional durante la migración
afterYouDecide: z.string().optional(), // la enseñanza que hoy spoilea desde `aiBudget`
```

**`aiBudget` NO se renombra ni se borra.** `exercise-schema.ts:213-216` documenta la EC de marca
("accesible y con `aiBudget` declarado"). Lo que cambia es que **deja de renderizarse en el brief**
(`ExerciseBrief.astro`) y su contenido pedagógico se muda a `afterYouDecide`, que sale en el panel de
resultado bajo `POR QUÉ ÉSTA Y NO LA OTRA` — **después** de decidir. Un campo por trabajo.

Motivo medido: los 169 lo tienen, **156 empiezan literalmente con "libre"** (cero información de
política) y **117 contienen lenguaje que descarta u orienta hacia una opción concreta**. Se renderiza
a 12px, bajo el pliegue: spoiler para el que lee, ruido para el que no.

### 3.2 Dónde se renderiza

El `ask` va **arriba de la narrativa, pegado al H1**, y con él sube el `<dl>` de presupuesto y
restricciones. El pedido pasa de `y≈909` (pliegue en 907) a `y≈256`. Esto es lo que hace innecesario
el techo de palabras: la mediana del corpus es 271 palabras y el techo del pliegue medido era 260 —
en vez de pelear contra la aritmética, se saca el pedido de la zona en disputa.

### 3.3 Las 10 reglas que sobreviven (R1 está muerta)

**R1 —«el cuerpo no pasa 260 palabras» está RECHAZADA.** La mataron los seis mejores ejercicios del
corpus, que la violan todos, y la habría obligado a cortar un 30% de la mejor pieza de escritura del
juego. Existía para que el pedido no cayera bajo el pliegue; el `ask` en frontmatter ya resuelve eso.

| # | Regla | Umbral verificable | Fallan hoy |
|---|---|---|---|
| R2 | El pedido no es una oración-cadena | `goal` 1 oración ≤22 palabras · cada `mustHold[i]` ≤14 | mediana 38, máx 76 |
| R3 | Prohibido transcribir la garantía | Jaccard ≤0,60 contra toda `guarantee.label` **y** ningún 4-grama compartido | nivel 12 mide 0,89; tres archivos 1,00 |
| R4 | El pedido habla de negocio, no del grafo | 0 `CATALOG[t].name` dentro de `ask.*` | — |
| R5 | Nada de cadenas `para que` | 0 en `ask.*`; ≤1 por párrafo en el cuerpo | **122/169** |
| R6 | Negaciones acotadas | ≤1 por viñeta de `mustHold` | — |
| R7 | Marca de 2.ª persona en el primer párrafo | ≥1, regex `(?<![\p{L}])` con flag `u` | **93/169 sin ninguna** |
| R8 | El cuerpo no repite el presupuesto del `<dd>` | el cuerpo no matchea `budget.opsUnits` | **98/169** |
| R9 | El `<dl>` no imprime dos veces el mismo número | ninguna `constraint` con `value === budget.opsUnits` | **103/169** |
| R10 | Las piezas ya puestas se anuncian solas | generado desde `startingDesign`, no escrito a mano | — |
| R11 | Anti mail-merge | ningún par de archivos comparte >12 septagramas | máximo actual **34** |

**Trampa técnica confirmada:** `\b` de JavaScript es ASCII y **no cierra después de `á`/`é`/`í`**. Un
test de voseo escrito con `\b` da falso negativo en el 100% de los imperativos. R7 se escribe con
`(?<![\p{L}])` y flag `u` o no se escribe.

**Las 10 van en `tests/content/`, no en el build.** Un brief que las viola tiene que poner el test en
rojo, nunca romper `astro build` — si no, ningún archivo se puede migrar de a uno.

### 3.4 Antes/después — brief corto: `n1-la-consulta-que-saltea-la-puerta` (233 palabras)

**Antes** — último párrafo del cuerpo markdown, cae bajo el pliegue:

> **Sacá el atajo y dejá a las dos audiencias adentro.** Ojo con la mitad fácil: borrar la conexión
> es un gesto de un segundo, y deja a 900 familias sin poder consultar nada. El requisito no era
> cerrar una puerta — era que todos entren por una.

Viola **R7** (el primer párrafo no tiene ni una marca de segunda persona) y **R9** (la constraint
`presupuesto operativo <= 4 unidades operativas` repite `budget.opsUnits: 4`, y el `<dl>` imprime el
número dos veces).

**Después** — frontmatter:

```yaml
ask:
  goal: Sacá el atajo sin dejar a ninguna de las dos audiencias afuera.
  mustHold:
    - Ninguna consulta de nota llega sin que alguien verifique quién pregunta
    - Las familias siguen viendo la nota desde la app
    - Los docentes siguen cargando desde la consola
  wontCount: >
    Borrar la conexión y listo. Es un gesto de un segundo y deja a 900 familias
    sin poder consultar nada.
afterYouDecide: >
  El reglamento decía "un solo punto de entrada" y el sistema tenía dos. El segundo no verificaba
  nada, no registraba nada, y nadie se acordaba de que existía hasta que alguien consultara la nota
  de un chico que no era suyo. Los 40 ms nunca se midieron: salieron de una conversación de pasillo.
```

Y una sola línea del cuerpo cambia, para R7:

> **Antes:** "Un colegio de **1.400 alumnos**. Dos programas contra el mismo sistema de calificaciones…"
> **Después:** "Te llaman de un colegio de **1.400 alumnos**. Hay dos programas contra el mismo sistema de calificaciones…"

Se borra la constraint `presupuesto operativo` (R9). **La narrativa no se toca: 8 palabras nuevas en
todo el archivo.** Eso es lo que cuesta un brief que ya está bien escrito.

### 3.5 Antes/después — el peor caso: `n12-el-cobro-que-tres-areas-quieren-distinto`

**Antes** — una sola oración de ~60 palabras con cuatro `para que` encadenados:

> **Armá el sistema** para que entre el servicio de pagos y el modelo de riesgo haya una pieza tuya,
> para que el cobro no dependa de que la red de tarjetas esté disponible en ese instante, para que
> cada operación deje evidencia archivada, y para que todos los servicios reporten lo que les pasa.
> Sin pasar de siete piezas.

Las cuatro cláusulas son las cuatro `guarantee.label` **palabra por palabra**
(`g-model-isolated`, `g-network-durable`, `g-dispute-archived`, `g-services-observed`). Viola R2, R3
(cobertura 1,00), R5 (4 cadenas) y R8 ("siete piezas" = `budget.opsUnits: 7`, ya renderizado en el `<dd>`).

**Después:**

```yaml
ask:
  goal: Dale a las tres áreas lo que piden con una sola pieza más.
  mustHold:
    - Riesgo sigue detectando fraude sin que el tercero vea la operación entera
    - Un cobro entra aunque la red de tarjetas esté caída veinte minutos
    - Un contracargo de hace dos años se responde con evidencia, no con memoria
    - Cuando algo falla, se sabe dónde
  wontCount: >
    Una pieza por pedido. Son tres, el equipo sostiene siete, y ya tiene siete.
afterYouDecide: >
  Los tres pedidos ocurren después de que el cobro se aprobó, y ninguno está en el camino del
  cliente: por eso una sola pieza puede hacer los tres trabajos. Alguien en la mesa va a decir que
  eso es una pieza que hace demasiado, y va a tener un punto. La diferencia entre un atajo y una
  decisión es si podés decir en voz alta qué perdés con ella.
```

Y del cuerpo **se borra el párrafo que entrega la síntesis en bandeja** ("Lo que hay que ver es qué
tienen en común los tres pedidos: los tres ocurren **después** de que el cobro se aprobó…"): hoy le
resuelve el ejercicio al jugador antes de que abra el lienzo. Su contenido ya está arriba, en
`afterYouDecide`, que llega después de decidir. Se borra también la constraint `presupuesto operativo
del equipo de pagos` (R9).

**El pedido pasa de la transcripción de un array a cuatro afirmaciones sobre el negocio.** Ninguna
nombra una pieza del catálogo (R4). Ninguna dice "para que" (R5).

---

## 4. Qué adoptar de syde.cc y qué no

El insight que ordena todo: **syde.cc corre DOS sistemas de densidad con la misma paleta.** Su
marketing respira (padding 96px, radio 9999px, 8 familias de sombra); su herramienta se comprime
(gap 8px, radio 8px, 1 sombra, shell de 900px sin scroll de página). **La Forja corre uno solo, plano,
para las dos cosas.** Copiar el landing dentro del lienzo es el error más caro disponible.

### ADOPTAR

| Qué | syde | La Forja hoy | Valor a aplicar | Dónde |
|---|---|---|---|---|
| Shell de altura fija, sin scroll de página | app: 900px, cada riel con su `overflow-y:auto` | 1680 / 2101 / 2776px de alto | `h-[calc(100vh-72px)]`, riel de consigna `sticky top-[88px]` + `max-h-[calc(100vh-104px)] overflow-y-auto` | `[exercise].astro`, `exercise-page-layout.ts` |
| Grilla estricta de 4px en la herramienta | gap dominante **8px** (75×) | gap dominante **6px** (22×) — fuera de la grilla | gap 6 → **8px** | componentes del lienzo |
| Radio de la herramienta | **8px** (67× en su app) | 12px (56×) | 8px en paleta, panel y tooltips; el nodo se queda en 12 | `ComponentLibrary.tsx`, `ResultPanel.tsx` |
| Una sola familia de sombra | **1** en su app | 4 declaradas, 37 instancias invisibles (la dominante da **1,03:1**) | borrar las 37, dejar 1 | tokens + componentes del lienzo |
| Micro-encabezados en versalita | 10px/16px w600 `ls 0.6px` | no existen: **0 headings `##`/`###` en los 169 cuerpos** | mismos valores, **desde un componente** — no hay markdown que estilar | `ExerciseBrief.astro` |
| Medida de línea controlada | 45–64ch, `max-width: 768px` | `max-w-none`: 37ch @390 · 76ch @768 · 46ch @1440 | **45ch**, comprado bajando el padding de la tarjeta de 24 → **16px** (no angostando el riel) | `ExerciseBrief.astro` |
| Que exista una rampa tipográfica | 48 → 60 → 72 | tres escalones en toda la marca: 30 → 24 → 16 | rampa propia de **11 escalones**, toda interlínea múltiplo de 4 | tokens |

### NO ADOPTAR

| Qué | Por qué no, con el número |
|---|---|
| El tema claro | La marca es dark premium y La Forja **ya supera** el contraste de syde: **7,47:1 vs 7,24:1**. Nada que ganar, una marca que perder. |
| Los 96px de padding dentro del lienzo | Es el número más visible de syde y el más peligroso de importar. **Su propia app lo abandona** (pasa a 8px). Aplicado en la paleta o el lienzo reduce el área de trabajo de 829px de alto a un cuarto. |
| El H1 de 72px | Funciona sobre fondo vacío. El H1 de La Forja convive con un lienzo. **Se queda en 24px**: los títulos miden mediana 42 caracteres y a 20 o 24px dan las mismas 2 líneas — el ahorro son 8-16px contra 608-815px bajo el pliegue, y cuesta el único ancla a 13,92:1. |
| Los radios de 9999px | 98× en su landing, **8px en su app**. Un nodo de arquitectura con radio de píldora deja de leerse como componente de sistema. |
| Las 8 familias de sombra | Sólo funcionan sobre fondo claro. Sobre `#0a0f1a` las 28 actuales ya son ruido invisible. La dirección es **borrar**, no importar más. |
| El stack de fuentes del sistema (0 webfonts) | Inter + Outfit + JetBrains Mono **es** la marca. Lo que falta no son fuentes, son escalones dentro de ellas. (Nota: Outfit sólo tiene 700 y 800 en el bundle — ningún heading puede pedir 600 hoy.) |
| El tour modal de onboarding de 10 pasos | Bloquea el lienzo entero al primer arranque. En un juego donde el aprendizaje **es** el producto, contradice la premisa. La enseñanza va en el momento del gesto (F07, F17), no antes de empezar. |
| El gap de 12px de su landing | Es su densidad de marketing. Dentro de la herramienta el valor es 8. |

---

## 5. El backlog priorizado

Ordenado por (impacto en las métricas del dueño) / (costo), no por severidad nominal.

| ID | Título | Prio | Costo | Métrica | Archivos | Cierra |
|---|---|---|---|---|---|---|
| F01 | Compuerta que ata los tres literales de layout | P0 | S | confianza | `tests/canvas/`, `responsive-layout.ts` | condición bloqueante R3 |
| F02 | El pedido pasa a frontmatter: `ask` + `afterYouDecide` | P0 | M | claridad, comprensión | `exercise-schema.ts`, `ExerciseBrief.astro`, `ResultPanel.tsx` | queja #1 y #2, D1, E4 |
| F03 | Las 10 reglas como tests de contenido | P0 | M | claridad, confianza | `tests/content/` | G (deriva mail-merge) |
| F04 | Un solo layout: riel sticky, `forja-split` 1344, lienzo + veredicto conviven | P0 | M | facilidad de uso, velocidad | `responsive-layout.ts`, `exercise-page-layout.ts`, `tailwind.config.ts`, `playwright.config.ts` | B1, B2, B3 |
| F05 | `consequence` en el panel de resultado | P0 | S | aprendizaje | `score.ts`, `ResultPanel.tsx` | C1 (612 párrafos) |
| F06 | Las conexiones dejan de robarse el clic | P0 | S | confianza, satisfacción | `edge-hit.ts`, `edge-hit-target.css`, `ForjaNode.tsx` | N2 |
| F07 | Los gestos hablan | P0 | M | comprensión, aprendizaje | `ForjaCanvas.tsx`, `ResultPanel.tsx` | A2, A3, C8, P3-mudo |
| F08 | Superficie, elevación y movimiento del lienzo | P1 | S | percepción premium | tokens, `ForjaCanvas.tsx`, tooltips | P2-visual, motion |
| F09 | Placeholder SSR del lienzo | P1 | S | percepción premium, confianza | `[exercise].astro` | N1 |
| F10 | El panel dice qué evaluó y qué construiste | P1 | M | aprendizaje | `ResultPanel.tsx`, `reference-solutions.ts` | C3, C5, C7 |
| F11 | Bloque tipográfico del brief + `<dl>` arriba del H1 | P1 | M | claridad, elegancia | `ExerciseBrief.astro` | A1, A2, A3, A4, N5 |
| F12 | La biblioteca dice el nombre completo | P1 | S | claridad | `ComponentLibrary.tsx`, `catalog.ts` | B5, D6 |
| F13 | Salida al terminar un nivel + «Volver a intentar» | P1 | S | retención | `next-step.ts`, `ResultPanel.tsx`, `unlock.ts` | C4, N6 |
| F14 | Handles 12/24, `connectionRadius`, piso de zoom 0,62 | P1 | M | facilidad de uso | `ForjaNode.tsx`, `ForjaCanvas.tsx`, `responsive-layout.ts` | B6, A7 |
| F15 | Migración editorial de los 169 briefs | P1 | XL | claridad, aprendizaje | `src/content/forja/exercises/*.md` | queja #1, G |
| F16 | `hiddenFacts.fact` se borra; `discoveryPath` → `hints[]` | P1 | L | aprendizaje | `exercise-schema.ts`, los 169, `ResultPanel.tsx` | D2 |
| F17 | El rechazo de conexión persiste y enseña la cura | P1 | S | aprendizaje, comprensión | `ForjaCanvas.tsx`, `catalog.ts` | C8, N3 |
| F18 | El panel deja de repetirse | P1 | S | claridad, velocidad | `ResultPanel.tsx`, `rules.ts` | D4, D5 |
| F19 | Poda del estado del jugador | P2 | S | confianza, retención | `local-adapter.ts` | N7 |
| F20 | Mapa de niveles con próximo paso, y se borra el podio | P2 | M | retención | `forja/niveles`, `forja/index.astro`, ranking | E3, D7 |
| F21 | El recorrido de teclado deja de ser un laberinto | P2 | M | facilidad de uso | `ForjaCanvas.tsx`, `project.ts`, `ContextMenu.tsx`, `forja/index.astro` | A4, A5, A6, A8 |
| F22 | La Forja existe en el sitio | P2 | M | retención | `index.astro`, `forja/index.astro` | E1, E2 |

---

### F01 · Compuerta que ata los tres literales de layout

**Problema** — `tailwind.config.ts:17 'forja-split': '1133px'`, `ComponentLibrary.tsx:96 w-[300px]` y
`responsive-layout.ts:24 LIBRARY_WIDTH_PX = 300` son la misma cifra escrita a mano en tres lugares, y
nada las sincroniza.

**Por qué ocurre** — `LIBRARY_WIDTH_PX` sólo se compara consigo mismo. `tests/canvas/responsive-layout.test.ts:27-28`
verifica `LIBRARY_BESIDE_CANVAS_MIN_PX === LIBRARY_WIDTH_PX + LIBRARY_WIDTH_PX + 1`: una identidad
aritmética que sigue verde con cualquier valor. El breakpoint de Tailwind no lo lee ningún test.

**Evidencia** — `grep -rn "1133\|LIBRARY_WIDTH_PX\|w-\[300px\]"` devuelve los tres literales y ni un
solo test que los relacione. El comentario de `responsive-layout.ts:23` dice literalmente "ComponentLibrary.tsx's
own `w-[300px]`" — el código sabe que están duplicados y confía en la prosa.

**Impacto** — Todas las propuestas de layout cambian los tres a la vez. Un olvido rompe el lienzo sin
un solo test rojo, **que es exactamente cómo llegó a producción el defecto de 1133px**.

**Cómo solucionarlo** — Nuevo `tests/canvas/layout-literals.test.ts` que (a) importe
`LIBRARY_WIDTH_PX`/`TOOLS_RAIL_PX` desde `responsive-layout.ts`, (b) lea `tailwind.config.ts` y afirme
que `theme.screens['forja-split']` es igual a la derivación exportada, y (c) lea el fuente de
`ComponentLibrary.tsx` y afirme que la clase de ancho contiene el mismo número. Tres afirmaciones,
un archivo.

**Prioridad** — P0
**Costo estimado** — S
**Beneficio esperado** — confianza. Es la única forma de que F04 y F14 se puedan mergear sin apostar.

---

### F02 · El pedido pasa a frontmatter: `ask` + `afterYouDecide`

**Problema** — El pedido vive al final del cuerpo markdown, cae bajo el pliegue en el 45% del corpus,
y es una oración-cadena que transcribe las garantías del motor.

**Por qué ocurre** — `exercise-schema.ts` valida ejes, predicados, presupuestos y hasta corre el motor
sobre las soluciones de referencia; **del cuerpo del brief no valida nada**. Es un `<slot />` libre.
Transcribir el array `guarantees` garantiza cobertura y no cuesta nada.

**Evidencia** — 122 de 169 archivos (72%) tienen el patrón `**…** para que`. En `n12-el-cobro-que-tres-areas-quieren-distinto`
las cuatro cláusulas del pedido son las cuatro `guarantee.label` palabra por palabra (cobertura 1,00,
verificado abriendo el archivo). El pedido arranca en `y≈909` con el pliegue en 907. Tres ejercicios
piden por escrito una respuesta y `querySelectorAll('textarea, input[type=text], [contenteditable]')`
devuelve `[]` en los tres.

**Impacto** — Es la prioridad #1 y #2 declaradas por el dueño en un solo cambio. El pedido sube a
`y≈256`. Y deja de haber una consigna que pide algo que la interfaz no tiene dónde recibir.

**Cómo solucionarlo** — Agregar `askSchema` y `afterYouDecide` a `exercise-schema.ts` (ambos
`.optional()` durante la migración). En `ExerciseBrief.astro`: renderizar `ask` **arriba de la
narrativa, pegado al H1**, y **dejar de renderizar `aiBudget`**. En `ResultPanel.tsx`: renderizar
`afterYouDecide` bajo `POR QUÉ ÉSTA Y NO LA OTRA`. **`aiBudget` se queda en el schema** — la EC de
marca de `exercise-schema.ts:213-216` lo exige.

**Prioridad** — P0
**Costo estimado** — M
**Beneficio esperado** — claridad y comprensión. Es la infraestructura sin la cual F15 no puede empezar.

---

### F03 · Las 10 reglas como tests de contenido

**Problema** — No existe ningún control ejecutable sobre el corpus editorial.

**Por qué ocurre** — Ninguno de los 1054 tests lee el cuerpo de un brief. `level-gate.test.ts:58` hace
`matter(...).data`: sólo frontmatter.

**Evidencia** — Experimento controlado ejecutado y revertido en la Ronda 3: se llenó de basura el
cuerpo de `n1-el-comprobante-que-no-se-guarda.md`. `FORJA_LEVEL=1 npm run forja:level` → **63 pasan**.
`npm test` → **1049 / 3 saltados, byte por byte el mismo resultado**. Archivo restaurado, md5
`d0c2f54bb868769f1b0226f7d175db26`.

**Impacto** — **Se pueden vaciar los 169 cuerpos y la suite sigue verde.** Eso explica los 143
septagramas repetidos en 3+ archivos y el par que comparte 34. Corolario bueno: la migración editorial
no puede romper una compuerta.

**Cómo solucionarlo** — `tests/content/brief-rules.test.ts` con las 10 reglas de la sección 3.3, una
por `describe`, cada una fallando por una sola razón. R7 con `(?<![\p{L}])` y flag `u`. **R7, R8, R9 y
R11 se pueden escribir hoy** contra el corpus actual, sin esperar a F02. Los tests reportan lista de
archivos en falta, no un booleano, para que la migración avance por nivel.

**Prioridad** — P0
**Costo estimado** — M (≈12 h de herramienta)
**Beneficio esperado** — claridad y confianza. Convierte F15 de un acto de fe en un trabajo medible.

---

### F04 · Un solo layout: riel sticky, `forja-split` 1344, lienzo + veredicto conviven

**Problema** — A 1133px el lienzo cae a 299px con zoom 0.28. En MacBook de 13" y 14", evaluar hace
`display:none` sobre el lienzo. Y nada es sticky: no se puede consultar la consigna mientras se arma.

**Por qué ocurre** — `forja-split: 1133px` fija `w-[460px] shrink-0` para la consigna justo cuando el
playground todavía no tiene ancho para dos rieles. `THREE_COLUMN_MIN_PX = 1061` se evalúa contra el
**contenedor medido** (`ForjaCanvas.tsx:249`), no contra la ventana, y con 460px comidos no llega a
1061 hasta ~1545px de ventana.

**Evidencia** — 1132px → lienzo 782px, zoom 0.731, título de nodo 10,2px. **1133px → lienzo 299px,
zoom 0.280, título 3,9px.** Un píxel de ventana cuesta el 62% del lienzo.
`responsive-layout.ts:10-13` declara **INACEPTABLE** el caso "zoom 0.5, títulos 7px" — a 1133px en
escritorio es peor que ese caso ya rechazado. Tras "Probar respuesta": `display:none` a 1280, **1440 y
1512**; visible recién a 1600. `tests/canvas/exercise-page-layout.test.ts:55-59` pasa porque
`601 − 300 = 301 > 300`: **por un píxel, con un lienzo de 299px.**

**Impacto** — Es el defecto más visible del producto en la máquina más común de su audiencia. Cada
hallazgo del panel es un botón para resaltar una pieza en el lienzo que ya no está.

**Cómo solucionarlo** — En `responsive-layout.ts`: `TOOLS_RAIL_PX = 320`, `CANVAS_MIN_PX = 640`,
`LIBRARY_BESIDE_CANVAS_MIN_PX = 960`, `THREE_COLUMN_MIN_PX = 1280`. En `paneVisibility`, con
`resolved === 'result'` y layout no-three-column, devolver `{canvas:true, result:true}` — biblioteca y
veredicto **comparten riel** (son excluyentes en el tiempo, y el bucle de corrección sobrevive porque
`ForjaCanvas.tsx:1078 paneMenuItems` ya ofrece los 21 componentes desde el menú del lienzo).
`tailwind.config.ts`: `forja-split` 1133 → **1344**. El riel de consigna **se queda en 460px** y pasa a
`sticky top-[88px] max-h-[calc(100vh-104px)] overflow-y-auto`. Endurecer
`exercise-page-layout.test.ts:55-59` a `>= CANVAS_MIN_PX`. `playwright.config.ts` → `viewport: { width: 1440, height: 900 }`.

Medido inyectando los valores en el build corriendo: 960–1344 apilado da 762px de lienzo a 1132 (zoom
0.695, títulos 9,72px); 1344–1800 en dos rieles da 708/763/830px a 1440/1512/1600. **El lienzo nunca
vuelve a `display:none` en ningún ancho ≥768.**

**El `clamp(320px, 24vw, 420px)` para el riel está RECHAZADO**: da ~33ch a 1440, y
`exercise-page-layout.ts:31-38` documenta los 460px como decisión tipográfica medida ("~46 caracteres").
F04 recupera lienzo subiendo el breakpoint, no robándole al texto.

**Prioridad** — P0
**Costo estimado** — M
**Beneficio esperado** — facilidad de uso y velocidad. Desbloquea F11.

---

### F05 · `consequence` en el panel de resultado

**Problema** — 612 párrafos escritos, obligatorios en el tipo, y nunca renderizados.

**Por qué ocurre** — `score.ts`, en `guaranteeMissingFinding()`, construye el hallazgo con
`why: guarantee?.whyMissing` y **nunca setea `consequence`**.

**Evidencia** — `types.ts:141`: `consequence: string` es campo **obligatorio** de `Guarantee`, con el
comentario `// §13.1: rule, evidence, consequence`. `types.ts:169`: `consequence?: string` ya existe en
`Finding`. `grep consequence ResultPanel.tsx` → **0**. En `n1-la-consulta-que-saltea-la-puerta`, lo que
el jugador ve es *"no hay ningún camino desde la app de familias hasta el servicio de calificaciones
que pase por una puerta de entrada."* Lo que está escrito y nunca sale es: *"sacar el atajo sin poner
el camino correcto deja a 900 familias sin poder ver una nota. El requisito no era 'cerrar la puerta
de atrás', era 'que todos entren por la de adelante'."*

**Impacto** — Es la mejor relación beneficio/costo del comité. La diferencia entre un motor que dice
qué falta y un profesor que dice qué se pierde.

**Cómo solucionarlo** — Agregar `consequence: guarantee?.consequence,` en `guaranteeMissingFinding()`
de `score.ts`, y renderizarlo en `ResultPanel.tsx` después de la línea 422, con jerarquía visual menor
que el `why`. No toca el motor: `Finding.consequence` ya es opcional y ya se usa en
`engine/index.ts:115,125`.

**Prioridad** — P0
**Costo estimado** — S (dos líneas más el estilo)
**Beneficio esperado** — aprendizaje. Pone en pantalla el 100% de un corpus pedagógico ya escrito y ya pagado.

---

### F06 · Las conexiones dejan de robarse el clic — **resuelve la contradicción Ronda 2 / Ronda 3**

**Problema** — Clickear una conexión acierta 6 de cada 10 veces. Accesibilidad midió las cajas de
golpe de 24px y las declaró trabajo bien hecho; el validador de velocidad demostró jugando que roban
el clic a otras conexiones. **Las dos mediciones son correctas y miden cosas distintas: una mide el
tamaño del blanco, la otra mide cuál blanco gana.** El tamaño no es lo que roba el clic; la
**colocación** sí.

**Por qué ocurre** — Tres causas leídas en el código:
1. `pickHitPoint` (`edge-hit.ts:70-90`) desliza un blanco por **su propio** camino hasta despejarse de
   **los blancos ya colocados**. Nunca comprueba si el punto elegido cae **sobre el trazo de otra
   conexión**. Un blanco legítimamente termina parado encima de la línea de otra.
2. `resolveHitTarget` (`edge-hit.ts:96`) —que arbitra por distancia al centro y fue escrita
   exactamente para esto— **no la importa el renderer**. `grep -rn resolveHitTarget src/` devuelve una
   sola línea: su propia definición. `EdgeHitTargets.tsx:92-131` pinta un `<div>` por conexión y deja
   que decida el hit-test del navegador.
3. El afordance es casi invisible en reposo, así que el jugador apunta a la línea y no al punto:
   `edge-hit-target.css:21-33` pinta `::after` a `width: 30%` de 24px = **7,2px**, `opacity: 0.5`,
   color `--txt-muted`.

**Evidencia** — Ocurrió **jugando**: apuntó al medio del cable `App de familias → Servicio de
calificaciones`, apretó Delete, y el status dijo *"Se eliminó la conexión de Consola del docente a
Puerta de entrada"*. Cuantificado con 19 puntos por camino y `elementFromPoint` sobre 6 aristas:
**59,7% de precisión media, las dos peores en 42%.** En el punto medio exacto de la arista objetivo, el
elemento superior es `DIV.forja-edge-hit` **de otra conexión**. Y las etiquetas de nodo se pintan
encima de los cables que pasan debajo.

**Impacto** — Rompe el gesto central del juego y castiga con "Diseño ilegal — sin puntaje" un error que
el jugador no cometió. Es el hallazgo que más daña la confianza.

**Cómo solucionarlo** — **Sin tocar un píxel de los 24px** (siguen midiendo 24,0×24,0 CSS px a 1440 y
a 390, que es lo que accesibilidad protegía):
1. `edge-hit.ts`: `pickHitPoint` recibe además las polilíneas muestreadas de las otras aristas y
   descarta un candidato que caiga a menos de `EDGE_HIT_TARGET_PX / 2` flow-units de un trazo ajeno.
   Extender `tests/canvas/edge-hit.test.ts` con ese caso.
2. `edge-hit-target.css`: `::after` de `30%` → **42%** (10px) y `opacity` de `0.5` → **0.75**. El
   jugador apunta al punto, no a la línea. Ninguna área de golpe cambia.
3. `ForjaNode.tsx`: `pointer-events: none` en la etiqueta del nodo.
4. Si (1)+(2)+(3) no llegan al criterio, entonces sí: cablear `resolveHitTarget` como un único
   `pointerdown` a nivel panel y borrar los `onClick` por blanco. Es la versión para la que el módulo
   fue diseñado y ya tiene test. Costo M.

**Criterio de aceptación** — repetir la medición del validador (19 puntos × cada arista con
`elementFromPoint`): **≥95% de precisión media y ningún camino por debajo de 85%**, con el blanco
todavía en 24,0px a 1440 **y** a 390.

**Prioridad** — P0
**Costo estimado** — S
**Beneficio esperado** — confianza y satisfacción. Del 59,7% al 95%+ en el gesto que más se repite.

---

### F07 · Los gestos hablan

**Problema** — El éxito no se anuncia, el fallo silencioso tampoco, y evaluar no anuncia nada.

**Por qué ocurre** — `ForjaCanvas.tsx:468` hace `setStatus(verdict.ok ? '' : …)`: **el éxito escribe la
cadena vacía**, que además **borra** lo que hubiera antes. `onConnectEnd` (`ForjaCanvas.tsx:833-841`)
hace `return` sin `setStatus` cuando el drop cae fuera de un handle. `handleSubmit` nunca llama a
`setStatus`.

**Evidencia** — Tres agentes independientes lo encontraron por caminos distintos: interacción
(leyendo el `return` mudo), accesibilidad (muestreando las regiones vivas cada 100ms durante 3s,
vacías todo el tiempo) y el jugador senior (soltando sobre el cuerpo del nodo de 98×32px y no pasando
nada). `ResultPanel.tsx` tiene **cero** `aria-live`, `role="status"`, `role="alert"`, `role="region"` o
`aria-label` en sus 455 renglones (grep = 0). El único blanco válido para conectar mide 5,6×5,6px
reales: *"la única diferencia fue apuntar a 6px en vez de a 98px."* Mientras tanto, **crear un nodo sí
anuncia**.

**Impacto** — WCAG 4.1.3 nivel AA en dos lugares, y —más grave para el producto— el jugador no se
entera de que su acción funcionó ni de por qué no funcionó. La convergencia de tres roles distintos es
señal de gravedad.

**Cómo solucionarlo** — (a) `setStatus(verdict.ok ? 'Conexión creada de X a Y. Sin clase de dato
declarada: Shift+F10 sobre la conexión para declararla.' : …)` — el anuncio enseña el gesto en el
momento en que importa. (b) Rama que hable en el `return` mudo de `onConnectEnd`, más
`connectionRadius={40}` en el `<ReactFlow>`. (c) `role="status" aria-live="polite"` en el contenedor
del veredicto de `ResultPanel.tsx`, y mover el foco al encabezado del panel tras evaluar.

**Prioridad** — P0
**Costo estimado** — M
**Beneficio esperado** — comprensión y aprendizaje. Convierte tres fallos silenciosos en tres momentos
de enseñanza.

---

### F08 · Superficie, elevación y movimiento del lienzo

**Problema** — La superficie más grande del producto está pintada con el gris por defecto de React
Flow, hay 37 sombras invisibles, los tooltips flotan más oscuros que el panel de abajo, y en el lienzo
no hay ni una transición.

**Por qué ocurre** — `#141414` nunca se sobreescribió. Las sombras se declararon pensando en fondo
claro. Los 21 tooltips de la paleta usan `bg-bg-deep` (`#0a0f1a`) sobre un panel `bg-bg-surface`
(`#131b2e`). Y la palabra `transition` aparece **una sola vez** en todo `ForjaCanvas.tsx`.

**Evidencia** — Lienzo medido en `#141414`, token de marca `#0a0f1a`. La sombra dominante da **1,03:1**
sobre `#131b2e` — invisible, en 28 elementos. `transitionDuration` medido: submit 0s · undo 0s · reset
0s · tab 0s · `.react-flow__edge-path` 0s · handle 0s. El motor responde en **12,6 ms**, y el arrastre
de nodo tiene p50 de 16,4 ms — 60 fps limpios.

**Impacto** — Es la tarde de trabajo con más retorno visual del backlog: cambia la superficie dominante
del producto y borra ruido.

**Cómo solucionarlo** — (a) una línea: fondo del `<ReactFlow>` a `#0a0f1a`. (b) borrar las 37 sombras,
dejar una familia. (c) invertir la elevación de los 21 tooltips. (d) `transition-colors duration-150
ease-[cubic-bezier(0.4,0,0.2,1)]` en los 4 controles de la barra. (e) entrada del riel de resultado en
**180 ms** `cubic-bezier(0.16,1,0.3,1)`.

**NO hacer**: transición sobre el `transform` del nodo (se arrastran: sería un elástico con retardo);
**no animar el puntaje** (es el dato que el jugador está esperando, se anima el contenedor); **no
desfasar el reencuadre** (mover la cámara después de que el ojo aterrizó es cuando más molesta); **no
trazar la arista nueva en 300ms** (le repite al jugador el gesto que su mano acaba de hacer y retrasa
300ms una confirmación que hoy llega en 12,6 — si se quiere movimiento ahí, 120ms de opacidad sobre el
path ya terminado).

**Prioridad** — P1
**Costo estimado** — S
**Beneficio esperado** — percepción premium. Es el ítem "una tarde" de mayor impacto visible.

---

### F09 · Placeholder SSR del lienzo

**Problema** — En un teléfono real, el lienzo no existe durante 3 segundos y el hueco es negro absoluto.

**Por qué ocurre** — El brief es HTML estático y se pinta enseguida; el lienzo carga `ForjaCanvas.js`
(82,2 KB gz / 250,7 KB) + `client.js` (57,5 KB / 182,3 KB) y recién ahí monta React Flow. No hay
esqueleto.

**Evidencia** — Nadie lo había visto porque todos midieron sin throttle. Con CPU 6× + Fast 3G: FCP
532 ms, **lienzo interactivo a 3.010 ms**. A `performance.now() = 1479ms`: `.react-flow` → **`null`**,
nodos → **0**, y `[class*=skeleton],[class*=spinner],[aria-busy],[role=progressbar]` → **0**. Captura:
**960 de 1440 px en negro absoluto.**

**Impacto** — Tres segundos de pantalla negra en la primera visita desde un teléfono es la peor primera
impresión posible de un producto que se vende por su factura.

**Cómo solucionarlo** — En `[exercise].astro`, renderizar del lado del servidor un bloque con la
geometría exacta del lienzo (mismo alto, mismo fondo `#0a0f1a`, mismo radio) con las bandas de zona
dibujadas y `aria-busy="true"`, que el montaje de React Flow reemplaza. CLS medido hoy es 0,004-0,005 y
hay que mantenerlo ahí.

**Prioridad** — P1
**Costo estimado** — S
**Beneficio esperado** — percepción premium y confianza en el arranque móvil.

---

### F10 · El panel dice qué evaluó y qué construiste

**Problema** — Con diseño ilegal desaparece "Ejes evaluados"; el juego nunca nombra el patrón que el
jugador construyó; y en 3 de 6 puntajes perfectos el panel no marcó qué solución de referencia armó.

**Por qué ocurre** — `rubric` no se renderiza en ningún lado. Y `closestReferenceIndex()` en
`src/components/forja/canvas/reference-solutions.ts` exige **igualdad exacta de fingerprint**, que
incluye los tipos de todos los nodos presentes **aunque estén desconectados**.

**Evidencia** — `grep rubric` en `src/components`, `src/pages`, `src/lib` (fuera del schema) → **0
referencias**. Pero `rubric` **no es un duplicado**: Jaccard mediano **0,09** contra la garantía a la
que apunta, cobertura mediana **0,17**, sólo **27 de 589 (4,6%)** por encima de 0,70 — contra 0,85 y
76% de `hiddenFacts.fact`. 616 dimensiones, 589 con `signal: predicate`, **0 huérfanas**. Ejemplo real
(`n1-la-consulta-que-saltea-la-puerta`): label *"ningún cliente llega al servicio de calificaciones por
su cuenta"* vs dimension *"no queda ningún camino que evite la verificación de identidad"* — la segunda
es la traducción humana de la primera. En `/forja/1/n1-el-comprobante-que-no-se-guarda`, la consigna
dice literal *"Elegí una, conectala"* y nunca dice borrar la otra: conectar una y dejar la otra da
100/100 **sin marca**; borrar la sobrante da 100/100 **con marca**.

**Impacto** — El jugador sale con criterio y sin vocabulario: no puede llevarlo a una revisión de
diseño, a una entrevista, ni a la literatura. Y en la mitad de sus mejores momentos el producto no le
dice qué logró.

**Cómo solucionarlo** — (a) **Renderizar `rubric.dimension`** como la etiqueta humana de cada eje en
`ResultPanel.tsx`, **incluida la rama de diseño ilegal**. Cierra la propuesta de borrarlo, que estaba
**RECHAZADA**: se lo había agrupado con `hiddenFacts` por compartir el síntoma (no se renderiza) sin
medir si compartía la causa (ser duplicado). No la comparte. Costo S contra L de borrarlo.
(b) `closestReferenceIndex()`: comparar sólo el subgrafo **conectado** al objetivo, ignorando nodos
sueltos que la consigna no pidió borrar.

**Prioridad** — P1
**Costo estimado** — M (S + S, mismo archivo)
**Beneficio esperado** — aprendizaje. Pone nombre a lo que el jugador acaba de construir.

---

### F11 · Bloque tipográfico del brief + `<dl>` arriba del H1

**Problema** — Los seis párrafos de todo brief salen con **0px de separación** y una sola firma
tipográfica.

**Por qué ocurre** — `ExerciseBrief.astro:42` aplica `class="prose prose-invert mt-4 max-w-none …"` y
**`@tailwindcss/typography` no está en `package.json`** (`tailwind.config.ts:93` dice `plugins: []`).
La única regla `.prose*` compilada es `.prose-custom`, que vive en el CSS del blog y nunca llega acá.
El preflight de Tailwind pone `margin: 0` en los `<p>` y nada lo devuelve.

**Evidencia** — Encontrado por tres agentes independientes. `margin-top: 0px` y distancia entre cajas
de párrafos consecutivos = **`[0,0,0,0,0]`** en los 6 párrafos, idéntico a 390/768/1133/1440px.
`distinctParagraphStyles = 1` en los 16 briefs medidos: cada párrafo, blockquote incluido, computa
`14px | 400 | rgb(148,163,184)`. Los 895 `<strong>` de 168 de 169 archivos rinden en el mismo color
que el párrafo. Cuerpo a 14px/20px (ratio 1.43) mientras el blog del mismo sitio usa 1.8 con 20px
entre párrafos: **dos estándares tipográficos en el mismo sitio, y el juego tiene el peor.**

**Impacto** — Parte de "parece escrito por un robot" **no es el texto**. Primero se arregla el render;
después se juzga el texto sobre lo que realmente se ve.

**Cómo solucionarlo** — Bloque tipográfico propio en `ExerciseBrief.astro` (no reusar `.prose-custom`:
su `max-width: 760px` es declaración muerta en una columna de 410px y da **40,6ch**; el bloque propio
da **45,0ch**). Los 45ch se compran **bajando el padding horizontal de la tarjeta de 24px a 16px**, no
tocando el riel. Micro-encabezados en versalita 10px/16px w600 `ls 0.6px` desde el componente — **no
hay markdown que estilar: los 169 cuerpos tienen 0 headings `##`/`###`**. `<strong>` pasa al color
primario. **Y el `<dl>` de presupuesto y restricciones se mueve arriba de la narrativa**, pegado al H1.

**El H1 se queda en 24px**: bajarlo a 20 o subirlo a 32 están **las dos RECHAZADAS** — títulos de
mediana 42 caracteres dan las mismas 2 líneas, el ahorro son 8-16px contra 608-815px bajo el pliegue, y
cuesta el único ancla a 13,92:1.

**Prioridad** — P1
**Costo estimado** — M
**Beneficio esperado** — claridad y elegancia. **Bloqueado por F04** (ver dependencia dura D1).

---

### F12 · La biblioteca dice el nombre completo

**Problema** — Cinco de 21 componentes tienen el nombre cortado, incluso a 1920px. Y dos piezas no las
usa ningún ejercicio.

**Por qué ocurre** — `ComponentLibrary.tsx:96` fija `w-[300px] shrink-0` y la línea 102 mete
`grid grid-cols-2 gap-1`: **106px útiles por celda, constantes**, con `truncate` en la línea 128.

**Evidencia** — "Almacenamiento de objetos" necesita 158px y tiene 106 (33% oculto); "Proveedor de
identidad" 132px; "Componente genérico" 126px. Y `business-process` y `generic` tienen **0 apariciones
en los 169 `startingDesign` y 0 en las `referenceSolutions`**; el tooltip de `generic` admite *"El
motor sólo valida su zona y su banda"* — una pieza que ninguna garantía puede evaluar.

**Impacto** — Un catálogo que no se puede leer es un catálogo que se explora a ciegas, y ocupa dos
slots permanentes con piezas muertas.

**Cómo solucionarlo** — `grid grid-cols-2` → `flex flex-col` (268px útiles, arreglo de una línea).
Borrar `business-process` y `generic` de `catalog.ts` — borrar gana, y la paleta baja de 21 a 19
paradas de teclado, lo que también ayuda a F21.

**Prioridad** — P1
**Costo estimado** — S
**Beneficio esperado** — claridad. Una línea contra el 33% de una etiqueta.

---

### F13 · Salida al terminar un nivel + «Volver a intentar»

**Problema** — Terminar un nivel es un callejón sin salida, el epílogo de fin de juego se le muestra a
quien no jugó nada, y después de fallar el producto invita a abandonar el ejercicio fallado.

**Por qué ocurre** — `next-step.ts:21`: `| { kind: 'last-of-level' }` es una **variante sin payload**,
así que la UI no tiene con qué construir un link. Y `nextStepFor` deriva el paso siguiente de la
**posición del ejercicio en el nivel**, nunca del progreso ni del puntaje.

**Evidencia** — `ResultPanel.tsx:243-248` sólo puede pintar *"Era el último ejercicio de este nivel."*
Sin link, sin nivel siguiente, sin vuelta al mapa. El caso `game-complete` (ocurre **1 vez**) sí ofrece
`Volver a los niveles →`; **el caso que ocurre 11 veces es el que no tiene salida.** Reproducido: abrir
el último ejercicio del 12 sin resolver nada y apretar "Probar respuesta" sin tocar el lienzo →
*"Diseño ilegal — sin puntaje"* seguido de *"**Terminaste La Forja.**"*, mientras el panel lateral dice
*"Todavía no guardaste ningún intento"*. `Continuar|Seguir|Retomar` → **false**. Y verificado:
`src/lib/forja/progression/unlock.ts` —con `isLevelComplete` y `requiredRoles`— **lo importa
exactamente un archivo: su propio test.** Escrito, testeado, y no llega a ninguna pantalla.

**Impacto** — El producto tiene la lógica de progresión construida y la desperdicia en los dos momentos
que deciden si alguien vuelve: el final de un nivel y el minuto después de fallar.

**Cómo solucionarlo** — (a) `last-of-level` pasa a `{ kind: 'last-of-level'; nextLevelHref: string;
nextLevelTitle: string }` y `ResultPanel.tsx` pinta el link. (b) Cablear `isLevelComplete` de
`unlock.ts` al mapa de niveles y al panel: gatear `game-complete` por progreso real, no por posición.
(c) Con `score < 100`, el CTA prominente pasa a ser **«Volver a intentar»**; `Siguiente ejercicio →`
baja a secundario.
(d) Con `score === 100` por primera vez, bajo `POR QUÉ ÉSTA Y NO LA OTRA`, reusar el formulario de
newsletter del footer: *"**Este ejercicio tiene un par.** El mismo problema con un dato distinto cambia
la respuesta. Te lo mando el lunes, con la solución de referencia que no elegiste."* Es el único canal
de retorno **fuera del navegador** disponible sin cuentas.

**No hacer racha.** El día que el jugador la rompe, el producto le borra su único motivo — y acá vive
en `localStorage`, así que limpiar el navegador la rompe sin que el jugador haya hecho nada.

**Prioridad** — P1
**Costo estimado** — S
**Beneficio esperado** — retención. Es el único ítem del backlog que crea un motivo mecánico para volver.

---

### F14 · Handles 12/24, `connectionRadius`, piso de zoom 0,62

**Problema** — Los handles de conexión miden 5,5px en escritorio y 3,2px en móvil, contra el mínimo de
24×24 de WCAG 2.5.8.

**Por qué ocurre** — Están declarados `!h-2.5 !w-2.5` en unidades de flujo, así que el zoom los encoge.
Es exactamente el defecto que `edgeHitTargetStyle` ya resolvió para las conexiones, y los handles
quedaron atrás.

**Evidencia** — 1440×900, zoom 0.549 → handle real **5,5×5,5px** (5,3% del área requerida), etiqueta
efectiva 7,69px, nodo 34px de alto. 390×844, zoom 0.322 → handle **3,2×3,2px**, etiqueta **4,51px**,
nodo **20px**. **14 de 14 handles incumplen en los dos viewports.** A 390px, 11 de 32 controles están
bajo 24×24, incluida una conexión con **altura 0,0px**. Y el costo del arreglo ya está medido:
contra-escalar 22 handles durante 25 gestos de zoom da **p90 1,6 ms · máx 3,9 ms** sobre un presupuesto
de 16,7 ms — **es gratis**.

**Impacto** — El gesto que más se repite en el juego apunta a un blanco de 5px.

**Cómo solucionarlo** — Handle contra-escalado por zoom: **12/zoom visible + halo transparente hasta
24/zoom de área de golpe**. Es el patrón que `edge-hit.ts` ya aplica a las conexiones, repartido bien:
lo visible chico, el blanco grande. Más `connectionRadius={40}` en el `<ReactFlow>` (compartido con
F07). Y **piso de zoom 0,62** en `responsive-layout.ts`.

**La bajada de `BAND_WIDTH` de 360 a 300 está RECHAZADA**, así que el piso de zoom es ahora la única
palanca de legibilidad de títulos. El rechazo se validó en un sandbox aislado: 6 roturas, **5 netas**
tras el `sed` de 995 coordenadas, y las tres de `band-label-position.test.ts` **no son umbrales: son
una regresión de producto en teléfono** — a zoom 0.322 las bandas caen de 116px a 96,6px y
"Infraestructura" mide 101,89px al tamaño más chico, así que **la banda pierde su nombre**. Precio:
+1,2px de título en escritorio a cambio del nombre de una banda en móvil.

**Condición** — el piso de 0,62 sale de una tabla, no de una prueba táctil. **Hay que medir cuánto
paneo obliga a 390px antes de mergear.**

**Prioridad** — P1
**Costo estimado** — M
**Beneficio esperado** — facilidad de uso. Cierra WCAG 2.5.8 en el gesto central.

---

### F15 · Migración editorial de los 169 briefs

**Problema** — El pedido de 169 ejercicios es la serialización del array `guarantees`, el texto no le
habla a nadie, y hay frases de mail-merge.

**Por qué ocurre** — Nada valida el cuerpo (F03). Transcribir garantiza cobertura y no cuesta nada.

**Evidencia** — Cobertura léxica pedido↔garantías por nivel: 0,17 · 0,40 · 0,47 · 0,14 · 0,32 · 0,56 ·
**0,89** (nivel 12), con tres archivos en **1,00**. **122 de 169 (72%)** tienen el patrón `**…** para
que`; **70 de 169** repiten la frase del presupuesto que ya está en el `<dd>`. El **72% no tiene ni una
marca de segunda persona** fuera del pedido y el **64% no la tiene en ningún lado**; diez archivos
tienen exactamente 0. **143 septagramas** aparecen en 3+ archivos (el más repetido, 27 veces); **126
pares** comparten 8 o más secuencias idénticas de 7 palabras; solapamiento máximo entre dos archivos
**32,3%**; `n12-el-peritaje-que-no-puede-esperar-al-buro` y `n12-la-firma-que-el-director-quiere-en-el-hangar`
comparten **34 septagramas** — el mismo molde con los sustantivos cambiados.

Contraprueba de que la voz funciona: `n12-la-copia-del-saldo` dice *"Hacé la misma pregunta que la vez
pasada: **¿qué puede cambiar este dato sin que yo lo vea?**"* — 18 palabras que hacen más trabajo
pedagógico que los tres párrafos anteriores juntos.

**Impacto** — Es la queja #1 del dueño, y el único ítem del backlog que es un proyecto de semanas.

**Cómo solucionarlo** — Orden obligatorio: **herramienta (F03) → piloto nivel 1 completo (14 archivos)
→ recalibrar los umbrales con lo aprendido → niveles 12, 11, 10 → el resto.** **La unidad de migración
es el NIVEL, nunca el archivo**: los ejercicios de un nivel se leen en secuencia y las reglas
anti-mail-merge (R11) se miden entre pares. Por cada archivo: mover el pedido a `ask`, mover la
enseñanza de `aiBudget` a `afterYouDecide`, borrar la `constraint` que duplica `budget.opsUnits` (R9),
y agregar una marca de segunda persona al primer párrafo (R7). **La narrativa no se reescribe.**
Como muestra la sección 3.4, un brief que ya está bien cuesta 8 palabras.

**Prioridad** — P1
**Costo estimado** — **XL — 60-70 h de escritura real.** Desglose: 28 h en ~560 viñetas de `mustHold`,
19 h en los `wontCount`, 17 h en los `goal`.
**Beneficio esperado** — claridad y aprendizaje, sobre el 100% del corpus. Es el ítem que resuelve la
frase con la que arrancó todo esto.

---

### F16 · `hiddenFacts.fact` se borra; `discoveryPath` pasa a `hints[]`

**Problema** — 32.146 palabras de `hiddenFacts` escritas y jamás renderizadas, contra 46.063 de cuerpo
visible.

**Por qué ocurre** — La única aparición de `hiddenFacts`/`discoveryPath` en código es un **comentario**
en `ExerciseBrief.astro:7-8` que dice que "se descubren jugando". No existe ningún mecanismo.

**Evidencia** — La tensión de la Ronda 1 (¿borrar o usar como pistas?) se resolvió **midiendo los dos
subcampos por separado**, no promediando:

| | solapamiento mediano con el enunciado visible | ítems ≥0,70 |
|---|---|---|
| `fact` | **0,85** | 372/488 (76%) |
| `discoveryPath` | **0,40** | 23/488 (5%) |

*"Un sistema de pistas cuyas pistas son en un 76% una reescritura de texto que ya está en pantalla no
es un sistema de pistas: es un botón de 'volvé a leer'."*

**Impacto** — Cada hecho está escrito dos veces, en dos registros, y las dos copias pueden derivar. Al
mismo tiempo, el 95% de los `discoveryPath` sí dice algo nuevo — y ya está escrito para los 169.

**Cómo solucionarlo** — Borrar `fact` de los 169 con script (es mecánico y `hiddenFacts` no lo lee el
motor: no aparece en `src/lib/forja/engine/`). Renombrar `discoveryPath` a `hints[]` en
`exercise-schema.ts` y servirlas **de a una, después del primer intento fallido**, en `ResultPanel.tsx`.

**Prioridad** — P1
**Costo estimado** — L
**Beneficio esperado** — aprendizaje. Convierte 488 párrafos muertos en un sistema de pistas real y
borra 32.146 palabras de deuda de mantenimiento.

---

### F17 · El rechazo de conexión persiste y enseña la cura

**Problema** — El motor aplica reglas de forma que nunca enseña, y "Tercero externo" es una trampa
estructural hacia la que el enunciado empuja.

**Por qué ocurre** — El rechazo se escribe en el `[role="status"]`, que **la siguiente acción
sobrescribe**. Y la zona de un nodo es fija por tipo, pero el jugador no tiene cómo saberlo: las bandas
de zona **no están rotuladas en el lienzo**.

**Evidencia** — Rechazo de `cola → proveedor externo` que el ejercicio necesita resolver con un
`worker` en el medio: el jugador arrastra, no pasa nada, y el mensaje desaparece con el clic siguiente.
Geometría medida del banner actual: la barra crece **29→49px** y `.react-flow` baja **593→573px** — el
aviso le come el lienzo. Sobre la trampa: `catalog.ts:37` → `'external-party': { name: 'Tercero
externo', zone: 'public', props: { contract: 'sí' } }`, y el enunciado de
`n1-el-pedido-que-el-operador-nunca-recibe` dice textual *"tiene su propio horario, su propia caída y
**su propio contrato**"*. **La única pieza del catálogo con `contract: 'sí'` es la que nunca puede ganar
el ejercicio.** Arrastrarla a la banda correcta da el mismo rechazo palabra por palabra, y el menú
contextual ofrece **seis colores decorativos y cero propiedades semánticas**.

**Impacto** — El jugador experimentado es el que más cae: lee "contrato" y elige la pieza que dice
"contrato".

**Cómo solucionarlo** — (a) El rechazo pasa a `Panel position="bottom-center"` de React Flow (patrón
que el repo ya usa en `ForjaCanvas.tsx:1352`), **fuera del flujo del layout**, persistente hasta
"Entendido" / Escape / conexión exitosa; la barra queda en `h-7` fijo con `truncate`. El texto actual
(196 caracteres) es bueno y no se toca. (b) La descripción de cada pieza en `catalog.ts` **declara su
zona fija**. (c) El mensaje de rechazo agrega **la cura después de la causa** ("…poné un worker en el
medio"). (d) Rotular las bandas de zona en el lienzo.

**Prioridad** — P1
**Costo estimado** — S
**Beneficio esperado** — aprendizaje y comprensión. Convierte la regla más frustrante del motor en la
lección que estaba destinada a ser.

---

### F18 · El panel deja de repetirse

**Problema** — El panel de resultado imprime el mismo hallazgo dos veces, y un 100/100 sale con notas
pegadas que no cuestan nada.

**Por qué ocurre** — `ResultPanel.tsx:363-364` (costo por eje no satisfecho) y `ResultPanel.tsx:426-431`
(`findingCostLabel` por hallazgo) muestran el mismo título y el mismo costo: cada eje fallado genera
exactamente un hallazgo, así que **la lista de ejes fallados y la de hallazgos son la misma lista**. Y
`rules.ts:106-108` hace `if (!e.dataClass) add('undeclared-data-class', 'note', …)` sin condicionar al
ejercicio.

**Evidencia** — Panel medido en `scrollHeight 762 / clientHeight 594`. En n12 con **100/100**:
`scrollHeight 2554 / clientHeight 599` → **77% oculto**, y la frase *"Falta declarar qué dato viaja"*
aparece **7 veces idéntica**. Debajo de esas 7 copias hay 1 advertencia real de arquitectura que nadie
va a leer. Además, **39 de las 987 aristas iniciales del corpus ya vienen sin declarar** (4 de 4 en
`n4-la-cola-de-imagenes-sin-destino`): el jugador recibe notas por omisiones que no cometió.

**Impacto** — El momento de máxima atención del juego está enterrado bajo 7 copias de la misma frase.

**Cómo solucionarlo** — (a) Fundir las dos listas en `ResultPanel.tsx`: un eje fallado se pinta una
vez, con su costo y su hallazgo. (b) Agrupar `undeclared-data-class` en una sola nota con contador. (c)
Condicionar la nota a que el ejercicio evalúe clases de dato, y no emitirla para aristas que ya venían
sin declarar en el `startingDesign`.

**Prioridad** — P1
**Costo estimado** — S
**Beneficio esperado** — claridad y velocidad. Un panel del que se lee el 100% en vez del 23%.

---

### F19 · Poda del estado del jugador

**Problema** — El jugador más dedicado es el primero que rompe el producto, y `setItem` falla sin
ningún mensaje.

**Por qué ocurre** — `local-adapter.ts:25` guarda un array plano sin poda, y cada intento persiste el
**grafo completo con posiciones**.

**Evidencia** — Medido: **76 intentos sobre 7 ejercicios = 145.882 caracteres**, media 1.920 bytes por
intento. Sondeo de cuota: `QuotaExceededError` en el bloque 19 → techo real **~5 MB**. Proyección con
la tasa real observada: **168 × 11 × 1.920 ≈ 3,5 MB = 70% de la cuota.**

**Impacto** — Pérdida silenciosa de progreso justo en el jugador que más valor le dio al producto.

**Cómo solucionarlo** — En `local-adapter.ts`: conservar **el mejor intento + los 2 más recientes por
ejercicio**, y no persistir `design` en los que no son el mejor. Techo permanente ~968 KB. Y capturar
`QuotaExceededError` para decirlo en pantalla.

**Prioridad** — P2
**Costo estimado** — S
**Beneficio esperado** — confianza y retención.

---

### F20 · Mapa de niveles con próximo paso, y se borra el podio

**Problema** — El mapa de niveles son 12 filas idénticas encabezadas por un contador de deuda, y el
"Ranking" es un podio del jugador contra sí mismo.

**Por qué ocurre** — Las 12 tarjetas comparten estilo computado y no hay ningún componente de estado
por nivel. El ranking se calcula en el navegador sobre los intentos de una sola persona.

**Evidencia** — La cadena **"14 ejercicios · todavía ninguno resuelto" aparece 12 veces literales**;
`getComputedStyle` de las 12 tarjetas da mismo fondo, borde, padding y radio; `[role="progressbar"]` →
**0**. Encabeza con *"1 de 168 ejercicios resueltos"*. El ranking imprime `#1 · Vos 100 / #2 · Vos 100 /
#3 · Vos 100 / #4 · Vos 75 …` —ni siquiera deduplica, con el mismo ejercicio en #1, #3, #4 y #10— más
**dos avisos de que no es un ranking**: *"Local · calculado en tu navegador, sin verificar en
servidor"* y *"Ranking global: no disponible en esta versión — todavía no hay cuentas."* Y aparece en
la landing `/forja`, **antes de que el visitante haya jugado nada**.

*(Corrección a la Ronda 1: el progreso **sí** se ve — `/forja/niveles` imprime "7 de 168 ejercicios
resueltos" y por nivel "1 de 14 resuelto". Lo que falta no es el dato, es el próximo paso.)*

**Impacto** — Dos elementos que trabajan contra la percepción premium: una lista sin jerarquía y un
podio que declara dos veces no serlo.

**Cómo solucionarlo** — (a) Fila de **88px** con numeral mono, barra de progreso de **3px** y chip de
estado (`EMPEZAR` / `CONTINUAR` / `✓ COMPLETO` / `PRÓXIMAMENTE`), alimentado por `isLevelComplete` de
`unlock.ts` (cableado en F13). (b) **Borrar el ranking** de la landing y del panel: el dato útil —tu
mejor puntaje— ya está en la lista de nivel como `Resuelto · mejor puntaje 50`. Borrar gana.

**Prioridad** — P2
**Costo estimado** — M
**Beneficio esperado** — retención y percepción premium.

---

### F21 · El recorrido de teclado deja de ser un laberinto

**Problema** — 42 Tab para tocar el lienzo, 35 Shift+Tab para volver, las conexiones se describen en
inglés con los atajos equivocados, el menú contextual no retiene el foco, y la única documentación de
teclado que existe **es falsa**.

**Por qué ocurre** — 21 piezas de biblioteca son 21 paradas. `project.ts:69` pone `domAttributes` a los
**nodos**; el mapeo de **aristas** (`:110-127`) define `ariaLabel` pero **no `domAttributes`**, así que
las conexiones se quedan con el default de React Flow. `ContextMenu.tsx:78-97` maneja flechas / Home /
End / Escape pero **no `Tab`**.

**Evidencia** — En n12: **38 Tab a la primera conexión, 49 al primer nodo**. El "Saltar al contenido"
del sitio deja el foco antes de todo eso. Las conexiones anuncian *"Press enter or space to select an
edge. You can then press delete to remove it or escape to cancel."* — **sin `lang="en"`, dentro de un
`<html lang="es">`**, y doblemente falso: Enter no selecciona y nunca menciona `Shift+F10`. Con el
menú abierto, Tab manda el foco al **formulario de newsletter del footer** y el menú sigue abierto
escuchando flechas desde `window`. Y `src/pages/forja/index.astro:98` dice *"Enter para
crear/conectar"*: `ForjaCanvas.tsx:1133` muestra que la conexión empieza con la tecla `c`; el estado
antes y después de Enter es idéntico.

**Nota importante para no romper lo que está bien:** **sí se puede completar un ejercicio entero sin
mouse** — se hizo de punta a punta en n1 @1440. Los gestos existen todos y varios están bien pensados;
los nombres accesibles computados son de primera (*"Conexión de Servicio de altas a Almacén de
documentos de identidad, dato regulado"*). *"El recorrido no se rompe: se apaga."*

**Impacto** — Un equivalente de teclado indescubrible y mal documentado **vuelve de papel la excepción
de "control equivalente" de WCAG 2.5.8**.

**Cómo solucionarlo** — (a) Roving tabindex en la biblioteca — el patrón que `ContextMenu.tsx:126` ya
usa bien — más un link "Saltar al lienzo". **42 → 12 pulsaciones.** (b) `domAttributes` en el mapeo de
aristas de `project.ts` (dos líneas). (c) `Tab` atrapado en `ContextMenu.tsx`. (d) Corregir
`forja/index.astro:98` y agregar `<kbd>` a los gestos reales (hoy el único `<kbd>` de toda La Forja es
el `Ctrl+Z` del botón Deshacer).

**Prioridad** — P2
**Costo estimado** — M
**Beneficio esperado** — facilidad de uso. De 42 pulsaciones a 12 en el camino más frecuente.

---

### F22 · La Forja existe en el sitio

**Problema** — El activo más grande del proyecto tiene tráfico ~0, y su landing es huérfana.

**Por qué ocurre** — Nadie escribió la conexión desde la home, y la landing describe una función a la
que no se puede llegar.

**Evidencia** — `dist/index.html` tiene **exactamente 2 links a `/forja`**, los dos a `/forja/niveles`
y los dos en el navbar (escritorio + menú móvil). En los 6.696px de contenido la palabra no aparece ni
una vez fuera del nav. **Ningún link del sitio apunta a `/forja`.** La landing: `scrollHeight` 906px,
**0 elementos `img/video/canvas`** dentro de `main`, **exactamente 1 link**, y describe el "Lienzo
libre" en un `<h2>` **sin `<a>`**.

**Impacto** — Es el único ítem del backlog que mueve adquisición. Todo lo demás mejora un producto que
nadie encuentra.

**Cómo solucionarlo** — (a) Bloque de La Forja en `src/pages/index.astro`, dentro del contenido, con
link a `/forja`. (b) En `forja/index.astro`: una captura real del lienzo (o el placeholder de F09
poblado) arriba del pliegue, link al "Lienzo libre", y borrar el podio (compartido con F20).

**Prioridad** — P2
**Costo estimado** — M
**Beneficio esperado** — retención y adquisición.

---

## 6. Plan de ejecución por fases

### Dependencias duras (bloqueantes, no sugerencias)

| # | Dependencia | Por qué |
|---|---|---|
| **D1** | **F11 (tipografía) NO se mergea antes que F04 (riel sticky)** | La tipografía correcta hace crecer el brief **+206px @1920 / +194px @1440**. Medido en `n1-la-consulta-que-saltea-la-puerta` (233 palabras, **cuartil corto**): el `<dl>` de presupuesto y restricciones pasa de 653→874 a ~847→**1068**, con el pliegue en **900**. Hoy cierra con 26px de margen; con la tipografía sola, las restricciones quedan **168px bajo el pliegue en un ejercicio corto**. Aplicar F11 sin F04 **mejora la lectura y empeora el producto**. |
| **D2** | **F04 y F14 NO tocan un literal antes que F01** | `tailwind.config.ts:17`, `ComponentLibrary.tsx:96` y `responsive-layout.ts:24` son la misma cifra en tres lugares y ningún test los ata. Un olvido rompe el layout sin un solo test rojo — así llegó el defecto original. |
| **D3** | **F15 NO empieza antes que F02 + F03** | Migrar 169 archivos sin el schema y sin las reglas es volver a derivar al mail-merge, y esta vez sobre un formato nuevo. El orden es: herramienta → piloto nivel 1 → **recalibrar umbrales** → 12, 11, 10 → resto. |
| **D4** | **F03 se parte en dos: 4 reglas hoy, 6 después de F02** | R7, R8, R9 y R11 miden el corpus **actual** y se pueden escribir esta noche. R2, R3, R4, R5 y R6 miden campos de `ask` que todavía no existen; R10 se genera desde `startingDesign`. Esto permite arrancar F03 sin esperar a F02. |
| **D5** | **F04 no se declara hecho sin `npm run test:e2e`** | `tests/e2e/correction-loop.spec.ts:16` corre sin `setViewportSize`, o sea en el default 1280×720 → playground 1232 < 1280: **rompe**. El arreglo es una línea (`playwright.config.ts` → viewport 1440×900) y **es una corrección en sí**: la suite probaba 1280×720 y el defecto vivía a 1440. **Nadie del comité corrió e2e.** |
| **D6** | **F05, F10, F18 y el `aria-live` de F07 van en una sola rama** | Los cuatro editan `ResultPanel.tsx` en la misma región. No es orden obligatorio, es **un solo escritor**: cuatro ramas paralelas sobre ese archivo son cuatro conflictos garantizados. |
| **D7** | **F02 no borra ni renombra `aiBudget`** | `exercise-schema.ts:213-216` documenta la EC de marca *"accesible y con `aiBudget` declarado"*. F02 deja de **renderizarlo** y agrega `afterYouDecide` aparte. Un campo por trabajo. |
| **D8** | **F14 no mergea el piso de zoom 0,62 sin una medición a 390px** | Sale de una tabla, no de una prueba táctil, y **nadie probó táctil**. Con `BAND_WIDTH` rechazado, es la única palanca de legibilidad que queda: si obliga a demasiado paneo, no hay plan B. |

### Fase 0 — esta tarde (nada bloquea, todo es S)

`F01` → `F05` → `F06` → `F08` → `F09` → `F12`

Seis ítems, todos de costo S, cero dependencias entre ellos salvo que F05 va con F10/F18 si se hacen
juntos (D6). Al final de la tarde: el fondo del lienzo es el de la marca, se ven 612 párrafos que nunca
se habían visto, clickear una conexión funciona, la biblioteca dice los nombres completos, y existe la
compuerta que habilita todo lo demás.

### Fase 1 — la semana que viene (el layout y la voz)

`F04` (necesita F01) → `F07` → `F11` (necesita F04) → `F10` + `F18` (una rama con F05, D6) → `F13` → `F17`

Cierra B1, B2, B3, N5, C1, C3, C4, C5, C7, C8, D4, D5, N3, N6 y A1-A3. **Al final de esta fase el
producto se siente construido por un equipo.** Requiere correr `npm run test:e2e` (D5).

### Fase 2 — el mes (la queja #1)

`F02` → `F03` (parte D4 puede arrancar en Fase 0) → `F15` piloto nivel 1 → **recalibrar** → niveles 12,
11, 10 → resto → `F16`

Es el proyecto de semanas. 60-70 h de escritura real más 12 h de herramienta. **No se puede acelerar
saltando el piloto**: los umbrales de R2, R3 y R6 están calibrados sobre el corpus viejo y hay que
recalibrarlos contra 14 archivos reales antes de aplicarlos a 155.

### Fase 3 — después (pulido y alcance)

`F14` (necesita D8) → `F19` → `F20` → `F21` → `F22`

---

## 7. Lo que no se pudo ejecutar

Lista literal. Ninguno de estos huecos se cerró en cuatro rondas.

- **Nadie corrió `npm run test:e2e`.** El piso de 156 verdes está declarado, no medido en este comité.
  Bloquea declarar F04 terminado (D5).
- **Nadie jugó en un viewport móvil real ni con un gesto táctil.** Todas las mediciones de 390px son
  del emulador de escritorio. Afecta directamente a F14 (piso de zoom 0,62) y a F09.
- **Nadie completó los 14 ejercicios de un nivel** para ver la pantalla de fin de nivel en vivo. C4 y
  F13 están verificados **por código**, no jugados.
- **Nadie usó un lector de pantalla real.** El agente de accesibilidad inspeccionó el DOM; no escuchó la
  voz. Todos los hallazgos A1-A8 son de estructura, no de audición.
- **El delta de +194px de la tipografía no se verificó inyectando la rampa real** en el navegador. Es
  una proyección a partir de los valores propuestos, y es la base de la dependencia D1.
- **Nadie midió el app de syde.cc a 390px ni a 768px**: se desconoce cómo colapsa sus tres rieles, que
  es justo lo que La Forja necesita saber.
- **La medición de 59,7% de precisión de clic se hizo sobre 6 aristas de un ejercicio**, no sobre el
  corpus. El criterio de aceptación de F06 hay que correrlo sobre una muestra mayor.
- **`npm test` con los borrados propuestos (F12, F16) no se corrió.** El experimento de destrucción y
  restauración probó que el **cuerpo markdown** no está cubierto por ningún test; no probó que borrar
  campos de **frontmatter** o piezas del catálogo quede verde.
