// The exercise page can fold its statement away to give the playground the
// whole row, and that preference belongs to the player rather than to the
// exercise: someone who wants a wide canvas wants it on every exercise.
//
// It is deliberately NOT stored inside `forja:attempts:v1`. That key holds the
// player's designs and already grows without a ceiling (a measured ~1.9 KB per
// attempt), so a display preference written into it would be the first thing
// lost when that array is eventually pruned, and pruning is a data decision
// that has nothing to do with a layout toggle.
import { describe, expect, it } from 'vitest'
import {
  STATEMENT_COLLAPSED_ATTRIBUTE,
  STATEMENT_COLLAPSED_STORAGE_KEY,
  collapsedFromRootAttribute,
  readStatementCollapsed,
  writeStatementCollapsed,
} from '../../src/lib/forja/canvas/statement-visibility'
import { STORAGE_KEY as ATTEMPTS_STORAGE_KEY } from '../../src/lib/forja/ranking/local-adapter'

// The two halves of `localStorage` this module touches, as an object a test
// can hand it. Nothing here needs a DOM.
function fakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    read: () => Object.fromEntries(data),
  }
}

const throwingStorage = {
  getItem() {
    throw new DOMException('denied', 'SecurityError')
  },
  setItem() {
    throw new DOMException('quota', 'QuotaExceededError')
  },
}

describe('the statement collapse preference', () => {
  it('has a key of its own, separate from the player attempts', () => {
    expect(STATEMENT_COLLAPSED_STORAGE_KEY).not.toBe(ATTEMPTS_STORAGE_KEY)
    // Not merely different: not a child of it either, so pruning or clearing
    // the attempts entry can never take the preference with it.
    expect(STATEMENT_COLLAPSED_STORAGE_KEY.startsWith(ATTEMPTS_STORAGE_KEY)).toBe(false)
  })

  // The statement is what the exercise is about. A player who has never
  // touched the toggle must arrive at the exercise reading it.
  it('starts expanded when the player has never chosen', () => {
    expect(readStatementCollapsed(fakeStorage())).toBe(false)
  })

  it('remembers a collapsed statement across exercises', () => {
    const storage = fakeStorage()
    writeStatementCollapsed(storage, true)
    expect(readStatementCollapsed(storage)).toBe(true)
  })

  it('remembers reopening it, rather than falling back to the default by deleting the key', () => {
    const storage = fakeStorage()
    writeStatementCollapsed(storage, true)
    writeStatementCollapsed(storage, false)
    expect(storage.read()[STATEMENT_COLLAPSED_STORAGE_KEY]).toBeDefined()
    expect(readStatementCollapsed(storage)).toBe(false)
  })

  it('reads anything it did not write as "expanded", never as a collapsed statement', () => {
    expect(readStatementCollapsed(fakeStorage({ [STATEMENT_COLLAPSED_STORAGE_KEY]: 'true' }))).toBe(false)
    expect(readStatementCollapsed(fakeStorage({ [STATEMENT_COLLAPSED_STORAGE_KEY]: '' }))).toBe(false)
  })

  // Safari's private mode throws on `localStorage` access rather than
  // returning null, and a page whose statement toggle throws during its own
  // first-paint script leaves the rest of that script unrun.
  it('survives a storage that throws instead of answering', () => {
    expect(readStatementCollapsed(throwingStorage)).toBe(false)
    expect(() => writeStatementCollapsed(throwingStorage, true)).not.toThrow()
  })

  it('survives having no storage at all', () => {
    expect(readStatementCollapsed(null)).toBe(false)
    expect(() => writeStatementCollapsed(null, true)).not.toThrow()
  })
})

// The card is out of the layout flow, so folding it does not change the
// canvas's box and the island's ResizeObserver never fires. What DOES change
// is the room the camera may use (briefFitPadding), so the island has to read
// the fold state directly, the same way it already reads the theme: off an
// attribute on <html>, which needs no cooperation from whoever wrote it.
describe('the fold state, as the island reads it', () => {
  it('is the string the page writes, and nothing else', () => {
    expect(collapsedFromRootAttribute('true')).toBe(true)
    expect(collapsedFromRootAttribute('false')).toBe(false)
  })

  // Before the page's own first-paint script runs there is no attribute at
  // all. The statement is what the exercise is about, so its absence has to
  // mean "open", which is the default `readStatementCollapsed` gives.
  it('reads a missing or unrecognised attribute as an open statement', () => {
    expect(collapsedFromRootAttribute(null)).toBe(false)
    expect(collapsedFromRootAttribute('')).toBe(false)
    expect(collapsedFromRootAttribute('1')).toBe(false)
    expect(collapsedFromRootAttribute('TRUE')).toBe(false)
  })

  it('names one attribute, which is the one the page and the stylesheet use', () => {
    expect(STATEMENT_COLLAPSED_ATTRIBUTE).toBe('data-statement-collapsed')
  })
})
