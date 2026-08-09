// The geometry of the full-screen shell La Forja opens in, and of the
// objective card that floats over its canvas.
//
// Why this file replaces exercise-page-layout.test.ts. That module put the
// statement in a 460px column beside the playground and derived a breakpoint
// from it. Measured against a production build on
// `/forja/1/n1-el-comprobante-que-no-se-guarda`:
//
//   viewport   statement as a column        statement out of the flow
//   1133       299px, zoom 0.26,  3.64px    783px, zoom 0.678,  9.49px
//   1344       510px, zoom 0.442, 6.19px    994px, zoom 0.862, 12.06px
//   1440       606px, zoom 0.525, 7.36px   1090px, zoom 0.943, 13.21px
//
// (canvas width, the zoom `fitView` settles on, and the on-screen size of a
// node title.) There is no laptop width where a 460px column and a legible
// canvas both fit: raising the breakpoint to 1344 was measured too and gives
// 6.19px titles, under the 7px the code itself calls unacceptable. So the
// column is gone. The statement is a card anchored over the canvas, and the
// numbers below are what that costs and what it gives back.
import { describe, expect, it } from 'vitest'
import {
  BRIEF_CARD_FOOTPRINT_PX,
  BRIEF_CARD_INSET_PX,
  BRIEF_CARD_SIDE_MIN_PANE_PX,
  BRIEF_CARD_TOP_PX,
  BRIEF_CARD_WIDTH_PX,
  BRIEF_STRIP_HEIGHT_PX,
  FORJA_TOP_BAR_HEIGHT_PX,
  PANE_GEOMETRY_VARS,
  PANE_INSET_PADDING,
  PLAYABLE_MEDIA_QUERY,
  PLAYABLE_MIN_PX,
  STATEMENT_RAIL_WIDTH_PX,
  WIDE_WORKBENCH_MEDIA_QUERY,
  WIDE_WORKBENCH_MIN_PX,
  briefCardIsBesideCanvas,
  briefFitPadding,
  canvasPaneWidth,
  exercisePositionLabel,
  isPlayableViewport,
  paneGeometryStyle,
  workbenchCanvasWidth,
  workbenchPlaygroundWidth,
  workspaceCanvasWidth,
} from '../../src/lib/forja/canvas/forja-shell'
import {
  CANVAS_WORKSPACE_MIN_PX,
  LIBRARY_WIDTH_PX,
  RAIL_BESIDE_CANVAS_MIN_PX,
  RAIL_PLECA_WIDTH_PX,
  RESULT_PANEL_WIDTH_PX,
  paneLayout,
  paneVisibility,
} from '../../src/lib/forja/canvas/responsive-layout'

// The pane the diagram is left with once the verdict has opened, at a given
// window. Which tenant holds the rail is decided by responsive-layout.ts, so
// this is the same arithmetic the island runs, not a second copy of the rules.
function paneWithVerdictOpen(viewport: number): number {
  const panes = paneVisibility(paneLayout(viewport), 'result')
  return canvasPaneWidth(viewport, { library: panes.library, result: panes.result })
}

