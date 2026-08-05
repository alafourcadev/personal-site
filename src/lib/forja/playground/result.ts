// R1-G: `ResultPanel`'s input, one level above the raw engine `Evaluation`.
// Two shapes, never mixed: free play (`/forja`, no exercise loaded —
// legality/findings only, see free-play.ts and its own R1-F fix) and a
// loaded exercise (`/forja/[level]/[exercise]` — a real score against real
// guarantees). Keeping this as its own union, rather than widening
// `FreePlayResult`, is what lets `ResultPanel` render "nothing to score
// against yet" for one and a real axis-by-axis breakdown for the other
// without a nullable half-populated object in between.
import type { Evaluation, Finding, Guarantee } from '../engine/types'

export interface ScoredAxis {
  id: string
  label: string
  satisfied: boolean
  weight: number
}

export interface ScoredCost {
  opsUnits: number
  monthlyUsd: number
  budget: { opsUnits: number; monthlyUsd?: number }
  overage: number
}

export type CanvasResult =
  | { kind: 'free-play'; legal: boolean; findings: Finding[] }
  | {
      kind: 'scored'
      status: 'illegal' | 'scored'
      score: number | null
      ceiling: number
      axes: ScoredAxis[]
      cost: ScoredCost
      findings: Finding[]
    }

// R1-G requirement 4: "los ejes que muestre el panel salen de las garantías
// declaradas por ese ejercicio" — the engine's own `Evaluation.guarantees`
// carries only {id, satisfied, weight} (design's Interfaces contract, kept
// exercise-agnostic on purpose); this is the one place a label is resolved
// back onto that id, from the exercise's own `Guarantee[]`, never invented.
export function toScoredResult(evaluation: Evaluation, guarantees: Guarantee[]): CanvasResult {
  const labelById = new Map(guarantees.map((g) => [g.id, g.label]))
  return {
    kind: 'scored',
    status: evaluation.status,
    score: evaluation.score,
    ceiling: evaluation.ceiling,
    axes: evaluation.guarantees.map((g) => ({
      id: g.id,
      label: labelById.get(g.id) ?? g.id,
      satisfied: g.satisfied,
      weight: g.weight,
    })),
    cost: evaluation.cost,
    findings: evaluation.findings,
  }
}
