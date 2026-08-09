// The player asked for it in these words: "me gustaría que la descripción del
// ejercicio se pueda esconder para que exista más espacio para el panel".
//
// The control has two geometric jobs. In the wide three-column workbench it
// returns the statement surface to the canvas. In compact mode it folds the
// overlay to a facts strip. Both states keep one reachable control and reframe
// the diagram for the room the gesture released.
import { expect, test, type Page } from '@playwright/test'
import {
  CANVAS_WORKSPACE_MIN_PX,
  RAIL_PLECA_WIDTH_PX,
} from '../../src/lib/forja/canvas/responsive-layout'
import {
  STATEMENT_RAIL_WIDTH_PX,
  WIDE_WORKBENCH_MIN_PX,
  briefCardIsBesideCanvas,
  workbenchCanvasWidth,
  workspaceCanvasWidth,
} from '../../src/lib/forja/canvas/forja-shell'
import { STATEMENT_COLLAPSED_STORAGE_KEY } from '../../src/lib/forja/canvas/statement-visibility'
import { waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'
const ANOTHER_EXERCISE = '/forja/1/n1-la-consulta-que-saltea-la-puerta'

async function openExercise(page: Page, url = EXERCISE) {
  await page.goto(url)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await waitForCanvasToSettle(page)
}

// The React Flow pane itself, not the playground box around it: the box keeps
// its size while the pane inside it goes to zero, which is how the verdict
// defect passed a `toBeVisible()` assertion.
async function canvas(page: Page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow')
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement | null
    const box = pane?.getBoundingClientRect()
    return {
      width: box ? Math.round(box.width) : 0,
      zoom: viewport ? new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a : 0,
    }
  })
}

// How many pieces of the diagram the objective is standing on.
async function nodesUnderTheCard(page: Page): Promise<number> {
  return page.evaluate(() => {
    const card = document.querySelector('[data-testid="exercise-brief"]')!.getBoundingClientRect()
    let covered = 0
    for (const node of document.querySelectorAll('.react-flow__node')) {
      const box = node.getBoundingClientRect()
      if (box.left < card.right && box.right > card.left && box.top < card.bottom && box.bottom > card.top) covered += 1
    }
    return covered
  })
}

