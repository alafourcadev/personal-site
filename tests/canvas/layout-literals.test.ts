// The numbers and the strings this layout writes by hand in more than one
// place, and the gates that stop any two of them drifting apart. That is not
// hypothetical: a drift between the library rail's rendered width and the
// constant the pane arithmetic read is how the 1133px defect reached
// production.
//
// The shell's own literals get the same treatment in
// tests/canvas/forja-shell-markup.test.ts.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIBRARY_WIDTH_PX, RAIL_PLECA_WIDTH_PX } from '../../src/lib/forja/canvas/responsive-layout'
import { PLECA_CLASS, PLECA_DIRECTION_ATTRIBUTE, plecaDirection } from '../../src/lib/forja/canvas/rail-pleca'
import { STATEMENT_RAIL_WIDTH_PX, WIDE_WORKBENCH_MIN_PX } from '../../src/lib/forja/canvas/forja-shell'
import {
  STATEMENT_COLLAPSED_ATTRIBUTE,
  STATEMENT_COLLAPSED_STORAGE_KEY,
} from '../../src/lib/forja/canvas/statement-visibility'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const COMPONENT_LIBRARY_SOURCE = read('../../src/components/forja/canvas/ComponentLibrary.tsx')
const FORJA_CANVAS_SOURCE = read('../../src/components/forja/canvas/ForjaCanvas.tsx')
const RAIL_PLECA_CSS = read('../../src/components/forja/canvas/rail-pleca.css')
const EXERCISE_PAGE_SOURCE = read('../../src/pages/forja/[level]/[exercise].astro')
const EXERCISE_BRIEF_SOURCE = read('../../src/components/forja/ExerciseBrief.astro')
const EXERCISE_BRIEF_CSS = read('../../src/components/forja/exercise-brief.css')

describe('the wide workbench', () => {
  it('renders the breakpoint and rail width the camera arithmetic declares', () => {
    expect(EXERCISE_BRIEF_CSS).toContain(`@media (min-width: ${WIDE_WORKBENCH_MIN_PX}px)`)
    expect(EXERCISE_BRIEF_CSS).toContain(`grid-template-columns: ${STATEMENT_RAIL_WIDTH_PX}px minmax(0, 1fr)`)
    expect(EXERCISE_BRIEF_CSS).toContain(`grid-template-columns: ${RAIL_PLECA_WIDTH_PX}px minmax(0, 1fr)`)
  })
})

describe('the tools rail width', () => {
  // It used to be a `w-[300px]` class in the component, tied by source text to
  // the constant the arithmetic read. There is nothing to tie any more: the
  // rail takes its width from railWidth() directly, so the number the browser
  // renders IS the number the pane calculation used. This asserts the copy is
  // gone rather than that it still matches.
  it('is taken from the pane arithmetic, not written again as a class', () => {
    expect(FORJA_CANVAS_SOURCE).toContain('railWidth(')
    expect(COMPONENT_LIBRARY_SOURCE.match(/w-\[\d+px\]/g) ?? []).toEqual([])
  })

  // The pleca is the one part of the rail whose width lives in the stylesheet,
  // because it is drawn there. So it still needs the gate.
  it('gives the pleca the same width in the stylesheet as in the arithmetic', () => {
    expect(RAIL_PLECA_CSS).toContain(`width: ${RAIL_PLECA_WIDTH_PX}px`)
    expect(RAIL_PLECA_CSS).toContain(`flex: 0 0 ${RAIL_PLECA_WIDTH_PX}px`)
  })

  it('leaves the rail wider than the grip it folds to', () => {
    expect(RAIL_PLECA_WIDTH_PX).toBeLessThan(LIBRARY_WIDTH_PX)
  })

  // The folded statement's strip has to start after its own pleca, or the grip
  // covers the first word of the budget. That is the third place this number is
  // written, so it gets the same gate as the other two.
  it('starts the folded statement’s strip after the grip that folded it', () => {
    expect(EXERCISE_BRIEF_CSS).toContain(`calc(${RAIL_PLECA_WIDTH_PX}px + 0.75rem)`)
  })
})

