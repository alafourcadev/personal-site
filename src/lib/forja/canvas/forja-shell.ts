// The full-screen shell La Forja opens in, and the geometry of its workbench.
//
// THE THESIS. The exercise screen is a workbench: statement, canvas and tools
// are three stable zones wherever their widths preserve a real workspace. A
// compact laptop keeps the measured overlay because forcing all three columns
// there would make the diagram unreadable.
//
// THE MEASUREMENT. On `/forja/1/n1-el-comprobante-que-no-se-guarda`, against a
// production build (canvas width, the zoom `fitView` settles on, and the
// on-screen size of a node title):
//
//   viewport   statement as a column        statement out of the flow
//   1133       299px, zoom 0.26,  3.64px    783px, zoom 0.678,  9.49px
//   1344       510px, zoom 0.442, 6.19px    994px, zoom 0.862, 12.06px
//   1440       606px, zoom 0.525, 7.36px   1090px, zoom 0.943, 13.21px
//
// That measurement still governs widths below 1280. At and above 1280 the new
// rail is 320px rather than the old 460px document, so the complete arithmetic
// keeps at least a 640px canvas and neither support panel covers the diagram.
//
// THE WORLD IT INHERITS. Nothing here invents a look. The two themes are the
// ones BaseLayout.astro already ships (on dark, elevation is surface and line;
// on light it is shadow), Inter for body, Outfit for headings, JetBrains Mono
// for identifiers, and the brand green with `--on-accent` as its ink.

import {
  CANVAS_WORKSPACE_MIN_PX,
  LIBRARY_WIDTH_PX,
  RAIL_PLECA_WIDTH_PX,
  RESULT_PANEL_WIDTH_PX,
} from './responsive-layout'

// The shell's single row of chrome: the Forja mark, the level and the
// exercise with its progress, the game's actions, the menu, the theme switch
// and the way back to the blog. There is no page scroll here, so every pixel
// of chrome is a pixel the canvas does not get, which is why it is one row.
export const FORJA_TOP_BAR_HEIGHT_PX = 72

// Where the island puts the three game actions.
//
// `Probar respuesta`, `Deshacer` and `Reiniciar ejercicio` need the canvas's
// own state, so they are built by the island; the owner wants them read as
// part of the shell's one row. A bar made of an Astro half and an island half
// on the same line is the clean way to have both: the bar renders this empty
// container, the island renders its buttons into it, and neither the wiring
// nor the `data-testid`s the browser suite drives ever change. Free play has no
// bar and therefore no container, and the island keeps its buttons in place.
export const FORJA_ACTIONS_SLOT_ID = 'forja-topbar-actions'

// The objective card. Narrower than the 460px column it replaces, because it
// no longer has to earn its place against the canvas: it floats, so its width
// costs the diagram nothing once it is folded. 400px leaves ~368px of text
// inside its own padding, which is ~45 characters at the body size, inside
// the 45-75 a reader tracks comfortably.
export const BRIEF_CARD_WIDTH_PX = 400

// The air between the card and the pane's own edges.
export const BRIEF_CARD_INSET_PX = 16

// How much of the pane's width the open card stands on, air included. The
// camera keeps exactly this much clear (briefFitPadding), so no piece of the
// diagram is ever framed underneath it.
export const BRIEF_CARD_FOOTPRINT_PX = BRIEF_CARD_INSET_PX + BRIEF_CARD_WIDTH_PX + BRIEF_CARD_INSET_PX

// How far down the pane the open card starts.
//
// Not the plain inset, because the pane already has chrome at its top edge:
// the three band names, drawn in the pane's own screen space at the camera's
// own top padding (BandLane). Anchoring the card at the same 16px put it over
// "NEGOCIO", which then read as the fragment "CIO". The names are the model
// this product teaches; the card starts under their row instead. 16px of air,
// a 16px line, and 16px more.
export const BRIEF_CARD_TOP_PX = BRIEF_CARD_INSET_PX + 16 + BRIEF_CARD_INSET_PX

// Folded, the card becomes a strip along the top edge of the pane. It is not
// a bare grip: it still carries the budget and the constraints, which are the
// numbers the player re-reads on every move and the only part of the brief
// that cannot be recalled from memory. The narrative is read once and folds.
export const BRIEF_STRIP_HEIGHT_PX = 40

// Below this the product is readable, not playable (PRODUCT.md: "Desktop
// first. The canvas needs pointer precision."). It is a decided constraint,
// so the screen it produces is an honest one: the whole statement, the way to
// the level map, and a line inviting the player back from a wide screen. Never
// a silently broken canvas with 3.2px connection handles.
export const PLAYABLE_MIN_PX = 768

// The width where the statement becomes a real column beside the canvas.
// Below it, keeping both 320px and 300px rails in the row would leave less
// than the 640px workspace floor. At 1280 the arithmetic closes exactly:
// 320px statement + 660px canvas + 300px tools.
export const WIDE_WORKBENCH_MIN_PX = 1280
export const WIDE_WORKBENCH_MEDIA_QUERY = `(min-width: ${WIDE_WORKBENCH_MIN_PX}px)`

