// The panel's accounting, as pure functions.
//
// The product's own invariant (CONTEXTO-PARA-AGENTES §4) is
// `puntaje + Σ(puntos que cuesta cada hallazgo) == techo, exacto` — "no
// existe un punto perdido sin un hallazgo que lo explique". It held inside
// the engine and broke on screen: a player read 50/100 over ten findings of
// which the nine cheapest came first and all said "Sin costo", and a
// blocking finding — the one that annuls the whole score — said "Sin costo"
// too. These four functions are what the panel now renders instead, kept
// pure so the arithmetic is provable without mounting React.
import { describe, expect, it } from 'vitest'
import {
  axisCostPoints,
  findingCostLabel,
  findingsLedgerNote,
  hasPointLedger,
  orderedFindings,
  referencesGoFirst,
} from '../../src/lib/forja/playground/result'
import type { CanvasResult } from '../../src/lib/forja/playground/result'
import type { Finding, Severity } from '../../src/lib/forja/engine/types'

function finding(
  id: string,
  costPoints: number | undefined,
  severity: Severity = 'warning',
  rule: Finding['rule'] = 'queue-without-dlq',
): Finding {
  return {
    id,
    rule,
    severity,
    title: id,
    evidence: `evidencia de ${id}`,
    why: `porqué de ${id}`,
    nodeIds: [],
    edgeIds: [],
    costPoints,
  }
}

function scored(score: number | null, findings: Finding[], status: 'scored' | 'illegal' = 'scored'): CanvasResult {
  return {
    kind: 'scored',
    status,
    score,
    ceiling: 100,
    axes: [],
    cost: { opsUnits: 1, monthlyUsd: 0, budget: { opsUnits: 4 }, overage: 0 },
    findings,
  }
}

describe('orderedFindings', () => {
  it('puts the most expensive finding first — the one that explains the missing points', () => {
    // The reported case: level 4, exercise 14. Nine findings worth nothing
    // came first and the single 50-point one was off-screen behind them.
    const cheap = Array.from({ length: 9 }, (_, i) => finding(`cheap-${i}`, 0))
    const expensive = finding('ops-budget-exceeded', 50)
    expect(orderedFindings([...cheap, expensive]).map((f) => f.id)).toEqual([
      'ops-budget-exceeded',
      ...cheap.map((f) => f.id),
    ])
  })

  it('keeps the engine order among findings that cost the same', () => {
    const findings = [finding('a', 33), finding('b', 33), finding('c', 34)]
    expect(orderedFindings(findings).map((f) => f.id)).toEqual(['c', 'a', 'b'])
  })

  it('treats a finding with no cost field at all as costing nothing', () => {
    // Free play and the illegal path never populate `costPoints`.
    expect(orderedFindings([finding('none', undefined), finding('some', 5)]).map((f) => f.id)).toEqual([
      'some',
      'none',
    ])
  })

  it('does not mutate the array it was given', () => {
    const findings = [finding('a', 0), finding('b', 10)]
    orderedFindings(findings)
    expect(findings.map((f) => f.id)).toEqual(['a', 'b'])
  })
})

describe('hasPointLedger', () => {
  it('is true only for a scored exercise — the one case where points were actually allocated', () => {
    expect(hasPointLedger(scored(50, []))).toBe(true)
  })

  it('is false for an illegal design: legality gates scoring, so nothing was ever allocated', () => {
    expect(hasPointLedger(scored(null, [], 'illegal'))).toBe(false)
  })

  it('is false in free play, which has no exercise to score against', () => {
    expect(hasPointLedger({ kind: 'free-play', legal: true, findings: [] })).toBe(false)
  })
})

describe('findingCostLabel', () => {
  it('never says "sin costo" about a blocking finding — it removes the whole score', () => {
    expect(findingCostLabel(finding('x', 0, 'blocking'), false)).toBe('Anula el puntaje entero')
    expect(findingCostLabel(finding('x', 0, 'blocking'), true)).toBe('Anula el puntaje entero')
  })

  it('says nothing at all when there is no ledger to quote', () => {
    // An illegal design was never scored, so "Sin costo" would be an
    // accounting claim about an accounting that never ran.
    expect(findingCostLabel(finding('x', 0, 'warning'), false)).toBeNull()
    expect(findingCostLabel(finding('x', undefined, 'note'), false)).toBeNull()
  })

  it('quotes the points a finding actually cost, singular and plural', () => {
    expect(findingCostLabel(finding('x', 50), true)).toBe('Cuesta 50 puntos')
    expect(findingCostLabel(finding('x', 1), true)).toBe('Cuesta 1 punto')
  })

  it('states plainly that a scored finding cost nothing, without calling it free of consequence', () => {
    expect(findingCostLabel(finding('x', 0), true)).toBe('No descuenta puntos')
  })
})

describe('findingsLedgerNote', () => {
  it('puts the accounting invariant on screen when points were lost', () => {
    const result = scored(50, [finding('a', 50), finding('b', 0)])
    expect(findingsLedgerNote(result)).toBe(
      'Tu puntaje (50) más lo que cuestan estos hallazgos (50) suma el techo de 100: no hay puntos perdidos sin un hallazgo que los explique.',
    )
  })

  it('explains a zero as annulment, not as an empty ledger, when the design is illegal', () => {
    const result = scored(null, [finding('a', 0, 'blocking')], 'illegal')
    expect(findingsLedgerNote(result)).toBe(
      'Un hallazgo bloqueante anula el puntaje entero. No hay puntos repartidos: primero el diseño tiene que ser legal.',
    )
  })

  it('says nothing at the ceiling — there is no loss to account for', () => {
    expect(findingsLedgerNote(scored(100, [finding('a', 0)]))).toBeNull()
  })

  it('says nothing rather than assert an accounting that does not add up', () => {
    // Defensive: the sentence is computed from the findings on screen, so it
    // can never claim a total the player cannot verify by reading the list.
    expect(findingsLedgerNote(scored(50, [finding('a', 10)]))).toBeNull()
  })

  it('says nothing in free play, which has no score', () => {
    expect(findingsLedgerNote({ kind: 'free-play', legal: false, findings: [] })).toBeNull()
  })
})

describe('axisCostPoints', () => {
  const findings = [
    finding('other', 0),
    finding('missing-observability', 17, 'warning', 'guarantee-missing:g-obs'),
  ]

  it('finds what a failed objective cost, so the cost sits next to the objective', () => {
    expect(axisCostPoints('g-obs', findings)).toBe(17)
  })

  it('is null for an objective with no finding against it — a satisfied one', () => {
    expect(axisCostPoints('g-other', findings)).toBeNull()
  })
})

describe('referencesGoFirst', () => {
  it('is true at the ceiling: every objective is met and no finding costs anything', () => {
    // What the panel still has to teach at 100 is which of the two decisions
    // the player took and when the other one wins — the brief's own question,
    // and the one thing the score cannot answer.
    expect(referencesGoFirst(scored(100, []))).toBe(true)
  })

  it('is false below the ceiling — the findings are the actionable part and stay first', () => {
    expect(referencesGoFirst(scored(99, []))).toBe(false)
  })

  it('is false for an illegal design and for free play', () => {
    expect(referencesGoFirst(scored(null, [], 'illegal'))).toBe(false)
    expect(referencesGoFirst({ kind: 'free-play', legal: true, findings: [] })).toBe(false)
  })
})
