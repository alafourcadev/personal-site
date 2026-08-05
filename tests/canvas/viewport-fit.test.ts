// R1-I ("the canvas frames its own content") — pure geometry unit tests for
// the visibility check ForjaCanvas.tsx uses to decide whether a just-created
// node needs the camera refit, using real getBoundingClientRect()-shaped
// rectangles from the same coordinate space.
import { describe, expect, it } from 'vitest'
import { isFullyVisible, type ScreenRect } from '../../src/lib/forja/canvas/viewport-fit'

const pane: ScreenRect = { left: 0, top: 0, right: 900, bottom: 560 }

describe('isFullyVisible', () => {
  it('is true when the inner rect sits entirely inside the outer rect', () => {
    const node: ScreenRect = { left: 20, top: 20, right: 200, bottom: 90 }
    expect(isFullyVisible(node, pane)).toBe(true)
  })

  it('is false when the inner rect extends below the outer rect (the exact defect the owner measured)', () => {
    const node: ScreenRect = { left: 20, top: 520, right: 200, bottom: 640 }
    expect(isFullyVisible(node, pane)).toBe(false)
  })

  it('is false when the inner rect extends past the outer rect on the right', () => {
    const node: ScreenRect = { left: 850, top: 20, right: 980, bottom: 90 }
    expect(isFullyVisible(node, pane)).toBe(false)
  })

  it('is false when the inner rect starts above the outer rect', () => {
    const node: ScreenRect = { left: 20, top: -30, right: 200, bottom: 40 }
    expect(isFullyVisible(node, pane)).toBe(false)
  })

  it('treats a null outer rect (the pane has not measured yet) as already visible, never refitting blind', () => {
    const node: ScreenRect = { left: 20, top: 20, right: 200, bottom: 90 }
    expect(isFullyVisible(node, null)).toBe(true)
  })
})
