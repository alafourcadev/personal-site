// Every exercise ships two reference solutions, each with a
// `contextInversion`: the paragraph that says in WHICH context that solution
// is the better one and the other is not. That is the product's whole thesis
// ("two correct decisions in different contexts"), and until now no player
// had ever read one — the field appeared nowhere outside the validation
// schema.
//
// Revealing it is not free: the engine deliberately does not autocorrect and
// "el remedio nunca se revela en el primer nivel" (CONTEXTO-PARA-AGENTES §4),
// so the reveal is gated. These tests pin the gate and the "which of the two
// is yours closer to" comparison — the only two decisions with real
// consequences.
import { describe, expect, it } from 'vitest'
import type { ComponentType, Design, DesignNode } from '../../src/lib/forja/engine/types'
import type { CanvasResult } from '../../src/lib/forja/playground/result'
import {
  closestReferenceIndex,
  designFingerprint,
  shouldRevealReferences,
} from '../../src/components/forja/canvas/reference-solutions'

function scored(score: number | null, status: 'scored' | 'illegal' = 'scored'): CanvasResult {
  return {
    kind: 'scored',
    status,
    score,
    ceiling: 100,
    axes: [],
    cost: { opsUnits: 1, monthlyUsd: 0, budget: { opsUnits: 4 }, overage: 0 },
    findings: [],
  }
}

const freePlay: CanvasResult = { kind: 'free-play', legal: true, findings: [] }

describe('shouldRevealReferences', () => {
  it('reveals nothing before the player has tried anything', () => {
    expect(shouldRevealReferences(0, null)).toBe(false)
  })

  it('withholds the reasoning on the first attempt — the engine does not autocorrect', () => {
    expect(shouldRevealReferences(1, scored(60))).toBe(false)
  })

  it('reveals it on the second attempt, once the player has committed twice', () => {
    expect(shouldRevealReferences(2, scored(60))).toBe(true)
  })

  it('reveals it immediately when the first attempt already reaches the ceiling', () => {
    // Nothing is left to give away: the design is already worth 100. What the
    // player still lacks is WHY that one and not the other — the exact
    // question the brief asked and the score cannot answer.
    expect(shouldRevealReferences(1, scored(100))).toBe(true)
  })

  it('does not treat an illegal first attempt as a perfect one', () => {
    expect(shouldRevealReferences(1, scored(null, 'illegal'))).toBe(false)
  })

  it('never reveals anything in free play — there is no exercise behind it', () => {
    expect(shouldRevealReferences(5, freePlay)).toBe(false)
  })
})