describe('the width the canvas actually gets', () => {
  it('uses three real columns only where their arithmetic keeps a workspace', () => {
    expect(workbenchCanvasWidth(WIDE_WORKBENCH_MIN_PX - 1)).toBe(
      WIDE_WORKBENCH_MIN_PX - 1 - LIBRARY_WIDTH_PX,
    )
    expect(workbenchCanvasWidth(WIDE_WORKBENCH_MIN_PX)).toBe(
      WIDE_WORKBENCH_MIN_PX - STATEMENT_RAIL_WIDTH_PX - LIBRARY_WIDTH_PX,
    )
    expect(workbenchCanvasWidth(WIDE_WORKBENCH_MIN_PX)).toBeGreaterThanOrEqual(CANVAS_WORKSPACE_MIN_PX)
  })

  it('gives the statement surface back to the canvas when its wide rail folds', () => {
    expect(workbenchCanvasWidth(1440, true) - workbenchCanvasWidth(1440)).toBe(
      STATEMENT_RAIL_WIDTH_PX - RAIL_PLECA_WIDTH_PX,
    )
  })

  // The shell is full bleed, so the playground's box IS the viewport: no page
  // gutter, nothing between the window and the rails. The statement rail is not
  // in that arithmetic on purpose: it is anchored OVER the pane rather than
  // taking from it, which is what keeps the canvas at 833px at 1133 with the
  // statement open instead of the 433px an in-flow column would have left.
  it('is the viewport minus the tools rail, at every playable width', () => {
    for (const viewport of [768, 1133, 1440, 1512, 1920]) {
      expect(workspaceCanvasWidth(viewport), `canvas at ${viewport}px`).toBe(viewport - LIBRARY_WIDTH_PX)
    }
  })

  // The number the old layout could not reach at any laptop width. 1133px is
  // the width that shipped a 299px canvas at zoom 0.28.
  it('clears the workspace floor from 1133px up, where the column layout gave 299px', () => {
    expect(workspaceCanvasWidth(1133)).toBeGreaterThanOrEqual(CANVAS_WORKSPACE_MIN_PX)
    expect(workspaceCanvasWidth(1440)).toBeGreaterThanOrEqual(CANVAS_WORKSPACE_MIN_PX)
  })

  // Opening the verdict used to put the canvas at `display: none` on the two
  // most common laptops. With the whole viewport in the row it keeps a real
  // box at every playable width.
  it('survives the verdict opening, at every playable width', () => {
    for (const viewport of [768, 1133, 1440, 1512, 1920]) {
      expect(paneWithVerdictOpen(viewport), `canvas beside the verdict at ${viewport}px`).toBeGreaterThan(0)
    }
  })

  // What the owner's one-tenant rule is worth, as a number. The rail used to be
  // shared at the widest tier, so a verdict cost the canvas the tools rail AND
  // its own: 680px of a 1440px window. It now costs only its own.
  it('gives the diagram back the tools rail the moment the verdict takes over', () => {
    expect(paneWithVerdictOpen(1440)).toBe(1440 - RESULT_PANEL_WIDTH_PX)
    expect(paneWithVerdictOpen(1440)).toBe(1060)
    expect(paneWithVerdictOpen(1440) - (1440 - LIBRARY_WIDTH_PX - RESULT_PANEL_WIDTH_PX)).toBe(LIBRARY_WIDTH_PX)
  })

  // Folding the tools is the other way the diagram gets width, and it is the
  // one the player asks for by hand. It gives back the whole rail but the grip.
  it('gives the diagram the tools rail when the player folds it, all but the pleca', () => {
    for (const viewport of [1133, 1440, 1512]) {
      expect(canvasPaneWidth(viewport, { library: true, result: false, toolsCollapsed: true })).toBe(
        viewport - RAIL_PLECA_WIDTH_PX,
      )
    }
  })
})

describe('isPlayableViewport', () => {
  // PRODUCT.md: "Desktop first. The canvas needs pointer precision. On a small
  // screen the product is readable, not playable." A decided constraint, so it
  // gets a number rather than a media query written in three components.
  it('calls a phone unplayable and a tablet playable', () => {
    expect(isPlayableViewport(390)).toBe(false)
    expect(isPlayableViewport(PLAYABLE_MIN_PX - 1)).toBe(false)
    expect(isPlayableViewport(PLAYABLE_MIN_PX)).toBe(true)
    expect(isPlayableViewport(1440)).toBe(true)
  })

  // Below the playable width the workbench is not offered at all, so the two
  // plecas are not offered either: there is no canvas for a fold to give room
  // to, and a control that hides the only content on the page would be a
  // control that breaks it. The reading screen is the statement, the level map
  // and the line inviting the player back from a wide screen, and nothing else.
  it('never allows a playable width that cannot hold a rail beside the canvas', () => {
    expect(PLAYABLE_MIN_PX).toBeGreaterThanOrEqual(RAIL_BESIDE_CANVAS_MIN_PX)
  })

  // The island stops mounting React Flow below this width, and the stylesheet
  // stops offering the workbench. Two consumers, one number.
  it('spells the same threshold as the media query the island listens to', () => {
    expect(PLAYABLE_MEDIA_QUERY).toBe(`(min-width: ${PLAYABLE_MIN_PX}px)`)
    expect(WIDE_WORKBENCH_MEDIA_QUERY).toBe(`(min-width: ${WIDE_WORKBENCH_MIN_PX}px)`)
  })
})

