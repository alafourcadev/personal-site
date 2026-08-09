// Every guarantee declares two sentences, and only one of them was ever
// reachable. `whyMissing` says what the design does not do; `consequence`
// says what that costs the business. It is required, non-empty, in the
// `Guarantee` type (types.ts) and in the content schema, so all 612 of them
// across the corpus are written. The finding built for a missed guarantee
// carried `why` and dropped the other half on the floor.
//
// The teaching difference: "no hay ningún camino desde la app de familias
// hasta el servicio de calificaciones que pase por una puerta de entrada"
// versus "sacar el atajo sin poner el camino correcto deja a 900 familias
// sin poder ver una nota". The engine already knew the second one.
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine/index'
import type { Design, ExerciseSpec } from '../../src/lib/forja/engine/types'

const exercise: ExerciseSpec = {
  guarantees: [
    {
      id: 'g-coverage',
      label: 'El servicio crítico está observado',
      weight: 1,
      predicate: { op: 'covered', target: { type: ['service'] }, by: { type: ['observability'] } },
      whyMissing: 'El servicio crítico no está conectado a ningún componente de observabilidad.',
      consequence: 'Nadie se entera de que se cayó hasta que lo cuenta un cliente.',
    },
  ],
  budget: { opsUnits: 10 },
  lambda: 0.5,
}

const missing: Design = {
  nodes: [{ id: 'svc', type: 'service', zone: 'private', label: 'Servicio', props: {} }],
  edges: [],
}

describe('a missed guarantee', () => {
  it('carries the consequence the exercise wrote for it, not only the rule it broke', () => {
    const finding = evaluate(missing, exercise).findings.find((f) => f.rule === 'guarantee-missing:g-coverage')

    expect(finding?.consequence).toBe('Nadie se entera de que se cayó hasta que lo cuenta un cliente.')
  })

  // A guarantee whose consequence went missing must not print the word
  // "undefined" at the player: absent is absent, and the panel renders
  // nothing rather than a placeholder.
  it('leaves the consequence absent rather than empty when the exercise has none', () => {
    const withoutConsequence: ExerciseSpec = {
      ...exercise,
      guarantees: [{ ...exercise.guarantees[0], consequence: '' }],
    }
    const finding = evaluate(missing, withoutConsequence).findings.find(
      (f) => f.rule === 'guarantee-missing:g-coverage',
    )

    expect(finding?.consequence).toBeUndefined()
  })
})
