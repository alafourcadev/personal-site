// La Forja · R3 · the global half of the ranking.
//
// This is NOT a `RankingPort`. Per design D6 the local adapter is synchronous
// and always wins the write; this layers a best-effort network call ALONGSIDE
// it, never instead of it. Nothing here may throw, and nothing here may keep
// the player waiting: a Supabase Free project pauses after 7 days idle, so
// "unavailable" is the normal case, not the failure case.
import type { SubmitAttemptInput } from './port'

export interface SupabaseRankingConfig {
  url: string
  anonKey: string
  timeoutMs?: number
}

export interface LeaderboardRowPayload {
  display_name: string
  exercises_solved: number
  total_score: number
  last_played_at: string
}

export interface LeaderboardRow {
  displayName: string
  exercisesSolved: number
  totalScore: number
}

export interface ExerciseBestPayload {
  exercise_id: string
  display_name: string
  score: number
  created_at: string
  // Null whenever its author never shared it. The view decides this, not us.
  design: unknown | null
}

export interface ExerciseBestRow {
  exerciseId: string
  displayName: string
  score: number
  design: unknown | null
}

// The seam that keeps this file testable without a network or a real project.
export interface SupabaseRankingClient {
  ensureSession(): Promise<{ userId: string }>
  insertAttempt(userId: string, attempt: SubmitAttemptInput): Promise<void>
  readLeaderboard(): Promise<LeaderboardRowPayload[]>
  readExerciseBest(exerciseId?: string): Promise<ExerciseBestPayload[]>
  setSharing(userId: string, shared: boolean): Promise<void>
}

export type PushOutcome = { ok: true } | { ok: false; reason: 'timeout' | 'rejected' }

export interface SupabaseRanking {
  push(attempt: SubmitAttemptInput): Promise<PushOutcome>
  leaderboard(): Promise<{ source: 'global' | 'unavailable'; rows: LeaderboardRow[] }>
  bestDesigns(
    exerciseId?: string,
  ): Promise<{ source: 'global' | 'unavailable'; rows: ExerciseBestRow[] }>
  share(shared: boolean): Promise<PushOutcome>
}

const DEFAULT_TIMEOUT_MS = 3000
const LEADERBOARD_LIMIT = 50
const BEST_DESIGNS_LIMIT = 100
const NAME_PREFIX = 'forjador-'
const NAME_SUFFIX_LENGTH = 8

// Survives a malformed id: an empty or punctuation-only suffix would break the
// `length between 2 and 24` check the database enforces on display_name.
function digest(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0
  }
  return hash.toString(36).padStart(2, '0')
}

/**
 * The board inner-joins `profiles`, so a player with no profile row never
 * appears on it. Anonymous players never typed a name, so we derive a stable
 * one from their id: same id, same name, which keeps a retry from claiming a
 * second row. It stays inside the check constraint in 0001_forja.sql.
 */
export function defaultDisplayName(userId: string): string {
  const alphanumeric = userId.replace(/[^a-zA-Z0-9]/g, '')
  const suffix = (alphanumeric || digest(userId)).slice(0, NAME_SUFFIX_LENGTH)
  return `${NAME_PREFIX}${suffix}`
}

class TimeoutError extends Error {}

// Races the work against the clock and always settles. The timer is cleared on
// both paths so a resolved call never leaves a handle behind.
function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const clock = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), timeoutMs)
  })
  return Promise.race([work, clock]).finally(() => clearTimeout(timer)) as Promise<T>
}

