// Shared vocabulary between the content schema (content.config.ts), the
// unlock logic (unlock.ts) and the level map — one source of truth for the
// role enum so the Zod schema and the pure progression logic never drift.
export type ExerciseRole = 'calibration' | 'core' | 'tradeoff' | 'trap' | 'counter-trap' | 'synthesis'

export const EXERCISE_ROLES: ExerciseRole[] = ['calibration', 'core', 'tradeoff', 'trap', 'counter-trap', 'synthesis']

// Plain-language role labels for the player-facing exercise list — never
// the raw enum value ("Plain language everywhere except canonical
// technical terms").
export const ROLE_LABEL: Record<ExerciseRole, string> = {
  calibration: 'Calibración',
  core: 'Núcleo',
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
