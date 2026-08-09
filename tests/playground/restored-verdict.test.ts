// Coming back to an exercise you already solved used to greet you with
// "Todavía no probaste tu diseño" — while localStorage held the attempt with
// score 100 and the canvas had already restored its five connections. The
// design came back and the verdict did not.
//
// The verdict is NOT read from storage: only the score is on file, never the
// findings. It is recomputed from the restored graph, which is both possible
// (the exercise spec is right there) and more honest — a verdict rendered
// today is the current engine's, not a stale one from whenever the player
// last pressed the button.
import { describe, expect, it } from 'vitest'
import { shouldRestoreVerdict } from '../../src/lib/forja/playground/continue-design'
import type { Design } from '../../src/lib/forja/engine/types'

const design: Design = {
  nodes: [{ id: 'a', type: 'service', label: 'Servicio', zone: 'private', props: {} }],
  edges: [],
}

describe('shouldRestoreVerdict', () => {
  it('is false with no history — a first visit shows the empty state', () => {
    expect(shouldRestoreVerdict([])).toBe(false)
  })

  it('is true when the last attempt carries a score', () => {
    expect(shouldRestoreVerdict([{ design, score: 100, ceiling: 100 }])).toBe(true)
  })

  it('is true for a zero — zero is a verdict, not the absence of one', () => {
    expect(shouldRestoreVerdict([{ design, score: 0, ceiling: 100 }])).toBe(true)
  })

  it('is false when the last attempt was never scored', () => {
    expect(shouldRestoreVerdict([{ design, score: null }])).toBe(false)
  })

  it('looks only at the last attempt, never at the best one', () => {
    // Restoring the graph of an unscored attempt while showing an older
    // attempt's 100 is exactly the lie the ranking strip used to tell.
    expect(shouldRestoreVerdict([{ design, score: 100, ceiling: 100 }, { design, score: null }])).toBe(
      false,
    )
  })

  it('survives an attempt saved without the score fields at all', () => {
    expect(shouldRestoreVerdict([{ design }])).toBe(false)
  })
})
