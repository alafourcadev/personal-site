// Fix A: the level page rendered `getCollection`'s own order, which is the
// filesystem's alphabetical order of the slug — putting the counter-trap 8th
// and the trap it answers 14th, while the counter-trap's body says "el mismo
// hotel del ejercicio anterior". `orderExercises` already owns the canonical
// sequence; this is the adapter that lets a page feed it whole content
// entries (whose difficulty lives as nine flat D1..D9 frontmatter fields)
// and get the same entries back, ordered.
import { describe, expect, it } from 'vitest'
import { orderLevelEntries, type LevelListingEntry } from '../../src/lib/forja/progression/level-listing'
import type { ExerciseRole } from '../../src/lib/forja/progression/types'

function entry(id: string, role: ExerciseRole, load = 1, tradeoffPairId?: string): LevelListingEntry & { data: { title: string } } {
  return {
    id,
    data: {
      title: id,
      role,
      tradeoffPairId,
      // Nine axes, flat, exactly as the frontmatter declares them.
      D1: load, D2: load, D3: load, D4: load, D5: load, D6: load, D7: load, D8: load, D9: 1,
    },
  }
}

describe('orderLevelEntries', () => {
  it('puts the trap before the counter-trap that answers it, whatever order the collection arrived in', () => {
    const alphabetical = [
      entry('counter-trap-la-autorizacion', 'counter-trap'),
      entry('core-el-pago', 'core'),
      entry('synthesis-el-tramite', 'synthesis'),
      entry('trap-el-pasaporte', 'trap'),
      entry('calibration-el-comprobante', 'calibration'),
    ]
    expect(orderLevelEntries(alphabetical).map((e) => e.id)).toEqual([
      'calibration-el-comprobante',
      'core-el-pago',
      'trap-el-pasaporte',
      'counter-trap-la-autorizacion',
      'synthesis-el-tramite',
    ])
  })

  it('returns the whole entry, not a stripped projection — the page still needs title and domain', () => {
    const [first] = orderLevelEntries([entry('cal', 'calibration')])
    expect(first.data.title).toBe('cal')
  })

  it('orders one role by the nine-axis difficulty index, easiest first', () => {
    const cores = [entry('duro', 'core', 3), entry('facil', 'core', 1), entry('medio', 'core', 2)]
    expect(orderLevelEntries(cores).map((e) => e.id)).toEqual(['facil', 'medio', 'duro'])
  })

  it('keeps both halves of a contrasted pair adjacent', () => {
    const tradeoffs = [
      entry('a1', 'tradeoff', 1, 'A'),
      entry('b1', 'tradeoff', 2, 'B'),
      entry('a2', 'tradeoff', 3, 'A'),
      entry('b2', 'tradeoff', 4, 'B'),
    ]
    expect(orderLevelEntries(tradeoffs).map((e) => e.id)).toEqual(['a1', 'a2', 'b1', 'b2'])
  })

  it('never drops or duplicates an entry', () => {
    const input = [entry('a', 'core'), entry('b', 'trap'), entry('c', 'synthesis')]
    const out = orderLevelEntries(input)
    expect(out).toHaveLength(3)
    expect(new Set(out.map((e) => e.id))).toEqual(new Set(['a', 'b', 'c']))
  })

  it('handles an empty level without throwing', () => {
    expect(orderLevelEntries([])).toEqual([])
  })
})