describe('the pleca, which is drawn once and rendered twice', () => {
  // Two rails, two frameworks, one control. The statement's rail is
  // server-rendered Astro because its prose is markdown; the tools' rail is
  // inside the React island. If they stopped sharing the class, the player
  // would have two controls to learn instead of one, and only one of them would
  // get any future fix.
  it('is the same class on both rails', () => {
    expect(EXERCISE_BRIEF_SOURCE).toContain(PLECA_CLASS)
    expect(read('../../src/components/forja/canvas/RailPleca.tsx')).toContain('PLECA_CLASS')
    expect(RAIL_PLECA_CSS).toContain(`.${PLECA_CLASS}`)
  })

  // The chevron is CSS rather than an icon precisely so there is no glyph to
  // copy into two files. This is that decision, held.
  it('draws its arrow in the stylesheet, so neither rail carries a copy of it', () => {
    expect(RAIL_PLECA_CSS).toContain(`[${PLECA_DIRECTION_ATTRIBUTE}='right']`)
    expect(RAIL_PLECA_CSS).toContain(`[${PLECA_DIRECTION_ATTRIBUTE}='left']`)
  })

  // The page's first-paint script is unbundled, so it cannot import the rule
  // and writes the two directions by hand. This is the leg that ties them: the
  // statement is the left rail, so open it points left and folded it points
  // right, and if plecaDirection ever changed its mind the script would be
  // caught here instead of in a browser.
  it('makes the page’s own script point the statement’s arrow the way the rule says', () => {
    const open = plecaDirection('left', false)
    const collapsed = plecaDirection('left', true)
    expect(EXERCISE_PAGE_SOURCE).toContain(`'${PLECA_DIRECTION_ATTRIBUTE}'`)
    expect(EXERCISE_PAGE_SOURCE).toContain(`isCollapsed ? '${collapsed}' : '${open}'`)
  })
})

describe('the statement collapse contract', () => {
  // The page applies the stored preference from an `is:inline` script, which
  // Astro leaves unbundled on purpose so the layout is right on the first
  // paint rather than after a hydration round trip. Unbundled means it cannot
  // import the module below, so the key and the attribute are written by hand
  // in three places: the module, the script, and the stylesheet that reacts to
  // them. That is the same shape as the 1133px defect, so it gets the same
  // kind of gate.
  it('uses one storage key, in the module and in the page script', () => {
    expect(EXERCISE_PAGE_SOURCE).toContain(STATEMENT_COLLAPSED_STORAGE_KEY)
  })

  it('uses one state attribute, in the module, the page and the stylesheet', () => {
    expect(EXERCISE_PAGE_SOURCE).toContain(STATEMENT_COLLAPSED_ATTRIBUTE)
    expect(EXERCISE_BRIEF_CSS).toContain(STATEMENT_COLLAPSED_ATTRIBUTE)
  })

  // The stylesheet is what actually folds the statement, so it has to react
  // to both states rather than only to the collapsed one: the expanded rules
  // are what pick the right button label before any script has run.
  it('styles both states, so the control never contradicts what is on screen', () => {
    expect(EXERCISE_BRIEF_CSS).toContain(`${STATEMENT_COLLAPSED_ATTRIBUTE}='true'`)
    expect(EXERCISE_BRIEF_CSS).toContain(`${STATEMENT_COLLAPSED_ATTRIBUTE}='false'`)
  })

  // "Every panel that opens can be closed" already applies to the result
  // panel; a statement that folds is the same promise, and a player without a
  // mouse has to get the same control. `aria-controls` needs a real target,
  // so the id the button names has to exist in the brief.
  it('gives the toggle the disclosure semantics a keyboard player depends on', () => {
    expect(EXERCISE_BRIEF_SOURCE).toContain('aria-expanded')
    const controls = EXERCISE_BRIEF_SOURCE.match(/aria-controls="([^"]+)"/)
    expect(controls, 'the toggle names the region it folds').toBeTruthy()
    expect(EXERCISE_BRIEF_SOURCE).toContain(`id="${controls![1]}"`)
  })
})
