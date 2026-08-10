import { expect, test } from '@playwright/test'
import { PLAYABLE_MIN_PX } from '../../src/lib/forja/canvas/forja-shell'

test.describe('La Forja: lienzo libre responsive', () => {
  test('a phone gets an honest reading route instead of a broken graph editor', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/forja/lienzo')

    await expect(page.getByText('El editor necesita una pantalla de al menos 768 px')).toBeVisible()
    await expect(page.getByTestId('forja-canvas')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Ver los 12 niveles' })).toBeVisible()
  })

  test('the exact playable breakpoint keeps the free canvas available', async ({ page }) => {
    await page.setViewportSize({ width: PLAYABLE_MIN_PX, height: 900 })
    await page.goto('/forja/lienzo')

    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await expect(page.getByText('El editor necesita una pantalla de al menos 768 px')).toBeHidden()
  })
})
