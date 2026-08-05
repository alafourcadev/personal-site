// Presentation catalog (icon/color/label per component type) — pure data,
// no DOM. Mirrors R1-B's closed-catalog test discipline: every engine
// ComponentType must have a UI entry, or a node silently renders unlabeled.
import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../src/lib/forja/engine/catalog'
import { CATALOG_UI } from '../../src/lib/forja/canvas/catalog-ui'

describe('CATALOG_UI', () => {
  it('has one UI entry for every engine ComponentType, no more no less', () => {
    const engineTypes = Object.keys(CATALOG).sort()
    const uiTypes = Object.keys(CATALOG_UI).sort()
    expect(uiTypes).toEqual(engineTypes)
  })

  it('gives every entry a non-empty Spanish label and a color category', () => {
    for (const [type, entry] of Object.entries(CATALOG_UI)) {
      expect(entry.label.length, `${type} label`).toBeGreaterThan(0)
      expect(['neutral', 'blue', 'brand', 'amber']).toContain(entry.color)
    }
  })

  it('assigns database and cache different icons despite sharing the amber color', () => {
    expect(CATALOG_UI.database.icon).not.toBe(CATALOG_UI.cache.icon)
    expect(CATALOG_UI.database.color).toBe(CATALOG_UI.cache.color)
  })
})
