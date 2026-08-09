// R1-I — "The canvas frames its own content"
// (specs/forja-playground-canvas/spec.md, last requirement). The measured
// defect: the exercise opens with the connection its own brief is about
// sitting below the bottom of the window — `elementFromPoint` returns
// nothing there, so the finding the player just read about is neither
// visible nor clickable until they discover the fit-view control by
// accident. This file proves the opposite: every connection's rendered
// midpoint is inside the real browser window and clickable, on two
// structurally distinct exercises, at two viewport heights. Same production
// build every other e2e spec runs against (playwright.config.ts's
// webServer: `npm run build && npm run preview`), not the dev server.
//
// WHERE this is measured changed, and deliberately. It used to be measured
// at `page.goto` with no gesture, because opening an exercise scrolled the
// playground to the top of the window. That page scroll was removed: it
// left 64px of a 515–991px statement on screen, under the navbar, so the
// player arrived past step one of the product's own loop (see
// brief-on-arrival.spec.ts, and the comment where the scroll used to live in
// ForjaCanvas.tsx). R1-I is a requirement about the CAMERA — `fitView` must
// frame the diagram inside the pane — and that is untouched and still
// measured here, at the moment the player actually meets the canvas: after
// scrolling to it, with real wheel input, which is now the only thing
// standing between the statement and the diagram. What would still fail
// here is the original defect: a camera that leaves an edge outside the
// pane's own box stays outside the window no matter how far the page
// scrolls.
import { expect, test, type Locator, type Page } from '@playwright/test'
import { createNode, edgeMidpoint, scrollPlaygroundIntoView, waitForCanvasToSettle } from './helpers'

const EXERCISES = ['n4-el-pago-que-espera-al-email', 'n4-el-stock-que-hay-que-saber-ya'] as const
const HEIGHTS = [1080, 800] as const
const WIDTH = 1920

// Which connection a player's pointer actually reaches at this point.
//
// Deliberately NOT "is the topmost element a `.react-flow__edge`". WHICH
// element receives the click is an implementation detail — the stroke
// itself, React Flow's own interaction band, or the dedicated hit target
// EdgeHitTargets.tsx paints above the node layer — and asserting on one of
// them measures the implementation of the day instead of the property. A
// point that LOOKS inside the window but is painted nowhere real still
// returns null here, which is what proved the original defect (a point
// 101px below the window's bottom edge resolved to nothing), and a point
// that resolves to a NEIGHBOURING connection now fails too, which the
// original check could not see.
async function connectionAt(page: Page, point: { x: number; y: number }): Promise<string | null> {
  return page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const hitTarget = el.closest<HTMLElement>('[data-edge-hit]')
    if (hitTarget) return hitTarget.getAttribute('data-edge-hit')
    return el.closest('.react-flow__edge')?.getAttribute('data-id') ?? null
  }, point)
}

function edgeById(page: Page, id: string): Locator {
  return page.locator(`.react-flow__edge[data-id="${id}"]`)
}

// "clicking any connection's rendered midpoint MUST select it" — every one
// of them, with a real pointer, exactly the way a player would. Addressed
// by id rather than by index: selecting an edge changes React Flow's own
// paint order, so nth(i) is not the same element before and after a click.
//
// One gesture at a time, waiting for the canvas to finish reacting to the
// previous one. Not a convenience: firing these clicks back to back, with
// nothing between them, hits a live crash in the canvas — two clicks on
// DIFFERENT connections less than ~100ms apart put React Flow's own
// selection store and this component's `selectedEdgeIds` into an
// alternating loop (measured: 35 onSelectionChange ↔ 34 edge reprojections
// on one click) that ends in React error #185 and unmounts the whole
// playground, taking the player's design with it. Measured 12 crashes in 15
// runs at 0ms, 0 in 8 at 100ms, 0 in 8 for a double-click on one
// connection, and it reproduces identically on the pre-change build, so it
// is neither caused nor hidden by anything in this file. Four clicks in the
// same four milliseconds is not a gesture a pointer device can produce; the
// property under test is "a click selects the connection it landed on", and
// that is what this measures.
async function clickSelectsItsOwnConnection(page: Page, id: string, point: { x: number; y: number }, when: string) {
  await waitForCanvasToSettle(page)
  await page.mouse.click(point.x, point.y)
  await expect(edgeById(page, id), `clicking connection ${id}'s own midpoint selects it ${when}`).toHaveClass(/selected/)
}

