// R1-G: a real level route loads a real exercise into the canvas —
// `LoadedExercise` is the minimal, serializable shape an Astro page hands
// to the React island (client:only, so props must be plain data — no
// functions), and `toExerciseSpec` is the pure adapter back to the
// engine's own `ExerciseSpec` input, mirroring the exact same mapping
// `tests/content/level-4-composition.test.ts` already proves at the
// content layer.
import { describe, expect, it } from 'vitest'
import { toExerciseSpec, type LoadedExercise } from '../../src/lib/forja/playground/loaded-exercise'

const exercise: LoadedExercise = {
  id: 'core-el-pago-que-espera-al-email',
  title: 'El pago que espera al email',
  guarantees: [
    {
      id: 'g1',
      label: 'la confirmación no depende del email',
      weight: 2,
      predicate: { op: 'exists', node: { type: ['service'] } },
      whyMissing: 'falta el componente durable',
      consequence: 'se pierde el aviso',
    },
  ],
  budget: { opsUnits: 8 },
  lambda: 0.5,
  startingDesign: { nodes: [{ id: 'given-1', type: 'service', label: 'Servicio de pagos', zone: 'private', props: {} }], edges: [] },
}

describe('toExerciseSpec', () => {
  it('projects only the fields the engine needs — guarantees, budget, lambda', () => {
    expect(toExerciseSpec(exercise)).toEqual({
      guarantees: exercise.guarantees,
      budget: exercise.budget,
      lambda: exercise.lambda,
    })
  })

  it('never leaks the exercise id, title or startingDesign into the engine-facing spec', () => {
    const spec = toExerciseSpec(exercise) as unknown as Record<string, unknown>
    expect(spec.id).toBeUndefined()
    expect(spec.title).toBeUndefined()
    expect(spec.startingDesign).toBeUndefined()
  })
})
