import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { exerciseSchema, type ExerciseFrontmatter } from '../../src/lib/forja/content/exercise-schema'
import type { Design, ExerciseSpec } from '../../src/lib/forja/engine/types'
import {
  bestPlayerReachableReference,
  NO_NODE_PROPERTY_CAPABILITY,
} from '../../src/lib/forja/playground/constructibility'

const EXERCISES_DIR = join(process.cwd(), 'src/content/forja/exercises')

function load(id: string): ExerciseFrontmatter {
  return exerciseSchema.parse(matter(readFileSync(join(EXERCISES_DIR, `${id}.md`), 'utf8')).data)
}

function specOf(exercise: ExerciseFrontmatter): ExerciseSpec {
  return { guarantees: exercise.guarantees, budget: exercise.budget, lambda: exercise.lambda }
}

const GREENFIELD_PROPERTY_CASES = [
  'n2-las-dos-areas-que-arrancan-el-mismo-lunes',
  'n3-el-laboratorio-que-todavia-entrega-en-mano',
  'n4-la-tienda-que-todavia-no-vendio-nada',
] as const

describe('reference constructibility admission', () => {
  it.each(GREENFIELD_PROPERTY_CASES)('%s has a 100-point path with the public property controls', (id) => {
    const exercise = load(id)
    const results = exercise.referenceSolutions.map((solution) =>
      bestPlayerReachableReference(
        exercise.startingDesign as Design,
        solution.design as Design,
        specOf(exercise),
      ),
    )

    expect(results.some((result) => result.evaluation.status === 'scored' && result.evaluation.score === 100)).toBe(true)
  })

  it.each(GREENFIELD_PROPERTY_CASES)('%s is rejected if node property controls disappear', (id) => {
    const exercise = load(id)
    const results = exercise.referenceSolutions.map((solution) =>
      bestPlayerReachableReference(
        exercise.startingDesign as Design,
        solution.design as Design,
        specOf(exercise),
        NO_NODE_PROPERTY_CAPABILITY,
      ),
    )

    expect(results.every((result) => result.evaluation.score !== 100)).toBe(true)
  })
})
