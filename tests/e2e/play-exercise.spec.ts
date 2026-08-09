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
import { connectByPointer, createNode, deleteEdgeByPointer, edgeByLabel, nodeByLabel } from './helpers'

const EXERCISES_DIR = path.join(process.cwd(), 'src/content/forja/exercises')

interface ReferenceSolution {
  label: string
  design: Design
}

interface RawExercise {
  guarantees: Guarantee[]
  referenceSolutions: ReferenceSolution[]
  // R1-H: the system the brief describes, already on the canvas — read here
  // (not hardcoded) so a fixture drift between the test and the real content
  // file fails loudly instead of silently testing the wrong shape.
  startingDesign: Design
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
    startingDesign: normalizeDesign(data.startingDesign),
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
  // Was "the brief shows context, ROLE, budget and constraints". The role
  // was removed on purpose: it is authoring metadata, and naming a trap to
  // the player destroys the exercise — the same spoiler the level list
  // dropped, which survived one click into this page. So the assertion is
  // inverted and made stricter than the original: the brief must state the
  // business domain in the player's own language, and must NOT contain any
  // of the role words. (tests/progression/no-role-spoiler.test.ts gates the
  // rendered component; this gates the real page a player loads.)
  test('the brief shows context, domain, budget and constraints — and never the exercise’s role', async ({ page }) => {
    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
    await expect(page.getByTestId('exercise-brief')).toBeVisible()
    await expect(page.getByTestId('exercise-brief')).toContainText('El pago que espera al email')
    await expect(page.getByTestId('exercise-domain-tag')).toContainText('Pagos')
    await expect(page.getByTestId('exercise-role-tag')).toHaveCount(0)
    for (const spoiler of ['Núcleo', 'Trampa', 'Contra-trampa', 'Calibración', 'Síntesis']) {
      await expect(page.getByTestId('exercise-brief'), `the brief names the role "${spoiler}"`).not.toContainText(spoiler)
    }
    // The number itself belongs to the author, not to this test. Budgets get
    // retuned (level 4's dropped from 8 to 6 when its slack was tightened), and
    // a literal here makes a rendering test fail for a content reason. What this
    // test owns is that the budget reaches the page as a readable figure.
    await expect(page.getByTestId('exercise-budget')).toContainText(/\d+ unidades operativas/)
    await expect(page.getByTestId('exercise-budget')).not.toContainText('opsUnits')
    const constraints = page.getByTestId('exercise-constraint')
    await expect(constraints.first()).toBeVisible()
    await expect(page.getByTestId('exercise-body')).toContainText('proveedor de email')
  })

  test('from the level list, clicking an exercise opens its own play route', async ({ page }) => {
    await page.goto('/forja/4')
    const link = page.getByTestId('exercise-list-link').first()
    // The link's own href, not a shape guess. The old pattern was
    // `[a-z-]+`, which stopped matching the moment the files were renamed to
    // carry their level (`n4-…`) — and a pattern is a weaker claim anyway:
    // what "clicking an exercise opens ITS OWN play route" means is that the
    // page we land on is the one the entry pointed at.
    const href = await link.getAttribute('href')
    expect(href).toMatch(/^\/forja\/4\/[a-z0-9-]+$/)
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
    await expect(page.getByTestId('exercise-brief')).toBeVisible()
    await expect(page.getByTestId('forja-canvas')).toBeVisible()
  })

  // R1-H — the defect this file's whole describe block exists to close: a
  // fresh visit used to start with an EMPTY canvas, and no player gesture
  // could ever give a player-created node a `role` — so a role-anchored
  // guarantee (this exercise has one) could never be satisfied by playing,
  // no matter what got built. Now the exercise's own startingDesign — the
  // system its brief describes, defect and all — is what a fresh visit
  // shows.
  test('a fresh visit starts with the exercise\'s own starting design, not an empty canvas [R1-H]', async ({ page }) => {
    const exercise = loadExercise('n4-el-pago-que-espera-al-email')
    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
    await expect(page.locator('.react-flow__node')).toHaveCount(exercise.startingDesign.nodes.length)
    await expect(page.locator('.react-flow__edge')).toHaveCount(exercise.startingDesign.edges.length)
    await expect(nodeByLabel(page, /Servicio de pagos/)).toBeVisible()
    await expect(nodeByLabel(page, /Proveedor de email/)).toBeVisible()
  })

