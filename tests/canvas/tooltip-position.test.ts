// The library's explanations were drawn inside a scrolling box: measured on
// a real page, the first item's balloon showed 0 of its 78px and the last
// one 47 of 94. A tooltip that explains a truncated label is worthless if
// the label is truncated AND the tooltip is clipped. This is the geometry
// that puts it beside the item and inside the window, always.
import { describe, expect, it } from 'vitest'
import { TOOLTIP_GAP_PX, tooltipPosition } from '../../src/lib/forja/canvas/tooltip-position'

const anchor = { left: 24, top: 300, right: 220, bottom: 334 }
const tooltip = { width: 224, height: 94 }
const window1024 = { width: 1024, height: 768 }

describe('tooltipPosition', () => {
  it('sits to the right of the item it explains', () => {
    const { left } = tooltipPosition(anchor, tooltip, window1024)

    expect(left).toBe(anchor.right + TOOLTIP_GAP_PX)
  })

  it('aligns with the top of the item it explains', () => {
    expect(tooltipPosition(anchor, tooltip, window1024).top).toBe(anchor.top)
  })

  it('flips to the left when there is no room on the right', () => {
    const nearRightEdge = { left: 780, top: 300, right: 976, bottom: 334 }
    const { left } = tooltipPosition(nearRightEdge, tooltip, window1024)

    expect(left).toBe(nearRightEdge.left - tooltip.width - TOOLTIP_GAP_PX)
  })

  it('never renders past the bottom of the window', () => {
    const nearBottom = { left: 24, top: 730, right: 220, bottom: 764 }
    const { top } = tooltipPosition(nearBottom, tooltip, window1024)

    expect(top + tooltip.height).toBeLessThanOrEqual(window1024.height)
  })

  it('never renders above the top of the window', () => {
    const nearTop = { left: 24, top: -40, right: 220, bottom: -6 }

    expect(tooltipPosition(nearTop, tooltip, window1024).top).toBeGreaterThanOrEqual(0)
  })

  it('never renders past the left edge when neither side has room', () => {
    const narrow = { width: 240, height: 768 }
    const { left } = tooltipPosition({ left: 8, top: 10, right: 200, bottom: 44 }, tooltip, narrow)

    expect(left).toBeGreaterThanOrEqual(0)
  })
})
