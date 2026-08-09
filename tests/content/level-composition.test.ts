// Design D9's TEST-FAILING gate class — needs the WHOLE exercise collection
// loaded at once, which a single entry's superRefine (exercise-schema.ts)
// never sees: role quotas per level, the contrasted tradeoff pair's context
// really flipping the winner, and the §13.10/EE10 publication test (every
// PILOT/PUBLISHED exercise's reference solutions both legal and exactly
// 100). Reads the markdown files directly via gray-matter (already a
// project dependency) rather than `astro:content`'s getCollection — the
// content layer's data store is a build/dev-server concern, and this stays
// a plain, fast Vitest file with no dependency on that runtime.
//
// Replaces level-4-composition.test.ts. That file hard-coded level 4 and
// asserted a single tradeoff pair across the entire project, which went red
// on the first exercise of any second level. The counting rules now live in
// progression/composition.ts and run once per level that ships content.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine'
import type { Design, ExerciseSpec } from '../../src/lib/forja/engine/types'
import { exerciseSchema, type ExerciseFrontmatter } from '../../src/lib/forja/content/exercise-schema'
import { compositionViolations } from '../../src/lib/forja/progression/composition'
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

const ALL = loadExercises()
const PLAYABLE = ALL.filter((e) => isPlayable(e.status))
// A level "ships" once it has any playable exercise. Levels still being
// authored are silent here rather than failing every run — the composition
// floor is a publication gate, not a work-in-progress alarm.
const SHIPPING_LEVELS = [...new Set(PLAYABLE.map((e) => e.level))].sort((a, b) => a - b)

describe('every shipping level meets the beta composition floor', () => {
  it('at least one level ships playable content', () => {
    expect(SHIPPING_LEVELS.length).toBeGreaterThanOrEqual(1)
  })

  // Levels 1 to 4 trade one core slot for the `greenfield` exercise that opens
  // on an empty canvas, so the tier is level-dependent and the level has to be
  // handed in.
  it.each(SHIPPING_LEVELS.map((level) => [level] as const))('level %i', (level) => {
    const violations = compositionViolations(ALL.filter((e) => e.level === level), level)
    expect(violations.map((v) => v.message)).toEqual([])
  })
})

describe('level 4 keeps a DRAFT that the floor never counts [EC6]', () => {
  it('has a DRAFT exercise excluded from the playable count', () => {
    const allLevel4 = ALL.filter((e) => e.level === 4)
    const playableLevel4 = allLevel4.filter((e) => isPlayable(e.status))
    expect(allLevel4.some((e) => e.status === 'DRAFT')).toBe(true)
    expect(allLevel4.length).toBeGreaterThan(playableLevel4.length)
  })
})

describe('§13.10 / EE10 — the publication test, run against real content', () => {
  it.each(PLAYABLE.map((e) => [e.title, e] as const))(
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

describe("the contrasted tradeoff pair — the context really inverts the winner", () => {
  // A level ships one pair at the beta tier and two at the complete tier, so
  // the unit checked here is the PAIR, not the level. Grouping by
  // tradeoffPairId also means a level halfway through its second pair is
  // reported by composition (wrong count) rather than silently skipped here.
  const pairs = (() => {
    const byId = new Map<string, typeof PLAYABLE>()
    for (const e of PLAYABLE.filter((x) => x.role === 'tradeoff')) {
      const key = `${e.level}:${e.tradeoffPairId ?? '(sin id)'}`
      byId.set(key, [...(byId.get(key) ?? []), e])
    }
    return [...byId.entries()].map(([key, members]) => [key, members] as const)
  })()

  it('every shipping level contributes at least one pair to check', () => {
    const levelsWithPairs = new Set(pairs.map(([key]) => Number(key.split(':')[0])))
    expect([...levelsWithPairs].sort((a, b) => a - b)).toEqual(SHIPPING_LEVELS)
  })

  it.each(pairs)('%s: both halves are present', (_key, members) => {
    expect(members).toHaveLength(2)
  })

  it.each(pairs.filter(([, m]) => m.length === 2))(
    "%s: A's winning solutions fail B's own guarantee, and B's fail A's",
    (_key, members) => {
      const [a, b] = members
      const specA = toExerciseSpec(a)
      const specB = toExerciseSpec(b)

      for (const solution of a.referenceSolutions) {
        expect(evaluate(solution.design as Design, specB).score).not.toBe(100)
      }
      for (const solution of b.referenceSolutions) {
        expect(evaluate(solution.design as Design, specA).score).not.toBe(100)
      }
    },
  )
})
