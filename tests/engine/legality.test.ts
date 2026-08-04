import { describe, expect, it } from 'vitest'
import { isPortCompatible, isTrustZoneJump, zoneDistance } from '../../src/lib/forja/engine/legality'

describe('forja engine — legality', () => {
  it('flags a jump of more than one zone as a trust-zone jump', () => {
    expect(zoneDistance('public', 'restricted')).toBe(3)
    expect(isTrustZoneJump('public', 'restricted')).toBe(true)
  })

  it('does not flag an adjacent zone move', () => {
    expect(zoneDistance('public', 'dmz')).toBe(1)
    expect(isTrustZoneJump('public', 'dmz')).toBe(false)
  })

  it('rejects a mobile client wired straight into a database (no sql-out port)', () => {
    expect(isPortCompatible('mobile-client', 'database')).toBe(false)
  })

  it('accepts a service writing to a database (declared in ACCEPTS)', () => {
    expect(isPortCompatible('service', 'database')).toBe(true)
  })

  it('accepts anything into the generic escape-hatch type', () => {
    expect(isPortCompatible('actor', 'generic')).toBe(true)
  })
})
