// The owner's rule, in his own words: "veo que el lienzo se expande hasta que
// no se ven las divisiones, me gustaría que tuviera un tamaño que no deje que
// se escondan".
//
// The three bands are the model this product teaches, and a piece's band is
// where the player reads which layer it belongs to. So no camera state may put
// a band division outside the pane: not by zooming, not by dragging, not by
// re-framing, and not on arrival.
//
// Measured on a production build before this shipped, at 1133 with the
// statement open: four presses of the zoom-in control settled on zoom 1.653
// with the three dividers at 43, 638 and 1233 inside an 833px pane. On the
// blank canvas of `n1-el-taller-que-todavia-anota-en-papel` the camera never
// framed anything at all and sat at zoom 1 with the third divider at 1080,
// also outside 833.
//
// The geometry itself is proven in tests/canvas/band-camera.test.ts. This is
// the browser half: real wheels, real drags, real clicks.
import { expect, test, type Page } from '@playwright/test'
import { BANDS_TOTAL_WIDTH } from '../../src/lib/forja/canvas/band-camera'
import { RAIL_STORAGE_KEYS } from '../../src/lib/forja/canvas/rail-visibility'
import { waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'
// The `greenfield` role: it opens blank on purpose, which is the state React
// Flow's own `fitView` could never frame.
const BLANK_EXERCISE = '/forja/1/n1-el-taller-que-todavia-anota-en-papel'

// The right edge of each of the three lanes, in the pane's own coordinates.
// BandLane.tsx draws them as three divs with a right border, so their right
// edges ARE the three divisions the player sees.
async function divisions(page: Page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow')!.getBoundingClientRect()
    const lanes = [...document.querySelectorAll('[data-testid="band-lanes"] > div > div')].map((lane) =>
      Math.round(lane.getBoundingClientRect().right - pane.left),
    )
    return { lanes, paneWidth: Math.round(pane.width), inside: lanes.every((x) => x >= 0 && x <= Math.round(pane.width)) }
  })
}

async function nodesAreInside(page: Page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow')!.getBoundingClientRect()
    return [...document.querySelectorAll('.react-flow__node')].every((node) => {
      const box = node.getBoundingClientRect()
      return box.left >= pane.left - 0.5 && box.right <= pane.right + 0.5
    })
  })
}

async function open(page: Page, url: string, waitForANode: boolean) {
  await page.goto(url)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  if (waitForANode) await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await waitForCanvasToSettle(page)
}

// Presses the zoom-in control until React Flow disables it, which it does at
// the maximum the bands impose. Ten presses is a ceiling on the loop, not the
// expected number: the control disabling itself is the honest end of the
// gesture, and a player holding the button down reaches exactly this state.
async function zoomInAsFarAsItGoes(page: Page) {
  const zoomIn = page.locator('.react-flow__controls-zoomin')
  for (let press = 0; press < 10 && (await zoomIn.isEnabled()); press++) {
    await zoomIn.click()
    await page.waitForTimeout(120)
  }
  await expect(zoomIn).toBeDisabled()
  await waitForCanvasToSettle(page)
}

// A point on the pane's own surface, never on a node and never under the
// objective card, so a drag pans the camera instead of moving a piece.
async function emptyPanePoint(page: Page) {
  const box = (await page.locator('.react-flow__pane').boundingBox())!
  for (const fx of [0.95, 0.9, 0.8]) {
    for (const fy of [0.95, 0.9, 0.85, 0.8]) {
      const x = box.x + box.width * fx
      const y = box.y + box.height * fy
      const onPane = await page.evaluate(
        ([px, py]) => document.elementFromPoint(px, py)?.classList.contains('react-flow__pane') ?? false,
        [x, y],
      )
      if (onPane) return { x, y }
    }
  }
  throw new Error('no empty pane surface to drag from')
}

