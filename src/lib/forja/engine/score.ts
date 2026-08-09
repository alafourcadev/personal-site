// La Forja evaluation engine: the ledger (design D3, doc §14.3 layers b+c).
// score = 100 · raw · pen. No node-count term anywhere in this file, and that
// single omission is what makes the monotonicity invariant hold by
// construction rather than by tuning (EE6).
import { computeCost, penalty } from './cost'
import { evaluatePredicate } from './predicates'
import type { CostBreakdown } from './cost'
import type { Design, ExerciseSpec, Finding, RuleId } from './types'

export const CEILING = 100

interface GuaranteeStatus {
  id: string
  satisfied: boolean
  weight: number
}

// Σ wᵢ·satᵢ / Σ wᵢ ∈ [0,1]. An exercise with zero total weight has nothing to
// satisfy, so it is vacuously fully satisfied (raw 1), consistent with the
// predicate DSL's own empty-set semantics (`covered`/`all` over an empty
// set are vacuously true). Real content always declares 3–5 guarantees
// (spec's floor), so this only guards a malformed exercise from ever
// producing an unexplained 100-point loss with no finding to attach it to.
function computeRaw(design: Design, exercise: ExerciseSpec, findings: Finding[]) {
  const totalWeight = exercise.guarantees.reduce((s, g) => s + g.weight, 0)
  const statuses: GuaranteeStatus[] = exercise.guarantees.map((g) => ({
    id: g.id,
    satisfied: evaluatePredicate(design, g.predicate, findings),
    weight: g.weight,
  }))
  if (totalWeight === 0) return { raw: 1, statuses }
  const satWeight = statuses.reduce((s, g) => s + (g.satisfied ? g.weight : 0), 0)
  return { raw: satWeight / totalWeight, statuses }
}

interface Bucket {
  key: string
  real: number
}

// Largest-remainder allocation (Hamilton's method): floor every bucket, then
// hand the leftover whole points to the buckets with the biggest fractional
// part, tie-broken by original order for determinism. Buckets sum to `total`
// in real arithmetic, so their integers sum to `total` exactly. The
// feedback-accounting invariant is a construction property, not a rounding
// hope.
function allocate(buckets: Bucket[], total: number): Map<string, number> {
  const floors = buckets.map((b) => Math.floor(b.real))
  const allocated = floors.reduce((a, b) => a + b, 0)
  const remaining = total - allocated
  const order = buckets
    .map((b, i) => ({ i, frac: b.real - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  const result = new Map(buckets.map((b, i) => [b.key, floors[i]]))
  // `remaining` is at most `buckets.length − 1` whenever Σ real === total
  // (each fractional part is < 1). The modulo is defence in depth only:
  // it keeps this function total even if a future caller's buckets don't
  // sum to `total` exactly, rather than indexing past the end of `order`.
  for (let k = 0; k < remaining && order.length > 0; k++) {
    const key = buckets[order[k % order.length].i].key
    result.set(key, (result.get(key) ?? 0) + 1)
  }
  return result
}

export interface LedgerResult {
  score: number
  guarantees: GuaranteeStatus[]
  cost: CostBreakdown
  findings: Finding[]
}

function guaranteeMissingFinding(exercise: ExerciseSpec, status: GuaranteeStatus, costPoints: number): Finding {
  const guarantee = exercise.guarantees.find((g) => g.id === status.id)
  return {
    id: `guarantee-missing:${status.id}:0`,
    rule: `guarantee-missing:${status.id}`,
    severity: 'warning',
    title: guarantee?.label ?? status.id,
    evidence: `peso ${status.weight}`,
    why: guarantee?.whyMissing ?? '',
    // §13.1's third part: rule, evidence, consequence. It is required and
    // non-empty on every `Guarantee`, and until now nothing read it: the
    // player was told what was missing and never what it costs.
    consequence: guarantee?.consequence || undefined,
    nodeIds: [],
    edgeIds: [],
    costPoints,
  }
}

function opsBudgetFinding(cost: CostBreakdown, costPoints: number): Finding {
  return {
    id: 'ops-budget-exceeded:ledger',
    rule: 'ops-budget-exceeded' as RuleId,
    severity: 'warning',
    title: 'El equipo no puede operar este diseño',
    evidence: `${cost.opsUnits} unidades operativas · presupuesto: ${cost.budget.opsUnits} · sobrepaso: ${cost.overage}`,
    why: 'El diseño es correcto y el equipo no lo puede sostener. Un sistema que nadie puede operar es un sistema que se degrada solo.',
    nodeIds: [],
    edgeIds: [],
    costPoints,
  }
}

// score = 100 · raw · pen. The exact loss decomposition:
//   guarantee loss  = 100 · (1 − raw)             (independent of pen)
//   budget loss     = 100 · raw · (1 − pen)
// sums to 100 · (1 − raw·pen) = 100 − score exactly, by the algebraic
// identity (1−raw) + raw(1−pen) = 1 − raw·pen. Per-guarantee, the first row
// splits additively over each unsatisfied guarantee's weight share.
//
// This corrects the source note's literal per-guarantee term
// `100·(wᵢ/Σw)·pen`, which does not sum exactly with its own budget-loss row
// once both raw<1 and pen<1 hold at the same time, verified by direct
// algebra and not by rounding tolerance. See apply-progress deviations.
export function computeLedger(design: Design, exercise: ExerciseSpec, priorFindings: Finding[]): LedgerResult {
  const { raw, statuses } = computeRaw(design, exercise, priorFindings)
  const cost = computeCost(design, exercise.budget)
  const pen = penalty(cost.overage, exercise.lambda)
  const scoreReal = CEILING * raw * pen
  const totalWeight = exercise.guarantees.reduce((s, g) => s + g.weight, 0)

  const buckets: Bucket[] = [{ key: 'score', real: scoreReal }]
  const unsatisfied = statuses.filter((g) => !g.satisfied)
  // Each unsatisfied guarantee's share of the aggregate 100·(1−raw) loss is
  // its own declared weight over the exercise's total weight, the same
  // Σw that defines `raw` itself, so the shares sum back to 100·(1−raw)
  // exactly (1−raw = Σ_unsatisfied wᵢ / Σw by construction).
  unsatisfied.forEach((g) =>
    buckets.push({ key: `guarantee-missing:${g.id}`, real: totalWeight > 0 ? CEILING * (g.weight / totalWeight) : 0 }),
  )
  if (cost.overage > 0) buckets.push({ key: 'ops-budget-exceeded', real: CEILING * raw * (1 - pen) })

  const allocated = allocate(buckets, CEILING)

  const carried: Finding[] = priorFindings
    .filter((f) => f.rule !== 'ops-budget-exceeded')
    .map((f) => ({ ...f, costPoints: f.costPoints ?? 0 }))

  const guaranteeFindings = unsatisfied.map((g) =>
    guaranteeMissingFinding(exercise, g, allocated.get(`guarantee-missing:${g.id}`) ?? 0),
  )
  const budgetFinding = cost.overage > 0 ? [opsBudgetFinding(cost, allocated.get('ops-budget-exceeded') ?? 0)] : []

  return {
    score: allocated.get('score') ?? 0,
    guarantees: statuses,
    cost,
    findings: [...carried, ...guaranteeFindings, ...budgetFinding],
  }
}

