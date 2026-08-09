// Declaring what travels through a connection — the gesture 16 exercises
// teach and the playground did not have.
//
// The measured defect this suite exists for: a level-3 player swept right
// click, left click, double click, Enter, F2, Space, loose keys and the list
// view over a connection and found nothing, while the exercise's own statement
// spent two paragraphs on "the problem is not visible in the diagram — it is
// visible in WHAT CLASS OF DATA travels through that connection". Every
// connection a player drew therefore kept the note "Falta declarar qué dato
// viaja" forever, and three blocking engine rules were unreachable.
//
// Real right-clicks and real keys only, like context-menu.spec.ts: the
// prototype's B-class bugs were all invisible to synthetic dispatch.
import { expect, test, type Page } from '@playwright/test'
import { createNode, nodeByLabel, waitForCanvasToSettle } from './helpers'

// A connection between two pieces that are legal together and in the same
// trust zone, so nothing else is blocking and the data class is the only
// variable. Built through the context menu's own "Conectar con…", which is the
// gesture context-menu.spec.ts already proves creates a real edge.
async function connectTwo(page: Page, sourceType: string, targetType: string, sourceLabel: RegExp, targetLabel: RegExp) {
  await createNode(page, sourceType)
  await createNode(page, targetType)
  const source = nodeByLabel(page, sourceLabel)
  const target = nodeByLabel(page, targetLabel)
  await source.click({ button: 'right' })
  await page.getByTestId('context-menu-item-connect').click()
  await target.click()
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await waitForCanvasToSettle(page)
}

// The pointer affordance every connection has (EdgeHitTargets) — the layer
// that made 73 of 964 otherwise unreachable connections clickable. A
// right-click has to reach the same target a left-click does.
const edgeHitTarget = (page: Page) => page.locator('[data-edge-hit]').first()