describe('workbenchPlaygroundWidth', () => {
  it('charges the external statement rail only in the wide composition', () => {
    expect(workbenchPlaygroundWidth(1133)).toBe(1133)
    expect(workbenchPlaygroundWidth(1440)).toBe(1440 - STATEMENT_RAIL_WIDTH_PX)
    expect(workbenchPlaygroundWidth(1440, true)).toBe(1440 - RAIL_PLECA_WIDTH_PX)
  })
})

describe('canvasPaneWidth', () => {
  // The number the card's footprint is charged against. The pane and not the
  // window, because the pane is what shrinks: at 1440 with the verdict open it
  // is 760px, and a camera still framing around a 432px card left the design
  // 312px at the moment the verdict asks the player to look at it.
  it('is the playground minus whatever the rail is holding', () => {
    expect(canvasPaneWidth(1440, { library: true, result: false })).toBe(1440 - LIBRARY_WIDTH_PX)
    expect(canvasPaneWidth(1440, { library: false, result: true })).toBe(1440 - RESULT_PANEL_WIDTH_PX)
    expect(canvasPaneWidth(1440, { library: false, result: false })).toBe(1440)
  })

  // The verdict is the rail's other tenant, never a second rail, so a folded
  // tools preference cannot make the verdict narrower or wider than it is.
  it('gives the verdict the whole rail, whatever the tools were folded to', () => {
    for (const toolsCollapsed of [true, false]) {
      expect(canvasPaneWidth(1440, { library: false, result: true, toolsCollapsed })).toBe(1440 - RESULT_PANEL_WIDTH_PX)
    }
  })

  it('agrees with the plain workspace arithmetic while only the library is up', () => {
    for (const viewport of [768, 1133, 1440, 1920]) {
      expect(canvasPaneWidth(viewport, { library: true, result: false })).toBe(workspaceCanvasWidth(viewport))
    }
  })
})

describe('PANE_INSET_PADDING', () => {
  // Free play has no objective card, so the camera owes nothing to one. It
  // still keeps the outermost nodes off the pane's edges, which is what stops
  // a finding's highlight ring from being clipped.
  it('is the plain inset on every side', () => {
    expect(PANE_INSET_PADDING).toEqual({
      top: `${BRIEF_CARD_INSET_PX}px`,
      right: `${BRIEF_CARD_INSET_PX}px`,
      bottom: `${BRIEF_CARD_INSET_PX}px`,
      left: `${BRIEF_CARD_INSET_PX}px`,
    })
  })
})

