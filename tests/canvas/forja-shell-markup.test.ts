// The shell's own markup, rendered through Astro's container API so what is
// asserted is the HTML a browser actually receives.
//
// Two things are being pinned here. First, that La Forja stops opening inside
// the blog's page shell without the rest of the site noticing: BaseLayout is
// loaded by every page there is, and the two tokens blocks plus the
// before-first-paint theme script live in it, so a second layout would have
// been a second copy of both. Second, that the top bar carries what the owner
// asked for by name: the identity, the level and the exercise with its
// progress, the actions, a menu, the theme switch and the way back to the blog.
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import BaseLayout from '../../src/layouts/BaseLayout.astro'
import ForjaTopBar from '../../src/components/forja/ForjaTopBar.astro'
import { levelMenuFor } from '../../src/lib/forja/progression/level-menu'
import {
  BRIEF_CARD_INSET_PX,
  BRIEF_CARD_TOP_PX,
  BRIEF_CARD_WIDTH_PX,
  BRIEF_STRIP_HEIGHT_PX,
  FORJA_ACTIONS_SLOT_ID,
  exercisePositionLabel,
} from '../../src/lib/forja/canvas/forja-shell'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

const MENU = levelMenuFor(
  [
    { id: 'n1-uno', title: 'El comprobante que no se guarda', role: 'calibration', difficultyIndex: 4 },
    { id: 'n1-dos', title: 'La consulta que saltea la puerta', role: 'core', difficultyIndex: 8 },
    { id: 'n1-tres', title: 'El checkout ajustado', role: 'synthesis', difficultyIndex: 20 },
  ],
  'n1-dos',
  1,
)

let siteHtml = ''
let appHtml = ''
let barHtml = ''

beforeAll(async () => {
  const container = await AstroContainer.create()
  siteHtml = await container.renderToString(BaseLayout, {
    props: { title: 'Una página del sitio' },
    slots: { default: '<p>contenido</p>' },
  })
  appHtml = await container.renderToString(BaseLayout, {
    props: { title: 'La Forja', chrome: 'app' },
    slots: { default: '<p>contenido</p>' },
  })
  barHtml = await container.renderToString(ForjaTopBar, {
    props: { level: 1, title: 'La consulta que saltea la puerta', menu: MENU },
  })
})

describe('BaseLayout keeps the rest of the site exactly as it was', () => {
  it('still ships the navigation and the footer by default', () => {
    expect(siteHtml).toContain('Navegación principal')
    expect(siteHtml).toContain('</footer>')
  })

  it('still centres ordinary pages in the shared shell', () => {
    expect(siteHtml).toContain('max-w-[1440px]')
  })
})

describe('BaseLayout in app chrome', () => {
  // The whole reason this is a property of BaseLayout instead of a second
  // layout: the two theme token blocks and the script that picks a theme
  // before the first paint live here, and a copy of them is a copy that drifts.
  it('keeps the theme decision that runs before the first paint', () => {
    expect(appHtml).toContain("localStorage.getItem('theme')")
  })

  // The reason app chrome is a property of this layout and not a layout of its
  // own. Both theme token tables live in one file; a second shell would have
  // been a second copy, and a copy of a token table is a copy that drifts.
  // (The container API does not inline `<style is:global>`, so this is read
  // from the source, which is where the duplication would appear.)
  it('is still the only file that declares the theme tokens', () => {
    const layout = read('../../src/layouts/BaseLayout.astro')
    expect(layout).toContain('--on-accent')
    expect(layout).toContain('--forja-pane')
  })

  it('drops the site navigation and the footer', () => {
    expect(appHtml).not.toContain('Navegación principal')
    expect(appHtml).not.toContain('</footer>')
  })

  it('drops the shared centred shell, so the workspace is full bleed', () => {
    expect(appHtml).not.toContain('max-w-[1440px]')
  })

  // "Sin scroll de página": the shell owns the window's height and every rail
  // scrolls inside itself. Below the playable width the page is a reading
  // screen and has to scroll again, which is why the lock is behind `md`.
  it('takes the window height and locks the page scroll from the playable width up', () => {
    expect(appHtml).toContain('md:h-screen')
    expect(appHtml).toContain('md:overflow-hidden')
  })

  it('still gives a keyboard the skip link', () => {
    expect(appHtml).toContain('Saltar al contenido')
  })
})

