// Real, measured defect: React Flow's own default edge stroke against its own
// default pane background fails WCAG 1.4.11's 3:1 floor for a graphical object
// in BOTH of the library's themes: `#3e3e3e` on `#141414` in dark, `#b1b1b7`
// on a near-white pane in light (read straight out of
// @xyflow/react/dist/base.css, not guessed). The connection line is not
// decorative: it is the only way a player sees which nodes are wired together.
//
// Fixed by overriding the `--xy-edge-stroke*` variables via inline style on
// <ReactFlow> (ForjaCanvas.tsx) — inline style wins the cascade over the
// library's own class-scoped custom properties, which class declaration order
// alone cannot guarantee. The inline values point at brand tokens rather than
// at hexes, so one declaration serves both themes; the hexes below are the
// numbers those tokens resolve to, read from BaseLayout.astro.
import { describe, expect, it } from 'vitest'
import { compositeOver, contrastRatio } from '../../src/lib/forja/canvas/contrast'
import { CANVAS_EDGE_STYLE_VARS, FORJA_CANVAS_HEX } from '../../src/lib/forja/canvas/edge-theme'
import { THEMES, declaration, token } from './base-layout-tokens'

describe('forja canvas — the strokes are the theme’s own colours', () => {
  it.each(THEMES)('draws an unselected connection in the %s theme’s quietest text colour', (theme) => {
    expect(FORJA_CANVAS_HEX[theme].edgeDefault).toBe(token(theme, 'txt-muted'))
  })

  it.each(THEMES)('draws a selected connection in the %s theme’s loudest text colour', (theme) => {
    expect(FORJA_CANVAS_HEX[theme].edgeSelected).toBe(token(theme, 'txt-primary'))
  })

  it('points the library’s own stroke properties at those tokens instead of at a hex', () => {
    expect(CANVAS_EDGE_STYLE_VARS['--xy-edge-stroke-default']).toBe('var(--forja-edge-default)')
    expect(CANVAS_EDGE_STYLE_VARS['--xy-edge-stroke-selected-default']).toBe('var(--forja-edge-selected)')
  })
})

describe('forja canvas — connection line contrast (WCAG 1.4.11, graphical objects, 3:1 floor)', () => {
  it('documents the defect: React Flow’s shipped dark default fails the floor', () => {
    expect(contrastRatio('#3e3e3e', FORJA_CANVAS_HEX.dark.paneBg)).toBeLessThan(3)
  })

  // The light-theme twin of the line above. It was unreachable while the canvas
  // was pinned to `colorMode="dark"`; it is reachable now, so it is pinned too.
  it('documents the defect: React Flow’s shipped light default fails the floor', () => {
    expect(contrastRatio('#b1b1b7', FORJA_CANVAS_HEX.light.paneBg)).toBeLessThan(3)
  })

  it.each(THEMES)('the overridden default stroke meets the 3:1 floor against the %s pane', (theme) => {
    expect(contrastRatio(FORJA_CANVAS_HEX[theme].edgeDefault, FORJA_CANVAS_HEX[theme].paneBg)).toBeGreaterThanOrEqual(3)
  })

  it.each(THEMES)('the selected stroke is strictly louder than the default on the %s theme', (theme) => {
    const selected = contrastRatio(FORJA_CANVAS_HEX[theme].edgeSelected, FORJA_CANVAS_HEX[theme].paneBg)
    const unselected = contrastRatio(FORJA_CANVAS_HEX[theme].edgeDefault, FORJA_CANVAS_HEX[theme].paneBg)
    expect(selected).toBeGreaterThan(unselected)
  })

  // The terminal case of the light-mode defect: `--txt-primary` never flipped,
  // so the connection a player had just selected was drawn in #e2e8f0 on a
  // #ecf0f6 pane, 1.08:1. The strongest state on the canvas was the invisible
  // one.
  it('documents the defect: the dark theme’s selected stroke all but vanishes on the light pane', () => {
    expect(contrastRatio(FORJA_CANVAS_HEX.dark.edgeSelected, FORJA_CANVAS_HEX.light.paneBg)).toBeLessThan(1.5)
  })
})

