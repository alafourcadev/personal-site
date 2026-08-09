// How many of the playground's panes a viewport can honestly hold at once.
//
// The playground shipped as three fixed columns in one flex row, library
// (`w-[300px] shrink-0`), canvas (`flex-1`) and result panel (`w-[380px]
// shrink-0`), at every width. That arithmetic only works while the viewport
// is wide. Measured in a production build:
//
//   390x844   canvas 136px, zoom 0.5, node titles 7px, 4 of 7 nodes off-pane.
//             With the result panel open: canvas 0px, 7 of 7 off-pane, and
//             the panel itself clipped mid-word.
//   834x1112  zoom 0.561, node titles 7.85px.
//
// This brand's traffic arrives from LinkedIn, so a phone is the majority of
// first visits: the widest supported layout was the only one that worked.
//
// The thresholds below are not device names. They come from the two
// invariants the layout e2e already asserts, that the canvas must be wider
// than the library and wider than the result panel, applied to the sidebars'
// own fixed widths. Below a threshold the sidebar in question stops being a
// sidebar and becomes a view of its own, reached through the tab bar the
// playground already has.

// The tools rail's whole footprint, which is what ComponentLibrary.tsx renders
// as `w-[300px]`. The pleca is carved OUT of it rather than added beside it,
// which is deliberate: every pane calculation in this product is derived from
// this number, and a rail that grew by its own grip would have moved the
// measured canvas floor at every width for the sake of a control.
export const LIBRARY_WIDTH_PX = 300
// ResultPanel.tsx's own `w-[380px]`.
export const RESULT_PANEL_WIDTH_PX = 380

// The grip a folded rail leaves on the canvas's edge.
//
// It is the whole rail when the rail is folded, so it has to be small enough to
// read as an edge control and never as a pane, and big enough to hit. 24px is
// WCAG 2.2's own target-size minimum (2.5.8, level AA, which PRODUCT.md calls
// this product's floor) taken literally rather than argued away through the
// spacing exception: the plecas are tall tabs, so the exception would have
// covered a narrower one, but a control the owner asked for by name should not
// need an exception to be reachable. It still gives the canvas back 92% of the
// rail.
export const RAIL_PLECA_WIDTH_PX = 24

// How wide the canvas has to be before the diagram is something a player
// works on rather than something they look at.
//
// The tiers below answer a different question (which panes can COEXIST
// inside whatever box the page hands the playground) and they answer it from
// the sidebars' own widths, which makes them unable to notice that a canvas
// one pixel wider than the library is not a workspace. That is exactly how a
// 299px canvas at 1133px shipped with a green suite: the test that should
// have caught it compared `LIBRARY_BESIDE_CANVAS_MIN_PX - LIBRARY_WIDTH_PX`
// against `LIBRARY_WIDTH_PX`, which is the same constant on both sides.
//
// So this number comes from outside the arithmetic. Measured on
// `/forja/1/n1-el-comprobante-que-no-se-guarda` against this repo, `fitView`
// settles on zoom ~0.000866 per pixel of canvas width, and React Flow's own
// default zoom floor is 0.5, the floor this repo deliberately lowered to 0.2
// so a phone could see the whole graph at all, calling legibility at that
// zoom "bad on purpose" (see ForjaCanvas.tsx's MIN_ZOOM). A canvas that needs
// to go under React Flow's default floor to frame its content is a phone
// compromise, and that starts at 577px on this exercise; 640 is that number
// with room for the levels whose designs carry more components.
//
// Nothing derives a breakpoint from it. It is a floor an assertion can hold
// the layout to, and the layout meets it by letting the player fold the
// statement away, not by refusing to split (measured: no laptop width can
// meet it with the statement open: see statement-visibility.ts).
export const CANVAS_WORKSPACE_MIN_PX = 640

// One rail + canvas, with the canvas still the wider of the two: the canvas
// needs LIBRARY_WIDTH_PX + 1 at minimum.
//
// There is no second threshold, and its absence is the owner's decision rather
// than an omission. There used to be a `THREE_COLUMN_MIN_PX` whose only job was
// keeping the library beside the verdict; the rail now holds one tenant at a
// time, so no width ever has to fit two of them.
export const RAIL_BESIDE_CANVAS_MIN_PX = LIBRARY_WIDTH_PX + LIBRARY_WIDTH_PX + 1

