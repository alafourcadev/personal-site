// The product's loop is: read the statement → build → test. This file proves
// the player lands on step one.
//
// The measured defect: opening an exercise ran `scrollIntoView({ block:
// 'start' })` on the playground, which parked the canvas at the top of the
// window and pushed the statement out of it. At 390, 768, 1280, 1440 and
// 1920 exactly 64px of a 515–991px statement stayed on screen, and those
// 64px sat UNDER the fixed navbar — `elementFromPoint(195, 32)` at 390px
// returned the navbar, not the text. The player arrived already at step two,
// with step one off-screen.
//
// That page-level scroll existed to serve R1-I ("the canvas frames its own
// content"). R1-I is about the CAMERA — that `fitView` frames the diagram
// inside the pane — and `fitView` is untouched; see
// canvas-frames-content.spec.ts, which now measures that framing where the
// player actually meets it: at the canvas, after scrolling to it.
import { expect, test, type Page } from '@playwright/test'
import { waitForCanvasToSettle } from './helpers'
import { PLAYABLE_MIN_PX } from '../../src/lib/forja/canvas/forja-shell'

const EXERCISE = '/forja/4/n4-el-pago-que-espera-al-email'

// La Forja's own bar (ForjaTopBar.astro / FORJA_TOP_BAR_HEIGHT_PX). The blog's
// fixed navbar used to be the chrome this spec measured against; the exercise
// screen no longer loads it, and the number happens to be the same 56.
const SITE_CHROME_BOTTOM = 56

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const

// Whether the pointer at this point lands on the statement itself — the same
// check that exposed the defect, where the topmost element over the visible
// sliver of the brief was the navbar.
async function landsInsideTheBrief(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return 'nothing is painted here'
      if (el.closest('[data-testid="exercise-brief"]')) return 'the statement'
      if (el.closest('nav[aria-label="Navegación principal"]')) return 'the navbar'
      if (el.closest('a[aria-label^="Inicio"]')) return 'the brand mark'
      return `<${el.tagName.toLowerCase()}>`
    },
    { x, y },
  )
}

test.describe('La Forja — the statement is readable the moment the exercise opens', () => {
  for (const { width, height } of VIEWPORTS) {
    test(`at ${width}x${height} the player lands on the statement, not past it`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto(EXERCISE)
      // The island has to have mounted: whatever it does to the page on
      // mount must already have happened before this measures anything,
      // otherwise a green here would only mean "we looked too early".
      //
      // Under the playable width there is no canvas to wait for: the product
      // is readable and not playable there (PRODUCT.md), which is precisely
      // the width at which the statement matters most.
      if (width >= PLAYABLE_MIN_PX) {
        await expect(page.getByTestId('forja-canvas')).toBeVisible()
        await expect(page.locator('.react-flow__node').first()).toBeVisible()
      }
      // The site scrolls smoothly (BaseLayout.astro), so a page-level scroll
      // triggered on mount is still animating for several frames after the
      // island renders. Measuring before it settles is how this spec would
      // pass while the defect was still live — waitForCanvasToSettle polls
      // window.scrollY and the camera transform until both stop moving.
      await waitForCanvasToSettle(page)

      const brief = page.getByTestId('exercise-brief')
      const title = brief.locator('h1')
      const firstParagraph = page.getByTestId('exercise-body').locator('p').first()

      for (const [name, locator] of [
        ['the exercise title', title],
        ['the first paragraph of the statement', firstParagraph],
      ] as const) {
        const box = (await locator.boundingBox())!
        expect(box, `${name} is rendered`).toBeTruthy()
        expect(box.y, `${name} starts below the site's fixed navbar`).toBeGreaterThanOrEqual(SITE_CHROME_BOTTOM)
        expect(box.y + box.height, `${name} ends inside the window`).toBeLessThanOrEqual(height)
        // Not just "inside the window": the 64px of statement the defect
        // left on screen WERE inside the window — they were underneath the
        // navbar. Only a hit test can tell those two apart.
        expect(
          await landsInsideTheBrief(page, box.x + Math.min(10, box.width / 2), box.y + box.height / 2),
          `the pointer over ${name} reaches the statement`,
        ).toBe('the statement')
      }
    })
  }
})