function browserClient(config: SupabaseRankingConfig): SupabaseRankingClient {
  // Imported lazily so the module graph of anyone who merely imports this file
  // (tests, the page shell) does not drag the whole SDK along with it.
  const load = import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.anonKey),
  )

  // Best effort by design: failing to seat a profile only leaves the player off
  // the board, which beats losing the attempt they just finished. The next
  // session tries again, and `ignoreDuplicates` keeps a name they chose later.
  async function ensureProfile(supabase: Awaited<typeof load>, userId: string): Promise<void> {
    await supabase
      .from('profiles')
      .upsert(
        { id: userId, display_name: defaultDisplayName(userId) },
        { onConflict: 'id', ignoreDuplicates: true },
      )
  }

  return {
    async ensureSession() {
      const supabase = await load
      const { data } = await supabase.auth.getSession()
      let userId = data.session?.user?.id
      if (!userId) {
        // Anonymous sign-in yields a real auth.uid(), which is what every RLS
        // policy in 0001_forja.sql is written against. Linking an email later
        // keeps the same id, so nobody loses their history by signing up.
        const { data: created, error } = await supabase.auth.signInAnonymously()
        if (error || !created.user) throw error ?? new Error('anonymous-sign-in-failed')
        userId = created.user.id
      }
      // Runs on a returning session too: the row may be missing because an
      // earlier attempt to seat it failed, not only because the player is new.
      await ensureProfile(supabase, userId).catch(() => undefined)
      return { userId }
    },

    async insertAttempt(userId, attempt) {
      const supabase = await load
      const { error } = await supabase.from('attempts').insert({
        user_id: userId,
        exercise_id: attempt.exerciseId,
        design: attempt.design,
        score: attempt.score,
        ceiling: attempt.ceiling,
        // An unscored attempt is an illegal one: the engine only withholds a
        // score when the design breaks a rule.
        legal: attempt.score !== null,
        engine_version: attempt.engineVersion,
      })
      if (error) throw error
    },

    async readLeaderboard() {
      const supabase = await load
      const { data, error } = await supabase
        .from('leaderboard')
        .select('display_name, exercises_solved, total_score, last_played_at')
        .limit(LEADERBOARD_LIMIT)
      if (error) throw error
      return (data ?? []) as LeaderboardRowPayload[]
    },

    async readExerciseBest(exerciseId) {
      const supabase = await load
      const query = supabase
        .from('exercise_best')
        .select('exercise_id, display_name, score, created_at, design')
        .order('score', { ascending: false })
        .limit(BEST_DESIGNS_LIMIT)
      const { data, error } = await (exerciseId
        ? query.eq('exercise_id', exerciseId)
        : query)
      if (error) throw error
      return (data ?? []) as ExerciseBestPayload[]
    },

    async setSharing(userId, shared) {
      const supabase = await load
      // Scoped to the caller's own rows on purpose. RLS would reject anything
      // else anyway, so this states the intent rather than relying on it.
      const { error } = await supabase
        .from('attempts')
        .update({ is_shared: shared })
        .eq('user_id', userId)
      if (error) throw error
    },
  }
}

export function createSupabaseRanking(
  config: SupabaseRankingConfig,
  client?: SupabaseRankingClient,
): SupabaseRanking | null {
  // Missing credentials are not an error. R1 builds and plays with none, and
  // this returning null is what makes that a property rather than a promise.
  if (!config.url || !config.anonKey) return null

  const remote = client ?? browserClient(config)
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  let session: Promise<{ userId: string }> | null = null

  function currentSession(): Promise<{ userId: string }> {
    if (!session) {
      // A failed sign-in is forgotten so the next attempt can try again; a
      // successful one is reused for the rest of the session.
      session = remote.ensureSession().catch((error) => {
        session = null
        throw error
      })
    }
    return session
  }

  return {
    async push(attempt) {
      try {
        await withTimeout(
          currentSession().then(({ userId }) => remote.insertAttempt(userId, attempt)),
          timeoutMs,
        )
        return { ok: true }
      } catch (error) {
        return { ok: false, reason: error instanceof TimeoutError ? 'timeout' : 'rejected' }
      }
    },

    async leaderboard() {
      try {
        const rows = await withTimeout(remote.readLeaderboard(), timeoutMs)
        return {
          source: 'global',
          rows: rows.map((row) => ({
            displayName: row.display_name,
            exercisesSolved: row.exercises_solved,
            totalScore: row.total_score,
          })),
        }
      } catch {
        // Never an empty global board: "nobody has played" and "we could not
        // ask" are different facts, and only one of them is true here.
        return { source: 'unavailable', rows: [] }
      }
    },

    async bestDesigns(exerciseId) {
      try {
        const rows = await withTimeout(remote.readExerciseBest(exerciseId), timeoutMs)
        return {
          source: 'global',
          rows: rows.map((row) => ({
            exerciseId: row.exercise_id,
            displayName: row.display_name,
            score: row.score,
            design: row.design ?? null,
          })),
        }
      } catch {
        // Same honesty as the board above: "nobody solved this yet" is a very
        // different message from "we could not reach the project".
        return { source: 'unavailable', rows: [] }
      }
    },

    async share(shared) {
      try {
        await withTimeout(
          currentSession().then(({ userId }) => remote.setSharing(userId, shared)),
          timeoutMs,
        )
        return { ok: true }
      } catch (error) {
        // A player who was told "shared" must actually be shared, so a failure
        // is reported rather than swallowed the way a lost attempt can be.
        return { ok: false, reason: error instanceof TimeoutError ? 'timeout' : 'rejected' }
      }
    },
  }
}
