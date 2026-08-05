// R1-I — "The canvas frames its own content"
// (specs/forja-playground-canvas/spec.md, last requirement). The measured
// defect: the exercise opens with the connection its own brief is about
// sitting below the bottom of the window — `elementFromPoint` returns
// nothing there, so the finding the player just read about is neither
// visible nor clickable until they discover the fit-view control by
// accident. This file proves the opposite: on a real page.goto, with NO
// gesture at all, every connection's rendered midpoint is inside the real
// browser window and clickable, on two structurally distinct exercises, at
// two viewport heights. Same production build every other e2e spec runs
// against (playwright.config.ts's webServer: `npm run build && npm run
// preview`), not the dev server.
import { expect, test, type Page } from '@playwright/test'
import { createNode, edgeMidpoint } from './helpers'

const EXERCISES = ['core-el-pago-que-espera-al-email', 'tradeoff-el-stock-que-hay-que-saber-ya'] as const
const HEIGHTS = [1080, 800] as const
const WIDTH = 1920

// The literal check the defect needs: a point that LOOKS inside the window
// but is actually painted nowhere real returns null/something unrelated
// from elementFromPoint — this is what proved the original bug (a point
// 101px below the window's bottom edge resolved to nothing).
async function hitTestsAnEdge(page: Page, point: { x: number; y: number }): Promise<boolean> {
  return page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    return !!el?.closest('.react-flow__edge')
  }, point)
}

// The site's own global `scroll-behavior: smooth` (BaseLayout.astro)
// applies to the auto scroll-into-view this fix performs, so the browser
// animates it over several hundred ms (measured: still moving at 300ms,
// settled by 600ms) — a real player sees exactly this same settling
// animation. Polling for two consecutive scrollY reads to agree is the
// deterministic way to wait for "no gesture, but let the page finish
// reacting to having opened" without hardcoding a duration.
async function waitForScrollToSettle(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const before = await page.evaluate(() => window.scrollY)
        await page.waitForTimeout(50)
        const after = await page.evaluate(() => window.scrollY)
        return before === after
      },
      { timeout: 10000 },
    )
    .toBe(true)
}

test.describe('La Forja canvas — the canvas frames its own content [R1-I]', () => {
  for (const exerciseId of EXERCISES) {
    for (const height of HEIGHTS) {
      test(`${exerciseId} at ${WIDTH}x${height}: every connection is visible and clickable on open, no gesture performed`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: WIDTH, height })
        await page.goto(`/forja/4/${exerciseId}`)
        await expect(page.getByTestId('forja-canvas')).toBeVisible()
        await expect(page.locator('.react-flow__node').first()).toBeVisible()

        const edges = page.locator('.react-flow__edge')
        // Existence in the DOM, not Playwright's own `toBeVisible()` — that
        // check is about CSS visibility, not "inside the real browser
        // window", which is the actual thing this test measures below via
        // real geometry (an edge clipped by the pane's `overflow-hidden`
        // because the pane itself sits off-window can still report a real
        // bounding box, and a real, wrong, off-window midpoint — exactly
        // the defect this file exists to catch).
        await expect.poll(() => edges.count()).toBeGreaterThan(0)
        await waitForScrollToSettle(page)
        const edgeCount = await edges.count()

        const midpoints: { x: number; y: number }[] = []
        for (let i = 0; i < edgeCount; i++) {
          const midpoint = await edgeMidpoint(edges.nth(i))
          midpoints.push(midpoint)
          // "every node and every connection MUST be inside the visible
          // canvas area" — checked here against the real browser window,
          // the same thing a player actually sees without scrolling.
          expect(midpoint.x, `edge ${i} midpoint.x`).toBeGreaterThanOrEqual(0)
          expect(midpoint.x, `edge ${i} midpoint.x`).toBeLessThan(WIDTH)
          expect(midpoint.y, `edge ${i} midpoint.y`).toBeGreaterThanOrEqual(0)
          expect(midpoint.y, `edge ${i} midpoint.y`).toBeLessThan(height)
          expect(await hitTestsAnEdge(page, midpoint), `elementFromPoint at edge ${i}'s midpoint`).toBe(true)
        }

        // "clicking any connection's rendered midpoint MUST select it" —
        // the lowest connection on screen is the one most likely to have
        // been clipped by the original defect, so it is the one physically
        // clicked here, exactly the way a player would.
        const lowest = midpoints.reduce((max, p) => (p.y > max.y ? p : max))
        const lowestIndex = midpoints.indexOf(lowest)
        await page.mouse.click(lowest.x, lowest.y)
        await expect(edges.nth(lowestIndex)).toHaveClass(/selected/)
      })
    }
  }

  // Deliberately does NOT touch the canvas before resetting: the store's
  // resetTo() re-commits the exact same startingDesign object, so the
  // camera pan/zoom in place at that moment is whatever the page opened
  // with — pre-fix, that is the SAME unfit camera the "on open" tests above
  // catch, for the same reason. This isolates "does reset itself re-frame"
  // from "was the camera already fine because of something else that ran
  // first" (a drag-then-reset setup would not have been a reliable RED).
  test('a reset re-frames the starting design too, no gesture performed', async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 800 })
    const exerciseId = 'core-el-pago-que-espera-al-email'
    await page.goto(`/forja/4/${exerciseId}`)
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    const edges = page.locator('.react-flow__edge')
    await expect.poll(() => edges.count()).toBeGreaterThan(0)
    // Let the mount-time scrollIntoView() settle BEFORE resetting, so this
    // test isolates "does reset itself re-frame" from a reset click landing
    // mid-animation of the unrelated initial-open scroll.
    await waitForScrollToSettle(page)

    await page.getByTestId('reset-exercise-button').click()
    await expect(page.getByTestId('canvas-status')).toContainText('reiniciado')
    await waitForScrollToSettle(page)

    const edgeCount = await edges.count()
    expect(edgeCount).toBeGreaterThan(0)
    for (let i = 0; i < edgeCount; i++) {
      const midpoint = await edgeMidpoint(edges.nth(i))
      expect(midpoint.y, `edge ${i} midpoint.y after reset`).toBeGreaterThanOrEqual(0)
      expect(midpoint.y, `edge ${i} midpoint.y after reset`).toBeLessThan(800)
      expect(await hitTestsAnEdge(page, midpoint), `elementFromPoint at edge ${i}'s midpoint after reset`).toBe(true)
    }
  })

  test('a newly added component that would land outside the visible area is brought into view, no manual pan or fit', async ({
    page,
  }) => {
    // A short viewport, same technique canvas-polish.spec.ts's PC7 test
    // uses to make "off screen" deterministic — content stacking within a
    // single band (nextCreatePosition) overflows it quickly.
    await page.setViewportSize({ width: 1280, height: 500 })
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()

    for (const type of ['worker', 'worker', 'worker', 'worker', 'worker']) {
      await createNode(page, type)
    }
    const last = page.locator('.react-flow__node').last()
    await expect(last).toBeInViewport()
  })
})
