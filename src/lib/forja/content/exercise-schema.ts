// The forja-exercise-content Zod schema (EC1-EC7 + design D9's admission
// gates). Split from content.config.ts on purpose: this module never
// imports `astro:content`, so it stays Vitest-testable directly (no Astro
// content pipeline needed to prove a gate rejects a bad exercise) while
// content.config.ts wires it into the actual collection.
//
// Design D9: two gate classes.
//   BUILD-FAILING (this file's superRefine — imports and RUNS the engine):
//   per-axis ceiling, band membership, D9>=1, prerequisite gate, rubric
//   signal linkage, and — the C.14 coupling point — every reference
//   solution must be legal and within budget via the real engine, not a
//   hand-rolled re-implementation of legality.
//   TEST-FAILING (cross-entry, tests/content/*.test.ts): tradeoff pair
//   symmetry/context inversion, role quotas per level, the "two reference
//   solutions both score exactly 100" publication test (EE10/§13.10) — all
//   of these need the WHOLE collection loaded at once, which a single
//   entry's superRefine never sees.
import { z } from 'astro:content'
// `z` re-exported from `astro:content` is a runtime binding only (its own
// .d.ts imports zod's types locally to annotate itself, but never re-emits
// them as an importable namespace) — importing the type names directly from
// `zod/v4` is what lets `z.ZodType<...>`/`z.ZodNumber` style annotations
// resolve here.
import type { ZodNumber, ZodType } from 'zod/v4'
import type { output as ZodOutput } from 'zod/v4/core'
import { evaluate } from '../engine'
import { CATALOG } from '../engine/catalog'
import type { ComponentType, Design, ExerciseSpec, Predicate, RuleId } from '../engine/types'
import { AXES, axisCeiling, difficultyIndex, type DifficultyAxes } from '../progression/difficulty'
import { EXERCISE_ROLES, EXERCISE_STATUSES } from '../progression/types'

const componentTypes = Object.keys(CATALOG) as [ComponentType, ...ComponentType[]]
const componentTypeSchema = z.enum(componentTypes)
const zoneSchema = z.enum(['public', 'dmz', 'private', 'restricted'])
const dataClassSchema = z.enum(['public', 'personal', 'regulated', 'secret'])

// The 13 §13.7 rule ids (per C1's binding resolution — port-mismatch
// included), mirrored from engine/types.ts's RuleId literally: `ruleSilent`
// predicates may only reference one of these, never `empty-canvas` (that
// guard is not an exercise-tunable rule).
const ruleIds: [RuleId, ...RuleId[]] = [
  'trust-zone-jump',
  'port-mismatch',
  'volatile-durable-mismatch',
  'regulated-without-backup',
  'pii-to-external-model',
  'queue-without-dlq',
  'orphan-queue',
  'sync-chain-depth',
  'intermittent-client-without-idempotency',
  'no-observability-on-critical',
  'single-point-of-failure',
  'ops-budget-exceeded',
  'undeclared-data-class',
]

const nodeQuerySchema = z.object({
  type: z.array(componentTypeSchema).optional(),
  propEquals: z.record(z.string(), z.string()).optional(),
  role: z.string().optional(),
})

// Recursive predicate DSL (design D2) — z.lazy() so `all`/`any`/`not` can
// nest. Typed against the engine's own `Predicate` union so a drift between
// this schema and engine/types.ts is a TypeScript error, not a silent gap.
const predicateSchema: ZodType<Predicate> = z.lazy(() =>
  z.discriminatedUnion('op', [
    z.object({ op: z.literal('exists'), node: nodeQuerySchema }),
    z.object({ op: z.literal('path'), from: nodeQuerySchema, to: nodeQuerySchema, via: nodeQuerySchema.optional(), forbid: nodeQuerySchema.optional() }),
    z.object({ op: z.literal('noVolatileCut'), from: nodeQuerySchema, to: nodeQuerySchema }),
    z.object({ op: z.literal('covered'), target: nodeQuerySchema, by: nodeQuerySchema }),
    z.object({ op: z.literal('edgeAbsent'), from: nodeQuerySchema, to: nodeQuerySchema }),
    z.object({ op: z.literal('ruleSilent'), rule: z.enum(ruleIds) }),
    z.object({ op: z.literal('all'), of: z.array(predicateSchema) }),
    z.object({ op: z.literal('any'), of: z.array(predicateSchema) }),
    z.object({ op: z.literal('not'), of: z.array(predicateSchema) }),
  ]),
)

const guaranteeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().positive(),
  predicate: predicateSchema,
  whyMissing: z.string().min(1),
  consequence: z.string().min(1),
})

const designNodeSchema = z.object({
  id: z.string().min(1),
  type: componentTypeSchema,
  label: z.string().min(1),
  zone: zoneSchema,
  props: z.record(z.string(), z.string()).default({}),
  role: z.string().optional(),
  given: z.boolean().optional(),
})

const designEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.object({ node: z.string().min(1), port: z.string().optional() }),
  to: z.object({ node: z.string().min(1), port: z.string().optional() }),
  protocol: z.string().optional(),
  sync: z.boolean().optional(),
  dataClass: dataClassSchema.optional(),
})

const designSchema = z.object({
  nodes: z.array(designNodeSchema).min(1),
  edges: z.array(designEdgeSchema).default([]),
})

// EC7: a rubric dimension needs an observable signal computable from the
// graph — either it reuses one of the exercise's own guarantee predicates
// (linked by id, checked below), or it names an executable metric
// (`{metric,operator,value,unit}`, never prose).
const rubricSignalSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('predicate'), guaranteeId: z.string().min(1) }),
  z.object({
    kind: z.literal('metric'),
    metric: z.string().min(1),
    operator: z.enum(['>=', '<=', '=', '<', '>']),
    value: z.number(),
    unit: z.string().min(1),
  }),
])

const rubricDimensionSchema = z.object({
  dimension: z.string().min(1),
  signal: rubricSignalSchema,
})

const referenceSolutionSchema = z.object({
  label: z.string().min(1),
  // EC5: the contextual conditions that make THIS solution the better
  // choice — required non-empty on every solution, not just tradeoff-pair
  // ones, per design D9's own build-failing gate list.
  contextInversion: z.string().min(1),
  design: designSchema,
})

const budgetSchema = z.object({
  opsUnits: z.number().int().positive(),
  monthlyUsd: z.number().nonnegative().optional(),
})

const hiddenFactSchema = z.object({
  fact: z.string().min(1),
  // EC "cada hecho oculto con camino de descubrimiento" — a reasonable
  // player must be able to reach this, or it punishes instead of teaching.
  discoveryPath: z.string().min(1),
})

const constraintSchema = z.object({
  metric: z.string().min(1),
  operator: z.enum(['>=', '<=', '=', '<', '>']),
  value: z.number(),
  unit: z.string().min(1),
})

const axisFields = Object.fromEntries(AXES.map((axis) => [axis, z.number().int().min(0).max(4)])) as Record<
  (typeof AXES)[number],
  ZodNumber
>

