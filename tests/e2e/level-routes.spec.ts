// EC6 (DRAFT never served) and PR5 (level 4 is the first playable level on
// the map) — proven against the real content collection, not a mock.
import { expect, test } from '@playwright/test'

test.describe('La Forja — level routes [EC6, PR5]', () => {
  test('level 4 lists its playable exercises, the DRAFT one absent', async ({ page }) => {
    await page.goto('/forja/4')
    // Not a hardcoded count: the level keeps gaining exercises, and what EC6
    // guarantees is that a DRAFT is never among them, not that there are N.
    expect(await page.getByTestId('exercise-list-item').count()).toBeGreaterThan(0)
    await expect(page.getByText('El reintento que cobra dos veces')).toHaveCount(0)
    await expect(page.getByText('El pago que espera al email')).toBeVisible()
  })

  // Replaces "each playable exercise states its role in plain language". It
  // did, and that was the defect: the list announced "Trampa" and
  // "Contra-trampa" above the title, telling the player the obvious answer is
  // the wrong one before they read the brief.
  test('the list never announces which exercise is the trap', async ({ page }) => {
    await page.goto('/forja/4')
    const list = page.getByTestId('exercise-list')
    await expect(list).not.toContainText('Trampa')
    await expect(list).not.toContainText('Contra-trampa')
  })

  test('the list marks what the player already solved, and its best score', async ({ page }) => {
    // No `addInitScript(() => localStorage.clear())`. It runs before every
    // page script on EVERY navigation, including the reload below — so it
    // wiped the attempt this test seeds a line earlier, and the mark could
    // never appear. Playwright already gives each test its own browser
    // context, so storage starts empty without any help.
    await page.goto('/forja/4')
    // Nothing played yet: no mark, and the header claims no progress. The
    // copy is the level's own size plus an explicit "none solved yet" —
    // asserted here as the property it protects, not as the sentence it was
    // worded with before progress existed. The negative half is the one that
    // matters: a hollow "0 de 14" is indistinguishable from a page that has
    // not finished reading localStorage, so the header must never print it.
    await expect(page.getByTestId('exercise-solved').first()).toBeHidden()
    await expect(page.getByTestId('level-progress')).toContainText('todavía ninguno resuelto')
    await expect(page.getByTestId('level-progress')).not.toContainText('0 de')

    const exerciseId = await page.getByTestId('exercise-list-item').first().getAttribute('data-exercise-id')
    // Seeded through the same storage key the app itself reads and writes.
    await page.evaluate((id) => {
      localStorage.setItem(
        'forja:attempts:v1',
        JSON.stringify([
          {
            id: 'seeded',
            exerciseId: id,
            design: { nodes: [], edges: [] },
            score: 100,
            ceiling: 100,
            engineVersion: 'test',
            createdAt: new Date().toISOString(),
          },
        ]),
      )
    }, exerciseId)
    await page.reload()

    await expect(page.getByTestId('exercise-solved').first()).toContainText('100')
    await expect(page.getByTestId('level-progress')).toContainText('1 de')
  })

  // R1-G requirement 1: "desde la lista de ejercicios del nivel se tiene
  // que poder entrar a uno" — every list entry must be a real link into its
  // own play route, not just a static card.
  test('every exercise in the list links to its own play route', async ({ page }) => {
    await page.goto('/forja/4')
    const items = page.getByTestId('exercise-list-item')
    const links = page.getByTestId('exercise-list-link')
    // Not a hardcoded count — the level keeps gaining exercises (it was 8,
    // it is 14). What R1-G requires is that EVERY listed exercise is
    // enterable, so the count is read from the list itself: an entry that
    // renders without its link now fails, at whatever size the level grows
    // to, which a literal number could never catch.
    const listed = await items.count()
    expect(listed, 'the level lists at least one exercise').toBeGreaterThan(0)
    await expect(links).toHaveCount(listed)
    for (const href of await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')))) {
      expect(href).toMatch(/^\/forja\/4\/[a-z0-9-]+$/)
    }
  })

  // Was "level 4 is the first playable level on the map" — true only while
  // level 4 was the only level with content. What PR5 actually requires is
  // that the map is driven by content, so a card either enters its level or
  // says why it cannot.
  test('every level card either links into its level or says it has nothing published [PR5]', async ({ page }) => {
    await page.goto('/forja/niveles')
    const cards = page.getByTestId('level-card')
    await expect(cards).toHaveCount(12)
    for (const card of await cards.all()) {
      if ((await card.getAttribute('data-playable')) === 'true') {
        await expect(card.locator('a')).toHaveAttribute('href', /^\/forja\/\d+$/)
      } else {
        await expect(card).toContainText('todavía sin ejercicios publicados')
      }
    }
  })

  test('the map counts what the player solved, per level and overall', async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/forja/niveles')
    await expect(page.getByTestId('forja-overall-progress')).toContainText('ejercicios publicados')
    await expect(page.getByTestId('forja-overall-progress')).not.toContainText('0 de')
  })
})
