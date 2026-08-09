// "Ordenar el diagrama", asked for in these words: "veo que no existe un botón
// en el lienzo que al darle organice las flechas y cuadros bien organizaditos".
//
// The layout itself is proven in tests/canvas/auto-layout.test.ts, including
// the crossing count it removes and the fact that it is a pure function of the
// graph. This is the browser half: that the control is on the canvas, that a
// player can reach it without a mouse, that Ctrl+Z takes it back, and that a
// second press does nothing, which is the difference between a feature and
// something that feels broken.
import { expect, test, type Page } from '@playwright/test'
import { waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'

async function open(page: Page) {
  await page.goto(EXERCISE)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await waitForCanvasToSettle(page)
}

// Where every piece sits in flow coordinates, read off React Flow's own
// transform rather than off the store, so what is asserted is what is drawn.
async function positions(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const found: Record<string, string> = {}
    for (const node of document.querySelectorAll<HTMLElement>('.react-flow__node')) {
      found[node.dataset.id ?? ''] = node.style.transform
    }
    return found
  })
}

async function structure(page: Page) {
  return page.evaluate(() => ({
    nodes: document.querySelectorAll('.react-flow__node').length,
    edges: document.querySelectorAll('.react-flow__edge').length,
  }))
}

test.describe('La Forja: ordenar el diagrama', () => {
  test('the control is on the canvas and names its action', async ({ page }) => {
    await open(page)

    const button = page.getByTestId('arrange-button')
    await expect(button).toBeVisible()
    await expect(button).toHaveAccessibleName('Ordenar el diagrama')
    // Inside the React Flow pane, which is where the player is looking, rather
    // than in the menu.
    expect(await button.evaluate((el) => Boolean(el.closest('.react-flow')))).toBe(true)
    expect(await button.evaluate((el) => Boolean(el.closest('.react-flow__controls')))).toBe(true)
    const controlNames = await page.locator('.react-flow__controls button').evaluateAll((controls) =>
      controls.map((control) => control.getAttribute('aria-label')),
    )
    expect(controlNames).toEqual([
      'Acercar',
      'Alejar',
      'Encuadrar el diagrama',
      'Ordenar el diagrama',
    ])
  })

  test('it moves the pieces', async ({ page }) => {
    await open(page)
    const before = await positions(page)

    await page.getByTestId('arrange-button').click()
    await waitForCanvasToSettle(page)

    expect(await positions(page)).not.toEqual(before)
  })

  test('it lines every band up in a single column', async ({ page }) => {
    await open(page)

    await page.getByTestId('arrange-button').click()
    await waitForCanvasToSettle(page)

    const columns = await page.evaluate(
      () =>
        new Set(
          [...document.querySelectorAll<HTMLElement>('.react-flow__node')].map(
            (node) => node.style.transform.match(/translate\((-?[\d.]+)px/)?.[1] ?? '?',
          ),
        ).size,
    )
    expect(columns).toBe(3)
  })

  test('it never adds or removes a piece or a cable', async ({ page }) => {
    await open(page)
    const before = await structure(page)

    await page.getByTestId('arrange-button').click()
    await waitForCanvasToSettle(page)

    expect(await structure(page)).toEqual(before)
  })

  test('Ctrl+Z puts every piece back where it was', async ({ page }) => {
    await open(page)
    const before = await positions(page)

    await page.getByTestId('arrange-button').click()
    await waitForCanvasToSettle(page)
    await page.keyboard.press('Control+z')
    await waitForCanvasToSettle(page)

    expect(await positions(page)).toEqual(before)
  })

  // "A diagram that is already arranged does not move." A second press that
  // moved anything would mean the algorithm is not stable, and that reads as
  // broken however good the first press looked.
  test('a second press changes nothing', async ({ page }) => {
    await open(page)

    await page.getByTestId('arrange-button').click()
    await waitForCanvasToSettle(page)
    const arranged = await positions(page)

    await page.getByTestId('arrange-button').click()
    await waitForCanvasToSettle(page)

    expect(await positions(page)).toEqual(arranged)
  })

  test('a second press says so instead of staying silent', async ({ page }) => {
    await open(page)

    await page.getByTestId('arrange-button').click()
    await waitForCanvasToSettle(page)
    await page.getByTestId('arrange-button').click()

    await expect(page.getByRole('status')).toContainText('ya estaba ordenado')
  })

  test('a player without a mouse can order the diagram', async ({ page }) => {
    await open(page)
    const before = await positions(page)

    await page.getByTestId('arrange-button').focus()
    await expect(page.getByTestId('arrange-button')).toBeFocused()
    await page.keyboard.press('Enter')
    await waitForCanvasToSettle(page)

    expect(await positions(page)).not.toEqual(before)
  })
})
