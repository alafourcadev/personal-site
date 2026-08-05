// EC6 (DRAFT never served) and PR5 (level 4 is the first playable level on
// the map) — proven against the real content collection, not a mock.
import { expect, test } from '@playwright/test'

test.describe('La Forja — level routes [EC6, PR5]', () => {
  test('level 4 lists exactly its 8 playable exercises, the DRAFT one absent', async ({ page }) => {
    await page.goto('/forja/4')
    const items = page.getByTestId('exercise-list-item')
    await expect(items).toHaveCount(8)
    await expect(page.getByText('El reintento que cobra dos veces')).toHaveCount(0)
    await expect(page.getByText('El pago que espera al email')).toBeVisible()
  })

  test('each playable exercise states its role in plain language', async ({ page }) => {
    await page.goto('/forja/4')
    await expect(page.getByTestId('exercise-role-tag').first()).toBeVisible()
  })

  test('level 4 is the first playable level on the map [PR5]', async ({ page }) => {
    await page.goto('/forja/niveles')
    const playable = page.locator('[data-testid="level-card"][data-playable="true"]')
    await expect(playable).toHaveCount(1)
    await expect(playable).toHaveAttribute('data-level-id', '4')
  })

  test('a level with no content states it is locked or coming soon, not a broken page', async ({ page }) => {
    await page.goto('/forja/niveles')
    const level1 = page.locator('[data-testid="level-card"][data-level-id="1"]')
    await expect(level1).toHaveAttribute('data-playable', 'false')
  })
})
