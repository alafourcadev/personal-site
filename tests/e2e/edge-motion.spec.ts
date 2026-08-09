import { expect, test, type Page } from '@playwright/test'

const LEVEL_URL = '/forja/1/n1-el-comprobante-que-no-se-guarda'

async function openLevel(page: Page) {
  await page.goto(LEVEL_URL)
  // SVG paths with their stroke supplied through a CSS variable are reported
  // as "hidden" by Playwright even while they are painted on screen. Waiting
  // for attachment is the reliable readiness signal for this React Flow SVG.
  await page.locator('.react-flow__edge-path').first().waitFor({ state: 'attached' })
}

test.describe('La Forja: flujo visual de las conexiones', () => {
  test('los trazos discontinuos avanzan de origen a destino', async ({ page }) => {
    await openLevel(page)

    const edge = page.locator('.react-flow__edge-path').first()
    const before = await edge.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        animationName: style.animationName,
        dasharray: style.strokeDasharray,
        dashoffset: style.strokeDashoffset,
      }
    })

    await page.waitForTimeout(160)
    const afterOffset = await edge.evaluate((element) => getComputedStyle(element).strokeDashoffset)

    expect(before.dasharray).not.toBe('none')
    expect(before.animationName).toBe('forja-edge-flow')
    expect(afterOffset).not.toBe(before.dashoffset)
  })

  test('reduced motion conserva los trazos, pero detiene el desplazamiento', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openLevel(page)

    const style = await page.locator('.react-flow__edge-path').first().evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        animationName: computed.animationName,
        dasharray: computed.strokeDasharray,
      }
    })

    expect(style.dasharray).not.toBe('none')
    expect(style.animationName).toBe('none')
  })
})
