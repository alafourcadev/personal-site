// Design D9's TEST-FAILING gate class — needs the WHOLE exercise collection
// loaded at once, which a single entry's superRefine (exercise-schema.ts)
// never sees: role quotas per level, the contrasted tradeoff pair's context
// really flipping the winner, and the §13.10/EE10 publication test (every
// PILOT/PUBLISHED exercise's reference solutions both legal and exactly
// 100). Reads the markdown files directly via gray-matter (already a
// project dependency) rather than `astro:content`'s getCollection — the
// content layer's data store is a build/dev-server concern, and this stays
// a plain, fast Vitest file with no dependency on that runtime.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine'
import type { Design, ExerciseSpec } from '../../src/lib/forja/engine/types'
import { exerciseSchema, type ExerciseFrontmatter } from '../../src/lib/forja/content/exercise-schema'
import { requiredRoles } from '../../src/lib/forja/progression/unlock'
import { isPlayable } from '../../src/lib/forja/progression/types'

const EXERCISES_DIR = path.join(process.cwd(), 'src/content/forja/exercises')

function loadExercises(): (ExerciseFrontmatter & { file: string })[] {
  return fs
    .readdirSync(EXERCISES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(EXERCISES_DIR, file), 'utf-8')
      const { data } = matter(raw)
      // Re-runs the exact same admission gates content.config.ts's build
      // step does — if this throws, an exercise file regressed past a gate
      // without the build catching it, which should never happen but is
      // worth failing loudly on rather than silently skipping.
      return { file, ...exerciseSchema.parse(data) }
    })
}

function toExerciseSpec(exercise: ExerciseFrontmatter): ExerciseSpec {
  return { guarantees: exercise.guarantees, budget: exercise.budget, lambda: exercise.lambda }
}

describe('level 4 — beta composition (assertBetaComposition, floor is 8)', () => {
  // EC6: a DRAFT exercise exists in the same level (one is mid-authoring,
  // "El reintento que cobra dos veces") — beta composition counts only what
  // is actually playable (PILOT/PUBLISHED), same filter the level route
  // itself applies.
  const allLevel4 = loadExercises().filter((e) => e.level === 4)
  const exercises = allLevel4.filter((e) => isPlayable(e.status))

  it('has at least one DRAFT exercise not counted toward the beta floor', () => {
    expect(allLevel4.some((e) => e.status === 'DRAFT')).toBe(true)
    expect(allLevel4.length).toBeGreaterThan(exercises.length)
  })

  it('ships exactly 1 calibration + 4 core + 1 contrasted tradeoff pair (2) + 1 synthesis = 8 playable', () => {
    expect(exercises).toHaveLength(8)
    const countByRole = exercises.reduce<Record<string, number>>((acc, e) => {
      acc[e.role] = (acc[e.role] ?? 0) + 1
      return acc
    }, {})
    expect(countByRole.calibration).toBe(1)
    expect(countByRole.core).toBe(4)
    expect(countByRole.tradeoff).toBe(2)
    expect(countByRole.synthesis).toBe(1)
    expect(countByRole.trap ?? 0).toBe(0)
    expect(countByRole['counter-trap'] ?? 0).toBe(0)
  })

  it('core exercises span at least two business domains (the transfer requirement)', () => {
    const coreDomains = new Set(exercises.filter((e) => e.role === 'core').map((e) => e.domain))
    expect(coreDomains.size).toBeGreaterThanOrEqual(2)
  })

  it('unlock-by-role for this level never requires trap/counter-trap — beta ships none [C2]', () => {
    const required = requiredRoles(exercises.map((e) => e.role))
    expect(required).not.toContain('trap')
    expect(required).not.toContain('counter-trap')
    expect(required.sort()).toEqual(['calibration', 'core', 'synthesis', 'tradeoff'])
  })
})

describe('§13.10 / EE10 — the publication test, run against real content', () => {
  const playable = loadExercises().filter((e) => e.status === 'PILOT' || e.status === 'PUBLISHED')

  it('at least the 8 level-4 exercises are playable', () => {
    expect(playable.length).toBeGreaterThanOrEqual(8)
  })

  it.each(playable.map((e) => [e.title, e] as const))(
    '%s: both reference solutions are legal and score exactly 100',
    (_title, exercise) => {
      const spec = toExerciseSpec(exercise)
      expect(exercise.referenceSolutions.length).toBeGreaterThanOrEqual(2)
      for (const solution of exercise.referenceSolutions) {
        const result = evaluate(solution.design as Design, spec)
        expect(result.status).toBe('scored')
        expect(result.score).toBe(100)
      }
    },
  )
})

describe('the contrasted tradeoff pair — the context really inverts the winner', () => {
  const tradeoffs = loadExercises().filter((e) => e.role === 'tradeoff')

  it('exactly one pair, sharing one tradeoffPairId', () => {
    const byPair = new Map<string, ExerciseFrontmatter[]>()
    for (const e of tradeoffs) {
      const key = e.tradeoffPairId ?? '(missing)'
      byPair.set(key, [...(byPair.get(key) ?? []), e])
    }
    expect(byPair.size).toBe(1)
    const [members] = byPair.values()
    expect(members).toHaveLength(2)
  })

  it("A's winning solutions fail B's own guarantee, and B's fail A's — the winner genuinely flips", () => {
    const [a, b] = tradeoffs
    const specA = toExerciseSpec(a)
    const specB = toExerciseSpec(b)

    for (const solution of a.referenceSolutions) {
      const underB = evaluate(solution.design as Design, specB)
      expect(underB.score).not.toBe(100)
    }
    for (const solution of b.referenceSolutions) {
      const underA = evaluate(solution.design as Design, specA)
      expect(underA.score).not.toBe(100)
    }
  })
})
