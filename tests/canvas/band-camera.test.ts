// The camera may not hide a band division. The owner asked for it in these
// words: "veo que el lienzo se expande hasta que no se ven las divisiones, me
// gustaría que tuviera un tamaño que no deje que se escondan".
//
// Measured on a production build of
// `/forja/1/n1-el-comprobante-que-no-se-guarda` at 1133 with the statement
// open, before this module existed: four presses of React Flow's own zoom-in
// control settled on zoom 1.653 with the three band dividers at 43, 638 and
// 1233 inside an 833px pane, so the third one was 400px outside it. On
// `/forja/1/n1-el-taller-que-todavia-anota-en-papel`, which opens blank, the
// camera sat at zoom 1 and pan 0 with the dividers at 360, 720 and 1080, so
// the third was outside the pane on arrival, with nothing the player had done.
//
// Pure geometry, no DOM and no React Flow import, so the guarantee is provable
// here rather than only in a browser.
import { describe, expect, it } from 'vitest'
import { BAND_ORDER, BAND_WIDTH } from '../../src/lib/forja/canvas/bands'
import { DEFAULT_GAP, DEFAULT_NODE_SIZE } from '../../src/lib/forja/canvas/placement'
import {
  BANDS_TOTAL_WIDTH,
  BAND_TRANSLATE_EXTENT,
  EMPTY_CANVAS_DEPTH,
  bandFramingBounds,
  bandMaxZoom,
  bandsFitInside,
} from '../../src/lib/forja/canvas/band-camera'

const MIN_ZOOM = 0.2

describe('the width the three bands really occupy', () => {
  it('is the three of them side by side', () => {
    expect(BANDS_TOTAL_WIDTH).toBe(BAND_ORDER.length * BAND_WIDTH)
  })
})

describe('what the camera frames', () => {
  it('spans the three bands when the diagram is narrower than they are', () => {
    const bounds = bandFramingBounds({ x: 14, y: 80, width: 900, height: 500 })
    expect(bounds.x).toBe(0)
    expect(bounds.x + bounds.width).toBe(BANDS_TOTAL_WIDTH)
  })

  it('keeps the diagram’s own vertical range, which the bands say nothing about', () => {
    const bounds = bandFramingBounds({ x: 14, y: 80, width: 900, height: 500 })
    expect(bounds.y).toBe(80)
    expect(bounds.height).toBe(500)
  })

  it('grows past the bands rather than cropping a piece that ended up outside them', () => {
    const bounds = bandFramingBounds({ x: -120, y: 0, width: BANDS_TOTAL_WIDTH + 400, height: 300 })
    expect(bounds.x).toBe(-120)
    expect(bounds.x + bounds.width).toBe(BANDS_TOTAL_WIDTH + 280)
  })

  // The blank canvas of a `greenfield` exercise. There are no pieces to frame,
  // so the bands are the only thing on screen and they are what the camera
  // opens on.
  it('spans the three bands when there is no diagram at all', () => {
    const bounds = bandFramingBounds(null)
    expect(bounds.x).toBe(0)
    expect(bounds.width).toBe(BANDS_TOTAL_WIDTH)
  })

  it('opens a blank canvas on the depth its first pieces are born into', () => {
    const bounds = bandFramingBounds(null)
    expect(bounds.y).toBe(0)
    expect(bounds.height).toBe(EMPTY_CANVAS_DEPTH)
  })

  it('measures that depth in real rows of real pieces', () => {
    expect(EMPTY_CANVAS_DEPTH % (DEFAULT_NODE_SIZE.height + DEFAULT_GAP)).toBeLessThan(
      DEFAULT_NODE_SIZE.height + DEFAULT_GAP,
    )
    expect(EMPTY_CANVAS_DEPTH).toBeGreaterThan(DEFAULT_NODE_SIZE.height + DEFAULT_GAP)
  })
})

describe('how far in the camera may zoom', () => {
  // The whole rule in one number: at its tightest, the pane still shows every
  // flow unit the three bands occupy.
  it('stops exactly where the three bands fill the pane', () => {
    expect(bandMaxZoom(1140, MIN_ZOOM)).toBeCloseTo(1140 / BANDS_TOTAL_WIDTH, 10)
  })

  it('leaves the bands inside the pane at that zoom and at every zoom below it', () => {
    for (const paneWidth of [833, 1140, 1416, 1512]) {
      const max = bandMaxZoom(paneWidth, MIN_ZOOM)
      expect(bandsFitInside(paneWidth, max)).toBe(true)
      expect(bandsFitInside(paneWidth, max / 2)).toBe(true)
    }
  })

  it('lets the bands escape as soon as the camera goes past it', () => {
    expect(bandsFitInside(1140, bandMaxZoom(1140, MIN_ZOOM) * 1.01)).toBe(false)
  })

  // A pane narrower than the floor allows would otherwise ask for a maximum
  // below the minimum, which is not a zoom range at all.
  it('never asks for a maximum under the floor the camera already has', () => {
    expect(bandMaxZoom(100, MIN_ZOOM)).toBe(MIN_ZOOM)
  })

  // Before the pane has been measured there is no width to promise anything
  // about, and the safe answer is the floor: it can only show more of the
  // bands, never less.
  it('answers the floor while the pane has no measured width yet', () => {
    expect(bandMaxZoom(0, MIN_ZOOM)).toBe(MIN_ZOOM)
  })
})

describe('how far the camera may be dragged', () => {
  it('pins the horizontal to the strip the three bands occupy', () => {
    expect(BAND_TRANSLATE_EXTENT[0][0]).toBe(0)
    expect(BAND_TRANSLATE_EXTENT[1][0]).toBe(BANDS_TOTAL_WIDTH)
  })

  // The bands are 4000 units tall and a diagram grows downwards. Nothing about
  // the owner's rule is vertical, so nothing vertical is taken away.
  it('leaves the vertical exactly as free as it was', () => {
    expect(BAND_TRANSLATE_EXTENT[0][1]).toBe(Number.NEGATIVE_INFINITY)
    expect(BAND_TRANSLATE_EXTENT[1][1]).toBe(Number.POSITIVE_INFINITY)
  })
})
