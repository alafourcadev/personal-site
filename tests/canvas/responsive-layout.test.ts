// How many of the playground's panes a width can honestly hold, and who owns
// the rail when two things want it.
//
// The playground shipped as three fixed columns in one flex row, library
// (`w-[300px] shrink-0`), canvas (`flex-1`) and result panel (`w-[380px]
// shrink-0`), at every width. Measured in a production build at 390x844, the
// width most of this brand's first visits arrive at: the library kept 300px of
// a 390px viewport and the canvas was left with 136px, zoom 0.5, node titles at
// 7px and 4 of 7 nodes outside the pane. Opening the result panel, 380px more
// and also `shrink-0`, took the canvas to 0px.
//
// WHAT CHANGED HERE. The workbench now has one rail on each side: the statement
// on the left, the tools on the right. The verdict is the second tenant of that
// right rail, and the owner decided the two are exclusive in time: while you
// build you want tools, while you evaluate you want the verdict. That retires
// the old three-column tier, whose only job was keeping the library beside the
// verdict, and with it the argument that the correction loop needs the rail.
// It does not: the canvas's own context menu offers all 21 components, which
// canvas-survives-the-verdict.spec.ts drives with a real right-click.
//
// What it buys, measured: at 1440 the verdict used to leave the canvas
// 1440 - 300 - 380 = 760px. It now leaves it 1060px, at the exact moment every
// finding in that verdict is a button that highlights a node in it.
import { describe, expect, it } from 'vitest'
import {
  CANVAS_WORKSPACE_MIN_PX,
  LIBRARY_WIDTH_PX,
  RAIL_BESIDE_CANVAS_MIN_PX,
  RAIL_PLECA_WIDTH_PX,
  RESULT_PANEL_WIDTH_PX,
  effectiveView,
  libraryIsOwnPane,
  paneLayout,
  paneVisibility,
  resultIsRail,
} from '../../src/lib/forja/canvas/responsive-layout'

describe('paneLayout', () => {
  // The threshold is derived from the rail's own width, applied to the
  // invariant the layout e2e already asserts: the canvas is wider than the rail
  // beside it. It is not a device name.
  it('derives its threshold from the rail, not from a device name', () => {
    expect(RAIL_BESIDE_CANVAS_MIN_PX).toBe(LIBRARY_WIDTH_PX + LIBRARY_WIDTH_PX + 1)
  })

  // A different question from the tier, and the reason it is a separate number:
  // how wide the canvas has to be before the diagram is something a player
  // works on rather than something they look at. Measured, not derived, so a
  // test that uses it is not comparing the arithmetic with itself.
  it('has a workspace floor that no rail width can produce on its own', () => {
    expect(CANVAS_WORKSPACE_MIN_PX).toBeGreaterThan(LIBRARY_WIDTH_PX)
    expect(CANVAS_WORKSPACE_MIN_PX).toBeGreaterThan(RESULT_PANEL_WIDTH_PX)
  })

  it('stacks the panes on a phone, where no rail can coexist with a usable canvas', () => {
    expect(paneLayout(390)).toBe('stacked')
    expect(paneLayout(RAIL_BESIDE_CANVAS_MIN_PX - 1)).toBe('stacked')
  })

  it('puts a rail beside the canvas as soon as the canvas would stay the wider of the two', () => {
    expect(paneLayout(RAIL_BESIDE_CANVAS_MIN_PX)).toBe('rail-beside-canvas')
    // Tablet portrait: 834 - 300 leaves the canvas 534px, still the widest pane.
    expect(paneLayout(834)).toBe('rail-beside-canvas')
    expect(paneLayout(1133)).toBe('rail-beside-canvas')
    expect(paneLayout(1440)).toBe('rail-beside-canvas')
    expect(paneLayout(2560)).toBe('rail-beside-canvas')
  })

  // There is no third tier any more, and that is the point rather than an
  // omission: the rail holds one tenant, so there was never a width at which
  // two of them had to fit.
  it('has exactly two answers, because there is only ever one rail beside the canvas', () => {
    const answers = new Set([390, 601, 834, 1133, 1440, 1512, 2560].map(paneLayout))
    expect([...answers].sort()).toEqual(['rail-beside-canvas', 'stacked'])
  })
})

describe('the pleca, which is what a folded rail leaves behind', () => {
  // The rail folds to its own control and nothing else. It is carved out of the
  // rail's footprint rather than added beside it, so the canvas's width with
  // the tools up is exactly what it always was and the measured floor at 1440
  // does not move by a pixel.
  it('is narrow enough to be a grip and never a pane', () => {
    expect(RAIL_PLECA_WIDTH_PX).toBeGreaterThan(0)
    expect(RAIL_PLECA_WIDTH_PX).toBeLessThan(LIBRARY_WIDTH_PX / 4)
  })

  // What folding the tools is actually worth, stated as the thing the player
  // gets rather than as the numbers.
  it('gives the canvas back nearly the whole rail when the tools fold', () => {
    expect(LIBRARY_WIDTH_PX - RAIL_PLECA_WIDTH_PX).toBeGreaterThan(LIBRARY_WIDTH_PX * 0.9)
  })
})

