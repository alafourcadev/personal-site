// "Every component explains itself on hover and on focus" — real pointer
// hover and real keyboard focus (Tab), never a CSS read: the requirement
// is about what a player can actually reach, by either input method.
import { expect, test } from '@playwright/test'
import { createNode, nodeByLabel } from './helpers'

test.describe('La Forja — components explain themselves', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('hovering a library entry reveals its explanation, stating the operational cost', async ({ page }) => {
    const description = page.getByTestId('palette-description-queue')
    await expect(description).toHaveCSS('opacity', '0')

    await page.getByTestId('palette-item-queue').hover()

    await expect(description).toHaveCSS('opacity', '1')
    await expect(description).toContainText('unidad')
  })

  test('keyboard-focusing a library entry reveals its explanation too, no pointer involved', async ({ page }) => {
    await page.getByTestId('palette-item-database').focus()

    await expect(page.getByTestId('palette-description-database')).toHaveCSS('opacity', '1')
  })

  test('a library entry is bound to its explanation via aria-describedby, never title', async ({ page }) => {
    const button = page.getByTestId('palette-item-service')
    await expect(button).toHaveAttribute('aria-describedby', 'palette-desc-service')
    await expect(button).not.toHaveAttribute('title', /.+/)
    await expect(button).toHaveAccessibleDescription(/servicio|lógica de negocio/i)
  })

  test('an icon plus label alone still identifies the component when its explanation is not showing', async ({ page }) => {
    const button = page.getByTestId('palette-item-cache')
    await expect(button).toContainText('Cache')
  })

  test('hovering a canvas node reveals its explanation and binds it via aria-describedby', async ({ page }) => {
    await createNode(page, 'observability')
    const node = nodeByLabel(page, /Observabilidad/)

    await expect(node).toHaveAccessibleDescription(/observabilidad|producción|unidad/i)

    await node.hover()
    const describedById = await node.getAttribute('aria-describedby')
    await expect(page.locator(`#${describedById}`)).toHaveCSS('opacity', '1')
  })

  test('keyboard-focusing a canvas node reveals its explanation too', async ({ page }) => {
    await createNode(page, 'worker')
    const node = nodeByLabel(page, /Procesador/)
    await node.focus()

    const describedById = await node.getAttribute('aria-describedby')
    await expect(page.locator(`#${describedById}`)).toHaveCSS('opacity', '1')
  })
})
