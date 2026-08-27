import { expect, test, type Page } from '@playwright/test'

// The reports board is a live read of the repository's own issues, so every
// test here answers the API itself. Nothing in this file touches the network.
const API = 'https://api.github.com/repos/alafourcadev/personal-site/issues**'

type Issue = Record<string, unknown>

function issue(overrides: Issue = {}): Issue {
  return {
    number: 12,
    title: 'El lienzo se congela al arrastrar un nodo',
    html_url: 'https://github.com/alafourcadev/personal-site/issues/12',
    state: 'open',
    created_at: '2026-08-01T10:00:00Z',
    user: { login: 'unavisitante', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4' },
    ...overrides,
  }
}

async function answerApi(page: Page, body: Issue[], status = 200) {
  await page.route(API, (route) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }),
  )
}

test.describe('La Forja reports board', () => {
  test('shows every report with who filed it and where it stands', async ({ page }) => {
    await answerApi(page, [
      issue(),
      issue({
        number: 9,
        title: 'El puntaje no se guarda',
        state: 'closed',
        user: { login: 'otrapersona', avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4' },
      }),
    ])
    await page.goto('/forja/reportes')

    const reports = page.getByRole('list', { name: 'Reportes' }).getByRole('listitem')
    await expect(reports).toHaveCount(2)

    const first = reports.first()
    await expect(first.getByRole('link', { name: /El lienzo se congela/ })).toHaveAttribute(
      'href',
      'https://github.com/alafourcadev/personal-site/issues/12',
    )
    await expect(first).toContainText('unavisitante')
    await expect(first).toContainText('Abierto')
    await expect(reports.nth(1)).toContainText('Resuelto')
  })

  test('never passes off a pull request as a bug report', async ({ page }) => {
    // GitHub's issues endpoint returns pull requests too. A PR listed as
    // somebody's complaint would be a lie about what the board is showing.
    await answerApi(page, [
      issue(),
      issue({ number: 30, title: 'chore: bump deps', pull_request: { url: 'https://api.github.com/x' } }),
    ])
    await page.goto('/forja/reportes')

    await expect(page.getByRole('list', { name: 'Reportes' }).getByRole('listitem')).toHaveCount(1)
    await expect(page.getByText('chore: bump deps')).toHaveCount(0)
  })

  test('says so plainly when nobody has reported anything yet', async ({ page }) => {
    await answerApi(page, [])
    await page.goto('/forja/reportes')

    await expect(page.getByText('Todavía no hay reportes')).toBeVisible()
  })

  test('leaves a way through when GitHub does not answer', async ({ page }) => {
    await answerApi(page, [], 503)
    await page.goto('/forja/reportes')

    await expect(page.getByText('No pude traer los reportes')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Verlos en GitHub' })).toHaveAttribute(
      'href',
      /github\.com\/alafourcadev\/personal-site\/issues/,
    )
  })
})
