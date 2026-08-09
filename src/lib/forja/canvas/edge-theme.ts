// The playground's own palette, per theme.
//
// It started as four hexes, because the canvas was pinned to `colorMode="dark"`
// and there was exactly one theme to be right in. That pin is gone: the canvas
// now follows the site's switch (see site-theme.ts), so every surface and every
// stroke has two answers.
//
// Two things live here, and they are not the same thing:
//
//   1. CANVAS_EDGE_STYLE_VARS, what is actually painted. Every value is a
//      custom property, never a colour. That is not style: React Flow declares
//      its own --xy-* properties on the very element that carries the
//      `.react-flow.dark` class, so an ancestor-level override loses the
//      cascade to it. An INLINE style still wins, and pointing that inline
//      style at a token moves the colour to BaseLayout.astro, where the theme
//      lives, without giving up the win. This file no longer contains a single
//      hex that is painted.
//
//   2. FORJA_CANVAS_HEX, what those tokens resolve to, per theme. Needed
//      because contrast is arithmetic and `var(--forja-pane)` is not a number.
//      The tests assert that each entry equals the token BaseLayout declares,
//      so the two can never drift into two different opinions about the pane.
//
// The design rule the numbers come from: the pane is `--bg-deep`, one step
// DOWN from the panel around it: 1.12:1 on dark, 1.09:1 on light. The same
// hole in both themes. What sits IN that hole rises: `--bg-surface` on dark,
// pure white on light. On dark it rises by being a lighter surface; on light
// there is no lighter surface left, so it rises by casting a shadow. Two
// mechanisms, one hierarchy.
import type { ForjaTheme } from './site-theme'

export interface ForjaCanvasPalette {
  // The drawing surface itself.
  paneBg: string
  // A node card sitting on it.
  nodeBg: string
  // A connection at rest, and one the player has selected.
  edgeDefault: string
  edgeSelected: string
  // The three band names, and the rules between them.
  bandLabel: string
  bandDivider: string
  // The accent as a graphical object on the pane: the ring around a selected
  // node, the handle on a selected connection.
  selectionMark: string
}

export const FORJA_CANVAS_HEX: Record<ForjaTheme, ForjaCanvasPalette> = {
  dark: {
    paneBg: '#0a0f1a', // rgb(var(--bg-deep))
    nodeBg: '#131b2e', // rgb(var(--bg-surface))
    edgeDefault: '#7c8db5', // rgb(var(--txt-muted))
    edgeSelected: '#e2e8f0', // rgb(var(--txt-primary))
    bandLabel: '#7c8db5', // rgb(var(--txt-muted))
    bandDivider: '#334c73',
    selectionMark: '#10b981', // rgb(var(--accent))
  },
  light: {
    paneBg: '#ecf0f6',
    nodeBg: '#ffffff',
    edgeDefault: '#5b6b81',
    edgeSelected: '#1e293b',
    bandLabel: '#5b6b81',
    bandDivider: '#94a3b8',
    selectionMark: '#059669', // rgb(var(--accent-strong))
  },
}

// The pane colour as something a `fill` can take. React Flow draws the plate
// behind a connection's label with it, so the label stays readable where it
// crosses another cable.
export const CANVAS_PANE_VAR = 'var(--forja-pane)'

// Applied as an inline style on <ReactFlow> in ForjaCanvas.tsx. The last two
// were added with the light theme: React Flow's own light defaults for them are
// a #eee button border (1.1:1 against its own button) and a dot grid it picks
// itself, neither of which belongs to this brand.
export const CANVAS_EDGE_STYLE_VARS: Record<string, string> = {
  // React Flow paints the pane with
  // `var(--xy-background-color, var(--xy-background-color-default))`. Declaring
  // the colour anywhere without declaring THIS property changes nothing.
  '--xy-background-color': CANVAS_PANE_VAR,
  '--xy-edge-stroke-default': 'var(--forja-edge-default)',
  '--xy-edge-stroke-selected-default': 'var(--forja-edge-selected)',
  '--xy-background-pattern-color': 'var(--forja-pane-pattern)',
  '--xy-controls-button-border-color': 'var(--forja-controls-border)',
}