  // Every guarantee is written with two sentences and the player only ever
  // read one. `whyMissing` names what the design fails to do; `consequence`
  // names who pays for it, and 612 of them sat in the corpus unreachable:
  // required by the type, required by the content schema, dropped by the
  // finding builder and absent from the panel. This asserts the second
  // sentence against the exercise file itself, so a finding that quietly
  // stops carrying it fails here rather than in a reading of the corpus.
  test('a missed guarantee tells the player what it costs, not only what is missing', async ({ page }) => {
    const exercise = loadExercise('n4-el-pago-que-espera-al-email')
    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
    await expect(page.locator('.react-flow__node')).toHaveCount(exercise.startingDesign.nodes.length)

    // The starting design is the broken system the brief describes, so
    // submitting it untouched is the shortest real path to a missed
    // guarantee.
    await page.getByTestId('submit-button').click()

    const durable = exercise.guarantees.find((g) => g.id === 'g-no-volatile-cut')!
    const finding = page.locator('[data-testid^="finding-"][data-rule="guarantee-missing:g-no-volatile-cut"]')
    await expect(finding).toBeVisible()
    await expect(finding).toContainText(durable.whyMissing)
    await expect(finding).toContainText(durable.consequence)
  })

  // The core deliverable: two structurally distinct reference solutions of
  // the SAME exercise both reach 100/100, through the interface.
  test.describe('n4-el-pago-que-espera-al-email — both reference solutions score 100 through the UI', () => {
    const exercise = loadExercise('n4-el-pago-que-espera-al-email')

    for (const [index, solution] of exercise.referenceSolutions.entries()) {
      test(`solution ${index + 1} — "${solution.label}"`, async ({ page }) => {
        await loadAndSubmit(page, 'n4-el-pago-que-espera-al-email', solution.design)
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

  test('the mini-ADR rejects trivial answers without erasing what the player wrote', async ({ page }) => {
    test.setTimeout(60_000)
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const exercise = loadExercise('n4-el-pago-que-espera-al-email')
    await loadAndSubmit(page, 'n4-el-pago-que-espera-al-email', exercise.referenceSolutions[0].design)
    await expect(page.getByTestId('result-score-value')).toContainText('100')

    const form = page.getByTestId('mini-adr')
    await expect(form.locator('textarea')).toHaveCount(4)
    const fields = [
      ['optimized', 'a'],
      ['sacrificed', 'b'],
      ['whoPays', 'c'],
      ['inversionFact', 'd'],
    ] as const
    for (const [name, value] of fields) {
      await form.locator(`textarea[name="${name}"]`).fill(value)
      expect(pageErrors, `the form crashed after editing ${name}`).toEqual([])
    }

    await form.getByRole('button', { name: 'Guardar defensa' }).click()
    await expect(form.getByRole('alert')).toHaveCount(4)
    for (const [name, value] of fields) {
      await expect(form.locator(`textarea[name="${name}"]`)).toHaveValue(value)
    }
    await expect(form.getByRole('alert').first()).toContainText(
      'Escribí al menos dos palabras concretas',
    )

    await form.locator('textarea[name="optimized"]').fill('Menos espera')
    await form.locator('textarea[name="sacrificed"]').fill('Más costo')
    await form.locator('textarea[name="whoPays"]').fill('El equipo')
    await form.locator('textarea[name="inversionFact"]').fill('Si falla')
    await form.getByRole('button', { name: 'Guardar defensa' }).click()
    await expect(form.getByRole('status')).toContainText('Defensa guardada')
  })

  // A second, distinct exercise — required to be a member of the
  // contrasted tradeoff pair.
  test.describe('n4-el-stock-que-hay-que-saber-ya — both reference solutions score 100 through the UI', () => {
    const exercise = loadExercise('n4-el-stock-que-hay-que-saber-ya')

    for (const [index, solution] of exercise.referenceSolutions.entries()) {
      test(`solution ${index + 1} — "${solution.label}"`, async ({ page }) => {
        await loadAndSubmit(page, 'n4-el-stock-que-hay-que-saber-ya', solution.design)
        await expect(page.getByTestId('result-score-value')).toContainText('100')
        await expect(page.getByTestId('result-score-value')).toContainText('/ 100')
      })
    }
  })

  // R1-H's defining proof: a human path from the starting design to 100,
  // using ONLY pointer gestures the same way a player would — no
  // localStorage seeding, no fixture, no shortcut. Before this slice this
  // was IMPOSSIBLE: the canvas opened empty, and no gesture could give a
  // player-created node the `role` a guarantee anchors on, so the
  // role-anchored guarantee below was permanently stuck at "unsatisfied".
  // Two exercises, one of them the contrasted tradeoff pair's own member.
  test.describe('the human path to 100 — no seeding, only pointer gestures [R1-H]', () => {
    test('n4-el-pago-que-espera-al-email: fixing the direct connection to the email provider reaches 100', async ({ page }) => {
      const exercise = loadExercise('n4-el-pago-que-espera-al-email')
      await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
      await expect(page.locator('.react-flow__node')).toHaveCount(exercise.startingDesign.nodes.length)

      // The exact defect the brief describes: payment waits directly on the
      // email provider, nothing durable in between. Delete that edge first.
      await deleteEdgeByPointer(page, edgeByLabel(page, 'Servicio de pagos a Proveedor de email'))
      await expect(page.locator('.react-flow__edge')).toHaveCount(exercise.startingDesign.edges.length - 1)

      // Rebuild a durable path: pagos -> cola -> procesador -> proveedor,
      // plus observability on the payment service — the same shape as
      // reference solution 1, built by hand instead of loaded from a fixture.
      // React Flow briefly re-measures every edge whenever a new node
      // mounts, so each node's own visibility is awaited before the next
      // gesture — a real player's own click-then-look pacing, not a
      // shortcut.
      await createNode(page, 'queue')
      await expect(nodeByLabel(page, /Cola de mensajes/)).toBeVisible()
      await createNode(page, 'worker')
      await expect(nodeByLabel(page, /Procesador/)).toBeVisible()
      await createNode(page, 'observability')
      await expect(nodeByLabel(page, /Observabilidad/)).toBeVisible()

      // PC7's real fit-to-content: the new pieces spread further down the
      // canvas than the container's own visible height — the same "pan
      // without manual panning" gesture a real player uses (Controls'
      // fit-view button), not a test-only shortcut.
      //
      // `toBeInViewport` is NOT enough to make the drags below safe: it
      // passes the instant a node's box overlaps the window, while the
      // camera and the page's own smooth auto-scroll are both still moving.
      // Waiting for those to stop is connectByPointer's own job now (see
      // waitForCanvasToSettle in helpers.ts), which is what makes every drag
      // land on the handle it aimed at instead of where it used to be.
      await page.locator('.react-flow__controls-fitview').click()
      await expect(nodeByLabel(page, /Servicio de pagos/)).toBeInViewport({ timeout: 10000 })
      await expect(nodeByLabel(page, /Cola de mensajes/)).toBeInViewport({ timeout: 10000 })

      await connectByPointer(page, nodeByLabel(page, /Servicio de pagos/), nodeByLabel(page, /Cola de mensajes/))
      await expect(edgeByLabel(page, 'Servicio de pagos a Cola de mensajes')).toBeVisible()
      await connectByPointer(page, nodeByLabel(page, /Cola de mensajes/), nodeByLabel(page, /Procesador/))
      await expect(edgeByLabel(page, 'Cola de mensajes a Procesador')).toBeVisible()
      await connectByPointer(page, nodeByLabel(page, /Procesador/), nodeByLabel(page, /Proveedor de email/))
      await expect(edgeByLabel(page, 'Procesador a Proveedor de email')).toBeVisible()
      await connectByPointer(page, nodeByLabel(page, /Servicio de pagos/), nodeByLabel(page, /Observabilidad/))
      await expect(edgeByLabel(page, 'Servicio de pagos a Observabilidad')).toBeVisible()

      await page.getByTestId('submit-button').click()

      await expect(page.getByTestId('result-score-value')).toContainText('100')
      await expect(page.getByTestId('result-score-value')).toContainText('/ 100')
      for (const guarantee of exercise.guarantees) {
        await expect(page.getByTestId(`axis-${guarantee.id}`)).toContainText('✓')
      }
    })

    test('n4-el-stock-que-hay-que-saber-ya: connecting checkout straight to inventory reaches 100', async ({ page }) => {
      const exercise = loadExercise('n4-el-stock-que-hay-que-saber-ya')
      await page.goto('/forja/4/n4-el-stock-que-hay-que-saber-ya')
      await expect(page.locator('.react-flow__node')).toHaveCount(exercise.startingDesign.nodes.length)

      // This exercise's own guarantee starts unsatisfied: checkout and
      // inventory exist (their roles given), but nothing connects them yet.
      await createNode(page, 'observability')
      await expect(nodeByLabel(page, /Observabilidad/)).toBeVisible()
      await page.locator('.react-flow__controls-fitview').click()
      await expect(nodeByLabel(page, /Servicio de checkout/)).toBeInViewport({ timeout: 10000 })
      await expect(nodeByLabel(page, /Servicio de inventario/)).toBeInViewport({ timeout: 10000 })
      await connectByPointer(page, nodeByLabel(page, /Servicio de checkout/), nodeByLabel(page, /Servicio de inventario/))
      await expect(edgeByLabel(page, 'Servicio de checkout a Servicio de inventario')).toBeVisible()
      await connectByPointer(page, nodeByLabel(page, /Servicio de checkout/), nodeByLabel(page, /Observabilidad/))
      await expect(edgeByLabel(page, 'Servicio de checkout a Observabilidad')).toBeVisible()

      await page.getByTestId('submit-button').click()

      await expect(page.getByTestId('result-score-value')).toContainText('100')
      await expect(page.getByTestId('result-score-value')).toContainText('/ 100')
      for (const guarantee of exercise.guarantees) {
        await expect(page.getByTestId(`axis-${guarantee.id}`)).toContainText('✓')
      }
    })
  })

  test('an illegal design in a loaded exercise reports illegal, never a partial score', async ({ page }) => {
    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
    await createNode(page, 'queue') // a lone queue is a blocking orphan-queue finding by construction
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-score')).toContainText('ilegal')
    await expect(page.getByTestId('result-axes')).toHaveCount(0)
  })

  test('a legal but incomplete design scores below 100 with at least one unsatisfied axis shown', async ({ page }) => {
    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
    await createNode(page, 'service') // legal alone, satisfies none of this exercise's guarantees
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('result-axes')).toBeVisible()
    // At least one axis unsatisfied is the direct, unambiguous proof of
    // "not a perfect design" — more robust than string-matching the score
    // number itself, which can appear as a substring of other numbers.
    await expect(page.getByTestId('result-axes').locator('li', { hasText: '✗' }).first()).toBeVisible()
  })

  test('leaving and returning to the same exercise keeps the design [volver y seguir]', async ({ page }) => {
    const exercise = loadExercise('n4-el-pago-que-espera-al-email')
    const startingCount = exercise.startingDesign.nodes.length

    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
    await createNode(page, 'service')
    await expect(page.locator('.react-flow__node')).toHaveCount(startingCount + 1)

    // A real navigation away and back — never reload() alone, which would
    // not exercise the "left the page" path at all.
    // The way back to the level lives in the shell's own menu now: La Forja
    // opens full screen and does not inherit the blog's chrome.
    await page.getByTestId('forja-menu-toggle').click()
    await page.getByTestId('forja-menu-level').click()
    await expect(page).toHaveURL(/\/forja\/4$/)
    await page.goBack()

    await expect(page.getByTestId('forja-canvas')).toBeVisible()
    await expect(page.locator('.react-flow__node')).toHaveCount(startingCount + 1)
  })

  // R1-H item 4: reset goes back to the starting design without leaving the
  // page — and "volver y seguir" (above) still restores the player's own
  // edits on a real navigation, proving reset and continue are distinct
  // paths that don't interfere with each other.
  test('resetting an exercise restores the starting design and discards the player\'s edits', async ({ page }) => {
    const exercise = loadExercise('n4-el-pago-que-espera-al-email')
    const startingCount = exercise.startingDesign.nodes.length

    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
    await createNode(page, 'service')
    await createNode(page, 'queue')
    await expect(page.locator('.react-flow__node')).toHaveCount(startingCount + 2)

    await page.getByTestId('reset-exercise-button').click()

    await expect(page.locator('.react-flow__node')).toHaveCount(startingCount)
    await expect(nodeByLabel(page, /Servicio de pagos/)).toBeVisible()
    await expect(page.getByTestId('canvas-status')).toContainText('reiniciado')

    // The reset itself is a real page state, not a page reload — a real
    // navigation away and back must show the RESET state (starting design),
    // never the pre-reset edits, proving reset persists like any other
    // "volver y seguir" state.
    await page.getByTestId('forja-menu-toggle').click()
    await page.getByTestId('forja-menu-level').click()
    await page.goBack()
    await expect(page.locator('.react-flow__node')).toHaveCount(startingCount)
  })

  test('the loaded exercise never contaminates free play at /forja', async ({ page }) => {
    await page.goto('/forja/4/n4-el-pago-que-espera-al-email')
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
