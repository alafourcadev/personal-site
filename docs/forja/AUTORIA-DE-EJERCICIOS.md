# La Forja — cómo se escribe un ejercicio

> Complemento de `CONTEXTO-PARA-AGENTES.md`, que explica **qué es** el producto.
> Este archivo explica **cómo se produce contenido** para él. Todo lo que dice
> está verificado contra el motor, el esquema y los tests. Si algo acá
> contradice al código, gana el código y este archivo está desactualizado.

---

## 0. Lo único que hay que entender antes de escribir una línea

Un ejercicio **no es un texto**. Es un programa declarativo que el motor
ejecuta. Tiene un test que rompe el build:

> **Cada solución de referencia tiene que puntuar exactamente 100.**

No 99. No "casi". Exactamente 100, corriendo el motor de verdad. Un ejercicio
que no llega a eso no entra al repositorio.

Y hay una segunda regla que es la razón de ser del producto:

> **Tiene que haber al menos dos soluciones estructuralmente distintas que
> lleguen a 100.**

Si tu ejercicio tiene una sola forma correcta, está mal diseñado: convertiste
un problema de arquitectura en una adivinanza con respuesta escondida.

---

## 1. Dónde va el archivo

```
src/content/forja/exercises/n{nivel}-{slug}.md
```

Ejemplo: `n5-el-despliegue-que-nadie-mira.md`

El prefijo de nivel evita que dos autores trabajando en paralelo colisionen.

**El rol no va en el nombre del archivo.** El archivo es el id de la colección y
la URL: si el slug dice `trap`, el enlace de la lista, la barra de estado del
navegador y la barra de direcciones anuncian cuál es la trampa antes de que el
jugador lea una línea, y una trampa anunciada ya no enseña nada. Tampoco vale
sacarlo sólo de las trampas: si son las únicas sin rol, la ausencia es la pista.
Por eso no lo lleva ninguno. Lo verifica `tests/content/slug-no-role-spoiler.test.ts`.

El `slug` es en español, en minúsculas, con guiones, sin acentos.

---

## 2. Cómo se calcula el puntaje

```
puntaje = 100 · raw · pen

raw = Σ(peso de garantías cumplidas) / Σ(peso de todas las garantías)
pen = 1 cuando el diseño no se pasa del presupuesto
```

De ahí salen tres consecuencias que gobiernan toda la autoría:

**a) Un hallazgo bloqueante mata el puntaje entero.** No baja la nota: la
elimina. `status: 'illegal'`, `score: null`. Una solución de referencia con un
solo bloqueante no compila el ejercicio.

**b) Las advertencias cuestan CERO puntos.** Una solución de referencia puede
tener `cola sin destino para mensajes fallidos` o `punto único de falla` y
seguir puntuando 100. Esto sorprende a todo el mundo la primera vez. Si querés
que algo reste, tiene que ser una **garantía**, no una advertencia.

**c) Para llegar a 100 hacen falta exactamente tres cosas**, y nada más:

```
1. cero hallazgos bloqueantes
2. todas las garantías cumplidas
3. opsUnits del diseño <= budget.opsUnits declarado
```

---

## 3. El catálogo de componentes — cerrado

Inventar un tipo es un error de compilación. Estos son todos, con su capa, su
zona por defecto y su costo operativo:

| tipo | capa | zona | opsUnits |
|---|---|---|---|
| `actor` | business | public | 0 |
| `business-process` | business | public | 0 |
| `approver` | business | public | 0 |
| `external-party` | business | public | 0 |
| `service` | application | private | 1 |
| `api-gateway` | application | dmz | 1 |
| `mobile-client` | application | public | 0 |
| `web-client` | application | public | 0 |
| `worker` | application | private | 1 |
| `ai-model` | application | private | 1 |
| `external-provider` | application | dmz | 0 |
| `database` | infrastructure | restricted | 1 |
| `cache` | infrastructure | private | 1 |
| `queue` | infrastructure | private | 1 |
| `stream` | infrastructure | private | 1 |
| `object-storage` | infrastructure | private | 0 |
| `cdn` | infrastructure | dmz | 0 |
| `identity-provider` | infrastructure | dmz | 1 |
| `vector-store` | infrastructure | private | 1 |
| `observability` | infrastructure | private | 1 |
| `generic` | application | private | 1 |

