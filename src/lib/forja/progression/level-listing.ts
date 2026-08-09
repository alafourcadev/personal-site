// Adapter between a content collection entry and `order.ts`.
//
// `orderExercises` takes `{ id, role, difficultyIndex, tradeoffPairId }` and
// is deliberately level- and content-agnostic. A page has whole entries
// whose difficulty lives as nine flat `D1..D9` frontmatter fields, and it
// needs the entries back (title, domain, body) rather than the projection.
// This is that translation and nothing else. The ordering rule itself
// stays in one place.
import { difficultyIndex, type DifficultyAxes } from './difficulty'
import { orderExercises } from './order'
import type { ExerciseRole } from './types'

export interface LevelListingEntry {
  id: string
  data: DifficultyAxes & {
    role: ExerciseRole
    tradeoffPairId?: string
  }
}

export function orderLevelEntries<T extends LevelListingEntry>(entries: readonly T[]): T[] {
  return orderExercises(
    entries.map((entry) => ({
      entry,
      id: entry.id,
      role: entry.data.role,
      difficultyIndex: difficultyIndex(entry.data),
      tradeoffPairId: entry.data.tradeoffPairId,
    })),
  ).map((ordered) => ordered.entry)
}
