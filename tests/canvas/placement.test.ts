// Where a newly created component is born. The measured defect this covers:
// creating a component dropped it straight on top of an existing one in 165
// of 495 real creations across 121 of the 165 playable exercises (swept with
// physical clicks in a real browser) — because the old rule stacked by
// "how many siblings share this band" and never looked at where the nodes
// actually are. Pure geometry, so the guarantee is provable without a DOM.
import { describe, expect, it } from 'vitest'
import { BAND_TOP, bandXRange } from '../../src/lib/forja/canvas/bands'
import {
  DEFAULT_GAP,
  DEFAULT_NODE_SIZE,
  findFreePosition,
  rectsOverlap,
  type PlacementRect,
} from '../../src/lib/forja/canvas/placement'
import type { Layer } from '../../src/lib/forja/engine/types'

const LAYERS: Layer[] = ['business', 'application', 'infrastructure']

function rectAt(position: { x: number; y: number }, size = DEFAULT_NODE_SIZE): PlacementRect {
  return { x: position.x, y: position.y, width: size.width, height: size.height }
}

function separation(a: PlacementRect, b: PlacementRect): number {
  const gapX = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width))
  const gapY = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height))
  return Math.max(gapX, gapY)
}

describe('rectsOverlap', () => {
  it('reports the overlap two rectangles sharing area actually have', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 50, width: 100, height: 100 })).toBe(true)
  })

  it('rectangles that only touch edges do not overlap', () => {
    expect(rectsOverlap({ x: 0, y: 0, width: 100, height: 100 }, { x: 100, y: 0, width: 100, height: 100 })).toBe(false)
  })
})

describe('findFreePosition', () => {
  it('places the first component of a band at the band left edge', () => {
    for (const layer of LAYERS) {
      const position = findFreePosition({ layer, occupied: [] })
      expect(position.x).toBe(bandXRange(layer).min)
    }
  })

  it('never returns an x outside its own band, whatever the caller asks for', () => {
    for (const layer of LAYERS) {
      const { min, max } = bandXRange(layer)
      const far = findFreePosition({ layer, occupied: [], preferred: { x: 5000, y: 0 } })
      const near = findFreePosition({ layer, occupied: [], preferred: { x: -5000, y: 0 } })
      expect(far.x).toBeGreaterThanOrEqual(min)
      expect(far.x).toBeLessThanOrEqual(max)
      expect(near.x).toBeGreaterThanOrEqual(min)
      expect(near.x).toBeLessThanOrEqual(max)
    }
  })

  it('does not drop the new component on the one already sitting in the first slot', () => {
    const taken = rectAt(findFreePosition({ layer: 'application', occupied: [] }))
    const position = findFreePosition({ layer: 'application', occupied: [taken] })

    expect(rectsOverlap(rectAt(position), taken)).toBe(false)
    expect(separation(rectAt(position), taken)).toBeGreaterThanOrEqual(DEFAULT_GAP)
  })

  // The exact level-5 report: a queue (infrastructure band, x from 734) was
  // born at 1242,532 on top of a service measured at 1144,532 — 171x82px of
  // overlap that buried the service's own source handle, and the connection
  // the exercise asked for failed three times in a row with no message.
  it('clears a node whose band is different but whose box still reaches into this one', () => {
    const service: PlacementRect = { x: 660, y: 300, width: 190, height: 82 }
    const position = findFreePosition({ layer: 'infrastructure', occupied: [service] })

    expect(rectsOverlap(rectAt(position), service)).toBe(false)
    expect(separation(rectAt(position), service)).toBeGreaterThanOrEqual(DEFAULT_GAP)
  })

  // Level 6: two nodes ended up 1px apart, and dragging from the handle
  // grabbed the neighbour instead of starting a connection.
  it('leaves real breathing room, never a one-pixel seam', () => {
    const occupied: PlacementRect[] = [
      { x: 380, y: 80, width: 190, height: 82 },
      { x: 380, y: 190, width: 190, height: 82 },
      { x: 380, y: 300, width: 190, height: 82 },
    ]
    const position = findFreePosition({ layer: 'application', occupied })

    for (const rect of occupied) {
      expect(rectsOverlap(rectAt(position), rect)).toBe(false)
      expect(separation(rectAt(position), rect)).toBeGreaterThanOrEqual(DEFAULT_GAP)
    }
  })

  it('finds a hole between two nodes rather than always appending at the bottom', () => {
    const top: PlacementRect = { x: 374, y: 80, width: 190, height: 82 }
    const bottom: PlacementRect = { x: 374, y: 500, width: 190, height: 82 }
    const position = findFreePosition({ layer: 'application', occupied: [top, bottom] })

    expect(position.y).toBeGreaterThan(top.y)
    expect(position.y).toBeLessThan(bottom.y)
  })

  it('falls back below everything in the column when no hole is left, still never on top', () => {
    const occupied: PlacementRect[] = Array.from({ length: 40 }, (_, i) => ({
      x: 740,
      y: 40 + i * 90,
      width: 190,
      height: 82,
    }))
    const position = findFreePosition({
      layer: 'infrastructure',
      occupied,
      viewport: { x: 0, y: 0, width: 1200, height: 600 },
    })

    for (const rect of occupied) expect(rectsOverlap(rectAt(position), rect)).toBe(false)
  })

  // Level 2: a new component landed at screen x=-22 while the canvas started
  // at x=241 — off the visible area entirely, because the placement never
  // knew where the camera was looking.
  it('is born inside the part of the canvas the player is actually looking at', () => {
    const viewport = { x: 600, y: 400, width: 900, height: 500 }
    const position = findFreePosition({ layer: 'infrastructure', occupied: [], viewport })
    const rect = rectAt(position)

    expect(rect.x).toBeGreaterThanOrEqual(viewport.x)
    expect(rect.y).toBeGreaterThanOrEqual(viewport.y)
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.y + viewport.height)
  })

  it('keeps the band rule when the visible area does not reach the band at all', () => {
    const { min, max } = bandXRange('infrastructure')
    const position = findFreePosition({
      layer: 'infrastructure',
      occupied: [],
      viewport: { x: 0, y: 0, width: 300, height: 500 },
    })

    expect(position.x).toBeGreaterThanOrEqual(min)
    expect(position.x).toBeLessThanOrEqual(max)
  })

  it('honours a point the player pointed at when it is free', () => {
    const position = findFreePosition({ layer: 'application', occupied: [], preferred: { x: 400, y: 620 } })

    expect(position).toEqual({ x: 400, y: 620 })
  })

  it('moves off the pointed-at point when a component is already there', () => {
    const there: PlacementRect = { x: 400, y: 620, width: 190, height: 82 }
    const position = findFreePosition({ layer: 'application', occupied: [there], preferred: { x: 400, y: 620 } })

    expect(rectsOverlap(rectAt(position), there)).toBe(false)
  })

  it('measures against the size it is actually given, not a fixed guess', () => {
    const tall: PlacementRect = { x: 740, y: 80, width: 190, height: 300 }
    const position = findFreePosition({
      layer: 'infrastructure',
      occupied: [tall],
      size: { width: 200, height: 120 },
    })

    expect(rectsOverlap({ ...position, width: 200, height: 120 }, tall)).toBe(false)
  })
})

