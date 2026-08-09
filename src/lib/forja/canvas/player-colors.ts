// Six-swatch player colour palette [PC16]: the same six colours the owner
// approved in the prototype (forja-app.html's COLORS/COLOR_ES). Built from
// Tailwind's own default palette (slate/emerald/blue/amber/violet/rose),
// not new BaseLayout.astro custom properties: the site's semantic tokens
// (accent, accent-blue, accent-amber, accent-red) already carry component-
// type identity via CATALOG_UI and finding severity respectively, and a
// player annotation needs more distinct hues than those four leave free.
// This is a personal annotation, never brand chrome. See PC16's rationale.
//
// The six were picked at shade 400, to sing against a dark node card. They have
// nowhere to hide on a white one: measured on the light theme, all six landed
// between 1.60:1 and 2.60:1 against the card they are drawn on, under WCAG
// 1.4.11's 3:1 floor for a graphical object, at 10px. So the palette is per
// theme now: the same six hues, two shades deeper wherever the card is white.
import type { PlayerColor } from '../engine/types'
import type { ForjaTheme } from './site-theme'

export interface PlayerColorEntry {
  label: string
  // Both shades, written out in full rather than composed. Tailwind's scanner
  // only ever sees literal class names in a source file, so `bg-${shade}` would
  // produce a class that never gets generated. What keeps this literal honest
  // is PLAYER_COLOR_SHADE below and the test that pins one against the other.
  swatchClass: string
}

export const PLAYER_COLOR_ORDER: PlayerColor[] = ['slate', 'emerald', 'blue', 'amber', 'violet', 'rose']

export const PLAYER_COLORS: Record<PlayerColor, PlayerColorEntry> = {
  slate: { label: 'Gris', swatchClass: 'bg-slate-500 dark:bg-slate-400' },
  emerald: { label: 'Verde', swatchClass: 'bg-emerald-600 dark:bg-emerald-400' },
  blue: { label: 'Azul', swatchClass: 'bg-blue-600 dark:bg-blue-400' },
  amber: { label: 'Ámbar', swatchClass: 'bg-amber-600 dark:bg-amber-400' },
  violet: { label: 'Violeta', swatchClass: 'bg-violet-600 dark:bg-violet-400' },
  rose: { label: 'Rosa', swatchClass: 'bg-rose-600 dark:bg-rose-400' },
}

// Which Tailwind shade each colour is, per theme. This is the half the class
// strings above encode and the half the contrast gate needs a number for.
export const PLAYER_COLOR_SHADE: Record<ForjaTheme, Record<PlayerColor, string>> = {
  dark: {
    slate: 'slate-400',
    emerald: 'emerald-400',
    blue: 'blue-400',
    amber: 'amber-400',
    violet: 'violet-400',
    rose: 'rose-400',
  },
  light: {
    slate: 'slate-500',
    emerald: 'emerald-600',
    blue: 'blue-600',
    amber: 'amber-600',
    violet: 'violet-600',
    rose: 'rose-600',
  },
}

// Tailwind's own published values for the twelve shades above. Kept as one
// lookup so the hex the contrast gate measures is derived from the shade the
// class names, never typed twice.
const TAILWIND_HEX: Record<string, string> = {
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'emerald-400': '#34d399',
  'emerald-600': '#059669',
  'blue-400': '#60a5fa',
  'blue-600': '#2563eb',
  'amber-400': '#fbbf24',
  'amber-600': '#d97706',
  'violet-400': '#a78bfa',
  'violet-600': '#7c3aed',
  'rose-400': '#fb7185',
  'rose-600': '#e11d48',
}

export const PLAYER_COLOR_HEX: Record<ForjaTheme, Record<PlayerColor, string>> = {
  dark: shadesToHex('dark'),
  light: shadesToHex('light'),
}

function shadesToHex(theme: ForjaTheme): Record<PlayerColor, string> {
  const out = {} as Record<PlayerColor, string>
  for (const color of PLAYER_COLOR_ORDER) {
    const shade = PLAYER_COLOR_SHADE[theme][color]
    const hex = TAILWIND_HEX[shade]
    if (!hex) throw new Error(`no published Tailwind value for ${shade}`)
    out[color] = hex
  }
  return out
}
