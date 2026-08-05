// R1-G requirement 4: "los ejes que muestre el panel salen de las garantías
// declaradas por ese ejercicio" — `toScoredResult` is the pure projection
// from the engine's own `Evaluation` (ids + satisfied + weight only, no
// label) plus the exercise's own `Guarantee[]` (which DOES carry the
// player-facing label) into the shape `ResultPanel` renders. Pure so the
// label-matching logic is provable without mounting React or the canvas.
import { describe, expect, it } from 'vitest'
import { toScoredResult } from '../../src/lib/forja/playground/result'
import type { Evaluation, Guarantee } from '../../src/lib/forja/engine/types'

const guarantees: Guarantee[] = [
  {
    id: 'g-a',
    label: 'la confirmación no depende del email',
    weight: 2,
    predicate: { op: 'exists', node: { type: ['service'] } },
    whyMissing: 'falta un componente durable',
    consequence: 'se pierde el aviso',
  },
  {
    id: 'g-b',
    label: 'el servicio está observado',
    weight: 1,
    predicate: { op: 'exists', node: { type: ['observability'] } },
    whyMissing: 'no hay monitoreo',
    consequence: 'nadie se entera',
  },
]

const evaluation: Evaluation = {
  status: 'scored',
  score: 67,
  ceiling: 100,
  guarantees: [
    { id: 'g-a', satisfied: true, weight: 2 },
    { id: 'g-b', satisfied: false, weight: 1 },
  ],
  cost: { opsUnits: 6, monthlyUsd: 0, budget: { opsUnits: 8 }, overage: 0 },
  findings: [],
  engineVersion: '0.2.0-r1c',
}

describe('toScoredResult', () => {
  it('carries the score, ceiling and cost straight from the evaluation', () => {
    const result = toScoredResult(evaluation, guarantees)
    if (result.kind !== 'scored') throw new Error('expected a scored result')
    expect(result.status).toBe('scored')
    expect(result.score).toBe(67)
    expect(result.ceiling).toBe(100)
    expect(result.cost).toEqual(evaluation.cost)
  })

  it('resolves each axis label from the exercise guarantees, by id — never the raw guarantee id', () => {
    const result = toScoredResult(evaluation, guarantees)
    if (result.kind !== 'scored') throw new Error('expected a scored result')
    expect(result.axes).toEqual([
      { id: 'g-a', label: 'la confirmación no depende del email', satisfied: true, weight: 2 },
      { id: 'g-b', label: 'el servicio está observado', satisfied: false, weight: 1 },
    ])
  })

  it('falls back to the bare id only if a guarantee truly has no matching label (defensive, should not happen)', () => {
    const result = toScoredResult(evaluation, [])
    if (result.kind !== 'scored') throw new Error('expected a scored result')
    expect(result.axes[0].label).toBe('g-a')
  })
})