// The camera frames the three bands now, not just the pieces (band-camera.ts),
// so on a diagram narrower than the bands it zooms out far enough to show a
// wide strip of empty canvas ABOVE the bands' own top edge. Measured on a
// production build of `/forja/4/n4-el-pago-que-espera-al-email` at 1440 with
// the objective open: the pane's top edge sat at flow y -323, and two pieces
// created from there were born at y -299, drawn above every band divider, on a
// stretch of canvas where no band exists at all. A piece outside its band is a
// lie about which layer it belongs to, which is the exact thing the bands are
// there to tell.
describe('a piece is born inside the bands, never above them', () => {
  it('starts at the bands’ own top edge when the camera is looking above them', () => {
    const position = findFreePosition({
      layer: 'infrastructure',
      occupied: [],
      viewport: { x: 0, y: -400, width: 1200, height: 1200 },
    })

    expect(position.y).toBeGreaterThanOrEqual(BAND_TOP)
  })

  it('keeps looking downward for a hole rather than upward past the bands', () => {
    const occupied: PlacementRect[] = [{ x: 734, y: 0, width: 190, height: 90 }]
    const position = findFreePosition({
      layer: 'infrastructure',
      occupied,
      viewport: { x: 0, y: -400, width: 1200, height: 1200 },
    })

    expect(position.y).toBeGreaterThanOrEqual(BAND_TOP)
    expect(rectsOverlap(rectAt(position), occupied[0])).toBe(false)
  })

  it('honours a right-click above the bands by placing the piece inside them', () => {
    const position = findFreePosition({
      layer: 'application',
      occupied: [],
      viewport: { x: 0, y: -400, width: 1200, height: 1200 },
      preferred: { x: 445, y: -350 },
    })

    expect(position.y).toBeGreaterThanOrEqual(BAND_TOP)
  })

  // The whole corpus already lives below this line: 173 exercises author y
  // between 40 and 870, and not one negative.
  it('is the same line the corpus already respects', () => {
    expect(BAND_TOP).toBe(0)
  })
})
