// What one row of the ranking strip says.
//
// The strip has two modes and they need opposite things. Scoped to an
// exercise (the play route passes its id), the page's own heading already
// names it, so repeating the title in every row is noise. Unscoped (free
// play at `/forja`, which legitimately shows attempts across the whole
// game), a row that is only "#1 · Vos · 100" is a number without a subject.
// The player cannot tell which of 168 exercises it belongs to.
//
// The retired-exercise fallback never degrades to the slug on purpose: slugs
// carry the authoring role (`n7-trap-…`), which is precisely what the level
// list stopped showing.
const RETIRED_EXERCISE_LABEL = 'Ejercicio que ya no está publicado'

export interface RankingRowLabelInput {
  // 1-based, as the player counts, not the array index.
  position: number
  exerciseId: string
  // `null` when the strip is scoped to a single exercise; otherwise the
  // id → title map of every published exercise, emitted by the strip itself.
  titles: Readonly<Record<string, string>> | null
}

export function rankingRowLabel({ position, exerciseId, titles }: RankingRowLabelInput): string {
  // R1 has no accounts (R3 scope), so every stored attempt is this player's
  // own and "Vos" is accurate rather than a placeholder guess.
  const row = `#${position} · Vos`
  if (titles === null) return row
  return `${row} · ${titles[exerciseId] ?? RETIRED_EXERCISE_LABEL}`
}

// Rendered twice for the same strip, by the server into the static HTML and
// by the client script when the port returns no entry, so the two can never
// drift into different sentences.
export function rankingEmptyLabel(scoped: boolean): string {
  return scoped ? 'Todavía no guardaste ningún intento en este ejercicio.' : 'Todavía no hay intentos guardados.'
}
