// The playground's chrome: the buttons, the tabs, the cards and the words that
// say something went wrong. Everything here was measured in a real browser on
// the light theme, where all of it was broken at once for the same reason:
// the brand's semantic tokens flip between themes, and several pairs were
// written assuming only one of the two.
//
// The worst of them is `bg-accent` + `text-bg-deep`. The accent green does NOT
// flip (it is rgb(16 185 129) in both themes), but `--bg-deep` does, from
// near-black to near-white. So the pair that reads 7.55:1 on the dark theme
// reads 2.22:1 on the light one, on the single most important button in the
// product ("Probar respuesta").
//
// The fix is a token that does not flip, `--on-accent`. That is deliberate and
// it is the decision for the other 28 occurrences of the same pair across the
// site (Navbar, CTASection, Card, BlogCard, newsletter, 404, empieza-aqui,
// ServiceCard, PillarCard, SeriesCard, FooterSimple...), which ship in a
// separate batch. The alternative was to darken the green in light mode to
// carry white text; measured, that is 5.48:1 against 7.55:1 for keeping the
// green and fixing the ink, and it would have changed the brand's most
// recognisable colour on 29 surfaces to solve a problem that lives in the
// foreground.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compositeOver, contrastRatio } from '../../src/lib/forja/canvas/contrast'
import { FORJA_CANVAS_HEX } from '../../src/lib/forja/canvas/edge-theme'
import { THEMES, declaration, declares, token } from './base-layout-tokens'

function source(path: string): string {
  return readFileSync(new URL(`../../src/components/forja/canvas/${path}`, import.meta.url), 'utf8')
}

const PLAYGROUND_COMPONENTS = ['ForjaCanvas.tsx', 'ForjaNode.tsx', 'ComponentLibrary.tsx', 'ContextMenu.tsx', 'ResultPanel.tsx', 'DesignList.tsx']

// `accent-dim` is `rgb(var(--accent) / 0.08)` (tailwind.config.ts), painted on
// the toolbar, which is `bg-bg-surface`.
const dimOnPanel = (theme: 'light' | 'dark') => compositeOver(token(theme, 'accent'), 0.08, token(theme, 'bg-surface'))

// The failed-objective card is `bg-accent-red/5` on the same panel.
const failedAxisCard = (theme: 'light' | 'dark') => compositeOver(token(theme, 'accent-red'), 0.05, token(theme, 'bg-surface'))

describe('the ink on an accent surface', () => {
  it('documents the defect: the deep background is the wrong ink on the light theme', () => {
    expect(contrastRatio(token('light', 'bg-deep'), token('light', 'accent'))).toBeLessThan(4.5)
  })

  // The whole point of the token: it is the same colour in both themes, so it
  // is declared once and never overridden.
  it('does not flip with the theme, which is the entire reason it exists', () => {
    expect(declares('dark', 'on-accent')).toBe(false)
  })

  it('is the near-black the dark theme was already using, kept in both themes', () => {
    expect(token('light', 'on-accent')).toBe(token('dark', 'bg-deep'))
  })

  // One ink, read against the accent of each theme, which is the same green
  // twice: that is the point being made.
  it.each(THEMES)('meets the 4.5:1 text floor on the accent button on the %s theme', (theme) => {
    expect(contrastRatio(token('light', 'on-accent'), token(theme, 'accent'))).toBeGreaterThanOrEqual(4.5)
  })

  it('leaves the brand green untouched, so the button looks the same in both themes', () => {
    expect(token('light', 'accent')).toBe(token('dark', 'accent'))
  })

  it('is what the playground’s primary action actually spends', () => {
    expect(source('ForjaCanvas.tsx')).toContain('bg-accent px-2 py-2 text-xs font-medium text-on-accent')
  })

  it('is spent by every accent surface in the playground, with none left on the old pair', () => {
    for (const component of PLAYGROUND_COMPONENTS) {
      expect(source(component), component).not.toContain('text-bg-deep')
    }
  })
})

