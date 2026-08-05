// R1-G — the last piece of R1: a real exercise is actually PLAYABLE, not
// just readable. The defining proof the orchestrator asked for: both
// reference solutions of a real exercise score exactly 100 THROUGH THE
// INTERFACE (page.goto -> build -> submit -> read the panel), not just in
// a module test. Loading a reference solution onto the canvas reuses the
// exact same mechanism that satisfies "volver y seguir" (requirement 6):
// LocalRankingAdapter's own storage key, read by the app's own
// continuedDesign() on mount — never a test-only backdoor into production
// code. If a reference solution built this way scored anything other than
// 100, that would mean the UI sends the engine something different from
// what content.config.ts's build-time gate already proved scores 100 — the
// exact class of defect this file exists to catch.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { expect, test, type Page } from '@playwright/test'
import { STORAGE_KEY } from '../../src/lib/forja/ranking/local-adapter'
import type { Design, DesignNode, Guarantee } from '../../src/lib/forja/engine/types'
import { createNode } from './helpers'

const EXERCISES_DIR = path.join(process.cwd(), 'src/content/forja/exercises')

interface ReferenceSolution {
  label: string
  design: Design
}

interface RawExercise {
  guarantees: Guarantee[]
  referenceSolutions: ReferenceSolution[]
}

// Deliberately NOT `exerciseSchema.parse()` (tests/content/*.test.ts's own
// pattern) — that schema imports `astro:content`, a virtual module Vite/
// Astro resolves but Playwright's plain Node/tsx test runner cannot. Reads
// the same raw YAML gray-matter already gives tests/content/level-4-
// composition.test.ts, with the one normalization content.config.ts's
// build-time Zod schema also applies: a node with no explicit `props:`
// defaults to `{}` (never `undefined`, which the engine's rules would
// throw on for a type it actually reads props from).
function normalizeDesign(raw: { nodes: DesignNode[]; edges?: Design['edges'] }): Design {
  return {
    nodes: raw.nodes.map((node) => ({ ...node, props: node.props ?? {} })),
    edges: raw.edges ?? [],
  }
}

function loadExercise(id: string): RawExercise {
  const file = fs.readFileSync(path.join(EXERCISES_DIR, `${id}.md`), 'utf-8')
  const { data } = matter(file)
  return {
    guarantees: data.guarantees,
    referenceSolutions: (data.referenceSolutions as { label: string; design: Design }[]).map((solution) => ({
      label: solution.label,
      design: normalizeDesign(solution.design),
    })),
  }
}

// Seeds the exact localStorage key/shape LocalRankingAdapter itself reads
// and writes (STORAGE_KEY is exported from local-adapter.ts specifically so
// this never duplicates the string literal) — the page must already be on
// the target origin before this runs.
async function seedContinuedDesign(page: Page, exerciseId: string, design: Design) {
  await page.evaluate(
    ({ key, exerciseId, design }) => {
      const attempt = {
        id: 'seed-reference-solution',
        exerciseId,
        design,
        score: null,
        ceiling: 100,
        engineVersion: 'seed',
        createdAt: new Date().toISOString(),
      }
      window.localStorage.setItem(key, JSON.stringify([attempt]))
    },
    { key: STORAGE_KEY, exerciseId, design },
  )
}

async function loadAndSubmit(page: Page, exerciseId: string, design: Design) {
  const url = `/forja/4/${exerciseId}`
  await page.goto(url)
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await seedContinuedDesign(page, exerciseId, design)
  await page.goto(url) // real navigation, not reload(), so the fresh island mount reads the seeded history like a real "leave and come back"
  await expect(page.getByTestId('forja-canvas')).toBeVisible()
  await expect(page.locator('.react-flow__node')).toHaveCount(design.nodes.length)
  await page.getByTestId('submit-button').click()
}

