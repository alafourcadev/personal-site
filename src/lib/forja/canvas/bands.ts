// Band containment [design note "Band mapping", PC7's surrounding design].
// Pure math, no DOM, no React Flow, and deliberately NOT React Flow's
// `extent: 'parent'` plus `parentId`. Verified by reading @xyflow/system's own
// NodeBase type (`extent?: 'parent' | CoordinateExtent | null`) and
// @xyflow/react's index.js, which calls `evaluateAbsolutePosition(node
// .position, ...)` specifically because a node's `position` becomes
// PARENT-RELATIVE once `parentId` is set. Adopting it would have forced a
// coordinate-space translation layer across the store, the projection
// (project.ts) and the drag-commit path, breaking design D1's "position is
// absolute domain state, React Flow only derives it" invariant for the sake
// of a purely visual constraint. This clamp achieves the identical
// containment guarantee without touching D1 at all: bands are visual only
// (see BandLane.tsx, which reads real node positions to draw its lanes but
// is never itself a React Flow node), and this function is the single
// source of truth both the live-drag preview and the store's canonical
// commit clamp to.
import type { ComponentType, Layer } from '../engine/types'
import { CATALOG } from '../engine/catalog'

export const BAND_ORDER: Layer[] = ['business', 'application', 'infrastructure']
// Sized against the real rendered canvas pane (~915px wide at the
// component library's default width, 1280px viewport, measured directly and
// not guessed): three bands at 360px total 1080px, wider than the pane, but
// every node SPAWNS at its band's own left edge (see ForjaCanvas's
// nextCreatePosition), so what actually has to stay visible without manual
// panning is each band's own left edge and a freshly created node's own
// width from there, comfortably inside 915px for all three bands. 360px
// also leaves ~140px of real horizontal slack per band (360 - 190 - 28),
// enough for a full-size pointer drag to move within its own band without
// hitting the clamp on every frame.
export const BAND_WIDTH = 360

// Where the bands begin, vertically. It is the origin, and saying so out loud
// earns its place because two things now depend on it.
//
// The whole corpus already lives below this line: 173 exercises author y
// between 40 and 870, and not one negative. And the camera frames the three
// bands rather than just the pieces (band-camera.ts), so on a diagram narrower
// than the bands it zooms out far enough to show a strip of empty canvas above
// this line. Nothing may be born up there: a piece drawn where no band exists
// is a lie about which layer it belongs to, which is the exact thing the bands
// are there to tell. See placement.ts for the measurement.
export const BAND_TOP = 0
const BAND_PADDING = 14
// Matches ForjaNode's `min-w-[168px]` with margin for longer labels, plus a
// little breathing room so a clamped node's right edge never touches the
// band divider.
const NODE_WIDTH = 190

export function bandForType(type: ComponentType): Layer {
  return CATALOG[type].layer
}

export function bandXRange(layer: Layer): { min: number; max: number } {
  const index = BAND_ORDER.indexOf(layer)
  const start = index * BAND_WIDTH
  return { min: start + BAND_PADDING, max: start + BAND_WIDTH - NODE_WIDTH - BAND_PADDING }
}

export interface StorePosition {
  x: number
  y: number
}

export function clampToBand(position: StorePosition, layer: Layer): StorePosition {
  const { min, max } = bandXRange(layer)
  const x = Math.min(Math.max(position.x, min), Math.max(min, max))
  return { x, y: position.y }
}
