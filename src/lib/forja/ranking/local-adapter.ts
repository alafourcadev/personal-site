// Design D6: LocalRankingAdapter, unconditional, synchronous, always
// winning the write. R1 ships this alone; R3 adds SupabaseRankingAdapter
// behind the same RankingPort, purely additive.
//
// Storage is injected (KeyValueStorage), not read from a bare global
// `localStorage`: (1) makes this file Vitest-testable under
// `environment: 'node'`, where no global `localStorage` exists, verified
// directly (Node 24 only exposes one behind `--experimental-webstorage`
// plus a mandatory file path, unusable for a test runner); (2) the
// fallback below never throws even if this module is ever evaluated
// outside a browser (it shouldn't be, since both call sites are client-only,
// but "never crash the page over a ranking write" is the whole point of
// D6, so the module itself should not depend on the environment being
// exactly right).
import type {
  Attempt,
  RankingEntry,
  RankingPort,
  RankingSnapshot,
  StorageFailureReason,
  StorageWriteStatus,
  SubmitAttemptInput,
  SubmitAttemptResult,
} from './port'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

// Exported so the Playwright suite can seed a real attempt directly into
// localStorage (the same key the app itself reads/writes) rather than
// duplicating the string literal and risking drift.
export const STORAGE_KEY = 'forja:attempts:v1'
export const MAX_ATTEMPTS_PER_EXERCISE = 10
export const MAX_STORED_ATTEMPTS = 500

function inMemoryFallback(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
}

function browserLocalStorage(): KeyValueStorage | null {
  try {
    if (typeof globalThis === 'undefined') return null
    const candidate = (globalThis as { localStorage?: KeyValueStorage }).localStorage
    return candidate ?? null
  } catch {
    return null
  }
}

