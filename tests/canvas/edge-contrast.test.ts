// Real, measured defect: React Flow's own dark-mode default edge stroke
// (@xyflow/react/dist/base.css, `.react-flow.dark { --xy-edge-stroke-default:
// #3e3e3e }`) against its own dark pane background
// (`.react-flow.dark { --xy-background-color-default: #141414 }`, confirmed
// by reading the shipped CSS directly, not guessed) computes to ~1.72:1 —
// under WCAG 1.4.11's 3:1 floor for a graphical object. The connection line
// is not decorative: it is the only way a player sees which nodes are
// wired together. Fixed by overriding the two `--xy-edge-stroke*` variables
// via inline style on <ReactFlow> (ForjaCanvas.tsx) — inline style wins the
// cascade over the library's own class-scoped custom properties, which
// class declaration order alone cannot guarantee.
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../src/lib/forja/canvas/contrast'
import {
  CANVAS_PANE_BG_HEX,
  EDGE_STROKE_DEFAULT_HEX,
  EDGE_STROKE_SELECTED_HEX,
} from '../../src/lib/forja/canvas/edge-theme'

describe('forja canvas — connection line contrast (WCAG 1.4.11, graphical objects, 3:1 floor)', () => {
  it('documents the defect: the React Flow shipped default fails the floor', () => {
    expect(contrastRatio('#3e3e3e', CANVAS_PANE_BG_HEX)).toBeLessThan(3)
  })

  it('the overridden default edge stroke meets the 3:1 floor against the canvas pane background', () => {
    expect(contrastRatio(EDGE_STROKE_DEFAULT_HEX, CANVAS_PANE_BG_HEX)).toBeGreaterThanOrEqual(3)
  })

  it('the overridden selected edge stroke is strictly higher contrast than the default (visual hierarchy holds)', () => {
    const selected = contrastRatio(EDGE_STROKE_SELECTED_HEX, CANVAS_PANE_BG_HEX)
    const unselected = contrastRatio(EDGE_STROKE_DEFAULT_HEX, CANVAS_PANE_BG_HEX)
    expect(selected).toBeGreaterThan(unselected)
  })
})

describe('contrastRatio()', () => {
  it('is symmetric — the argument order never changes the result', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(contrastRatio('#000000', '#ffffff'), 5)
  })

  it('white on black is the maximum possible ratio, 21:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0)
  })

  it('a color against itself is always 1:1', () => {
    expect(contrastRatio('#7c8db5', '#7c8db5')).toBeCloseTo(1, 5)
  })
})
