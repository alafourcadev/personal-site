// The playground's own scroll geometry. This is not a style preference: the
// site's navbar is `fixed top-3 z-50 h-[44px]` (Navbar.astro), so the top 56
// CSS pixels of the viewport belong to chrome that paints ABOVE the page.
// `scrollIntoView({ block: 'start' })` aligns the playground's top edge with
// y=0, which parks the toolbar (tabs + "Probar respuesta") underneath that
// chrome — measured with document.elementFromPoint, the tab centres resolved
// to `<a href="/">` and the submit button's centre to `<a href="/servicios">`
// at 1280px wide. A pointer click on the primary action navigated away and
// took the player's design with it.
//
// The arithmetic below is what makes that impossible, so it is tested as
// arithmetic, not as a class name.
import { describe, expect, it } from 'vitest'
import {
  FREE_PLAY_FIT_PADDING,
  PLAYGROUND_SCROLL_MARGIN_PX,
  SITE_CHROME_BOTTOM_PX,
  clearsSiteChrome,
  resultFitViewOptions,
} from '../../src/components/forja/canvas/playground-chrome'
import { PANE_INSET_PADDING, briefFitPadding, workspaceCanvasWidth } from '../../src/lib/forja/canvas/forja-shell'

describe('site chrome geometry', () => {
  it('mirrors the navbar pill: 12px offset + 44px tall', () => {
    expect(SITE_CHROME_BOTTOM_PX).toBe(56)
  })
})

describe('clearsSiteChrome', () => {
  it('rejects the unset scroll margin that caused the defect', () => {
    expect(clearsSiteChrome(0)).toBe(false)
  })

  it('rejects a margin that only just touches the chrome edge', () => {
    expect(clearsSiteChrome(SITE_CHROME_BOTTOM_PX)).toBe(false)
  })

  it('accepts a margin that leaves real air under the navbar', () => {
    expect(clearsSiteChrome(SITE_CHROME_BOTTOM_PX + 24)).toBe(true)
  })
})

describe('PLAYGROUND_SCROLL_MARGIN_PX', () => {
  it('clears the site chrome', () => {
    expect(clearsSiteChrome(PLAYGROUND_SCROLL_MARGIN_PX)).toBe(true)
  })
})

describe('resultFitViewOptions', () => {
  // The padding is handed in rather than fixed: on an exercise page the
  // objective card floats over the canvas, and the room the camera must leave
  // is that card's own footprint in real pixels (forja-shell.ts's
  // briefFitPadding). Free play has no card and keeps the fraction it always
  // had.
  it('re-frames the design with a short animation by default', () => {
    expect(resultFitViewOptions(false, FREE_PLAY_FIT_PADDING)).toEqual({
      duration: 240,
      padding: FREE_PLAY_FIT_PADDING,
    })
  })

  it('keeps the re-framing but drops the animation under reduced motion', () => {
    expect(resultFitViewOptions(true, FREE_PLAY_FIT_PADDING)).toEqual({ duration: 0, padding: FREE_PLAY_FIT_PADDING })
  })

  // The value free play has always used, and the reason it did: it keeps the
  // outermost nodes off the pane's edges so a finding's highlight ring is
  // never clipped.
  it('leaves free play the fraction of the pane it always had', () => {
    expect(FREE_PLAY_FIT_PADDING).toBe(0.15)
  })

  it('passes the card’s own footprint straight through, so the diagram clears it', () => {
    const withCard = briefFitPadding(false, workspaceCanvasWidth(1440))
    expect(withCard.left).not.toBe(PANE_INSET_PADDING.left)
    expect(resultFitViewOptions(false, withCard).padding).toEqual(withCard)
  })
})
