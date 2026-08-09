// The canvas kept a `Set` of selected ids and rebuilt it on every
// `onSelectionChange` React Flow emitted — including the ones that carry the
// SAME selection. A fresh Set is a fresh identity, so the layout effect that
// reprojects nodes fired, produced a new nodes array, React Flow synced it
// into its own store, and emitted selection-change again: an infinite render
// loop that unmounted the whole playground with React error #185.
//
// Reproduced with physical input before this fix: open an exercise, drag any
// node, switch to "Vista de lista", switch back to "Lienzo" — 7 nodes and 3
// tabs became 0 and 0, and only a reload brought the game back.
//
// The cure is to treat a selection-change that changes nothing as nothing.
import { describe, expect, it } from 'vitest'
import { sameSelection } from '../../src/components/forja/canvas/selection-sync'

describe('sameSelection', () => {
  it('is true for two empty selections — the most common no-op', () => {
    expect(sameSelection(new Set(), [])).toBe(true)
  })

  it('is true when the incoming ids match the current set, whatever the order', () => {
    expect(sameSelection(new Set(['a', 'b']), ['b', 'a'])).toBe(true)
  })

  it('is false when something was added', () => {
    expect(sameSelection(new Set(['a']), ['a', 'b'])).toBe(false)
  })

  it('is false when something was removed', () => {
    expect(sameSelection(new Set(['a', 'b']), ['a'])).toBe(false)
  })

  it('is false when the ids were swapped for different ones of the same count', () => {
    expect(sameSelection(new Set(['a', 'b']), ['a', 'c'])).toBe(false)
  })

  it('is false when the selection is cleared', () => {
    expect(sameSelection(new Set(['a']), [])).toBe(false)
  })

  it('is false when a selection appears from nothing', () => {
    expect(sameSelection(new Set(), ['a'])).toBe(false)
  })

  it('ignores duplicate ids in the incoming list rather than counting them', () => {
    // React Flow has no reason to emit duplicates, but treating ["a","a"] as
    // a two-element selection would report a spurious change forever.
    expect(sameSelection(new Set(['a']), ['a', 'a'])).toBe(true)
  })
})
