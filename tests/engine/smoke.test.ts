import { describe, expect, it } from 'vitest'
import { ENGINE_VERSION } from '../../src/lib/forja/engine/index'

describe('forja engine — smoke', () => {
  it('exports a non-empty ENGINE_VERSION', () => {
    expect(ENGINE_VERSION).toBeTypeOf('string')
    expect(ENGINE_VERSION.length).toBeGreaterThan(0)
  })
})
