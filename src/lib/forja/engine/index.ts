// La Forja evaluation engine — pure TypeScript, no DOM, no React, no Astro
// imports. R1-C wires the full public surface per the design's Interfaces
// contract: evaluate() (legality -> guarantees -> cost -> ledger) and
// checkConnection() (the same legality module the scorer gates on, reused
// live for the connection gesture).
import { computeCost } from './cost'
import { isPortCompatible, isTrustZoneJump } from './legality'
import { evaluateRules, WHY } from './rules'
import { computeLedger } from './score'
import type { ConnectionVerdict, Design, Evaluation, ExerciseSpec, Finding } from './types'

export const ENGINE_VERSION = '0.2.0-r1c'

export interface LegalityResult {
  legal: boolean
  score: number | null
  findings: Finding[]
}

// EE9: an empty design MUST score 0 with an explicit message, never be
// treated as "nothing wrong" (which the 13 rules alone would report, since
// none of them fire on an empty graph).
export function evaluateLegality(design: Design, opsCapacity = 4): LegalityResult {
  if (design.nodes.length === 0 && design.edges.length === 0) {
    return {
      legal: true,
      score: 0,
      findings: [
        {
          id: 'empty-canvas:0',
          rule: 'empty-canvas',
          severity: 'note',
          title: 'No hay ningún sistema para evaluar',
          evidence: '0 componentes · 0 conexiones',
          why: 'No enviaste ningún sistema. Sin componentes ni conexiones no hay nada que el motor pueda calificar.',
          nodeIds: [],
          edgeIds: [],
        },
      ],
    }
  }

  const findings = evaluateRules(design, opsCapacity)
  const legal = findings.every((f) => f.severity !== 'blocking')
  return { legal, score: null, findings }
}

function guaranteeStubs(exercise: ExerciseSpec): { id: string; satisfied: boolean; weight: number }[] {
  return exercise.guarantees.map((g) => ({ id: g.id, satisfied: false, weight: g.weight }))
}

// EE9, layer (a) of the pipeline: an empty design is scored before any
// guarantee or cost axis runs — 100 points of loss, one finding, done.
function emptyEvaluation(exercise: ExerciseSpec, findings: Finding[]): Evaluation {
  return {
    status: 'scored',
    score: 0,
    ceiling: 100,
    guarantees: guaranteeStubs(exercise),
    cost: { opsUnits: 0, monthlyUsd: 0, budget: exercise.budget, overage: 0 },
    findings: findings.map((f) => ({ ...f, costPoints: f.rule === 'empty-canvas' ? 100 : 0 })),
    engineVersion: ENGINE_VERSION,
  }
}

// Legality gates scoring (EE2): an illegal design produces no score at all,
// never a low one. Cost is still reported as information — it never gates
// anything here, only the score field does.
function illegalEvaluation(design: Design, exercise: ExerciseSpec, findings: Finding[]): Evaluation {
  return {
    status: 'illegal',
    score: null,
    ceiling: 100,
    guarantees: guaranteeStubs(exercise),
    cost: computeCost(design, exercise.budget),
    findings: findings.map((f) => ({ ...f, costPoints: f.costPoints ?? 0 })),
    engineVersion: ENGINE_VERSION,
  }
}

export function evaluate(design: Design, exercise: ExerciseSpec): Evaluation {
  if (design.nodes.length === 0 && design.edges.length === 0) {
    return emptyEvaluation(exercise, evaluateLegality(design).findings)
  }

  const legality = evaluateLegality(design, exercise.budget.opsUnits)
  if (!legality.legal) return illegalEvaluation(design, exercise, legality.findings)

  const ledger = computeLedger(design, exercise, legality.findings)
  return {
    status: 'scored',
    score: ledger.score,
    ceiling: 100,
    guarantees: ledger.guarantees,
    cost: ledger.cost,
    findings: ledger.findings,
    engineVersion: ENGINE_VERSION,
  }
}

// The connection gesture reuses the exact same legality checks the scorer
// gates on — one implementation of "is this legal", checked live before the
// edge is ever created.
export function checkConnection(
  design: Design,
  from: { node: string },
  to: { node: string },
): ConnectionVerdict {
  const a = design.nodes.find((n) => n.id === from.node)
  const b = design.nodes.find((n) => n.id === to.node)
  if (!a || !b) return { ok: false, why: 'Uno de los dos extremos no existe en el diseño.' }

  if (isTrustZoneJump(a.zone, b.zone)) {
    return { ok: false, why: WHY.trustZoneJump, consequence: `${a.label} (${a.zone}) → ${b.label} (${b.zone})` }
  }

  if (!isPortCompatible(a.type, b.type)) {
    const humanSource = a.type === 'actor' || a.type === 'approver'
    return {
      ok: false,
      why: humanSource ? WHY.portMismatchHuman(b.type) : WHY.portMismatchStructural(a.type, b.type),
      consequence: `${a.type} → ${b.type}`,
    }
  }

  return { ok: true }
}