function randomId(): string {
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function attemptTime(attempt: Attempt): number {
  const parsed = Date.parse(attempt.createdAt)
  return Number.isFinite(parsed) ? parsed : 0
}

function payloadKey(attempt: Attempt): string {
  return JSON.stringify({
    exerciseId: attempt.exerciseId,
    design: attempt.design,
    score: attempt.score,
    ceiling: attempt.ceiling,
    engineVersion: attempt.engineVersion,
    miniAdr: attempt.miniAdr,
  })
}

function isAttempt(value: unknown): value is Attempt {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<Attempt>
  return (
    typeof item.id === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.exerciseId === 'string' &&
    typeof item.design === 'object' &&
    item.design !== null &&
    (item.score === null || typeof item.score === 'number') &&
    typeof item.ceiling === 'number' &&
    typeof item.engineVersion === 'string'
  )
}

function normalizeAttempt(value: unknown, index: number): Attempt | null {
  if (isAttempt(value)) return value
  if (typeof value !== 'object' || value === null) return null
  const legacy = value as Partial<Attempt> & { at?: unknown }
  if (
    typeof legacy.exerciseId !== 'string' ||
    typeof legacy.design !== 'object' ||
    legacy.design === null ||
    (legacy.score !== null && typeof legacy.score !== 'number') ||
    typeof legacy.engineVersion !== 'string'
  ) {
    return null
  }
  const createdAt =
    typeof legacy.createdAt === 'string'
      ? legacy.createdAt
      : typeof legacy.at === 'string'
        ? legacy.at
        : ''
  if (!Number.isFinite(Date.parse(createdAt))) return null
  return {
    id:
      typeof legacy.id === 'string' && legacy.id.length > 0
        ? legacy.id
        : `legacy-${index}-${createdAt}`,
    createdAt,
    exerciseId: legacy.exerciseId,
    design: legacy.design,
    score: legacy.score,
    ceiling: typeof legacy.ceiling === 'number' ? legacy.ceiling : 100,
    engineVersion: legacy.engineVersion,
    ...(legacy.miniAdr ? { miniAdr: legacy.miniAdr } : {}),
  }
}

export interface CompactedAttempts {
  attempts: Attempt[]
  evicted: number
  deduplicated: boolean
}

export function compactAttempts(
  input: readonly Attempt[],
  perExerciseLimit = MAX_ATTEMPTS_PER_EXERCISE,
  totalLimit = MAX_STORED_ATTEMPTS,
): CompactedAttempts {
  const originalCount = input.length
  const seen = new Set<string>()
  const unique = input
    .map((attempt, index) => ({ attempt, index }))
    .sort(
      (left, right) =>
        attemptTime(right.attempt) - attemptTime(left.attempt) || right.index - left.index,
    )
    .map(({ attempt }) => attempt)
    .filter((attempt) => {
      const key = payloadKey(attempt)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  const selectedByExercise: Attempt[] = []
  const groups = new Map<string, Attempt[]>()
  for (const attempt of unique) {
    const group = groups.get(attempt.exerciseId) ?? []
    group.push(attempt)
    groups.set(attempt.exerciseId, group)
  }

  const safePerExerciseLimit = Math.max(1, Math.floor(perExerciseLimit))
  for (const group of groups.values()) {
    const selected = group.slice(0, safePerExerciseLimit)
    const best = [...group]
      .filter((attempt): attempt is Attempt & { score: number } => attempt.score !== null)
      .sort((left, right) => right.score - left.score || attemptTime(right) - attemptTime(left))[0]
    if (best && !selected.some((attempt) => attempt.id === best.id)) selected[selected.length - 1] = best
    selectedByExercise.push(...selected)
  }

  const candidates = selectedByExercise.sort((left, right) => attemptTime(right) - attemptTime(left))
  const safeTotalLimit = Math.max(1, Math.floor(totalLimit))
  const protectedIds = new Set<string>()
  for (const group of groups.values()) {
    const retained = group.filter((attempt) => candidates.some((candidate) => candidate.id === attempt.id))
    if (retained[0]) protectedIds.add(retained[0].id)
    const best = [...retained]
      .filter((attempt): attempt is Attempt & { score: number } => attempt.score !== null)
      .sort((left, right) => right.score - left.score || attemptTime(right) - attemptTime(left))[0]
    if (best) protectedIds.add(best.id)
  }
  const protectedAttempts = candidates.filter((attempt) => protectedIds.has(attempt.id)).slice(0, safeTotalLimit)
  const protectedSet = new Set(protectedAttempts.map((attempt) => attempt.id))
  const attempts = [
    ...protectedAttempts,
    ...candidates.filter((attempt) => !protectedSet.has(attempt.id)),
  ]
    .slice(0, safeTotalLimit)
    .sort((left, right) => attemptTime(left) - attemptTime(right))

  return {
    attempts,
    evicted: originalCount - attempts.length,
    deduplicated: unique.length < originalCount,
  }
}

function storageFailure(error: unknown): StorageFailureReason {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : ''
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota-exceeded'
  if (name === 'SecurityError' || name === 'InvalidStateError') return 'storage-unavailable'
  return 'write-failed'
}

export class LocalRankingAdapter implements RankingPort {
  private storage: KeyValueStorage
  private persistent: boolean

  constructor(storage?: KeyValueStorage) {
    const browserStorage = storage ? null : browserLocalStorage()
    this.storage = storage ?? browserStorage ?? inMemoryFallback()
    this.persistent = storage !== undefined || browserStorage !== null
  }

  private readAll(): Attempt[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.map(normalizeAttempt).filter((attempt): attempt is Attempt => attempt !== null)
        : []
    } catch {
      // Corrupt or foreign data in the key never crashes the game. It is
      // treated as an empty local history, same as a first-time player.
      return []
    }
  }

  private writeAll(attempts: Attempt[], outcome: 'stored' | 'deduplicated', evicted: number): StorageWriteStatus {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(attempts))
      if (!this.persistent) {
        return { ok: false, outcome: 'failed', reason: 'storage-unavailable', evicted }
      }
      return { ok: true, outcome, evicted }
    } catch (error) {
      // D6: submit() "always wins the write" from the caller's point of
      // view. A storage failure (quota, private-mode Safari, a hostile
      // test double) must never surface as a thrown error and interrupt
      // play. The status lets the UI warn that the attempt was not persisted.
      return { ok: false, outcome: 'failed', reason: storageFailure(error), evicted }
    }
  }

  submit(input: SubmitAttemptInput): SubmitAttemptResult {
    const attempt: Attempt = { ...input, id: randomId(), createdAt: new Date().toISOString() }
    const compacted = compactAttempts([...this.readAll(), attempt])
    const storage = this.writeAll(
      compacted.attempts,
      compacted.deduplicated ? 'deduplicated' : 'stored',
      compacted.evicted,
    )
    return { ...attempt, storage }
  }

  getHistory(exerciseId?: string): Attempt[] {
    const all = this.readAll()
    return exerciseId ? all.filter((a) => a.exerciseId === exerciseId) : all
  }

  getSnapshot(exerciseId?: string): RankingSnapshot {
    const entries: RankingEntry[] = this.getHistory(exerciseId)
      .filter((a): a is Attempt & { score: number } => a.score !== null)
      .map((a) => ({ attemptId: a.id, exerciseId: a.exerciseId, score: a.score, createdAt: a.createdAt }))
      .sort((a, b) => b.score - a.score)
    return { source: 'local', entries }
  }

  hasScoredAttempt(exerciseId: string): boolean {
    return this.getHistory(exerciseId).some((a) => a.score !== null)
  }
}

// Shared singleton. The page shell script (RankingStrip.astro) and the
// React island (ForjaCanvas.tsx) both submit to and read from the exact
// same storage key through the exact same instance.
export const localRankingAdapter = new LocalRankingAdapter()
