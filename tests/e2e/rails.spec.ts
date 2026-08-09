// The workbench's two rails: the statement on the left, the tools on the right,
// each with a pleca on its own outer edge.
//
// The owner asked for it in these words: "el lienzo donde se desarrolla todo
// tenía como unos punticos para que se vea más lindo el playground, y la parte
// de las herramientas pueden estar a la derecha y el enunciado en la izquierda,
// y que tenga una pleca tipo `<` para que se esconda y exista más espacio para
// el playground, y `>` para esconder las herramientas".
//
// What this file holds the layout to, measured on a production build of
// `/forja/1/n1-el-comprobante-que-no-se-guarda` (canvas pane width, the zoom
// `fitView` settles on, and the on-screen size of a node title):
//
//   1440  statement open,   tools open     1140px  0.689   9.64px
//   1440  statement folded, tools open     1140px  1.102  15.43px
//   1133  statement open,   tools open      833px  0.797  11.16px
//
// The two folded-state numbers are the floor the owner set: the rails may not
// cost the diagram anything it used to have.
import { expect, test, type Page } from '@playwright/test'
import { CANVAS_WORKSPACE_MIN_PX, LIBRARY_WIDTH_PX, RAIL_PLECA_WIDTH_PX } from '../../src/lib/forja/canvas/responsive-layout'
import { RAIL_STORAGE_KEYS } from '../../src/lib/forja/canvas/rail-visibility'
import { STATEMENT_RAIL_WIDTH_PX } from '../../src/lib/forja/canvas/forja-shell'
import { waitForCanvasToSettle } from './helpers'

const EXERCISE = '/forja/1/n1-el-comprobante-que-no-se-guarda'
const ANOTHER_EXERCISE = '/forja/1/n1-la-consulta-que-saltea-la-puerta'

async function openExercise(page: Page, url = EXERCISE) {
  await page.goto(url)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
  await waitForCanvasToSettle(page)
}

// The React Flow pane's own box and the camera it settled on.
async function pane(page: Page) {
  return page.evaluate(() => {
    const box = document.querySelector('.react-flow')!.getBoundingClientRect()
    const viewport = document.querySelector('.react-flow__viewport') as HTMLElement
    return { width: Math.round(box.width), zoom: new DOMMatrixReadOnly(getComputedStyle(viewport).transform).a }
  })
}

// Waits for the camera to actually re-frame, rather than for the canvas to stop
// moving. The two are not the same thing right after a fold: the re-frame is
// scheduled behind a nested requestAnimationFrame, so "nothing has moved for
// two reads" is true for a moment BEFORE it starts, and a test that reads the
// zoom there reads the old one. Measured: it read the old zoom about one run in
// four. Polling the value that has to change tests the same behaviour without
// the race.
async function zoomGrowsPast(page: Page, previous: number) {
  await expect
    .poll(async () => (await pane(page)).zoom, { timeout: 10000 })
    .toBeGreaterThan(previous)
}

test.describe('La Forja: the statement is the left rail and the tools are the right one', () => {
  test('the statement starts at the workspace’s left edge and the tools end at its right', async ({ page }) => {
    await openExercise(page)

    const statement = (await page.getByTestId('exercise-brief').boundingBox())!
    const tools = (await page.getByTestId('forja-tools-rail').boundingBox())!
    const diagram = (await page.locator('.react-flow').boundingBox())!
    const window = page.viewportSize()!

    expect(statement.x, 'the statement is flush with the left edge').toBeLessThanOrEqual(1)
    expect(Math.round(tools.x + tools.width), 'the tools end at the right edge').toBe(window.width)
    // And the diagram is what is between them, which is the whole arrangement.
    expect(statement.x + statement.width, 'the statement is left of the diagram’s far side').toBeLessThan(
      diagram.x + diagram.width,
    )
    expect(tools.x, 'the tools are right of the diagram’s near side').toBeGreaterThan(diagram.x)
  })

  test('the wide statement is a real column and folding gives its surface to the diagram', async ({ page }) => {
    await openExercise(page)
    const open = await pane(page)
    await page.getByTestId('statement-toggle').click()
    await zoomGrowsPast(page, open.zoom)
    await waitForCanvasToSettle(page)
    const folded = await pane(page)

    expect(folded.width - open.width, 'the pane receives the statement surface').toBe(
      STATEMENT_RAIL_WIDTH_PX - RAIL_PLECA_WIDTH_PX,
    )
    expect(folded.zoom, 'the diagram grew into the room the fold released').toBeGreaterThan(open.zoom)
  })
})

