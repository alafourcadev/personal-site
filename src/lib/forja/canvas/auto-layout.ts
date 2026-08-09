// "Ordenar el diagrama": where every piece goes when the player asks for the
// diagram to be tidied. The owner asked for it in these words: "veo que no
// existe un botón en el lienzo que al darle organice las flechas y cuadros
// bien organizaditos".
//
// WHY THIS IS A SAFE OPERATION. `position` is declared on `DesignNode` and read
// by nothing under `src/lib/forja/engine/`: grep the folder and `types.ts` is
// the only hit, and it is the declaration itself. So moving every piece on the
// canvas cannot move a single point of a score, and a feature that sounds
// risky has the blast radius of a colour swatch. The regression guard for that
// claim is the same one PC16's colours already have.
//
// WHY IT IS NOT A GENERAL GRAPH LAYOUT. The columns are given. A piece's band
// is a fixed property of its type and each band owns a range of x (bands.ts),
// so the layers of a layered drawing are already assigned and no heuristic gets
// to choose them. What is left is exactly the second half of a classic layered
// layout: the order INSIDE each layer, which is what decides how many cables
// cross, and the vertical position that order produces.
//
// The ordering is the median heuristic, swept down the bands and back up. It is
// the textbook answer to this exact shape and there is no reason to invent
// another one for three layers of at most eight pieces.
//
// WHY PRESSING IT TWICE IS PROVABLY A NO-OP. The order is computed from the
// graph alone: the design's own node order, the types, and the edges. It never
// reads a position. Arranging does not change any of those three, so arranging
// an arranged diagram computes the identical answer by construction, rather
// than by a sweep happening to reach a fixed point. That is what keeps the
// second press from feeling broken.
import { BAND_ORDER, BAND_WIDTH, bandForType, bandXRange, type StorePosition } from './bands'
import { DEFAULT_GAP, DEFAULT_NODE_SIZE, DEFAULT_TOP } from './placement'
import type { Design, DesignNode, Layer } from '../engine/types'

// Where a band's column sits inside the band, counted from the band's own left
// edge. It is not a new number: the whole corpus uses exactly three x values
// across its 169 files, 85, 445 and 805, which is this offset in each of the
// three bands. Two reasons to keep it rather than to hug the band's left edge.
//
// It is what the authored diagrams look like, so an arranged diagram and a
// handed one are the same drawing. And the band NAMES are drawn at the band's
// own left edge in the pane's screen space (BandLane.tsx), so a column at the
// edge puts the first piece of every band on top of that band's name. Measured
// on `/forja/8/n8-el-grupo-hotelero-que-freno-la-cola-de-todos` at 1440: with
// the column at the edge, "NEGOCIO" and "INFRAESTRUCTURA" both read as a single
// letter beside a node card.
export const BAND_COLUMN_OFFSET = 85

// One row of pieces, with the same air between them that a newly created piece
// already keeps from its neighbours (placement.ts): a node's handles sit ON its
// edges, so two boxes that merely fail to overlap can still bury one handle
// under the other box.
export const LAYOUT_ROW_STEP = DEFAULT_NODE_SIZE.height + DEFAULT_GAP

// How many times the sweep runs. Two full passes, down the bands and back up,
// is where three layers stop improving; more passes are the same answer at
// more cost, and a fixed count is what keeps the result a pure function of the
// graph rather than of a convergence test.
const SWEEPS = 2

type Order = Record<Layer, string[]>

function bandsOf(design: Design): Order {
  const order = { business: [], application: [], infrastructure: [] } as Order
  for (const node of design.nodes) order[bandForType(node.type)].push(node.id)
  return order
}

// Every piece a piece is wired to, in either direction. Direction is a property
// of the design, not of the drawing: a cable that runs backwards still crosses
// the ones beside it.
function neighboursOf(design: Design): Map<string, string[]> {
  const map = new Map<string, string[]>()
  const add = (from: string, to: string) => map.set(from, [...(map.get(from) ?? []), to])
  for (const edge of design.edges) {
    add(edge.from.node, edge.to.node)
    add(edge.to.node, edge.from.node)
  }
  return map
}

function median(values: number[]): number {
  const middle = Math.floor(values.length / 2)
  if (values.length % 2 === 1) return values[middle]
  return (values[middle - 1] + values[middle]) / 2
}

