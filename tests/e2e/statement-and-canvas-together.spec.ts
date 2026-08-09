// The product's loop is statement, build, test. This file proves the player
// can see the first two steps at the same time, on arrival, with no gesture,
// and that the diagram is a workspace while they can.
//
// The arrangement this replaces was a 460px document column beside the canvas.
// Measured against a production build on
// `/forja/1/n1-el-comprobante-que-no-se-guarda` (canvas width, the zoom
// `fitView` settles on, and the on-screen size of a node title):
//
//   viewport   as a column                  out of the flow
//   1133       299px, zoom 0.26,  3.64px    783px, zoom 0.678,  9.49px
//   1344       510px, zoom 0.442, 6.19px    994px, zoom 0.862, 12.06px
//   1440       606px, zoom 0.525, 7.36px   1090px, zoom 0.943, 13.21px
//
// The old 460px column fits nowhere useful. The new 320px rail starts only at
// 1280px, where the canvas still clears its workspace floor; below it the
// measured overlay remains. This file keeps both adaptive modes honest.
//
// The third one is new and belongs to the card: a panel over a canvas covers
// the drawing. The mitigation is that the camera leaves the card's own
// footprint clear, so every node is reachable with the card open.
import { expect, test, type Page } from '@playwright/test'
import {
  FORJA_TOP_BAR_HEIGHT_PX,
  PLAYABLE_MIN_PX,
  WIDE_WORKBENCH_MIN_PX,
  briefCardIsBesideCanvas,
  workspaceCanvasWidth,
} from '../../src/lib/forja/canvas/forja-shell'
import { CANVAS_WORKSPACE_MIN_PX } from '../../src/lib/forja/canvas/responsive-layout'
import { waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/4/n4-el-pago-que-espera-al-email'

// The laptop widths this defect was reported on, plus the two the verdict used
// to blank the canvas at.
const WORKBENCH = [
  { width: 1133, height: 800 },
  { width: 1440, height: 900 },
  { width: 1512, height: 850 },
  { width: 1920, height: 1080 },
] as const

// What a pointer actually reaches at this point. The only check that tells
// "inside the window" apart from "inside the window but underneath something",
// which is how both previous shapes of this defect passed a box-only
// assertion.
async function whatIsAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y)
      if (!el) return 'nothing is painted here'
      if (el.closest('[data-testid="exercise-brief"]')) return 'the statement'
      // Before the bar, not after it: the submit button now lives INSIDE the
      // bar, so asking about its container first would answer every hit test
      // with "the top bar" and prove nothing.
      if (el.closest('[data-testid="submit-button"]')) return 'the submit button'
      if (el.closest('[data-testid="forja-topbar"]')) return 'the top bar'
      const node = el.closest('.react-flow__node')
      if (node) return `node ${node.getAttribute('data-id')}`
      return `<${el.tagName.toLowerCase()}${el.getAttribute('href') ? ` href=${el.getAttribute('href')}` : ''}>`
    },
    { x, y },
  )
}

async function openExercise(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height })
  await page.goto(EXERCISE)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  // React Flow animates its camera: a box read while it is moving says where
  // the element was.
  await waitForCanvasToSettle(page)
}

// "The statement starts visible and is not covered." Its first two elements,
// because a statement whose title is on screen and whose opening line is not
// has not started.
async function statementIsReadable(page: Page, height: number) {
  const brief = page.getByTestId('exercise-brief')
  const pairs = [
    ['the exercise title', brief.locator('h1')],
    ['the first line of the statement', page.getByTestId('exercise-body').locator('p').first()],
  ] as const
  for (const [name, locator] of pairs) {
    const box = (await locator.boundingBox())!
    expect(box, `${name} is rendered`).toBeTruthy()
    expect(box.y, `${name} starts below the shell's top bar`).toBeGreaterThanOrEqual(FORJA_TOP_BAR_HEIGHT_PX)
    expect(box.y + box.height, `${name} ends inside the window`).toBeLessThanOrEqual(height)
    expect(
      await whatIsAt(page, box.x + Math.min(10, box.width / 2), box.y + box.height / 2),
      `the pointer over ${name} reaches the statement`,
    ).toBe('the statement')
  }
}

