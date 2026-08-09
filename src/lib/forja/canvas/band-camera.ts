// The camera's contract with the three bands: NEGOCIO, APLICACIÓN and
// INFRAESTRUCTURA are the model this product teaches, so no camera state may
// hide one of their divisions.
//
// THE DEFECT. `<ReactFlow>` declared a `minZoom` and nothing else: no
// `maxZoom`, no `translateExtent`. Measured on a production build of
// `/forja/1/n1-el-comprobante-que-no-se-guarda` at 1133 with the statement
// open, four presses of the zoom-in control settled on zoom 1.653 with the
// three dividers at 43, 638 and 1233 inside an 833px pane. The third one was
// 400px outside the glass, and NEGOCIO had left through the other side. On
// `/forja/1/n1-el-taller-que-todavia-anota-en-papel`, which opens blank, the
// camera never framed anything at all (React Flow's `fitView` has no nodes to
// fit), so it sat at zoom 1 and pan 0 with the third divider at 1080 in an
// 833px pane: the defect on arrival, with nothing the player had done.
//
// THE RULE. Three properties together, and each one closes a different door:
//
//   `bandMaxZoom`        the pane always shows at least 1080 flow units across,
//                        so no zoom can make the strip wider than the glass.
//   BAND_TRANSLATE_EXTENT  the horizontal is pinned to the strip, so no drag
//                        can slide it out sideways. d3-zoom centres an extent
//                        narrower than the viewport, which is exactly the
//                        state the maximum above guarantees.
//   `bandFramingBounds`  every framing targets the strip and not just the
//                        pieces, so no re-frame can settle anywhere else.
//
// WHAT IT COST. Measured on a production build, three exercises, five
// rail/width states each: the on-screen size of a node title (14px at zoom 1)
// framed on the pieces against framed on the bands, and whether the three
// divisions were inside the pane BEFORE.
//
//   exercise            state                   pane   before  after   bands before
//   n1-el-comprobante   1440 open/open          1140    9.64    8.89   inside
//   n1-el-comprobante   1440 folded/open        1140   15.43   14.23   inside
//   n1-el-comprobante   1440 folded/folded      1416   19.28   17.78   inside
//   n1-el-comprobante   1133 open/open           833   11.16   10.29   inside
//   n1-el-comprobante   1512 folded/open        1212   16.44   15.16   inside
//   n4-el-pago-email    1440 open/open          1140   16.42    8.97   ONE OUTSIDE
//   n4-el-pago-email    1440 folded/open        1140   24.86   14.36   ONE OUTSIDE
//   n4-el-pago-email    1440 folded/folded      1416   24.86   17.94   ONE OUTSIDE
//   n4-el-pago-email    1133 open/open           833   19.01   10.38   ONE OUTSIDE
//   n4-el-pago-email    1512 folded/open        1212   24.86   15.30   ONE OUTSIDE
//   n8-grupo-hotelero   1440 open/open          1140   10.06    8.97   ONE OUTSIDE
//   n8-grupo-hotelero   1440 folded/open        1140   13.50   13.50   inside
//   n8-grupo-hotelero   1440 folded/folded      1416   13.50   13.46   inside
//   n8-grupo-hotelero   1133 open/open           833   11.64   10.38   ONE OUTSIDE
//   n8-grupo-hotelero   1512 folded/open        1212   13.50   13.46   inside
//
// The price is paid exactly where a band was being hidden, which is the whole
// argument for paying it. Every state that already showed all three divisions
// costs 8% of the type or nothing at all. Every state that was hiding one
// costs 11% to 45%, and n4 is the extreme because its diagram never reaches
// the infrastructure band: 590 flow units of drawing inside 1080 units of
// band, so the camera has to show almost twice the width it used to.
//
// The two cannot both be maximised. Framing tight against the pieces is what
// produces the larger titles; framing against the bands is what keeps them on
// screen. The floor responsive-layout.ts calls unacceptable is 7px, and the
// smallest number in the "after" column is 8.89px, so nothing crossed it.
// Folding the objective is still the player's own lever: it is worth 60% more
// type here, exactly as it was before.
import { BAND_ORDER, BAND_WIDTH } from './bands'
import { DEFAULT_GAP, DEFAULT_NODE_SIZE, DEFAULT_TOP } from './placement'

// The flow-space strip the three bands occupy, from the left edge of NEGOCIO
// to the right edge of INFRAESTRUCTURA. BandLane.tsx draws its lanes from the
// same two constants, so this is the same 1080 the player sees.
export const BANDS_TOTAL_WIDTH = BAND_ORDER.length * BAND_WIDTH

// How deep a blank canvas opens. A `greenfield` exercise has no pieces to
// frame, so the bands decide the width and this decides the height. It is five
// rows of real pieces below where the first one is born (placement.ts), which
// is the room the player is about to fill rather than an arbitrary number.
export const EMPTY_CANVAS_ROWS = 5
export const EMPTY_CANVAS_DEPTH = DEFAULT_TOP + EMPTY_CANVAS_ROWS * (DEFAULT_NODE_SIZE.height + DEFAULT_GAP)

export interface FlowRect {
  x: number
  y: number
  width: number
  height: number
}

// What every framing targets: the three bands, plus anything that somehow
// ended up outside them. `clampToBand` makes that second half unreachable
// through any player gesture, and it is here anyway: cropping a piece out of
// the frame to honour the bands would trade one invisible thing for another.
export function bandFramingBounds(content: FlowRect | null): FlowRect {
  const left = content ? Math.min(0, content.x) : 0
  const right = content ? Math.max(BANDS_TOTAL_WIDTH, content.x + content.width) : BANDS_TOTAL_WIDTH
  if (!content) return { x: left, y: 0, width: right - left, height: EMPTY_CANVAS_DEPTH }
  return { x: left, y: content.y, width: right - left, height: content.height }
}

// Whether a pane of this width, at this zoom, still has room for the whole
// strip. This is the property everything else exists to keep true.
export function bandsFitInside(paneWidth: number, zoom: number): boolean {
  return paneWidth / zoom >= BANDS_TOTAL_WIDTH
}

// The tightest zoom that still satisfies it.
//
// A pane too narrow to hold the strip even at the camera's own floor gets the
// floor: asking for a maximum below the minimum is not a zoom range at all,
// and the floor is the state that shows the most of the bands anyone can. The
// same answer covers a pane that has not been measured yet, whose width is 0.
export function bandMaxZoom(paneWidth: number, minZoom: number): number {
  if (paneWidth <= 0) return minZoom
  return Math.max(minZoom, paneWidth / BANDS_TOTAL_WIDTH)
}

// How far the camera may be dragged, in the literal shape React Flow's
// `translateExtent` takes.
//
// Horizontally it is the strip and nothing else, which is the whole world:
// every piece lives inside a band by construction (bands.ts's clamp), so there
// is nothing to the left of NEGOCIO or to the right of INFRAESTRUCTURA worth
// panning to. Combined with the maximum above, d3-zoom's own constraint
// centres the strip rather than letting it slide, so the horizontal simply
// stops moving.
//
// Vertically it is untouched. The lanes are 4000 units tall, a diagram grows
// downwards, and nothing in the owner's rule is about the vertical, so the
// vertical drag a player already had is still there.
export const BAND_TRANSLATE_EXTENT: [[number, number], [number, number]] = [
  [0, Number.NEGATIVE_INFINITY],
  [BANDS_TOTAL_WIDTH, Number.POSITIVE_INFINITY],
]
