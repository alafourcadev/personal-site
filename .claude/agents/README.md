# Panel de revisión de La Forja

Siete agentes: seis especialistas que miran el producto desde un ángulo
distinto, y uno que sintetiza.

Todos leen primero `docs/forja/CONTEXTO-PARA-AGENTES.md`, que es la única fuente
del contexto. Si una decisión del producto cambia, se cambia ahí y no en siete
archivos que se desincronizan.

## Los siete

| Agente | Mira | Modelo |
|---|---|---|
| `forja-product-reviewer` | onboarding, retención, abandono, propuesta de valor | opus |
| `forja-learning-architect` | si de verdad se aprende: dificultad, carga, transferencia | opus |
| `forja-creative-director` | spacing, tipografía, contraste, jerarquía, motion | opus |
| `forja-architecture-expert` | los ejercicios: ¿son problemas reales de arquitectura? | opus |
| `forja-friction-auditor` | clics de más, pasos evitables, pérdida de contexto | sonnet |
| `forja-game-designer` | motivación, progreso, dominio, flow, permanencia | sonnet |
| `forja-general-auditor` | mata lo malo, agrupa duplicados, produce el backlog | opus |

Los seis primeros operan la aplicación en un navegador real. El séptimo no: lee
informes.

## Cómo se usa

**Antes de nada, levantá el build de producción.** Los agentes lo esperan
corriendo:

```bash
npm run build && npx astro preview --port 4322
```

Nunca `npm run dev` para auditar: sirvió contenido viejo dos veces en este
proyecto y produjo dos diagnósticos falsos.

**Después, uno de estos dos caminos.**

Revisión puntual — un ángulo, una pregunta:

```
Usá forja-friction-auditor sobre el ejercicio del nivel 4 "el pago que espera al email".
```

Panel completo — los seis en paralelo y después la síntesis:

```
Lanzá los seis especialistas de La Forja en paralelo sobre el nivel 4.
Cuando terminen, pasale los seis informes a forja-general-auditor.
```

El orden importa: el auditor general **no sirve de nada si corre antes** que los
demás. Su trabajo es filtrar lo que produjeron.

## Qué esperar de vuelta

Cada especialista entrega hallazgos cortos, el más grave primero, con evidencia
verificable: selector, línea, valor medido, gesto ejecutado. Un hallazgo sin eso
se descarta.

El auditor general entrega **un solo backlog** ordenado por impacto sobre costo,
más tres secciones que valen tanto como el backlog:

- **Descartados** — qué mató y por qué. Tenés que poder discutirle los descartes.
- **Contradicciones resueltas** — cuando dos especialistas discrepan, no promedia:
  verifica y dice quién tenía razón.
- **Propuestas de cambio de contrato** — lo que contradice un requisito ya
  aprobado, separado del backlog, porque eso lo decidís vos.

## Fronteras

Los siete son **auditores, no implementadores**. No escriben código sin tu
autorización explícita; sus escrituras se limitan a sus informes.

Ninguno toca `src/lib/forja/engine/`: el motor está cerrado y gobernado por
invariantes con test.

El resto de las fronteras está en `docs/forja/CONTEXTO-PARA-AGENTES.md` §9.

## Cuándo NO usar el panel

Cuando todavía no jugaste vos. Los números de dificultad y presupuesto de los
ocho ejercicios se escribieron a criterio y nadie los probó — ningún agente
puede calibrarlos mejor que vos jugándolos una tarde.