test.describe('La Forja: the plecas', () => {
  test('each rail has one, on its own outer edge, and it points where the rail will go', async ({ page }) => {
    await openExercise(page)

    const statementPleca = page.getByTestId('statement-toggle')
    const toolsPleca = page.getByTestId('tools-pleca')

    // Open: each arrow points at the edge its rail is about to leave through.
    await expect(statementPleca).toHaveAttribute('data-pleca-direction', 'left')
    await expect(toolsPleca).toHaveAttribute('data-pleca-direction', 'right')

    const statement = (await page.getByTestId('exercise-brief').boundingBox())!
    const tools = (await page.getByTestId('forja-tools-rail').boundingBox())!
    const statementGrip = (await statementPleca.boundingBox())!
    const toolsGrip = (await toolsPleca.boundingBox())!

    expect(Math.round(statementGrip.x), 'the statement’s grip is on its right edge').toBe(
      Math.round(statement.x + statement.width),
    )
    expect(Math.round(toolsGrip.x), 'the tools’ grip is on their left edge').toBe(Math.round(tools.x))
  })

  test('the arrow turns round when the rail folds, on both rails', async ({ page }) => {
    await openExercise(page)

    await page.getByTestId('statement-toggle').click()
    await expect(page.getByTestId('statement-toggle')).toHaveAttribute('data-pleca-direction', 'right')

    await page.getByTestId('tools-pleca').click()
    await expect(page.getByTestId('tools-pleca')).toHaveAttribute('data-pleca-direction', 'left')
  })

  // The glyph is a picture, and a picture is not a name. Each pleca says which
  // rail it is and what pressing it will do.
  test('each pleca says what it does, and says the other thing once it is folded', async ({ page }) => {
    await openExercise(page)

    const tools = page.getByTestId('tools-pleca')
    await expect(tools).toHaveAccessibleName('Ocultar las herramientas')
    await expect(tools).toHaveAttribute('aria-expanded', 'true')
    await tools.click()
    await expect(tools).toHaveAccessibleName('Ver las herramientas')
    await expect(tools).toHaveAttribute('aria-expanded', 'false')

    const statement = page.getByTestId('statement-toggle')
    await expect(statement).toHaveAccessibleName('Ocultar consigna')
    await statement.click()
    await expect(statement).toHaveAccessibleName('Ver consigna')
  })

  // Every gesture in this playground has a keyboard equivalent, and a control
  // that takes a rail away must not be the one that breaks that.
  test('both plecas work from the keyboard and name the region they fold', async ({ page }) => {
    await openExercise(page)

    for (const testId of ['tools-pleca', 'statement-toggle']) {
      const pleca = page.getByTestId(testId)
      const controls = (await pleca.getAttribute('aria-controls'))!
      await expect(page.locator(`#${controls}`), testId).toBeVisible()

      await pleca.focus()
      await expect(pleca, testId).toBeFocused()
      await page.keyboard.press('Enter')

      await expect(pleca, testId).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator(`#${controls}`), testId).toBeHidden()
      await expect(pleca, `${testId} keeps the focus that pressed it`).toBeFocused()
    }
  })

  test('folding the tools gives the diagram nearly the whole rail, and the camera uses it', async ({ page }) => {
    await openExercise(page)
    const before = await pane(page)

    await page.getByTestId('tools-pleca').click()
    await zoomGrowsPast(page, before.zoom)
    await waitForCanvasToSettle(page)
    const after = await pane(page)

    expect(after.width - before.width, 'the diagram got the rail back but the grip').toBe(
      LIBRARY_WIDTH_PX - RAIL_PLECA_WIDTH_PX,
    )
    expect(after.zoom, 'and the diagram grew into it rather than sitting in a wider box').toBeGreaterThan(before.zoom)
  })
})

// An empty canvas tells the player where the components are. With the tools
// folded it has to name a route that is actually on screen, or it is sending
// them to a rail they just put away.
test.describe('La Forja: the empty canvas points somewhere real', () => {
  test('names the biblioteca while it is up, and the pleca once it is folded', async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()

    const hint = page.getByTestId('empty-canvas-hint')
    await expect(hint).toContainText('biblioteca')
    await expect(hint).not.toContainText('pleca')

    await page.getByTestId('tools-pleca').click()
    await expect(hint).toContainText('pleca')
    // And the other route it can still take, which needs nothing on screen.
    await expect(hint).toContainText('clic derecho')
  })
})