**El presupuesto se cuenta sumando esta columna.** Un diseño con 5 servicios,
una cola y observabilidad son 7 unidades operativas. Si el ejercicio declara
`budget.opsUnits: 6`, esa solución no llega a 100 nunca.

### Propiedades que el motor mira de verdad

El resto son decorativas. Estas disparan reglas:

```
service.criticality = 'high'     + replicas = '1'   → advertencia (punto único)
service.idempotent  = 'no'                          → advertencia si lo alcanza un cliente intermitente
database.backup     = 'none'                        → BLOQUEANTE si le entra dato regulado
queue.delivery = 'at-least-once' + dlq = 'no'       → advertencia
ai-model.hosting    = 'external'                    → BLOQUEANTE si le entra dato personal
*.connectivity      = 'intermittent'                → origen del análisis de reintentos
```

---

## 4. Zonas y puertos — de acá salen los bloqueantes

**Zonas, en orden:** `public` → `dmz` → `private` → `restricted`

Una conexión **no puede saltar más de una zona**. `public → private` es
bloqueante. `public → restricted` también. Por eso una persona nunca se conecta
directo a una base de datos: entra por un cliente, que pasa por la puerta de
entrada, que llega al servicio, que consulta la base.

**Puertos.** Cada tipo declara qué puede entrarle. Esta tabla es la fuente de
todos los "conexión imposible por contrato":

```
mobile-client      ← actor
web-client         ← actor
api-gateway        ← mobile-client, web-client, external-party
service            ← api-gateway, service, worker, queue, stream, approver, business-process
worker             ← queue, stream, service
ai-model           ← service, worker
database           ← service, worker
cache              ← service, worker
queue              ← service, worker
stream             ← service, worker
object-storage     ← service, worker
cdn                ← object-storage, service
identity-provider  ← api-gateway, service
vector-store       ← service, worker
observability      ← service, worker, database, queue, stream, api-gateway
approver           ← service
external-party     ← service
external-provider  ← service, worker
generic            ← cualquier cosa
```

**Nada puede entrar a un `actor` ni a un `business-process`.** Son orígenes,
nunca destinos.

---

## 5. Las 13 reglas — cuál mata y cuál sólo avisa

**BLOQUEANTES** (eliminan el puntaje — jamás pueden aparecer en una solución de
referencia):

```
trust-zone-jump              salto de más de una zona
port-mismatch                el destino no acepta ese origen
volatile-durable-mismatch    dato personal o regulado entrando a un cache
pii-to-external-model        dato personal entrando a un ai-model con hosting externo
regulated-without-backup     database con backup 'none' recibiendo dato regulado
orphan-queue                 una queue o un stream sin ningún consumidor
```

**ADVERTENCIAS** (cuestan 0 puntos, pero le hablan al jugador):

```
queue-without-dlq
single-point-of-failure
intermittent-client-without-idempotency
no-observability-on-critical
sync-chain-depth                    3 o más servicios encadenados
ops-budget-exceeded
```

**NOTA:**

```
undeclared-data-class        toda conexión sin dataClass la dispara
```

Clases de dato: `public`, `personal`, `regulated`, `secret`.

---

## 6. Los 9 predicados — el vocabulario completo de una garantía

Una garantía es un predicado sobre el **grafo**, nunca sobre una forma. No
existe otro operador que estos:

