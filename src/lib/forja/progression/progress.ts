// What the player already solved, read from the attempts the ranking port
// has been storing all along.
//
// C3's diagnosis: every attempt is persisted and no screen reads it. With
// 168 exercises, `/forja/niveles` said "Jugable" twelve times and the level
// list gave no sign of what had been played. Nothing new is stored here:
// this is the pure read side of `RankingPort`, so a "solved" mark can never
// drift from the ranking, and both list pages share one definition of
// solved instead of inventing two.
//
// Pure and DOM-free on purpose. Both list pages are static HTML whose
// progress is computed in the browser, but that is a wiring detail of the
// pages, not of this module, and it is what keeps this testable under
// Vitest's node environment.
import type { RankingPort } from '../ranking/port'
import {
  exerciseMastery,
  type MasteryOptions,
  type MasteryState,
  type TransferEvidence,
} from './mastery'

export type ProgressPort = Pick<RankingPort, 'getSnapshot' | 'getHistory'>

export interface ExerciseProgress {
  exerciseId: string
  attempted: boolean
  completed: boolean
  masteryReady: boolean
  mastered: boolean
  reviewDue: boolean
  state: MasteryState
  // Compatibility for existing list screens. Solved now means a perfect
  // completion, never merely a non-null score.
  solved: boolean
  // The best score ever reached on this exercise, or null when no attempt
  // was ever scored. `null` means "never solved", never "solved with 0".
  bestScore: number | null
}

export type ProgressLabelDensity = 'full' | 'compact'

export function progressStateLabel(
  progress: Pick<
    ExerciseProgress,
    | 'attempted'
    | 'completed'
    | 'masteryReady'
    | 'mastered'
    | 'reviewDue'
    | 'bestScore'
  >,
  density: ProgressLabelDensity = 'full',
): string {
  if (progress.reviewDue)
    return density === 'compact' ? 'repaso' : 'Repaso pendiente'
  if (progress.mastered) return density === 'compact' ? 'dominado' : 'Dominado'
  if (progress.masteryReady)
    return density === 'compact'
      ? 'transferir'
      : '100 · transferencia pendiente'
  if (progress.completed)
    return density === 'compact'
      ? 'defender'
      : '100 · falta defender la decisión'
  if (progress.attempted) {
    if (density === 'compact')
      return progress.bestScore === null
        ? 'intento'
        : String(progress.bestScore)
    return progress.bestScore === null
      ? 'Intentado · todavía sin puntaje'
      : `Intentado · mejor puntaje ${progress.bestScore}`
  }
  return density === 'compact' ? 'pendiente' : 'Pendiente'
}

export function bestScore(
  port: Pick<RankingPort, 'getSnapshot'>,
  exerciseId: string,
): number | null {
  // getSnapshot() already filters unscored attempts and sorts descending, so
  // the first entry IS the best. Re-deriving it here would be a second
  // definition of "best" that could drift from the ranking's own.
  const [best] = port.getSnapshot(exerciseId).entries
  return best?.score ?? null
}

export function exerciseProgress(
  port: ProgressPort,
  exerciseId: string,
  transferEvidence: readonly TransferEvidence[] = [],
  options: MasteryOptions = {},
): ExerciseProgress {
  const mastery = exerciseMastery(
    exerciseId,
    port.getHistory(exerciseId),
    transferEvidence,
    options,
  )
  return {
    exerciseId,
    attempted: mastery.attempted,
    completed: mastery.completed,
    masteryReady: mastery.masteryReady,
    mastered: mastery.mastered,
    reviewDue: mastery.reviewDue,
    state: mastery.state,
    solved: mastery.completed,
    bestScore: bestScore(port, exerciseId),
  }
}

export function solvedCount(
  port: ProgressPort,
  exerciseIds: readonly string[],
): number {
  return exerciseIds.filter((id) => exerciseProgress(port, id).completed).length
}

export function masteredCount(
  port: ProgressPort,
  exerciseIds: readonly string[],
  transferEvidence: readonly TransferEvidence[],
  options: MasteryOptions = {},
): number {
  return exerciseIds.filter(
    (id) => exerciseProgress(port, id, transferEvidence, options).mastered,
  ).length
}

function exercises(total: number): string {
  return total === 1 ? '1 ejercicio' : `${total} ejercicios`
}

// What the server renders before the browser has read localStorage. Both
// list pages are static HTML, so the first paint cannot know this player's
// progress, and must therefore claim none. Stating the size of the level
// is true for every player at once; "0 de 14 resueltos" is not.
export function publishedLabel(total: number): string {
  if (total === 0) return 'Todavía sin ejercicios publicados'
  return total === 1
    ? '1 ejercicio publicado'
    : `${total} ejercicios publicados`
}

// One level's progress line. The zero case deliberately does not read
// "0 de 14": a hollow zero is what the page shows before the browser has
// read localStorage, and the copy must not be indistinguishable from a
// screen that has not finished loading.
export function progressLabel(solved: number, total: number): string {
  if (total === 0) return 'Todavía sin ejercicios publicados'
  if (solved === 0) return `${exercises(total)} · todavía ninguno resuelto`
  const counted = `${solved} de ${total} ${solved === 1 ? 'resuelto' : 'resueltos'}`
  return solved === total ? `${counted} · nivel completo` : counted
}

// The same numbers for the whole game. Separate function, not a flag: the
// level map's overall line is not talking about a level, so it must never
// inherit "nivel completo", and on a page listing 12 levels a bare
// "12 de 168" has no subject.
export function overallProgressLabel(solved: number, total: number): string {
  if (total === 0) return 'Todavía sin ejercicios publicados'
  if (solved === 0)
    return `${exercises(total)} publicados · todavía ninguno resuelto`
  return `${solved} de ${total} ejercicios resueltos en toda La Forja`
}
