// What the player actually sees, in the theme they actually chose.
//
// Every other assertion about the playground's colours is arithmetic over
// tokens. This one is the browser's own answer: it loads a real exercise with
// the site switched to light, and reads the computed styles off the rendered
// elements. The defect it pins was invisible to every unit test in the suite,
// because the canvas was hardcoded to one theme and the maths was checked
// against that same hardcoded theme.
//
// The symptom, as reported: a light page, a light library rail, light node
// cards, and a dark blue rectangle in the middle where the drawing surface is.
import { expect, test } from '@playwright/test'
import { waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'

// The site's own switch (Navbar.astro) writes this key and reads it back
// before first paint, so setting it is the same starting state as a player who
// pressed the toggle on a previous page.
async function openIn(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => window.localStorage.setItem('theme', value), theme)
  await page.goto(EXERCISE)
  await page.locator('.react-flow__node').first().waitFor()
  await waitForCanvasToSettle(page)
}

const backgroundOf = (page: import('@playwright/test').Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor)

test.describe('the playground follows the theme the player chose', () => {
  test('paints the drawing surface with the light page background, not a dark rectangle', async ({ page }) => {
    await openIn(page, 'light')

    expect(await backgroundOf(page, '.react-flow')).toBe('rgb(236, 240, 246)')
  })

  test('still paints it with the deep background on the dark theme', async ({ page }) => {
    await openIn(page, 'dark')

    expect(await backgroundOf(page, '.react-flow')).toBe('rgb(10, 15, 26)')
  })

  // `.react-flow__node` is React Flow's own transparent wrapper; the card is
  // the element this playground renders inside it (ForjaNode.tsx).
  test('lifts the node cards to pure white so they stay off the light surface', async ({ page }) => {
    await openIn(page, 'light')

    expect(await backgroundOf(page, '.react-flow__node > div')).toBe('rgb(255, 255, 255)')
  })

  // The other half of the same decision: on the light theme the card rises by
  // casting a shadow, because there is no lighter surface left to rise onto.
  test('gives those cards the shadow that does the lifting', async ({ page }) => {
    await openIn(page, 'light')

    const shadow = await page.locator('.react-flow__node > div').first().evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).toContain('rgba(15, 23, 42, 0.08)')
  })

  test('spends no shadow at all on the dark theme, where the surface already says it', async ({ page }) => {
    await openIn(page, 'dark')

    const shadow = await page.locator('.react-flow__node > div').first().evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).toBe('none')
  })

  test('drops React Flow’s own dark chrome, which was painting a black island of controls', async ({ page }) => {
    await openIn(page, 'light')

    await expect(page.locator('.react-flow')).not.toHaveClass(/(^|\s)dark(\s|$)/)
  })

  test('keeps the primary action’s ink dark, where the deep background used to turn it near-white', async ({ page }) => {
    await openIn(page, 'light')

    const ink = await page.getByTestId('submit-button').evaluate((el) => getComputedStyle(el).color)
    expect(ink).toBe('rgb(10, 15, 26)')
  })
})
