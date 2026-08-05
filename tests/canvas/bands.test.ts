// Band containment [PC7 design note]. Pure math — no DOM, no React Flow —
// so the clamp itself is Vitest-testable in isolation; the live-drag wiring
// that calls this on every pointer move is proven separately in
// tests/e2e/canvas-polish.spec.ts. See apply-progress for why this replaced
// React Flow's `extent: 'parent'` (parent-relative child coordinates would
// have broken design D1's "position is absolute domain state" invariant).
import { describe, expect, it } from 'vitest'
import { BAND_ORDER, bandForType, clampToBand } from '../../src/lib/forja/canvas/bands'
import { CATALOG } from '../../src/lib/forja/engine/catalog'
import type { ComponentType } from '../../src/lib/forja/engine/types'

describe('bandForType', () => {
  it('maps every catalog type to its catalog layer, in the same order', () => {
    for (const type of Object.keys(CATALOG) as ComponentType[]) {
      expect(bandForType(type)).toBe(CATALOG[type].layer)
    }
  })

  it('orders the three bands business -> application -> infrastructure', () => {
    expect(BAND_ORDER).toEqual(['business', 'application', 'infrastructure'])
  })
})

describe('clampToBand', () => {
  it('leaves a position untouched when it already fits inside its band', () => {
    const clamped = clampToBand({ x: 40, y: 40 }, 'business')
    expect(clamped).toEqual({ x: 40, y: 40 })
  })

  it('clamps a position past the right edge of the first band back inside it', () => {
    const clamped = clampToBand({ x: 5000, y: 40 }, 'business')
    expect(clamped.x).toBeLessThan(5000)
  })

  it('clamps a negative x back to the band start', () => {
    const clamped = clampToBand({ x: -500, y: 40 }, 'application')
    expect(clamped.x).toBeGreaterThanOrEqual(0)
  })

  it('never lets a business-band node reach the infrastructure band', () => {
    const businessMax = clampToBand({ x: 100000, y: 0 }, 'business').x
    const infraMin = clampToBand({ x: 0, y: 0 }, 'infrastructure').x
    expect(businessMax).toBeLessThan(infraMin)
  })
})