// The band names are text, so the floor is 1.4.3's 4.5:1, not 1.4.11's 3:1 —
// and they never qualify for the large-text exception: they are 10-12px.
// Measured in the production build before this constant existed: the label
// shipped as `text-txt-muted/70`, which composites to #5d6985 over the pane
// and reads 3.34:1. The alpha was the whole defect — the token underneath it
// passes on its own, in both themes.
describe('forja canvas — band name contrast (WCAG 1.4.3, text, 4.5:1 floor)', () => {
  it('documents the defect: the same token at 70% opacity fails the floor', () => {
    expect(contrastRatio('#5d6985', FORJA_CANVAS_HEX.dark.paneBg)).toBeLessThan(4.5)
  })

  it.each(THEMES)('the band name meets the 4.5:1 floor against the %s pane', (theme) => {
    expect(contrastRatio(FORJA_CANVAS_HEX[theme].bandLabel, FORJA_CANVAS_HEX[theme].paneBg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('stays quieter than a selected connection on the %s theme, so it reads as chrome', (theme) => {
    expect(contrastRatio(FORJA_CANVAS_HEX[theme].bandLabel, FORJA_CANVAS_HEX[theme].paneBg)).toBeLessThan(
      contrastRatio(FORJA_CANVAS_HEX[theme].edgeSelected, FORJA_CANVAS_HEX[theme].paneBg),
    )
  })
})

// The three vertical rules that separate Negocio / Aplicación / Infraestructura.
// They shipped as `border-border-subtle/50`, which is 1.15:1 over the dark pane
// and 1.04:1 over the light one: a divider nobody can see in either theme.
// This is a pre-existing dark-theme defect, not a light-theme regression, which
// is why both halves get a value rather than only the new one.
describe('forja canvas — band dividers are visible in both themes', () => {
  it('documents the defect: the subtle border at 50% is invisible over the dark pane', () => {
    expect(contrastRatio(compositeOver(token('dark', 'border-subtle'), 0.5, FORJA_CANVAS_HEX.dark.paneBg), FORJA_CANVAS_HEX.dark.paneBg)).toBeLessThan(1.2)
  })

  it.each(THEMES)('has its own declared value on the %s theme, instead of borrowing a border it is not', (theme) => {
    expect(declaration(theme, 'forja-band-divider')).toBe(FORJA_CANVAS_HEX[theme].bandDivider)
  })

  it.each(THEMES)('the shipped divider reads as a line on the %s theme', (theme) => {
    expect(contrastRatio(FORJA_CANVAS_HEX[theme].bandDivider, FORJA_CANVAS_HEX[theme].paneBg)).toBeGreaterThanOrEqual(2)
  })

  it.each(THEMES)('stays quieter than the band name it belongs to on the %s theme', (theme) => {
    expect(contrastRatio(FORJA_CANVAS_HEX[theme].bandDivider, FORJA_CANVAS_HEX[theme].paneBg)).toBeLessThan(
      contrastRatio(FORJA_CANVAS_HEX[theme].bandLabel, FORJA_CANVAS_HEX[theme].paneBg),
    )
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

describe('compositeOver()', () => {
  it('at full opacity the backdrop contributes nothing', () => {
    expect(compositeOver('#10b981', 1, '#ffffff')).toBe('#10b981')
  })

  it('at zero opacity only the backdrop is left', () => {
    expect(compositeOver('#10b981', 0, '#f8fafc')).toBe('#f8fafc')
  })

  // Measured in the browser on the failed-axis card: `bg-accent-red/5` over
  // `bg-bg-surface` computes to #f7eff1. The maths has to land on the same
  // colour the browser does, or every ratio derived from it is fiction.
  it('lands on the colour the browser composites the failed-axis tint to', () => {
    expect(compositeOver('#dc2626', 0.05, '#f8fafc')).toBe('#f7eff1')
  })
})
