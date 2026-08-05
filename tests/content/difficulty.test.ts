// Doc §14.4's nine-axis difficulty index — pure, level-generic math shared
// by every level's admission gates (EC2, EC3), not just level 4's.
import { describe, expect, it } from 'vitest'
import { axisCeiling, difficultyIndex, levelBand } from '../../src/lib/forja/progression/difficulty'

describe('forja progression — difficulty index (§14.4)', () => {
  it('índice = Σ(D1..D9)', () => {
    expect(difficultyIndex({ D1: 1, D2: 0, D3: 2, D4: 0, D5: 2, D6: 0, D7: 1, D8: 0, D9: 2 })).toBe(8)
  })

  it('levelBand: [2+2(N-1), 10+2(N-1)] — level 4 is [8, 16]', () => {
    expect(levelBand(4)).toEqual([8, 16])
    expect(levelBand(1)).toEqual([2, 10])
    expect(levelBand(12)).toEqual([24, 32])
  })

  // §14.4's own table: "vale 3 desde nivel X" / "vale 4 desde nivel Y" per
  // axis. D3 (Garantías en juego) is the earliest to reach 3 — level 3.
  it('axisCeiling: an axis stays at 2 below its own "vale 3 desde" level', () => {
    expect(axisCeiling('D3', 2)).toBe(2)
    expect(axisCeiling('D3', 3)).toBe(3)
    expect(axisCeiling('D3', 7)).toBe(3)
    expect(axisCeiling('D3', 8)).toBe(4)
  })

  it('axisCeiling: D1 requires level 5 for 3, level 8 for 4 — level 4 ceiling is 2', () => {
    expect(axisCeiling('D1', 4)).toBe(2)
    expect(axisCeiling('D1', 5)).toBe(3)
    expect(axisCeiling('D1', 8)).toBe(4)
  })

  it('axisCeiling: every axis at level 4 matches the doc table exactly', () => {
    expect(axisCeiling('D1', 4)).toBe(2)
    expect(axisCeiling('D2', 4)).toBe(2)
    expect(axisCeiling('D3', 4)).toBe(3)
    expect(axisCeiling('D4', 4)).toBe(2)
    expect(axisCeiling('D5', 4)).toBe(2)
    expect(axisCeiling('D6', 4)).toBe(2)
    expect(axisCeiling('D7', 4)).toBe(3)
    expect(axisCeiling('D8', 4)).toBe(2)
    expect(axisCeiling('D9', 4)).toBe(2)
  })
})
