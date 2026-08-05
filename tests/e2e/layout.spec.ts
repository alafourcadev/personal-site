// "The playground uses the full viewport width" (added late by the owner
// after seeing ~800px of dead margin at ~2000px on the site's shared
// max-w-[1440px] article container). Real bounding boxes at real
// viewports — the orchestrator's own instruction, since a CSS read alone
// cannot prove an ancestor isn't silently re-capping the width.
import { expect, test } from '@playwright/test'

test.describe('La Forja — playground uses the full viewport width', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  for (const width of [1440, 1920, 2560]) {
    test(`no dead margin at ${width}px — the playground spans the viewport minus its gutter`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      const section = page.locator('section').first()
      const box = await section.boundingBox()
      // The gutter is the section's own horizontal padding (px-4/md:px-6),
      // not dead margin outside it — the section's OUTER box (padding
      // included) must equal the full viewport width.
      expect(box!.width).toBeCloseTo(width, 0)
      expect(box!.x).toBeCloseTo(0, 0)
    })

    test(`the canvas is wider than the library at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      const library = await page.getByRole('navigation', { name: 'Biblioteca de componentes' }).boundingBox()
      const canvas = await page.getByTestId('forja-canvas').boundingBox()
      expect(canvas!.width).toBeGreaterThan(library!.width)
    })
  }

  test('the canvas is wider than the result side panel', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 })
    await page.getByTestId('view-result-tab').click()
    const canvas = await page.getByTestId('forja-canvas').boundingBox()
    const panel = await page.getByTestId('result-panel').boundingBox()
    expect(canvas!.width).toBeGreaterThan(panel!.width)
  })

  test('surplus width from 1440 to 2560 goes mostly to the canvas, not the sidebars', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const canvasAt1440 = (await page.getByTestId('forja-canvas').boundingBox())!.width
    const libraryAt1440 = (await page.getByRole('navigation', { name: 'Biblioteca de componentes' }).boundingBox())!.width

    await page.setViewportSize({ width: 2560, height: 1000 })
    const canvasAt2560 = (await page.getByTestId('forja-canvas').boundingBox())!.width
    const libraryAt2560 = (await page.getByRole('navigation', { name: 'Biblioteca de componentes' }).boundingBox())!.width

    const addedWidth = 2560 - 1440
    const canvasGrowth = canvasAt2560 - canvasAt1440
    // The library must not grow at all (fixed width per spec's "MAY have a
    // maximum width"); the canvas must absorb the clear majority of the
    // added 1120px.
    expect(libraryAt2560).toBeCloseTo(libraryAt1440, 0)
    expect(canvasGrowth).toBeGreaterThan(addedWidth * 0.8)
  })
})
