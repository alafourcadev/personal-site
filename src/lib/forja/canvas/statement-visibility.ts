// Whether the exercise page is showing its statement, or has folded it away
// to give the canvas more room.
//
// Why it exists. The statement is the left rail of the workbench, and what the
// fold buys is the room the camera may use. Measured against this repo on
// `/forja/1/n1-el-comprobante-que-no-se-guarda` at 1440, with the tools rail up
// (canvas pane width, the zoom `fitView` settles on, and the on-screen size of
// a node title):
//
//   statement open     1140px, zoom 0.689,  9.64px
//   statement folded   1140px, zoom 1.102, 15.43px
//
// The pane's own box does not move, because the rail is anchored over it rather
// than taking from it. That is deliberate and it is what protects the narrow
// widths: at 1133 the canvas keeps its full 833px with the statement open,
// where a rail in the layout flow would have left it 433px and node titles
// under 6px. What the fold changes is the camera's padding, and at the widths
// where the rail sits BESIDE the diagram that is worth 60% more type.
//
// The preference belongs to the player rather than to the exercise (someone who
// wants a wide canvas wants it on the next exercise too), so it is persisted.
// The storage contract itself lives in rail-visibility.ts, which the tools rail
// shares: the defensive half of it is the half worth having only one copy of.
import {
  RAIL_STORAGE_KEYS,
  collapsedFromAttribute,
  readRailCollapsed,
  writeRailCollapsed,
} from './rail-visibility'

// Read by this module and, by hand, by the page's own `is:inline` script, which
// Astro leaves unbundled on purpose so the layout is correct on the first paint
// rather than one hydration later. Unbundled means it cannot import from here,
// so tests/canvas/layout-literals.test.ts ties the two copies together, the same
// way the tools rail's own width is tied.
export const STATEMENT_COLLAPSED_STORAGE_KEY = RAIL_STORAGE_KEYS.statement

// The attribute the page carries and the stylesheet reacts to. Its value is
// the string 'true' or 'false'. Both states are styled, so the pleca's own
// direction and label are right before any script runs.
export const STATEMENT_COLLAPSED_ATTRIBUTE = 'data-statement-collapsed'

// Anything this module did not write reads as "expanded". The statement is
// what the exercise is about, so an unreadable preference must never be the
// reason a player arrives at an exercise without it.
export function readStatementCollapsed(storage: Pick<Storage, 'getItem'> | null | undefined): boolean {
  return readRailCollapsed(storage, 'statement')
}

// The fold state as the playground island reads it.
//
// The rail is anchored over the pane rather than inside the layout flow, so
// folding it does not resize the canvas and the island's ResizeObserver never
// fires. What the fold does change is the room the camera may use
// (forja-shell.ts's briefFitPadding), so the island has to read the state
// directly. It reads it off the attribute on <html>, which is the same
// mechanism the theme already uses and for the same reason: it needs no
// cooperation from whoever wrote it, including the page's own unbundled
// first-paint script.
export function collapsedFromRootAttribute(value: string | null | undefined): boolean {
  return collapsedFromAttribute(value)
}

export function writeStatementCollapsed(storage: Pick<Storage, 'setItem'> | null | undefined, collapsed: boolean): void {
  writeRailCollapsed(storage, 'statement', collapsed)
}