test.describe('La Forja: folding the objective gives the canvas its room', () => {
  test('the canvas is already a workspace with the objective open, and folding gives the camera more room', async ({
    page,
  }) => {
    // The default viewport (playwright.config.ts) is 1440x900, where the
    // statement is a real column beside the canvas.
    expect(1440).toBeGreaterThanOrEqual(WIDE_WORKBENCH_MIN_PX)
    expect(workbenchCanvasWidth(1440)).toBeGreaterThanOrEqual(CANVAS_WORKSPACE_MIN_PX)
    await openExercise(page)
    const before = await canvas(page)
    expect(before.width, 'the canvas clears its workspace floor with the objective open').toBeGreaterThanOrEqual(
      CANVAS_WORKSPACE_MIN_PX,
    )
    expect(await nodesUnderTheCard(page), 'the open card stands on no piece of the diagram').toBe(0)

    await page.getByTestId('statement-toggle').click()
    await waitForCanvasToSettle(page)
    const after = await canvas(page)

    expect(after.width - before.width, 'the pane receives the statement surface').toBe(
      STATEMENT_RAIL_WIDTH_PX - RAIL_PLECA_WIDTH_PX,
    )
    expect(after.zoom, 'the diagram was re-framed for the room the fold released').toBeGreaterThan(before.zoom)

    const nodes = page.locator('.react-flow__node')
    const pane = (await page.locator('.react-flow').boundingBox())!
    for (let i = 0; i < (await nodes.count()); i++) {
      const box = (await nodes.nth(i).boundingBox())!
      expect(box.x, 'node left is inside the pane').toBeGreaterThanOrEqual(pane.x - 0.5)
      expect(box.x + box.width, 'node right is inside the pane').toBeLessThanOrEqual(pane.x + pane.width + 0.5)
    }
  })

  test('the whole statement clears the wide canvas and returns with the same control', async ({ page }) => {
    await openExercise(page)
    const toggle = page.getByTestId('statement-toggle')
    await toggle.click()

    await expect(page.getByTestId('exercise-budget')).toBeHidden()
    await expect(page.getByTestId('exercise-body')).toBeHidden()
    await expect(toggle).toBeInViewport()

    await toggle.click()
    await expect(page.getByTestId('exercise-budget')).toBeVisible()
    await expect(page.getByTestId('exercise-body')).toBeVisible()
  })

  test('reopening is the same control in the same place, and it brings the narrative back', async ({ page }) => {
    await openExercise(page)
    const toggle = page.getByTestId('statement-toggle')
    await toggle.click()
    await expect(toggle).toContainText('Ver consigna')
    await expect(toggle, 'the way back is on screen, not hidden with what it folded').toBeInViewport()
    await toggle.click()
    await expect(toggle).toContainText('Ocultar consigna')
    await expect(page.getByTestId('exercise-body')).toBeVisible()
  })

  // This playground can already be finished without a mouse. Folding the
  // statement must not be the one gesture that needs one.
  test('a keyboard reaches it, and it announces its own state', async ({ page }) => {
    await openExercise(page)
    const toggle = page.getByTestId('statement-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const controls = (await toggle.getAttribute('aria-controls'))!
    await expect(page.locator(`#${controls}`)).toBeVisible()

    await toggle.focus()
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator(`#${controls}`)).toBeHidden()
    await expect(toggle, 'focus stays on the control that did it').toBeFocused()
  })

  // Someone who prefers a wide canvas prefers it on the next exercise too.
  test('the choice survives moving to another exercise', async ({ page }) => {
    await openExercise(page)
    await page.getByTestId('statement-toggle').click()
    expect(await page.evaluate((key) => localStorage.getItem(key), STATEMENT_COLLAPSED_STORAGE_KEY)).toBe('1')

    await openExercise(page, ANOTHER_EXERCISE)
    await expect(page.getByTestId('exercise-body')).toBeHidden()
    await expect(page.getByTestId('statement-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect((await canvas(page)).width).toBeGreaterThanOrEqual(CANVAS_WORKSPACE_MIN_PX)
  })

  test('it is not sticky in the wrong direction: reopening is remembered too', async ({ page }) => {
    await openExercise(page)
    await page.getByTestId('statement-toggle').click()
    await page.getByTestId('statement-toggle').click()

    await openExercise(page, ANOTHER_EXERCISE)
    await expect(page.getByTestId('exercise-body')).toBeVisible()
  })

  // 1133px is the width the previous layout shipped a 299px canvas at, and it
  // is under the width where the camera can afford to clear the card. Here the
  // card overlays on purpose (clearing it was measured to give a 385px diagram
  // with 5.36px node titles), so what the fold buys is the diagram back.
  test('at 1133x800, where the card overlays, folding uncovers the diagram', async ({ page }) => {
    expect(briefCardIsBesideCanvas(workspaceCanvasWidth(1133))).toBe(false)
    await page.setViewportSize({ width: 1133, height: 800 })
    await openExercise(page)

    expect((await canvas(page)).width, 'the canvas is a workspace even here').toBeGreaterThanOrEqual(
      CANVAS_WORKSPACE_MIN_PX,
    )
    expect(await nodesUnderTheCard(page), 'the open card stands on part of the diagram at this width').toBeGreaterThan(0)

    await page.getByTestId('statement-toggle').click()
    await waitForCanvasToSettle(page)

    expect(await nodesUnderTheCard(page), 'folded, it stands on nothing').toBe(0)
    await expect(page.getByTestId('exercise-budget')).toBeVisible()
  })
})
