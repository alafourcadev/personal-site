// The workbench now has two rails that fold, and each one remembers its own
// answer. This is the storage contract both of them share.
//
// It exists as one module because the defensive part is the part that matters
// and it is easy to get subtly different twice: Safari's private mode THROWS on
// storage access rather than returning null, an exception in the page's own
// first-paint script would leave the rest of that script unrun, and a full
// quota must cost a player their preference and never their exercise. Two
// copies of that reasoning is one copy that drifts.
//
// The rule both rails obey: anything this module did not write reads as OPEN.
// A rail whose preference cannot be read must never be the reason a player
// arrives at an exercise without the statement, or without their tools.
import { describe, expect, it } from 'vitest'
import {
  RAILS,
  RAIL_STORAGE_KEYS,
  readRailCollapsed,
  writeRailCollapsed,
} from '../../src/lib/forja/canvas/rail-visibility'
import { STATEMENT_COLLAPSED_STORAGE_KEY } from '../../src/lib/forja/canvas/statement-visibility'
import { STORAGE_KEY as ATTEMPTS_STORAGE_KEY } from '../../src/lib/forja/ranking/local-adapter'

function fakeStorage(seed: Record<string, string> = {}) {
  const data = { ...seed }
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
    read: () => data,
  }
}

const throwingStorage = {
  getItem: () => {
    throw new Error('SecurityError: the operation is insecure')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('the two rails, which are remembered apart', () => {
  it('names both rails the workbench actually has', () => {
    expect([...RAILS].sort()).toEqual(['statement', 'tools'])
  })

  // The owner asked for this in as many words: each rail's preference is its
  // own. Someone who wants the problem in front of them and their tools out of
  // the way is stating two different things.
  it('gives each rail a key of its own, so one answer never sets the other', () => {
    const storage = fakeStorage()
    writeRailCollapsed(storage, 'tools', true)

    expect(readRailCollapsed(storage, 'tools')).toBe(true)
    expect(readRailCollapsed(storage, 'statement'), 'folding the tools said nothing about the statement').toBe(false)
  })

  it('keeps the statement rail on the key it already shipped, so nobody loses a stored choice', () => {
    expect(RAIL_STORAGE_KEYS.statement).toBe(STATEMENT_COLLAPSED_STORAGE_KEY)
  })

  // Same argument statement-visibility.ts already makes for its own key: the
  // attempts entry holds designs and grows without a ceiling, so a display
  // preference written into it would be the first casualty of any pruning, and
  // pruning designs has nothing to do with a rail.
  it('keeps both rails out of the entry that stores the player’s designs', () => {
    for (const rail of RAILS) {
      expect(RAIL_STORAGE_KEYS[rail], rail).not.toBe(ATTEMPTS_STORAGE_KEY)
      expect(RAIL_STORAGE_KEYS[rail].startsWith(`${ATTEMPTS_STORAGE_KEY}:`), rail).toBe(false)
    }
  })
})

describe('what a rail reads back', () => {
  it('starts open when the player has never chosen', () => {
    for (const rail of RAILS) {
      expect(readRailCollapsed(fakeStorage(), rail), rail).toBe(false)
    }
  })

  it('remembers a folded rail', () => {
    const storage = fakeStorage()
    for (const rail of RAILS) {
      writeRailCollapsed(storage, rail, true)
      expect(readRailCollapsed(storage, rail), rail).toBe(true)
    }
  })

  // Reopening writes rather than deletes. "I want this rail" and "I have never
  // chosen" produce the same layout today, but only one of them is a decision,
  // and a later change of default must not silently reverse it.
  it('remembers reopening too, rather than falling back to the default by deleting the key', () => {
    const storage = fakeStorage()
    writeRailCollapsed(storage, 'tools', true)
    writeRailCollapsed(storage, 'tools', false)

    expect(readRailCollapsed(storage, 'tools')).toBe(false)
    expect(Object.keys(storage.read()), 'the key is still there, carrying the choice').toContain(
      RAIL_STORAGE_KEYS.tools,
    )
  })

  it('reads anything it did not write as an open rail, never as a folded one', () => {
    for (const value of ['', 'true', '0', 'yes', 'null']) {
      const storage = fakeStorage({ [RAIL_STORAGE_KEYS.tools]: value })
      expect(readRailCollapsed(storage, 'tools'), value).toBe(false)
    }
  })
})

describe('storage that does not cooperate', () => {
  it('survives a storage that throws instead of answering', () => {
    for (const rail of RAILS) {
      expect(() => readRailCollapsed(throwingStorage, rail), rail).not.toThrow()
      expect(readRailCollapsed(throwingStorage, rail), rail).toBe(false)
      expect(() => writeRailCollapsed(throwingStorage, rail, true), rail).not.toThrow()
    }
  })

  it('survives having no storage at all', () => {
    for (const rail of RAILS) {
      expect(readRailCollapsed(null, rail), rail).toBe(false)
      expect(() => writeRailCollapsed(undefined, rail, true), rail).not.toThrow()
    }
  })
})
