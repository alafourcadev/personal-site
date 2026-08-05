// Design D6: a ranking port with a local adapter that always wins the
// write. Pure types only — no localStorage/DOM here, so this file stays
// importable from anywhere (Astro's page shell script, the React island,
// tests) without dragging a browser-only dependency along.
//
// R1 ships `LocalRankingAdapter` alone (see local-adapter.ts). R3 adds
// `SupabaseRankingAdapter` behind this exact same interface — additive,
// per D6, not a rewrite. `source` is deliberately a closed union today
// (`'local' | 'unavailable'`); R3 widens it, it never narrows.
import type { Design } from '../engine/types'

export interface SubmitAttemptInput {
  exerciseId: string
  design: Design
  // RK7: the graph is what gets stored — score/ceiling/engineVersion ride
  // along as the evaluator's own verdict on that graph, never a bare number.
  score: number | null
  ceiling: number
  engineVersion: string
}

export interface Attempt extends SubmitAttemptInput {
  id: string
  createdAt: string
}

export interface RankingEntry {
  attemptId: string
  exerciseId: string
  score: number
  createdAt: string
}

// RK5: the source IS the honest label — every consumer (RankingStrip's
// script, a future React panel) reads this instead of hardcoding "local"
// as a UI string that could drift from what the data actually is.
export type RankingSource = 'local' | 'unavailable'

export interface RankingSnapshot {
  source: RankingSource
  entries: RankingEntry[]
}

export interface RankingPort {
  // Unconditional and synchronous by design (D6) — never returns a Promise,
  // never throws. A future SupabaseRankingAdapter layers its own async
  // network call ALONGSIDE this, never instead of it.
  submit(input: SubmitAttemptInput): Attempt
  // Ranked (scored, legal) entries only, sorted score descending.
  getSnapshot(exerciseId?: string): RankingSnapshot
  // Every attempt including illegal/unscored ones — personal history,
  // per the spec's "local history does not retroactively score" (C3):
  // preserved for the player, excluded from the ranked total by construction.
  getHistory(exerciseId?: string): Attempt[]
  // Best-answers gate primitive (RK10, first half): true only once the
  // player has at least one scored (non-null, legal) attempt for this
  // exercise. The structural-diversity curation half of RK10 is explicitly
  // NOT here — R3.9 blocks it pending a design decision (no ad-hoc
  // heuristic), see apply-progress.
  hasScoredAttempt(exerciseId: string): boolean
}
