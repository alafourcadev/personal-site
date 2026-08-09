// The band names are part of the model the product teaches — negocio,
// aplicación, infraestructura. A band whose name is not on screen is a strip
// of colour with no meaning.
//
// They used to be drawn INSIDE React Flow's transformed layer, at y≈8 of the
// canvas coordinate space, held up by `sticky top-2`. `position: sticky` needs
// a scrolling ancestor and there is none — the pane pans by `transform`, so
// the labels simply travelled with the diagram. That was invisible while every
// starting design was short: once the designs got taller, `fitView` framed the
// content lower and the whole label row left the pane. Measured before this
// module existed, across 15 exercises x 4 widths: 36 of 60 framings had at
// least one band name outside the visible pane, and at 1920px it was all three
// in nearly every exercise.
//
// So the labels stop living in canvas space. This module places them in the
// pane's own screen space: the band's horizontal position still follows the
// viewport (a label sits over its own band), but the vertical position no
// longer can, because it is no longer expressed in canvas coordinates at all.
import { describe, expect, it } from 'vitest'
import {
  BAND_LABEL_FONT_PX,
  BAND_LABEL_GUTTER_PX,
  BAND_LABEL_WIDTH_PX,
  bandLabelFontPx,
  bandLabelPlacements,
  type BandLabelFontPx,
} from '../../src/lib/forja/canvas/band-label-position'
import { BAND_ORDER, BAND_WIDTH } from '../../src/lib/forja/canvas/bands'

const PANE = 900
const BIGGEST: BandLabelFontPx = 12
const SMALLEST: BandLabelFontPx = 10
const WIDEST = BAND_LABEL_WIDTH_PX[BIGGEST].infrastructure

describe('bandLabelPlacements — a band name follows its own band', () => {
  it('places one label per band when the whole diagram fits the pane', () => {
    const placed = bandLabelPlacements({ x: 0, zoom: 0.8 }, 1200)

    expect(placed.map((p) => p.layer)).toEqual(BAND_ORDER)
  })

  it('offsets each label by its band s left edge, scaled by the zoom', () => {
    const [business, application] = bandLabelPlacements({ x: 0, zoom: 0.5 }, 1200)

    expect(business.leftPx).toBe(BAND_LABEL_GUTTER_PX)
    expect(application.leftPx).toBe(BAND_WIDTH * 0.5 + BAND_LABEL_GUTTER_PX)
  })

  it('follows a horizontal pan', () => {
    const panned = bandLabelPlacements({ x: 120, zoom: 1 }, 2000)

    expect(panned[0].leftPx).toBe(120 + BAND_LABEL_GUTTER_PX)
  })
})

describe('bandLabelPlacements — a name is dropped only when its band is', () => {
  it('drops a band panned entirely off the left edge', () => {
    const placed = bandLabelPlacements({ x: -BAND_WIDTH, zoom: 1 }, PANE)

    expect(placed.map((p) => p.layer)).not.toContain('business')
  })

  it('drops a band panned entirely off the right edge', () => {
    const placed = bandLabelPlacements({ x: PANE, zoom: 1 }, PANE)

    expect(placed).toEqual([])
  })

  it('keeps a partially visible band s name, pulled inside the pane', () => {
    // Business starts 100px off the left edge: two thirds of it is on screen.
    const [first] = bandLabelPlacements({ x: -100, zoom: 1 }, PANE)

    expect(first.layer).toBe('business')
    expect(first.leftPx).toBe(BAND_LABEL_GUTTER_PX)
  })

  it('drops a band with too little room left to read its name', () => {
    const paneWidth = 2 * BAND_WIDTH + WIDEST - 1
    const placed = bandLabelPlacements({ x: 0, zoom: 1 }, paneWidth)

    expect(placed.map((p) => p.layer)).toEqual(['business', 'application'])
  })

  it('keeps it as soon as there is exactly enough room', () => {
    const paneWidth = 2 * BAND_WIDTH + WIDEST
    const placed = bandLabelPlacements({ x: 0, zoom: 1 }, paneWidth)

    expect(placed.map((p) => p.layer)).toEqual(BAND_ORDER)
  })

  it('never lets a name overhang its own band s right edge', () => {
    // The last band is half off the right edge: its name has to slide left so
    // it stays over the band it is naming, not over empty pane.
    const paneWidth = 2 * BAND_WIDTH + BAND_WIDTH / 2
    const placed = bandLabelPlacements({ x: 0, zoom: 1 }, paneWidth)
    const last = placed[placed.length - 1]

    expect(last.layer).toBe('infrastructure')
    expect(last.leftPx + WIDEST).toBeLessThanOrEqual(3 * BAND_WIDTH)
  })

  // Measured at 390px after the first version of this module shipped: the last
  // band starts inside the pane and ends outside it, so clamping against the
  // BAND's right edge alone left "Infraestructura" running off the pane. A
  // label has two right edges to respect and the binding one is whichever
  // comes first.
  it('never lets a name overhang the pane, even when its band does', () => {
    const paneWidth = 366

    for (const p of bandLabelPlacements({ x: 0, zoom: 124 / BAND_WIDTH }, paneWidth)) {
      expect(p.leftPx + BAND_LABEL_WIDTH_PX[p.fontPx][p.layer], p.layer).toBeLessThanOrEqual(paneWidth)
    }
  })
})

