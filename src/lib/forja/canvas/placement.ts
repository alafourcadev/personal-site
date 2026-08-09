// Where a newly created component is born [PC7's band design note, R1-I's
// "the canvas frames its own content"]. Pure geometry: no DOM, no React
// Flow, so the guarantee it makes is provable in Vitest.
//
// It replaces a rule that counted siblings ("this is the 4th node of the
// application band, so y = 80 + 4*110") and never looked at where the nodes
// actually are. Measured with physical clicks across every playable
// exercise: 165 of 495 creations landed ON TOP of an existing node, in 121
// of the 165 exercises, including a queue born with 171x82px of overlap
// over the service it was supposed to connect to, burying that service's
// own source handle so the connection failed three times with no message.
//
// The rule here is the opposite one: look at the boxes that exist, and
// return the first hole that fits inside the band, inside what the player
// can currently see, and with real separation from its neighbours.
import { BAND_TOP, bandXRange } from './bands'
import type { Layer } from '../engine/types'

export interface PlacementRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PlacementInput {
  layer: Layer
  /** Every box already on the canvas, in flow coordinates. */
  occupied: readonly PlacementRect[]
  /** The new node's own box. Real measurements when the caller has them. */
  size?: { width: number; height: number }
  /** The flow-space rectangle the camera is currently showing, when known. */
  viewport?: PlacementRect | null
  /** Where the player pointed (the pane context menu), when the gesture has a point. */
  preferred?: { x: number; y: number } | null
  gap?: number
}

// Matches ForjaNode's real rendered box closely enough to reserve room for
// it: `min-w-[168px]` grows with the label (measured 190-200 flow px for the
// catalog's longest names) and the two-line body measures ~58-78 flow px,
// more when a "Con advertencia" line appears.
export const DEFAULT_NODE_SIZE = { width: 190, height: 90 }
// Not cosmetic: a node's connection handles sit ON its left and right edges,
// so two boxes that merely fail to overlap can still put one node's handle
// under its neighbour's box. Level 6 measured two nodes 1px apart, where
// dragging from the handle moved the neighbour instead of starting a
// connection.
export const DEFAULT_GAP = 24
// Where the very first node of a band goes when nothing else is known. Also
// the top row auto-layout writes to (auto-layout.ts) and the top of the frame a
// blank canvas opens on (band-camera.ts), so a new piece is born on the same
// line an arranged one lands on.
export const DEFAULT_TOP = 80
// How far down to keep probing when there is no viewport to bound the search.
const BLIND_PROBES = 12

export function rectsOverlap(a: PlacementRect, b: PlacementRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function inflate(rect: PlacementRect, by: number): PlacementRect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + by * 2, height: rect.height + by * 2 }
}

export function findFreePosition(input: PlacementInput): { x: number; y: number } {
  const gap = input.gap ?? DEFAULT_GAP
  const size = input.size ?? DEFAULT_NODE_SIZE
  const { min, max } = bandXRange(input.layer)
  const viewport = input.viewport ?? null

  // The band always wins over the camera: a node outside its own band is a
  // lie about which layer it belongs to, while a node outside the current
  // camera is recoverable (ForjaCanvas re-frames the view when the new node
  // does not fit inside the pane).
  let x = clamp(input.preferred?.x ?? (viewport ? viewport.x + gap : min), min, max)
  if (viewport) {
    const rightmostInView = viewport.x + viewport.width - size.width - gap
    if (x > rightmostInView) x = clamp(rightmostInView, min, max)
  }

  // The bands always win over the camera vertically too, and for the same
  // reason they win horizontally. The camera frames the three bands now
  // (band-camera.ts), so on a diagram narrower than they are it shows a strip
  // of empty canvas above the bands' own top edge: measured on a production
  // build of `/forja/4/n4-el-pago-que-espera-al-email` at 1440 with the
  // objective open, the pane's top edge sat at flow y -323, and two pieces
  // created from there were born at -299, drawn above every divider on a
  // stretch of canvas where no band exists at all.
  const step = size.height + gap
  const top = Math.max(BAND_TOP, viewport ? viewport.y : BAND_TOP)
  const startY = Math.max(top, input.preferred?.y ?? (viewport ? viewport.y + gap : DEFAULT_TOP))
  const lastY = viewport ? Math.max(startY, viewport.y + viewport.height - size.height) : startY + step * BLIND_PROBES

  const candidates: number[] = []
  for (let y = startY; y <= lastY; y += step) candidates.push(y)
  // A preferred point low in the view still deserves the holes above it.
  if (viewport) for (let y = startY - step; y >= top; y -= step) candidates.push(y)

  const isFree = (y: number) => {
    const probe = inflate({ x, y, width: size.width, height: size.height }, gap)
    return !input.occupied.some((rect) => rectsOverlap(probe, rect))
  }

  for (const y of candidates) if (isFree(y)) return { x, y }

  // Nothing free in view: go below everything that shares this column. Only
  // boxes that overlap the new one horizontally can ever collide with it, so
  // clearing their lowest edge is a guarantee, not a heuristic.
  const column = input.occupied.filter(
    (rect) => rect.x < x + size.width + gap && x - gap < rect.x + rect.width,
  )
  if (column.length === 0) return { x, y: startY }
  return { x, y: Math.max(BAND_TOP, Math.max(...column.map((rect) => rect.y + rect.height)) + gap) }
}
