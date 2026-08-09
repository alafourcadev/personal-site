// Pressing "Probar respuesta" was the loudest gesture in the product and
// the only one that said nothing: `handleSubmit` never called `setStatus`,
// so the one always-mounted live region on the page stayed on whatever the
// previous gesture had left there. Meanwhile the canvas went to
// `display: none` under a focus that stayed on the button.
//
// The verdict panel itself cannot carry the announcement on its own: it is
// mounted at the same instant as its content, and a live region inserted
// together with its text is not reliably read. The status bar is already
// there, so it is what speaks.
import { describe, expect, it } from 'vitest'
import { submitMessage } from '../../src/lib/forja/playground/result'
import type { CanvasResult } from '../../src/lib/forja/playground/result'

const cost = { opsUnits: 3, monthlyUsd: 0, budget: { opsUnits: 5 }, overage: 0 }

const scored: CanvasResult = {
  kind: 'scored',
  status: 'scored',
  score: 83,
  ceiling: 100,
  axes: [],
  cost,
  findings: [],
}

describe('submitMessage', () => {
  it('reads the score out loud, with its ceiling', () => {
    expect(submitMessage(scored)).toContain('83')
    expect(submitMessage(scored)).toContain('100')
  })

  // The illegal verdict is the whole answer for this branch, and
  // reading a number that does not exist would be worse than silence.
  it('says an illegal design has no score instead of inventing one', () => {
    const illegal: CanvasResult = { ...scored, status: 'illegal', score: null }

    expect(submitMessage(illegal)).toContain('ilegal')
    expect(submitMessage(illegal)).not.toMatch(/\d/)
  })

  it('says free play was checked and has nothing to score against', () => {
    const freePlay: CanvasResult = { kind: 'free-play', legal: true, findings: [] }

    expect(submitMessage(freePlay)).toContain('puntaje')
    expect(submitMessage(freePlay).length).toBeGreaterThan(0)
  })

  it('still calls an illegal free-play design illegal', () => {
    const freePlay: CanvasResult = { kind: 'free-play', legal: false, findings: [] }

    expect(submitMessage(freePlay)).toContain('ilegal')
  })
})
