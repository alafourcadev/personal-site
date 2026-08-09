import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { exerciseSchema } from '../../src/lib/forja/content/exercise-schema'
import { evaluate } from '../../src/lib/forja/engine'
import type { Design, ExerciseSpec } from '../../src/lib/forja/engine/types'

const FILE = path.join(
  process.cwd(),
  'src/content/forja/exercises/n4-el-aviso-push-que-nadie-reintenta.md',
)

const { data } = matter(fs.readFileSync(FILE, 'utf8'))
const exercise = exerciseSchema.parse(data)
const spec: ExerciseSpec = {
  guarantees: exercise.guarantees,
  budget: exercise.budget,
  lambda: exercise.lambda,
}

describe('the push notification exercise', () => {
  it('rejects a queue-to-worker fragment and explains the missing delivery path', () => {
    const fragment: Design = {
      nodes: [
        {
          id: 'queue',
          type: 'queue',
          label: 'Cola',
          zone: 'private',
          props: { delivery: 'at-least-once', dlq: 'sí' },
        },
        {
          id: 'worker',
          type: 'worker',
          label: 'Worker',
          zone: 'private',
          props: {},
        },
      ],
      edges: [{ id: 'queue-worker', from: { node: 'queue' }, to: { node: 'worker' } }],
    }

    const result = evaluate(fragment, spec)
    expect(result.status).toBe('scored')
    expect(result.score).toBeLessThan(100)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        rule: 'guarantee-missing:g-end-to-end',
        why: expect.stringContaining('no un camino completo'),
      }),
    )
  })

  it('keeps every published reference solution at 100 with retained failures', () => {
    for (const solution of exercise.referenceSolutions) {
      const result = evaluate(solution.design as Design, spec)
      expect(result.status, solution.label).toBe('scored')
      expect(result.score, solution.label).toBe(100)
      expect(result.guarantees, solution.label).toContainEqual({
        id: 'g-has-dlq',
        satisfied: true,
        weight: 2,
      })
      expect(result.guarantees, solution.label).toContainEqual({
        id: 'g-end-to-end',
        satisfied: true,
        weight: 2,
      })
    }
  })
})
