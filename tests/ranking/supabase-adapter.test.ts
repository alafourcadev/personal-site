import { describe, expect, it, vi } from 'vitest'
import {
  createSupabaseRanking,
  defaultDisplayName,
  type SupabaseRankingClient,
} from '../../src/lib/forja/ranking/supabase-adapter'
import type { SubmitAttemptInput } from '../../src/lib/forja/ranking/port'

const ATTEMPT: SubmitAttemptInput = {
  exerciseId: 'n1-el-checkout',
  design: { nodes: [], edges: [] } as never,
  score: 80,
  ceiling: 100,
  engineVersion: '1.0.0',
}

function client(overrides: Partial<SupabaseRankingClient> = {}): SupabaseRankingClient {
  return {
    ensureSession: async () => ({ userId: 'user-1' }),
    insertAttempt: async () => undefined,
    readLeaderboard: async () => [],
    readExerciseBest: async () => [],
    setSharing: async () => undefined,
    ...overrides,
  }
}

describe('supabase ranking adapter', () => {
  // `leaderboard` inner-joins `profiles`, so a player with no profile row is
  // invisible on the board no matter how much they play. Anonymous players
  // never typed a name, so the adapter has to have one ready for them.
  describe('the name an anonymous player gets', () => {
    // Mirrors the check constraint on profiles.display_name in 0001_forja.sql.
    const CONSTRAINT = /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/

    it('satisfies the database constraint it will be inserted against', () => {
      const name = defaultDisplayName('383cc163-cc87-40b4-92d6-85fff5fc931a')
      expect(name).toMatch(CONSTRAINT)
      expect(name.length).toBeGreaterThanOrEqual(2)
      expect(name.length).toBeLessThanOrEqual(24)
    })

    it('is the same name every time, so a retry never claims a second one', () => {
      const id = '383cc163-cc87-40b4-92d6-85fff5fc931a'
      expect(defaultDisplayName(id)).toBe(defaultDisplayName(id))
    })

    it('separates two players', () => {
      expect(defaultDisplayName('383cc163-cc87-40b4-92d6-85fff5fc931a')).not.toBe(
        defaultDisplayName('a1b2c3d4-cc87-40b4-92d6-85fff5fc931a'),
      )
    })

    it('still obeys the constraint when the id is malformed or short', () => {
      for (const id of ['', '-', 'x', '----', '!!!']) {
        const name = defaultDisplayName(id)
        expect(name, `id: ${JSON.stringify(id)}`).toMatch(CONSTRAINT)
        expect(name.length).toBeGreaterThanOrEqual(2)
        expect(name.length).toBeLessThanOrEqual(24)
      }
    })
  })

  describe('construction', () => {
    it('does not exist without credentials, so the game never reaches for it', () => {
      expect(createSupabaseRanking({ url: '', anonKey: '' })).toBeNull()
      expect(createSupabaseRanking({ url: 'https://x.supabase.co', anonKey: '' })).toBeNull()
      expect(createSupabaseRanking({ url: '', anonKey: 'key' })).toBeNull()
    })
  })

  describe('pushing an attempt', () => {
    it('reports the attempt as synced when the write lands', async () => {
      const ranking = createSupabaseRanking({ url: 'https://x.supabase.co', anonKey: 'k' }, client())
      await expect(ranking!.push(ATTEMPT)).resolves.toEqual({ ok: true })
    })

    it('degrades instead of throwing when the write fails', async () => {
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({
          insertAttempt: async () => {
            throw new Error('permission denied')
          },
        }),
      )

      await expect(ranking!.push(ATTEMPT)).resolves.toEqual({ ok: false, reason: 'rejected' })
    })

    it('gives up on a hung request instead of hanging the game with it', async () => {
      vi.useFakeTimers()
      try {
        const ranking = createSupabaseRanking(
          { url: 'https://x.supabase.co', anonKey: 'k', timeoutMs: 3000 },
          client({ insertAttempt: () => new Promise(() => {}) }),
        )

        const pushed = ranking!.push(ATTEMPT)
        await vi.advanceTimersByTimeAsync(3000)
        await expect(pushed).resolves.toEqual({ ok: false, reason: 'timeout' })
      } finally {
        vi.useRealTimers()
      }
    })

    it('never signs the player in more than once for a run of attempts', async () => {
      const ensureSession = vi.fn(async () => ({ userId: 'user-1' }))
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({ ensureSession }),
      )

      await ranking!.push(ATTEMPT)
      await ranking!.push(ATTEMPT)

      expect(ensureSession).toHaveBeenCalledTimes(1)
    })
  })

  describe('reading the leaderboard', () => {
    it('labels rows it actually fetched as global', async () => {
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({
          readLeaderboard: async () => [
            { display_name: 'martina', exercises_solved: 3, total_score: 240, last_played_at: '2026-08-01T00:00:00Z' },
          ],
        }),
      )

      await expect(ranking!.leaderboard()).resolves.toEqual({
        source: 'global',
        rows: [{ displayName: 'martina', exercisesSolved: 3, totalScore: 240 }],
      })
    })

    it('says unavailable rather than inventing an empty ranking', async () => {
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({
          readLeaderboard: async () => {
            throw new Error('project paused')
          },
        }),
      )

      // A paused free project is the normal case, not the failure case. An
      // empty board would read as "nobody has played", which is a lie.
      await expect(ranking!.leaderboard()).resolves.toEqual({ source: 'unavailable', rows: [] })
    })
  })

  // The half of the board that teaches instead of ranking: the point is not
  // who scored more, it is being able to read a design that survived the
  // exercise you are stuck on.
  describe('reading the best designs per exercise', () => {
    const ROW = {
      exercise_id: 'n1-el-checkout',
      display_name: 'martina',
      score: 96,
      created_at: '2026-08-01T00:00:00Z',
      design: { nodes: [], edges: [] },
    }

    it('hands back the design when its author shared it', async () => {
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({ readExerciseBest: async () => [ROW] }),
      )

      await expect(ranking!.bestDesigns()).resolves.toEqual({
        source: 'global',
        rows: [
          {
            exerciseId: 'n1-el-checkout',
            displayName: 'martina',
            score: 96,
            design: { nodes: [], edges: [] },
          },
        ],
      })
    })

    it('still lists the score when the design was kept private', async () => {
      // The view nulls `design` out unless its author set is_shared, so a
      // private row is a real row with nothing to read, not a missing one.
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({ readExerciseBest: async () => [{ ...ROW, design: null }] }),
      )

      const best = await ranking!.bestDesigns()
      expect(best.rows[0].design).toBeNull()
      expect(best.rows[0].score).toBe(96)
    })

    it('says unavailable rather than claiming nobody has solved it', async () => {
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({
          readExerciseBest: async () => {
            throw new Error('project paused')
          },
        }),
      )

      await expect(ranking!.bestDesigns()).resolves.toEqual({ source: 'unavailable', rows: [] })
    })
  })

  describe('sharing your own designs', () => {
    it('passes the player id along, never a name the caller guessed', async () => {
      const setSharing = vi.fn(async () => undefined)
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({ setSharing }),
      )

      await expect(ranking!.share(true)).resolves.toEqual({ ok: true })
      expect(setSharing).toHaveBeenCalledWith('user-1', true)
    })

    it('reports the failure instead of pretending the design went public', async () => {
      // Telling a player their design is shared when it is not is the one lie
      // this feature must never tell.
      const ranking = createSupabaseRanking(
        { url: 'https://x.supabase.co', anonKey: 'k' },
        client({
          setSharing: async () => {
            throw new Error('permission denied')
          },
        }),
      )

      await expect(ranking!.share(true)).resolves.toEqual({ ok: false, reason: 'rejected' })
    })
  })
})
