// A connection has to be selectable with the pointer even when it measures
// 6 screen pixels end to end, even when another connection's midpoint is
// 16px away, and even when a node is painted on top of its stroke. The
// answer is a fixed-size hit target at the connection's own midpoint,
// rendered above the nodes — this is the geometry that keeps it a constant
// size on screen no matter the zoom, and far enough from its neighbours to
// stay unambiguous.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  EDGE_HIT_TARGET_PX,
  edgeHitTargetStyle,
  ownerOfPointer,
  pickHitPoint,
  resolveHitTarget,
} from '../../src/lib/forja/canvas/edge-hit'

describe('edgeHitTargetStyle', () => {
  it('sits exactly on the point it is given', () => {
    const style = edgeHitTargetStyle({ x: 320, y: 128 }, 1)

    expect(style.left).toBe(320)
    expect(style.top).toBe(128)
  })

  it('keeps the same size on screen whatever the zoom is', () => {
    for (const zoom of [0.25, 0.5, 1, 1.4, 2]) {
      const style = edgeHitTargetStyle({ x: 0, y: 0 }, zoom)
      expect(style.width * zoom).toBeCloseTo(EDGE_HIT_TARGET_PX, 5)
      expect(style.height * zoom).toBeCloseTo(EDGE_HIT_TARGET_PX, 5)
    }
  })

  it('is centred on its point, never hanging off it', () => {
    expect(edgeHitTargetStyle({ x: 10, y: 10 }, 1).transform).toContain('translate(-50%, -50%)')
  })

  it('survives a zoom of zero without producing an infinite box', () => {
    const style = edgeHitTargetStyle({ x: 0, y: 0 }, 0)

    expect(Number.isFinite(style.width)).toBe(true)
    expect(style.width).toBeGreaterThan(0)
  })

  it('is big enough to be a real pointer target', () => {
    // WCAG 2.2 §2.5.8 minimum target size.
    expect(EDGE_HIT_TARGET_PX).toBeGreaterThanOrEqual(24)
  })
})

describe('resolveHitTarget', () => {
  // Level 9: two midpoints 16px apart; the player clicked one and the other
  // got selected, then Delete removed the wrong connection.
  it('picks the target whose centre is closest to the click, not whichever paints last', () => {
    const targets = [
      { id: 'a', x: 500, y: 300 },
      { id: 'b', x: 516, y: 300 },
    ]

    expect(resolveHitTarget(targets, { x: 500, y: 300 })).toBe('a')
    expect(resolveHitTarget(targets, { x: 516, y: 300 })).toBe('b')
  })

  it('ignores a click further away than the target itself', () => {
    const targets = [{ id: 'a', x: 500, y: 300 }]

    expect(resolveHitTarget(targets, { x: 900, y: 300 })).toBeNull()
  })

  it('has nothing to resolve when there are no connections', () => {
    expect(resolveHitTarget([], { x: 0, y: 0 })).toBeNull()
  })
})

