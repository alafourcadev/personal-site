import { describe, expect, it } from 'vitest'
import { evaluatePredicate, matchNodes } from '../../src/lib/forja/engine/predicates'
import type { Predicate } from '../../src/lib/forja/engine/types'
import type { Design, DesignEdge, DesignNode, Finding } from '../../src/lib/forja/engine/types'

const node = (
  id: string,
  type: DesignNode['type'],
  zone: DesignNode['zone'],
  props: Record<string, string> = {},
  role?: string,
): DesignNode => ({ id, type, zone, label: id, props, role })

const edge = (from: string, to: string, dataClass?: DesignEdge['dataClass']): DesignEdge => ({
  id: `${from}->${to}`,
  from: { node: from },
  to: { node: to },
  dataClass,
})

const design = (nodes: DesignNode[], edges: DesignEdge[] = []): Design => ({ nodes, edges })

describe('forja engine — predicate DSL (D2)', () => {
  it('matchNodes returns a set: duplicating an irrelevant node never changes an unrelated match', () => {
    const base = design([
      node('svc', 'service', 'private', { criticality: 'high' }),
      node('svc-dup', 'service', 'private', { criticality: 'high' }),
    ])
    const query = { type: ['service'] as DesignNode['type'][] }
    expect(matchNodes(base, query)).toHaveLength(2)
  })

  it('exists: satisfied only when a matching node is present', () => {
    const p: Predicate = { op: 'exists', node: { type: ['observability'] } }
    expect(evaluatePredicate(design([node('o', 'observability', 'private')]), p, [])).toBe(true)
    expect(evaluatePredicate(design([node('s', 'service', 'private')]), p, [])).toBe(false)
  })

  it('G2 — noVolatileCut: outbox (durable database) and durable queue both satisfy the same predicate over structurally distinct topologies', () => {
    const g2: Predicate = {
      op: 'noVolatileCut',
      from: { role: 'purchase-accepted' },
      to: { role: 'email-sent' },
    }

    const outbox = design(
      [
        node('accepted', 'business-process', 'public', {}, 'purchase-accepted'),
        node('svc', 'service', 'private', { stateful: 'no' }),
        node('db', 'database', 'restricted', { persistence: 'durable' }),
        node('worker', 'worker', 'private', {}),
        node('email', 'external-provider', 'dmz', {}, 'email-sent'),
      ],
      [
        edge('accepted', 'svc'),
        edge('svc', 'db'),
        edge('db', 'worker'),
        edge('worker', 'email'),
      ],
    )

    const durableQueue = design(
      [
        node('accepted', 'business-process', 'public', {}, 'purchase-accepted'),
        node('svc', 'service', 'private', { stateful: 'no' }),
        node('queue', 'queue', 'private', { delivery: 'at-least-once' }),
        node('worker', 'worker', 'private', {}),
        node('email', 'external-provider', 'dmz', {}, 'email-sent'),
      ],
      [
        edge('accepted', 'svc'),
        edge('svc', 'queue'),
        edge('queue', 'worker'),
        edge('worker', 'email'),
      ],
    )

    expect(evaluatePredicate(outbox, g2, [])).toBe(true)
    expect(evaluatePredicate(durableQueue, g2, [])).toBe(true)
  })

  it('noVolatileCut: a pure in-memory relay with no durable node fails the guarantee', () => {
    const g2: Predicate = {
      op: 'noVolatileCut',
      from: { role: 'purchase-accepted' },
      to: { role: 'email-sent' },
    }
    const memoryOnly = design(
      [
        node('accepted', 'business-process', 'public', {}, 'purchase-accepted'),
        node('svc', 'service', 'private', {}),
        node('email', 'external-provider', 'dmz', {}, 'email-sent'),
      ],
      [edge('accepted', 'svc'), edge('svc', 'email')],
    )
    expect(evaluatePredicate(memoryOnly, g2, [])).toBe(false)
  })

  it('path: honours a required via and a forbidden node', () => {
    const via: Predicate = {
      op: 'path',
      from: { role: 'start' },
      to: { role: 'end' },
      via: { type: ['api-gateway'] },
    }
    const withGateway = design(
      [
        node('a', 'web-client', 'public', {}, 'start'),
        node('gw', 'api-gateway', 'dmz'),
        node('b', 'service', 'private', {}, 'end'),
      ],
      [edge('a', 'gw'), edge('gw', 'b')],
    )
    const withoutGateway = design(
      [
        node('a', 'web-client', 'public', {}, 'start'),
        node('b', 'service', 'private', {}, 'end'),
      ],
      [edge('a', 'b')],
    )
    expect(evaluatePredicate(withGateway, via, [])).toBe(true)
    expect(evaluatePredicate(withoutGateway, via, [])).toBe(false)

    const forbid: Predicate = {
      op: 'path',
      from: { role: 'start' },
      to: { role: 'end' },
      forbid: { type: ['cache'] },
    }
    const throughCache = design(
      [
        node('a', 'web-client', 'public', {}, 'start'),
        node('c', 'cache', 'private'),
        node('b', 'service', 'private', {}, 'end'),
      ],
      [edge('a', 'c'), edge('c', 'b')],
    )
    expect(evaluatePredicate(throughCache, forbid, [])).toBe(false)
  })

  it('covered: every target node needs at least one edge to a "by" node — presence alone is not coverage', () => {
    const covered: Predicate = {
      op: 'covered',
      target: { type: ['service'], propEquals: { criticality: 'high' } },
      by: { type: ['observability'] },
    }
    const wired = design(
      [
        node('svc', 'service', 'private', { criticality: 'high' }),
        node('obs', 'observability', 'private'),
      ],
      [edge('svc', 'obs')],
    )
    const loose = design([
      node('svc', 'service', 'private', { criticality: 'high' }),
      node('obs', 'observability', 'private'),
    ])
    expect(evaluatePredicate(wired, covered, [])).toBe(true)
    expect(evaluatePredicate(loose, covered, [])).toBe(false)
  })

  it('edgeAbsent: satisfied only when no direct edge connects the two queries', () => {
    const noDirect: Predicate = {
      op: 'edgeAbsent',
      from: { type: ['web-client'] },
      to: { type: ['database'] },
    }
    const direct = design(
      [node('c', 'web-client', 'public'), node('db', 'database', 'restricted')],
      [edge('c', 'db')],
    )
    const indirect = design(
      [
        node('c', 'web-client', 'public'),
        node('api', 'api-gateway', 'dmz'),
        node('db', 'database', 'restricted'),
      ],
      [edge('c', 'api'), edge('api', 'db')],
    )
    expect(evaluatePredicate(direct, noDirect, [])).toBe(false)
    expect(evaluatePredicate(indirect, noDirect, [])).toBe(true)
  })

  it('ruleSilent: satisfied only when the given rule id raised no finding', () => {
    const silent: Predicate = { op: 'ruleSilent', rule: 'queue-without-dlq' }
    const findings: Finding[] = [
      {
        id: 'queue-without-dlq:0',
        rule: 'queue-without-dlq',
        severity: 'warning',
        title: '',
        evidence: '',
        why: '',
        nodeIds: [],
        edgeIds: [],
      },
    ]
    expect(evaluatePredicate(design([]), silent, findings)).toBe(false)
    expect(evaluatePredicate(design([]), silent, [])).toBe(true)
  })

  it('all/any/not compose correctly', () => {
    const hasA: Predicate = { op: 'exists', node: { type: ['worker'] } }
    const hasB: Predicate = { op: 'exists', node: { type: ['queue'] } }
    const both = design([node('w', 'worker', 'private'), node('q', 'queue', 'private')])
    const onlyA = design([node('w', 'worker', 'private')])
    const neither = design([])

    expect(evaluatePredicate(both, { op: 'all', of: [hasA, hasB] }, [])).toBe(true)
    expect(evaluatePredicate(onlyA, { op: 'all', of: [hasA, hasB] }, [])).toBe(false)
    expect(evaluatePredicate(onlyA, { op: 'any', of: [hasA, hasB] }, [])).toBe(true)
    expect(evaluatePredicate(neither, { op: 'any', of: [hasA, hasB] }, [])).toBe(false)
    expect(evaluatePredicate(neither, { op: 'not', of: [hasA] }, [])).toBe(true)
    expect(evaluatePredicate(both, { op: 'not', of: [hasA] }, [])).toBe(false)
  })
})
