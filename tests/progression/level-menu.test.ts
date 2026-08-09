// The menu the shell's top bar opens: where the player is inside the level,
// the fourteen exercises in play order, and the two steps beside this one.
//
// Why it exists. The committee measured that finishing a level is a dead end:
// `next-step.ts`'s `last-of-level` is a variant with no payload, so the panel
// can only print "Era el último ejercicio de este nivel" with no link, no next
// level and no way back to the map. That case happens eleven times; the one
// that has a link happens once. The menu is the cheapest way out of it, and it
// also answers the question the player has at every other moment: which of
// these fourteen have I already solved, and what came before this one.
//
// Pure and DOM-free: whether an exercise is solved lives in localStorage and
// is decided in the browser, but the ORDER, the positions and the two
// neighbours are build-time facts and belong here, where they can be proved.
import { describe, expect, it } from 'vitest'
import { levelMenuFor } from '../../src/lib/forja/progression/level-menu'
import type { OrderableTitledExercise } from '../../src/components/forja/canvas/next-step'

// Deliberately handed in the filesystem's alphabetical order, which is what
// `getCollection` returns and what put a counter-trap six positions ahead of
// the trap it answers. The menu must not inherit it.
const LEVEL: OrderableTitledExercise[] = [
  { id: 'b-core-easy', title: 'El comprobante', role: 'core', difficultyIndex: 8 },
  { id: 'a-synthesis', title: 'El checkout', role: 'synthesis', difficultyIndex: 20 },
  { id: 'c-calibration', title: 'El cliente', role: 'calibration', difficultyIndex: 4 },
  { id: 'd-core-hard', title: 'El pago', role: 'core', difficultyIndex: 12 },
]

describe('levelMenuFor', () => {
  it('lists the level in play order, never the order it was handed', () => {
    const menu = levelMenuFor(LEVEL, 'b-core-easy', 1)
    expect(menu.entries.map((e) => e.id)).toEqual(['c-calibration', 'b-core-easy', 'd-core-hard', 'a-synthesis'])
  })

  it('numbers every entry from one and links it inside its own level', () => {
    const menu = levelMenuFor(LEVEL, 'b-core-easy', 7)
    expect(menu.entries[0]).toEqual({
      id: 'c-calibration',
      title: 'El cliente',
      href: '/forja/7/c-calibration',
      position: 1,
      current: false,
    })
    expect(menu.entries.map((e) => e.position)).toEqual([1, 2, 3, 4])
  })

  it('marks exactly one entry as the one being played', () => {
    const menu = levelMenuFor(LEVEL, 'd-core-hard', 1)
    expect(menu.entries.filter((e) => e.current).map((e) => e.id)).toEqual(['d-core-hard'])
    expect(menu.position).toBe(3)
    expect(menu.total).toBe(4)
  })

  it('offers the two neighbours in play order', () => {
    const menu = levelMenuFor(LEVEL, 'b-core-easy', 1)
    expect(menu.previous).toEqual({ href: '/forja/1/c-calibration', title: 'El cliente' })
    expect(menu.next).toEqual({ href: '/forja/1/d-core-hard', title: 'El pago' })
  })

  // The two ends are where a dead end actually happens, so they are stated
  // rather than left to a `?.`: the first exercise has no previous, and the
  // last has no next inside this level.
  it('has no previous on the first exercise and no next on the last', () => {
    expect(levelMenuFor(LEVEL, 'c-calibration', 1).previous).toBeNull()
    expect(levelMenuFor(LEVEL, 'a-synthesis', 1).next).toBeNull()
  })

  // An id that is not in this level's set is a bug upstream, not a reason to
  // link somewhere arbitrary: the list still renders, nothing is marked
  // current, and neither neighbour is invented.
  it('renders the level without marking or inventing anything for an unknown id', () => {
    const menu = levelMenuFor(LEVEL, 'not-here', 1)
    expect(menu.entries).toHaveLength(4)
    expect(menu.entries.some((e) => e.current)).toBe(false)
    expect(menu.position).toBeNull()
    expect(menu.previous).toBeNull()
    expect(menu.next).toBeNull()
  })

  it('survives a level with a single exercise', () => {
    const menu = levelMenuFor([LEVEL[0]], 'b-core-easy', 3)
    expect(menu.total).toBe(1)
    expect(menu.position).toBe(1)
    expect(menu.previous).toBeNull()
    expect(menu.next).toBeNull()
  })
})