export type PaneLayout = 'stacked' | 'rail-beside-canvas'

// 'library' is a real view only where the tools have no rail of their own.
// See libraryIsOwnPane below.
export type PlaygroundView = 'library' | 'canvas' | 'list' | 'result'

export function paneLayout(viewportWidth: number): PaneLayout {
  return viewportWidth >= RAIL_BESIDE_CANVAS_MIN_PX ? 'rail-beside-canvas' : 'stacked'
}

// Whether the tab bar carries a fourth tab for the tools. Only where they
// cannot sit next to the canvas: a tab that duplicates something already on
// screen is noise, and on a phone it is the only way to reach the components at
// all.
export function libraryIsOwnPane(layout: PaneLayout): boolean {
  return layout === 'stacked'
}

// A view the current layout can actually render. Rotating a phone to
// landscape, or dragging a desktop window wider, must not strand the
// playground on a view whose tab no longer exists, which would be a blank
// pane with no way back.
export function effectiveView(layout: PaneLayout, view: PlaygroundView): PlaygroundView {
  if (view === 'library' && !libraryIsOwnPane(layout)) return 'canvas'
  return view
}

export interface PaneVisibility {
  library: boolean
  canvas: boolean
  list: boolean
  result: boolean
}

// Which panes render, given the layout and the selected view.
//
// Two rules survive every layout, because they are product requirements
// rather than geometry:
//
//   - The canvas is never unmounted, only hidden (see ForjaCanvas.tsx's own
//     note on the React Flow remount loop). `canvas: false` means
//     `display: none`, never a torn-down instance.
//   - The list view replaces the workspace entirely at every width: it is
//     the same design in another form, not a third panel.
//
// THE RAIL HAS ONE TENANT AT A TIME. While the player builds it holds the
// tools; while they evaluate it holds the verdict. That is the owner's
// decision, and the argument is that the two are exclusive in TIME: nobody
// picks a component and reads a verdict in the same moment.
//
// It replaces a rule that tried to keep both: at three columns the library
// stayed beside the verdict, on the grounds that "the correction loop never
// loses its tools". The loop does not lose them. The canvas's own context menu
// offers all 21 components at every width, which is the gesture
// canvas-survives-the-verdict.spec.ts drives with a real right-click. What the
// old rule actually cost was 300px of the canvas, at the exact moment every
// finding in the verdict is a button that highlights a node in it: at 1440 the
// diagram had 760px, and it now has 1060px.
//
// What has never been negotiable, and still is not: the verdict may not take
// the canvas with it. Handing it the whole row put the canvas at
// `display: none`, measured 0x0 at 1440x900 and at 1512, the two commonest
// laptops, the moment the player pressed "Probar respuesta".
export function paneVisibility(layout: PaneLayout, view: PlaygroundView): PaneVisibility {
  const resolved = effectiveView(layout, view)
  const none: PaneVisibility = { library: false, canvas: false, list: false, result: false }

  if (resolved === 'list') return { ...none, list: true }
  if (resolved === 'library') return { ...none, library: true }

  // A phone is the one width where one pane at a time is the honest answer:
  // there is no room for two, and the tab bar is the way back.
  if (layout === 'stacked') {
    return resolved === 'result' ? { ...none, result: true } : { ...none, canvas: true }
  }

  if (resolved === 'result') return { ...none, canvas: true, result: true }

  return { ...none, library: true, canvas: true }
}

// Whether the verdict is a RAIL beside the canvas rather than a view of its
// own. It is the same distinction libraryIsOwnPane already draws, read from
// the other end: a pane that sits next to the canvas is not an alternative to
// it, so a tab that switches to it switches to something already on screen.
//
// The library has had no tab in that state since this module existed. The
// verdict kept one, which is how the workbench came to offer "Lienzo" and
// "Resultado" as alternatives while both were painted side by side. Where the
// verdict really does replace the canvas (a phone) it is a view, its tab is
// the only way back, and this is false.
export function resultIsRail(panes: PaneVisibility): boolean {
  return panes.result && panes.canvas
}
