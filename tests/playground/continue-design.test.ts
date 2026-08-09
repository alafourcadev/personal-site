// "Volver y seguir": leaving a loaded exercise and coming back must show
// the same design. Rather than inventing a second storage layer, this
// reads the LAST entry the existing `RankingPort.getHistory(exerciseId)`
// already returns — the ranking port's own persistence is the whole
// mechanism, per the orchestrator's explicit "use it, don't reinvent it".
import { describe, expect, it } from 'vitest'
import { continuedAttempt, continuedDesign } from '../../src/lib/forja/playground/continue-design'
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
  it('returns an empty design when there is no history and no fallback is given', () => {
    expect(continuedDesign([])).toEqual({ nodes: [], edges: [] })
  })

  // R1-H: the empty-canvas defect. A first-time visit to a real exercise
  // must load ITS starting design, never a blank canvas — the exercise
  // schema's own `startingDesign` is threaded through here as the fallback,
  // never a second storage mechanism.
  it('returns the given fallback design when there is no history yet [R1-H]', () => {
    const startingDesign = { nodes: [{ id: 'given-1', type: 'service' as const, label: 'Servicio de pagos', zone: 'private' as const, props: {}, role: 'payment-service', given: true }], edges: [] }
    expect(continuedDesign([], startingDesign)).toEqual(startingDesign)
  })

  it('returns the LAST attempt design — the most recent save wins, even over a fallback', () => {
    const older = attempt({ id: 'a1', createdAt: '2026-01-01T00:00:00.000Z', design: { nodes: [{ id: 'n1', type: 'service', label: 'Viejo', zone: 'private', props: {} }], edges: [] } })
    const newer = attempt({ id: 'a2', createdAt: '2026-01-02T00:00:00.000Z', design: { nodes: [{ id: 'n2', type: 'service', label: 'Nuevo', zone: 'private', props: {} }], edges: [] } })
    const startingDesign = { nodes: [{ id: 'given-1', type: 'service' as const, label: 'Dado', zone: 'private' as const, props: {} }], edges: [] }
    const result = continuedDesign([older, newer], startingDesign)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].label).toBe('Nuevo')
  })
})

// C3: the restored attempt used to keep the graph and throw the verdict away,
// so a player who came back to an exercise they had scored 100 on was told
// "Todavía no probaste tu diseño" — over their own winning design. The score
// belongs to the graph that earned it; restoring one without the other is
// what made the product forget.
describe('continuedAttempt', () => {
  it('keeps the score of the design it restores', () => {
    const scored = attempt({ id: 'a1', score: 100, ceiling: 100 })
    expect(continuedAttempt([scored])).toMatchObject({ design: scored.design, score: 100, ceiling: 100 })
  })

  it('carries the engine version that produced the score, so a consumer can tell a stale verdict', () => {
    expect(continuedAttempt([attempt({ score: 72, engineVersion: '0.2.0-r1c' })]).engineVersion).toBe('0.2.0-r1c')
  })

  it('reports no score on a first visit — the fallback design was never played', () => {
    const startingDesign = { nodes: [{ id: 'given-1', type: 'service' as const, label: 'Dado', zone: 'private' as const, props: {} }], edges: [] }
    expect(continuedAttempt([], startingDesign)).toEqual({
      design: startingDesign,
      score: null,
      ceiling: null,
      engineVersion: null,
    })
  })

  // The score describes THAT graph, not the player's best day. Restoring the
  // last design with an older attempt's 100 attached would be the same class
  // of lie as the unfiltered ranking strip. Best-score-ever is a separate,
  // separately-labelled read (progression/progress.ts).
  it('reports no score when the LAST attempt was illegal, even if an earlier one scored', () => {
    const winning = attempt({ id: 'a1', score: 100, design: { nodes: [{ id: 'n1', type: 'service', label: 'Bueno', zone: 'private', props: {} }], edges: [] } })
    const broken = attempt({ id: 'a2', score: null, design: { nodes: [{ id: 'n2', type: 'queue', label: 'Roto', zone: 'private', props: {} }], edges: [] } })
    const restored = continuedAttempt([winning, broken])
    expect(restored.design.nodes[0].label).toBe('Roto')
    expect(restored.score).toBeNull()
  })

  it('never disagrees with continuedDesign about which design is restored', () => {
    const history = [attempt({ id: 'a1', score: 10 }), attempt({ id: 'a2', score: 90 })]
    expect(continuedAttempt(history).design).toEqual(continuedDesign(history))
    expect(continuedAttempt([]).design).toEqual(continuedDesign([]))
  })
})
