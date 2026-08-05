// Shared helpers for the /forja canvas Playwright suite. Every coordinate
// used to drive `page.mouse` is computed from real, rendered bounding boxes
// — never a synthetic dispatchEvent. That distinction is the whole point of
// this suite: the prototype's connection-delete bug (B4) was invisible to
// synthetic click dispatch and only reproducible with a real pointer.
import type { Locator, Page } from '@playwright/test'

export async function createNode(page: Page, type: string) {
  await page.getByTestId(`palette-item-${type}`).click()
}

export async function createNodeByKeyboard(page: Page, type: string) {
  await page.getByTestId(`palette-item-${type}`).focus()
  await page.keyboard.press('Enter')
}

// Scoped to `.react-flow__node` and matched on rendered text, not
// accessible name: an edge's aria-label ("Conexión de X a Y") can contain a
// node's label as a substring, so getByRole('group', { name }) is
// ambiguous between a node and an edge that happens to touch it.
export function nodeByLabel(page: Page, label: string | RegExp) {
  return page.locator('.react-flow__node').filter({ hasText: label }).first()
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('locator has no bounding box — is it rendered?')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

// Real pointer drag from a source node's right handle to a target node's
// left handle — React Flow's own connection dragging is pointer-event
// based, so raw page.mouse actions exercise the exact same path a real
// player's mouse would.
export async function connectByPointer(page: Page, source: Locator, target: Locator) {
  const from = await centerOf(source.locator('.react-flow__handle-right'))
  const to = await centerOf(target.locator('.react-flow__handle-left'))
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

// Maps an SVG edge path's real midpoint to viewport coordinates via its
// screen CTM, so a subsequent page.mouse.click() lands ON the rendered
// curve — not on the bounding box of the whole SVG layer.
export async function edgeMidpoint(edge: Locator) {
  return edge.locator('.react-flow__edge-interaction, .react-flow__edge-path').first().evaluate((raw) => {
    const el = raw as unknown as SVGPathElement
    const svg = el.ownerSVGElement
    if (!svg) throw new Error('edge path is not inside an SVG')
    const length = el.getTotalLength()
    const point = el.getPointAtLength(length / 2)
    const screenPoint = svg.createSVGPoint()
    screenPoint.x = point.x
    screenPoint.y = point.y
    const ctm = el.getScreenCTM()
    if (!ctm) throw new Error('no screen CTM — element is not rendered')
    const mapped = screenPoint.matrixTransform(ctm)
    return { x: mapped.x, y: mapped.y }
  })
}