// The complete left rail, including its 24px disclosure pleca. The readable
// statement surface therefore gets 296px, while the canvas keeps its floor at
// the first viewport where this composition is enabled.
export const STATEMENT_RAIL_WIDTH_PX = 320

export function isPlayableViewport(viewportWidth: number): boolean {
  return viewportWidth >= PLAYABLE_MIN_PX
}

// The same threshold as a media query, for the island to listen to.
//
// It is not a nicety. Mounting React Flow inside a `display: none` workspace
// gives it a pane of 0x0, and its own `<Background />` then computes the dot
// pattern from that: measured at 390px, the console filled with 70 errors of
// the shape `<circle> attribute cx: Expected length, "NaN"`. The phone was
// also paying to download and run a graph editor it is never shown. Both stop
// by not mounting it at all under this width.
export const PLAYABLE_MEDIA_QUERY = `(min-width: ${PLAYABLE_MIN_PX}px)`

// The narrowest PANE where the camera can afford to keep the open card's
// footprint clear: the card and its air, plus a canvas that is still a
// workspace after it.
//
// The pane and not the window, because the pane is what actually shrinks. At
// 1440 with the verdict open the pane is 760px, and a camera still framing
// around a 432px card had 312px left: the design the verdict is about became
// a thumbnail at the exact moment the player is asked to look at it, and every
// finding in that verdict is a button that highlights a node in it.
//
// The two states, measured on this repo at a 833px pane:
//
//   camera clears the card   diagram 385px wide, node titles 5.36px, nothing covered
//   camera ignores the card  diagram 833px wide, node titles 11.16px, the card over its left half
//
// The second is better and it is what happens below this width. A player
// reading the objective is not working on the diagram, the card is opaque
// rather than translucent so there is nothing smeared underneath it, and the
// half that is visible is legible instead of all of it being unreadable. Above
// this width nothing has to be covered at all, so nothing is.
export const BRIEF_CARD_SIDE_MIN_PANE_PX = BRIEF_CARD_FOOTPRINT_PX + CANVAS_WORKSPACE_MIN_PX

export function briefCardIsBesideCanvas(paneWidth: number): boolean {
  return paneWidth >= BRIEF_CARD_SIDE_MIN_PANE_PX
}

// A VERDICT FOLDS THE STATEMENT. Always, at every width, which is why this is a
// sentence in a comment and no longer a function with a threshold in it.
//
// It used to be conditional: fold only where an open statement would stand on
// the diagram, on the argument that a window wide enough for the camera to
// clear the rail should keep the problem on screen because "folding it there
// would take the problem away and give the player nothing back". Measured on
// this repo, that last clause is simply false. Clearing the rail costs the
// diagram the rail's whole 432px footprint, and at the verdict moment that is
// the diagram the verdict is about (canvas pane width, the zoom `fitView`
// settles on, and the on-screen size of a node title, with the verdict open):
//
//   viewport   statement kept open      statement folded
//   1512       1132px, zoom 0.681, 9.53px    1132px, zoom ~1.06, ~14.8px
//
// So the old rule protected the statement's presence and paid for it with 35%
// of the type on the thing the player was just asked to look at. Folding wins
// at every width, uncovers the diagram at every width, and costs the narrative
// only, because the budget and the constraints survive in the strip.
//
// What makes that affordable is the two properties either side of it, and both
// are load-bearing. The fold writes the VIEW and never the stored preference,
// so a player who has never chosen does not find their next exercise folded.
// Reopening IS a choice and is remembered, so a player who wants the statement
// during a verdict asks once.

export interface RailState {
  // Which tenant holds the right rail. responsive-layout.ts guarantees these
  // are never both true: the tools and the verdict are exclusive in time.
  library: boolean
  result: boolean
  // Whether the player has folded the tools to their pleca. It is ignored while
  // the verdict holds the rail, because the verdict is the rail's other tenant
  // and not a second rail: a folded tools preference must not make a verdict
  // narrower than the one the next player sees.
  toolsCollapsed?: boolean
}

// What the right rail takes out of the row.
export function railWidth(rails: RailState): number {
  if (rails.result) return RESULT_PANEL_WIDTH_PX
  if (!rails.library) return 0
  return rails.toolsCollapsed ? RAIL_PLECA_WIDTH_PX : LIBRARY_WIDTH_PX
}

// What the diagram's pane is left with, given the playground's own width and
// what the rail is holding. The statement rail is deliberately absent from this
// arithmetic: it is anchored OVER the pane, so its width costs the diagram
// nothing and only its camera padding does (briefFitPadding).
export function canvasPaneWidth(playgroundWidth: number, rails: RailState): number {
  return playgroundWidth - railWidth(rails)
}

// What the diagram's own pane gets, given the window, in the state a player
// arrives in: the tools rail up, no verdict. The shell is full bleed, so the
// playground's box is the viewport.
export function workspaceCanvasWidth(viewportWidth: number): number {
  return viewportWidth - LIBRARY_WIDTH_PX
}

