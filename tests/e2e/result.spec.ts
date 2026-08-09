// R1-E result panel — real pointer/keyboard only, real viewports, per this
// project's own convention. Covers the B3 blocker (score buried below the
// fold: measured at 1440×900 the first diagnostic sat at y=878 against a
// 900px-tall window, and at 900px width the score sat 1142px below the
// fold) and the "findings must point at the canvas" requirement (7 of 8
// prototype diagnoses required the player to translate prose into geometry
// by hand).
import { expect, test } from '@playwright/test'
import { createNode, nodeByLabel } from './helpers'

test.describe('La Forja — result panel [RK1 refs, B3 blocker]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  // The four widths the orchestrator asked to be measured for real —
  // heights chosen to reproduce the exact defect class (a viewport short
  // enough that a badly laid out result would fall below the fold).
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1280, 800],
    [900, 700],
  ] as const) {
    test(`the score is visible without scrolling at ${width}x${height} [B3]`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await createNode(page, 'service')
      await page.getByTestId('submit-button').click()

      const score = page.getByTestId('result-score')
      await expect(score).toBeVisible()
      // toBeInViewport, not just toBeVisible: toBeVisible only checks CSS
      // visibility, not that the element's box actually falls inside the
      // real browser viewport — the exact distinction the prototype's own
      // defect exploited (visible in the DOM, 1142px below the fold).
      await expect(score).toBeInViewport()
    })
  }

  test('submit switches to the Resultado tab and keeps the canvas mounted next to it', async ({ page }) => {
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('view-result-tab')).toHaveAttribute('aria-selected', 'true')
    // The canvas is NOT torn down when Resultado is active — this is what
    // lets a finding's hover highlight reach real canvas nodes.
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await expect(page.locator('.react-flow__node')).toHaveCount(1)
  })

  test('before any submission, the panel shows an honest empty state, not a blank box', async ({ page }) => {
    await page.getByTestId('view-result-tab').click()
    await expect(page.getByTestId('result-empty')).toBeVisible()
    await expect(page.getByTestId('result-empty')).toContainText('Probar respuesta')
  })

  test('an illegal design shows "illegal", no score, and still lists the blocking finding', async ({ page }) => {
    // A lone queue with zero outbound connections is a blocking
    // orphan-queue finding by construction (rules.ts) — no exercise
    // guarantee needed to trigger it.
    await createNode(page, 'queue')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('result-score')).toContainText('ilegal')
    const finding = page.locator('[data-testid^="finding-"][data-rule="orphan-queue"]')
    await expect(finding).toBeVisible()
  })

  test('hovering a finding dims every other node/edge on the canvas [findings point at the canvas]', async ({ page }) => {
    await createNode(page, 'queue')
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()

    const finding = page.locator('[data-testid^="finding-"][data-rule="orphan-queue"]')
    await finding.hover()

    // ForjaNode's own root div (carrying the opacity utility class) is a
    // child of React Flow's `.react-flow__node` wrapper, not that wrapper
    // itself — target the child that actually renders the style.
    const queueNode = nodeByLabel(page, /Cola de mensajes/).locator('> div').first()
    const serviceNode = nodeByLabel(page, /Servicio/).locator('> div').first()
    // The queue IS the finding's own node — never dimmed. The unrelated
    // service node is outside the finding's nodeIds — dimmed.
    await expect(queueNode).not.toHaveClass(/opacity-30/)
    await expect(serviceNode).toHaveClass(/opacity-30/)

    // A real pointer move away, not a synthetic dispatchEvent: `mouseleave`
    // does not bubble, so React's onMouseLeave is driven off real
    // mouseover/mouseout tracking — a raw dispatched 'mouseleave' bypasses
    // that mechanism entirely and never reaches the handler.
    await page.mouse.move(0, 0)
    await expect(serviceNode).not.toHaveClass(/opacity-30/)
  })

  test('clicking a finding selects its node, and the selection survives switching back to the canvas tab', async ({ page }) => {
    await createNode(page, 'queue')
    await page.getByTestId('submit-button').click()

    const finding = page.locator('[data-testid^="finding-"][data-rule="orphan-queue"]')
    await finding.click()

    // The canvas's own "Lienzo" tab has no dedicated testid (only list/
    // result do) — click it by its accessible name instead.
    await page.getByRole('tab', { name: 'Lienzo' }).click()

    const queueNode = nodeByLabel(page, /Cola de mensajes/)
    await expect(queueNode).toHaveAttribute('aria-label', /seleccionado/)
  })

  // "Free play without a loaded exercise produces no score" — /forja has no
  // real exercise content yet (R1-F ships the first one); until a level
  // route loads a real ExerciseSpec, every submission here is free play, and
  // free play MUST NOT present a numeric score, only legality and findings.
  test('a legal design in free play states plainly there is nothing to score against, with no per-axis result', async ({ page }) => {
    await createNode(page, 'service')
    await createNode(page, 'observability')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('result-score')).not.toContainText('100')
    await expect(page.getByTestId('result-no-exercise')).toBeVisible()
    await expect(page.getByTestId('result-no-exercise')).toContainText(/ejercicio cargado.*nada contra qué puntuar/i)
    await expect(page.getByTestId('result-axes')).toHaveCount(0)
  })

  // The exact defect the owner found live: a placeholder exercise with a
  // vacuously satisfiable guarantee (nothing of the type it asks about is
  // even on the canvas) awarded 100/100 to two components that were never
  // connected to each other.
  test('two unconnected components do not score 100 [free play never scores]', async ({ page }) => {
    await createNode(page, 'cache')
    await createNode(page, 'database')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('result-score')).not.toContainText('100')
    await expect(page.getByTestId('result-score')).not.toContainText('/ 100')
    await expect(page.getByTestId('result-no-exercise')).toBeVisible()
  })

  test('free play still reports legality — an illegal design is announced, not silently unscored', async ({ page }) => {
    await createNode(page, 'queue')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('result-score')).toContainText('ilegal')
    const finding = page.locator('[data-testid^="finding-"][data-rule="orphan-queue"]')
    await expect(finding).toBeVisible()
  })
})

// The verdict panel had zero `aria-live`, `role="status"`, `role="alert"`,
// `role="region"` and `aria-label` across 455 lines, and `handleSubmit`
// never wrote to the playground's own status bar. So the one gesture the
// product is built around reached assistive technology as an unnamed div
// appearing on the page, while focus stayed on a button whose neighbouring
// canvas had just been set to `display: none`. WCAG 4.1.3, level AA.
test.describe('La Forja: the verdict says it out loud [WCAG 4.1.3]', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forja')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('the always-mounted status region announces that the design was evaluated', async ({ page }) => {
    await createNode(page, 'service')
    await expect(page.getByTestId('canvas-status')).toContainText('creado')

    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('canvas-status')).toContainText('evaluado')
  })

  test('the panel is a named region, and its verdict is a live one', async ({ page }) => {
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()

    const panel = page.getByTestId('result-panel')
    await expect(panel).toHaveAttribute('role', 'region')
    await expect(panel).toHaveAttribute('aria-label', /.+/)
    await expect(page.getByTestId('result-score')).toHaveAttribute('role', 'status')
    await expect(page.getByTestId('result-score')).toHaveAttribute('aria-live', 'polite')
  })

  test('focus follows the verdict instead of staying on the button next to a hidden canvas', async ({ page }) => {
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('result-panel')).toBeFocused()
  })
})