export const exerciseSchema = z
  .object({
    title: z.string().min(1),
    level: z.number().int().min(1).max(12),
    role: z.enum(EXERCISE_ROLES as [(typeof EXERCISE_ROLES)[number], ...(typeof EXERCISE_ROLES)[number][]]),
    domain: z.string().min(1),
    // Required only for role: 'tradeoff' (checked below) — the id shared by
    // both halves of a contrasted pair, so the cross-entry Vitest gate can
    // find them and confirm the context really inverts the winner.
    tradeoffPairId: z.string().optional(),
    ...axisFields,
    prerequisiteLevels: z.array(z.number().int().min(1).max(12)).default([]),
    hiddenFacts: z.array(hiddenFactSchema).default([]),
    budget: budgetSchema,
    // EC "Marca: ... accesible y con aiBudget declarado" — a short, explicit
    // policy the player reads before starting (e.g. "libre" or "sin
    // asistencia de IA"), never left implicit.
    aiBudget: z.string().min(1),
    lambda: z.number().positive(),
    constraints: z.array(constraintSchema).default([]),
    guarantees: z.array(guaranteeSchema).min(1),
    rubric: z.array(rubricDimensionSchema).min(1),
    // EC5 (schema-level floor): the build-failing legality/budget pass
    // below runs regardless of count.
    referenceSolutions: z.array(referenceSolutionSchema).min(2),
    status: z.enum(EXERCISE_STATUSES as [(typeof EXERCISE_STATUSES)[number], ...(typeof EXERCISE_STATUSES)[number][]]),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'tradeoff' && !data.tradeoffPairId) {
      ctx.addIssue({ code: 'custom', path: ['tradeoffPairId'], message: 'un ejercicio de rol tradeoff necesita tradeoffPairId' })
    }

    // EC3: per-axis ceiling.
    for (const axis of AXES) {
      const value = data[axis]
      const ceiling = axisCeiling(axis, data.level)
      if (value > ceiling) {
        ctx.addIssue({
          code: 'custom',
          path: [axis],
          message: `${axis}=${value} excede el techo ${ceiling} del nivel ${data.level}`,
        })
      }
    }

    // "D9=0 es inadmisible": sin ambigüedad, dos soluciones distintas no
    // pueden coexistir como igualmente válidas — el motor tendría una
    // respuesta correcta escondida.
    if (data.D9 < 1) {
      ctx.addIssue({ code: 'custom', path: ['D9'], message: 'D9 debe ser >= 1 — ver §13.10, dos soluciones exigen ambigüedad real' })
    }

    // EC2: índice dentro de banda.
    const axesOnly = Object.fromEntries(AXES.map((axis) => [axis, data[axis]])) as DifficultyAxes
    const index = difficultyIndex(axesOnly)
    const [lo, hi] = (() => {
      const band = [2 + 2 * (data.level - 1), 10 + 2 * (data.level - 1)] as const
      return band
    })()
    if (index < lo || index > hi) {
      ctx.addIssue({
        code: 'custom',
        path: ['level'],
        message: `índice ${index} fuera de banda [${lo}, ${hi}] para el nivel ${data.level}`,
      })
    }

    // EC4: prerrequisito de nivel > nivel propio.
    for (const [i, prereq] of data.prerequisiteLevels.entries()) {
      if (prereq > data.level) {
        ctx.addIssue({
          code: 'custom',
          path: ['prerequisiteLevels', i],
          message: `prerrequisito de nivel ${prereq} es mayor que el nivel propio (${data.level})`,
        })
      }
    }

    // EC7: la señal de una dimensión de rúbrica que reutiliza un guarantee
    // debe apuntar a uno que exista de verdad.
    const guaranteeIds = new Set(data.guarantees.map((g) => g.id))
    for (const [i, dimension] of data.rubric.entries()) {
      if (dimension.signal.kind === 'predicate' && !guaranteeIds.has(dimension.signal.guaranteeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rubric', i],
          message: `la dimensión "${dimension.dimension}" referencia un guarantee inexistente: ${dimension.signal.guaranteeId}`,
        })
      }
    }

    // D9's build-failing engine gate (C.14's coupling point): every
    // reference solution must be legal AND within the declared budget,
    // proven by RUNNING the real engine — never a re-implementation.
    const exerciseSpec: ExerciseSpec = { guarantees: data.guarantees, budget: data.budget, lambda: data.lambda }
    for (const [i, solution] of data.referenceSolutions.entries()) {
      const result = evaluate(solution.design as Design, exerciseSpec)
      if (result.status === 'illegal') {
        const blockers = result.findings.filter((f) => f.severity === 'blocking').map((f) => f.title).join('; ')
        ctx.addIssue({
          code: 'custom',
          path: ['referenceSolutions', i],
          message: `la solución "${solution.label}" es ilegal: ${blockers}`,
        })
      } else if (result.cost.overage > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['referenceSolutions', i],
          message: `la solución "${solution.label}" excede el presupuesto declarado (${result.cost.opsUnits} > ${data.budget.opsUnits} opsUnits)`,
        })
      }
    }
  })

export type ExerciseFrontmatter = ZodOutput<typeof exerciseSchema>
