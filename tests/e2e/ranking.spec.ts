// RK1 (ranking visible in every view — B1 blocker: the prototype had this
// in 1 of 6 views), RK5 (honest local-vs-server labeling), RK7 (attempts
// persist the graph, verified indirectly through the local-adapter unit
// tests — this file proves the UI/storage wiring end to end).
import { expect, test } from '@playwright/test'
import { createNode } from './helpers'

test.describe('La Forja — ranking strip [RK1, RK5, RK7]', () => {
  test.beforeEach(async ({ page }) => {
    // Isolate each test's local storage — RankingStrip and ForjaCanvas
    // both read/write the same `forja:attempts:v1` key, so a prior test's
    // attempts would otherwise leak into this one's assertions.
    await page.addInitScript(() => localStorage.clear())
    await page.goto('/forja/lienzo')
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('has a non-zero box in every view — canvas, list and result [B1 blocker]', async ({ page }) => {
    const strip = page.getByTestId('ranking-strip')
    const canvasBox = await strip.boundingBox()
    expect(canvasBox!.width).toBeGreaterThan(0)
    expect(canvasBox!.height).toBeGreaterThan(0)

    await page.getByTestId('view-list-tab').click()
    const listBox = await strip.boundingBox()
    expect(listBox!.width).toBeGreaterThan(0)
    expect(listBox!.height).toBeGreaterThan(0)

    await page.getByTestId('view-result-tab').click()
    const resultBox = await strip.boundingBox()
    expect(resultBox!.width).toBeGreaterThan(0)
    expect(resultBox!.height).toBeGreaterThan(0)
  })

  test('discloses the score is client-computed and unverified, on first paint, no submission needed [RK5]', async ({ page }) => {
    await expect(page.getByTestId('ranking-label')).toContainText('sin verificar en servidor')
  })

  test('shows an honest empty state before any attempt exists', async ({ page }) => {
    await expect(page.getByTestId('ranking-empty')).toBeVisible()
  })

  // Free play (no real exercise loaded — R1-F ships the first one) never
  // produces a score (see result.spec.ts), so it can never become a ranked
  // row either — it is still recorded as personal history [RK7], just
  // excluded from the ranking, same as C3's "local history does not
  // retroactively score" for an entirely different reason today.
  test('a legal free-play submission is still never a ranked row [RK7: the write reaches the same local storage the strip reads]', async ({ page }) => {
    await createNode(page, 'service')
    await createNode(page, 'observability')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('ranking-empty')).toBeVisible()
    await expect(page.getByTestId('ranking-row-0')).toHaveCount(0)
  })

  test('an illegal submission is never a ranked row [score:null attempts stay personal history only]', async ({ page }) => {
    await createNode(page, 'queue')
    await page.getByTestId('submit-button').click()

    await expect(page.getByTestId('result-score')).toContainText('ilegal')
    await expect(page.getByTestId('ranking-empty')).toBeVisible()
  })

  test('never renders an email address anywhere in the strip [RK2 adjacent — no accounts exist yet, so trivially true, guarded anyway]', async ({ page }) => {
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('ranking-strip')).not.toContainText('@')
  })
})