describe('bandLabelPlacements — each name is judged by its own length', () => {
  // Measured in the production build, in the DOM, with this label's own
  // classes and only its font size changed. A reserve below its own name's
  // width is a promise the layout cannot keep; one global reserve sized on the
  // longest name is the opposite mistake, and it silenced two bands that had
  // room.
  const MEASURED: Record<BandLabelFontPx, Record<(typeof BAND_ORDER)[number], number>> = {
    12: { business: 58.08, application: 76.88, infrastructure: 122.27 },
    11: { business: 53.24, application: 70.47, infrastructure: 112.09 },
    10: { business: 48.4, application: 64.06, infrastructure: 101.89 },
  }

  it('reserves at least what each name actually measures, at every size', () => {
    for (const fontPx of BAND_LABEL_FONT_PX) {
      for (const layer of BAND_ORDER) {
        expect(BAND_LABEL_WIDTH_PX[fontPx][layer], `${layer}@${fontPx}`).toBeGreaterThanOrEqual(
          MEASURED[fontPx][layer],
        )
      }
    }
  })

  it('does not reserve the longest name s width for the shortest name', () => {
    for (const fontPx of BAND_LABEL_FONT_PX) {
      expect(BAND_LABEL_WIDTH_PX[fontPx].business).toBeLessThan(BAND_LABEL_WIDTH_PX[fontPx].application)
      expect(BAND_LABEL_WIDTH_PX[fontPx].application).toBeLessThan(BAND_LABEL_WIDTH_PX[fontPx].infrastructure)
    }
  })

  it('reserves less room at a smaller size, for every name', () => {
    for (const layer of BAND_ORDER) {
      expect(BAND_LABEL_WIDTH_PX[11][layer], layer).toBeLessThan(BAND_LABEL_WIDTH_PX[12][layer])
      expect(BAND_LABEL_WIDTH_PX[10][layer], layer).toBeLessThan(BAND_LABEL_WIDTH_PX[11][layer])
    }
  })
})