test.describe('La Forja opens in its own full-screen shell', () => {
  for (const { width, height } of WORKBENCH) {
    test(`at ${width}x${height} the workbench takes the window and the page does not scroll`, async ({ page }) => {
      await openExercise(page, width, height)

      expect(
        await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
        'nothing on this page scrolls the page',
      ).toBe(true)

      // The shell carries its own identity, its own progress line and its own
      // way out, because the blog's navigation is deliberately not here.
      await expect(page.getByTestId('forja-topbar')).toBeVisible()
      await expect(page.getByTestId('forja-position')).toContainText('Nivel 4 ·')
      await expect(page.getByTestId('forja-back-to-blog')).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0)
    })

    test(`at ${width}x${height} the diagram is a workspace and the objective stays visible`, async ({ page }) => {
      await openExercise(page, width, height)
      await statementIsReadable(page, height)

      const pane = (await page.locator('.react-flow').boundingBox())!
      expect(pane.width, `the canvas clears its workspace floor at ${width}px`).toBeGreaterThanOrEqual(
        CANVAS_WORKSPACE_MIN_PX,
      )
      expect(pane.y, `the canvas starts under the top bar at ${width}px`).toBeGreaterThanOrEqual(
        FORJA_TOP_BAR_HEIGHT_PX,
      )
      expect(pane.y + pane.height, `the whole canvas is inside the window at ${width}px`).toBeLessThanOrEqual(height + 1)
    })

    test(`at ${width}x${height} the card never covers a piece of the diagram`, async ({ page }) => {
      // The declared risk of anchoring a panel over a canvas. From
      // a pane wide enough to pay for it, the camera leaves the card's own
      // footprint clear (forja-shell.ts), so this is the assertion that proves
      // the mitigation rather than the intention. On a narrower pane the card
      // deliberately overlays instead, because clearing it there was measured
      // to give a 385px diagram with 5.36px node titles.
      test.skip(
        width < WIDE_WORKBENCH_MIN_PX && !briefCardIsBesideCanvas(workspaceCanvasWidth(width)),
        'here the card overlays on purpose',
      )
      await openExercise(page, width, height)

      const pane = (await page.locator('.react-flow').boundingBox())!
      const nodes = page.locator('.react-flow__node')
      const count = await nodes.count()
      expect(count, 'the starting design has nodes').toBeGreaterThan(0)
      for (let i = 0; i < count; i++) {
        const id = await nodes.nth(i).getAttribute('data-id')
        const box = (await nodes.nth(i).boundingBox())!
        expect(box.y, `node ${id} top is inside the pane`).toBeGreaterThanOrEqual(pane.y - 0.5)
        expect(box.y + box.height, `node ${id} bottom is inside the pane`).toBeLessThanOrEqual(pane.y + pane.height + 0.5)
        expect(box.x, `node ${id} left is inside the pane`).toBeGreaterThanOrEqual(pane.x - 0.5)
        expect(box.x + box.width, `node ${id} right is inside the pane`).toBeLessThanOrEqual(pane.x + pane.width + 0.5)
        expect(
          await whatIsAt(page, box.x + box.width / 2, box.y + box.height / 2),
          `the pointer over node ${id} reaches it, not the objective card`,
        ).toBe(`node ${id}`)
      }
    })

    test(`at ${width}x${height} a real pointer on the primary action reaches it`, async ({ page }) => {
      // The defect that made a real click on "Probar respuesta" navigate to
      // /servicios was a stacking one, and moving the actions into the shell's
      // own bar is exactly the kind of change that can bring it back. A hit
      // test is the only assertion that can see it.
      await openExercise(page, width, height)
      const submit = (await page.getByTestId('submit-button').boundingBox())!
      expect(
        await whatIsAt(page, submit.x + submit.width / 2, submit.y + submit.height / 2),
        'a real pointer on "Probar respuesta" reaches the button',
      ).toBe('the submit button')
    })
  }

  test('at 390x844 the product is readable, not playable, and says so', async ({ page }) => {
    // PRODUCT.md: "Desktop first. On a small screen the product is readable,
    // not playable. This is a decided constraint, not a gap." What shipped
    // before was a silently broken canvas with 3.2px connection handles.
    expect(390).toBeLessThan(PLAYABLE_MIN_PX)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(EXERCISE)

    const brief = page.getByTestId('exercise-brief')
    await expect(brief).toBeVisible()
    await expect(brief.locator('h1')).toBeVisible()
    await expect(page.getByTestId('exercise-body')).toBeVisible()
    await expect(page.getByTestId('exercise-budget')).toBeVisible()

    // The canvas is not offered at all, rather than offered and broken.
    await expect(page.getByTestId('forja-canvas')).toBeHidden()

    // And the screen still goes somewhere: the map, this level, and the blog.
    await expect(page.getByRole('link', { name: 'Ver el mapa de niveles' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver el nivel 4' })).toBeVisible()
    await expect(page.getByTestId('forja-menu-toggle')).toBeVisible()
  })

  // Readable is not the same as told nothing. The bar hid the level and the
  // exercise below `md`, so the viewport most of this brand's first visits
  // arrive at was the one that could not read where it was, in a row that had
  // room for a menu, a theme switch and the way out. It is 11px of mono and
  // 11px of text.
  test('at 390x844 the bar still says which level and which exercise this is', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(EXERCISE)

    await expect(page.getByTestId('forja-position')).toBeVisible()
    await expect(page.getByTestId('forja-position')).toContainText('Nivel 4')
    await expect(page.getByTestId('forja-exercise-name')).toBeVisible()

    // Shown is not the same as readable. Squeezed into what a 390px row has
    // left after the mark, the menu, the theme switch and the way out, the
    // level line rendered as "Nivel 1…" in 59px: present, and saying nothing.
    // So on a phone it gets a line of its own, which costs nothing there
    // because the small screen is a reading screen with page scroll and no
    // canvas underneath to starve.
    const position = await page.getByTestId('forja-position').evaluate((el) => ({
      needs: el.scrollWidth,
      has: el.clientWidth,
    }))
    expect(position.has, 'the level line is not truncated at 390px').toBeGreaterThanOrEqual(position.needs)

    // Inside the row it was given, not overflowing it.
    const bar = (await page.getByTestId('forja-topbar').boundingBox())!
    for (const testId of ['forja-position', 'forja-exercise-name']) {
      const line = (await page.getByTestId(testId).boundingBox())!
      expect(line.x, testId).toBeGreaterThanOrEqual(bar.x - 0.5)
      expect(line.x + line.width, testId).toBeLessThanOrEqual(bar.x + bar.width + 0.5)
      expect(line.y + line.height, testId).toBeLessThanOrEqual(bar.y + bar.height + 0.5)
    }
  })

  // And the one row the shell declares is still one row where it matters: at
  // the playable width, where every pixel of chrome is a pixel the canvas does
  // not get. The phone has page scroll and no canvas, so it can afford two.
  test('the bar is still exactly one 72px row from the playable width up', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(EXERCISE)
    const bar = (await page.getByTestId('forja-topbar').boundingBox())!
    expect(Math.round(bar.height)).toBe(72)
  })

  // PRODUCT.md's own brand commitment: "La Forja opens full screen with its
  // own name, UNDER the Ingeniería sin Filtros brand". It lived only in the
  // document title, which is not a place a player reads.
  test('the shell says whose product it is, on screen and not only in the tab', async ({ page }) => {
    await page.goto(EXERCISE)
    await expect(page.getByTestId('forja-mark')).toContainText('La Forja')
    await expect(page.getByTestId('forja-mark')).toContainText('Ingeniería sin filtros')

    // Under the product's own name, and quieter than it: the window is La
    // Forja, the brand is whose it is.
    const sizes = await page.getByTestId('forja-mark').evaluate((el) => {
      const [name, brand] = Array.from(el.querySelectorAll('span'))
      return {
        nameSize: Number.parseFloat(getComputedStyle(name).fontSize),
        brandSize: Number.parseFloat(getComputedStyle(brand).fontSize),
        nameTop: name.getBoundingClientRect().top,
        brandTop: brand.getBoundingClientRect().top,
      }
    })
    expect(sizes.brandSize).toBeLessThan(sizes.nameSize)
    expect(sizes.brandTop).toBeGreaterThan(sizes.nameTop)
  })
})