describe('briefCardIsBesideCanvas', () => {
  // Derived, not chosen: the card and its air on both sides, plus a canvas
  // that is still a workspace after it.
  it('is the narrowest pane where clearing the card still leaves a workspace', () => {
    expect(BRIEF_CARD_FOOTPRINT_PX).toBe(BRIEF_CARD_INSET_PX + BRIEF_CARD_WIDTH_PX + BRIEF_CARD_INSET_PX)
    expect(BRIEF_CARD_SIDE_MIN_PANE_PX).toBe(BRIEF_CARD_FOOTPRINT_PX + CANVAS_WORKSPACE_MIN_PX)
    expect(briefCardIsBesideCanvas(BRIEF_CARD_SIDE_MIN_PANE_PX - 1)).toBe(false)
    expect(briefCardIsBesideCanvas(BRIEF_CARD_SIDE_MIN_PANE_PX)).toBe(true)
  })

  // Measured on this repo at an 833px pane, which is what 1133px gives:
  // keeping the card clear leaves a 385px diagram with 5.36px node titles,
  // while letting it overlay leaves an 833px diagram with 11.16px titles and
  // the card over its left half. The second is the better half-measure.
  it('lets the card overlay the diagram where clearing it would starve the camera', () => {
    expect(briefCardIsBesideCanvas(workspaceCanvasWidth(PLAYABLE_MIN_PX))).toBe(false)
    expect(briefCardIsBesideCanvas(workspaceCanvasWidth(1133))).toBe(false)
  })

  it('clears it where nothing has to be covered at all', () => {
    expect(briefCardIsBesideCanvas(workspaceCanvasWidth(1440))).toBe(true)
    expect(briefCardIsBesideCanvas(workspaceCanvasWidth(1920))).toBe(true)
  })

  // The state this rule exists to protect: a verdict beside a design the
  // player can no longer read is a verdict about nothing.
  it('stops charging for the card once the verdict has taken the rail', () => {
    const pane = paneWithVerdictOpen(1440)
    expect(pane).toBe(1060)
    expect(briefCardIsBesideCanvas(pane)).toBe(false)
    expect(briefFitPadding(false, pane)).toEqual(PANE_INSET_PADDING)
  })

  // Folding the tools moves the pane across that same threshold from the other
  // side, which is the emergent reward for folding: at 1133 the statement rail
  // overlays the diagram, and folding the tools widens the pane enough that the
  // camera can clear it instead.
  it('lets a folded tools rail buy the statement a column it could not afford', () => {
    expect(briefCardIsBesideCanvas(canvasPaneWidth(1133, { library: true, result: false }))).toBe(false)
    expect(briefCardIsBesideCanvas(canvasPaneWidth(1133, { library: true, result: false, toolsCollapsed: true }))).toBe(
      true,
    )
  })
})

describe('briefFitPadding', () => {
  it('does not charge the camera twice for a statement already paid by layout', () => {
    expect(briefFitPadding(false, workbenchCanvasWidth(1440), true)).toEqual(PANE_INSET_PADDING)
    expect(briefFitPadding(true, workbenchCanvasWidth(1440, true), true)).toEqual(PANE_INSET_PADDING)
  })

  // The declared risk of a card over a canvas: it covers the diagram. The
  // mitigation is that the camera never frames a node underneath it. The
  // padding is the card's own footprint, in the pane's own pixels.
  it('keeps the whole diagram clear of the open card, where the card sits beside it', () => {
    expect(briefFitPadding(false, workspaceCanvasWidth(1440))).toEqual({
      top: `${BRIEF_CARD_INSET_PX}px`,
      right: `${BRIEF_CARD_INSET_PX}px`,
      bottom: `${BRIEF_CARD_INSET_PX}px`,
      left: `${BRIEF_CARD_FOOTPRINT_PX}px`,
    })
  })

  it('owes the card nothing where clearing it would starve the camera', () => {
    expect(briefFitPadding(false, workspaceCanvasWidth(PLAYABLE_MIN_PX))).toEqual(PANE_INSET_PADDING)
    expect(briefFitPadding(false, workspaceCanvasWidth(1133))).toEqual(PANE_INSET_PADDING)
  })

  // Folded, the card becomes a strip along the top edge that still carries the
  // budget and the constraints, so the diagram clears its height instead of
  // its width. That is the trade the fold exists to make.
  it('gives the whole width back once the card folds to its strip', () => {
    for (const viewport of [PLAYABLE_MIN_PX, 1133, 1440]) {
      expect(briefFitPadding(true, workspaceCanvasWidth(viewport))).toEqual({
        top: `${BRIEF_STRIP_HEIGHT_PX + BRIEF_CARD_INSET_PX}px`,
        right: `${BRIEF_CARD_INSET_PX}px`,
        bottom: `${BRIEF_CARD_INSET_PX}px`,
        left: `${BRIEF_CARD_INSET_PX}px`,
      })
    }
  })

  // The whole point of folding, stated as arithmetic rather than as a hope:
  // the area the camera may use has to grow, or the fold is a control that
  // hides the statement and gives nothing back.
  it('leaves the camera more room folded than open, wherever the card sits beside the diagram', () => {
    const horizontal = (padding: { left: string; right: string }) =>
      Number.parseInt(padding.left, 10) + Number.parseInt(padding.right, 10)
    for (const viewport of [1440, 1512, 1920]) {
      const pane = workspaceCanvasWidth(viewport)
      const folded = pane - horizontal(briefFitPadding(true, pane))
      const open = pane - horizontal(briefFitPadding(false, pane))
      expect(folded, `folded fit width at ${viewport}px`).toBeGreaterThan(open)
      expect(folded, `folded fit width at ${viewport}px clears the workspace floor`).toBeGreaterThanOrEqual(
        CANVAS_WORKSPACE_MIN_PX,
      )
    }
  })
})

