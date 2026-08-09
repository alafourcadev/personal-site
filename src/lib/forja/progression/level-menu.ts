// The level, as the shell's menu shows it: every exercise in play order, which
// one is open, and the two steps beside it.
//
// Why it exists. The committee measured that finishing a level is a dead end.
// `next-step.ts`'s `last-of-level` is a variant with no payload, so the result
// panel can only print "Era el último ejercicio de este nivel" with no link,
// no next level and no way back to the map. That case happens eleven times,
// while the one that does offer a link happens once. A menu that is
// always one click away is the cheapest exit from it, and it answers the
// question the player has at every other moment too: what came before this,
// what comes after, and which of the fourteen have I already solved.
//
// A thin adapter over `order.ts`, never a second ordering: the level list, the
// "next exercise" link and this menu all read the same function, which is the
// only way three surfaces can be guaranteed not to disagree about what comes
// after what.
//
// Pure and DOM-free. Whether an exercise is solved lives in localStorage and
// is decided in the browser (the pages are static); the order, the positions
// and the neighbours are build-time facts and live here.
import { orderExercises, type OrderableExercise } from './order'

export interface LevelMenuEntry {
  id: string
  title: string
  href: string
  // One-based, because the player counts from one and the level list already
  // prints these numbers.
  position: number
  current: boolean
}

export interface LevelMenuStep {
  href: string
  title: string
}

export interface LevelMenu {
  level: number
  total: number
  // `null` when the open exercise is not part of this level's set, which is a
  // bug upstream rather than a reason to point the menu somewhere arbitrary.
  position: number | null
  entries: LevelMenuEntry[]
  previous: LevelMenuStep | null
  next: LevelMenuStep | null
}

interface TitledExercise extends OrderableExercise {
  title: string
}

export function levelMenuFor<T extends TitledExercise>(
  exercises: readonly T[],
  currentId: string,
  level: number,
): LevelMenu {
  const ordered = orderExercises(exercises)
  const index = ordered.findIndex((exercise) => exercise.id === currentId)

  const step = (exercise: T | undefined): LevelMenuStep | null =>
    exercise ? { href: `/forja/${level}/${exercise.id}`, title: exercise.title } : null

  return {
    level,
    total: ordered.length,
    position: index === -1 ? null : index + 1,
    entries: ordered.map((exercise, i) => ({
      id: exercise.id,
      title: exercise.title,
      href: `/forja/${level}/${exercise.id}`,
      position: i + 1,
      current: exercise.id === currentId,
    })),
    previous: index > 0 ? step(ordered[index - 1]) : null,
    next: index !== -1 && index < ordered.length - 1 ? step(ordered[index + 1]) : null,
  }
}
