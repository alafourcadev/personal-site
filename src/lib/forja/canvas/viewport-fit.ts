// R1-I ("the canvas frames its own content"). Pure geometry only, no DOM,
// no React Flow import. ForjaCanvas.tsx is the only caller, feeding it real
// `getBoundingClientRect()` rectangles (both node and pane come from the
// same viewport coordinate space, so a direct comparison is valid without
// any unit conversion).
export interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

// Whether `inner` sits entirely inside `outer`. Used to decide whether a
// just-created node already landed somewhere the player can see, or whether
// the camera needs to be refit so it does (spec "A newly added component is
// brought into view"). A `null`/collapsed outer rect (the pane hasn't
// measured yet) counts as "already visible": there is nothing to fit
// against, and refusing to refit is the safe default over refitting blind.
export function isFullyVisible(inner: ScreenRect, outer: ScreenRect | null): boolean {
  if (!outer || outer.right <= outer.left || outer.bottom <= outer.top) return true
  return inner.left >= outer.left && inner.top >= outer.top && inner.right <= outer.right && inner.bottom <= outer.bottom
}
