// "Volver y seguir": the design a player sees when returning to an
// exercise. Deliberately reads the SAME `RankingPort.getHistory(exerciseId)`
// the existing `LocalRankingAdapter` already exposes. Persistence is not
// reinvented; this is just the pure read side of it: the most recently
// saved attempt's graph, or `fallback` for a first-time visit.
//
// R1-H: a first-time visit used to always fall back to a blank canvas. That
// was the empty-canvas defect that made every role-anchored exercise unplayable
// (there was no way to give a player-created node a role). `fallback` is
// now a parameter, defaulting to blank only for free play (which has no
// starting design); a real exercise passes its own `startingDesign`.
import type { Attempt } from '../ranking/port'
import type { Design } from '../engine/types'

const BLANK: Design = { nodes: [], edges: [] }

// C3: restoring the graph and dropping the verdict is what made the product
// forget. A player who scored 100, left, and came back was shown their own
// winning design under "Todavía no probaste tu diseño". The attempt had a
// score on file the whole time, and this function threw it away.
//
// The score belongs to THAT graph. When the last attempt was illegal, the
// restored score is null even if an earlier attempt scored: pairing a
// design with a score it did not earn is the same class of lie as the
// ranking strip showing another exercise's number. "Best score ever" is a
// separate, separately-labelled read (progression/progress.ts).
export interface ContinuedAttempt {
  design: Design
  score: number | null
  ceiling: number | null
  // The engine that produced `score`. A consumer comparing it against the
  // current ENGINE_VERSION can tell a stale verdict from a current one.
  // This module stays pure and does not decide that policy.
  engineVersion: string | null
}

type RestorableAttempt = Pick<Attempt, 'design'> & Partial<Pick<Attempt, 'score' | 'ceiling' | 'engineVersion'>>

export function continuedAttempt(history: readonly RestorableAttempt[], fallback: Design = BLANK): ContinuedAttempt {
  const last = history[history.length - 1]
  if (!last) return { design: fallback, score: null, ceiling: null, engineVersion: null }
  return {
    design: last.design ?? fallback,
    score: last.score ?? null,
    ceiling: last.ceiling ?? null,
    engineVersion: last.engineVersion ?? null,
  }
}

// Kept as-is for every existing caller. Defined in terms of the function
// above so the design a player sees and the score attached to it can never
// come from two different attempts.
export function continuedDesign(history: Pick<Attempt, 'design'>[], fallback: Design = BLANK): Design {
  return continuedAttempt(history, fallback).design
}

// Whether the result panel should open on a verdict instead of the "todavía
// no probaste tu diseño" empty state. True only when the attempt whose graph
// was restored carried a score of its own. Pairing the restored design with
// an older attempt's number is the same class of lie the ranking strip told.
//
// The verdict itself is recomputed from that graph by the caller: only the
// score is persisted, never the findings, and re-evaluating means the player
// reads today's engine rather than a stale snapshot.
export function shouldRestoreVerdict(history: readonly RestorableAttempt[]): boolean {
  return continuedAttempt(history).score !== null
}
