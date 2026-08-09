// The pleca: the control on a rail's outer edge that folds it away and brings
// it back.
//
// The owner asked for it by name and by shape: "que tenga una pleca tipo `<`
// para que se esconda y exista más espacio para el playground, y `>` para
// esconder las herramientas". Read together, those two sentences state one
// rule rather than two glyphs: the chevron points in the direction the rail is
// about to move. The statement rail leaves to the left, so it is `<`; the tools
// rail leaves to the right, so it is `>`. Expanding is the same control with
// the arrow the other way round.
//
// This is the whole reason the rule is a pure function with a test instead of
// two `collapsed ? '<' : '>'` expressions written in two components. Two copies
// is where one of them ends up pointing at the wall.
import { describe, expect, it } from 'vitest'
import { OPPOSITE_SIDE, plecaDirection, plecaLabel } from '../../src/lib/forja/canvas/rail-pleca'

describe('which way the pleca points', () => {
  // The rule, stated once: an OPEN rail's pleca points at the edge the rail
  // will disappear into, which is the edge the rail already lives on.
  it('points at its own edge while the rail is open, because that is where the rail is going', () => {
    expect(plecaDirection('left', false)).toBe('left')
    expect(plecaDirection('right', false)).toBe('right')
  })

  // And a FOLDED rail's pleca points back into the workspace, because that is
  // where the rail will come from.
  it('points back into the canvas while the rail is folded, because that is where it comes back from', () => {
    expect(plecaDirection('left', true)).toBe('right')
    expect(plecaDirection('right', true)).toBe('left')
  })

  // The literal the owner used, checked against the rule rather than restated:
  // the statement is the left rail, so folding it is the `<` they asked for,
  // and the tools are the right rail, so folding them is the `>`.
  it('is exactly the two glyphs the owner named, on the two rails they named them for', () => {
    expect(plecaDirection('left', false), 'the statement folds with a <').toBe('left')
    expect(plecaDirection('right', false), 'the tools fold with a >').toBe('right')
  })

  // A control that folds and unfolds has to CHANGE, or a player cannot tell
  // which of the two it is about to do without reading the screen behind it.
  it('never looks the same in both states, on either rail', () => {
    for (const side of ['left', 'right'] as const) {
      expect(plecaDirection(side, false), side).not.toBe(plecaDirection(side, true))
    }
  })

  // The two rails are mirror images, which is what makes one gesture learnable
  // rather than two.
  it('makes the two rails mirror each other in every state', () => {
    for (const collapsed of [true, false]) {
      expect(plecaDirection('left', collapsed)).toBe(OPPOSITE_SIDE[plecaDirection('right', collapsed)])
    }
  })
})

describe('what the pleca says it does', () => {
  // The glyph is a picture and pictures are not an accessible name. The control
  // carries a real sentence, and the sentence names the rail and the action, so
  // a screen reader player is told which of the two rails they just reached.
  it('names the rail and what pressing it will do, in both states', () => {
    expect(plecaLabel('Ocultar las herramientas', 'Ver las herramientas', false)).toBe('Ocultar las herramientas')
    expect(plecaLabel('Ocultar las herramientas', 'Ver las herramientas', true)).toBe('Ver las herramientas')
  })

  it('never announces the state the player is already in', () => {
    const collapse = 'Ocultar la consigna'
    const expand = 'Ver la consigna'
    expect(plecaLabel(collapse, expand, false)).not.toBe(plecaLabel(collapse, expand, true))
  })
})