// A verdict folds the statement, at every width, and this is the arithmetic
// that killed the threshold that used to decide otherwise.
//
// The old rule folded only where an open statement would stand on the diagram,
// on the argument that a pane wide enough for the camera to clear the rail
// should keep the problem on screen because folding there "would give the
// player nothing back". Measured in the browser at 1512 with the verdict open,
// that clause is false: kept open, the camera framed the design at zoom 0.681
// and node titles at 9.53px; folded, the same pane frames it at ~1.06 and
// ~14.8px. The rule was protecting the statement's presence and charging the
// diagram a third of its type for it, at the moment the verdict is about the
// diagram.
describe('what a verdict does to the statement', () => {
  // What an open statement costs the diagram once the verdict has the rail, at
  // every width. It is the same 432px footprint whether the camera clears it
  // (the diagram is framed into what is left) or not (the rail stands on it).
  it('documents what an open statement costs the diagram, at every laptop width', () => {
    const cost = (viewport: number) => BRIEF_CARD_FOOTPRINT_PX / paneWithVerdictOpen(viewport)
    // Rounded to whole percent, which is how it was measured in the browser.
    expect(Math.round(cost(1133) * 100)).toBe(57)
    expect(Math.round(cost(1280) * 100)).toBe(48)
    expect(Math.round(cost(1440) * 100)).toBe(41)
    expect(Math.round(cost(1512) * 100)).toBe(38)
  })

  // And what folding gives back instead: the whole width, minus a 40px strip
  // off the top that still carries the budget and the constraints. The claim is
  // made over every width rather than over the ones a threshold used to pick,
  // because that is exactly what stopped being conditional.
  it('leaves the camera more room folded than open, at every width a verdict can open at', () => {
    const horizontal = (padding: { left: string; right: string }) =>
      Number.parseInt(padding.left, 10) + Number.parseInt(padding.right, 10)

    for (const viewport of [PLAYABLE_MIN_PX, 1133, 1280, 1440, 1512, 1920, 2560] as const) {
      const pane = paneWithVerdictOpen(viewport)
      const folded = pane - horizontal(briefFitPadding(true, pane))
      const open = pane - horizontal(briefFitPadding(false, pane))
      expect(folded, `folded fit width at ${viewport}px`).toBeGreaterThanOrEqual(open)
      // And wherever the pane is a workspace at all, folding keeps it one. It
      // cannot promise more than the pane has: at 768 the verdict leaves 388px
      // and no arrangement of a statement makes that a workspace, which is why
      // the claim is conditional rather than absolute.
      if (pane >= CANVAS_WORKSPACE_MIN_PX) {
        expect(folded, `folded fit width at ${viewport}px clears the workspace floor`).toBeGreaterThanOrEqual(
          CANVAS_WORKSPACE_MIN_PX,
        )
      }
    }
  })

  // The widths where the old rule would have left the statement open are the
  // widths where folding buys the most, which is why there is no threshold any
  // more. Stated as the comparison the browser measured.
  it('buys the most exactly where the old threshold would have left it open', () => {
    for (const viewport of [1512, 1920, 2560] as const) {
      const pane = paneWithVerdictOpen(viewport)
      expect(briefCardIsBesideCanvas(pane), `the camera could have cleared it at ${viewport}px`).toBe(true)
      const open = Number.parseInt(briefFitPadding(false, pane).left, 10)
      const folded = Number.parseInt(briefFitPadding(true, pane).left, 10)
      expect(open - folded, `room the fold releases at ${viewport}px`).toBe(
        BRIEF_CARD_FOOTPRINT_PX - BRIEF_CARD_INSET_PX,
      )
    }
  })

  // What folding actually is: a column becomes a strip. The player keeps the
  // numbers they design against and loses only the narrative.
  it('turns the statement’s column into a strip, which is the whole trade', () => {
    const pane = paneWithVerdictOpen(1440)
    expect(briefFitPadding(false, pane)).toEqual(PANE_INSET_PADDING)
    expect(briefFitPadding(true, pane).top).toBe(`${BRIEF_STRIP_HEIGHT_PX + BRIEF_CARD_INSET_PX}px`)
    expect(BRIEF_STRIP_HEIGHT_PX).toBeLessThan(BRIEF_CARD_FOOTPRINT_PX)
  })
})

