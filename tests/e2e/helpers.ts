// Shared helpers for the /forja canvas Playwright suite. Every coordinate
// used to drive `page.mouse` is computed from real, rendered bounding boxes
// — never a synthetic dispatchEvent. That distinction is the whole point of
// this suite: the prototype's connection-delete bug (B4) was invisible to
// synthetic click dispatch and only reproducible with a real pointer.
import { expect, type Locator, type Page } from '@playwright/test'

// Two things move the canvas under the pointer with NO gesture from the
// player: the site's global `scroll-behavior: smooth` (BaseLayout.astro)
// animating the playground's own scrollIntoView — which now also runs when a
// newly created component would land outside the visible area — and React
// Flow's camera animating a fitView. A bounding box read while either is
// running is already stale by the time `page.mouse` acts on it: the
// coordinates say where the element WAS. That is what made the human-path
// build drop its last connection (measured: 2 of 3 runs), while the same
// gestures issued after the canvas settled created it every time.
//
// Polling for two consecutive agreeing reads of the scroll position AND the
// camera transform is the deterministic way to wait for "the canvas has
// finished reacting to what just happened" without hardcoding a duration —
// and it weakens nothing: every gesture below is still a real physical one.
async function cameraAndScroll(page: Page): Promise<string> {
  return page.evaluate(() => {
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null
    return `${window.scrollY}|${viewport?.style.transform ?? ''}`
  })
}

export async function waitForCanvasToSettle(page: Page) {
  let previous = await cameraAndScroll(page)
  let stableSamples = 0
  await expect
    .poll(
      async () => {
        await page.waitForTimeout(60)
        const current = await cameraAndScroll(page)
        stableSamples = current === previous ? stableSamples + 1 : 0
        previous = current
        return stableSamples
      },
      { timeout: 10000 },
    )
    // One equal pair can land before delayed work even starts. The canvas's
    // rail re-frame deliberately waits for two animation frames and a 50ms
    // settle task, so require a sustained quiet window that spans that whole
    // schedule on both a fast laptop and a slower CI runner.
    .toBeGreaterThanOrEqual(3)
}

// Brings the playground into the window the way a player does: real wheel
// input, one notch at a time, until the whole box (toolbar, canvas and
// status bar) is between the site's fixed navbar and the bottom of the
// window. Not `scrollIntoViewIfNeeded()` — that is the browser doing it, and
// what these specs measure is what the player can reach after doing it
// themselves. Throws rather than returning quietly if the playground never
// fits: "the player cannot get the canvas on screen at all" is a failure,
// not a reason to assert something weaker afterwards.
//
// SITE_CHROME_BOTTOM mirrors Navbar.astro's `top-3` (12px) + `h-[44px]`.
const SITE_CHROME_BOTTOM = 56

export async function scrollPlaygroundIntoView(page: Page) {
  const fits = async () =>
    page.evaluate((chrome) => {
      const box = document.querySelector('[data-testid="forja-canvas"]')?.getBoundingClientRect()
      if (!box) return false
      return box.top >= chrome && box.bottom <= window.innerHeight
    }, SITE_CHROME_BOTTOM)

  // Off the React Flow pane on purpose. React Flow's `preventScrolling`
  // default swallows a wheel over its own surface to zoom the camera
  // instead, so wheeling there would move the diagram, not the page. The
  // playground box starts at the section's own 16px padding, so x=5 is
  // always page background.
  await page.mouse.move(5, 300)
  for (let notch = 0; notch < 60 && !(await fits()); notch++) {
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(40)
  }
  await waitForCanvasToSettle(page)
  if (!(await fits())) {
    throw new Error('the playground never fitted inside the window — a player could not scroll to it either')
  }
}

export async function createNode(page: Page, type: string) {
  await page.getByTestId(`palette-item-${type}`).click()
}

export async function createNodeByKeyboard(page: Page, type: string) {
  await page.getByTestId(`palette-item-${type}`).focus()
  await page.keyboard.press('Enter')
}

// Scoped to `.react-flow__node` and matched on rendered text, not
// accessible name: an edge's aria-label ("Conexión de X a Y") can contain a
// node's label as a substring, so getByRole('group', { name }) is
// ambiguous between a node and an edge that happens to touch it.
export function nodeByLabel(page: Page, label: string | RegExp) {
  return page.locator('.react-flow__node').filter({ hasText: label }).first()
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('locator has no bounding box — is it rendered?')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Real pointer drag from a source node's right handle to a target node's
// left handle — React Flow's own connection dragging is pointer-event
// based, so raw page.mouse actions exercise the exact same path a real
// player's mouse would.
export async function connectByPointer(page: Page, source: Locator, target: Locator) {
  // Both handle positions are read only once nothing is still animating —
  // see waitForCanvasToSettle.
  await waitForCanvasToSettle(page)
  const from = await centerOf(source.locator('.react-flow__handle-right'))
  const to = await centerOf(target.locator('.react-flow__handle-left'))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

// Scoped to a specific edge by its accessible name ("Conexión de X a Y") —
// `.react-flow__edge` alone is ambiguous the moment a design has more than
// one connection, which every non-trivial exercise does. React Flow renders
// `ariaLabel` (project.ts) as a real `aria-label` attribute on the edge's
// own group element, so a plain attribute selector reaches it directly.
export function edgeByLabel(page: Page, text: string) {
  return page.locator(`.react-flow__edge[aria-label*="${text}"]`).first()
}

// Real pointer click + Delete key on a specific edge — the same gesture
// canvas.spec.ts already proves survives a re-render (B4 blocker), reused
// here as a step in a larger human-path build rather than its own subject.
// `scrollIntoViewIfNeeded` first: an exercise route's canvas sits below a
// long brief, so it can start below the fold — `page.mouse.click` (unlike
// a locator action) never auto-scrolls, and clicking a point outside the
// viewport is silently a no-op, not an error.
export async function deleteEdgeByPointer(page: Page, edge: Locator) {
  await edge.scrollIntoViewIfNeeded()
  await waitForCanvasToSettle(page)
  const point = await edgeMidpoint(edge)
  await page.mouse.click(point.x, point.y)
  await page.keyboard.press('Delete')
}

// Maps an SVG edge path's real midpoint to viewport coordinates via its
// screen CTM, so a subsequent page.mouse.click() lands ON the rendered
// curve — not on the bounding box of the whole SVG layer.
export async function edgeMidpoint(edge: Locator) {
  return edge.locator('.react-flow__edge-interaction, .react-flow__edge-path').first().evaluate((raw) => {
    const el = raw as unknown as SVGPathElement
    const svg = el.ownerSVGElement
    if (!svg) throw new Error('edge path is not inside an SVG')
    const length = el.getTotalLength()
    const point = el.getPointAtLength(length / 2)
    const screenPoint = svg.createSVGPoint()
    screenPoint.x = point.x
    screenPoint.y = point.y
    const ctm = el.getScreenCTM()
    if (!ctm) throw new Error('no screen CTM — element is not rendered')
    const mapped = screenPoint.matrixTransform(ctm)
    return { x: mapped.x, y: mapped.y }
  })
}
