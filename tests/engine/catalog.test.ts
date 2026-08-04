import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../src/lib/forja/engine/catalog'

// The closed catalog from doc 13 §13.5, gap-closed per design D4:
// added business-process, external-provider, stream, cdn, vector-store;
// renamed identity -> identity-provider.
const EXPECTED_TYPES = [
  'actor',
  'business-process',
  'approver',
  'external-party',
  'service',
  'api-gateway',
  'mobile-client',
  'web-client',
  'worker',
  'ai-model',
  'external-provider',
  'database',
  'cache',
  'queue',
  'stream',
  'object-storage',
  'cdn',
  'identity-provider',
  'vector-store',
  'observability',
  'generic',
].sort()

describe('forja engine — catalog', () => {
  it('exposes exactly the §13.5 closed list of 21 component types', () => {
    expect(Object.keys(CATALOG).sort()).toEqual(EXPECTED_TYPES)
  })

  it('assigns every non-generic type at least one rule-triggering property', () => {
    for (const [type, entry] of Object.entries(CATALOG)) {
      if (type === 'generic') continue
      expect(Object.keys(entry.props).length, `${type} has no properties`).toBeGreaterThan(0)
    }
  })

  it('places every type in exactly one of the three bands', () => {
    const layers = new Set(Object.values(CATALOG).map((e) => e.layer))
    expect(layers).toEqual(new Set(['business', 'application', 'infrastructure']))
  })
})