```yaml
# ¿existe algún nodo que matchee?
op: exists
node: { type: [observability] }          # type, role y propEquals, todos opcionales

# ¿hay un camino dirigido de A a B?
op: path
from: { role: payment-service }
to:   { type: [database] }
via:  { type: [queue] }                  # opcional: obliga a pasar por acá
forbid: { type: [cache] }                # opcional: prohíbe pasar por acá

# ¿hay camino, y con al menos una pieza durable en el medio?
op: noVolatileCut
from: { role: payment-service }
to:   { role: email-sent }

# ¿todos los nodos que matchean `target` tocan alguno que matchee `by`?
op: covered
target: { type: [service], role: payment-service }
by:     { type: [observability] }        # la conexión vale en cualquier dirección

# ¿NO existe ninguna conexión directa de A a B?
op: edgeAbsent
from: { type: [web-client] }
to:   { type: [database] }

# ¿esta regla del motor quedó callada?
op: ruleSilent
rule: single-point-of-failure

# combinadores
op: all   / any        of: [ ...predicados... ]
op: not                of: [ ...predicados... ]   # niega que TODOS se cumplan
```

**`covered` con un `target` vacío da verdadero por vacuidad.** Si nada matchea,
la garantía se cumple sola. Es la forma más común de escribir una garantía que
no verifica nada sin darse cuenta.

> **La trampa que más ejercicios rompe, y ninguna compuerta la detecta.**
> Si tu garantía dice "todo servicio de pagos está observado" con `covered`, el
> jugador la cumple **borrando el servicio de pagos**. Sin nodos que matcheen el
> `target`, la garantía da verdadero y el ejercicio se gana destruyendo justo lo
> que enseñaba a cuidar.
>
> El cierre: que **otra** garantía obligue a que la pieza exista — un `exists`,
> o un `path` que tenga que atravesarla. Revisá cada `covered` y `edgeAbsent`
> que escribas preguntándote: *¿se cumple si borro la pieza?* Si la respuesta es
> sí, te falta una garantía.

**El diseño inicial no puede puntuar 100.** Si el sistema que trae el ejercicio
ya cumple todas las garantías, el jugador abre, aprieta "probar respuesta" y
saca 100 sin decidir nada. La puerta del nivel lo verifica desde ahora, pero
pensalo al escribir: el diseño inicial es el problema, no la solución.

### La trampa que rompe el build más seguido

> Todo `role` que uses en una garantía tiene que existir en un nodo del
> `startingDesign`.

El jugador **no tiene ningún gesto para asignar un `role`**. Si tu garantía
ancla en `role: payment-service` y ningún nodo inicial lo lleva, esa garantía
queda en cero para siempre y el ejercicio es injugable. El esquema lo rechaza
nombrando la garantía y el role que falta.

---

## 7. Dificultad — los nueve ejes

```
D1 información oculta      D4 horizonte y reversibilidad   D7 fallo parcial
D2 restricciones en conflicto  D5 superficie de diseño     D8 oposición
D3 garantías en juego      D6 presión de presupuesto       D9 ambigüedad
```

Cada eje va de 0 a 4. Tres compuertas:

**Banda del nivel.** La suma de los nueve tiene que caer dentro de
`[2+2(N-1), 10+2(N-1)]`:

| nivel | banda | | nivel | banda |
|---|---|---|---|---|
| 1 | 2–10 | | 7 | 14–22 |
| 2 | 4–12 | | 8 | 16–24 |
| 3 | 6–14 | | 9 | 18–26 |
| 4 | 8–16 | | 10 | 20–28 |
| 5 | 10–18 | | 11 | 22–30 |
| 6 | 12–20 | | 12 | 24–32 |

**Techo por eje.** Un eje sólo llega a 3 o a 4 a partir de cierto nivel:

| eje | vale 3 desde | vale 4 desde |
|---|---|---|
| D1 | 5 | 8 |
| D2 | 5 | 9 |
| D3 | 3 | 8 |
| D4 | 6 | 11 |
| D5 | 5 | 8 |
| D6 | 5 | 7 |
| D7 | 4 | 6 |
| D8 | 9 | 11 |
| D9 | 6 | 10 |

