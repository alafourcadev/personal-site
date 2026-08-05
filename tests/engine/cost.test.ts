import { describe, expect, it } from 'vitest'
import { computeCost, penalty } from '../../src/lib/forja/engine/cost'
import type { Design, DesignNode } from '../../src/lib/forja/engine/types'

const node = (id: string, type: DesignNode['type']): DesignNode => ({
  id,
  type,
  zone: 'private',
  label: id,
  props: {},
})

const design = (nodes: DesignNode[]): Design => ({ nodes, edges: [] })

describe('forja engine — cost as a budget with a cliff (D3)', () => {
  it('at or under budget: overage is zero and penalty is exactly 1 (free)', () => {
    // 3 service nodes = 3 opsUnits (catalog.ts: service.opsUnits === 1)
    const d = design([node('a', 'service'), node('b', 'service'), node('c', 'service')])
    const cost = computeCost(d, { opsUnits: 3 })
    expect(cost.opsUnits).toBe(3)
    expect(cost.overage).toBe(0)
    expect(penalty(cost.overage, 0.5)).toBe(1)
  })

  it('past the cliff: penalty decreases monotonically as overage grows, never as a linear tax below budget', () => {
    const under = computeCost(design([node('a', 'service'), node('b', 'service')]), { opsUnits: 4 })
    const atCliff = computeCost(
      design([node('a', 'service'), node('b', 'service'), node('c', 'service'), node('d', 'service')]),
      { opsUnits: 4 },
    )
    const overCliff = computeCost(
      design([
        node('a', 'service'),
        node('b', 'service'),
        node('c', 'service'),
        node('d', 'service'),
        node('e', 'service'),
      ]),
      { opsUnits: 4 },
    )

    expect(penalty(under.overage, 0.5)).toBe(1)
    expect(penalty(atCliff.overage, 0.5)).toBe(1)
    const penOver = penalty(overCliff.overage, 0.5)
    expect(penOver).toBeLessThan(1)

    const evenMoreOver = computeCost(
      design([
        node('a', 'service'),
        node('b', 'service'),
        node('c', 'service'),
        node('d', 'service'),
        node('e', 'service'),
        node('f', 'service'),
      ]),
      { opsUnits: 4 },
    )
    expect(penalty(evenMoreOver.overage, 0.5)).toBeLessThan(penOver)
  })

  it('tracks monthlyUsd alongside opsUnits, never substituting one for the other', () => {
    const cost = computeCost(design([node('db', 'database')]), { opsUnits: 10 })
    expect(cost.monthlyUsd).toBeGreaterThan(0)
    expect(cost.opsUnits).toBe(1)
  })
})
