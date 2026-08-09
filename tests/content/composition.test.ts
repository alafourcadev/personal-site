// The beta composition rule, as a pure function over one level's catalog.
// It used to live spelled out by hand inside level-4-composition.test.ts,
// which made two assumptions that only held while level 4 was the only
// level shipping content: that the whole project contains exactly one
// tradeoff pair, and that "the level" is 4. Both break on the first
// level-5 exercise. Extracting the rule here lets every level be checked
// by the same math, and lets an authoring tool report what a level still
// needs before its files are complete.
import { describe, expect, it } from 'vitest'
import {
  BETA_ROLE_QUOTA,
  COMPLETE_ROLE_QUOTA,
  GREENFIELD_ROLE_QUOTA,
  betaCompositionViolations,
  completeQuotaForLevel,
  compositionViolations,
  type CompositionEntry,
} from '../../src/lib/forja/progression/composition'

function entry(overrides: Partial<CompositionEntry> = {}): CompositionEntry {
  return { role: 'core', domain: 'pagos', status: 'PILOT', ...overrides }
}

// The smallest catalog that satisfies every beta rule: 1 calibration,
// 4 core across two domains, one contrasted tradeoff pair, 1 synthesis.
function validLevel(): CompositionEntry[] {
  return [
    entry({ role: 'calibration' }),
    entry({ role: 'core', domain: 'pagos' }),
    entry({ role: 'core', domain: 'pagos' }),
    entry({ role: 'core', domain: 'reservas' }),
    entry({ role: 'core', domain: 'reservas' }),
    entry({ role: 'tradeoff', tradeoffPairId: 'stock' }),
    entry({ role: 'tradeoff', tradeoffPairId: 'stock' }),
    entry({ role: 'synthesis' }),
  ]
}

describe('BETA_ROLE_QUOTA', () => {
  it('sums to the beta floor of 8 playable exercises', () => {
    const total = Object.values(BETA_ROLE_QUOTA).reduce((a, b) => a + b, 0)
    expect(total).toBe(8)
  })
})

describe('betaCompositionViolations — a complete level', () => {
  it('reports nothing for a catalog that meets every rule', () => {
    expect(betaCompositionViolations(validLevel())).toEqual([])
  })

  it('ignores non-playable entries entirely — a DRAFT never counts', () => {
    const withDraft = [...validLevel(), entry({ role: 'core', status: 'DRAFT' })]
    expect(betaCompositionViolations(withDraft)).toEqual([])
  })
})

describe('betaCompositionViolations — role quotas', () => {
  it('reports a shortfall when a role is missing', () => {
    const missingSynthesis = validLevel().filter((e) => e.role !== 'synthesis')
    const codes = betaCompositionViolations(missingSynthesis).map((v) => v.code)
    expect(codes).toContain('role-quota')
  })

  it('names the role and both counts so an author knows what to write', () => {
    const missingSynthesis = validLevel().filter((e) => e.role !== 'synthesis')
    const violation = betaCompositionViolations(missingSynthesis).find((v) => v.code === 'role-quota')
    expect(violation?.message).toContain('synthesis')
    expect(violation?.message).toContain('1')
    expect(violation?.message).toContain('0')
  })

  it('reports a surplus too — five core exercises is not a beta level', () => {
    const extraCore = [...validLevel(), entry({ role: 'core', domain: 'envios' })]
    const codes = betaCompositionViolations(extraCore).map((v) => v.code)
    expect(codes).toContain('role-quota')
  })

  it('rejects trap and counter-trap — they only enter at the 14-exercise tier [C2]', () => {
    const withTrap = [...validLevel(), entry({ role: 'trap' })]
    const codes = betaCompositionViolations(withTrap).map((v) => v.code)
    expect(codes).toContain('role-quota')
  })
})

describe('betaCompositionViolations — the transfer requirement', () => {
  it('reports core exercises confined to a single business domain', () => {
    const oneDomain = validLevel().map((e) => (e.role === 'core' ? { ...e, domain: 'pagos' } : e))
    const codes = betaCompositionViolations(oneDomain).map((v) => v.code)
    expect(codes).toContain('core-domain-span')
  })
})