test.describe('La Forja — playing a real loaded exercise [R1-G]', () => {
  test('the brief shows context, role, budget and constraints before building anything', async ({ page }) => {
    await page.goto('/forja/4/core-el-pago-que-espera-al-email')
    await expect(page.getByTestId('exercise-brief')).toBeVisible()
    await expect(page.getByTestId('exercise-brief')).toContainText('El pago que espera al email')
    await expect(page.getByTestId('exercise-role-tag')).toContainText('Núcleo')
    await expect(page.getByTestId('exercise-budget')).toContainText('8 unidades operativas')
    await expect(page.getByTestId('exercise-budget')).not.toContainText('opsUnits')
    const constraints = page.getByTestId('exercise-constraint')
    await expect(constraints.first()).toBeVisible()
    await expect(page.getByTestId('exercise-body')).toContainText('proveedor de email')
  })

  test('from the level list, clicking an exercise opens its own play route', async ({ page }) => {
    await page.goto('/forja/4')
    await page.getByTestId('exercise-list-link').first().click()
    await expect(page).toHaveURL(/\/forja\/4\/[a-z-]+$/)
    await expect(page.getByTestId('exercise-brief')).toBeVisible()
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  test('a fresh visit starts with an empty canvas — a level route never carries the free-play placeholder', async ({ page }) => {
    await page.goto('/forja/4/core-el-pago-que-espera-al-email')
    await expect(page.locator('.react-flow__node')).toHaveCount(0)
  })

  // The core deliverable: two structurally distinct reference solutions of
  // the SAME exercise both reach 100/100, through the interface.
  test.describe('core-el-pago-que-espera-al-email — both reference solutions score 100 through the UI', () => {
    const exercise = loadExercise('core-el-pago-que-espera-al-email')

    for (const [index, solution] of exercise.referenceSolutions.entries()) {
      test(`solution ${index + 1} — "${solution.label}"`, async ({ page }) => {
        await loadAndSubmit(page, 'core-el-pago-que-espera-al-email', solution.design)
        await expect(page.getByTestId('result-score-value')).toContainText('100')
        await expect(page.getByTestId('result-score-value')).toContainText('/ 100')
        await expect(page.getByTestId('result-axes')).toBeVisible()
        // Every axis this exercise declares must show as satisfied — a
        // partial 100 (some axis unsatisfied but the budget bonus made up
        // for it) would still be a real defect this test must catch.
        const axisCount = await page.getByTestId('result-axes').locator('li').count()
        expect(axisCount).toBe(exercise.guarantees.length)
        for (const guarantee of exercise.guarantees) {
          await expect(page.getByTestId(`axis-${guarantee.id}`)).toContainText('✓')
        }
      })
    }
  })

  // A second, distinct exercise — required to be a member of the
  // contrasted tradeoff pair.
  test.describe('tradeoff-el-stock-que-hay-que-saber-ya — both reference solutions score 100 through the UI', () => {
    const exercise = loadExercise('tradeoff-el-stock-que-hay-que-saber-ya')

    for (const [index, solution] of exercise.referenceSolutions.entries()) {
      test(`solution ${index + 1} — "${solution.label}"`, async ({ page }) => {
        await loadAndSubmit(page, 'tradeoff-el-stock-que-hay-que-saber-ya', solution.design)
        await expect(page.getByTestId('result-score-value')).toContainText('100')
        await expect(page.getByTestId('result-score-value')).toContainText('/ 100')
      })
    }
  })

  test('an illegal design in a loaded exercise reports illegal, never a partial score', async ({ page }) => {
    await page.goto('/forja/4/core-el-pago-que-espera-al-email')
    await createNode(page, 'queue') // a lone queue is a blocking orphan-queue finding by construction
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-score')).toContainText('ilegal')
    await expect(page.getByTestId('result-axes')).toHaveCount(0)
  })

  test('a legal but incomplete design scores below 100 with at least one unsatisfied axis shown', async ({ page }) => {
    await page.goto('/forja/4/core-el-pago-que-espera-al-email')
    await createNode(page, 'service') // legal alone, satisfies none of this exercise's guarantees
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-axes')).toBeVisible()
    // At least one axis unsatisfied is the direct, unambiguous proof of
    // "not a perfect design" — more robust than string-matching the score
    // number itself, which can appear as a substring of other numbers.
    await expect(page.getByTestId('result-axes').locator('li', { hasText: '✗' }).first()).toBeVisible()
  })

  test('leaving and returning to the same exercise keeps the design [volver y seguir]', async ({ page }) => {
    await page.goto('/forja/4/core-el-pago-que-espera-al-email')
    await createNode(page, 'service')
    await expect(page.locator('.react-flow__node')).toHaveCount(1)

    // A real navigation away and back — never reload() alone, which would
    // not exercise the "left the page" path at all.
    await page.getByRole('link', { name: /Nivel 4/ }).click()
    await expect(page).toHaveURL(/\/forja\/4$/)
    await page.goBack()

    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await expect(page.locator('.react-flow__node')).toHaveCount(1)
  })

  test('the loaded exercise never contaminates free play at /forja', async ({ page }) => {
    await page.goto('/forja/4/core-el-pago-que-espera-al-email')
    await createNode(page, 'service')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-axes')).toBeVisible()

    await page.goto('/forja')
    await createNode(page, 'cache')
    await createNode(page, 'database')
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-no-exercise')).toBeVisible()
    await expect(page.getByTestId('result-axes')).toHaveCount(0)
  })
})
