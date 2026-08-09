// The verdict arrives and covers the diagram it is talking about.
//
// Measured against a production build on
// `/forja/1/n1-el-comprobante-que-no-se-guarda`, before this spec existed:
// pressing "Probar respuesta" opens a 380px rail, the diagram's pane drops
// from 1140px to 760px at 1440, and 760 is below the width where the camera
// can afford to keep the objective card's 432px footprint clear
// (forja-shell.ts). So the camera stops reserving room and the open card
// simply stands on the pane: 57% of it at 1133 and at 1440, 52% at 1512, the
// three commonest laptop widths.
//
// It happens at the exact moment every finding in that verdict is a button
// that highlights a node in the part that is covered.
//
// What this spec pins is the fix and its two costs. The objective folds to its
// strip when a verdict arrives, the player gets it back with the same one
// control in the same place, and the choice they had stored is not rewritten
// behind their back.
import { expect, test, type Page } from '@playwright/test'
import { RAIL_PLECA_WIDTH_PX } from '../../src/lib/forja/canvas/responsive-layout'
import { STATEMENT_RAIL_WIDTH_PX } from '../../src/lib/forja/canvas/forja-shell'
import { STATEMENT_COLLAPSED_STORAGE_KEY } from '../../src/lib/forja/canvas/statement-visibility'
import { waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'

// The three laptops the defect was measured on. All three leave a pane the
// camera cannot clear the card in, which is what makes the fold necessary
// rather than tidy.
const LAPTOPS = [
  { width: 1133, height: 800 },
  { width: 1440, height: 900 },
  { width: 1512, height: 900 },
] as const

async function openExercise(page: Page) {
  await page.goto(EXERCISE)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await waitForCanvasToSettle(page)
}

// How much of the diagram's pane the objective is standing on. Read from real
// rendered boxes: the whole finding is that the two elements overlap on
// screen, and only the browser knows that.
//
// Two numbers because they answer two questions. `width` is the column of the
// pane the card takes, which is what forja-shell.ts's own arithmetic predicts
// (432px of the 760px the verdict leaves at 1440). `area` is what the player
// actually loses, which is smaller because the card is not as tall as the pane.
async function paneCoveredByStatement(page: Page): Promise<{ width: number; area: number }> {
  return page.evaluate(() => {
    const pane = document.querySelector('.react-flow')!.getBoundingClientRect()
    const card = document.querySelector('[data-testid="exercise-brief"]')!.getBoundingClientRect()
    const overlapWidth = Math.max(0, Math.min(pane.right, card.right) - Math.max(pane.left, card.left))
    const overlapHeight = Math.max(0, Math.min(pane.bottom, card.bottom) - Math.max(pane.top, card.top))
    return {
      width: overlapWidth / pane.width,
      area: (overlapWidth * overlapHeight) / (pane.width * pane.height),
    }
  })
}

// How many pieces of the diagram the objective is standing on. The fraction
// above is the size of the problem; this is the thing the player actually
// loses, because a finding points at a node.
async function nodesUnderTheStatement(page: Page): Promise<number> {
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

test.describe('La Forja: the verdict never covers the diagram it is about', () => {
  for (const { width, height } of LAPTOPS) {
    test(`at ${width}x${height} the objective stops standing on the design when the verdict opens`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await openExercise(page)

      await page.getByTestId('submit-button').click()
      await expect(page.getByTestId('result-panel')).toBeVisible()
      await waitForCanvasToSettle(page)

      // The strip is 40px along the pane's top edge, and the camera keeps that
      // much clear. On the shortest of these panes that is under a tenth of it.
      const covered = await paneCoveredByStatement(page)
      expect(
        covered.area,
        `the objective stands on ${Math.round(covered.area * 100)}% of the pane at ${width}px`,
      ).toBeLessThan(0.1)
      expect(await nodesUnderTheStatement(page), `pieces of the design under the objective at ${width}px`).toBe(0)

      // Not merely uncovered: the finding's own target has to be on screen.
      const node = page.locator('.react-flow__node').first()
      await expect(node).toBeVisible()
      await expect(node).toBeInViewport()
    })
  }

  test('at 1440x900 reopening the statement pays for a real column and never covers the verdict’s diagram', async ({
    page,
  }) => {
    await openExercise(page)
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await waitForCanvasToSettle(page)
    const foldedWidth = await page.evaluate(
      () => document.querySelector('.react-flow')!.getBoundingClientRect().width,
    )

    await page.getByTestId('statement-toggle').click()
    await waitForCanvasToSettle(page)

    const openWidth = await page.evaluate(
      () => document.querySelector('.react-flow')!.getBoundingClientRect().width,
    )
    const covered = await paneCoveredByStatement(page)
    expect(covered.width, 'the statement is beside the pane, not over it').toBe(0)
    expect(foldedWidth - openWidth, 'the real column has one source of width').toBe(
      STATEMENT_RAIL_WIDTH_PX - RAIL_PLECA_WIDTH_PX,
    )
  })

  // The cost of folding, and the promise that pays for it: the way back is the
  // same control in the same place, and it takes one press, not two.
  test('the way back is one click on the control that is still on screen', async ({ page }) => {
    await openExercise(page)
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()

    const toggle = page.getByTestId('statement-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeInViewport()
    await expect(toggle).toContainText('Ver consigna')
    await expect(toggle, 'the control agrees with what is on screen').toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('exercise-budget')).toBeHidden()

    await toggle.click()
    await expect(page.getByTestId('exercise-body')).toBeVisible()
    await expect(page.getByTestId('exercise-budget')).toBeVisible()
    await expect(toggle).toContainText('Ocultar consigna')
  })

  // The fold is a view change, not a decision the player made. Someone who
  // never chose anything must not find their next exercise folded because a
  // verdict once arrived.
  test('it does not write the player’s stored choice', async ({ page }) => {
    await openExercise(page)
    expect(await page.evaluate((key) => localStorage.getItem(key), STATEMENT_COLLAPSED_STORAGE_KEY)).toBeNull()

    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await expect(page.getByTestId('exercise-body')).toBeHidden()

    expect(
      await page.evaluate((key) => localStorage.getItem(key), STATEMENT_COLLAPSED_STORAGE_KEY),
      'the verdict folded the view, not the preference',
    ).toBeNull()
  })

  // And the reverse: a player who did choose keeps the choice. Reopening after
  // the verdict is a real decision and is remembered as one.
  test('reopening after the verdict is remembered, because that one is a choice', async ({ page }) => {
    await openExercise(page)
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()

    await page.getByTestId('statement-toggle').click()
    expect(await page.evaluate((key) => localStorage.getItem(key), STATEMENT_COLLAPSED_STORAGE_KEY)).toBe('0')
  })
})
