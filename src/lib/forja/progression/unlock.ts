// PR1/PR2: a level is complete only once the player has a passing attempt
// for at least one exercise of every role THAT LEVEL ACTUALLY SHIPS — never
// a raw completed-count threshold (the exact shortcut doc §14.4 flags at
// forja-app.html:823, `done >= ceil(total/2)`, which unlocked the next level
// on core exercises alone). "Present in that level" is load-bearing: a beta
// level with no trap/counter-trap content (C2 — beta floor is 8, trap pairs
// only enter at the 14-exercise "complete" tier) never requires one, because
// requiredRoles() only returns roles the level's own catalog contains.
import type { ExerciseRole } from './types'

export function requiredRoles(levelExerciseRoles: readonly ExerciseRole[]): ExerciseRole[] {
  return [...new Set(levelExerciseRoles)]
}

export interface LevelCompletion {
  complete: boolean
  missingRoles: ExerciseRole[]
}

export function isLevelComplete(required: readonly ExerciseRole[], passedRoles: ReadonlySet<ExerciseRole>): LevelCompletion {
  const missingRoles = required.filter((role) => !passedRoles.has(role))
  return { complete: missingRoles.length === 0, missingRoles }
}
