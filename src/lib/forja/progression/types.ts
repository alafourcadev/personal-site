// Shared vocabulary between the content schema (content.config.ts), the
// unlock logic (unlock.ts) and the level map. One source of truth for the
// role enum so the Zod schema and the pure progression logic never drift.
// `greenfield` is the only role that opens on an empty canvas. Every other
// role ships the system its brief describes and asks the player to repair it,
// which is what the whole corpus did until now: zero of 169 exercises started
// blank. Repair teaches recognition. It never asks the one question that
// building from zero asks, which is which pieces should exist at all.
export type ExerciseRole =
  | 'calibration'
  | 'core'
  | 'greenfield'
  | 'tradeoff'
  | 'trap'
  | 'counter-trap'
  | 'synthesis'

export const EXERCISE_ROLES: ExerciseRole[] = [
  'calibration',
  'core',
  'greenfield',
  'tradeoff',
  'trap',
  'counter-trap',
  'synthesis',
]

// Plain-language role labels for the player-facing exercise list, never
// the raw enum value ("Plain language everywhere except canonical
// technical terms").
export const ROLE_LABEL: Record<ExerciseRole, string> = {
  calibration: 'Calibración',
  core: 'Núcleo',
  greenfield: 'Lienzo en blanco',
  tradeoff: 'Tradeoff',
  trap: 'Trampa',
  'counter-trap': 'Contra-trampa',
  synthesis: 'Síntesis',
}

export type ExerciseStatus = 'DRAFT' | 'REVIEW' | 'PILOT' | 'PUBLISHED'

export const EXERCISE_STATUSES: ExerciseStatus[] = ['DRAFT', 'REVIEW', 'PILOT', 'PUBLISHED']

// EC6: only these two statuses are ever served to a player.
export function isPlayable(status: ExerciseStatus): boolean {
  return status === 'PILOT' || status === 'PUBLISHED'
}
