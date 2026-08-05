// PR1/PR5: the 12-level map (§14.4), each carrying the prerequisite level
// that enables it, and the missing-prerequisite message a locked level
// states.
import { describe, expect, it } from 'vitest'
import { LEVELS, levelById, lockedReason } from '../../src/lib/forja/progression/levels'

describe('forja progression — the twelve-level map (§14.4)', () => {
  it('exposes exactly 12 levels, 1 through 12, in order', () => {
    expect(LEVELS).toHaveLength(12)
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('level 4 is "Comunicación entre servicios", prerequisite level 3', () => {
    const level4 = levelById(4)
    expect(level4?.name).toBe('Comunicación entre servicios')
    expect(level4?.prerequisiteLevel).toBe(3)
  })

  it('level 1 has no prerequisite — it is the entry vocabulary level', () => {
    expect(levelById(1)?.prerequisiteLevel).toBeNull()
  })

  it('a locked level states which prerequisite is missing [PR1]', () => {
    const level4 = levelById(4)!
    expect(lockedReason(level4, new Set())).toMatch(/nivel 3/i)
    expect(lockedReason(level4, new Set([3]))).toBeNull()
  })
})
