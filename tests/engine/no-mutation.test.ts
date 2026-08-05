import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine/index'
import type { Design, DesignEdge, DesignNode, ExerciseSpec } from '../../src/lib/forja/engine/types'

function deepFreeze<T>(value: T): T {
  Object.getOwnPropertyNames(value).forEach((key) => {
    const v = (value as never)[key]
    if (v && typeof v === 'object') deepFreeze(v)
  })
  return Object.freeze(value)
}

describe('forja engine — the engine does not auto-correct (EE11)', () => {
  it('evaluate() never mutates the submitted design, even a frozen one', () => {
    const nodes: DesignNode[] = [
      { id: 'a', type: 'worker', zone: 'private', label: 'a', props: {} },
      { id: 'b', type: 'queue', zone: 'private', label: 'b', props: { delivery: 'at-least-once', dlq: 'no' } },
    ]
    const edges: DesignEdge[] = [{ id: 'a->b', from: { node: 'a' }, to: { node: 'b' } }]
    const design: Design = deepFreeze({ nodes, edges })
    const exercise: ExerciseSpec = {
      guarantees: [
        {
          id: 'g1',
          label: 'hay un worker',
          weight: 1,
          predicate: { op: 'exists', node: { type: ['worker'] } },
          whyMissing: 'Falta un worker.',
          consequence: 'Nada procesa el trabajo.',
        },
      ],
      budget: { opsUnits: 10 },
      lambda: 0.5,
    }

    // A frozen input throws in strict mode on any attempted mutation — this
    // is a stronger guarantee than a before/after deep-equal snapshot.
    expect(() => evaluate(design, exercise)).not.toThrow()

    const before = JSON.stringify(design)
    evaluate(design, exercise)
    expect(JSON.stringify(design)).toBe(before)
  })

  it('the result never carries a modified graph — only findings, score and cost', () => {
    const design: Design = {
      nodes: [{ id: 'a', type: 'worker', zone: 'private', label: 'a', props: {} }],
      edges: [],
    }
    const exercise: ExerciseSpec = { guarantees: [], budget: { opsUnits: 10 }, lambda: 0.5 }
    const result = evaluate(design, exercise)
    expect(result).not.toHaveProperty('design')
    expect(result).not.toHaveProperty('nodes')
    expect(result).not.toHaveProperty('edges')
  })
})
