// The menu in La Forja's own bar, which exists to close a measured dead end.
//
// Finishing a level leaves the player on a line that reads "Era el último
// ejercicio de este nivel" with no link, no next level and no way back to the
// map. That happens eleven times per playthrough; the ending that does offer a
// link happens once. The exit had to be somewhere that is always one click
// away, and the shell has no blog navigation to fall back on.
//
// What the menu carries is what the player could not reach: the level map,
// this level's own list, the two steps beside this one, and the fourteen
// exercises with what they have already solved.
import { expect, test, type Page } from '@playwright/test'
import { STORAGE_KEY } from '../../src/lib/forja/ranking/local-adapter'

const EXERCISE = '/forja/1/n1-la-consulta-que-saltea-la-puerta'

async function openMenu(page: Page) {
  await page.goto(EXERCISE)
  const toggle = page.getByTestId('forja-menu-toggle')
  await expect(page.getByTestId('forja-menu')).toBeHidden()
  await toggle.click()
  await expect(page.getByTestId('forja-menu')).toBeVisible()
  return toggle
}

test.describe('La Forja: the shell menu', () => {
  test('opens closed, and says so before it is opened', async ({ page }) => {
    await page.goto(EXERCISE)
    await expect(page.getByTestId('forja-menu-toggle')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('forja-menu')).toBeHidden()
  })

  test('lists this level in play order, with the open exercise marked', async ({ page }) => {
    await openMenu(page)
    const entries = page.getByTestId('forja-menu-exercises').locator('li')
    await expect(entries).toHaveCount(14)
    await expect(page.getByTestId('forja-menu').locator('[aria-current="page"]')).toHaveCount(1)
    await expect(page.getByTestId('forja-menu').locator('[aria-current="page"]')).toContainText(
      'La consulta que saltea la puerta',
    )
  })

  test('offers the step before and the step after, by name', async ({ page }) => {
    await openMenu(page)
    await expect(page.getByTestId('forja-menu-previous')).toBeVisible()
    await expect(page.getByTestId('forja-menu-next')).toBeVisible()
    const href = await page.getByTestId('forja-menu-next').getAttribute('href')
    await page.getByTestId('forja-menu-next').click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
  })

  test('reaches the level map, which is the exit a finished level did not have', async ({ page }) => {
    await openMenu(page)
    await page.getByTestId('forja-menu-levels').click()
    await expect(page).toHaveURL(/\/forja\/niveles$/)
  })

  // The other half of the focus contract, and the half that was missing.
  // Escape already brought focus back; opening left it on the toggle, so the
  // next Tab went PAST the panel to the theme switch and the fourteen links
  // the player had just asked for were reached backwards or not at all.
  test('opening it puts the focus on the first thing it disclosed', async ({ page }) => {
    const toggle = page.getByTestId('forja-menu-toggle')
    await page.goto(EXERCISE)
    await toggle.focus()
    await page.keyboard.press('Enter')

    await expect(page.getByTestId('forja-menu')).toBeVisible()
    await expect(page.getByTestId('forja-menu-levels')).toBeFocused()
  })

  // "Every panel that opens can be closed", the same promise the result panel
  // and the context menu already keep, and the focus goes back to the control
  // that opened it so a keyboard player is never left adrift in the page.
  test('Escape closes it and returns the focus to the control that opened it', async ({ page }) => {
    const toggle = await openMenu(page)
    await toggle.focus()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('forja-menu')).toBeHidden()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeFocused()
  })

  test('a click outside closes it', async ({ page }) => {
    await openMenu(page)
    await page.getByTestId('forja-mark').click({ trial: true })
    await page.mouse.click(20, 300)
    await expect(page.getByTestId('forja-menu')).toBeHidden()
  })

  // The server cannot know what this player solved, so the marks are filled in
  // the browser from the same attempts the canvas writes. A pending exercise
  // says so rather than showing nothing, once the browser has actually read.
  test('says which exercises are still pending, and marks a solved one with its score', async ({ page }) => {
    await page.goto(EXERCISE)
    await page.evaluate(
      ({ key, id }) => {
        localStorage.setItem(
          key,
          JSON.stringify([
            {
              exerciseId: id,
              score: 75,
              at: new Date().toISOString(),
              engineVersion: 'test',
              design: { nodes: [], edges: [] },
            },
          ]),
        )
      },
      { key: STORAGE_KEY, id: 'n1-el-comprobante-que-no-se-guarda' },
    )
    await page.reload()
    await page.getByTestId('forja-menu-toggle').click()

    const solved = page.locator('[data-menu-exercise-id="n1-el-comprobante-que-no-se-guarda"]')
    await expect(solved.locator('[data-menu-exercise-state]')).toHaveText('75')
    const pending = page.locator('[data-menu-exercise-id="n1-la-consulta-que-saltea-la-puerta"]')
    await expect(pending.locator('[data-menu-exercise-state]')).toHaveText('pendiente')

    // A score is an identifier and reads better aligned in a column of
    // fourteen. "pendiente" is a word, and it was set in the mono face and
    // upper-cased beside fourteen exercise titles in the body face: a costume,
    // not a distinction.
    const faceOf = (mark: typeof solved) => mark.evaluate((el) => getComputedStyle(el).fontFamily)
    const scoreFace = await faceOf(solved.locator('[data-menu-exercise-state]'))
    const wordFace = await faceOf(pending.locator('[data-menu-exercise-state]'))
    expect(scoreFace).toMatch(/mono/i)
    expect(wordFace).not.toMatch(/mono/i)
    expect(
      await pending.locator('[data-menu-exercise-state]').evaluate((el) => getComputedStyle(el).textTransform),
    ).toBe('none')
  })
})
