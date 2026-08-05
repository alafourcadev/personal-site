// R1-D2 polish: real fit-to-content [PC7], empty-canvas guidance [PC8],
// the undo-announcement fix (bug #7), and PC17's overlay containment — the
// owner's screenshot showed a refusal message drawn over the site's fixed
// navbar. Every navigation check here ends with a REAL click on a nav link
// (not just a visibility assertion): Playwright's own actionability check
// throws if another element is intercepting that exact point, which is
// the only genuine proof nothing is drawn on top of it.
import { expect, test } from '@playwright/test'
import { connectByPointer, createNode, nodeByLabel } from './helpers'

test.describe('La Forja canvas — R1-D2 polish', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('empty canvas shows a guidance message, which disappears after the first component [PC8]', async ({ page }) => {
    await expect(page.getByTestId('empty-canvas-hint')).toBeVisible()
    await expect(page.getByTestId('empty-canvas-hint')).toContainText('biblioteca')

    await createNode(page, 'service')

    await expect(page.getByTestId('empty-canvas-hint')).toHaveCount(0)
  })

  // A short viewport makes "off screen" deterministic: the canvas pane
  // itself is tall enough that, at the default 1280x720 size, its own
  // bottom edge can sit past the fold — comparing pixel coordinates
  // against the pane's own (possibly off-screen) box is what made this
  // test flaky. `toBeInViewport()` checks against the real browser
  // viewport, which is the actual thing "without manual panning" (the
  // spec's literal wording) cares about.
  test('fit-to-content reveals a node moved far outside the visible area [PC7]', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await createNode(page, 'service')
    const node = nodeByLabel(page, /Servicio/)

    const start = (await node.boundingBox())!
    const startPoint = { x: start.x + start.width / 2, y: start.y + start.height / 2 }
    await page.mouse.move(startPoint.x, startPoint.y)
    await page.mouse.down()
    await page.mouse.move(startPoint.x, startPoint.y + 900, { steps: 10 })
    await page.mouse.up()

    await expect(node).not.toBeInViewport()

    await page.locator('.react-flow__controls-fitview').click()

    // fitView animates the pan/zoom transition — toBeInViewport() polls
    // internally until it either passes or times out.
    await expect(node).toBeInViewport({ timeout: 10000 })
  })

  test('undo replaces the stale "creado" text with an explicit undo announcement (bug #7)', async ({ page }) => {
    await createNode(page, 'cache')
    await expect(page.getByTestId('canvas-status')).toContainText('creado')

    await page.getByTestId('undo-button').click()

    await expect(page.getByTestId('canvas-status')).toContainText('deshizo');
    await expect(page.getByTestId('canvas-status')).not.toContainText('creado')
  })

  test('undo-button announces when there is nothing to undo', async ({ page }) => {
    await page.getByTestId('undo-button').click()
    await expect(page.getByTestId('canvas-status')).toContainText('No hay nada para deshacer')
  })

  test('a connection refusal never covers the site navigation [PC17]', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'database')
    await connectByPointer(page, nodeByLabel(page, /Cliente web/), nodeByLabel(page, /Base de datos/))
    await expect(page.getByTestId('canvas-status')).toContainText('rechazada')

    const nav = page.getByRole('navigation', { name: 'Navegación principal' })
    const blogLink = nav.getByRole('link', { name: 'Blog' })
    await expect(blogLink).toBeVisible()
    await blogLink.click()
    await expect(page).toHaveURL(/\/blog/)
  })

  test('an open node context menu never covers the site navigation [PC17]', async ({ page }) => {
    await createNode(page, 'service')
    const node = nodeByLabel(page, /Servicio/)
    await node.click({ button: 'right' })
    await expect(page.getByTestId('context-menu')).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Navegación principal' })
    const blogLink = nav.getByRole('link', { name: 'Blog' })
    await expect(blogLink).toBeVisible()
    await blogLink.click()
    await expect(page).toHaveURL(/\/blog/)
  })
})
