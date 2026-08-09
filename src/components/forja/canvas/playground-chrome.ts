// The playground's scroll geometry, kept as numbers rather than as a Tailwind
// class so there is exactly one place to change it and a test can assert the
// arithmetic (see tests/canvas/playground-chrome.test.ts).
//
// Why it exists: the site's navbar is a `fixed top-3 z-50 h-[44px]` pill
// (Navbar.astro) that paints ABOVE ordinary page content. The playground
// calls `scrollIntoView({ block: 'start' })` when it is reset (opening an
// exercise deliberately does not; see ForjaCanvas.tsx, which explains why
// the mount-time scroll was removed), which aligns its own top edge with
// y=0, parking the toolbar
// (the three view tabs and "Probar respuesta") straight under that pill.
// Measured with document.elementFromPoint at 1280x800: the tabs' centres
// resolved to `<a href="/">` and the submit button's centre to
// `<a href="/servicios">`, so a real pointer click on the primary action
// navigated away from the playground and the player lost the design they had
// just built. Keyboard still worked, which is what identified it as a
// stacking/positioning defect rather than a logic one.
//
// `scroll-margin-top` is the correct instrument: it changes where
// `scrollIntoView` decides "the top" is, without moving the element in normal
// flow and without giving the island any opinion about the site's own chrome.

import type { BriefFitPadding } from '../../../lib/forja/canvas/forja-shell'

// Navbar.astro: `top-3` (12px) + `h-[44px]`.
export const SITE_CHROME_BOTTOM_PX = 56

// 32px of real air under the navbar's lower edge, enough that the toolbar
// reads as a separate surface instead of hugging the pill.
export const PLAYGROUND_SCROLL_MARGIN_PX = 88

// Strictly greater: landing exactly on the chrome's lower edge still leaves
// the toolbar's own top border under the pill's shadow, and any rounding in
// the browser's scroll position puts it back underneath.
export function clearsSiteChrome(scrollMarginPx: number): boolean {
  return scrollMarginPx > SITE_CHROME_BOTTOM_PX
}

// Opening the result panel takes 380px away from the canvas (the panel is
// `w-[380px] shrink-0`), so the design the verdict is about can fall outside
// the visible pane at the exact moment the player is asked to look at it.
// Measured at 1440x900, the pane went from 1170px to 790px wide and two of
// seven nodes left the view. React Flow's own `fitView` re-frames the camera;
// these are the options it gets.
//
// The padding is now handed in, because on an exercise page the room the
// camera has to leave is not a fraction of anything: it is the footprint of
// the objective card floating over the canvas (forja-shell.ts's
// briefFitPadding), and that footprint moves from the left edge to the top
// edge when the card folds.
//
// Free play keeps the fraction it has always had. It has no card, so an
// absolute per-side inset would buy it nothing and would reframe every free
// play diagram for a reason that does not exist there.
export const FREE_PLAY_FIT_PADDING = 0.15

export type FitPadding = number | BriefFitPadding

export function resultFitViewOptions(
  prefersReducedMotion: boolean,
  padding: FitPadding,
): { duration: number; padding: FitPadding } {
  return { duration: prefersReducedMotion ? 0 : 240, padding }
}
