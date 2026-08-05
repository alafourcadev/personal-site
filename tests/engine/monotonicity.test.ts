import { describe, expect, it } from 'vitest'
import { computeLedger } from '../../src/lib/forja/engine/score'
import type { Design, DesignEdge, DesignNode, ExerciseSpec, Guarantee } from '../../src/lib/forja/engine/types'

const node = (id: string, type: DesignNode['type'], props: Record<string, string> = {}): DesignNode => ({
  id,
  type,
  zone: 'private',
  label: id,
  props,
})
const edge = (from: string, to: string): DesignEdge => ({ id: `${from}->${to}`, from: { node: from }, to: { node: to } })
const design = (nodes: DesignNode[], edges: DesignEdge[] = []): Design => ({ nodes, edges })

const guarantee = (id: string, weight: number, satisfiedType: DesignNode['type']): Guarantee => ({
  id,
  label: id,
  weight,
  predicate: { op: 'exists', node: { type: [satisfiedType] } },
  whyMissing: `Falta ${id}.`,
  consequence: `Sin ${id} el diseño no cumple.`,
})

describe('forja engine — monotonicity invariant (EE6): G(d′)≥G(d) ∧ C(d′)≤budget ⟹ score(d′)≥score(d)', () => {
  it('enumerates every subset of 3 guarantees, all combinations under budget: a superset of satisfied guarantees never scores lower', () => {
    const exercise: ExerciseSpec = {
      guarantees: [guarantee('g1', 2, 'worker'), guarantee('g2', 3, 'queue'), guarantee('g3', 1, 'cache')],
      budget: { opsUnits: 10 }, // never exceeded by any combination below
      lambda: 0.5,
    }
    const pieces: Record<string, DesignNode> = {
      g1: node('w', 'worker'),
      g2: node('q', 'queue'),
      g3: node('c', 'cache'),
    }
    const subsets: (keyof typeof pieces)[][] = [
      [],
      ['g1'],
      ['g2'],
      ['g3'],
      ['g1', 'g2'],
      ['g1', 'g3'],
      ['g2', 'g3'],
      ['g1', 'g2', 'g3'],
    ]
    const scores = subsets.map((keys) => ({
      keys,
      score: computeLedger(design(keys.map((k) => pieces[k])), exercise, []).score,
    }))

    for (const a of scores) {
      for (const b of scores) {
        const aIsSubsetOfB = a.keys.every((k) => b.keys.includes(k))
        if (aIsSubsetOfB) {
          expect(
            b.score,
            `${JSON.stringify(b.keys)} (superset) scored ${b.score} < ${a.score} of subset ${JSON.stringify(a.keys)}`,
          ).toBeGreaterThanOrEqual(a.score)
        }
      }
    }
  })

  it('the exact prototype regression: adding a dead-letter queue to a complete outbox solution must not lower the score', () => {
    // A single guarantee already satisfied by the outbox alone (delivery
    // survives a crash) — this mirrors the prototype's defect 1 where an
    // *additional*, correct safety net (98 -> from 100) lowered the score
    // purely because it added a node.
    const survivesCrash: Guarantee = {
      id: 'g-survives-crash',
      label: 'La entrega sobrevive si el proceso muere',
      weight: 1,
      predicate: { op: 'noVolatileCut', from: { role: 'accepted' }, to: { role: 'notified' } },
      whyMissing: 'No hay ningún punto durable entre la aceptación y la notificación.',
      consequence: 'Si el proceso muere, el aviso nunca sale.',
    }
    const exercise: ExerciseSpec = {
      guarantees: [survivesCrash],
      budget: { opsUnits: 10 }, // generous enough that adding one more queue stays under budget
      lambda: 0.5,
    }

    const outboxNodes: DesignNode[] = [
      { ...node('accepted', 'business-process', {}), role: 'accepted' },
      node('svc', 'service', {}),
      node('db', 'database', { persistence: 'durable' }),
      node('worker', 'worker', {}),
      { ...node('notified', 'external-provider', {}), role: 'notified' },
    ]
    const withEdges: Design = {
      nodes: outboxNodes,
      edges: [
        { id: 'e1', from: { node: 'accepted' }, to: { node: 'svc' } },
        { id: 'e2', from: { node: 'svc' }, to: { node: 'db' } },
        { id: 'e3', from: { node: 'db' }, to: { node: 'worker' } },
        { id: 'e4', from: { node: 'worker' }, to: { node: 'notified' } },
      ],
    }

    const baseline = computeLedger(withEdges, exercise, [])
    expect(baseline.score).toBe(100)

    // Add a dead-letter queue for the failed-message backlog. It is a pure
    // addition — no existing edge changes — so G(d′) ≥ G(d) and, at 6
    // opsUnits, still C(d′) ≤ 10.
    const withDlq: Design = {
      nodes: [...withEdges.nodes, node('dlq', 'queue', { delivery: 'at-least-once', dlq: 'no' })],
      edges: [...withEdges.edges, { id: 'e5', from: { node: 'worker' }, to: { node: 'dlq' } }],
    }
    const withDlqResult = computeLedger(withDlq, exercise, [])

    expect(withDlqResult.score).toBeGreaterThanOrEqual(baseline.score)
    expect(withDlqResult.score).toBe(100)
  })
})