// `resolveHitTarget` was written for exactly this and nothing called it: the
// renderer painted one box per connection and let the browser's own hit test
// decide, which resolves by paint order. Measured by playing: aiming at the
// middle of one cable and pressing Delete removed a different connection —
// 59.7% mean accuracy over 19 points per path, the two worst paths at 42%.
// At a target's exact centre the topmost element was another connection's
// box, because two 24px boxes overlap whenever their centres are closer than
// 24px and the later one wins.
describe('ownerOfPointer', () => {
  const targets = [
    { id: 'a', x: 500, y: 300 },
    { id: 'b', x: 516, y: 300 },
  ]

  it('keeps the connection the player pressed when that one is the nearest', () => {
    expect(ownerOfPointer(targets, { x: 500, y: 300 }, 1, 'a')).toBe('a')
  })

  it('hands the press to the nearer connection when the pressed box only won by paint order', () => {
    expect(ownerOfPointer(targets, { x: 500, y: 300 }, 1, 'b')).toBe('a')
  })

  // The press already happened on a real box, so "nobody owns this point" is
  // not an answer the player can be given: at the rim of a lone target the
  // press still belongs to the connection it landed on.
  it('falls back to the pressed connection when the press is outside every centre’s reach', () => {
    expect(ownerOfPointer([{ id: 'a', x: 500, y: 300 }], { x: 700, y: 300 }, 1, 'a')).toBe('a')
  })

  // The points are flow units and the box is 24 SCREEN px, so the reach has
  // to be divided by the same zoom the box is. 18 flow units from a centre is
  // inside the box at zoom 0.25 and well outside it at zoom 2, and the answer
  // has to change with it.
  it('measures reach in flow units, so zooming out widens it and zooming in narrows it', () => {
    const spread = [
      { id: 'a', x: 500, y: 300 },
      { id: 'b', x: 540, y: 300 },
    ]

    expect(ownerOfPointer(spread, { x: 518, y: 300 }, 0.25, 'b')).toBe('a')
    expect(ownerOfPointer(spread, { x: 518, y: 300 }, 2, 'b')).toBe('b')
  })

  it('survives a zoom of zero instead of claiming every connection at once', () => {
    expect(ownerOfPointer(targets, { x: 500, y: 300 }, 0, 'b')).toBe('a')
  })
})

describe('pickHitPoint', () => {
  // Measured after the midpoint targets shipped: 7 of 983 connections still
  // resolved to a neighbour, all of them pairs whose midpoints land on the
  // same spot (n2's inscripciones->inscripcionesdb and informes->notasdb
  // both had their midpoint at 946,598). Two targets in the same place are
  // not a hit-testing problem, they are a placement problem.
  const straightPath = (from: { x: number; y: number }, to: { x: number; y: number }) => (fraction: number) => ({
    x: from.x + (to.x - from.x) * fraction,
    y: from.y + (to.y - from.y) * fraction,
  })

  it('uses the true midpoint when nothing else is there', () => {
    const sample = straightPath({ x: 0, y: 0 }, { x: 400, y: 0 })

    expect(pickHitPoint(sample, [], 24)).toEqual({ x: 200, y: 0 })
  })

  it('slides along its own connection when another target already owns that spot', () => {
    const sample = straightPath({ x: 0, y: 0 }, { x: 400, y: 0 })
    const point = pickHitPoint(sample, [{ x: 200, y: 0 }], 24)

    expect(Math.hypot(point.x - 200, point.y - 0)).toBeGreaterThanOrEqual(24)
  })

  it('stays on its own connection, never on an invented point', () => {
    const sample = straightPath({ x: 0, y: 100 }, { x: 400, y: 100 })
    const point = pickHitPoint(sample, [{ x: 200, y: 100 }], 24)

    expect(point.y).toBe(100)
    expect(point.x).toBeGreaterThanOrEqual(0)
    expect(point.x).toBeLessThanOrEqual(400)
  })

  it('gives up gracefully on a connection with no length at all', () => {
    const sample = () => ({ x: 50, y: 50 })

    expect(pickHitPoint(sample, [{ x: 50, y: 50 }], 24)).toEqual({ x: 50, y: 50 })
  })

  it('picks the least-crowded spot when every option is crowded', () => {
    const sample = straightPath({ x: 0, y: 0 }, { x: 20, y: 0 })
    const point = pickHitPoint(sample, [{ x: 0, y: 0 }], 24)

    // The far end of a 20px connection is the best it can do — and it takes it.
    expect(point.x).toBeGreaterThan(10)
  })
})

// The arbitration above is only worth anything if the renderer asks for it.
// It did not: `resolveHitTarget` shipped with a test and no caller, and the
// one file that imported it was this one. That is the whole defect, so it is
// asserted against the renderer's source rather than left to prose.
describe('the renderer', () => {
  const source = readFileSync(
    new URL('../../src/components/forja/canvas/EdgeHitTargets.tsx', import.meta.url),
    'utf8',
  )

  it('decides which connection a press belongs to instead of trusting paint order', () => {
    expect(source).toContain('ownerOfPointer')
  })
})
