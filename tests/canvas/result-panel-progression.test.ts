import { describe, expect, it } from 'vitest'
import { shouldOfferNextStep } from '../../src/components/forja/canvas/ResultPanel'
import type { CanvasResult } from '../../src/lib/forja/playground/result'

const scored = (score: number | null, status: 'illegal' | 'scored' = 'scored'): CanvasResult => ({
  kind: 'scored',
  status,
  score,
  ceiling: 100,
  axes: [],
  cost: { opsUnits: 0, monthlyUsd: 0, budget: { opsUnits: 4 }, overage: 0 },
  findings: [],
})

describe('ResultPanel progression gate', () => {
  it('does not offer the next exercise for an illegal or partial result', () => {
    const next = { kind: 'next', href: '/forja/1/siguiente', title: 'Siguiente' } as const

    expect(shouldOfferNextStep(scored(null, 'illegal'), next)).toBe(false)
    expect(shouldOfferNextStep(scored(50), next)).toBe(false)
  })

  it('offers the next exercise after reaching the ceiling', () => {
    expect(
      shouldOfferNextStep(scored(100), { kind: 'next', href: '/forja/1/siguiente', title: 'Siguiente' }),
    ).toBe(true)
  })

  it('never declares the game complete from route position alone', () => {
    expect(shouldOfferNextStep(scored(100), { kind: 'game-complete' })).toBe(false)
    expect(shouldOfferNextStep(scored(100), { kind: 'game-complete' }, true)).toBe(true)
  })
})
