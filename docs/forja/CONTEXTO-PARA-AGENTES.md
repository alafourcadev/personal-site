# La Forja — contexto obligatorio para agentes de revisión

> Todo agente que audite, critique o proponga cambios sobre La Forja lee este
> archivo **antes** de escribir un solo hallazgo. Está verificado contra el
> código, no es aspiracional.

---

## 1. Qué es

Un **juego de aprendizaje de arquitectura de software** dentro de
`alafourca.dev`, el sitio de la marca editorial **Ingeniería sin filtros**, de
Alejandro Lafourcade.

El jugador avanza por **niveles**; cada nivel es un tema de arquitectura con
muchos ejercicios; la progresión va de arquitecto junior a principal. Todo
desemboca en el **playground**: un lienzo donde se arrastran componentes
tipados de negocio, aplicación e infraestructura, se conectan, y se recibe un
puntaje con la explicación de qué está mal y por qué.

## 2. La idea que hay que entender antes que ninguna otra

**Las decisiones de arquitectura no son determinísticas.**

Cada arquitecto resuelve el mismo problema distinto y puede tener razón. La
Forja **no es un examen con una respuesta escondida**: el puntaje mide qué tan
cerca estás de la solución más óptima.

> Un ejercicio donde exista una sola solución sin errores bloqueantes está mal
> diseñado. Tiene que haber al menos dos diseños **estructuralmente distintos**
> que lleguen a 100.

Eso es un test que corre en cada build:
`two structurally different legal designs both reach exactly 100`.

## 3. El canvas es un modelo evaluable, no una herramienta de dibujo

- Cada componente es un registro tipado con propiedades que tienen
  consecuencias (`backup`, `replicas`, `idempotent`, `delivery`, `hosting`…).
- Tres **bandas**: negocio, aplicación, infraestructura.
- Cuatro **zonas de confianza**: `public`, `dmz`, `private`, `restricted`. Una
  conexión no puede saltar más de una zona.
- Una conexión es un **contrato**: protocolo, sincronía y clase de dato
  (`public`, `personal`, `regulated`, `secret`).
- Los puertos tienen compatibilidad. Un cliente móvil no tiene puerto SQL.

**Corolario para cualquier propuesta de diseño:** el lienzo tiene semántica de
dominio. No es un diagramador libre y no se puede tratar como tal.

## 4. Cómo se evalúa — tres capas

1. **Legalidad.** Zonas, puertos y 13 reglas. Binaria y previa: **gatea** el
   puntaje. Un diseño ilegal no saca puntaje bajo, no saca puntaje.
2. **Garantías.** Cada ejercicio declara 3–5 obligaciones con peso, cada una un
   **predicado sobre el grafo**, nunca sobre una forma. Anclan en `role` sobre
   nodos que el ejercicio provee.
3. **Costo como presupuesto con acantilado**, no impuesto lineal. Se mide en
   dinero y en `opsUnits` — la carga operativa real.

Cualquier diseño que satisfaga todas las garantías dentro del presupuesto saca
**100**, tenga la forma que tenga.

**Dos invariantes con test:**

```
monotonía:     agregar una garantía dentro del presupuesto NUNCA baja el puntaje
contabilidad:  puntaje + Σ(puntos que cuesta cada hallazgo) == techo, exacto
```

El segundo significa que **no existe un punto perdido sin un hallazgo que lo
explique**.

**Lo que el motor NO hace:** no premia una topología, **no autocorrige** (el
remedio nunca se revela en el primer nivel), no penaliza la simplicidad, y no
valida estética.

## 5. La regla editorial que gobierna todo el copy

> **Ninguna afirmación sin su porqué.**

Cada advertencia responde tres cosas: qué regla se violó, qué evidencia del
diagrama la dispara, y qué consecuencia tiene en producción.

El tono ya está calibrado y **no se reescribe**. Ejemplos que están en el
código:

> *"No vas a saber que se rompió hasta que te lo diga un usuario. El tiempo de
> detección pasa a ser el tiempo que tarda alguien en enojarse."*

> *"Los mensajes se acumulan hasta llenar la retención y después se descartan.
> El sistema parece funcionar: nadie ve el error hasta que falta el dato."*

Prohibido: hype, gurú tech, promesas mágicas, corporativismo, gamificación
infantilizante, tecnicismo sin explicación.

**Lenguaje:** prosa llana; términos canónicos de arquitectura intactos (una cola
es "cola de mensajes", no una metáfora); cero vocabulario interno del motor
(ids de regla, nombres de predicado, claves de eje) en lo que lee el jugador.

## 6. Dónde está todo

```
Repositorio   /Users/ale/Documents/code/personal/backendsin-site
Rama          feat/la-forja
Build         npm run build && npx astro preview --port 4322
Jugar         http://localhost:4322/forja/4

src/pages/forja/        rutas: /forja, /forja/niveles, /forja/[level], /forja/[level]/[exercise]
src/components/forja/   interfaz: lienzo, nodos, menú contextual, panel, ranking
src/lib/forja/engine/   el motor — TypeScript PURO, cero DOM. CERRADO.
src/lib/forja/canvas/   traducción del modelo a pantalla
src/lib/forja/content/  esquema Zod que valida ejercicios al compilar
src/lib/forja/playground/ carga de ejercicio, continuar donde ibas
src/lib/forja/progression/ los 12 niveles y el desbloqueo
src/lib/forja/ranking/  guardado local (Supabase pendiente)
src/content/forja/exercises/  los 8 ejercicios, en Markdown
tests/                  engine, canvas, content, e2e

openspec/changes/la-forja-integracion/   propuesta, diseño y especificaciones
```

