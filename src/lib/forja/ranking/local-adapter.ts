// Design D6: LocalRankingAdapter — unconditional, synchronous, always
// wins the write. R1 ships this alone; R3 adds SupabaseRankingAdapter
// behind the same RankingPort, purely additive.
//
// Storage is injected (KeyValueStorage), not read from a bare global
// `localStorage`: (1) makes this file Vitest-testable under
// `environment: 'node'`, where no global `localStorage` exists — verified
// directly (Node 24 only exposes one behind `--experimental-webstorage`
// plus a mandatory file path, unusable for a test runner); (2) the
// fallback below never throws even if this module is ever evaluated
// outside a browser (it shouldn't be — both call sites are client-only —
// but "never crash the page over a ranking write" is the whole point of
// D6, so the module itself should not depend on the environment being
// exactly right).
import type { Attempt, RankingEntry, RankingPort, RankingSnapshot, SubmitAttemptInput } from './port'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const STORAGE_KEY = 'forja:attempts:v1'

function inMemoryFallback(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
}

function browserLocalStorage(): KeyValueStorage | null {
  if (typeof globalThis === 'undefined') return null
  const candidate = (globalThis as { localStorage?: KeyValueStorage }).localStorage
  return candidate ?? null
}

function randomId(): string {
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export class LocalRankingAdapter implements RankingPort {
  private storage: KeyValueStorage

  constructor(storage: KeyValueStorage = browserLocalStorage() ?? inMemoryFallback()) {
    this.storage = storage
  }

  private readAll(): Attempt[] {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      // Corrupt/foreign data in the key never crashes the game — treated
      // as an empty local history, same as a first-time player.
      return []
    }
  }

  private writeAll(attempts: Attempt[]): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(attempts))
    } catch {
      // D6: submit() "always wins the write" from the caller's point of
      // view — a storage failure (quota, private-mode Safari, a hostile
      // test double) must never surface as a thrown error and interrupt
      // play. The attempt is simply not persisted for next time.
    }
  }

  submit(input: SubmitAttemptInput): Attempt {
    const attempt: Attempt = { ...input, id: randomId(), createdAt: new Date().toISOString() }
    const all = this.readAll()
    all.push(attempt)
    this.writeAll(all)
    return attempt
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

// Shared singleton — the page shell script (RankingStrip.astro) and the
// React island (ForjaCanvas.tsx) both submit to and read from the exact
// same storage key through the exact same instance.
export const localRankingAdapter = new LocalRankingAdapter()
