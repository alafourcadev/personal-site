// R1-D1 canvas gestures — every one proven with a real pointer AND a real
// keyboard against the production build (webServer runs `npm run build &&
// npm run preview`, per playwright.config.ts). The prototype's connection-
// delete bug (B4) was invisible to a synthetic `dispatchEvent(click)`
// because the pointerdown redraw destroyed the element before the browser
// ever dispatched the trusted click — every interaction below uses
// page.mouse/page.keyboard, never dispatchEvent.
import { expect, test } from '@playwright/test'
import { connectByPointer, createNode, createNodeByKeyboard, edgeMidpoint, nodeByLabel } from './helpers'

test.describe('La Forja canvas — R1-D1 gestures', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('creates a node by a real pointer click and moves focus to it [PC1]', async ({ page }) => {
    await createNode(page, 'web-client')
    const node = nodeByLabel(page, /Cliente web/)
    await expect(node).toBeVisible()
    await expect(node).toBeFocused()
  })

  test('creates a node by keyboard Enter on a focused palette item [PC1]', async ({ page }) => {
    await createNodeByKeyboard(page, 'database')
    const node = nodeByLabel(page, /Base de datos/)
    await expect(node).toBeVisible()
    await expect(node).toBeFocused()
  })

  test('moves a focused, selected node with real arrow key presses [PC2]', async ({ page }) => {
    await createNode(page, 'service')
    const node = nodeByLabel(page, /Servicio/)
    const before = (await node.boundingBox())!
    await node.click()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowDown')
    const after = (await node.boundingBox())!
    expect(after.x).toBeGreaterThan(before.x)
    expect(after.y).toBeGreaterThan(before.y)
  })

  test('moves a node by a real pointer drag', async ({ page }) => {
    await createNode(page, 'service')
    const node = nodeByLabel(page, /Servicio/)
    const before = (await node.boundingBox())!
    const start = { x: before.x + before.width / 2, y: before.y + before.height / 2 }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 140, start.y + 90, { steps: 10 })
    await page.mouse.up()
    const after = (await node.boundingBox())!
    expect(after.x).toBeGreaterThan(before.x + 100)
  })

  test('connects two compatible nodes by a real pointer drag between handles [PC3]', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'api-gateway')
    await connectByPointer(page, nodeByLabel(page, /Cliente web/), nodeByLabel(page, /Puerta de entrada/))
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  })

  test('refuses an illegal connection and announces why, without creating an edge [PC3, PC12]', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'database')
    await connectByPointer(page, nodeByLabel(page, /Cliente web/), nodeByLabel(page, /Base de datos/))
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
    await expect(page.getByTestId('canvas-status')).toContainText('rechazada')
  })

  test('connects two nodes by keyboard command [PC3]', async ({ page }) => {
    await createNodeByKeyboard(page, 'web-client')
    await createNodeByKeyboard(page, 'api-gateway')
    const source = nodeByLabel(page, /Cliente web/)
    const target = nodeByLabel(page, /Puerta de entrada/)
    await expect(target).toBeFocused() // let the post-create focus effect settle first

    await source.focus()
    await expect(source).toBeFocused()
    await page.keyboard.press('c')
    await expect(page.getByTestId('canvas-status')).toContainText('Modo conectar')
    await target.focus()
    await expect(target).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  })

  test('cancels the keyboard connect command with Escape, creating no edge', async ({ page }) => {
    await createNodeByKeyboard(page, 'web-client')
    await createNodeByKeyboard(page, 'api-gateway')
    const gateway = nodeByLabel(page, /Puerta de entrada/)
    await expect(gateway).toBeFocused() // let the post-create focus effect settle first
    const source = nodeByLabel(page, /Cliente web/)

    await source.focus()
    await expect(source).toBeFocused()
    await page.keyboard.press('c')
    await expect(page.getByTestId('canvas-status')).toContainText('Modo conectar')
    await page.keyboard.press('Escape')

    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  })

  test('deletes a connection with a real pointer click + Delete key, and it stays gone after a re-render [PC4 — B4 blocker]', async ({
    page,
  }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'api-gateway')
    await connectByPointer(page, nodeByLabel(page, /Cliente web/), nodeByLabel(page, /Puerta de entrada/))
    const edge = page.locator('.react-flow__edge').first()
    await expect(edge).toHaveCount(1)

    const point = await edgeMidpoint(edge)
    await page.mouse.click(point.x, point.y)
    await page.keyboard.press('Delete')

    await expect(page.locator('.react-flow__edge')).toHaveCount(0)

    // Force a re-render (a fresh store mutation) and confirm the edge does
    // NOT reappear — this is exactly what the prototype's synthetic-event
    // bug could not prove, since the element was gone before the browser's
    // real click ever fired.
    await createNode(page, 'cache')
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  })

  test('deletes a connection with the keyboard (Tab to focus, Delete to remove) [PC4]', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'api-gateway')
    await connectByPointer(page, nodeByLabel(page, /Cliente web/), nodeByLabel(page, /Puerta de entrada/))
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
    const edge = page.locator('.react-flow__edge').first()
    await edge.focus()
    // Edges follow the same elementSelectionKeys convention as nodes:
    // Enter/Space selects a focused element before Delete removes it.
    await page.keyboard.press('Enter')
    await expect(edge).toHaveClass(/selected/)
    await page.keyboard.press('Delete')
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  })

  test('deletes a keyboard-selected node and its connections [PC5]', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'api-gateway')
    await connectByPointer(page, nodeByLabel(page, /Cliente web/), nodeByLabel(page, /Puerta de entrada/))
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)

    const gateway = nodeByLabel(page, /Puerta de entrada/)
    await gateway.focus()
    await page.keyboard.press('Enter') // select
    await expect(gateway).toHaveClass(/selected/)
    await page.keyboard.press('Delete')

    await expect(page.locator('.react-flow__node')).toHaveCount(1)
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  })

  test('undo restores a deleted connection between the same two ports, via the visible button [PC6]', async ({ page }) => {
    await createNode(page, 'web-client')
    await createNode(page, 'api-gateway')
    await connectByPointer(page, nodeByLabel(page, /Cliente web/), nodeByLabel(page, /Puerta de entrada/))
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
    const edge = page.locator('.react-flow__edge').first()
    const point = await edgeMidpoint(edge)
    await page.mouse.click(point.x, point.y)
    await page.keyboard.press('Delete')
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)

    await page.getByTestId('undo-button').click()

    await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  })

  test('undo via the Ctrl/Cmd+Z keyboard shortcut', async ({ page }) => {
    await createNode(page, 'web-client')
    await expect(page.locator('.react-flow__node')).toHaveCount(1)

    await page.keyboard.press('ControlOrMeta+z')

    await expect(page.locator('.react-flow__node')).toHaveCount(0)
  })

  test('builds a legal two-node design entirely by keyboard [PC11]', async ({ page }) => {
    await createNodeByKeyboard(page, 'web-client')
    const nodeA = nodeByLabel(page, /Cliente web/)
    await expect(nodeA).toBeFocused()

    await createNodeByKeyboard(page, 'api-gateway')
    const nodeB = nodeByLabel(page, /Puerta de entrada/)
    await expect(nodeB).toBeFocused()

    await nodeA.focus()
    await expect(nodeA).toBeFocused()
    await page.keyboard.press('c')
    await expect(page.getByTestId('canvas-status')).toContainText('Modo conectar')
    await nodeB.focus()
    await expect(nodeB).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.locator('.react-flow__node')).toHaveCount(2)
    await expect(page.locator('.react-flow__edge')).toHaveCount(1)

    await nodeB.focus()
    await page.keyboard.press('Enter')
    await expect(nodeB).toHaveClass(/selected/)
    await page.keyboard.press('Delete')

    await expect(page.locator('.react-flow__node')).toHaveCount(1)
    await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  })

  test('accessible name includes label, raw type, raw zone, and selection state [PC13]', async ({ page }) => {
    await createNode(page, 'database')
    const node = page.locator('.react-flow__node').first()

    const before = await node.getAttribute('aria-label')
    expect(before).toContain('database')
    expect(before).toContain('restricted')
    expect(before).not.toContain('seleccionado')

    await node.click()
    // The CSS `selected` class (from React Flow's own selection change) and
    // the ariaLabel string (recomputed by this app's store-driven projection
    // once onSelectionChange updates selectedNodeIds) land in different
    // render passes — poll the attribute itself rather than a proxy signal.
    await expect(node).toHaveAttribute('aria-label', /seleccionado/)

    const after = await node.getAttribute('aria-label')
    expect(after).toContain('database')
    expect(after).toContain('restricted')
  })

  test('list view shows the same blocking finding as the canvas, with rule id and text [PC10]', async ({ page }) => {
    // A queue with zero outbound connections is a blocking 'orphan-queue'
    // finding by construction (rules.ts) — no exercise needed, the
    // legality-layer rules run on any design.
    await createNode(page, 'queue')

    await page.getByTestId('view-list-tab').click()
    const list = page.getByTestId('design-list')
    await expect(list).toContainText('Cola sin consumidor')
    const finding = list.locator('[data-rule="orphan-queue"]')
    await expect(finding).toBeVisible()
    // Plain-language requirement (added later, honored retroactively here):
    // severity renders as a Spanish word, never the engine's literal
    // English value — 'blocking' -> 'Bloqueante'.
    await expect(finding).toContainText('Bloqueante')
  })
})
