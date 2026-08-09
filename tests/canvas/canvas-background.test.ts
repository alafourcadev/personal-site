// The grid the diagram is drawn on.
//
// It shipped as a bare `<Background />`: React Flow's own defaults, `gap: 20`
// and `size: 1`, chosen by the library rather than by this product. The colour
// was per theme but the two themes were not the same grid. Measured against
// each pane:
//
//   dark   #555555 on #0a0f1a   2.57:1
//   light  #b8c3d4 on #ecf0f6   1.56:1
//
// The dark theme is the one this product opens in, and its grid was almost
// twice as loud as the light one. That is the defect: not that a number was
// wrong, but that nobody had chosen it, so the surface competed with the
// drawing on the theme most players see.
//
// What is chosen here, and why it is arithmetic rather than taste: React Flow
// multiplies BOTH the gap and the dot size by the live zoom (see
// dotGridOnScreen, which mirrors its own maths), so a grid is not one look, it
// is a family of looks across the zooms the camera actually settles on. A grid
// picked at one zoom is a wash at another.
import { describe, expect, it } from 'vitest'
import { CANVAS_DOT_GRID, SHELL_ZOOM_RANGE, dotGridOnScreen } from '../../src/lib/forja/canvas/canvas-background'
import { contrastRatio } from '../../src/lib/forja/canvas/contrast'
import { CANVAS_EDGE_STYLE_VARS, FORJA_CANVAS_HEX } from '../../src/lib/forja/canvas/edge-theme'
import { THEMES, declaration } from './base-layout-tokens'

// The token each theme resolves the pattern to, read from where it is
// declared. A copied colour is a colour that can drift.
const patternHex = (theme: (typeof THEMES)[number]) => declaration(theme, 'forja-pane-pattern')

describe('the dot grid', () => {
  it('is dots, which is the variant that reads as a surface instead of as ruled paper', () => {
    expect(CANVAS_DOT_GRID.variant).toBe('dots')
  })

  // Both numbers are deliberate, and neither is React Flow's default. Stated
  // as "not the default" rather than as the literals, so this test fails for
  // the reason it exists: the grid going back to being inherited.
  it('picks its own spacing and its own dot, rather than inheriting the library’s', () => {
    expect(CANVAS_DOT_GRID.gap).not.toBe(20)
    expect(CANVAS_DOT_GRID.size).not.toBe(1)
  })
})

describe('the grid under zoom, which is where a badly chosen one fails', () => {
  // React Flow's own arithmetic: the pattern tile is `gap * zoom` and the dot's
  // diameter is `size * zoom`. Mirrored here so the behaviour is provable
  // without a browser, and asserted against the library's shape so the mirror
  // cannot quietly stop matching.
  it('scales both the spacing and the dot with the camera, exactly as React Flow does', () => {
    for (const zoom of [0.5, 1, 2]) {
      const { spacingPx, diameterPx } = dotGridOnScreen(zoom)
      expect(spacingPx).toBeCloseTo(CANVAS_DOT_GRID.gap * zoom, 6)
      expect(diameterPx).toBeCloseTo(CANVAS_DOT_GRID.size * zoom, 6)
    }
  })

  // A dot under a pixel is not a dot, it is an antialiased smudge, and a field
  // of smudges is the wash this grid must never become. The floor is claimed
  // only over the zooms the workbench actually settles on, measured on
  // `/forja/1/n1-el-comprobante-que-no-se-guarda` across 1133, 1440 and 1512
  // with the rails in every combination.
  it('keeps a real pixel of dot everywhere the workbench actually frames a diagram', () => {
    for (const zoom of [SHELL_ZOOM_RANGE.min, 0.8, 1, SHELL_ZOOM_RANGE.max]) {
      expect(dotGridOnScreen(zoom).diameterPx, `zoom ${zoom}`).toBeGreaterThanOrEqual(1)
    }
  })

  // The other end of the same failure: dots close enough together read as a
  // tint rather than as a grid, and the sense of scale is what the grid is for.
  // Twelve times the dot is the distance at which the eye still reads separate
  // marks at these sizes.
  it('never lets the dots close up into a tint, at any zoom the camera reaches', () => {
    for (const zoom of [SHELL_ZOOM_RANGE.min, 1, SHELL_ZOOM_RANGE.max, 4]) {
      const { spacingPx, diameterPx } = dotGridOnScreen(zoom)
      expect(spacingPx / diameterPx, `zoom ${zoom}`).toBeGreaterThanOrEqual(12)
    }
  })
})

describe('the grid’s colour, which is one measured relation in two themes', () => {
  // The pane is `--bg-deep` in both themes and the grid has to sit the same
  // distance off it in both, or the product has two different surfaces
  // depending on which switch the player pressed. This is the defect being
  // repaired, so it is asserted as the two ratios agreeing, never as a hex.
  it('sits the same distance off the pane on both themes', () => {
    const ratios = THEMES.map((theme) => contrastRatio(patternHex(theme), FORJA_CANVAS_HEX[theme].paneBg))
    expect(Math.abs(ratios[0] - ratios[1])).toBeLessThan(0.05)
  })

  // Felt, not read. Well under the 3:1 a graphical object needs to be
  // PERCEIVABLE, on purpose: this one is decoration, and WCAG 1.4.11 exempts
  // it for exactly that reason. Anything at or above that floor is a grid
  // asking to be looked at.
  it.each(THEMES)('is decoration on the %s theme, not a graphical object competing for attention', (theme) => {
    const ratio = contrastRatio(patternHex(theme), FORJA_CANVAS_HEX[theme].paneBg)
    expect(ratio).toBeGreaterThan(1.3)
    expect(ratio).toBeLessThan(1.8)
  })

  // The rule that protects the drawing. Connections are measured at 3:1
  // against the same pane (edge-contrast.test.ts) because they carry meaning;
  // the grid must stay far enough under them that a cable never has to be
  // picked out of it.
  it.each(THEMES)('stays well under the connections it must not compete with, on the %s theme', (theme) => {
    const pane = FORJA_CANVAS_HEX[theme].paneBg
    const grid = contrastRatio(patternHex(theme), pane)
    const edge = contrastRatio(FORJA_CANVAS_HEX[theme].edgeDefault, pane)
    expect(grid * 2).toBeLessThan(edge)
  })

  it('is painted through the property React Flow actually reads', () => {
    expect(CANVAS_EDGE_STYLE_VARS['--xy-background-pattern-color']).toBe('var(--forja-pane-pattern)')
  })
})
