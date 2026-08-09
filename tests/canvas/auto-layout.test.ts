// "Ordenar el diagrama": the button the owner asked for, in these words: "veo
// que no existe un botón en el lienzo que al darle organice las flechas y
// cuadros bien organizaditos".
//
// WHAT MAKES IT SAFE. `position` is declared on `DesignNode` and read by
// nothing under `src/lib/forja/engine/` (grep it: `types.ts` is the only hit,
// and it is the declaration itself). Moving a piece cannot move a score, so
// this is a presentation operation with the blast radius of a colour swatch.
//
// WHAT MAKES IT INTERESTING. The columns are not ours to choose. A piece's
// band is a fixed property of its type and each band owns a range of x
// (bands.ts), so the layers of a layered drawing are already assigned. What is
// left is the order INSIDE each band, which is the classic crossing
// minimisation half of a layered layout, and the vertical position that order
// produces.
//
// WHY IT CANNOT DRIFT. The order is computed from the graph alone: the design's
// own node order, the types, and the edges. It never reads a position. So
// arranging an arranged diagram computes the identical answer by construction,
// rather than by a sweep happening to converge, and pressing the button twice
// is provably a no-op.
import { describe, expect, it } from 'vitest'
import { BAND_ORDER, bandForType, bandXRange } from '../../src/lib/forja/canvas/bands'
import { DEFAULT_GAP, DEFAULT_NODE_SIZE, DEFAULT_TOP } from '../../src/lib/forja/canvas/placement'
import { BAND_COLUMN_OFFSET, arrangedPositions, bandColumnX, countCrossings } from '../../src/lib/forja/canvas/auto-layout'
import type { ComponentType, Design, DesignNode } from '../../src/lib/forja/engine/types'
import { CATALOG } from '../../src/lib/forja/engine/catalog'

function node(id: string, type: ComponentType, y: number): DesignNode {
  const entry = CATALOG[type]
  return {
    id,
    type,
    label: id,
    zone: entry.zone,
    props: { ...entry.props },
    position: { x: bandXRange(entry.layer).min, y },
  }
}

function edge(id: string, from: string, to: string) {
  return { id, from: { node: from }, to: { node: to } }
}

// The ugly case, built by hand: three pieces per band, wired so that every
// pair of cables between two bands crosses. Six crossings, and none of them an
// accident.
function tangledDesign(): Design {
  return {
    nodes: [
      node('a1', 'actor', 80),
      node('a2', 'business-process', 194),
      node('a3', 'approver', 308),
      node('s1', 'service', 80),
      node('s2', 'worker', 194),
      node('s3', 'api-gateway', 308),
      node('d1', 'database', 80),
      node('d2', 'cache', 194),
      node('d3', 'queue', 308),
    ],
    edges: [
      edge('e1', 'a1', 's3'),
      edge('e2', 'a2', 's2'),
      edge('e3', 'a3', 's1'),
      edge('e4', 's1', 'd3'),
      edge('e5', 's2', 'd2'),
      edge('e6', 's3', 'd1'),
    ],
  }
}

function applied(design: Design): Design {
  const positions = arrangedPositions(design)
  return { ...design, nodes: design.nodes.map((n) => ({ ...n, position: positions[n.id] ?? n.position })) }
}

describe('counting the cables that cross', () => {
  it('counts nothing when two cables run parallel', () => {
    const design: Design = {
      nodes: [node('a1', 'actor', 80), node('a2', 'approver', 194), node('s1', 'service', 80), node('s2', 'worker', 194)],
      edges: [edge('e1', 'a1', 's1'), edge('e2', 'a2', 's2')],
    }
    expect(countCrossings(design)).toBe(0)
  })

  it('counts one when they swap ends', () => {
    const design: Design = {
      nodes: [node('a1', 'actor', 80), node('a2', 'approver', 194), node('s1', 'service', 80), node('s2', 'worker', 194)],
      edges: [edge('e1', 'a1', 's2'), edge('e2', 'a2', 's1')],
    }
    expect(countCrossings(design)).toBe(1)
  })

  // A cable between two pieces of the same band is not a layered edge and has
  // no crossing to count. Saying so out loud is what stops it being counted by
  // accident later.
  it('ignores a cable that never leaves its band', () => {
    const design: Design = {
      nodes: [node('s1', 'service', 80), node('s2', 'worker', 194)],
      edges: [edge('e1', 's1', 's2')],
    }
    expect(countCrossings(design)).toBe(0)
  })
})