// The class list of one element of the rendered bar, found by its test id.
// Assertions about hierarchy are assertions about which classes an element
// actually carries, and reading the whole document for a utility name cannot
// tell two elements apart.
function classesOf(html: string, testId: string): string {
  const tag = html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? ''
  return tag.match(/class="([^"]*)"/)?.[1] ?? ''
}

describe('the top bar', () => {
  it('carries La Forja’s own name', () => {
    expect(barHtml).toContain('La Forja')
  })

  // PRODUCT.md: "La Forja opens full screen with its own name, UNDER the
  // Ingeniería sin Filtros brand". It shipped with the brand only in the
  // <title>, which is a string the player never reads.
  it('says whose product it is, under its own name', () => {
    expect(barHtml).toContain('Ingeniería sin filtros')
  })

  // The header is an operating surface. It uses one family and lets size,
  // weight and colour distinguish the permanent mark, the current exercise
  // and the quiet position metadata.
  it('gives the loudest ink to the exercise, not to the mark that never changes', () => {
    expect(classesOf(barHtml, 'forja-exercise-name')).toContain('text-txt-primary')
    expect(classesOf(barHtml, 'forja-exercise-name')).not.toContain('text-txt-secondary')
  })

  it('does not mix display and monospace faces into the operating text', () => {
    expect(classesOf(barHtml, 'forja-mark-name')).not.toContain('font-heading')
    expect(classesOf(barHtml, 'forja-position')).not.toContain('font-mono')
  })

  // 11px of mono and 11px of text, in a row that already fits a menu, a theme
  // switch and the way out at 390px. Hiding them was the phone being told the
  // least about where it is, on the viewport most first visits arrive at.
  it('tells a phone which level and which exercise it is on', () => {
    for (const testId of ['forja-position', 'forja-exercise-name']) {
      expect(classesOf(barHtml, testId), testId).not.toContain('hidden')
    }
    expect(barHtml).not.toMatch(/class="hidden min-w-0 flex-1 md:block"/)
  })

  it('says which level this is and where inside it the player stands', () => {
    expect(barHtml).toContain(exercisePositionLabel(1, 2, 3))
  })

  it('names the exercise being played', () => {
    expect(barHtml).toContain('La consulta que saltea la puerta')
  })

  // The three game actions live in the island because they need the canvas's
  // own state. The bar renders the row they land in; the island fills it.
  it('leaves the island a slot for the game’s actions', () => {
    expect(barHtml).toContain(`id="${FORJA_ACTIONS_SLOT_ID}"`)
  })

  it('offers the theme switch and the way back to the blog', () => {
    expect(barHtml).toContain('Cambiar tema')
    expect(barHtml).toContain('href="/blog"')
  })
})

describe('the menu, which is the exit from a level that used to be a dead end', () => {
  it('opens closed and names the region it opens', () => {
    expect(barHtml).toMatch(/aria-expanded="false"[\s\S]{0,200}aria-controls="forja-menu"/)
    expect(barHtml).toContain('id="forja-menu"')
  })

  // It shipped `aria-haspopup="true"`, whose default value is "menu", over a
  // <nav> of ordinary links. That promises a screen reader an ARIA menu:
  // arrow-key roving focus, menuitem roles, the lot. This is a disclosure, and
  // `aria-expanded` plus `aria-controls` already say everything true about it.
  it('does not promise an ARIA menu it is not', () => {
    expect(barHtml).not.toContain('aria-haspopup="true"')
    expect(barHtml).not.toContain('aria-haspopup="menu"')
  })

  // The score IS an identifier and keeps the mono. The word is a word: it was
  // monospaced and upper-cased as a costume, next to fourteen exercise titles
  // set in the body face.
  it('does not dress the word for a pending exercise as an identifier', () => {
    expect(classesOf(barHtml, 'forja-menu-toggle')).toBeTruthy()
    const mark = barHtml.match(/<span[^>]*data-menu-exercise-state[^>]*>/)?.[0] ?? ''
    expect(mark).not.toContain('font-mono')
    expect(mark).not.toContain('uppercase')
  })

  it('reaches the level map and this level’s own list', () => {
    expect(barHtml).toContain('href="/forja/niveles"')
    expect(barHtml).toContain('href="/forja/1"')
  })

  it('lists every exercise of the level, in play order, each one linked', () => {
    for (const entry of MENU.entries) {
      expect(barHtml).toContain(`href="${entry.href}"`)
      expect(barHtml).toContain(entry.title)
    }
    const listed = [...barHtml.matchAll(/data-menu-exercise-id="([^"]+)"/g)].map((m) => m[1])
    expect(listed).toEqual(MENU.entries.map((entry) => entry.id))
  })

  it('marks the exercise that is open, so the list says where the player is', () => {
    expect(barHtml).toContain('aria-current="page"')
  })

  it('offers the step before and the step after by name', () => {
    expect(barHtml).toContain(MENU.previous!.title)
    expect(barHtml).toContain(MENU.next!.title)
  })

  // Whether an exercise is solved lives in localStorage, so the server cannot
  // know it. What it can do is ship the slot the browser fills, and never
  // print a hollow "pendiente" that is indistinguishable from a page that has
  // not finished loading.
  it('ships a solved mark per exercise for the browser to fill in', () => {
    const marks = barHtml.match(/data-menu-exercise-state/g) ?? []
    expect(marks).toHaveLength(MENU.entries.length)
  })
})