test.describe('La Forja: each rail is remembered on its own', () => {
  test('folding the tools says nothing about the statement, and the choice survives the next exercise', async ({
    page,
  }) => {
    await openExercise(page)
    await page.getByTestId('tools-pleca').click()

    const stored = async () =>
      page.evaluate((keys) => [localStorage.getItem(keys.tools), localStorage.getItem(keys.statement)], RAIL_STORAGE_KEYS)
    expect(await stored(), 'the tools remembered, the statement was never asked').toEqual(['1', null])

    await openExercise(page, ANOTHER_EXERCISE)
    await expect(page.getByTestId('tools-pleca')).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('statement-toggle')).toHaveAttribute('aria-expanded', 'true')
  })

  test('reopening the tools is remembered too, because that one is a choice as well', async ({ page }) => {
    await openExercise(page)
    await page.getByTestId('tools-pleca').click()
    await page.getByTestId('tools-pleca').click()

    await openExercise(page, ANOTHER_EXERCISE)
    await expect(page.getByTestId('tools-pleca')).toHaveAttribute('aria-expanded', 'true')
  })
})

test.describe('La Forja: the rail holds one tenant at a time', () => {
  test('the verdict takes the rail from the tools, and gives it straight back on close', async ({ page }) => {
    await openExercise(page)
    await expect(page.getByTestId('forja-tools-rail')).toBeVisible()

    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await expect(page.getByTestId('forja-tools-rail'), 'the tools stood down for the verdict').toHaveCount(0)
    // The canvas is the one thing that never gives up its box for either of them.
    await expect(page.locator('.react-flow')).toBeVisible()
    expect((await pane(page)).width).toBeGreaterThanOrEqual(CANVAS_WORKSPACE_MIN_PX)

    await page.getByTestId('close-result-panel').click()
    await expect(page.getByTestId('forja-tools-rail'), 'and got the rail back').toBeVisible()
    await expect(page.getByTestId('tools-pleca')).toHaveAttribute('aria-expanded', 'true')
  })

  // The state the player was building in is the state they are returned to.
  test('closing the verdict returns the tools folded if that is how they were left', async ({ page }) => {
    await openExercise(page)
    await page.getByTestId('tools-pleca').click()
    await expect(page.getByTestId('tools-pleca')).toHaveAttribute('aria-expanded', 'false')

    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await page.getByTestId('close-result-panel').click()

    await expect(page.getByTestId('tools-pleca')).toHaveAttribute('aria-expanded', 'false')
  })

  // What the one-tenant rule buys, measured rather than argued: the verdict used
  // to cost the diagram the tools rail as well as its own.
  test('the diagram keeps the tools rail’s width when the verdict opens', async ({ page }) => {
    await openExercise(page)
    const building = await pane(page)

    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible()
    await waitForCanvasToSettle(page)
    const evaluating = await pane(page)

    // The verdict replaces the tools and also folds the statement to its grip.
    // Both changes enlarge the diagram before the verdict asks the player to
    // inspect it.
    expect(evaluating.width).toBe(
      building.width + LIBRARY_WIDTH_PX - 380 + STATEMENT_RAIL_WIDTH_PX - RAIL_PLECA_WIDTH_PX,
    )
    expect(evaluating.width).toBeGreaterThan(760)
  })
})

// The defect this catches is not cosmetic. The statement rail is sized from the
// pane box the island publishes, so a rail that is accidentally in the layout
// flow takes height from the very pane whose height it is sized by. Measured
// once, before this test existed: the pane oscillated between 632px and 200px
// about every 5ms, for as long as the page was open, and the published box was
// whichever of the two the loop happened to stop on.
test.describe('La Forja: the published pane box is the real one', () => {
  for (const [width, height] of [
    [1133, 800],
    [1440, 900],
    [1512, 900],
  ] as const) {
    test(`at ${width}x${height} the geometry the rails read matches the pane they are anchored to`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height })
      await openExercise(page)

      const agreement = await page.evaluate(() => {
        const root = document.documentElement
        const read = (name: string) => Number.parseInt(root.style.getPropertyValue(name) || '-1', 10)
        const box = document.querySelector('[data-testid="forja-canvas"]')!.getBoundingClientRect()
        return {
          published: {
            top: read('--forja-pane-top'),
            left: read('--forja-pane-left'),
            width: read('--forja-pane-width'),
            height: read('--forja-pane-height'),
          },
          real: {
            top: Math.round(box.top),
            left: Math.round(box.left),
            width: Math.round(box.width),
            height: Math.round(box.height),
          },
        }
      })

      expect(agreement.published).toEqual(agreement.real)
      expect(agreement.real.height, 'and the pane is a real box, not a collapsed one').toBeGreaterThan(300)
    })
  }
})
