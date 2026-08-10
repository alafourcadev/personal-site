import { expect, test } from '@playwright/test'

test.describe('La Forja product landing', () => {
  test('opens as its own product room with a real path into the first challenge', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/forja')

    await expect(page.getByRole('heading', { level: 1, name: 'No estudies arquitectura. Tomá decisiones.' })).toBeVisible()
    await expect(page.locator('.authorship')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Volver a la publicación' })).toHaveAttribute('href', '/')
    await expect(page.getByRole('link', { name: 'Empezar el primer desafío' })).toHaveAttribute(
      'href',
      /^\/forja\/1\/n1-/,
    )
    await expect(page.getByRole('link', { name: 'Ver cómo funciona' })).toHaveAttribute('href', '#como-funciona')
    await expect(page.getByLabel('Vista previa de una decisión dentro de La Forja')).toBeVisible()
    await expect(page.getByLabel('Cómo funciona La Forja').getByRole('listitem')).toHaveCount(3)
    const productTour = page.getByRole('region', { name: 'Así se trabaja en La Forja.' })
    await expect(productTour.getByRole('img')).toHaveCount(3)
    await expect(productTour.getByAltText(/puntaje de 50 sobre 100/)).toBeVisible()
    await expect(page.getByTestId('forja-canvas')).toHaveCount(0)
    await page.screenshot({ path: 'test-results/forja-landing-desktop.png', fullPage: false })
  })

  test('gives phones an honest, readable handoff without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/forja')

    await expect(page.locator('.mobile-authorship')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Empezar el primer desafío' })).toBeVisible()
    await expect(page.locator('.access-note')).toContainText('se juega en escritorio')
    await expect(page.getByTestId('forja-canvas')).toHaveCount(0)

    const widths = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }))
    expect(widths.document).toBeLessThanOrEqual(widths.viewport)
    await page.screenshot({ path: 'test-results/forja-landing-mobile.png', fullPage: false })
  })

  test('keeps the light theme deliberate and usable', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'light'))
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/forja')

    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cambiar tema' })).toBeVisible()
  })
})