// The defect this size step exists for, measured in the production build
// across 24 exercises x 4 widths: 24 of 96 framings drew a band on screen with
// no name on it, and 20 of those were a phone. "Infraestructura" is 122px at
// the label's own size and a phone gives each band 101–124px, so the band
// where the databases and the queues live was the one that lost its name — and
// it is the one a beginner most needs named.
//
// Shortening the word was rejected: the three band names ARE the model the
// product teaches, and the brand rule keeps canonical architectural terms
// intact. What gives is the type size, not the term.
describe('bandLabelFontPx — the row shrinks its type before it drops a name', () => {
  it('uses the largest size while every band has room for its own name', () => {
    expect(bandLabelFontPx({ x: 0, zoom: 1 }, 1200)).toBe(BIGGEST)
  })

  it('steps down one size when the widest name no longer fits a band', () => {
    // 124px bands: the real 390px framing of seven exercises in the sweep.
    expect(bandLabelFontPx({ x: 0, zoom: 124.2 / BAND_WIDTH }, 380)).toBe(11)
  })

  it('steps down to the smallest size for the narrowest phone framings', () => {
    // 116px bands: the framing this defect was first measured in.
    expect(bandLabelFontPx({ x: -11.4, zoom: 0.322 }, 356)).toBe(SMALLEST)
  })

  it('does not shrink when shrinking would not name one more band', () => {
    // 101px bands: too narrow for "Infraestructura" even at 10px, so the row
    // keeps its readable size and that one name is still dropped. Shrinking
    // every label to buy nothing is a loss, not a compromise.
    expect(bandLabelFontPx({ x: 0, zoom: 101.1 / BAND_WIDTH }, 356)).toBe(BIGGEST)
  })

  it('ignores a band that is mostly off the pane when choosing the size', () => {
    // Measured at 1280x720: two full 401px bands and a third one 71% past the
    // pane's right edge. A sliver must not shrink the type on a desktop pane —
    // the player pans, and the band comes back at full size.
    expect(bandLabelFontPx({ x: 0, zoom: 401.3 / BAND_WIDTH }, 2 * 401.3 + 116.6)).toBe(BIGGEST)
  })

  it('never returns a size outside the declared set', () => {
    for (const zoom of [0.05, 0.2, 0.322, 0.5, 1, 2, 4]) {
      for (const paneWidth of [1, 200, 356, 900, 1920]) {
        expect(BAND_LABEL_FONT_PX, `zoom ${zoom} pane ${paneWidth}`).toContain(
          bandLabelFontPx({ x: 0, zoom }, paneWidth),
        )
      }
    }
  })
})

describe('bandLabelPlacements — the phone framing that lost a band name', () => {
  // The exact framing measured on a phone: pane 356px, zoom 0.322, panned
  // 11px left — every band 116px wide on screen. Before this fix, only two of
  // the three bands were named and the infrastructure band was a strip of
  // colour with nothing on it.
  const PHONE = { viewport: { x: -11.4, zoom: 0.322 }, paneWidth: 356 }

  it('names all three bands', () => {
    const placed = bandLabelPlacements(PHONE.viewport, PHONE.paneWidth)

    expect(placed.map((p) => p.layer)).toEqual(BAND_ORDER)
  })

  it('draws the whole row at one size, so it does not read as a rendering bug', () => {
    const sizes = new Set(bandLabelPlacements(PHONE.viewport, PHONE.paneWidth).map((p) => p.fontPx))

    expect([...sizes]).toEqual([SMALLEST])
  })

  it('keeps every name inside the pane at that size', () => {
    for (const p of bandLabelPlacements(PHONE.viewport, PHONE.paneWidth)) {
      expect(p.leftPx + BAND_LABEL_WIDTH_PX[p.fontPx][p.layer], p.layer).toBeLessThanOrEqual(PHONE.paneWidth)
    }
  })

  it('keeps every name over the band it is naming', () => {
    const bandPx = BAND_WIDTH * PHONE.viewport.zoom
    for (const p of bandLabelPlacements(PHONE.viewport, PHONE.paneWidth)) {
      const index = BAND_ORDER.indexOf(p.layer)
      const bandRight = PHONE.viewport.x + (index + 1) * bandPx
      expect(p.leftPx + BAND_LABEL_WIDTH_PX[p.fontPx][p.layer], p.layer).toBeLessThanOrEqual(bandRight + 0.5)
    }
  })
})

describe('bandLabelPlacements — degenerate viewports do not produce NaN', () => {
  it('returns nothing for a pane with no width', () => {
    expect(bandLabelPlacements({ x: 0, zoom: 1 }, 0)).toEqual([])
  })

  it('returns nothing at zero zoom rather than dividing by it', () => {
    expect(bandLabelPlacements({ x: 0, zoom: 0 }, PANE)).toEqual([])
  })

  it('never returns a non-finite or negative offset', () => {
    for (const zoom of [0.1, 0.5, 1, 2, 4]) {
      for (const x of [-2000, -360, 0, 360, 2000]) {
        for (const p of bandLabelPlacements({ x, zoom }, PANE)) {
          expect(Number.isFinite(p.leftPx), `zoom ${zoom} x ${x}`).toBe(true)
          expect(p.leftPx, `zoom ${zoom} x ${x}`).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})
