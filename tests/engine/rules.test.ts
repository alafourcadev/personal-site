import { describe, expect, it } from 'vitest'
import { evaluateRules } from '../../src/lib/forja/engine/rules'
import type { Design, DesignEdge, DesignNode } from '../../src/lib/forja/engine/types'

const node = (
  id: string,
  type: DesignNode['type'],
  zone: DesignNode['zone'],
  props: Record<string, string> = {},
): DesignNode => ({ id, type, zone, label: id, props })

const edge = (from: string, to: string, dataClass?: DesignEdge['dataClass']): DesignEdge => ({
  id: `${from}->${to}`,
  from: { node: from },
  to: { node: to },
  dataClass,
})

const design = (nodes: DesignNode[], edges: DesignEdge[] = []): Design => ({ nodes, edges })

const only = (findings: ReturnType<typeof evaluateRules>, rule: string) =>
  findings.filter((f) => f.rule === rule)

describe('forja engine — the 13 §13.7 rules', () => {
  it('trust-zone-jump: public actor wired straight to a restricted database — blocking', () => {
    const d = design(
      [node('a', 'actor', 'public'), node('b', 'database', 'restricted')],
      [edge('a', 'b')],
    )
    const found = only(evaluateRules(d), 'trust-zone-jump')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('blocking')
    expect(found[0].why).toMatch(/no controlás quién llega/)
  })

  it('port-mismatch: mobile client wired straight to a database — blocking, human-source copy', () => {
    const d = design(
      [node('a', 'mobile-client', 'public'), node('b', 'database', 'restricted')],
      [edge('a', 'b')],
    )
    const found = only(evaluateRules(d), 'port-mismatch')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('blocking')
  })

  it('volatile-durable-mismatch: regulated data landing only in a cache — blocking', () => {
    const d = design(
      [node('a', 'service', 'private'), node('b', 'cache', 'private')],
      [edge('a', 'b', 'regulated')],
    )
    const found = only(evaluateRules(d), 'volatile-durable-mismatch')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('blocking')
  })

  it('regulated-without-backup: regulated data into a database with backup:none — blocking', () => {
    const d = design(
      [node('a', 'service', 'private'), node('b', 'database', 'restricted', { backup: 'none' })],
      [edge('a', 'b', 'regulated')],
    )
    const found = only(evaluateRules(d), 'regulated-without-backup')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('blocking')
  })

  it('pii-to-external-model: personal data into an externally-hosted AI model — blocking', () => {
    const d = design(
      [node('a', 'service', 'private'), node('b', 'ai-model', 'private', { hosting: 'external' })],
      [edge('a', 'b', 'personal')],
    )
    const found = only(evaluateRules(d), 'pii-to-external-model')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('blocking')
  })

  it('queue-without-dlq: at-least-once queue with no DLQ — warning, does not block', () => {
    const d = design([
      node('a', 'service', 'private'),
      node('q', 'queue', 'private', { delivery: 'at-least-once', dlq: 'no' }),
      node('c', 'worker', 'private'),
    ], [edge('a', 'q'), edge('q', 'c')])
    const found = only(evaluateRules(d), 'queue-without-dlq')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
  })

  it('orphan-queue: a queue with zero outbound consumers — blocking', () => {
    const d = design([node('a', 'service', 'private'), node('q', 'queue', 'private')], [edge('a', 'q')])
    const found = only(evaluateRules(d), 'orphan-queue')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('blocking')
  })

  it('orphan-queue: revived for stream too (catalog gap fix, not dead code)', () => {
    const d = design([node('a', 'service', 'private'), node('s', 'stream', 'private')], [edge('a', 's')])
    const found = only(evaluateRules(d), 'orphan-queue')
    expect(found).toHaveLength(1)
  })

  it('sync-chain-depth: three chained services on a path — warning', () => {
    const d = design(
      [node('s1', 'service', 'private'), node('s2', 'service', 'private'), node('s3', 'service', 'private')],
      [edge('s1', 's2'), edge('s2', 's3')],
    )
    const found = only(evaluateRules(d), 'sync-chain-depth')
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].severity).toBe('warning')
  })

  it('intermittent-client-without-idempotency: flaky client hits a non-idempotent service — warning', () => {
    const d = design(
      [
        node('m', 'mobile-client', 'public', { connectivity: 'intermittent' }),
        node('s', 'service', 'private', { idempotent: 'no' }),
      ],
      [edge('m', 's')],
    )
    const found = only(evaluateRules(d), 'intermittent-client-without-idempotency')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
  })

  it('no-observability-on-critical: critical service with zero observability nodes — warning', () => {
    const d = design([node('s', 'service', 'private', { criticality: 'high' })])
    const found = only(evaluateRules(d), 'no-observability-on-critical')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
  })

  it('single-point-of-failure: critical service with replicas:1 — warning', () => {
    const d = design([node('s', 'service', 'private', { criticality: 'high', replicas: '1' })])
    const found = only(evaluateRules(d), 'single-point-of-failure')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
  })

  it('ops-budget-exceeded: sum of opsUnits over the declared team capacity — warning', () => {
    const d = design([
      node('s1', 'service', 'private'),
      node('s2', 'service', 'private'),
      node('s3', 'service', 'private'),
    ])
    const found = only(evaluateRules(d, 2), 'ops-budget-exceeded')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('warning')
  })

  it('undeclared-data-class: a connection with no dataClass — note, does not block', () => {
    const d = design([node('a', 'service', 'private'), node('b', 'worker', 'private')], [edge('a', 'b')])
    const found = only(evaluateRules(d), 'undeclared-data-class')
    expect(found).toHaveLength(1)
    expect(found[0].severity).toBe('note')
  })
})
