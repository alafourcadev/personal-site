import { expect, test } from '@playwright/test'

// La Forja just shipped. Until it settles, the only way to learn what breaks is
// to ask the people it breaks for. This notice is that ask: it appears once,
// hands over two ways to report, and then gets out of the way for good.
test.describe('La Forja feedback notice', () => {
  test('asks a first-time visitor to report anything broken', async ({ page }) => {
    await page.goto('/forja')

    const notice = page.getByRole('dialog', { name: 'La Forja acaba de salir' })
    await expect(notice).toBeVisible()

    const report = notice.getByRole('link', { name: 'Reportar algo roto' })
    await expect(report).toHaveAttribute(
      'href',
      /^https:\/\/github\.com\/alafourcadev\/personal-site\/issues\/new\?/,
    )

    await expect(notice.getByRole('link', { name: 'escribirme por mail' })).toHaveAttribute(
      'href',
      /^mailto:alafourcadev@gmail\.com\?/,
    )

    // Not everyone has something to say the moment they arrive. Seeing what
    // others already reported is the other half of the ask.
    await expect(notice.getByRole('link', { name: 'Ver lo ya reportado' })).toHaveAttribute(
      'href',
      '/forja/reportes',
    )
  })

  test('carries the page it was opened from into the report', async ({ page }) => {
    await page.goto('/forja/lienzo')

    const report = page
      .getByRole('dialog', { name: 'La Forja acaba de salir' })
      .getByRole('link', { name: 'Reportar algo roto' })

    const href = await report.getAttribute('href')
    expect(decodeURIComponent(href ?? '')).toContain('/forja/lienzo')
  })

  test('stops asking someone who already went off to report', async ({ page }) => {
    await page.goto('/forja')

    const notice = page.getByRole('dialog', { name: 'La Forja acaba de salir' })
    await notice.getByRole('link', { name: 'Reportar algo roto' }).click()

    // The report opens in its own tab, so this page stays put. Coming back to a
    // notice still demanding a report is the rudest thing it could do to the
    // one visitor who actually answered it.
    await expect(notice).toBeHidden()
    await page.goto('/forja')
    await expect(page.getByRole('dialog', { name: 'La Forja acaba de salir' })).toBeHidden()
  })

  test('never comes back once it has been dismissed', async ({ page }) => {
    await page.goto('/forja')

    const notice = page.getByRole('dialog', { name: 'La Forja acaba de salir' })
    await notice.getByRole('button', { name: 'Entendido' }).click()
    await expect(notice).toBeHidden()

    // The dialog still ships with every page under /forja; what must not happen
    // again is the visitor being interrupted by it.
    await page.goto('/forja/lienzo')
    await expect(page.getByRole('dialog', { name: 'La Forja acaba de salir' })).toBeHidden()
  })

  test('does not stand on the reports board it points at', async ({ page }) => {
    // Someone reading the board is already past being told they can report.
    // Covering it with the ask would hide the answer to the ask.
    await page.goto('/forja/reportes')

    await expect(page.getByRole('dialog', { name: 'La Forja acaba de salir' })).toHaveCount(0)
  })

  test('stops asking someone who left to read the board', async ({ page }) => {
    await page.goto('/forja')

    await page
      .getByRole('dialog', { name: 'La Forja acaba de salir' })
      .getByRole('link', { name: 'Ver lo ya reportado' })
      .click()
    await expect(page).toHaveURL(/\/forja\/reportes$/)

    await page.goto('/forja')
    await expect(page.getByRole('dialog', { name: 'La Forja acaba de salir' })).toBeHidden()
  })

  test('stays out of the way outside La Forja', async ({ page }) => {
    await page.goto('/blog')

    await expect(page.getByRole('dialog', { name: 'La Forja acaba de salir' })).toHaveCount(0)
  })
})
