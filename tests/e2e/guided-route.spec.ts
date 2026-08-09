import { expect, test } from '@playwright/test'
import { STORAGE_KEY } from '../../src/lib/forja/ranking/local-adapter'

test.describe('La Forja guided route', () => {
  test('the inline first-run guide is optional and stays dismissed', async ({ page }) => {
    await page.goto('/forja/niveles')

    const guide = page.getByTestId('forja-first-run')
    await expect(guide).toBeVisible()
    await expect(page.getByTestId('forja-continue-card')).toBeVisible()
    await page.getByTestId('forja-onboarding-dismiss').click()
    await expect(guide).toBeHidden()

    await page.reload()
    await expect(guide).toBeHidden()
  })

  test('the recommendation advances to the first exercise not solved in this browser', async ({ page }) => {
    await page.goto('/forja/niveles')

    const continueLink = page.getByTestId('continue-link')
    const firstHref = await continueLink.getAttribute('href')
    expect(firstHref).toMatch(/^\/forja\/1\/[a-z0-9-]+$/)
    const exerciseId = firstHref!.split('/').at(-1)!

    await page.evaluate(
      ({ key, id }) => {
        localStorage.setItem(
          key,
          JSON.stringify([
            {
              id: 'guided-route-seed',
              exerciseId: id,
              design: { nodes: [], edges: [] },
              score: 100,
              ceiling: 100,
              engineVersion: 'test',
              createdAt: new Date().toISOString(),
            },
          ]),
        )
      },
      { key: STORAGE_KEY, id: exerciseId },
    )
    await page.reload()

    await expect(continueLink).toHaveText('Continuar')
    await expect(continueLink).not.toHaveAttribute('href', firstHref!)
    await expect(page.getByTestId('forja-first-run')).toBeHidden()
  })

  test('experienced users can reach four real calibration checkpoints', async ({ page }) => {
    await page.goto('/forja/niveles')
    await page.getByTestId('placement-test-link').click()

    await expect(page).toHaveURL(/\/forja\/ubicacion$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Prueba de ubicación' })).toBeVisible()
    await expect(page.getByTestId('placement-checkpoint')).toHaveCount(4)
    await expect(page.getByTestId('placement-checkpoint-link')).toHaveCount(4)
  })
})
