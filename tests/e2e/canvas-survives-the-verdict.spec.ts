// Pressing "Probar respuesta" used to take the canvas to `display: none` on
// the two most common laptops. Measured against this repo at 1440x900 on
// `/forja/1/n1-el-comprobante-que-no-se-guarda`: after the click, the React
// Flow pane's box was 0x0 and `checkVisibility()` was false.
//
// The playground puts the statement in a 460px column, so a 1440px window
// hands the playground 908px, below the three-column threshold, and the
// verdict took the whole row. Every finding in that verdict is a button that
// highlights nodes and edges on the canvas, so the panel was pointing at a
// design that was not on screen.
//
// Why an existing spec did not catch it: result.spec.ts asserts
// `getByTestId('forja-canvas')` is visible, and that is the playground's
// outer box: toolbar, tab bar and status bar. It keeps its size while the
// pane inside it goes to zero. The assertion has to be on the pane.
import { expect, test } from '@playwright/test'
import { createNode, waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'

// The two laptops the defect was measured on, plus the width where the
// playground has the least to give and the phone where one pane at a time is
// still the honest answer.
const LAPTOPS = [
  { width: 1440, height: 900 },
  { width: 1512, height: 900 },
  { width: 1280, height: 800 },
  { width: 1133, height: 800 },
] as const

test.describe('La Forja: the verdict never arrives without the design it is about', () => {
  for (const { width, height } of LAPTOPS) {
    test(`at ${width}x${height} the canvas is still on screen after "Probar respuesta"`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto(EXERCISE)
      await expect(page.getByTestId('forja-canvas')).toBeVisible()
      await expect(page.locator('.react-flow__node').first()).toBeVisible()
      await waitForCanvasToSettle(page)

      await page.getByTestId('submit-button').click()
      await expect(page.getByTestId('result-panel')).toBeVisible()
      await waitForCanvasToSettle(page)

      const pane = await page.evaluate(() => {
        const el = document.querySelector('.react-flow')
        const box = el?.getBoundingClientRect()
        return { visible: el?.checkVisibility() ?? false, width: Math.round(box?.width ?? 0) }
      })
      expect(pane.visible, `the canvas pane is painted at ${width}px`).toBe(true)
      expect(pane.width, `the canvas pane has a real box at ${width}px`).toBeGreaterThan(0)

      // Not merely mounted: a finding is a button that highlights something,
      // so the something has to be reachable by a pointer.
      const node = page.locator('.react-flow__node').first()
      await expect(node).toBeVisible()
      await expect(node).toBeInViewport()
    })
  }

  // The library is the pane that gives up the rail, and the correction loop
  // survives it because the canvas's own context menu offers the same 21
  // components. This is that promise, checked rather than assumed.
  test('the components are still one gesture away with the verdict open', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await waitForCanvasToSettle(page)

    const pane = (await page.locator('.react-flow__pane').boundingBox())!
    await page.mouse.click(pane.x + pane.width / 2, pane.y + pane.height - 20, { button: 'right' })
    await expect(page.getByTestId('context-menu')).toBeVisible()
  })
})