test.describe('La Forja canvas — declaring the data class of a connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('right-clicking a connection opens the CONNECTION menu, not the canvas menu', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)

    await edgeHitTarget(page).click({ button: 'right' })

    const menu = page.getByTestId('context-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByTestId('context-menu-item-data-class-regulated')).toBeVisible()
    // The pane's "add component" menu is what a right-click near a connection
    // used to open, because no onEdgeContextMenu ever existed.
    await expect(menu.getByTestId('context-menu-item-add-database')).toHaveCount(0)
    // Nor the node menu.
    await expect(menu.getByTestId('context-menu-item-duplicate')).toHaveCount(0)
  })

  test('declaring a class labels the connection on the canvas, in the player s words', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)

    await edgeHitTarget(page).click({ button: 'right' })
    await page.getByTestId('context-menu-item-data-class-regulated').click()

    // Visible on the drawing itself — the requirement is that a player can read
    // what travels where WITHOUT opening a menu per connection.
    await expect(page.locator('.react-flow__edge-text')).toHaveText('dato regulado')
    // And audible, for someone who has no drawing to read.
    await expect(page.locator('.react-flow__edge').first()).toHaveAttribute('aria-label', /dato regulado/)
    await expect(page.getByTestId('canvas-status')).toContainText('Declaraste dato regulado')
    // Zero engine vocabulary on screen.
    await expect(page.getByTestId('forja-canvas')).not.toContainText('regulated')
  })

  test('declaring closes the "Falta declarar" note the connection carried', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)

    await page.getByTestId('view-list-tab').click()
    const list = page.getByTestId('design-list')
    await expect(list.locator('[data-rule="undeclared-data-class"]')).toHaveCount(1)

    // From the list view's own control — the pointer-free surface.
    await list.locator('select').first().selectOption('public')

    await expect(list.locator('[data-rule="undeclared-data-class"]')).toHaveCount(0)
    await expect(page.getByTestId('canvas-status')).toContainText('Declaraste dato público')
  })

  test('the keyboard reaches the same menu and declares the same class', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)

    // Walk the real tab order until focus lands on a connection. React Flow
    // gives every focusable edge `tabindex="0"` and renders the whole edge
    // layer BEFORE the node layer, so from the node the last gesture left
    // focused, the connections are BACKWARDS — measured in the production
    // build: Shift+Tab, Shift+Tab from the target node lands on the edge,
    // while Tab goes straight past every node to the zoom controls. Forward is
    // tried afterwards anyway so the test does not encode that order as a
    // requirement; what it asserts is that a keyboard alone gets there.
    const onEdge = () =>
      page.evaluate(() => Boolean(document.activeElement?.classList.contains('react-flow__edge')))
    let focused = await onEdge()
    for (const key of ['Shift+Tab', 'Tab'] as const) {
      for (let press = 0; press < 20 && !focused; press++) {
        await page.keyboard.press(key)
        focused = await onEdge()
      }
    }
    expect(focused, 'a connection is reachable with the keyboard alone').toBe(true)

    // The same key that opens a node's menu — one rule, not a second shortcut.
    await page.keyboard.press('Shift+F10')
    const menu = page.getByTestId('context-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitemradio').first()).toBeFocused()

    // público -> personal -> regulado
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(menu.getByTestId('context-menu-item-data-class-regulated')).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.locator('.react-flow__edge-text')).toHaveText('dato regulado')
  })

  test('Escape closes the connection menu and puts focus back on the connection', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)

    await edgeHitTarget(page).click({ button: 'right' })
    await expect(page.getByTestId('context-menu')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByTestId('context-menu')).toHaveCount(0)
    await expect(page.locator('.react-flow__edge').first()).toBeFocused()
  })

  test('a declared class can be taken back, and the note comes back with it', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)
    await edgeHitTarget(page).click({ button: 'right' })
    await page.getByTestId('context-menu-item-data-class-public').click()
    await expect(page.locator('.react-flow__edge-text')).toHaveCount(1)

    await edgeHitTarget(page).click({ button: 'right' })
    // The "Sin declarar" item only exists once there IS something to undo.
    await page.getByTestId('context-menu-item-data-class-clear').click()

    await expect(page.locator('.react-flow__edge-text')).toHaveCount(0)
    await expect(page.getByTestId('canvas-status')).toContainText('Quitaste la clase de dato')
  })

  // The second-order effect, and the reason the gesture does not behave like
  // the connection-refusal precedent: declaring the truth can turn a scored
  // design into an illegal one. The declaration must still commit — otherwise
  // the game teaches that the way to stay legal is to not say what travels.
  test('a declaration that turns the design illegal is kept, and the status bar explains why', async ({ page }) => {
    await connectTwo(page, 'service', 'cache', /Servicio/, /Caché/)

    await edgeHitTarget(page).click({ button: 'right' })
    await page.getByTestId('context-menu-item-data-class-personal').click()

    const status = page.getByTestId('canvas-status')
    await expect(status).toContainText('Declaraste dato personal')
    await expect(status).toContainText('no apareció un problema nuevo, se volvió visible el que ya estaba')
    await expect(status).toContainText('Bloqueante: Dato sensible en almacenamiento volátil')
    // Kept, not refused: the label is on the connection and the store holds it.
    await expect(page.locator('.react-flow__edge-text')).toHaveText('dato personal')
  })

  // The label is rendered by React Flow's own EdgeText, which measures its
  // text box ONCE per label value — so anything that re-mounts or re-measures
  // the edge layer while the pane has no box is where a label can silently
  // stop being drawn. Switching to the list view and back is exactly that
  // gesture, and it is the one that once turned 7 nodes and 3 tabs into 0.
  test('the label survives leaving the canvas tab and coming back', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)
    await edgeHitTarget(page).click({ button: 'right' })
    await page.getByTestId('context-menu-item-data-class-regulated').click()
    await expect(page.locator('.react-flow__edge-text')).toHaveText('dato regulado')

    await page.getByTestId('view-list-tab').click()
    await page.getByTestId('view-result-tab').click()
    await page.locator('[role="tab"]', { hasText: 'Lienzo' }).click()

    await expect(page.locator('.react-flow__edge-text')).toHaveText('dato regulado')
  })

  test('the declaration is undoable, like every other mutation', async ({ page }) => {
    await connectTwo(page, 'web-client', 'api-gateway', /Cliente web/, /Puerta de entrada/)
    await edgeHitTarget(page).click({ button: 'right' })
    await page.getByTestId('context-menu-item-data-class-secret').click()
    await expect(page.locator('.react-flow__edge-text')).toHaveText('dato secreto')

    await page.getByTestId('undo-button').click()

    await expect(page.locator('.react-flow__edge-text')).toHaveCount(0)
  })
})
