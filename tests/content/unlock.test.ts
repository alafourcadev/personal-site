// PR2/PR1: unlock by exercise role actually present in a level, never by a
// raw completed-count threshold — the exact shortcut doc §14.4 flags at
// forja-app.html:823 (`done >= ceil(total/2)`), which let a player unlock
// the next level on 7 of 14 exercises without ever touching a tradeoff, a
// trap, or the synthesis.
import { describe, expect, it } from 'vitest'
import { isLevelComplete, requiredRoles } from '../../src/lib/forja/progression/unlock'

describe('forja progression — unlock by role, not by count', () => {
  it('requiredRoles: only the roles a level actually ships are required — a beta level without a trap never requires one', () => {
    const betaLevel4Roles = ['calibration', 'core', 'core', 'core', 'core', 'tradeoff', 'tradeoff', 'synthesis'] as const
    expect(requiredRoles(betaLevel4Roles)).toEqual(['calibration', 'core', 'tradeoff', 'synthesis'])
  })

  it('completing only core exercises does not unlock the next level [PR2]', () => {
    const required = requiredRoles(['calibration', 'core', 'core', 'tradeoff', 'synthesis'])
    const result = isLevelComplete(required, new Set(['core']))
    expect(result.complete).toBe(false)
    expect(result.missingRoles).toEqual(['calibration', 'tradeoff', 'synthesis'])
  })

  it('a passing attempt for every required role marks the level complete', () => {
    const required = requiredRoles(['calibration', 'core', 'tradeoff', 'synthesis'])
    const result = isLevelComplete(required, new Set(['calibration', 'core', 'tradeoff', 'synthesis']))
    expect(result.complete).toBe(true)
    expect(result.missingRoles).toEqual([])
  })

  it('one extra passed role beyond what is required does not matter', () => {
    const required = requiredRoles(['calibration', 'core'])
    const result = isLevelComplete(required, new Set(['calibration', 'core', 'synthesis']))
    expect(result.complete).toBe(true)
  })
})
