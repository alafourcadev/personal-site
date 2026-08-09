import type { StorageFailureReason, StorageWriteStatus } from '../ranking/port'
import type { TransferEvidence } from './mastery'

export interface TransferEvidenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const TRANSFER_EVIDENCE_STORAGE_KEY = 'forja:transfer-evidence:v1'
export const MAX_TRANSFER_EVIDENCE_ENTRIES = 500

export interface TransferEvidenceWriteResult extends TransferEvidence {
  storage: StorageWriteStatus
}

export interface CompactedTransferEvidence {
  evidence: TransferEvidence[]
  evicted: number
  deduplicated: boolean
}

function inMemoryFallback(): TransferEvidenceStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
}

function browserLocalStorage(): TransferEvidenceStorage | null {
  try {
    if (typeof globalThis === 'undefined') return null
    return (globalThis as { localStorage?: TransferEvidenceStorage }).localStorage ?? null
  } catch {
    return null
  }
}

function evidenceTime(evidence: TransferEvidence): number {
  const parsed = Date.parse(evidence.succeededAt)
  return Number.isFinite(parsed) ? parsed : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateEvidence(value: unknown): TransferEvidence | null {
  if (!isRecord(value)) return null
  const sourceExerciseId = typeof value.sourceExerciseId === 'string' ? value.sourceExerciseId.trim() : ''
  const targetExerciseId = typeof value.targetExerciseId === 'string' ? value.targetExerciseId.trim() : ''
  const targetAttemptId = typeof value.targetAttemptId === 'string' ? value.targetAttemptId.trim() : ''
  const succeededAt = typeof value.succeededAt === 'string' ? value.succeededAt : ''
  const conceptId = typeof value.conceptId === 'string' ? value.conceptId.trim() : undefined
  if (
    sourceExerciseId.length === 0 ||
    targetExerciseId.length === 0 ||
    targetAttemptId.length === 0 ||
    sourceExerciseId === targetExerciseId ||
    !Number.isFinite(Date.parse(succeededAt))
  ) {
    return null
  }
  return {
    sourceExerciseId,
    targetExerciseId,
    targetAttemptId,
    succeededAt,
    ...(conceptId ? { conceptId } : {}),
  }
}

function payloadEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (isRecord(value) && Array.isArray(value.entries)) return value.entries
  return []
}

function evidenceKey(evidence: TransferEvidence): string {
  return `${evidence.sourceExerciseId}\u0000${evidence.targetAttemptId}`
}

export function compactTransferEvidence(
  input: readonly TransferEvidence[],
  limit = MAX_TRANSFER_EVIDENCE_ENTRIES,
): CompactedTransferEvidence {
  const seen = new Set<string>()
  const unique = input
    .map((evidence, index) => ({ evidence, index }))
    .sort(
      (left, right) =>
        evidenceTime(right.evidence) - evidenceTime(left.evidence) || right.index - left.index,
    )
    .map(({ evidence }) => evidence)
    .filter((evidence) => {
      const key = evidenceKey(evidence)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  const safeLimit = Math.max(1, Math.floor(limit))
  const evidence = unique.slice(0, safeLimit).sort((left, right) => evidenceTime(left) - evidenceTime(right))
  return {
    evidence,
    evicted: input.length - evidence.length,
    deduplicated: unique.length < input.length,
  }
}

function storageFailure(error: unknown): StorageFailureReason {
  const name = isRecord(error) && typeof error.name === 'string' ? error.name : ''
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota-exceeded'
  if (name === 'SecurityError' || name === 'InvalidStateError') return 'storage-unavailable'
  return 'write-failed'
}

export class LocalTransferEvidenceAdapter {
  private storage: TransferEvidenceStorage
  private persistent: boolean

  constructor(storage?: TransferEvidenceStorage) {
    const browserStorage = storage ? null : browserLocalStorage()
    this.storage = storage ?? browserStorage ?? inMemoryFallback()
    this.persistent = storage !== undefined || browserStorage !== null
  }

  getAll(): TransferEvidence[] {
    try {
      const raw = this.storage.getItem(TRANSFER_EVIDENCE_STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      const valid = payloadEntries(parsed)
        .map(validateEvidence)
        .filter((entry): entry is TransferEvidence => entry !== null)
      return compactTransferEvidence(valid).evidence
    } catch {
      return []
    }
  }

  save(evidence: TransferEvidence): TransferEvidenceWriteResult {
    const valid = validateEvidence(evidence)
    if (!valid) {
      return {
        ...evidence,
        storage: { ok: false, outcome: 'failed', reason: 'write-failed', evicted: 0 },
      }
    }

    const compacted = compactTransferEvidence([...this.getAll(), valid])
    try {
      this.storage.setItem(TRANSFER_EVIDENCE_STORAGE_KEY, JSON.stringify(compacted.evidence))
      const storage: StorageWriteStatus = this.persistent
        ? {
            ok: true,
            outcome: compacted.deduplicated ? 'deduplicated' : 'stored',
            evicted: compacted.evicted,
          }
        : { ok: false, outcome: 'failed', reason: 'storage-unavailable', evicted: compacted.evicted }
      return { ...valid, storage }
    } catch (error) {
      return {
        ...valid,
        storage: {
          ok: false,
          outcome: 'failed',
          reason: storageFailure(error),
          evicted: compacted.evicted,
        },
      }
    }
  }
}

export const localTransferEvidenceAdapter = new LocalTransferEvidenceAdapter()