describe('betaCompositionViolations — the contrasted tradeoff pair', () => {
  it('reports two tradeoffs that do not share a pair id', () => {
    const unpaired = validLevel().map((e, i) =>
      e.role === 'tradeoff' ? { ...e, tradeoffPairId: `pair-${i}` } : e,
    )
    const codes = betaCompositionViolations(unpaired).map((v) => v.code)
    expect(codes).toContain('tradeoff-pair')
  })

  it('reports a tradeoff with no pair id at all', () => {
    const noPairId = validLevel().map((e) =>
      e.role === 'tradeoff' ? { ...e, tradeoffPairId: undefined } : e,
    )
    const codes = betaCompositionViolations(noPairId).map((v) => v.code)
    expect(codes).toContain('tradeoff-pair')
  })

  it('scopes the pair to the level — two levels may each ship their own pair', () => {
    // The rule this replaces asserted exactly one pair across the WHOLE
    // project. Passing one level's catalog can never see another's, which
    // is precisely the fix: this call is per level by construction.
    expect(betaCompositionViolations(validLevel())).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The "complete" tier — doc §14.4's own table, 14 exercises:
// 1 calibration · 6 core · 4 tradeoff (two contrasted pairs) · 1 trap +
// 1 counter-trap · 1 synthesis. Beta (8) stays publishable; a level is valid
// at either tier and invalid in between, which is what makes a half-migrated
// level fail loudly instead of silently shipping five core exercises.
function completeLevel(): CompositionEntry[] {
  return [
    entry({ role: 'calibration' }),
    entry({ role: 'core', domain: 'pagos' }),
    entry({ role: 'core', domain: 'pagos' }),
    entry({ role: 'core', domain: 'reservas' }),
    entry({ role: 'core', domain: 'reservas' }),
    entry({ role: 'core', domain: 'envios' }),
    entry({ role: 'core', domain: 'envios' }),
    entry({ role: 'tradeoff', tradeoffPairId: 'stock' }),
    entry({ role: 'tradeoff', tradeoffPairId: 'stock' }),
    entry({ role: 'tradeoff', tradeoffPairId: 'cobro' }),
    entry({ role: 'tradeoff', tradeoffPairId: 'cobro' }),
    entry({ role: 'trap' }),
    entry({ role: 'counter-trap' }),
    entry({ role: 'synthesis' }),
  ]
}

describe('COMPLETE_ROLE_QUOTA', () => {
  it('sums to 14, the doc’s own complete tier', () => {
    expect(Object.values(COMPLETE_ROLE_QUOTA).reduce((a, b) => a + b, 0)).toBe(14)
  })

  it('ships the anti-metagame pair: exactly one trap and one counter-trap', () => {
    expect(COMPLETE_ROLE_QUOTA.trap).toBe(1)
    expect(COMPLETE_ROLE_QUOTA['counter-trap']).toBe(1)
  })

  it('doubles core to six and tradeoff to four', () => {
    expect(COMPLETE_ROLE_QUOTA.core).toBe(6)
    expect(COMPLETE_ROLE_QUOTA.tradeoff).toBe(4)
  })
})

describe('compositionViolations — accepts either tier', () => {
  it('reports nothing for a beta level', () => {
    expect(compositionViolations(validLevel())).toEqual([])
  })

  it('reports nothing for a complete level', () => {
    expect(compositionViolations(completeLevel())).toEqual([])
  })

  it('accepts two contrasted tradeoff pairs at the complete tier', () => {
    const violations = compositionViolations(completeLevel()).filter((v) => v.code === 'tradeoff-pair')
    expect(violations).toEqual([])
  })

  it('rejects four tradeoffs that form three pairs instead of two', () => {
    const lopsided = completeLevel().map((e, i) =>
      e.role === 'tradeoff' && i === 10 ? { ...e, tradeoffPairId: 'tercero' } : e,
    )
    expect(compositionViolations(lopsided).map((v) => v.code)).toContain('tradeoff-pair')
  })

  it('rejects a level stranded between the two tiers', () => {
    const fiveCore = [...validLevel(), entry({ role: 'core', domain: 'envios' })]
    expect(compositionViolations(fiveCore).length).toBeGreaterThan(0)
  })

  it('reports against the nearer tier so the message is actionable', () => {
    // Thirteen of fourteen: one core short. The complaint must be about the
    // missing core, never about the beta tier's "you have too many of
    // everything", which would send an author backwards.
    const almost = completeLevel().filter((e, i) => !(e.role === 'core' && i === 6))
    const messages = compositionViolations(almost).map((v) => v.message).join(' ')
    expect(messages).toContain('core')
    expect(messages).toContain('6')
  })

  it('rejects a trap with no counter-trap — that teaches the wrong metagame', () => {
    const noCounter = completeLevel().filter((e) => e.role !== 'counter-trap')
    expect(compositionViolations(noCounter).map((v) => v.code)).toContain('role-quota')
  })

  it('still demands the transfer requirement across six core exercises', () => {
    const oneDomain = completeLevel().map((e) => (e.role === 'core' ? { ...e, domain: 'pagos' } : e))
    expect(compositionViolations(oneDomain).map((v) => v.code)).toContain('core-domain-span')
  })
})

describe('betaCompositionViolations stays available for the beta-only checks', () => {
  it('still rejects trap at the beta tier', () => {
    expect(betaCompositionViolations([...validLevel(), entry({ role: 'trap' })]).map((v) => v.code)).toContain(
      'role-quota',
    )
  })
})

// PRODUCT.md, Capabilities and Constraints: "levels 1 to 4 trade one core slot
// for a `greenfield` exercise that starts on an empty canvas". The trade is the
// whole rule: the level still ships fourteen, and the sixth core is the one
// that pays for it.
//
// Why only the first four levels is a pedagogical decision, not a technical
// one: building from zero with three pieces and a small budget is a good level-1
// exercise, and building from zero at level 12 with seven pieces and four
// guarantees is punishment. Repairing a system that already exists is also what
// a senior architect actually does.
function greenfieldLevel(): CompositionEntry[] {
  return completeLevel()
    .filter((e, i) => !(e.role === 'core' && i === 6))
    .concat(entry({ role: 'greenfield', domain: 'industria' }))
}

describe('GREENFIELD_ROLE_QUOTA — the tier levels 1 to 4 ship', () => {
  it('sums to 14, exactly like the tier it replaces: the corpus does not grow', () => {
    expect(Object.values(GREENFIELD_ROLE_QUOTA).reduce((a, b) => a + b, 0)).toBe(14)
  })

  it('takes the slot from core, not from anywhere else', () => {
    expect(GREENFIELD_ROLE_QUOTA.core).toBe(5)
    expect(GREENFIELD_ROLE_QUOTA.greenfield).toBe(1)
  })
})

describe('completeQuotaForLevel — where the empty canvas is allowed', () => {
  it.each([1, 2, 3, 4])('level %i trades a core slot for the empty canvas', (level) => {
    expect(completeQuotaForLevel(level)).toBe(GREENFIELD_ROLE_QUOTA)
  })

  it.each([5, 6, 7, 8, 9, 10, 11, 12])('level %i keeps its six core exercises', (level) => {
    expect(completeQuotaForLevel(level)).toBe(COMPLETE_ROLE_QUOTA)
  })
})

describe('compositionViolations — the greenfield tier', () => {
  it('reports nothing for a level-1 catalog that trades a core for the empty canvas', () => {
    expect(compositionViolations(greenfieldLevel(), 1)).toEqual([])
  })

  it('rejects six core exercises at a level that owes an empty-canvas one', () => {
    const messages = compositionViolations(completeLevel(), 1).map((v) => v.message).join(' ')
    expect(messages).toContain('greenfield')
  })

  it('rejects an empty-canvas exercise above level 4', () => {
    expect(compositionViolations(greenfieldLevel(), 5).map((v) => v.code)).toContain('role-quota')
  })
})
