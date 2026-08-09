// One place where the interface turns the engine's four `DataClass` values
// into the words a player reads. It is the same job node-identity.ts does for
// component types and trust zones.
//
// Why the source is HERE and not in `engine/`: node-identity.ts consumes
// CATALOG[type].name and ZONE_NAMES because the engine already owned those
// names, and it narrates with them inside its own findings. It does not own a name
// for a data class. `rules.ts` spells two of the four out inline, in a single
// evidence line (`dato ${e.dataClass === 'regulated' ? 'regulado' : 'personal'}`),
// and has no word at all for `public` or `secret`. So the table is on the
// interface side, where the four names are actually needed (canvas label, edge
// menu, list view, status bar), and `tests/canvas/data-classes.test.ts` pins
// the two the engine does spell out against the engine's own evidence line, so
// the player never reads two different words for one class.
//
// Import direction stays UI -> engine, like every other module in this folder.
import type { DataClass } from '../engine/types'
import type { ForjaTheme } from './site-theme'

export interface DataClassEntry {
  // The noun phrase the player reads everywhere: on the connection itself, in
  // the menu that declares it, in the list view, and in the status bar. One
  // string, not a short form and a long form. A second vocabulary is a second
  // thing that can drift, and the phrase is short enough for an edge label.
  label: string
  // A second, redundant signal on the drawing (§13.9 forbids conveying meaning
  // by colour alone, because the label above carries it on its own).
  //
  // A custom property rather than a Tailwind class, because this is applied as
  // an SVG `stroke`, as the `fill` of the class's own 11px name, and as the
  // `backgroundColor` of the 12px dot in the menu: three CSS properties, one
  // value. And a property rather than the hex it used to be, because those
  // three are drawn in whichever theme the player chose. The menu always was:
  // measured on the light theme, the four dots read 1.60-2.53:1 against it.
  stroke: string
}

// Menu order, list order, and the order the four are declared in. Not
// alphabetical and not the engine's declaration order by accident: it climbs
// from the class that constrains nothing to the class that constrains most, so
// the menu reads as a scale rather than as four unrelated options.
export const DATA_CLASS_ORDER: DataClass[] = ['public', 'personal', 'regulated', 'secret']

// The undeclared state is a real state with its own word, not the absence of
// one, because a screen reader has no blank label to notice.
export const UNDECLARED_DATA_CLASS_NAME = 'sin declarar qué dato viaja'

export const DATA_CLASSES: Record<DataClass, DataClassEntry> = {
  public: { label: 'dato público', stroke: 'var(--forja-class-public)' },
  personal: { label: 'dato personal', stroke: 'var(--forja-class-personal)' },
  regulated: { label: 'dato regulado', stroke: 'var(--forja-class-regulated)' },
  secret: { label: 'dato secreto', stroke: 'var(--forja-class-secret)' },
}

// What those four properties resolve to, theme by theme, as declared in
// BaseLayout.astro. Duplicated here for one reason and one only: contrast is
// arithmetic, and `var(--forja-class-public)` is not a number. The gates in
// tests/canvas/data-classes.test.ts run over this table, and a separate
// assertion pins each entry to the declaration it mirrors.
//
// Dark is Tailwind's emerald-400 / blue-400 / amber-400 / purple-400, the six-
// hue family player-colors.ts also draws from, unchanged since the palette was
// approved. Light is the same four hues taken down until each one clears
// 4.5:1 against a near-white pane. The floor is text, not graphics, because
// React Flow draws the class's own name in this colour at 11px.
//
// On `regulated`: amber-800 (#92400e) measures higher, 6.20:1, and was the
// obvious pick until you look at it: it reads brown, and brown at 12px next to
// the error red is two states that look alike. #a8500a clears the same floor at
// 4.81:1 and is still unmistakably orange, which is what has to survive: the
// colour's whole job is to say "regulado" before the label is read.
export const DATA_CLASS_HEX: Record<ForjaTheme, Record<DataClass, string>> = {
  dark: {
    public: '#34d399',
    personal: '#60a5fa',
    regulated: '#fbbf24',
    secret: '#c084fc',
  },
  light: {
    public: '#047857',
    personal: '#1d4ed8',
    regulated: '#a8500a',
    secret: '#7e22ce',
  },
}

// The one function every surface calls, so "undeclared" is worded identically
// in all of them.
export function dataClassName(dataClass?: DataClass): string {
  return dataClass ? DATA_CLASSES[dataClass].label : UNDECLARED_DATA_CLASS_NAME
}
