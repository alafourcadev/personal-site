// "The correction loop never loses its tools" — a live defect found reviewing
// R1-E: opening the result hid the component library, so acting on a finding
// required leaving the Resultado tab first. Real click, not a visibility
// assertion alone: the library must still be USABLE (clickable, creates a
// node) while the result panel is open, and the canvas stays visible so the
// new component lands somewhere the player can see.
import { expect, test } from '@playwright/test'
import { createNode } from './helpers'

test.describe('La Forja — the correction loop keeps its tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('the component library is visible and usable while a result is shown', async ({ page }) => {
    await createNode(page, 'queue')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()

    // The finding that motivates the fix ("orphan-queue") is on screen at
    // the same time as the tool that fixes it — the whole point of the
    // requirement.
    const finding = page.locator('[data-testid^="finding-"][data-rule="orphan-queue"]')
    await expect(finding).toBeVisible()

    const library = page.getByRole('navigation', { name: 'Biblioteca de componentes' })
    await expect(library).toBeVisible()

    // Real click, not just a visibility check: the library must actually
    // still work, not just remain painted on screen.
    await createNode(page, 'worker')
    await expect(page.locator('.react-flow__node')).toHaveCount(2)

    // The canvas that just received the new node is also still visible —
    // "MUST NOT replace the workspace".
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('the canvas stays wider than both sidebars while a result is shown', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 })
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()

    const library = await page.getByRole('navigation', { name: 'Biblioteca de componentes' }).boundingBox()
    const canvas = await page.getByTestId('forja-canvas').boundingBox()
    const panel = await page.getByTestId('result-panel').boundingBox()
    expect(canvas!.width).toBeGreaterThan(library!.width)
    expect(canvas!.width).toBeGreaterThan(panel!.width)
  })
})