describe('libraryIsOwnPane', () => {
  // The tab bar is the mechanism: where the tools cannot sit beside the canvas
  // they become a view of their own, reachable by a fourth tab. Anywhere else
  // that tab must not exist, because a control that duplicates something
  // already on screen is noise.
  it('is true only where the tools have nowhere to sit beside the canvas', () => {
    expect(libraryIsOwnPane('stacked')).toBe(true)
    expect(libraryIsOwnPane('rail-beside-canvas')).toBe(false)
  })
})

describe('resultIsRail', () => {
  // The same rule read from the other end. A pane that is a RAIL sits beside
  // the canvas, so a tab that switches to it switches to something already on
  // screen.
  it('is true wherever the verdict opens beside the canvas instead of replacing it', () => {
    expect(resultIsRail(paneVisibility('rail-beside-canvas', 'result'))).toBe(true)
  })

  // On a phone the verdict really is a view: it takes the whole row and the
  // canvas is not on screen at all, so its tab is the only way back to it.
  it('is false where the verdict replaces the canvas, because there it is a view', () => {
    expect(resultIsRail(paneVisibility('stacked', 'result'))).toBe(false)
  })

  it('is false while the verdict is closed, at every width', () => {
    for (const layout of ['stacked', 'rail-beside-canvas'] as const) {
      expect(resultIsRail(paneVisibility(layout, 'canvas')), layout).toBe(false)
      expect(resultIsRail(paneVisibility(layout, 'list')), layout).toBe(false)
    }
  })
})

describe('effectiveView', () => {
  it('leaves every ordinary view alone', () => {
    for (const layout of ['stacked', 'rail-beside-canvas'] as const) {
      expect(effectiveView(layout, 'canvas')).toBe('canvas')
      expect(effectiveView(layout, 'list')).toBe('list')
      expect(effectiveView(layout, 'result')).toBe('result')
    }
  })

  it('keeps the library view only while it exists', () => {
    expect(effectiveView('stacked', 'library')).toBe('library')
  })

  // Rotating a phone to landscape, or dragging a desktop window wider, must not
  // leave the playground on a view whose tab no longer exists: that is a blank
  // pane with no way back.
  it('falls back to the canvas when the viewport grows past the library view', () => {
    expect(effectiveView('rail-beside-canvas', 'library')).toBe('canvas')
  })
})

describe('paneVisibility', () => {
  it('shows exactly one pane at a time when stacked', () => {
    expect(paneVisibility('stacked', 'library')).toEqual({ library: true, canvas: false, list: false, result: false })
    expect(paneVisibility('stacked', 'canvas')).toEqual({ library: false, canvas: true, list: false, result: false })
    expect(paneVisibility('stacked', 'list')).toEqual({ library: false, canvas: false, list: true, result: false })
    expect(paneVisibility('stacked', 'result')).toEqual({ library: false, canvas: false, list: false, result: true })
  })

  // The owner's decision, stated as the rule it is: one rail, one tenant at a
  // time. While you build it holds the tools; while you evaluate it holds the
  // verdict. They never share it and they never stack.
  it('never gives the rail to the tools and the verdict at once, at any width', () => {
    for (const layout of ['stacked', 'rail-beside-canvas'] as const) {
      for (const view of ['library', 'canvas', 'list', 'result'] as const) {
        const panes = paneVisibility(layout, view)
        expect(panes.library && panes.result, `${layout}/${view}`).toBe(false)
      }
    }
  })

  it('gives the rail to the tools while the player is building', () => {
    expect(paneVisibility('rail-beside-canvas', 'canvas')).toEqual({
      library: true,
      canvas: true,
      list: false,
      result: false,
    })
  })

  // The defect this file exists to stop: a verdict about a design is useless
  // beside no design. The library is the one that gives the rail up, because
  // picking pieces and reading a verdict do not happen at the same moment.
  it('gives it to the verdict while the player is evaluating, and never at the canvas’s expense', () => {
    expect(paneVisibility('rail-beside-canvas', 'result')).toEqual({
      library: false,
      canvas: true,
      list: false,
      result: true,
    })
  })

  // What happens when the verdict closes, which is the question the new rule
  // has to answer out loud: the rail goes back to the tools, so the player is
  // returned to the state they were building in.
  it('hands the rail back to the tools the moment the verdict closes', () => {
    const building = paneVisibility('rail-beside-canvas', 'canvas')
    expect(building.library).toBe(true)
    expect(building.result).toBe(false)
    expect(building.canvas).toBe(true)
  })

  // The list view replaces the workspace entirely at every width: it is the
  // same design in another form, not a third panel.
  it('gives the row to the list view, which is the whole design in another form', () => {
    expect(paneVisibility('rail-beside-canvas', 'list')).toEqual({
      library: false,
      canvas: false,
      list: true,
      result: false,
    })
  })

  it('resolves a stale library view through effectiveView rather than rendering nothing', () => {
    expect(paneVisibility('rail-beside-canvas', 'library')).toEqual(paneVisibility('rail-beside-canvas', 'canvas'))
  })
})