**React se descarga únicamente en `/forja`.** El resto del sitio no envía un
byte de framework. Toda propuesta que rompa ese aislamiento declara el costo.

## 7. Fuentes de verdad — y una trampa conocida

**Identidad visual:** los tokens de `src/layouts/BaseLayout.astro`, que es el
sitio vivo. Existe un documento de especificación con otra paleta
(`La-Forja-Especificaciones/02-UX-UI-Y-DIRECCION-DE-DISENO.md`, Forge Green
`#176B5B`) que **nunca se implementó y quedó superada**. Proponer volver a ella
es un hallazgo inválido: ya lo reportó un revisor y era falso.

**Requisitos formales:** `openspec/changes/la-forja-integracion/specs/`. Un
hallazgo que contradice un requisito aprobado no es un hallazgo: es una
propuesta de cambio de contrato, y se marca así.

**Defectos ya conocidos:**
`/Users/ale/Documents/ingenieria-sin-filtros-brand/La-Forja-Especificaciones/14-REVISION-DE-EQUIPOS-2026-08-04.md`
No los vuelvas a reportar como nuevos: verificá si siguen vivos y decilo.

## 8. Cómo se verifica acá — regla dura

**Operá la aplicación antes de opinar.** Un auditor que sólo lee código no
audita experiencia: opina sobre código.

**Contra el build de producción, nunca contra `npm run dev`.** El servidor de
desarrollo sirvió contenido viejo dos veces en este proyecto y produjo dos
diagnósticos falsos, uno de ellos mío.

```
npm run build && npx astro preview --port 4322
```

**Los gestos se prueban con entrada física, jamás con eventos sintéticos.**

```
dispatchEvent(new MouseEvent('click'))   →  NO prueba nada
page.mouse.click(x, y)                   →  prueba
```

Un `click` despachado se salta el `pointerdown`. Si un manejador de
`pointerdown` redibuja el lienzo y destruye ese elemento, el navegador nunca le
entrega el `click` — pero el evento sintético sí. Eso hizo que dos revisores de
este producto se contradijeran sobre si borrar una conexión funcionaba.

Para conectores SVG, calculá el punto medio real de la curva
(`getPointAtLength` + `getScreenCTM`). El rectángulo envolvente no sirve.

**Disciplina de evidencia.** Toda afirmación falsable cita selector, línea y
valor medido. Si calculás contraste, van los dos hex y el ratio. Un hallazgo sin
evidencia se descarta entero: ya hubo un revisor que inventó un fallo de
contraste comparando contra el tema equivocado.

Si algo no lo pudiste ejecutar, escribí literalmente **"no lo pude ejecutar"**.

## 9. Fronteras que ningún agente cruza

```
NO tocar src/lib/forja/engine/     el motor está cerrado, gobernado por invariantes
NO mover legalidad a la interfaz   checkConnection() del motor gobierna el gesto
NO tocar rutas del sitio fuera de /forja
NO tocar src/content/blog/checkpoint-clean-code.md   (borrador ajeno sin trackear)
NO git add -A ni git add .         paths explícitos, verificados
NO push, NO deploy
Conventional commits, sin atribución a IA
Código, identificadores y comentarios en inglés; copy de producto en español
```

**Auditar primero, implementar sólo con autorización explícita del dueño.**

## 10. Estado actual

**Terminado y verificado:** el motor completo; `/forja` con el lienzo en React
Flow (crear, mover, conectar, borrar conexión, borrar nodo, deshacer — por
puntero y por teclado); menú contextual con seis colores; bandas con contención;
encuadre real; vista de lista equivalente; panel de resultado que cierra; ranking
local siempre visible y etiquetado como local; ancho completo; descripciones por
componente; los 8 ejercicios del nivel 4 con compuerta de admisión que rompe el
build; y el camino humano hasta 100 probado sólo con puntero.

**Pendiente:** accesibilidad completa (§13.9), contraste del tema claro, los
otros 11 niveles, Supabase con cuentas y ranking global, rango y XP del jugador,
y un editor de propiedades de nodo (hoy el jugador no puede cambiar propiedades
de un componente existente).

**Sin calibrar:** los números de dificultad y de presupuesto de los 8 ejercicios
se escribieron a criterio. Nadie los jugó todavía. Ningún test los puede validar.

## 11. Restricción económica

**Todo tiene que ser gratis.** Cualquier propuesta con costo mensual lo declara
explícitamente y no se da por aprobada. El backend elegido es Supabase plan
Free; el sitio se queda estático y el navegador le habla directo. Nada de
funciones en Vercel: su plan Hobby es de uso no comercial y el sitio tiene
página de servicios.
