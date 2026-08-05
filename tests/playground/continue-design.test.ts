// "Volver y seguir": leaving a loaded exercise and coming back must show
// the same design. Rather than inventing a second storage layer, this
// reads the LAST entry the existing `RankingPort.getHistory(exerciseId)`
// already returns — the ranking port's own persistence is the whole
// mechanism, per the orchestrator's explicit "use it, don't reinvent it".
import { describe, expect, it } from 'vitest'
import { continuedDesign } from '../../src/lib/forja/playground/continue-design'
import type { Attempt } from '../../src/lib/forja/ranking/port'

function attempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: 'a1',
    exerciseId: 'ex-1',
    design: { nodes: [], edges: [] },
    score: null,
    ceiling: 100,
    engineVersion: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('continuedDesign', () => {
  it('returns an empty design when there is no history yet', () => {
    expect(continuedDesign([])).toEqual({ nodes: [], edges: [] })
  })

  it('returns the LAST attempt design — the most recent save wins', () => {
    const older = attempt({ id: 'a1', createdAt: '2026-01-01T00:00:00.000Z', design: { nodes: [{ id: 'n1', type: 'service', label: 'Viejo', zone: 'private', props: {} }], edges: [] } })
    const newer = attempt({ id: 'a2', createdAt: '2026-01-02T00:00:00.000Z', design: { nodes: [{ id: 'n2', type: 'service', label: 'Nuevo', zone: 'private', props: {} }], edges: [] } })
    const result = continuedDesign([older, newer])
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].label).toBe('Nuevo')
  })
})
