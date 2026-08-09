// What the player actually READS on a box and over a band. Both were proved
// by unit maths (tests/canvas/band-label-position.test.ts,
// tests/canvas/player-vocabulary-ui.test.ts) and both were still wrong in the
// browser, because the maths was never wired to the pixels:
//
//   - a node that kept its default name printed that name twice, once as its
//     title and again as the first half of the line under it. Measured in the
//     production build over 24 exercises x 4 widths: 92 of 96 framings.
//   - the infrastructure band — where the databases and the queues live — was
//     drawn on a phone as a strip of colour with no name on it, because
//     "Infraestructura" is 122px wide and a phone gives each band 101–124px.
//     24 of the same 96 framings had a band on screen without a name.
//
// Real viewports, real production build (playwright.config.ts's webServer),
// no synthetic events.
import { expect, test } from '@playwright/test'
import { createNode, nodeByLabel, waitForCanvasToSettle } from './helpers'
import { PLAYABLE_MIN_PX } from '../../src/lib/forja/canvas/forja-shell'

const EXERCISE = '/forja/4/n4-el-pago-que-espera-al-email'

test.describe('La Forja — a node never prints its own name twice', () => {
  test('a component taken from the library says its name once, and its zone under it', async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await createNode(page, 'database')

    const node = nodeByLabel(page, /Base de datos/)
    await expect(node.locator('p').first()).toHaveText('núcleo restringido')
  })

  test('a node the player named keeps BOTH its name and what kind of piece it is', async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await createNode(page, 'database')

    page.once('dialog', (dialog) => dialog.accept('Base de pedidos'))
    await nodeByLabel(page, /Base de datos/).click({ button: 'right' })
    await page.getByTestId('context-menu-item-rename').click()

    const renamed = nodeByLabel(page, /Base de pedidos/)
    await expect(renamed.locator('p').first()).toHaveText('Base de datos · núcleo restringido')
  })

  test('no box in a real starting design repeats its own title', async ({ page }) => {
    await page.goto(EXERCISE)
    await waitForCanvasToSettle(page)

    const repeats = await page.evaluate(() =>
      [...document.querySelectorAll('.react-flow__node')]
        .map((n) => ({
          title: n.querySelector('span')?.textContent?.trim() ?? '',
          subtitle: n.querySelector('p')?.textContent?.trim() ?? '',
        }))
        .filter((n) => n.title.length > 0 && n.subtitle.startsWith(`${n.title} ·`))
        .map((n) => `${n.title} // ${n.subtitle}`),
    )

    expect(repeats).toEqual([])
  })

  test('the list view prints the same identity, without a third copy of the name', async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await createNode(page, 'database')
    await page.getByTestId('view-list-tab').click()

    await expect(page.getByTestId('design-list').getByRole('listitem').first()).toContainText(
      'Base de datos · núcleo restringido',
    )
  })
})

// The framing this defect was measured in: at 390px this exercise settles at
// zoom 0.32, which puts all three bands on screen at 116px each — 6px short of
// "Infraestructura" at the label's own size.
const THREE_BAND_PHONE_EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'

// What every band label must be able to say about itself, whatever the
// framing: which band it names, where it is, and how much of that band the
// player can actually see.
const bandLabelGeometry = () => {
  const pane = document.querySelector('[data-testid="forja-canvas"]')!.getBoundingClientRect()
  const view = document.querySelector('.react-flow__viewport')!
  const m = new DOMMatrixReadOnly(getComputedStyle(view).transform)
  const BAND_WIDTH = 360
  const order = ['business', 'application', 'infrastructure']
  const labels = new Map(
    [...document.querySelectorAll('[data-testid^="band-label-"]')].map((el) => {
      const r = el.getBoundingClientRect()
      return [
        (el as HTMLElement).dataset.testid!.replace('band-label-', ''),
        { fontPx: getComputedStyle(el).fontSize, text: el.textContent ?? '', left: r.left, right: r.right },
      ]
    }),
  )
  return order.map((band, index) => {
    const left = pane.left + m.e + index * BAND_WIDTH * m.a
    const right = left + BAND_WIDTH * m.a
    return {
      band,
      left,
      right,
      onScreen: Math.min(right, pane.right) - Math.max(left, pane.left),
      width: BAND_WIDTH * m.a,
      paneLeft: pane.left,
      paneRight: pane.right,
      label: labels.get(band) ?? null,
    }
  })
}

// The narrowest pane the product actually offers. Below it La Forja is
// readable and not playable (PRODUCT.md), so there is no canvas to name bands
// on: what used to be measured at 390px is measured here, which is where the
// bands are now narrowest.
const NARROWEST_PLAYABLE = { width: PLAYABLE_MIN_PX, height: 900 }

test.describe('La Forja — every band on screen carries its own name', () => {
  test('all three bands are named on the narrowest pane the product offers', async ({ page }) => {
    await page.setViewportSize(NARROWEST_PLAYABLE)
    await page.goto(THREE_BAND_PHONE_EXERCISE)
    await waitForCanvasToSettle(page)

    await expect(page.getByTestId('band-label-business')).toHaveText('Negocio')
    await expect(page.getByTestId('band-label-application')).toHaveText('Aplicación')
    await expect(page.getByTestId('band-label-infrastructure')).toHaveText('Infraestructura')
  })

  test('the names stay whole words, never an abbreviation', async ({ page }) => {
    // The band names ARE the model this product teaches, and the brand rule
    // keeps canonical architectural terms intact. What gives on a narrow
    // viewport is the type size, never the term.
    await page.setViewportSize(NARROWEST_PLAYABLE)
    await page.goto(THREE_BAND_PHONE_EXERCISE)
    await waitForCanvasToSettle(page)

    const label = page.getByTestId('band-label-infrastructure')
    await expect(label).toHaveText('Infraestructura')
    const clipped = await label.evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    expect(clipped).toBe(false)
  })

  for (const [width, height] of [
    [PLAYABLE_MIN_PX, 1024],
    [1024, 800],
    [1280, 720],
  ] as const) {
    test(`at ${width}px a band the player can see is a band with a name on it`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto(THREE_BAND_PHONE_EXERCISE)
      await waitForCanvasToSettle(page)
      await expect(page.getByTestId('band-label-business')).toBeVisible()

      const bands = await page.evaluate(bandLabelGeometry)

      for (const band of bands) {
        // A band more than half past the pane's edge is peeking, not on
        // screen: the player pans and it comes back, named, at full size.
        if (band.onScreen < band.width / 2) continue
        expect(band.label, `${band.band} at ${width}px`).not.toBeNull()
        // Inside the pane, and over the band it is naming — a name drawn past
        // its own band's right edge is labelling the wrong band.
        expect(band.label!.left).toBeGreaterThanOrEqual(Math.max(band.left, band.paneLeft) - 0.5)
        expect(band.label!.right).toBeLessThanOrEqual(Math.min(band.right, band.paneRight) + 0.5)
      }

      const sizes = new Set(bands.filter((b) => b.label).map((b) => b.label!.fontPx))
      expect(sizes.size, `one size for the whole row at ${width}px`).toBe(1)
    })
  }

  test('a desktop pane never pays for the phone: the row keeps its full size', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto(THREE_BAND_PHONE_EXERCISE)
    await waitForCanvasToSettle(page)
    await expect(page.getByTestId('band-label-business')).toBeVisible()

    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid^="band-label-"]')].map((el) => getComputedStyle(el).fontSize),
    )

    expect(sizes.length).toBeGreaterThan(0)
    expect(new Set(sizes)).toEqual(new Set(['12px']))
  })
})
