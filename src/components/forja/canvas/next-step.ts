// What the player is offered once they have a verdict on screen.
//
// Before this, the only link inside <main> on an exercise page was
// "← Nivel N". With 14 exercises per level, continuing meant going back to
// the list and guessing which one came next, while the level HAS a
// deliberate play order (calibración → núcleo → tradeoff en pares → trampa →
// contra-trampa → síntesis) that the list already renders.
//
// So this is a thin adapter over `progression/order.ts`, never a second
// ordering: the list and the "next" link read the same function, which is the
// only way the two can be guaranteed not to disagree.
import { nextExercise, type OrderableExercise } from '../../../lib/forja/progression/order'
import { LEVELS } from '../../../lib/forja/progression/levels'

// Read from the level map, never written as a literal: a thirteenth level
// moves the ending with it instead of leaving it stranded on twelve.
const LAST_LEVEL_ID = LEVELS[LEVELS.length - 1].id

export type NextStep =
  | { kind: 'next'; href: string; title: string }
  | { kind: 'last-of-level' }
  // The end of the last level is the end of the game. Its own exercise says
  // so in the brief ("Último ejercicio del juego"), and it was closing with
  // the same "era el último ejercicio de este nivel" that level 4 closes
  // with. It is the only line in the product a player reads exactly once.
  | { kind: 'game-complete' }

export interface OrderableTitledExercise extends OrderableExercise {
  title: string
}

export function nextStepFor(
  exercises: readonly OrderableTitledExercise[],
  currentId: string,
  level: number,
): NextStep {
  const next = nextExercise(exercises, currentId)
  // An id that is not in this level's set is an honest end, not a reason to
  // link somewhere arbitrary, and `nextExercise` already returns null for it.
  if (!next) return level === LAST_LEVEL_ID ? { kind: 'game-complete' } : { kind: 'last-of-level' }
  return { kind: 'next', href: `/forja/${level}/${next.id}`, title: next.title }
}
