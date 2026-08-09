// Six-swatch player colour palette [PC16] — deliberately NOT built from the
// site's semantic brand tokens (accent/accent-blue/accent-amber/accent-red):
// those four categorical colours already carry component-type identity via
// CATALOG_UI, and a player annotation needs more distinct hues than that
// leaves free. Tailwind's own default palette already ships slate/emerald/
// blue/amber/violet/rose, matching the six colours the owner approved in
// the prototype, without adding new CSS custom properties to BaseLayout.
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../src/lib/forja/canvas/contrast'
import { FORJA_CANVAS_HEX } from '../../src/lib/forja/canvas/edge-theme'
import {
  PLAYER_COLORS,
  PLAYER_COLOR_HEX,
  PLAYER_COLOR_ORDER,
  PLAYER_COLOR_SHADE,
} from '../../src/lib/forja/canvas/player-colors'
import type { PlayerColor } from '../../src/lib/forja/engine/types'
import { THEMES } from './base-layout-tokens'

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

// The dot sits on the node card, and the node card is the one surface that
// goes to pure white on the light theme. Six colours picked to sing against a
// dark card have nowhere to hide there: measured, all six landed between 1.60
// and 2.60:1, under WCAG 1.4.11's 3:1 floor for a graphical object, all six of
// them, at 10px. A player annotation whose whole job is to be told apart at a
// glance cannot be the one thing on the canvas nobody can see.
//
// This gate did not exist before: the palette shipped with a structural test
// and no contrast test at all, which is exactly why the light theme took it by
// surprise.
describe('the player’s dot is visible on the card it is drawn on', () => {
  it.each(THEMES)('meets the 3:1 graphical-object floor on the %s theme', (theme) => {
    for (const color of PLAYER_COLOR_ORDER) {
      expect(contrastRatio(PLAYER_COLOR_HEX[theme][color], FORJA_CANVAS_HEX[theme].nodeBg), color).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(THEMES)('keeps the six apart from each other on the %s theme', (theme) => {
    expect(new Set(PLAYER_COLOR_ORDER.map((c) => PLAYER_COLOR_HEX[theme][c])).size).toBe(PLAYER_COLOR_ORDER.length)
  })

  // Tailwind's scanner only ever sees literal class names, so the two shades
  // are written out in full in the class string rather than composed. This is
  // what stops that literal and the hex the contrast gate measures from ending
  // up as two different opinions about "Verde".
  it('paints each dot with the shade its measured hex belongs to, in both themes', () => {
    for (const color of PLAYER_COLOR_ORDER) {
      expect(PLAYER_COLORS[color].swatchClass, color).toBe(
        `bg-${PLAYER_COLOR_SHADE.light[color]} dark:bg-${PLAYER_COLOR_SHADE.dark[color]}`,
      )
    }
  })
})
