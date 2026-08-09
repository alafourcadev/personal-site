// Finishing an exercise used to be a dead end: the only link inside <main>
// was "← Nivel N", so continuing cost two clicks and a guess about which of
// the level's 14 exercises came next. The play order already exists and is
// already tested (progression/order.ts); this is the thin adapter that turns
// it into the one thing the result panel needs — a link, or an honest "this
// was the last one".
import { describe, expect, it } from 'vitest'
import { nextStepFor } from '../../src/components/forja/canvas/next-step'
import { LEVELS } from '../../src/lib/forja/progression/levels'

const level = 1
const lastLevel = LEVELS[LEVELS.length - 1].id

// Same shape the exercise route hands it: id, role, difficultyIndex, title.
const exercises = [
  { id: 'b-core', role: 'core' as const, difficultyIndex: 4, title: 'Núcleo B' },
  { id: 'a-calibration', role: 'calibration' as const, difficultyIndex: 3, title: 'Calibración A' },
  { id: 'c-synthesis', role: 'synthesis' as const, difficultyIndex: 9, title: 'Síntesis C' },
]

describe('nextStepFor', () => {
  it('offers the next exercise in the level\'s own play order, not the filesystem\'s', () => {
    expect(nextStepFor(exercises, 'a-calibration', level)).toEqual({
      kind: 'next',
      href: '/forja/1/b-core',
      title: 'Núcleo B',
    })
  })

  it('says so instead of linking when the exercise is the last of the level', () => {
    expect(nextStepFor(exercises, 'c-synthesis', level)).toEqual({ kind: 'last-of-level' })
  })

  it('treats an unknown id as the end rather than inventing a destination', () => {
    expect(nextStepFor(exercises, 'not-in-this-level', level)).toEqual({ kind: 'last-of-level' })
  })

  // The last exercise of the last level is the last exercise of the game —
  // its own brief says so ("Último ejercicio del juego"). It was closing with
  // the same generic "era el último ejercicio de este nivel" as level 4's,
  // which is the one line in the product a player reads exactly once.
  it('knows the end of the last level is the end of the game', () => {
    expect(nextStepFor(exercises, 'c-synthesis', lastLevel)).toEqual({ kind: 'game-complete' })
    expect(nextStepFor(exercises, 'not-in-this-level', lastLevel)).toEqual({ kind: 'game-complete' })
  })

  // Reaching the ceiling in the middle of the last level is not finishing it.
  it('still offers the next exercise inside the last level', () => {
    expect(nextStepFor(exercises, 'a-calibration', lastLevel)).toEqual({
      kind: 'next',
      href: `/forja/${lastLevel}/b-core`,
      title: 'Núcleo B',
    })
  })

  // The last level is read from the level map, so adding a level 13 moves the
  // ending with it instead of leaving it stranded on 12.
  it('takes the last level from the level map rather than a literal', () => {
    expect(nextStepFor(exercises, 'c-synthesis', lastLevel - 1)).toEqual({ kind: 'last-of-level' })
  })
})
