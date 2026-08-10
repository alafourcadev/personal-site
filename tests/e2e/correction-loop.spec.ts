// "The correction loop never loses its tools."
//
// The requirement has not changed. What changed is which mechanism keeps it.
//
// It used to be the library rail: at the widest tier the tools stayed beside
// the canvas AND the verdict, so acting on a finding never meant leaving the
// verdict first. The owner retired that arrangement. The rail now holds one
// tenant at a time, tools while you build and the verdict while you evaluate,
// on the argument that nobody does both in the same moment.
//
// What pays for that is the canvas's own context menu, which offers all 21
// components at every width and always has. So this file drives the loop the
// way a player now runs it: read the finding, right-click the canvas, add the
// component it implies is missing, without the verdict ever leaving the screen.
//
// The 300px the rail gives back is the reason it is worth doing: at 1440 the
// diagram the verdict is about went from 760px to 1060px.
import { expect, test } from '@playwright/test'
import { createNode, waitForCanvasToSettle } from './helpers'

test.describe('La Forja: the correction loop keeps its tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja/lienzo')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('a finding and the tool that answers it are on screen at the same time', async ({ page }) => {
    await createNode(page, 'queue')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()

    // The finding that motivates the fix.
    const finding = page.locator('[data-testid^="finding-"][data-rule="orphan-queue"]')
    await expect(finding).toBeVisible()

    // And the way to act on it, without closing the verdict: a real right-click
    // on the canvas, which is still beside the panel.
    await waitForCanvasToSettle(page)
    const pane = (await page.locator('.react-flow__pane').boundingBox())!
    await page.mouse.click(pane.x + pane.width / 2, pane.y + pane.height - 20, { button: 'right' })
    await expect(page.getByTestId('context-menu')).toBeVisible()

    // Not just offered: it has to work. This is the same gesture the library
    // rail used to serve, reached from the canvas instead.
    await page.getByTestId('context-menu-item-add-worker').click()
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    // And nothing was given up to do it: the verdict is still there, and so is
    // the canvas the new component landed on.
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await expect(finding).toBeVisible()
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  // The rail was worth 300px of diagram, and the diagram is what the verdict is
  // about. This is what the owner's one-tenant rule bought.
  test('the diagram keeps the rail the tools gave up, rather than the verdict taking both', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await createNode(page, 'service')
    await waitForCanvasToSettle(page)
    const building = (await page.locator('.react-flow').boundingBox())!.width

    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await waitForCanvasToSettle(page)
    const evaluating = (await page.locator('.react-flow').boundingBox())!.width

    const panel = (await page.getByTestId('result-panel').boundingBox())!
    // It pays for the verdict's own rail and nothing else, so it ends up wider
    // than the 760px the shared-rail arrangement left it at this window.
    expect(Math.round(evaluating)).toBe(Math.round(building + 300 - panel.width))
    expect(evaluating).toBeGreaterThan(760)
    expect(evaluating).toBeGreaterThan(panel.width)
  })

  // Closing it puts the player back where they were building.
  test('closing the verdict gives the rail straight back to the tools', async ({ page }) => {
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Biblioteca de componentes' })).toBeHidden()

    await page.getByTestId('close-result-panel').click()
    await expect(page.getByRole('navigation', { name: 'Biblioteca de componentes' })).toBeVisible()
    await createNode(page, 'worker')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })
})
