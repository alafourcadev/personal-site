// The four data classes, in the player's language.
//
// `engine/types.ts` declares `DataClass` and `engine/rules.ts` reads it, but
// neither ever gave the four values a player-facing name: the engine only
// spells two of them out, inline, inside one evidence line
// (`dato ${e.dataClass === 'regulated' ? 'regulado' : 'personal'}`). The
// interface now has to print all four — on the canvas, in the menu that
// declares them, in the list view and in the status bar — so the names need a
// single source, the same way CATALOG[type].name and ZONE_NAMES are the single
// source for types and zones.
//
// That source is on the INTERFACE side (`canvas/data-classes.ts`), not in the
// engine: the engine is out of scope for this change, and the import direction
// UI -> engine is the one that already exists. What keeps the two from
// drifting is the third block below, which pins the interface's own words
// against the engine's own evidence line for the two classes the engine
// happens to spell out.
//
// On the leak rule (CONTEXTO §5, "cero vocabulario interno del motor"): three
// of the four keys — `public`, `regulated`, `secret` — are English and can
// never legitimately appear in Spanish copy, so they are matched verbatim. The
// fourth, `personal`, is a Spanish word that IS the right word: the rule for it
// is that the player never reads the bare key standing on its own, which is
// what "dato personal" satisfies and what the engine itself already does.
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../src/lib/forja/canvas/contrast'
import {
  DATA_CLASSES,
  DATA_CLASS_HEX,
  DATA_CLASS_ORDER,
  UNDECLARED_DATA_CLASS_NAME,
  dataClassName,
} from '../../src/lib/forja/canvas/data-classes'
import { FORJA_CANVAS_HEX } from '../../src/lib/forja/canvas/edge-theme'
import { evaluateRules } from '../../src/lib/forja/engine/rules'
import type { DataClass, Design } from '../../src/lib/forja/engine/types'
import { THEMES, declaration, token } from './base-layout-tokens'

// Every value the engine's own `DataClass` union can take. Written out rather
// than derived, on purpose: a fifth class added to the engine has to break a
// test here, and a type-level derivation would silently accept it.
const ALL: DataClass[] = ['public', 'personal', 'regulated', 'secret']

// Only two of the four keys can be matched by substring at all. `público` has
// an accent and `regulado` has no `t`, so neither Spanish name can contain
// `public` or `regulated` by accident — a hit there is a real leak. The other
// two cannot be checked that way and are not a leak when they hit: `personal`
// IS the right Spanish word, and `secret` is a prefix of `secreto`. Their
// guarantee is structural instead (the block below): the player never reads the
// bare key, always the full noun phrase.
const SUBSTRING_CHECKABLE_KEYS = ['public', 'regulated']

describe('forja canvas — the four data classes have one name each', () => {
  it('names every class the engine can carry, and nothing else', () => {
    expect([...DATA_CLASS_ORDER].sort()).toEqual([...ALL].sort())
    expect(Object.keys(DATA_CLASSES).sort()).toEqual([...ALL].sort())
  })

  it('gives each class a distinct, non-empty name', () => {
    const names = ALL.map((c) => DATA_CLASSES[c].label)
    for (const name of names) expect(name).toBeTruthy()
    expect(new Set(names).size).toBe(ALL.length)
  })

  it('never reuses the internal key as the name', () => {
    for (const c of ALL) expect(DATA_CLASSES[c].label, c).not.toBe(c)
  })

  it('never leaks an English engine key into what the player reads', () => {
    const offenders: string[] = []
    for (const c of ALL) {
      for (const key of SUBSTRING_CHECKABLE_KEYS) {
        if (DATA_CLASSES[c].label.includes(key)) offenders.push(`${c}: ${key}`)
      }
    }
    expect(offenders).toEqual([])
  })

  // The structural guarantee that covers the two keys a substring check cannot
  // reach: every name is a noun phrase that says what the thing IS, so a bare
  // identifier can never be what the player reads. It is also what makes the
  // four read as one family in the menu, the label and the status bar.
  it('names every class as a noun phrase, never as a bare identifier', () => {
    for (const c of ALL) expect(DATA_CLASSES[c].label, c).toMatch(/^dato \S+$/)
  })

  it('resolves a declared class to its name and an undeclared connection to the undeclared wording', () => {
    for (const c of ALL) expect(dataClassName(c), c).toBe(DATA_CLASSES[c].label)
    expect(dataClassName(undefined)).toBe(UNDECLARED_DATA_CLASS_NAME)
  })

  it('says "sin declarar" without ever naming a class, so the two states never read alike', () => {
    for (const c of ALL) expect(UNDECLARED_DATA_CLASS_NAME).not.toContain(DATA_CLASSES[c].label)
  })
})

