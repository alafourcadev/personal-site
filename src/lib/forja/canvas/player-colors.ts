// Six-swatch player colour palette [PC16] — the same six colours the owner
// approved in the prototype (forja-app.html's COLORS/COLOR_ES). Built from
// Tailwind's own default palette (slate/emerald/blue/amber/violet/rose),
// not new BaseLayout.astro custom properties: the site's semantic tokens
// (accent, accent-blue, accent-amber, accent-red) already carry component-
// type identity via CATALOG_UI and finding severity respectively, and a
// player annotation needs more distinct hues than those four leave free.
// This is a personal annotation, never brand chrome — see PC16's rationale.
import type { PlayerColor } from '../engine/types'

export interface PlayerColorEntry {
  label: string
  swatchClass: string
  ringClass: string
}

export const PLAYER_COLOR_ORDER: PlayerColor[] = ['slate', 'emerald', 'blue', 'amber', 'violet', 'rose']

export const PLAYER_COLORS: Record<PlayerColor, PlayerColorEntry> = {
  slate: { label: 'Gris', swatchClass: 'bg-slate-400', ringClass: 'ring-slate-400' },
  emerald: { label: 'Verde', swatchClass: 'bg-emerald-400', ringClass: 'ring-emerald-400' },
  blue: { label: 'Azul', swatchClass: 'bg-blue-400', ringClass: 'ring-blue-400' },
  amber: { label: 'Ámbar', swatchClass: 'bg-amber-400', ringClass: 'ring-amber-400' },
  violet: { label: 'Violeta', swatchClass: 'bg-violet-400', ringClass: 'ring-violet-400' },
  rose: { label: 'Rosa', swatchClass: 'bg-rose-400', ringClass: 'ring-rose-400' },
}
