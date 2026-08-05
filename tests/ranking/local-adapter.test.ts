// Design D6: "ranking port with a local adapter that always wins the
// write". LocalRankingAdapter is unconditional and synchronous — no
// Supabase exists yet in R1, so it is the whole ranking surface for now.
// RK7: attempts persist the GRAPH, not just the score — this is the test
// that would fail first if a future edit regressed to storing a bare
// number. Injectable storage (not a bare `localStorage` read) is what
// makes this file Vitest-testable under `environment: 'node'`, where no
// global `localStorage` exists (verified: Node 24 needs
// `--experimental-webstorage` + a file path, unusable for a test runner).
import { describe, expect, it } from 'vitest'
import { LocalRankingAdapter, type KeyValueStorage } from '../../src/lib/forja/ranking/local-adapter'
import type { Design } from '../../src/lib/forja/engine/types'

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
}

const design: Design = {
  nodes: [{ id: 'n1', type: 'service', label: 'Servicio', zone: 'private', props: {} }],
  edges: [],
}

describe('LocalRankingAdapter — submit()', () => {
  it('stores the full graph, not just the score [RK7]', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    const attempt = adapter.submit({ exerciseId: 'ex-1', design, score: 72, ceiling: 100, engineVersion: '0.2.0-r1c' })

    const stored = adapter.getSnapshot('ex-1')
    expect(stored.entries).toHaveLength(1)
    expect(attempt.design).toEqual(design)
    expect(attempt.id).toBeTruthy()
    expect(attempt.createdAt).toBeTruthy()
  })

  it('is synchronous — the write is visible immediately after submit() returns, no await needed', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    adapter.submit({ exerciseId: 'ex-1', design, score: 50, ceiling: 100, engineVersion: 'v' })
    expect(adapter.getSnapshot('ex-1').entries).toHaveLength(1)
  })

  it('always succeeds — never throws, even against a storage that rejects writes (D6: "always wins the write")', () => {
    const hostileStorage: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded')
      },
    }
    const adapter = new LocalRankingAdapter(hostileStorage)
    expect(() => adapter.submit({ exerciseId: 'ex-1', design, score: 10, ceiling: 100, engineVersion: 'v' })).not.toThrow()
  })

  it('an illegal attempt (score: null) is stored as personal history but excluded from the ranked snapshot', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    adapter.submit({ exerciseId: 'ex-1', design, score: null, ceiling: 100, engineVersion: 'v' })
    expect(adapter.getSnapshot('ex-1').entries).toHaveLength(0)
    expect(adapter.getHistory('ex-1')).toHaveLength(1)
  })
})

describe('LocalRankingAdapter — getSnapshot()', () => {
  it('sorts entries by score, descending', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    adapter.submit({ exerciseId: 'ex-1', design, score: 40, ceiling: 100, engineVersion: 'v' })
    adapter.submit({ exerciseId: 'ex-1', design, score: 95, ceiling: 100, engineVersion: 'v' })
    adapter.submit({ exerciseId: 'ex-1', design, score: 70, ceiling: 100, engineVersion: 'v' })

    const scores = adapter.getSnapshot('ex-1').entries.map((e) => e.score)
    expect(scores).toEqual([95, 70, 40])
  })

  it('the snapshot always declares its source as local — the honest label lives on the data, not just the UI [RK5]', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    expect(adapter.getSnapshot('ex-1').source).toBe('local')
  })

  it('filters by exerciseId when provided, returns every attempt when omitted', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    adapter.submit({ exerciseId: 'ex-1', design, score: 10, ceiling: 100, engineVersion: 'v' })
    adapter.submit({ exerciseId: 'ex-2', design, score: 20, ceiling: 100, engineVersion: 'v' })

    expect(adapter.getSnapshot('ex-1').entries).toHaveLength(1)
    expect(adapter.getSnapshot().entries).toHaveLength(2)
  })
})

describe('LocalRankingAdapter — hasScoredAttempt() (best-answers gate primitive)', () => {
  it('is false before any scored submission for that exercise', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    expect(adapter.hasScoredAttempt('ex-1')).toBe(false)
  })

  it('becomes true only after a scored (non-null, legal) submission', () => {
    const adapter = new LocalRankingAdapter(memoryStorage())
    adapter.submit({ exerciseId: 'ex-1', design, score: null, ceiling: 100, engineVersion: 'v' })
    expect(adapter.hasScoredAttempt('ex-1')).toBe(false)

    adapter.submit({ exerciseId: 'ex-1', design, score: 60, ceiling: 100, engineVersion: 'v' })
    expect(adapter.hasScoredAttempt('ex-1')).toBe(true)
  })
})
