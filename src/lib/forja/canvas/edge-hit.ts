// A connection has to be reachable with the pointer. Measured across every
// playable exercise with real hit tests (getPointAtLength + getScreenCTM,
// then document.elementFromPoint on the resulting screen point): 73 of 964
// connections could NOT be selected by clicking their own midpoint, in 45
// of the 165 exercises. Three distinct causes, one shape of fix:
//
//   - 16 connections measure under 20px end to end (three of them 0 or 1px),
//     so there is barely a stroke to aim at;
//   - a node painted over the stroke eats the click, because React Flow's
//     node layer is rendered after the edge layer inside the same viewport;
//   - two midpoints 16px apart resolve to whichever stroke paints last, so
//     the player selects one connection and deletes another.
//
// The answer is a fixed-size target pinned to each connection's own
// midpoint, rendered in React Flow's `ViewportPortal` (the only layer that
// comes AFTER the node renderer, so it is never buried), kept the same size
// on screen at every zoom. This module is the geometry; EdgeHitTargets.tsx
// is the rendering.

// WCAG 2.2 §2.5.8 asks for 24x24 CSS px minimum. 24 is also small enough
// that two targets 16px apart never swallow each other's centre.
export const EDGE_HIT_TARGET_PX = 24
// Guards against React Flow reporting a transient zoom of 0 while it
// measures: dividing by it would produce an infinitely large box that
// covers the whole canvas and eats every click.
const MIN_ZOOM = 0.01

export interface HitTargetStyle {
  left: number
  top: number
  width: number
  height: number
  transform: string
}

// The portal lives INSIDE the transformed viewport, so its coordinates are
// flow coordinates and its children scale with the camera. Dividing the
// size by the zoom is what cancels that scaling out, leaving a target the
// same number of real screen pixels at every zoom level.
export function edgeHitTargetStyle(point: { x: number; y: number }, zoom: number): HitTargetStyle {
  const size = EDGE_HIT_TARGET_PX / Math.max(zoom, MIN_ZOOM)
  return {
    left: point.x,
    top: point.y,
    width: size,
    height: size,
    transform: 'translate(-50%, -50%)',
  }
}

export interface HitTarget {
  id: string
  x: number
  y: number
}

// Where along its own connection a target may sit. The midpoint first,
// because that is where a player looks for the middle of a line; the rest
// are fallbacks for the case two connections have their midpoint in the
// same place. Kept well away from the ends, where the target would sit on
// a node's own connection handle and steal the drag gesture from it.
const FRACTION_CANDIDATES = [0.5, 0.38, 0.62, 0.28, 0.72, 0.18, 0.82]

// Two targets in the same spot are not a hit-testing problem, they are a
// placement problem: measured after the midpoint targets shipped, 7 of 983
// connections still resolved to a neighbour, every one of them a pair whose
// midpoints coincided. This slides a target along its OWN connection until
// it clears the ones already placed. It never invents a point off the
// line, so the target always still points at its own connection.
export function pickHitPoint(
  sampleAt: (fraction: number) => { x: number; y: number },
  placed: readonly { x: number; y: number }[],
  minDistance: number,
): { x: number; y: number } {
  let best: { point: { x: number; y: number }; clearance: number } | null = null
  for (const fraction of FRACTION_CANDIDATES) {
    const point = sampleAt(fraction)
    const clearance = placed.reduce(
      (worst, other) => Math.min(worst, Math.hypot(point.x - other.x, point.y - other.y)),
      Number.POSITIVE_INFINITY,
    )
    if (clearance >= minDistance) return point
    if (!best || clearance > best.clearance) best = { point, clearance }
  }
  // Every option is crowded (a very short connection, or a genuinely
  // degenerate one): take the roomiest rather than refusing to place a
  // target at all: a crowded target is still reachable, an absent one is
  // the defect this whole module exists for.
  return best!.point
}

// Which connection a click at this point belongs to. Distance to the centre
// decides, never paint order, which is what made the level-9 player delete
// a connection they had not clicked. Anything further away than the target's
// own radius belongs to nobody.
export function resolveHitTarget(
  targets: readonly HitTarget[],
  point: { x: number; y: number },
  radius = EDGE_HIT_TARGET_PX / 2,
): string | null {
  let best: { id: string; distance: number } | null = null
  for (const target of targets) {
    const distance = Math.hypot(target.x - point.x, target.y - point.y)
    if (distance > radius) continue
    if (!best || distance < best.distance) best = { id: target.id, distance }
  }
  return best?.id ?? null
}

// Which connection a press on a hit target REALLY belongs to.
//
// The boxes are 24px wide and only kept 24px apart, so any two of them that
// share an edge of that gap overlap, and the browser's own hit test resolves
// an overlap by paint order: the connection created last wins every point it
// covers, including the exact centre of the one created first. Measured by
// playing rather than by reading: 59.7% mean accuracy over 19 points per
// path, the two worst at 42%, and one Delete that removed a connection the
// player had not clicked.
//
// So the press names the box it landed on and this decides who owns it,
// which is what resolveHitTarget was written for. `pressedId` is the answer
// when no centre is within reach: the press happened on a real target, and
// "nobody" is not something the player can be told.
//
// The points are flow units and EDGE_HIT_TARGET_PX is screen pixels, so the
// reach is divided by the same zoom the box itself is.
export function ownerOfPointer(
  targets: readonly HitTarget[],
  flowPoint: { x: number; y: number },
  zoom: number,
  pressedId: string,
): string {
  const radius = EDGE_HIT_TARGET_PX / Math.max(zoom, MIN_ZOOM) / 2
  return resolveHitTarget(targets, flowPoint, radius) ?? pressedId
}
