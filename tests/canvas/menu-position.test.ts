// Pure clamp used to keep the context menu inside the playground's own box
// [PC15's "stay within the viewport", PC17's overlay containment] — the
// same function serves both, since the playground root never extends above
// the site header. No DOM: operates on plain rects.
import { describe, expect, it } from 'vitest'
import { clampMenuPosition } from '../../src/lib/forja/canvas/menu-position'

const bounds = { x: 0, y: 0, width: 800, height: 500 }

describe('clampMenuPosition', () => {
  it('keeps the anchor point when the menu fits entirely inside the bounds', () => {
    const result = clampMenuPosition({ x: 100, y: 100 }, { width: 200, height: 150 }, bounds)
    expect(result).toEqual({ x: 100, y: 100 })
  })

  it('pulls the menu back when it would overflow the right edge', () => {
    const result = clampMenuPosition({ x: 750, y: 100 }, { width: 200, height: 150 }, bounds)
    expect(result.x).toBe(600) // 800 - 200
  })

  it('pulls the menu back when it would overflow the bottom edge', () => {
    const result = clampMenuPosition({ x: 100, y: 480 }, { width: 200, height: 150 }, bounds)
    expect(result.y).toBe(350) // 500 - 150
  })

  it('never places the menu above or to the left of the bounds origin', () => {
    const result = clampMenuPosition({ x: -50, y: -50 }, { width: 200, height: 150 }, bounds)
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  it('clamps to the origin when the menu is larger than the bounds', () => {
    const result = clampMenuPosition({ x: 10, y: 10 }, { width: 2000, height: 2000 }, bounds)
    expect(result).toEqual({ x: 0, y: 0 })
  })
})
