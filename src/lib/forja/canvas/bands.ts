// Band containment [design note "Band mapping", PC7's surrounding design].
// Pure math, no DOM, no React Flow — deliberately NOT React Flow's
// `extent: 'parent'` + `parentId`. Verified by reading @xyflow/system's own
// NodeBase type (`extent?: 'parent' | CoordinateExtent | null`) and
// @xyflow/react's index.js, which calls `evaluateAbsolutePosition(node
// .position, ...)` specifically because a node's `position` becomes
// PARENT-RELATIVE once `parentId` is set. Adopting it would have forced a
// coordinate-space translation layer across the store, the projection
// (project.ts) and the drag-commit path — breaking design D1's "position is
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
export const BAND_WIDTH = 320
const BAND_PADDING = 16
// Matches ForjaNode's `min-w-[168px]` plus a little breathing room so a
// clamped node's right edge never touches the band divider.
const NODE_WIDTH = 200

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
