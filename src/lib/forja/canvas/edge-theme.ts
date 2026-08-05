// R1-E contrast fix — a real, measured defect in the shipped
// implementation (verified via getComputedStyle in a real browser, and by
// reading @xyflow/react's own dist CSS — not guessed, not the prototype's
// numbers). ForjaCanvas.tsx fixes colorMode="dark" regardless of the
// site's own light/dark toggle, so this canvas has exactly one theme to
// fix: React Flow's own `.react-flow.dark`.
//
// The pane background (#141414) is @xyflow/react's own dark-mode default
// and is left unchanged — only the two edge-stroke variables are
// overridden, with the site's own dark-mode --txt-muted / --txt-primary
// tokens (BaseLayout.astro's html.dark block) converted to hex, so a
// player never sees a color that doesn't belong to the brand.
export const CANVAS_PANE_BG_HEX = '#141414'
// rgb(var(--txt-muted)) in html.dark = rgb(124 141 181)
export const EDGE_STROKE_DEFAULT_HEX = '#7c8db5'
// rgb(var(--txt-primary)) in html.dark = rgb(226 232 240)
export const EDGE_STROKE_SELECTED_HEX = '#e2e8f0'

// Applied as inline style on <ReactFlow> in ForjaCanvas.tsx. Inline style
// wins the CSS cascade over `.react-flow.dark`'s own class-scoped
// declaration of the same custom properties — an ancestor-level override
// would lose to the library's own rule, since it redeclares the property
// on the same element that carries the `.react-flow.dark` class itself.
export const CANVAS_EDGE_STYLE_VARS: Record<string, string> = {
  '--xy-edge-stroke-default': EDGE_STROKE_DEFAULT_HEX,
  '--xy-edge-stroke-selected-default': EDGE_STROKE_SELECTED_HEX,
}