// What the complete wide workbench leaves for the playground. At compact
// widths the statement is outside layout flow and costs zero. Once the real
// three-column composition starts, it costs its full rail while open and only
// its accessible pleca while folded.
export function workbenchPlaygroundWidth(viewportWidth: number, statementCollapsed = false): number {
  if (viewportWidth < WIDE_WORKBENCH_MIN_PX) return viewportWidth
  return viewportWidth - (statementCollapsed ? RAIL_PLECA_WIDTH_PX : STATEMENT_RAIL_WIDTH_PX)
}

// The arrival-state canvas in the complete exercise shell: the wide statement
// rail outside the React island, plus the tools rail inside it.
export function workbenchCanvasWidth(viewportWidth: number, statementCollapsed = false): number {
  return canvasPaneWidth(workbenchPlaygroundWidth(viewportWidth, statementCollapsed), {
    library: true,
    result: false,
  })
}

// Where the canvas pane is, published by the island so the statement rail can
// anchor to it.
//
// The rail's prose is server-rendered markdown, so it cannot live inside the
// island and cannot ask React Flow where the pane is. It has to be told, and it
// has to be told the truth on every frame, because the pane's box now moves for
// three separate reasons: the tools rail folding to its pleca, the verdict
// taking that rail, and the window. Any hard-coded number would be wrong in at
// least two of the three. So the island measures its own pane and publishes the
// box; the rail reads it.
export const PANE_GEOMETRY_VARS = {
  top: '--forja-pane-top',
  left: '--forja-pane-left',
  width: '--forja-pane-width',
  height: '--forja-pane-height',
} as const

export interface PaneBox {
  top: number
  left: number
  width: number
  height: number
}

// Rounded to whole pixels on purpose: a ResizeObserver on a flex pane reports
// subpixel widths that change by a hundredth on any reflow, and writing those
// straight through would invalidate the card's own layout every frame.
export function paneGeometryStyle(box: PaneBox): Record<string, string> {
  return {
    [PANE_GEOMETRY_VARS.top]: `${Math.round(box.top)}px`,
    [PANE_GEOMETRY_VARS.left]: `${Math.round(box.left)}px`,
    [PANE_GEOMETRY_VARS.width]: `${Math.round(box.width)}px`,
    [PANE_GEOMETRY_VARS.height]: `${Math.round(box.height)}px`,
  }
}

// Real pixels per side, in the literal shape React Flow's own `Padding` type
// accepts. A plain `string` here is assignable to nothing on that side, which
// is the compiler catching the one mistake that would silently disable the
// whole mitigation.
type PaddingPx = `${number}px`

export interface BriefFitPadding {
  top: PaddingPx
  right: PaddingPx
  bottom: PaddingPx
  left: PaddingPx
}

// The room the camera must leave for the card.
//
// This is the mitigation for the one risk the card carries: a panel over a
// canvas covers the drawing. React Flow's `fitView` takes per-side padding in
// real pixels, so the card's footprint becomes the camera's margin and no
// node is ever framed underneath it. Folded, the footprint moves from the
// left edge to the top edge, and the diagram gets the width back. That is the
// whole reason the fold exists, and what the 13.21px column above measures.
export function briefFitPadding(
  statementCollapsed: boolean,
  paneWidth: number,
  statementInFlow = false,
): BriefFitPadding {
  // A real column cannot cover the pane. Its width has already been paid by
  // layout, so charging the camera for it again would waste the same room
  // twice. Folded, the column leaves only its pleca and no top strip.
  if (statementInFlow) return PANE_INSET_PADDING
  if (statementCollapsed) {
    return { ...PANE_INSET_PADDING, top: `${BRIEF_STRIP_HEIGHT_PX + BRIEF_CARD_INSET_PX}px` }
  }
  // Narrow enough and the open card covers the pane rather than sitting beside
  // it, so there is no strip of diagram to keep clear: the honest answer is
  // that this is the reading state and the fold is the way out of it.
  if (!briefCardIsBesideCanvas(paneWidth)) return PANE_INSET_PADDING
  return { ...PANE_INSET_PADDING, left: `${BRIEF_CARD_FOOTPRINT_PX}px` }
}

// What free play gets. It has no objective card, so the camera owes nothing to
// one, but it still keeps the outermost nodes off the pane's edges so that a
// finding's highlight ring is never clipped.
export const PANE_INSET_PADDING: BriefFitPadding = {
  top: `${BRIEF_CARD_INSET_PX}px`,
  right: `${BRIEF_CARD_INSET_PX}px`,
  bottom: `${BRIEF_CARD_INSET_PX}px`,
  left: `${BRIEF_CARD_INSET_PX}px`,
}

// The top bar's own line: which level this is and where inside it the player
// stands. Zero-padded so the fourteen entries of the level menu read as a
// column rather than as a ragged list.
export function exercisePositionLabel(level: number, position: number, total: number): string {
  return `Nivel ${level} · ${String(position).padStart(2, '0')} de ${total}`
}
