import { describe, expect, it } from 'vitest'
import { computeLedger } from '../../src/lib/forja/engine/score'
import type { Design, DesignEdge, DesignNode, ExerciseSpec, Guarantee } from '../../src/lib/forja/engine/types'

const node = (
  id: string,
  type: DesignNode['type'],
  zone: DesignNode['zone'],
  props: Record<string, string> = {},
  role?: string,
): DesignNode => ({ id, type, zone, label: id, props, role })

const edge = (from: string, to: string): DesignEdge => ({ id: `${from}->${to}`, from: { node: from }, to: { node: to } })
const design = (nodes: DesignNode[], edges: DesignEdge[] = []): Design => ({ nodes, edges })

// A single guarantee, satisfied whenever an `observability` node is `covered`
// by a `service` — deliberately structure-agnostic so two different legal
// topologies can both satisfy it (§13.10's "≥2 witnesses" publication test).
const coverageGuarantee: Guarantee = {
  id: 'g-coverage',
  label: 'El servicio crítico está observado',
  weight: 1,
  predicate: { op: 'covered', target: { type: ['service'] }, by: { type: ['observability'] } },
  whyMissing: 'El servicio crítico no está conectado a ningún componente de observabilidad.',
  consequence: 'No vas a saber que falló hasta que un usuario se queje.',
}

const exercise = (budgetOpsUnits: number): ExerciseSpec => ({
  guarantees: [coverageGuarantee],
  budget: { opsUnits: budgetOpsUnits },
  lambda: 0.5,
})

describe('forja engine — the analytic ceiling (EE10, §13.10 publication test)', () => {
  it('two structurally different legal designs both reach exactly 100', () => {
    const wired = design(
      [node('svc', 'service', 'private'), node('obs', 'observability', 'private')],
      [edge('svc', 'obs')],
    )
    const richer = design(
      [
        node('svc', 'service', 'private'),
        node('obs', 'observability', 'private'),
        node('worker', 'worker', 'private'),
      ],
      [edge('svc', 'obs'), edge('worker', 'svc')],
    )

    const a = computeLedger(wired, exercise(10), [])
    const b = computeLedger(richer, exercise(10), [])

    expect(a.score).toBe(100)
    expect(b.score).toBe(100)
  })

  it('an unsatisfied guarantee keeps the score below the ceiling', () => {
    const loose = design([node('svc', 'service', 'private'), node('obs', 'observability', 'private')])
    const result = computeLedger(loose, exercise(10), [])
    expect(result.score).toBeLessThan(100)
  })
})