// The stroke colour is a SECOND signal, never the only one (§13.9 forbids
// meaning by colour alone): the connection also carries the class's name as
// its own label and inside its accessible name. It still has to be legible,
// and it is drawn in three places with two different floors:
//
//   - as the connection's stroke and as the 12px dot in the menu, both
//     graphical objects, WCAG 1.4.11's 3:1;
//   - as the class's own name, rendered by React Flow as 11px SVG text in the
//     same colour, which is WCAG 1.4.3's 4.5:1.
//
// The four colours used to be a single table of hexes measured against a pane
// that could not flip. The pane flips now, and the context MENU always could:
// measured live on the light theme, the four dots read 1.84 / 2.43 / 1.60 /
// 2.53:1 against the menu they are drawn on. So the table is per theme, and so
// is every assertion below.
describe('forja canvas — a declared class is legible as a colour too', () => {
  it('gives every class a colour in both themes and nothing else', () => {
    for (const theme of THEMES) expect(Object.keys(DATA_CLASS_HEX[theme]).sort(), theme).toEqual([...ALL].sort())
  })

  // The component never reads the table: it hands the SVG a custom property so
  // the browser picks the theme. This is what keeps that property and this
  // table from becoming two different opinions about "dato regulado".
  it('draws with a theme-aware custom property, never with one of the hexes', () => {
    for (const c of ALL) expect(DATA_CLASSES[c].stroke, c).toBe(`var(--forja-class-${c})`)
  })

  // The table above is a mirror of BaseLayout.astro, kept only because
  // contrast is arithmetic and a custom property is not a number. This is what
  // stops the mirror from becoming a second opinion.
  it.each(THEMES)('measures the very colours the %s theme declares', (theme) => {
    for (const c of ALL) expect(declaration(theme, `forja-class-${c}`), c).toBe(DATA_CLASS_HEX[theme][c])
  })

  it.each(THEMES)('meets the 3:1 graphical-object floor against the %s pane for every class', (theme) => {
    for (const c of ALL) {
      expect(contrastRatio(DATA_CLASS_HEX[theme][c], FORJA_CANVAS_HEX[theme].paneBg), c).toBeGreaterThanOrEqual(3)
    }
  })

  // The dot in the context menu, which is drawn on the raised surface rather
  // than on the pane. This is the assertion that was missing while the canvas
  // was pinned to one theme and the menu was not.
  it.each(THEMES)('meets the same floor against the %s theme’s menu surface', (theme) => {
    for (const c of ALL) {
      expect(contrastRatio(DATA_CLASS_HEX[theme][c], token(theme, 'bg-raised')), c).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(THEMES)('meets the 4.5:1 text floor on the %s theme, because the name is drawn at 11px in this colour', (theme) => {
    for (const c of ALL) {
      expect(contrastRatio(DATA_CLASS_HEX[theme][c], FORJA_CANVAS_HEX[theme].paneBg), c).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(THEMES)('gives each class a distinct colour on the %s theme', (theme) => {
    expect(new Set(ALL.map((c) => DATA_CLASS_HEX[theme][c])).size).toBe(ALL.length)
  })

  // A blocking finding paints the connection with the site's own error red
  // (project.ts). A class colour that WAS that red would make "this is broken"
  // and "this carries regulated data" the same picture.
  it.each(THEMES)('never uses the %s theme’s error red, which already means something else on a connection', (theme) => {
    for (const c of ALL) expect(DATA_CLASS_HEX[theme][c].toLowerCase(), c).not.toBe(token(theme, 'danger-ink'))
  })

  it.each(THEMES)('stays no louder than a selected connection on the %s theme, so selection still reads as the strongest state', (theme) => {
    const selected = contrastRatio(FORJA_CANVAS_HEX[theme].edgeSelected, FORJA_CANVAS_HEX[theme].paneBg)
    for (const c of ALL) {
      expect(contrastRatio(DATA_CLASS_HEX[theme][c], FORJA_CANVAS_HEX[theme].paneBg), c).toBeLessThanOrEqual(selected)
    }
  })
})

// The engine spells two of the four classes out, inline, in one evidence line
// (rules.ts's volatile-durable-mismatch). Those two sentences are the only
// player-facing words about a data class that existed before this change, and
// the player now reads the interface's name for the same class two lines above
// them in the same panel. Pinning them here is what makes a rename on either
// side break the build instead of shipping two words for one thing.
const intoCache = (dataClass: DataClass): Design => ({
  nodes: [
    { id: 's', type: 'service', label: 'Servicio de altas', zone: 'private', props: {} },
    { id: 't', type: 'cache', label: 'Caché', zone: 'private', props: {} },
  ],
  edges: [{ id: 's->t', from: { node: 's' }, to: { node: 't' }, dataClass }],
})

describe('forja canvas — the interface and the engine use the same word for a class', () => {
  it.each(['regulated', 'personal'] as const)(
    'matches the engine s own evidence wording for %s',
    (dataClass) => {
      const found = evaluateRules(intoCache(dataClass)).find((f) => f.rule === 'volatile-durable-mismatch')
      expect(found, `the engine no longer raises volatile-durable-mismatch for ${dataClass}`).toBeDefined()
      expect(found!.evidence).toContain(DATA_CLASSES[dataClass].label)
    },
  )
})
