// Doc §14.4's play order for one level's exercises. Pure and level-agnostic:
// the level page renders it, and the exercise page uses the same function to
// know what "next" means, so the two can never disagree.
//
// It exists because `getCollection` returns the filesystem's alphabetical
// order of the slug, which put `counter-trap` (8th) six positions ahead of
// the `trap` (14th) it answers, while the counter-trap's own text says "el
// mismo hotel del ejercicio anterior". The content was right; the order was
// an accident of string comparison.
import type { ExerciseRole } from './types'

// calibración → núcleo → lienzo en blanco → tradeoff (en pares) → trampa →
// contra-trampa → síntesis
//
// The empty canvas sits after core and before the pairs on purpose. It is the
// only exercise that asks which pieces should exist at all, and that question
// is unanswerable until the level's own core exercises have shown what those
// pieces do. Putting it first would ask a player to choose from a vocabulary
// the level has not taught yet.
export const ROLE_ORDER: readonly ExerciseRole[] = [
  'calibration',
  'core',
  'greenfield',
  'tradeoff',
  'trap',
  'counter-trap',
  'synthesis',
]

export interface OrderableExercise {
  id: string
  role: ExerciseRole
  difficultyIndex: number
  tradeoffPairId?: string
}

function roleRank(role: ExerciseRole): number {
  const i = ROLE_ORDER.indexOf(role)
  // An unknown role sorts last rather than throwing: this runs at build time
  // for every level, and a new role in the schema should not blank a page.
  return i === -1 ? ROLE_ORDER.length : i
}

// Difficulty first, then id, never the input order. Two builds of the same
// content must produce the same page, and `getCollection`'s order is a
// filesystem detail we deliberately do not inherit.
function byDifficultyThenId<T extends OrderableExercise>(a: T, b: T): number {
  return a.difficultyIndex - b.difficultyIndex || a.id.localeCompare(b.id)
}

// A contrasted pair teaches by comparison, so its two halves must be played
// back to back. Sorting tradeoffs by difficulty alone interleaves two pairs
// (10, 11, 12, 13) and destroys exactly the mechanism the pair exists for.
// Grouping first, then ordering the groups by their easiest member, keeps the
// pair whole and still puts the gentler decision first.
function orderTradeoffs<T extends OrderableExercise>(tradeoffs: T[]): T[] {
  const paired = new Map<string, T[]>()
  // A tradeoff with no pair id is malformed content (composition.ts reports
  // it). It becomes a group of one rather than being merged with every other
  // unpaired tradeoff.
  //
  // Those used to be keyed into the same map by a NUL byte followed by the
  // id, on the argument that a NUL can never collide with a real pair id.
  // True, and it cost more than it bought: one NUL byte in a source file
  // makes `file` call it data, makes grep skip it as binary without saying
  // so, and makes git print "Binary files differ" instead of a diff. Three
  // em dashes lived in this file, invisible both to a sweep of the whole
  // product and to the command that sweep was verified with. A second list
  // is the same grouping with none of that.
  const unpaired: T[][] = []
  for (const e of tradeoffs) {
    if (!e.tradeoffPairId) {
      unpaired.push([e])
      continue
    }
    paired.set(e.tradeoffPairId, [...(paired.get(e.tradeoffPairId) ?? []), e])
  }

  return [...paired.values(), ...unpaired]
    .map((members) => [...members].sort(byDifficultyThenId))
    .sort((a, b) => byDifficultyThenId(a[0], b[0]))
    .flat()
}

export function orderExercises<T extends OrderableExercise>(exercises: readonly T[]): T[] {
  const byRole = new Map<number, T[]>()
  for (const e of exercises) {
    const rank = roleRank(e.role)
    byRole.set(rank, [...(byRole.get(rank) ?? []), e])
  }

  return [...byRole.keys()]
    .sort((a, b) => a - b)
    .flatMap((rank) => {
      const group = byRole.get(rank) as T[]
      return ROLE_ORDER[rank] === 'tradeoff' ? orderTradeoffs(group) : [...group].sort(byDifficultyThenId)
    })
}

// The exercise a player should open after finishing `currentId`, or null when
// it is the last of the level. Same ordering as the list by construction.
export function nextExercise<T extends OrderableExercise>(
  exercises: readonly T[],
  currentId: string,
): T | null {
  const ordered = orderExercises(exercises)
  const i = ordered.findIndex((e) => e.id === currentId)
  if (i === -1 || i === ordered.length - 1) return null
  return ordered[i + 1]
}
