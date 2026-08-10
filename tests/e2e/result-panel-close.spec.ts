// "Every panel that opens can be closed" — real click and real Escape,
// never a state assertion alone: the requirement also demands focus
// returns to the control that opened the panel, and that the result
// itself survives being closed and reopened.
import { expect, test } from '@playwright/test'
import { createNode } from './helpers'

test.describe('La Forja — result panel is dismissible', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja/lienzo')
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
  })

  test('the close button closes the panel and returns focus to the submit control', async ({ page }) => {
    await page.getByTestId('close-result-panel').click()

    await expect(page.getByTestId('view-result-tab')).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByTestId('submit-button')).toBeFocused()
  })

  test('Escape closes the panel the same way as the close button', async ({ page }) => {
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('view-result-tab')).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByTestId('submit-button')).toBeFocused()
  })

  test('reopening after close shows the same result, not a cleared one', async ({ page }) => {
    const scoreBefore = await page.getByTestId('result-score').textContent()

    await page.getByTestId('close-result-panel').click()
    await page.getByTestId('view-result-tab').click()

    await expect(page.getByTestId('result-score')).toHaveText(scoreBefore ?? '')
    await expect(page.getByTestId('result-empty')).toHaveCount(0)
  })
})
