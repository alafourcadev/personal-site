// The playground's surfaces, and how something that floats says so.
//
// The first defect this file caught was on the dark theme: the canvas painted
// React Flow's own `#141414`, and every floating layer carried a `shadow-lg`
// that measured 1.03:1 over the panel under it while being DARKER than that
// panel. Fixed by making elevation an ORDERING of brand surfaces.
//
// The second defect is the light theme, and it is the same mistake read
// backwards. `--bg-surface-hover` is the site's hover surface, so in light mode
// it is DARKER than the panel it hovers over: correct for a hover, exactly
// wrong for something that floats. Measured in the browser: the palette's
// tooltip computed #f0f4f8 on a #f8fafc panel, 1.06:1, no shadow. The thing on
// top was the darker of the two.
//
// So there are two mechanisms, not one inverted mechanism:
//   - dark: elevation is SURFACE and LINE. `--bg-raised` is lighter than the
//     panel, `--elevation-1` is `none`.
//   - light: elevation is SHADOW. `--bg-raised` is pure white, and
//     `--elevation-1` carries the whole signal.
//
// The pane is the one surface that does not rise: it is the hole the drawing
// sits in, `--bg-deep` in both themes, 1.12:1 under the panel in dark and
// 1.09:1 in light. Same relation, both ways round.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { relativeLuminance } from '../../src/lib/forja/canvas/contrast'
import { CANVAS_EDGE_STYLE_VARS, FORJA_CANVAS_HEX } from '../../src/lib/forja/canvas/edge-theme'
import { THEMES, declaration, token } from './base-layout-tokens'

function source(path: string): string {
  return readFileSync(new URL(`../../src/components/forja/canvas/${path}`, import.meta.url), 'utf8')
}

const PLAYGROUND_COMPONENTS = ['ForjaCanvas.tsx', 'ForjaNode.tsx', 'ComponentLibrary.tsx', 'ContextMenu.tsx', 'ResultPanel.tsx']

describe('the canvas surface', () => {
  it.each(THEMES)('is the brand’s own deep background on the %s theme, not React Flow’s default grey', (theme) => {
    expect(FORJA_CANVAS_HEX[theme].paneBg).toBe(token(theme, 'bg-deep'))
  })

  // React Flow paints the pane with
  // `var(--xy-background-color, var(--xy-background-color-default))`, and its
  // `.react-flow.dark` rule redeclares that fallback on the very element that
  // carries the class, so an ancestor-level override loses. The inline style
  // still wins the cascade; it just points at a token now instead of spelling
  // a colour, which is what lets one declaration serve both themes.
  it('is declared as the property React Flow actually paints with', () => {
    expect(CANVAS_EDGE_STYLE_VARS['--xy-background-color']).toBe('var(--forja-pane)')
  })

  it('resolves that token to the same background the page around the canvas uses', () => {
    expect(declaration('light', 'forja-pane')).toBe('rgb(var(--bg-deep))')
  })
})

// The node card is the one surface that does NOT simply mirror the panel. On
// the light theme it is pure white, a value the dark palette does not contain
// at all, and that is on purpose: the pane is `--bg-deep`, one step DOWN from
// the panel, so a card painted `--bg-surface` on it would read 1.09:1 and melt.
// White reads 1.14:1 against that pane, which is the same 1.12:1 the dark
// theme's card already had. Same relation, two different colours.
describe('the node card', () => {
  it('is pure white on the light theme, which is what keeps it off the pane', () => {
    expect(FORJA_CANVAS_HEX.light.nodeBg).toBe('#ffffff')
  })

  it('is the panel surface on the dark theme, exactly as it has always been', () => {
    expect(FORJA_CANVAS_HEX.dark.nodeBg).toBe(token('dark', 'bg-surface'))
  })

  it('sits above the pane by the same amount in both themes', () => {
    const step = (theme: 'light' | 'dark') =>
      relativeLuminance(FORJA_CANVAS_HEX[theme].nodeBg) - relativeLuminance(FORJA_CANVAS_HEX[theme].paneBg)
    expect(step('light')).toBeGreaterThan(0)
    expect(step('dark')).toBeGreaterThan(0)
  })

  it('is what the node actually paints itself with', () => {
    expect(source('ForjaNode.tsx')).toContain('bg-white dark:bg-bg-surface')
  })
})