Debajo de esos niveles, el techo es 2.

**`D9 >= 1` siempre.** Sin ambigüedad no pueden coexistir dos soluciones
igualmente válidas: el motor tendría una respuesta escondida.

Las bandas se solapan a propósito. Lo que separa un nivel de otro es **el
prerrequisito conceptual, no la carga**.

---

## 8. Qué tiene que shippear un nivel

Hay **dos tramos válidos, y nada en el medio**. Un nivel con 5 núcleos no está
"a mitad de camino": está roto, y la compuerta lo dice.

```
BETA (8)                              COMPLETO (14)
1 calibration                         1 calibration
4 core                                6 core
2 tradeoff  (1 par contrastado)       4 tradeoff  (2 pares contrastados)
—                                     1 trap + 1 counter-trap
1 synthesis                           1 synthesis
```

Los porqués, que no son arbitrarios:

- **6 núcleos, por transferencia.** Un concepto practicado en un solo dominio
  produce recuerdo atado al contexto: se aprende *"en pagos, la idempotencia se
  hace así"*, no *"idempotencia"*. Son 3 conceptos × 2 dominios.
- **4 tradeoff, por discriminación.** Enseñar *cuándo* A le gana a B no se puede
  con un ejercicio: con uno se aprende "A". Cada tradeoff cuesta **dos**
  ejercicios, no uno.
- **2 de trampa, por anti-metajuego.** Y acá está la parte que más se malentiende.

### La trampa y la contra-trampa van siempre juntas

Una **trampa** es un ejercicio donde la respuesta obvia —la que el jugador
aprendió a dar en los ejercicios anteriores— es la equivocada, y el ejercicio le
muestra por qué.

Una **contra-trampa** es un ejercicio donde la respuesta obvia **sí es la
correcta**.

Sin la segunda, la primera enseña el metajuego equivocado: *"si parece obvio,
elegí la otra"*. Un jugador que aprende eso deja de razonar sobre el problema y
empieza a razonar sobre el examen. Por eso la compuerta exige exactamente una de
cada una — nunca una trampa suelta.

Las dos tienen que ser sobre **la misma decisión**, o no contrastan nada.

**Las variantes no cuentan.** Un ejercicio con los mismos hechos ocultos que
otro ya no enseña descubrimiento: el jugador ya sabe qué preguntar.

**El par de tradeoff tiene un test propio y es el que más cuesta acertar:**

> Las soluciones ganadoras de A tienen que FALLAR bajo las garantías de B, y
> las de B fallar bajo las de A.

Es decir: el mismo problema, dos contextos, y el contexto **da vuelta el
ganador de verdad**. Si las dos mitades premian el mismo diseño, no son un par
contrastado: es el mismo ejercicio contado dos veces, y el test lo caza.

La forma práctica de lograrlo: que cada mitad declare una garantía que la otra
no pueda cumplir. Por ejemplo, A exige `noVolatileCut` (obliga a algo durable
en el medio) y B exige `edgeAbsent` sobre esa misma pieza más una lectura
sincrónica (obliga a lo contrario).

---

## 9. Anatomía del archivo

El frontmatter completo, con lo obligatorio marcado:

