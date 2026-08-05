import { describe, expect, it } from 'vitest'
import { checkConnection, evaluate } from '../../src/lib/forja/engine/index'
import type { Design, DesignEdge, DesignNode, ExerciseSpec } from '../../src/lib/forja/engine/types'

const node = (
  id: string,
  type: DesignNode['type'],
  zone: DesignNode['zone'],
  props: Record<string, string> = {},
): DesignNode => ({ id, type, zone, label: id, props })

const edge = (from: string, to: string): DesignEdge => ({ id: `${from}->${to}`, from: { node: from }, to: { node: to } })

const coverageExercise: ExerciseSpec = {
  guarantees: [
    {
      id: 'g-coverage',
      label: 'El servicio crítico está observado',
      weight: 1,
      predicate: { op: 'covered', target: { type: ['service'] }, by: { type: ['observability'] } },
      whyMissing: 'El servicio crítico no está conectado a ningún componente de observabilidad.',
      consequence: 'No vas a saber que falló hasta que un usuario se queje.',
    },
  ],
  budget: { opsUnits: 10 },
  lambda: 0.5,
}

// Four regression cases measured against the prototype in doc §14.3,
// reproduced end to end through the public evaluate() surface.
describe('forja engine — evaluate(): prototype defect regressions', () => {
  it('regression 1: empty canvas scores 0, not 30', () => {
    const empty: Design = { nodes: [], edges: [] }
    const result = evaluate(empty, coverageExercise)
    expect(result.status).toBe('scored')
    expect(result.score).toBe(0)
  })

  it('regression 2: a lone monitoring component with no connections does not score by presence — coverage is what counts', () => {
    const looseObservability: Design = {
      nodes: [node('svc', 'service', 'private'), node('obs', 'observability', 'private')],
      edges: [], // not connected — presence alone must not satisfy the guarantee
    }
    const result = evaluate(looseObservability, coverageExercise)
    expect(result.status).toBe('scored')
    expect(result.score).not.toBeNull()
    expect(result.score as number).toBeLessThan(50)
    expect(result.guarantees.find((g) => g.id === 'g-coverage')?.satisfied).toBe(false)
  })

  it('regression 3a: inverted arrows (public -> restricted) are illegal, not a perfect score', () => {
    const inverted: Design = {
      nodes: [node('client', 'web-client', 'public'), node('db', 'database', 'restricted')],
      edges: [edge('client', 'db')],
    }
    const result = evaluate(inverted, coverageExercise)
    expect(result.status).toBe('illegal')
    expect(result.score).toBeNull()
  })

  it('regression 3b: a client wired straight to a database is illegal, not a perfect score', () => {
    const direct: Design = {
      nodes: [node('client', 'mobile-client', 'public'), node('db', 'database', 'restricted')],
      edges: [edge('client', 'db')],
    }
    const result = evaluate(direct, coverageExercise)
    expect(result.status).toBe('illegal')
    expect(result.score).toBeNull()
  })

  it('a fully covered design scores 100', () => {
    const wired: Design = {
      nodes: [node('svc', 'service', 'private'), node('obs', 'observability', 'private')],
      edges: [edge('svc', 'obs')],
    }
    const result = evaluate(wired, coverageExercise)
    expect(result.status).toBe('scored')
    expect(result.score).toBe(100)
  })

  it('score + Σ findings.costPoints === ceiling for a partially satisfied, legal design', () => {
    const looseObservability: Design = {
      nodes: [node('svc', 'service', 'private'), node('obs', 'observability', 'private')],
      edges: [],
    }
    const result = evaluate(looseObservability, coverageExercise)
    const totalCost = result.findings.reduce((sum, f) => sum + (f.costPoints ?? 0), 0)
    expect((result.score ?? 0) + totalCost).toBe(result.ceiling)
  })
})

describe('forja engine — checkConnection(): the same legality module the scorer gates on', () => {
  it('refuses a trust-zone jump with a why, before the edge is ever created', () => {
    const design: Design = {
      nodes: [node('client', 'web-client', 'public'), node('db', 'database', 'restricted')],
      edges: [],
    }
    const verdict = checkConnection(design, { node: 'client' }, { node: 'db' })
    expect(verdict.ok).toBe(false)
    expect(verdict.why).toBeTruthy()
  })

  it('refuses a structural port mismatch with a why', () => {
    const design: Design = {
      nodes: [node('client', 'mobile-client', 'public'), node('db', 'database', 'restricted')],
      edges: [],
    }
    const verdict = checkConnection(design, { node: 'client' }, { node: 'db' })
    expect(verdict.ok).toBe(false)
    expect(verdict.why).toBeTruthy()
  })

  it('accepts a legal connection', () => {
    const design: Design = {
      nodes: [node('svc', 'service', 'private'), node('obs', 'observability', 'private')],
      edges: [],
    }
    const verdict = checkConnection(design, { node: 'svc' }, { node: 'obs' })
    expect(verdict.ok).toBe(true)
  })
})
