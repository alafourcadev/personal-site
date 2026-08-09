// PC15 — real right-click and real keyboard only. The prototype's bug class
// (pointerdown handling every mouse button, redrawing the canvas and
// destroying the element before `contextmenu` ever fired) is exactly why
// every trigger here is a genuine `button: 'right'` click or a real
// keyboard key, never `dispatchEvent`.
import { expect, test } from '@playwright/test'
import { createNode, nodeByLabel, waitForCanvasToSettle } from './helpers'

test.describe('La Forja canvas — context menu [PC15]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('right-clicking a node opens the NODE menu, not the canvas menu, and does not mutate it', async ({ page }) => {
    await createNode(page, 'service')
    // Creating a component can re-frame the camera (a new node that lands
    // outside the pane brings the whole design back into view), so anything
    // read straight after the click describes where the node WAS.
    await waitForCanvasToSettle(page)
    const node = nodeByLabel(page, /Servicio/)
    // The node's position in the DESIGN, which is what "does not mutate it"
    // is about: React Flow writes it as the element's own translate, in flow
    // coordinates. A screen box cannot answer this question, because selecting the
    // node writes a line into the status bar below the pane, the pane loses a
    // pixel of height, and the camera re-frames into it. Measured 2px of
    // drift at 1440x900 and 1px after the camera was allowed to settle, none
    // of it a change to the design. The prototype bug this test exists for
    // destroyed the node outright, and flow coordinates see that.
    const position = async () => node.evaluate((el) => getComputedStyle(el).transform)
    const before = await position()

    await node.click({ button: 'right' })

    const menu = page.getByTestId('context-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByTestId('context-menu-item-connect')).toBeVisible()
    await expect(menu.getByTestId('context-menu-item-delete')).toBeVisible()

    // The empty-canvas "add component" menu must NOT be what opened.
    await expect(menu.getByTestId('context-menu-item-add-database')).toHaveCount(0)

    expect(await position(), 'the right-click did not move the node in the design').toBe(before)
    await expect(page.locator('.react-flow__node')).toHaveCount(1)
  })

  test('right-clicking empty canvas opens the "add component" menu, and an item creates a node at that position', async ({ page }) => {
    const canvas = page.getByTestId('forja-canvas')
    // The playground now carries real chrome above the canvas (header,
    // ranking strip, tab bar), so at the default viewport the pane's lower
    // half starts BELOW the window. `page.mouse` never auto-scrolls — unlike
    // a locator action — and a click at a point outside the window is
    // silently a no-op, not an error, which is exactly how this test used to
    // "right-click the pane" without ever reaching it. Scrolling the pane
    // into view first is what a player does with the wheel; the assertions
    // below are unchanged and still measure the menu, not the scroll.
    await canvas.scrollIntoViewIfNeeded()
    await waitForCanvasToSettle(page)
    const box = (await canvas.boundingBox())!
    const window = page.viewportSize()!
    const point = { x: box.x + box.width - 80, y: Math.min(box.y + box.height, window.height) - 80 }
    expect(point.y, 'the right-click point is inside the real browser window').toBeLessThan(window.height)

    await page.mouse.click(point.x, point.y, { button: 'right' })

    const menu = page.getByTestId('context-menu')
    await expect(menu).toBeVisible()
    const addItem = menu.getByTestId('context-menu-item-add-database')
    await expect(addItem).toBeVisible()
    await addItem.click()

    await expect(page.locator('.react-flow__node')).toHaveCount(1)
    const node = page.locator('.react-flow__node').first()
    const nodeBox = (await node.boundingBox())!
    // Created near the right-click point, not the default top-left grid slot.
    expect(nodeBox.x).toBeGreaterThan(box.width / 2)
  })

  test('connecting through the context menu creates the same connection a drag would [PC15]', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'api-gateway')
    const source = nodeByLabel(page, /Cliente web/)
    const target = nodeByLabel(page, /Puerta de entrada/)

    await source.click({ button: 'right' })
    await page.getByTestId('context-menu-item-connect').click()
    await expect(page.getByTestId('canvas-status')).toContainText('Modo conectar')
    await target.click()

    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  })

  test('Shift+F10 on a focused node opens the menu with focus on the first item; Escape returns focus to the node', async ({ page }) => {
    await createNode(page, 'cache')
    const node = nodeByLabel(page, /Caché/)
    await expect(node).toBeFocused()

    await page.keyboard.press('Shift+F10')

    const menu = page.getByTestId('context-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()

    await page.keyboard.press('ArrowDown')
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(node).toBeFocused()
  })

  test('duplicate creates a second node distinguishable from the original', async ({ page }) => {
    await createNode(page, 'queue')
    const node = nodeByLabel(page, /Cola de mensajes/)

    await node.click({ button: 'right' })
    await page.getByTestId('context-menu-item-duplicate').click()

    await expect(page.locator('.react-flow__node')).toHaveCount(2)
  })

  test('delete from the menu removes the node and its connections', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'api-gateway')
    const source = nodeByLabel(page, /Cliente web/)
    const target = nodeByLabel(page, /Puerta de entrada/)
    await source.click({ button: 'right' })
    await page.getByTestId('context-menu-item-connect').click()
    await target.click()
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)

    await target.click({ button: 'right' })
    await page.getByTestId('context-menu-item-delete').click()

    await expect(page.locator('.react-flow__node')).toHaveCount(1)
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  })

  test('rename from the menu updates the node label', async ({ page }) => {
    await createNode(page, 'service')
    const node = nodeByLabel(page, /Servicio/)

    page.once('dialog', (dialog) => dialog.accept('Cobros v2'))
    await node.click({ button: 'right' })
    await page.getByTestId('context-menu-item-rename').click()

    await expect(nodeByLabel(page, /Cobros v2/)).toBeVisible()
  })

  test('recolouring via the menu persists the colour and never touches the label/type text [PC16]', async ({ page }) => {
    await createNode(page, 'database')
    const node = nodeByLabel(page, /Base de datos/)

    await node.click({ button: 'right' })
    const menu = page.getByTestId('context-menu')
    await menu.getByTestId('context-menu-item-color-violet').click()

    await expect(node.getByTestId('node-color-dot')).toBeVisible()
    const label = await node.getAttribute('aria-label')
    // PC13 asks for the component's TYPE in the accessible name, and the
    // name is the one surface where the player has no picture to compensate
    // with — so it has to be the type's Spanish name, never the engine key
    // it is indexed by (CONTEXTO §5: no internal vocabulary in what the
    // player reads or hears). Asserting both halves is stricter than the
    // original `toContain('database')`, which the raw key satisfied.
    expect(label).toContain('Base de datos')
    expect(label).not.toContain('database')
    expect(label).toContain('color Violeta')
    expect(label).not.toContain('violet')
  })
})
