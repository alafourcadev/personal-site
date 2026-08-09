import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../src/lib/forja/engine/catalog'
import type { ComponentType } from '../../src/lib/forja/engine/types'
import {
  isPlayerNodePropertyValue,
  playerNodePropertyDefinitions,
} from '../../src/lib/forja/playground/node-properties'

describe('player node property contract', () => {
  it('keeps every catalog default inside its declared choices', () => {
    for (const [type, entry] of Object.entries(CATALOG) as [ComponentType, (typeof CATALOG)[ComponentType]][]) {
      for (const [key, choices] of Object.entries(entry.editableProps ?? {})) {
        expect(choices, `${type}.${key} has no choices`).not.toHaveLength(0)
        expect(choices, `${type}.${key} does not contain its default`).toContain(entry.props[key])
      }
    }
  })

  it('gives every exposed value a label and a concrete consequence', () => {
    for (const type of Object.keys(CATALOG) as ComponentType[]) {
      for (const property of playerNodePropertyDefinitions(type)) {
        expect(property.label).not.toBe('')
        expect(property.explanation).not.toBe('')
        for (const option of property.options) {
          expect(option.label, `${type}.${property.key}.${option.value}`).not.toBe('')
          expect(option.consequence, `${type}.${property.key}.${option.value}`).not.toBe('')
          expect(isPlayerNodePropertyValue(type, property.key, option.value)).toBe(true)
        }
      }
    }
  })

  it('does not expose an architecture property on the wrong component', () => {
    expect(isPlayerNodePropertyValue('database', 'dlq', 'sí')).toBe(false)
    expect(isPlayerNodePropertyValue('queue', 'backup', 'diario')).toBe(false)
  })
})