describe('designFingerprint', () => {
  it('reduces a design with no connections to the sorted set of component types it uses', () => {
    const design: Design = {
      nodes: [
        { id: 'a', type: 'service', label: 'A', zone: 'private', props: {} },
        { id: 'b', type: 'service', label: 'B', zone: 'private', props: {} },
        { id: 'c', type: 'cache', label: 'C', zone: 'private', props: {} },
      ],
      edges: [],
    }
    expect(designFingerprint(design)).toEqual(['cache', 'service'])
  })

  // A component-type set alone cannot tell two reference solutions apart when
  // they use the same pieces and differ by a connection or by how many copies
  // of one piece they run — which is most of them. Measured over the whole
  // exercise library, 92 of 336 reference designs could not even identify
  // THEMSELVES under a type-set comparison. The connections carry the
  // decision, so they are in the fingerprint.
  const node = (id: string, type: ComponentType): DesignNode => ({
    id,
    type,
    label: id,
    zone: 'private',
    props: {},
  })

  it('records which connections exist, by the types they join', () => {
    const design: Design = {
      nodes: [node('a', 'service'), node('b', 'database')],
      edges: [{ id: 'e1', from: { node: 'a' }, to: { node: 'b' } }],
    }
    expect(designFingerprint(design)).toEqual(['database', 'service', 'service>database*1'])
  })

  it('separates two designs that use the same pieces and connect them differently', () => {
    const nodes = [node('a', 'service'), node('b', 'service'), node('c', 'queue')]
    const direct: Design = { nodes, edges: [{ id: 'e', from: { node: 'a' }, to: { node: 'b' } }] }
    const queued: Design = { nodes, edges: [{ id: 'e', from: { node: 'a' }, to: { node: 'c' } }] }
    expect(designFingerprint(direct)).not.toEqual(designFingerprint(queued))
  })

  it('separates one connection to a provider from two — the count IS the decision in some exercises', () => {
    const nodes = [node('a', 'service'), node('p', 'external-provider'), node('q', 'external-provider')]
    const one: Design = { nodes, edges: [{ id: 'e1', from: { node: 'a' }, to: { node: 'p' } }] }
    const two: Design = {
      nodes,
      edges: [
        { id: 'e1', from: { node: 'a' }, to: { node: 'p' } },
        { id: 'e2', from: { node: 'a' }, to: { node: 'q' } },
      ],
    }
    expect(designFingerprint(one)).not.toEqual(designFingerprint(two))
  })

  it('ignores labels, zones and positions — none of them is an architecture decision', () => {
    const left: Design = { nodes: [{ ...node('a', 'service'), label: 'Pagos' }], edges: [] }
    const right: Design = {
      nodes: [{ ...node('z', 'service'), label: 'Cobros', zone: 'dmz', position: { x: 9, y: 9 } }],
      edges: [],
    }
    expect(designFingerprint(left)).toEqual(designFingerprint(right))
  })

  it('is stable regardless of the order nodes and edges were drawn in', () => {
    const nodes = [node('a', 'service'), node('b', 'database'), node('c', 'cache')]
    const one: Design = {
      nodes,
      edges: [
        { id: 'e1', from: { node: 'a' }, to: { node: 'b' } },
        { id: 'e2', from: { node: 'a' }, to: { node: 'c' } },
      ],
    }
    const other: Design = {
      nodes: [nodes[2], nodes[0], nodes[1]],
      edges: [one.edges[1], one.edges[0]],
    }
    expect(designFingerprint(one)).toEqual(designFingerprint(other))
  })

  it('drops an edge whose endpoints are not in the design instead of inventing a type', () => {
    const design: Design = {
      nodes: [node('a', 'service')],
      edges: [{ id: 'e', from: { node: 'a' }, to: { node: 'ghost' } }],
    }
    expect(designFingerprint(design)).toEqual(['service'])
  })
})


describe('closestReferenceIndex', () => {
  const solutions = [
    { label: 'copia del lado del servidor', contextInversion: '…', fingerprint: ['api-gateway', 'cache', 'database', 'service'] },
    { label: 'publicada en el borde', contextInversion: '…', fingerprint: ['api-gateway', 'cdn', 'database', 'service'] },
  ]

  it('points at the solution the player actually built', () => {
    expect(closestReferenceIndex(['api-gateway', 'cache', 'database', 'service'], solutions)).toBe(0)
    expect(closestReferenceIndex(['api-gateway', 'cdn', 'database', 'service'], solutions)).toBe(1)
  })

  it('points at nothing when the design is neither of them', () => {
    // Neither a cache nor a CDN: the player has not taken the decision yet,
    // and inventing a winner would be the engine picking a side.
    expect(closestReferenceIndex(['api-gateway', 'database', 'service'], solutions)).toBeNull()
  })

  it('points at nothing when the player built one of them PLUS something else', () => {
    // The reported level-1 contradiction: the player had the file store
    // connected, the finding above said the system was writing the document
    // to its own storage, and the panel marked "el documento no se guarda" as
    // the closest — because that reference merely had one component fewer.
    // Being a superset of a reference is not being that reference.
    expect(closestReferenceIndex(['api-gateway', 'cache', 'cdn', 'database', 'service'], solutions)).toBeNull()
  })

  it('points at nothing when two references are indistinguishable', () => {
    const twins = [
      { label: 'A', contextInversion: '…', fingerprint: ['service', 'database'] },
      { label: 'B', contextInversion: '…', fingerprint: ['database', 'service'] },
    ]
    expect(closestReferenceIndex(['service', 'database'], twins)).toBeNull()
  })

  it('does not care about the order either side was built in', () => {
    expect(closestReferenceIndex(['service', 'database', 'cache', 'api-gateway'], solutions)).toBe(0)
  })

  it('points at nothing when there is nothing to compare against', () => {
    expect(closestReferenceIndex(['service'], [])).toBeNull()
  })
})
