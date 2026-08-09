import { expect, test } from '@playwright/test'

const GREENFIELD = '/forja/2/n2-las-dos-areas-que-arrancan-el-mismo-lunes'

test.describe('La Forja: decisiones evaluables de un componente', () => {
  test('a player can configure a created database and undo the decision', async ({ page }) => {
    await page.goto(GREENFIELD)
    await expect(page.getByTestId('forja-canvas')).toBeVisible()

    await page.getByTestId('palette-item-database').click()

    const backup = page.getByLabel('Respaldo de Base de datos')
    await expect(backup).toBeVisible()
    await expect(backup).toHaveValue('none')

    await backup.selectOption('diario')
    await expect(backup).toHaveValue('diario')
    await expect(page.getByRole('status')).toContainText('Respaldo: Diario')

    await page.getByRole('button', { name: 'Deshacer' }).click()
    await expect(backup).toHaveValue('none')
  })
})