test.describe('La Forja canvas — the canvas frames its own content [R1-I]', () => {
  for (const exerciseId of EXERCISES) {
    for (const height of HEIGHTS) {
      test(`${exerciseId} at ${WIDTH}x${height}: every connection is visible and clickable once the player reaches the canvas`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: WIDTH, height })
        await page.goto(`/forja/4/${exerciseId}`)
        await expect(page.getByTestId('forja-canvas')).toBeVisible()
        await expect(page.locator('.react-flow__node').first()).toBeVisible()
        // The player's own scroll down from the statement, and nothing
        // else: no pan, no zoom, no fit-view control. Everything measured
        // below is the camera the exercise opened with.
        await scrollPlaygroundIntoView(page)

        const edges = page.locator('.react-flow__edge')
        // Existence in the DOM, not Playwright's own `toBeVisible()` — that
        // check is about CSS visibility, not "inside the real browser
        // window", which is the actual thing this test measures below via
        // real geometry (an edge clipped by the pane's `overflow-hidden`
        // because the pane itself sits off-window can still report a real
        // bounding box, and a real, wrong, off-window midpoint — exactly
        // the defect this file exists to catch).
        await expect.poll(() => edges.count()).toBeGreaterThan(0)
        await waitForCanvasToSettle(page)
        const edgeCount = await edges.count()

        // Measured with no canvas gesture at all — the clicks come
        // afterwards, so nothing this loop asserts can have been caused by
        // the pointer.
        const reachable: { id: string; point: { x: number; y: number } }[] = []
        for (let i = 0; i < edgeCount; i++) {
          const id = await edges.nth(i).getAttribute('data-id')
          expect(id, `edge ${i} has a data-id`).toBeTruthy()
          const midpoint = await edgeMidpoint(edges.nth(i))
          reachable.push({ id: id!, point: midpoint })
          // "every node and every connection MUST be inside the visible
          // canvas area" — checked here against the real browser window,
          // the same thing a player actually sees once they are looking at
          // the canvas.
          expect(midpoint.x, `edge ${i} midpoint.x`).toBeGreaterThanOrEqual(0)
          expect(midpoint.x, `edge ${i} midpoint.x`).toBeLessThan(WIDTH)
          expect(midpoint.y, `edge ${i} midpoint.y`).toBeGreaterThanOrEqual(0)
          expect(midpoint.y, `edge ${i} midpoint.y`).toBeLessThan(height)
          expect(await connectionAt(page, midpoint), `the pointer at edge ${i}'s own midpoint reaches connection ${id}`).toBe(id)
        }

        // Every connection, not just the lowest one: the lowest was the one
        // the framing defect clipped, but "the player can select the
        // connection they aimed at" is the property, and it has to hold for
        // all of them at once.
        for (const { id, point } of reachable) {
          await clickSelectsItsOwnConnection(page, id, point, 'at the canvas')
        }
      })
    }
  }

  // Deliberately does NOT touch the canvas before resetting: the store's
  // resetTo() re-commits the exact same startingDesign object, so the
  // camera pan/zoom in place at that moment is whatever the page opened
  // with — pre-fix, that is the SAME unfit camera the tests above catch,
  // for the same reason. This isolates "does reset itself re-frame" from
  // "was the camera already fine because of something else that ran first"
  // (a drag-then-reset setup would not have been a reliable RED).
  //
  // Reset keeps its own `scrollIntoView` (ForjaCanvas.tsx's handleReset),
  // unlike opening: the button lives in the playground's own toolbar, so it
  // can only be pressed with the playground already on screen, and the
  // scroll is a small correction that puts the whole box — toolbar,
  // canvas and status bar — back under the navbar. It cannot hide the
  // statement from a player who has not read it yet, because they cannot
  // have reached the button without passing it.
  test('a reset re-frames the starting design too, no canvas gesture performed', async ({ page }) => {
    await page.setViewportSize({ width: WIDTH, height: 800 })
    const exerciseId = 'n4-el-pago-que-espera-al-email'
    await page.goto(`/forja/4/${exerciseId}`)
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()
    const edges = page.locator('.react-flow__edge')
    await expect.poll(() => edges.count()).toBeGreaterThan(0)
    await scrollPlaygroundIntoView(page)

    await page.getByTestId('reset-exercise-button').click()
    await expect(page.getByTestId('canvas-status')).toContainText('reiniciado')
    await waitForCanvasToSettle(page)

    const edgeCount = await edges.count()
    expect(edgeCount).toBeGreaterThan(0)
    const reachable: { id: string; point: { x: number; y: number } }[] = []
    for (let i = 0; i < edgeCount; i++) {
      const id = await edges.nth(i).getAttribute('data-id')
      expect(id, `edge ${i} has a data-id after reset`).toBeTruthy()
      const midpoint = await edgeMidpoint(edges.nth(i))
      reachable.push({ id: id!, point: midpoint })
      expect(midpoint.y, `edge ${i} midpoint.y after reset`).toBeGreaterThanOrEqual(0)
      expect(midpoint.y, `edge ${i} midpoint.y after reset`).toBeLessThan(800)
      expect(await connectionAt(page, midpoint), `the pointer at edge ${i}'s own midpoint reaches connection ${id} after reset`).toBe(id)
    }
    for (const { id, point } of reachable) {
      await clickSelectsItsOwnConnection(page, id, point, 'after reset')
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
