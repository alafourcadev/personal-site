import { describe, expect, it } from 'vitest'
import {
  compactTransferEvidence,
  LocalTransferEvidenceAdapter,
  TRANSFER_EVIDENCE_STORAGE_KEY,
  type TransferEvidenceStorage,
} from '../../src/lib/forja/progression/transfer-evidence-local-adapter'
import type { TransferEvidence } from '../../src/lib/forja/progression/mastery'

function evidence(index: number): TransferEvidence {
  return {
    sourceExerciseId: `source-${index}`,
    targetExerciseId: `target-${index}`,
    targetAttemptId: `attempt-${index}`,
    succeededAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    conceptId: 'shared-concept',
  }
}

function memoryStorage(seed?: unknown): { storage: TransferEvidenceStorage; read: () => string | null } {
  const map = new Map<string, string>()
  if (seed !== undefined) map.set(TRANSFER_EVIDENCE_STORAGE_KEY, JSON.stringify(seed))
  return {
    storage: {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => void map.set(key, value),
    },
    read: () => map.get(TRANSFER_EVIDENCE_STORAGE_KEY) ?? null,
  }
}

describe('LocalTransferEvidenceAdapter', () => {
  it('uses its dedicated key and persists valid evidence', () => {
    const memory = memoryStorage()
    const adapter = new LocalTransferEvidenceAdapter(memory.storage)
    const result = adapter.save(evidence(0))
    expect(result.storage).toEqual({ ok: true, outcome: 'stored', evicted: 0 })
    expect(JSON.parse(memory.read() ?? '[]')).toEqual([evidence(0)])
  })

  it('reads legacy arrays and object-wrapped entries while dropping corrupt records', () => {
    const invalid = { ...evidence(1), sourceExerciseId: 'same', targetExerciseId: 'same' }
    const legacyEvidence: TransferEvidence = {
      sourceExerciseId: 'source-0',
      targetExerciseId: 'target-0',
      targetAttemptId: 'attempt-0',
      succeededAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    }
    const arrayAdapter = new LocalTransferEvidenceAdapter(memoryStorage([legacyEvidence, invalid, null]).storage)
    expect(arrayAdapter.getAll()).toEqual([legacyEvidence])

    const objectAdapter = new LocalTransferEvidenceAdapter(
      memoryStorage({ entries: [evidence(1)], version: 0 }).storage,
    )
    expect(objectAdapter.getAll()).toEqual([evidence(1)])
  })

  it('deduplicates repeated source and target-attempt pairs', () => {
    const adapter = new LocalTransferEvidenceAdapter(memoryStorage().storage)
    adapter.save(evidence(0))
    const repeated = adapter.save({ ...evidence(0), targetExerciseId: 'renamed-target' })
    expect(repeated.storage).toEqual({ ok: true, outcome: 'deduplicated', evicted: 1 })
    expect(adapter.getAll()).toEqual([{ ...evidence(0), targetExerciseId: 'renamed-target' }])
  })

  it('never throws on hostile reads or writes and reports quota failures', () => {
    const quota = Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    const adapter = new LocalTransferEvidenceAdapter({
      getItem: () => {
        throw new Error('blocked read')
      },
      setItem: () => {
        throw quota
      },
    })
    expect(adapter.getAll()).toEqual([])
    expect(adapter.save(evidence(0)).storage).toEqual({
      ok: false,
      outcome: 'failed',
      reason: 'quota-exceeded',
      evicted: 0,
    })
  })

  it('rejects invalid evidence without writing', () => {
    const memory = memoryStorage()
    const adapter = new LocalTransferEvidenceAdapter(memory.storage)
    const invalid = { ...evidence(0), succeededAt: 'not-a-date' }
    expect(adapter.save(invalid).storage).toMatchObject({ ok: false, reason: 'write-failed' })
    expect(memory.read()).toBeNull()
  })
})

describe('compactTransferEvidence()', () => {
  it('keeps only the newest entries within the requested cap', () => {
    const compacted = compactTransferEvidence([evidence(0), evidence(1), evidence(2)], 2)
    expect(compacted.evidence).toEqual([evidence(1), evidence(2)])
    expect(compacted.evicted).toBe(1)
  })
})