```yaml
title:              # obligatorio
level:              # obligatorio, 1..12
role:               # obligatorio: calibration | core | tradeoff | synthesis
domain:             # obligatorio, el dominio de negocio en una palabra
tradeoffPairId:     # obligatorio SÓLO si role es tradeoff
D1..D9:             # obligatorios, 0..4
prerequisiteLevels: # niveles previos, ninguno mayor al propio
budget:
  opsUnits:         # obligatorio, entero positivo
  monthlyUsd:       # opcional
aiBudget:           # obligatorio, texto: la política de uso de IA que lee el jugador
lambda:             # obligatorio, positivo — la dureza del acantilado de presupuesto
constraints:        # métricas visibles: metric, operator, value, unit
hiddenFacts:        # cada uno con `fact` y `discoveryPath`
startingDesign:     # obligatorio: el sistema que el brief describe, ya en el lienzo
  nodes: [...]      # id, type, label, zone, y opcionalmente role, props, given, position
  edges: [...]      # id, from.node, to.node, y opcionalmente dataClass, protocol, sync
guarantees:         # obligatorio, al menos 1 — en la práctica 3 a 5
  - id:
    label:          # lo que lee el jugador
    weight:         # positivo
    predicate:      # uno de los 9 operadores
    whyMissing:     # qué le falta al diseño, concreto
    consequence:    # qué pasa en producción si no está
rubric:             # obligatorio, al menos 1 — cada dimensión apunta a un guaranteeId real
referenceSolutions: # obligatorio, AL MENOS 2, estructuralmente distintas
  - label:
    contextInversion:  # en qué contexto ESTA solución es la mejor y la otra no
    design: { nodes, edges }
status:             # DRAFT | REVIEW | PILOT | PUBLISHED
```

Debajo del frontmatter va el brief narrativo en Markdown: la situación, los
números del negocio, qué pide el dueño de producto y qué hay que rearmar.

**`hiddenFacts` no es decoración.** Cada uno declara un `discoveryPath`: cómo
puede el jugador enterarse jugando. Un hecho oculto sin camino de descubrimiento
es información arbitraria, y eso es lo contrario de enseñar.

**`contextInversion` es la pieza pedagógica del ejercicio.** Ahí es donde el
jugador entiende que las dos soluciones no son "una buena y una aceptable",
sino dos decisiones correctas en contextos distintos.

---

## 10. Cómo se valida — el único comando que importa

```bash
FORJA_LEVEL=5 npm run forja:level
```

Corre, sobre **tu nivel solamente**, todas las compuertas: el esquema, la banda
de dificultad, los techos por eje, el piso de composición, las soluciones de
referencia puntuando 100, y la inversión del par de tradeoff. No lee los
archivos de otros niveles, así que otro autor trabajando en paralelo nunca te
va a ensuciar el resultado.

Cuando una solución no llega a 100, el reporte dice **por qué**: qué garantías
quedaron sin cumplir, qué hallazgos restan puntos y cuánto se pasó del
presupuesto.

Antes de dar el nivel por terminado, la suite completa:

```bash
npm test
```

---

## 11. Tono — no negociable

La regla editorial del proyecto entero:

> **Ninguna afirmación sin su porqué.**

Cada `whyMissing`, cada `consequence`, cada línea del brief responde qué pasa y
por qué importa **en producción**. El registro está calibrado y no se
reescribe:

> *"No vas a saber que se rompió hasta que te lo diga un usuario. El tiempo de
> detección pasa a ser el tiempo que tarda alguien en enojarse."*

> *"Los mensajes se acumulan hasta llenar la retención y después se descartan.
> El sistema parece funcionar: nadie ve el error hasta que falta el dato."*

Prohibido: hype, gurú tech, promesas mágicas, corporativismo, gamificación
infantilizante, tecnicismo sin explicación.

Los briefs son **historias de negocio con números**, no enunciados de examen.
Una tienda, una reserva, un despliegue, un reclamo. Nunca "el sistema X tiene
un componente Y".

**Cero vocabulario del motor en lo que lee el jugador**: ni ids de regla, ni
nombres de predicado, ni claves de eje. Una cola es "una cola de mensajes", no
`queue`.

---

## 12. Fronteras

```
NO tocar src/lib/forja/engine/     el motor está cerrado
NO tocar ejercicios de otro nivel
NO tocar rutas ni componentes
NO git add -A                      paths explícitos
NO commit, NO push, NO deploy      el dueño decide cuándo
```

Si para expresar tu ejercicio te hace falta un predicado que no existe, **no
extiendas el motor**: reportalo y elegí otro ángulo para el ejercicio. El motor
tiene invariantes probadas y un cambio ahí invalida los ocho ejercicios que ya
funcionan.
