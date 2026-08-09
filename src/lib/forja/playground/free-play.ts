// The playground's presentation-layer result BEFORE real exercise content
// exists. `/forja` has no `[level]/[exercise]` route yet (R1-F ships the
// first real content, level 4's eight exercises). Until one loads a real
// `ExerciseSpec` with real guarantees, every submission here is free play.
//
// Spec "Free play without a loaded exercise produces no score": the engine
// still reports legality and findings (evaluateLegality, the same module
// the canvas already calls for live error highlighting), but nothing here
// ever carries a numeric score. Scoring free play against a placeholder
// exercise was the exact defect this replaces: a guarantee whose target type
// is absent from the canvas is vacuously satisfied by the predicate DSL's
// own empty-set semantics (`Array.prototype.every` on `[]`), so two
// unrelated, unconnected components could reach a perfect 100, rewarding
// nothing. That is not an engine bug (see src/lib/forja/engine/score.ts's
// own comment: a real exercise always declares 3-5 guarantees whose target
// nodes the brief gives the player, so the empty-set case never arises in
// practice). It is what happens when a placeholder ExerciseSpec is scored
// as if it were real content. The fix is to never score free play at all,
// not to patch the placeholder.
import type { Finding } from '../engine/types'

// Kept for the local ranking adapter's `exerciseId` field only. Free play
// is explicitly not tied to any real exercise, so this is a fixed sentinel,
// never a `content` collection id.
export const FREE_PLAY_EXERCISE_ID = 'free-play'

export interface FreePlayResult {
  legal: boolean
  findings: Finding[]
}