// The objective card is the one element in the whole composition that really
// floats: it is out of the layout flow, anchored over the pane, with the
// diagram drawn underneath it. It shipped painted `bg-bg-surface`, the same
// plane as the top bar 48px above it, which is the rule this file states read
// backwards: the thing on top was on the same surface as the chrome it was
// meant to be over.
describe('the objective card, which is the one thing that floats over the canvas', () => {
  // The card's own class list, not the file: the note above it names the
  // surface it USED to spend, and a whole-file match would read that note as
  // the shipped value.
  const BRIEF = readFileSync(new URL('../../src/components/forja/ExerciseBrief.astro', import.meta.url), 'utf8')
  const CARD_CLASSES = BRIEF.match(/class="(forja-brief[^"]*)"/)?.[1] ?? ''

  it('is painted on the raised surface, not on the panel the top bar uses', () => {
    expect(CARD_CLASSES).toContain('bg-bg-raised')
    expect(CARD_CLASSES).not.toContain('bg-bg-surface')
  })

  it('rises above the pane it is anchored over, on both themes', () => {
    for (const theme of THEMES) {
      expect(relativeLuminance(token(theme, 'bg-raised')), theme).toBeGreaterThan(
        relativeLuminance(token(theme, 'bg-deep')),
      )
    }
  })

  it('has an outline that is a card’s and not a divider’s', () => {
    expect(CARD_CLASSES).toContain('border-border-card')
  })
})

describe('elevation', () => {
  it.each(THEMES)('rises through the token scale on the %s theme: pane under panel, panel under raised', (theme) => {
    const pane = relativeLuminance(token(theme, 'bg-deep'))
    const panel = relativeLuminance(token(theme, 'bg-surface'))
    const raised = relativeLuminance(token(theme, 'bg-raised'))

    expect(panel).toBeGreaterThan(pane)
    expect(raised).toBeGreaterThan(panel)
  })

  it('is carried by shadow on the light theme, where a lighter surface has nowhere left to go', () => {
    expect(declaration('light', 'elevation-1')).toMatch(/^0 /)
  })

  it('spends no shadow at all on the dark theme, where surface and line already say it', () => {
    expect(declaration('dark', 'elevation-1')).toBe('none')
  })

  it('puts the palette’s explanation on the raised surface, not under the panel it belongs to', () => {
    const tooltip = source('ComponentLibrary.tsx').match(/role="tooltip"[\s\S]*?className={`([^`]*)/)
    expect(tooltip?.[1]).toContain('bg-bg-raised')
  })

  it('puts the node’s explanation on the raised surface too', () => {
    const tooltip = source('ForjaNode.tsx').match(/role="tooltip"[\s\S]*?className="([^"]*)"/)
    expect(tooltip?.[1]).toContain('bg-bg-raised')
  })

  // The old rule here was "no shadow class anywhere", written when the only
  // shadows in the file were the invisible `shadow-lg` ones. A blanket ban is
  // the wrong shape now: the light theme NEEDS a shadow, and Navbar.astro has
  // shipped `shadow-lg shadow-black/5 dark:shadow-black/25` all along. The rule
  // that survives is that the playground never picks a shadow itself: it
  // spends the one the theme decided, which is `none` on dark.
  it('never picks its own shadow: every shadow it spends is the theme’s own', () => {
    for (const component of PLAYGROUND_COMPONENTS) {
      for (const shadow of source(component).match(/\bshadow-[a-z0-9-]+/g) ?? []) {
        expect(shadow, component).toBe('shadow-elevation-1')
      }
    }
  })
})