describe('arranging a tangled diagram', () => {
  it('starts from six crossings and leaves none', () => {
    const before = tangledDesign()
    expect(countCrossings(before)).toBe(6)
    expect(countCrossings(applied(before))).toBe(0)
  })

  it('never takes a piece out of its own band', () => {
    const positions = arrangedPositions(tangledDesign())
    for (const n of tangledDesign().nodes) {
      const { min, max } = bandXRange(bandForType(n.type))
      expect(positions[n.id].x).toBeGreaterThanOrEqual(min)
      expect(positions[n.id].x).toBeLessThanOrEqual(Math.max(min, max))
    }
  })

  it('reads left to right, band after band', () => {
    const positions = arrangedPositions(tangledDesign())
    expect(positions.a1.x).toBeLessThan(positions.s1.x)
    expect(positions.s1.x).toBeLessThan(positions.d1.x)
  })

  it('gives every piece of a band the same column', () => {
    const positions = arrangedPositions(tangledDesign())
    expect(new Set(['s1', 's2', 's3'].map((id) => positions[id].x)).size).toBe(1)
  })

  // The corpus uses exactly three x values across its 169 files: 85, 445 and
  // 805 (counted: 167, 709 and 286 occurrences). An arranged diagram uses those
  // same three, so it is the same drawing an author would have handed over. The
  // band's own left edge would be 14/374/734, which is where the band NAMES are
  // drawn, and a column there puts the first piece of each band on its name.
  it('uses the same three columns the corpus already uses', () => {
    const positions = arrangedPositions(tangledDesign())
    expect([positions.a1.x, positions.s1.x, positions.d1.x]).toEqual([85, 445, 805])
    expect(BAND_COLUMN_OFFSET).toBe(85)
  })

  it('leaves real air between two pieces of the same band', () => {
    const positions = arrangedPositions(tangledDesign())
    const column = ['s1', 's2', 's3'].map((id) => positions[id].y).sort((a, b) => a - b)
    expect(column[1] - column[0]).toBeGreaterThanOrEqual(DEFAULT_NODE_SIZE.height + DEFAULT_GAP)
    expect(column[2] - column[1]).toBeGreaterThanOrEqual(DEFAULT_NODE_SIZE.height + DEFAULT_GAP)
  })

  it('starts each band on the same line a new piece is born on', () => {
    const positions = arrangedPositions(tangledDesign())
    for (const band of BAND_ORDER) {
      const top = Math.min(
        ...tangledDesign()
          .nodes.filter((n) => bandForType(n.type) === band)
          .map((n) => positions[n.id].y),
      )
      expect(top).toBe(DEFAULT_TOP)
    }
  })

  it('answers for every piece and invents none', () => {
    const design = tangledDesign()
    expect(Object.keys(arrangedPositions(design)).sort()).toEqual(design.nodes.map((n) => n.id).sort())
  })
})

describe('arranging a diagram that is already arranged', () => {
  // The owner's own test of whether it feels broken: press it twice and the
  // second press must change nothing.
  it('computes the identical answer the second time', () => {
    const once = applied(tangledDesign())
    expect(arrangedPositions(once)).toEqual(arrangedPositions(tangledDesign()))
  })

  it('does not depend on where the pieces currently are', () => {
    const scrambled = tangledDesign()
    scrambled.nodes = scrambled.nodes.map((n, i) => ({ ...n, position: { x: n.position!.x, y: 3000 - i * 37 } }))
    expect(arrangedPositions(scrambled)).toEqual(arrangedPositions(tangledDesign()))
  })
})

describe('arranging the degenerate diagrams', () => {
  it('answers nothing for an empty canvas', () => {
    expect(arrangedPositions({ nodes: [], edges: [] })).toEqual({})
  })

  it('puts a lone piece at the top of its own band', () => {
    const design: Design = { nodes: [node('s1', 'service', 900)], edges: [] }
    expect(arrangedPositions(design)).toEqual({ s1: { x: bandColumnX('application'), y: DEFAULT_TOP } })
  })

  it('places a piece nobody is connected to without dropping it', () => {
    const design: Design = {
      nodes: [node('a1', 'actor', 80), node('s1', 'service', 80), node('d1', 'database', 80)],
      edges: [edge('e1', 'a1', 's1')],
    }
    expect(arrangedPositions(design).d1).toEqual({ x: bandColumnX('infrastructure'), y: DEFAULT_TOP })
  })
})
