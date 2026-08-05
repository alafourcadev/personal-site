// "Every component explains itself" — completeness + the DRY guarantee
// that the shown opsUnits number can never drift from CATALOG's own value
// (the description text is generated, not hand-typed per type).
import { describe, expect, it } from 'vitest'
import { describeComponent } from '../../src/lib/forja/canvas/catalog-descriptions'
import { CATALOG } from '../../src/lib/forja/engine/catalog'
import type { ComponentType } from '../../src/lib/forja/engine/types'

describe('describeComponent()', () => {
  it('returns a non-empty explanation for every catalog type', () => {
    for (const type of Object.keys(CATALOG) as ComponentType[]) {
      expect(describeComponent(type).length).toBeGreaterThan(20)
    }
  })

  it('always states the real opsUnits cost from CATALOG, never a stale hand-typed number', () => {
    expect(describeComponent('database')).toContain(`Costo operativo: ${CATALOG.database.opsUnits} unidad`)
    expect(describeComponent('actor')).toContain('0 unidades')
  })

  it('singular vs. plural unit wording matches the actual count', () => {
    const oneUnitType = (Object.keys(CATALOG) as ComponentType[]).find((t) => CATALOG[t].opsUnits === 1)!
    expect(describeComponent(oneUnitType)).toContain('1 unidad operativa')
    expect(describeComponent(oneUnitType)).not.toContain('1 unidades')
  })
})