describe('the literals the shell writes by hand', () => {
  // Same gate as the library rail's own width: these numbers exist twice, as
  // an exported constant the camera reads and as a Tailwind arbitrary value
  // the browser renders, and a drift between them is a card the diagram is
  // framed around but does not actually avoid.
  const BRIEF_SOURCE = read('../../src/components/forja/ExerciseBrief.astro')
  const BRIEF_CSS = read('../../src/components/forja/exercise-brief.css')
  const BAR_SOURCE = read('../../src/components/forja/ForjaTopBar.astro')
  const CANVAS_SOURCE = read('../../src/components/forja/canvas/ForjaCanvas.tsx')

  it('gives the objective card the width the camera leaves for it', () => {
    expect(BRIEF_SOURCE).toContain(`md:w-[${BRIEF_CARD_WIDTH_PX}px]`)
  })

  // The card's own width is a Tailwind class; everything else about where it
  // sits needs `calc()` over the custom properties the island publishes, and
  // lives in the stylesheet. The folded strip's height is the number the
  // camera keeps clear at the top, so it is the one that must not drift.
  // The pane's top edge already carries the three band names. Anchoring the
  // card at the plain inset put it over "NEGOCIO", which read as "CIO": the
  // names are the model this product teaches, so the card starts under them.
  it('starts the card below the row the band names occupy', () => {
    expect(BRIEF_CARD_TOP_PX).toBeGreaterThan(BRIEF_CARD_INSET_PX)
    expect(BRIEF_CSS).toContain(`+ ${BRIEF_CARD_TOP_PX}px)`)
  })

  it('gives the folded strip the height the camera leaves for it', () => {
    expect(BRIEF_CSS).toContain(`height: ${BRIEF_STRIP_HEIGHT_PX}px`)
    expect(BRIEF_CSS).toContain(`max-height: ${BRIEF_STRIP_HEIGHT_PX}px`)
  })

  // The stylesheet has to react to both states, not only to the collapsed one:
  // the expanded rules are what pick the right button label before any script
  // has run.
  it('styles both fold states, so the control never contradicts what is on screen', () => {
    expect(BRIEF_CSS).toContain("[data-statement-collapsed='true']")
    expect(BRIEF_CSS).toContain("[data-statement-collapsed='false']")
  })

  // Behind `md`, because that is where the promise applies: above it the shell
  // owns the window height and every pixel of chrome is a pixel the canvas does
  // not get. Below it there is no canvas and the page scrolls, so the bar is
  // allowed the second line that makes "Nivel 1 · 01 de 14" readable instead of
  // "Nivel 1…" in 59px.
  it('gives the top bar the height the module declares, from the playable width up', () => {
    expect(BAR_SOURCE).toContain('height: var(--forja-topbar-height)')
    expect(BAR_SOURCE).toContain('FORJA_TOP_BAR_HEIGHT_PX')
  })

  // The island writes the pane's box and reads the fold state through this
  // module rather than through numbers of its own, which is what keeps the
  // card anchored to the pane at every tier, including the one where the
  // verdict takes the library's rail.
  it('makes the island read its geometry from the shell module', () => {
    expect(CANVAS_SOURCE).toContain("canvas/forja-shell'")
  })
})