test.describe('La Forja: the three band divisions can never be hidden', () => {
  test('every division is inside the pane the moment an exercise opens', async ({ page }) => {
    await open(page, EXERCISE, true)

    const { lanes, inside, paneWidth } = await divisions(page)
    expect(lanes).toHaveLength(3)
    expect(inside, `dividers at ${lanes.join(', ')} inside a ${paneWidth}px pane`).toBe(true)
  })

  // The state that had no camera at all before this: nothing to fit, so
  // nothing was fitted.
  test('every division is inside the pane on a canvas that opens blank', async ({ page }) => {
    await page.setViewportSize({ width: 1133, height: 900 })
    await open(page, BLANK_EXERCISE, false)
    await expect(page.locator('.react-flow__node')).toHaveCount(0)

    const { lanes, inside, paneWidth } = await divisions(page)
    expect(inside, `dividers at ${lanes.join(', ')} inside a ${paneWidth}px pane`).toBe(true)
  })

  test('zooming in as far as the control allows never pushes one out', async ({ page }) => {
    await page.setViewportSize({ width: 1133, height: 900 })
    await open(page, EXERCISE, true)

    await zoomInAsFarAsItGoes(page)

    const { lanes, inside, paneWidth } = await divisions(page)
    expect(inside, `dividers at ${lanes.join(', ')} inside a ${paneWidth}px pane`).toBe(true)
  })

  test('the whole strip still fits across the pane at the tightest zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1133, height: 900 })
    await open(page, EXERCISE, true)

    await zoomInAsFarAsItGoes(page)

    const { paneWidth } = await divisions(page)
    const zoom = await page.evaluate(
      () => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.react-flow__viewport')!).transform).a,
    )
    expect(paneWidth / zoom).toBeGreaterThanOrEqual(BANDS_TOTAL_WIDTH - 1)
  })

  test('dragging the canvas as far as it goes never pushes one out', async ({ page }) => {
    await open(page, EXERCISE, true)
    const from = await emptyPanePoint(page)

    for (const dx of [-1600, 1600, 2400]) {
      await page.mouse.move(from.x, from.y)
      await page.mouse.down()
      await page.mouse.move(from.x + dx, from.y, { steps: 20 })
      await page.mouse.up()
      await waitForCanvasToSettle(page)

      const { lanes, inside, paneWidth } = await divisions(page)
      expect(inside, `after dragging ${dx}px: dividers at ${lanes.join(', ')} inside a ${paneWidth}px pane`).toBe(true)
    }
  })

  test('pressing “encuadrar” never pushes one out', async ({ page }) => {
    await open(page, EXERCISE, true)

    await page.locator('.react-flow__controls-fitview').click()
    await waitForCanvasToSettle(page)

    const { lanes, inside, paneWidth } = await divisions(page)
    expect(inside, `dividers at ${lanes.join(', ')} inside a ${paneWidth}px pane`).toBe(true)
  })

  // The pane changes width for three reasons and the camera has to answer each
  // one. A rail folding is the one that does not resize the playground, so it
  // is the one a resize observer alone would miss.
  test('folding both rails re-frames without pushing one out', async ({ page }) => {
    await page.addInitScript((keys) => {
      window.localStorage.setItem(keys.statement, '1')
      window.localStorage.setItem(keys.tools, '1')
    }, RAIL_STORAGE_KEYS)
    await open(page, EXERCISE, true)

    const { lanes, inside, paneWidth } = await divisions(page)
    expect(inside, `dividers at ${lanes.join(', ')} inside a ${paneWidth}px pane`).toBe(true)
  })

  test('reopening both rails quickly never restores a camera from the wider pane', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await open(page, EXERCISE, true)

    await page.getByTestId('statement-toggle').click()
    await page.getByTestId('tools-pleca').click()
    await page.getByTestId('statement-toggle').click()
    await page.getByTestId('tools-pleca').click()
    await waitForCanvasToSettle(page)

    const { lanes, inside, paneWidth } = await divisions(page)
    expect(inside, `dividers at ${lanes.join(', ')} inside a ${paneWidth}px pane`).toBe(true)
    expect(await nodesAreInside(page), 'every node is framed inside the restored pane').toBe(true)
  })

  test('the camera names the same control in the player’s own language', async ({ page }) => {
    await open(page, EXERCISE, true)

    await expect(page.locator('.react-flow__controls-fitview')).toHaveAttribute('aria-label', 'Encuadrar el diagrama')
  })
})
