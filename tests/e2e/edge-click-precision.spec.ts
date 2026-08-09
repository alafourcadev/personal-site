// Clicking a connection selected a different connection six times out of ten.
//
// Found by playing, not by reading: aiming at the middle of the cable from
// "App de familias" to "Servicio de calificaciones" and pressing Delete
// removed "de Consola del docente a Puerta de entrada", and the submit that
// followed declared the design illegal, with no score, for a mistake the
// player had not made. Quantified afterwards at 59.7% mean accuracy over 19 points per
// path, with the two worst paths at 42%.
//
// The cause is placement, not size: the targets are 24px wide and only kept
// 24px apart, so neighbours overlap, and the browser resolves an overlap by
// paint order: the connection drawn last answers for every point it covers,
// including the exact centre of the one drawn first. The targets stay 24px
// (WCAG 2.5.8, measured 24.0x24.0 at 1440 and at 390); what changed is who
// wins, which edge-hit.ts's `ownerOfPointer` decides by distance to centre.
//
// The exercise below carries 13 connections over 11 components, the densest
// starting design in the corpus, so overlapping targets are the normal case
// here rather than a contrived one.
//
// One fresh page per click on purpose. Selecting a connection re-projects
// every edge, which re-measures every target: clicking thirteen in a row
// measures that recompute rather than the hit test, and it is the hit test
// that was broken.
import { expect, test } from '@playwright/test'

const EXERCISE = '/forja/8/n8-el-grupo-hotelero-que-freno-la-cola-de-todos'

test.describe('La Forja: a click on a connection lands on THAT connection [N2]', () => {
  test('every connection’s own target selects its own connection, all 13 of them', async ({ page }) => {
    test.slow()
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(EXERCISE)
    await expect(page.getByTestId('forja-canvas')).toBeVisible()

    const targets = page.locator('[data-edge-hit]')
    await expect(targets.first()).toBeVisible()
    const edgeIds = await targets.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-edge-hit')!))
    expect(edgeIds.length).toBeGreaterThanOrEqual(13)

    // The arrangement the browser resolves by paint order, and the one that
    // let a player delete a connection they had not clicked: one target's box
    // sitting over another target's centre. `pickHitPoint` slides a target
    // along its own cable to avoid exactly this, and nothing had ever checked
    // in a browser that it succeeds. Measured across the 24 densest starting
    // designs in the corpus it does, with 23.7px the tightest pair seen.
    const overlaps = await targets.evaluateAll((nodes) => {
      const boxes = nodes.map((n) => n.getBoundingClientRect())
      let count = 0
      for (const [i, a] of boxes.entries()) {
        for (const [j, b] of boxes.entries()) {
          if (i === j) continue
          const cx = b.left + b.width / 2
          const cy = b.top + b.height / 2
          if (cx >= a.left && cx <= a.right && cy >= a.top && cy <= a.bottom) count += 1
        }
      }
      return count
    })
    expect(overlaps, 'a target is sitting on another target’s centre').toBe(0)

    const wrong: string[] = []
    for (const id of edgeIds) {
      await page.goto(EXERCISE)
      await expect(page.getByTestId('forja-canvas')).toBeVisible()
      const target = page.locator(`[data-edge-hit="${id}"]`)
      await expect(target).toBeVisible()
      await target.click()
      await page
        .waitForFunction(
          (expected) => document.querySelector('.react-flow__edge.selected')?.getAttribute('data-id') === expected,
          id,
          { timeout: 3000 },
        )
        .catch(() => {})
      const selected = await page.evaluate(
        () => document.querySelector('.react-flow__edge.selected')?.getAttribute('data-id') ?? null,
      )
      if (selected !== id) wrong.push(`${id} -> ${selected ?? 'nothing'}`)
    }

    expect(wrong, `connections that handed the click to somebody else:\n${wrong.join('\n')}`).toEqual([])
  })
})