// One half-sweep: `fixed` stays where it is, `moving` is reordered so each of
// its pieces sits near the median of whatever it is wired to.
//
// A piece wired to nothing in `fixed` has no median and therefore no opinion,
// so it keeps the slot it already had and the pieces that DO have an opinion
// are dealt into the remaining slots. That is the textbook treatment, and it is
// what stops a piece nobody connected from being swept to the bottom of its
// band for no reason a player could name.
function orderByMedian(fixed: string[], moving: string[], neighbours: Map<string, string[]>): string[] {
  const rank = new Map(fixed.map((id, index) => [id, index]))
  const measured: { id: string; slot: number; median: number }[] = []
  moving.forEach((id, slot) => {
    const ranks = (neighbours.get(id) ?? [])
      .map((other) => rank.get(other))
      .filter((value): value is number => value !== undefined)
      .sort((a, b) => a - b)
    if (ranks.length > 0) measured.push({ id, slot, median: median(ranks) })
  })
  // Stable on the slot the piece already held, so two pieces with the same
  // median never swap for a reason nobody can see.
  const sorted = [...measured].sort((a, b) => a.median - b.median || a.slot - b.slot)
  const result = [...moving]
  measured.forEach((entry, index) => {
    result[entry.slot] = sorted[index].id
  })
  return result
}

function sweep(order: Order, neighbours: Map<string, string[]>): Order {
  const next: Order = { ...order }
  for (let pass = 0; pass < SWEEPS; pass++) {
    for (let i = 1; i < BAND_ORDER.length; i++) {
      next[BAND_ORDER[i]] = orderByMedian(next[BAND_ORDER[i - 1]], next[BAND_ORDER[i]], neighbours)
    }
    for (let i = BAND_ORDER.length - 2; i >= 0; i--) {
      next[BAND_ORDER[i]] = orderByMedian(next[BAND_ORDER[i + 1]], next[BAND_ORDER[i]], neighbours)
    }
  }
  return next
}

// The band's column, clamped into the band the same way every other movement
// is: the offset is the corpus's own, and the clamp is what makes that a
// preference rather than a promise nobody checks.
export function bandColumnX(band: Layer): number {
  const { min, max } = bandXRange(band)
  return Math.min(Math.max(BAND_ORDER.indexOf(band) * BAND_WIDTH + BAND_COLUMN_OFFSET, min), Math.max(min, max))
}

// Where every piece goes. One column per band, and one row per piece down it.
export function arrangedPositions(design: Design): Record<string, StorePosition> {
  const ordered = sweep(bandsOf(design), neighboursOf(design))
  const positions: Record<string, StorePosition> = {}
  for (const band of BAND_ORDER) {
    const x = bandColumnX(band)
    ordered[band].forEach((id, row) => {
      positions[id] = { x, y: DEFAULT_TOP + row * LAYOUT_ROW_STEP }
    })
  }
  return positions
}

// How many cables cross, read off the drawing the player is actually looking at.
//
// The count is the standard two-layer one: two cables between the same pair of
// bands cross when their ends are in opposite order. A cable between two pieces
// of the SAME band is not a layered edge and is not counted, and a cable that
// skips a band is counted against the pair it really joins. This is the number
// that says whether arranging improved anything, so it is measured rather than
// asserted.
export function countCrossings(design: Design): number {
  const rank = rankByDrawnOrder(design)
  const bandOf = new Map(design.nodes.map((node) => [node.id, bandForType(node.type)]))
  const layered = design.edges
    .map((edge) => {
      const from = bandOf.get(edge.from.node)
      const to = bandOf.get(edge.to.node)
      if (!from || !to || from === to) return null
      // Oriented so both ends of every comparison are read the same way round.
      const flipped = BAND_ORDER.indexOf(from) > BAND_ORDER.indexOf(to)
      return {
        pair: flipped ? `${to}>${from}` : `${from}>${to}`,
        upper: rank.get(flipped ? edge.to.node : edge.from.node) ?? 0,
        lower: rank.get(flipped ? edge.from.node : edge.to.node) ?? 0,
      }
    })
    .filter((entry): entry is { pair: string; upper: number; lower: number } => entry !== null)

  let crossings = 0
  for (let i = 0; i < layered.length; i++) {
    for (let j = i + 1; j < layered.length; j++) {
      if (layered[i].pair !== layered[j].pair) continue
      if ((layered[i].upper - layered[j].upper) * (layered[i].lower - layered[j].lower) < 0) crossings++
    }
  }
  return crossings
}

// The order the player reads inside each band: top to bottom, then left to
// right, then by id so the answer never depends on the order the array happens
// to be in. A piece with no position yet is read as being at the top, which is
// where the canvas draws it.
function rankByDrawnOrder(design: Design): Map<string, number> {
  const rank = new Map<string, number>()
  for (const band of BAND_ORDER) {
    design.nodes
      .filter((node) => bandForType(node.type) === band)
      .sort(byDrawnPosition)
      .forEach((node, index) => rank.set(node.id, index))
  }
  return rank
}

function byDrawnPosition(a: DesignNode, b: DesignNode): number {
  const ay = a.position?.y ?? 0
  const by = b.position?.y ?? 0
  if (ay !== by) return ay - by
  const ax = a.position?.x ?? 0
  const bx = b.position?.x ?? 0
  if (ax !== bx) return ax - bx
  return a.id.localeCompare(b.id)
}
