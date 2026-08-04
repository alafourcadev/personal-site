import { describe, expect, it } from 'vitest'
import { evaluateLegality } from '../../src/lib/forja/engine/index'
import type { Design } from '../../src/lib/forja/engine/types'

describe('forja engine — empty-canvas guard (EE9)', () => {
  it('scores an empty design 0, not skipped and not silently legal-with-no-score', () => {
    const empty: Design = { nodes: [], edges: [] }
    const result = evaluateLegality(empty)
    expect(result.legal).toBe(true)
    expect(result.score).toBe(0)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0].rule).toBe('empty-canvas')
    expect(result.findings[0].why).toMatch(/no.*sistema/i)
  })

  it('does not apply the empty-canvas guard to a non-empty design', () => {
    const notEmpty: Design = {
      nodes: [{ id: 'a', type: 'actor', zone: 'public', label: 'a', props: {} }],
      edges: [],
    }
    const result = evaluateLegality(notEmpty)
    expect(result.findings.some((f) => f.rule === 'empty-canvas')).toBe(false)
  })
})
