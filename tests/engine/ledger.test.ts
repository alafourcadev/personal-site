import { describe, expect, it } from 'vitest'
import { computeLedger } from '../../src/lib/forja/engine/score'
import type { Design, DesignEdge, DesignNode, ExerciseSpec, Finding, Guarantee } from '../../src/lib/forja/engine/types'

const node = (id: string, type: DesignNode['type'], props: Record<string, string> = {}): DesignNode => ({
  id,
  type,
  zone: 'private',
  label: id,
  props,
})
const edge = (from: string, to: string): DesignEdge => ({ id: `${from}->${to}`, from: { node: from }, to: { node: to } })
const design = (nodes: DesignNode[], edges: DesignEdge[] = []): Design => ({ nodes, edges })

const guarantee = (id: string, weight: number, satisfiedType: DesignNode['type']): Guarantee => ({
  id,
  label: id,
  weight,
  predicate: { op: 'exists', node: { type: [satisfiedType] } },
  whyMissing: `Falta ${id}.`,
  consequence: `Sin ${id} el diseño no cumple.`,
})

// costPoints attached by the ledger to every finding it produced.
function totalCostPoints(findings: Finding[]): number {
  return findings.reduce((sum, f) => sum + (f.costPoints ?? 0), 0)
}

describe('forja engine — the ledger (D3): feedback accounting is exact', () => {
  it('three equal-weight guarantees, one satisfied: score + Σ findings.costPoints === 100 after largest-remainder rounding', () => {
    const exercise: ExerciseSpec = {
      guarantees: [guarantee('g1', 1, 'worker'), guarantee('g2', 1, 'queue'), guarantee('g3', 1, 'cache')],
      budget: { opsUnits: 10 },
      lambda: 0.5,
    }
    const d = design([node('w', 'worker')]) // only g1 satisfied -> raw = 1/3
    const result = computeLedger(d, exercise, [])

    expect(Number.isInteger(result.score)).toBe(true)
    for (const f of result.findings) expect(Number.isInteger(f.costPoints)).toBe(true)
    expect(result.score + totalCostPoints(result.findings)).toBe(100)
  })

  it('five differently weighted guarantees, three unsatisfied: the sum still closes exactly', () => {
    const exercise: ExerciseSpec = {
      guarantees: [
        guarantee('g1', 3, 'worker'),
        guarantee('g2', 5, 'queue'),
        guarantee('g3', 2, 'cache'),
        guarantee('g4', 7, 'stream'),
        guarantee('g5', 1, 'observability'),
      ],
      budget: { opsUnits: 10 },
      lambda: 0.5,
    }
    const d = design([node('w', 'worker'), node('c', 'cache')]) // g1, g3 satisfied
    const result = computeLedger(d, exercise, [])
    expect(result.score + totalCostPoints(result.findings)).toBe(100)
  })

  it('a design over its ops budget adds a third loss source, and the sum still closes exactly', () => {
    const exercise: ExerciseSpec = {
      guarantees: [guarantee('g1', 1, 'worker'), guarantee('g2', 1, 'queue')],
      budget: { opsUnits: 2 },
      lambda: 0.7,
    }
    // worker + 3 extra services = 4 opsUnits against a budget of 2 -> overage
    const d = design([node('w', 'worker'), node('s1', 'service'), node('s2', 'service'), node('s3', 'service')])
    const result = computeLedger(d, exercise, [])
    expect(result.cost.overage).toBeGreaterThan(0)
    expect(result.findings.some((f) => f.rule === 'ops-budget-exceeded')).toBe(true)
    expect(result.score + totalCostPoints(result.findings)).toBe(100)
  })

  it('non-scored warning findings carried from the rules layer still render with costPoints: 0', () => {
    const exercise: ExerciseSpec = { guarantees: [guarantee('g1', 1, 'worker')], budget: { opsUnits: 10 }, lambda: 0.5 }
    const preExisting: Finding[] = [
      {
        id: 'sync-chain-depth:0',
        rule: 'sync-chain-depth',
        severity: 'warning',
        title: '',
        evidence: '',
        why: '',
        nodeIds: [],
        edgeIds: [],
      },
    ]
    const result = computeLedger(design([node('w', 'worker')]), exercise, preExisting)
    const carried = result.findings.find((f) => f.rule === 'sync-chain-depth')
    expect(carried?.costPoints).toBe(0)
  })
})