// `text-accent` on `bg-accent-dim`: the selected tab, the closest-reference
// card, the tick that says which data class is declared. The accent green
// against a tint of itself over a near-white panel is 2.26:1.
describe('accent-coloured text on a tinted surface', () => {
  it('documents the defect: the raw accent fails the text floor on the light theme', () => {
    expect(contrastRatio(token('light', 'accent'), dimOnPanel('light'))).toBeLessThan(4.5)
  })

  it.each(THEMES)('the readable accent meets the 4.5:1 text floor on the %s theme', (theme) => {
    expect(contrastRatio(token(theme, 'accent-ink'), dimOnPanel(theme))).toBeGreaterThanOrEqual(4.5)
  })

  it('leaves the dark theme exactly where it was, because nothing was wrong there', () => {
    expect(token('dark', 'accent-ink')).toBe(token('dark', 'accent'))
  })

  it('is what the selected tab spends', () => {
    expect(source('ForjaCanvas.tsx')).toContain('bg-accent-dim text-accent-ink')
  })

  it('is what the tick in the class menu spends', () => {
    expect(source('ContextMenu.tsx')).toContain('text-accent-ink')
  })
})

// The red that says an objective failed, what it cost, and that a finding
// blocks. All of it is 12px, so the floor is 4.5:1 and there is no large-text
// exception to fall back on.
describe('the red that reports a failure', () => {
  it('documents the defect: the site red on the failed-objective card misses the text floor', () => {
    expect(contrastRatio(token('light', 'accent-red'), failedAxisCard('light'))).toBeLessThan(4.5)
  })

  it.each(THEMES)('meets the 4.5:1 text floor on the failed-objective card on the %s theme', (theme) => {
    expect(contrastRatio(token(theme, 'danger-ink'), failedAxisCard(theme))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('meets it on the plain panel too, where the blocking findings are listed, on the %s theme', (theme) => {
    expect(contrastRatio(token(theme, 'danger-ink'), token(theme, 'bg-surface'))).toBeGreaterThanOrEqual(4.5)
  })

  it('leaves the dark theme exactly where it was, because nothing was wrong there', () => {
    expect(token('dark', 'danger-ink')).toBe(token('dark', 'accent-red'))
  })

  // The card's own outline shipped at 40% opacity, which composites to #eda5a6
  // over the tint it surrounds: 1.76:1. The border is the only thing that marks
  // the card as the failed one before you read it.
  it('documents the defect: the failed-objective outline at 40% is not a line', () => {
    const at40 = compositeOver(token('light', 'accent-red'), 0.4, token('light', 'bg-surface'))
    expect(contrastRatio(at40, failedAxisCard('light'))).toBeLessThan(3)
  })

  it.each(THEMES)('the shipped outline meets the 3:1 graphical floor on the %s theme', (theme) => {
    expect(contrastRatio(token(theme, 'danger-ink'), failedAxisCard(theme))).toBeGreaterThanOrEqual(3)
  })

  it('is what the playground spends wherever it reports a failure', () => {
    for (const component of PLAYGROUND_COMPONENTS) {
      expect(source(component), component).not.toContain('text-accent-red')
    }
  })
})

// On the dark theme a card is told apart from the panel under it by being a
// lighter surface. On the light theme there is no lighter surface left, so the
// card is white and the boundary has to be drawn, which is what
// `border-subtle` at 1.18:1 was not doing.
describe('the outline of a card', () => {
  it('documents the defect: the subtle border is not a boundary on the light theme', () => {
    expect(contrastRatio(token('light', 'border-subtle'), token('light', 'bg-surface'))).toBeLessThan(1.5)
  })

  it('the card outline meets the 3:1 graphical floor against the panel it sits on', () => {
    expect(contrastRatio(token('light', 'border-card'), token('light', 'bg-surface'))).toBeGreaterThanOrEqual(3)
  })

  it('meets it against the raised surface it also outlines', () => {
    expect(contrastRatio(token('light', 'border-card'), token('light', 'bg-raised'))).toBeGreaterThanOrEqual(3)
  })

  // The dark theme's own version of the same defect, and it went the other
  // way for four tokens' worth of time: `--border-card` was declared as the
  // exact value `--border-subtle` already had, and `--elevation-1` is `none`
  // there. So on the theme this product actually opens in, the contract said
  // elevation is drawn with surface and line, and then spent neither. Measured
  // in the browser: the old card outline was 1.25:1 against the panel it sat
  // on and 1.11:1 against the raised surface, which is not a line.
  it('documents the defect: the dark card outline was the divider, at 1.11:1 on a raised surface', () => {
    expect(contrastRatio(token('dark', 'border-subtle'), token('dark', 'bg-raised'))).toBeLessThan(1.2)
  })

  it('is no longer the same token as a plain divider on the dark theme', () => {
    expect(token('dark', 'border-card')).not.toBe(token('dark', 'border-subtle'))
    expect(contrastRatio(token('dark', 'border-card'), token('dark', 'bg-surface'))).toBeGreaterThan(
      contrastRatio(token('dark', 'border-subtle'), token('dark', 'bg-surface')),
    )
  })

  // The measured floor, on each of the three surfaces a card outline actually
  // meets: the panel a finding sits on, the raised surface the objective card
  // and the menus are painted with, and the pane those float over.
  it('reads as a line on every dark surface a card is drawn on', () => {
    expect(contrastRatio(token('dark', 'border-card'), token('dark', 'bg-surface'))).toBeGreaterThanOrEqual(1.9)
    expect(contrastRatio(token('dark', 'border-card'), token('dark', 'bg-raised'))).toBeGreaterThanOrEqual(1.7)
    expect(contrastRatio(token('dark', 'border-card'), token('dark', 'bg-deep'))).toBeGreaterThanOrEqual(2.1)
  })

  // And stops short of the light theme's 3:1, deliberately. There the card is
  // white on white and the boundary has nothing else to draw it. Here the
  // surface step already says most of it, so a 3:1 hairline around every
  // finding, every axis and every menu item would be a cage.
  it('stays under the light theme’s floor, because on dark the surface says most of it', () => {
    expect(contrastRatio(token('dark', 'border-card'), token('dark', 'bg-surface'))).toBeLessThan(3)
  })

  it('is what the context menu spends, so a floating menu has an edge', () => {
    expect(source('ContextMenu.tsx')).toContain('border-border-card bg-bg-raised shadow-elevation-1')
  })
})

// The ring around a selected node. `--accent` against the light pane is 2.22:1,
// which is the same failure as the button, one interaction later: the player
// selects a node and cannot tell that they did.
describe('the ring around a selected node', () => {
  it('documents the defect: the raw accent misses the graphical floor on the light pane', () => {
    expect(contrastRatio(token('light', 'accent'), FORJA_CANVAS_HEX.light.paneBg)).toBeLessThan(3)
  })

  it.each(THEMES)('meets the 3:1 graphical floor against the %s pane', (theme) => {
    expect(contrastRatio(FORJA_CANVAS_HEX[theme].selectionMark, FORJA_CANVAS_HEX[theme].paneBg)).toBeGreaterThanOrEqual(3)
  })

  it('leaves the dark theme exactly where it was, because nothing was wrong there', () => {
    expect(FORJA_CANVAS_HEX.dark.selectionMark).toBe(token('dark', 'accent'))
  })

  it('resolves through a token, so the ring and the connection handle can never disagree', () => {
    expect(declaration('light', 'forja-mark')).toBe('rgb(var(--accent-strong))')
    expect(declaration('dark', 'forja-mark')).toBe('rgb(var(--accent))')
  })

  it('is what the node actually rings itself with', () => {
    expect(source('ForjaNode.tsx')).toContain('ring-2 ring-forja-mark ring-offset-2 ring-offset-bg-deep')
  })
})
