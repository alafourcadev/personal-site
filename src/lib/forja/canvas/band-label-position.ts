// Where each band's name is drawn, in the pane's own screen space, and at
// what size.
//
// See tests/canvas/band-label-position.test.ts for what went wrong with the
// previous approach (a `sticky top-2` span inside React Flow's transformed
// layer, which has no scrolling ancestor to stick to). The fix is to stop
// expressing the label's position in canvas coordinates at all: the vertical
// position becomes a constant offset from the top of the pane, and only the
// horizontal position still tracks the viewport, so a name stays over the band
// it names while the player pans and zooms.
//
// Pure math, with no DOM and no React Flow, so every framing below is checked
// in Vitest instead of by looking at a screenshot.
import { BAND_ORDER, BAND_WIDTH } from './bands'
import type { Layer } from '../engine/types'

// The label's left inset inside its own band. Matches the `ml-3` the labels
// were drawn with before, kept as a number so the placement math and the
// component share one source.
export const BAND_LABEL_GUTTER_PX = 12

// The sizes this row is allowed to take, largest first.
//
// Why a row that can shrink at all: "Infraestructura" is 122px wide at the
// label's own size and a phone gives each band 101–124px of screen, so the
// third band, the one where the databases and the queues live, was drawn as
// a strip of colour with no name on it. Measured in the production build over
// 24 exercises x 4 widths: 24 of 96 framings had a band on screen without a
// name, 20 of them on a phone.
//
// Why the type gives and not the word: the three band names ARE the model the
// product teaches, and canonical architectural terms are kept intact. An
// abbreviation would trade a term an engineer recognises for jargon. Two steps
// of type size buy back every phone framing in the sweep and cost nothing on a
// desktop, where the row never leaves 12px.
export const BAND_LABEL_FONT_PX = [12, 11, 10] as const
export type BandLabelFontPx = (typeof BAND_LABEL_FONT_PX)[number]

// How much horizontal room each name needs, per band and per size, never one
// number for all three. Measured in the production build, in the DOM, with
// this label's own classes and only its font size changed:
//
//        12px    11px    10px
//   Neg   58.08   53.24   48.40
//   Apl   76.88   70.47   64.06
//   Inf  122.27  112.09  101.89
//
// each rounded up with a few pixels of slack. Per band because the first
// version of this module reserved the longest name's width for every label,
// and on a phone that silenced two bands that had room. A name is dropped when
// its own band cannot hold IT, which is the only condition under which
// dropping it is honest.
export const BAND_LABEL_WIDTH_PX: Record<BandLabelFontPx, Record<Layer, number>> = {
  12: { business: 64, application: 84, infrastructure: 128 },
  11: { business: 59, application: 76, infrastructure: 118 },
  10: { business: 54, application: 70, infrastructure: 107 },
}

// A band has to be at least half on screen before its width is allowed to
// decide the size of the whole row. Measured at 1280x720: two bands 401px wide
// and a third 71% past the pane's right edge. Letting that sliver pull every
// label down to 10px on a 930px pane would be a worse row than the one it
// fixes. A sliver can still be named if it happens to have room; it just does
// not get a vote on the size.
const BAND_VOTES_ON_SIZE_ABOVE = 0.5

export interface BandLabelPlacement {
  layer: Layer
  // Offset from the pane's left edge, in CSS pixels. Never scaled by the
  // zoom: the label is chrome, and chrome that shrinks to 6px at zoom 0.5,
  // which is what the old transformed span did on a phone, is not readable.
  leftPx: number
  // One size for the whole row (see bandLabelFontPx). Carried per placement
  // because that is what the component draws with, not because it varies
  // between the three.
  fontPx: BandLabelFontPx
}

export interface BandViewport {
  x: number
  zoom: number
}

interface BandBox {
  layer: Layer
  left: number
  right: number
  visible: number
}

function bandBoxes({ x, zoom }: BandViewport, paneWidth: number): BandBox[] {
  const bandWidthPx = BAND_WIDTH * zoom
  return BAND_ORDER.map((layer, index) => {
    const left = x + index * bandWidthPx
    const right = left + bandWidthPx
    // How much of this band the player can actually see right now.
    return { layer, left, right, visible: Math.min(right, paneWidth) - Math.max(left, 0) }
  })
}

function nameableCount(boxes: BandBox[], fontPx: BandLabelFontPx): number {
  return boxes.filter((box) => box.visible >= BAND_LABEL_WIDTH_PX[fontPx][box.layer]).length
}

// The one size the whole row is drawn at: the largest that names as many bands
// as any size can.
//
// Two rules, in this order, because they are what a reader would ask for. A
// band on screen should have its name on it, so the size that names the most
// bands wins. Between sizes that name the same number, the largest wins: a
// row shrunk for no gain is just a smaller row.
//
// One size for all three, not one per band: at a phone's framing the three
// names sit ~116px apart, and two of them at 12px next to one at 10px reads as
// a rendering fault rather than as a decision.
export function bandLabelFontPx(viewport: BandViewport, paneWidth: number): BandLabelFontPx {
  const boxes = bandLabelVoters(viewport, paneWidth)
  let best: BandLabelFontPx = BAND_LABEL_FONT_PX[0]
  let bestCount = nameableCount(boxes, best)
  for (const fontPx of BAND_LABEL_FONT_PX) {
    const count = nameableCount(boxes, fontPx)
    if (count > bestCount) {
      best = fontPx
      bestCount = count
    }
  }
  return best
}

function bandLabelVoters(viewport: BandViewport, paneWidth: number): BandBox[] {
  const bandWidthPx = BAND_WIDTH * viewport.zoom
  return bandBoxes(viewport, paneWidth).filter(
    (box) => box.visible >= bandWidthPx * BAND_VOTES_ON_SIZE_ABOVE,
  )
}

export function bandLabelPlacements(viewport: BandViewport, paneWidth: number): BandLabelPlacement[] {
  const { zoom } = viewport
  if (!(zoom > 0) || !(paneWidth > 0) || !Number.isFinite(viewport.x)) return []

  const fontPx = bandLabelFontPx(viewport, paneWidth)
  const placements: BandLabelPlacement[] = []

  for (const { layer, left, right, visible } of bandBoxes(viewport, paneWidth)) {
    // Below its own name's width the name would be clipped mid-word, which
    // reads as a rendering bug rather than as information.
    const width = BAND_LABEL_WIDTH_PX[fontPx][layer]
    if (visible < width) continue

    // Pull the name inside the pane when the band starts off the left edge,
    // and push it back left when a right edge is close. There are two right
    // edges and the binding one is whichever comes first: the band's, so a
    // name is never drawn over its neighbour, and the pane's, so a band that
    // runs off screen does not take its own name with it.
    // The visibility check above guarantees this limit is never below
    // `max(left, 0)`, so the result stays inside the band it names and is
    // never negative.
    const pulledIn = Math.max(left, 0) + BAND_LABEL_GUTTER_PX
    const rightLimit = Math.min(right, paneWidth) - width
    placements.push({ layer, leftPx: Math.min(pulledIn, rightLimit), fontPx })
  }

  return placements
}
