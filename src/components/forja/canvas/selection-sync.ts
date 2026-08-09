// React Flow emits `onSelectionChange` on its own schedule, including on
// remount and after an internal store sync, frequently with a selection
// identical to the one already held. Rebuilding the Set every time gives it a
// new identity, and the canvas keys its node/edge reprojection effect on that
// identity, so an unchanged selection still produced a new nodes array, which
// React Flow synced back into its store, which emitted selection-change
// again. That is an infinite render loop, and it unmounted the entire
// playground (React error #185, "Maximum update depth exceeded").
//
// The reproduction, with physical input: open an exercise, drag any node,
// switch to "Vista de lista", switch back to "Lienzo". The drag matters,
// because it leaves a selection behind for the remount to re-emit.
//
// Comparing by membership rather than identity is the whole fix: a
// selection-change that changes nothing must produce no state write.
export function sameSelection(current: ReadonlySet<string>, incoming: readonly string[]): boolean {
  // Deduplicated first: counting a repeated id as two members would report a
  // change on every emit and reopen the loop this function exists to close.
  const next = new Set(incoming)
  if (next.size !== current.size) return false
  for (const id of next) {
    if (!current.has(id)) return false
  }
  return true
}
