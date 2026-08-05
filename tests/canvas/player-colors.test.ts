// Six-swatch player colour palette [PC16] — deliberately NOT built from the
// site's semantic brand tokens (accent/accent-blue/accent-amber/accent-red):
// those four categorical colours already carry component-type identity via
// CATALOG_UI, and a player annotation needs more distinct hues than that
// leaves free. Tailwind's own default palette already ships slate/emerald/
// blue/amber/violet/rose, matching the six colours the owner approved in
// the prototype, without adding new CSS custom properties to BaseLayout.
import { describe, expect, it } from 'vitest'
import { PLAYER_COLORS, PLAYER_COLOR_ORDER } from '../../src/lib/forja/canvas/player-colors'
import type { PlayerColor } from '../../src/lib/forja/engine/types'

describe('PLAYER_COLORS', () => {
  it('has exactly six colours, matching the approved prototype palette', () => {
    expect(PLAYER_COLOR_ORDER).toHaveLength(6)
  })

  it('every colour has a Spanish label and a swatch class', () => {
    for (const color of PLAYER_COLOR_ORDER) {
      const entry = PLAYER_COLORS[color]
      expect(entry.label).toBeTruthy()
      expect(entry.swatchClass).toBeTruthy()
    }
  })

  it('every order entry is a real PlayerColor key with no duplicates', () => {
    const keys = Object.keys(PLAYER_COLORS) as PlayerColor[]
    expect(new Set(PLAYER_COLOR_ORDER).size).toBe(PLAYER_COLOR_ORDER.length)
    expect(keys.sort()).toEqual([...PLAYER_COLOR_ORDER].sort())
  })
})
