// The pleca: the control that rides a rail's outer edge, folds it away, and
// brings it back.
//
// THE RULE, and it is one rule rather than a pair of glyphs. The chevron points
// in the direction the rail is about to move. An open rail is going to leave,
// so its pleca points at the edge it lives on: `<` on the left rail, `>` on the
// right one. A folded rail is going to come back, so its pleca points back into
// the workspace. That is why one function owns it: two components writing
// `collapsed ? '<' : '>'` by hand is where one of them ends up pointing at the
// wall, and the player learns nothing from a control that lies half the time.
//
// WHY A MODULE AND NOT A COMPONENT. There are two plecas and they cannot share
// an implementation. The statement's rail is server-rendered Astro, outside the
// React island, because its prose is markdown and because it has to be on the
// page from the first paint with no JavaScript. The tools' rail is inside the
// island. What they CAN share is this decision, the stylesheet, and the shape
// of the accessible name.

export const SIDES = ['left', 'right'] as const

export type RailSide = (typeof SIDES)[number]

export const OPPOSITE_SIDE: Record<RailSide, RailSide> = { left: 'right', right: 'left' }

// Where the chevron points, given which edge the rail lives on and whether it
// is folded.
export function plecaDirection(side: RailSide, collapsed: boolean): RailSide {
  return collapsed ? OPPOSITE_SIDE[side] : side
}

// What the control is called.
//
// The glyph is a picture, and a picture is not an accessible name. Each pleca
// carries a real sentence naming its own rail and the action pressing it will
// perform, so a player reaching it with a screen reader is told which of the
// two rails they are on. It never announces the state they are already in.
export function plecaLabel(whenOpen: string, whenCollapsed: string, collapsed: boolean): string {
  return collapsed ? whenCollapsed : whenOpen
}

// The attribute both plecas carry, so one stylesheet can draw both. Written as
// a constant because the stylesheet, the Astro markup and the React component
// are three places the same string would otherwise be typed by hand.
export const PLECA_DIRECTION_ATTRIBUTE = 'data-pleca-direction'

export const PLECA_CLASS = 'forja-pleca'