describe('where the open card starts', () => {
  // The pane's top edge already carries the three band names, drawn in its own
  // screen space at the camera's top padding. Anchoring the card at the same
  // inset put it over "NEGOCIO", which then read as the fragment "CIO", and
  // the names are the model this product teaches.
  it('is a whole line of band names below the plain inset', () => {
    expect(BRIEF_CARD_TOP_PX).toBe(BRIEF_CARD_INSET_PX + 16 + BRIEF_CARD_INSET_PX)
    expect(BRIEF_CARD_TOP_PX).toBeGreaterThan(Number.parseInt(PANE_INSET_PADDING.top, 10) + 16)
  })
})

describe('paneGeometryStyle', () => {
  // The card lives outside the island (its prose is server-rendered markdown),
  // so it cannot ask React Flow where the pane is. The island publishes the
  // pane's own box as custom properties and the card anchors to them, which is
  // what keeps the card beside the library rail and not on top of it, at every
  // pane tier, including the one where the verdict takes the rail.
  it('publishes the pane box as the four custom properties the card reads', () => {
    expect(paneGeometryStyle({ top: 56, left: 300, width: 1140, height: 844 })).toEqual({
      [PANE_GEOMETRY_VARS.top]: '56px',
      [PANE_GEOMETRY_VARS.left]: '300px',
      [PANE_GEOMETRY_VARS.width]: '1140px',
      [PANE_GEOMETRY_VARS.height]: '844px',
    })
  })

  it('rounds to whole pixels, so a subpixel pane box does not repaint the card every frame', () => {
    expect(paneGeometryStyle({ top: 56.4, left: 300.6, width: 1139.5, height: 843.2 })).toEqual({
      [PANE_GEOMETRY_VARS.top]: '56px',
      [PANE_GEOMETRY_VARS.left]: '301px',
      [PANE_GEOMETRY_VARS.width]: '1140px',
      [PANE_GEOMETRY_VARS.height]: '843px',
    })
  })

  it('names every property under one prefix, so nothing collides with a site token', () => {
    for (const name of Object.values(PANE_GEOMETRY_VARS)) {
      expect(name).toMatch(/^--forja-pane-/)
    }
  })
})

describe('exercisePositionLabel', () => {
  // The top bar's own line. Padded, because a level's fourteen entries in a
  // menu read as a column when the numbers are the same width.
  it('names the level and the position inside it', () => {
    expect(exercisePositionLabel(1, 3, 14)).toBe('Nivel 1 · 03 de 14')
    expect(exercisePositionLabel(12, 14, 14)).toBe('Nivel 12 · 14 de 14')
  })

  it('is one-based, because the player counts from one', () => {
    expect(exercisePositionLabel(2, 1, 14)).toBe('Nivel 2 · 01 de 14')
  })
})

describe('the top bar height', () => {
  // The shell has no page scroll, so every pixel of chrome is a pixel the
  // canvas does not get. This is the one row above it.
  it('is a single row, not a stacked header', () => {
    expect(FORJA_TOP_BAR_HEIGHT_PX).toBeLessThanOrEqual(72)
  })
})
