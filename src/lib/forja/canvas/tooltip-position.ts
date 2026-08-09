// Where a library entry's explanation is drawn. It used to be an absolutely
// positioned child of the library's own scrolling box, which clips in both
// axes: measured on a real page, the first entry's balloon showed 0 of its
// 78px of height and the last one 47 of 94, and all of them lost 16px of
// width. An explanation that exists but cannot be read is the same as no
// explanation, and these entries need theirs, because several labels are
// truncated by the panel's width.
//
// Pure geometry so the placement rules are asserted rather than eyeballed.
// The caller renders the tooltip with `position: fixed`, which is why the
// numbers here are viewport coordinates: a fixed box is not clipped by an
// ancestor's overflow.
export const TOOLTIP_GAP_PX = 8
const EDGE_MARGIN_PX = 8

export interface AnchorRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface TooltipSize {
  width: number
  height: number
}

export interface WindowSize {
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

export function tooltipPosition(
  anchor: AnchorRect,
  tooltip: TooltipSize,
  window: WindowSize,
): { left: number; top: number } {
  // Beside the entry, never below it: the library is a tall list, so a
  // balloon under an entry covers the next entries; beside it covers only
  // the canvas, which is empty at that edge.
  const right = anchor.right + TOOLTIP_GAP_PX
  const left = anchor.left - tooltip.width - TOOLTIP_GAP_PX
  const fitsRight = right + tooltip.width <= window.width - EDGE_MARGIN_PX
  const chosenLeft = fitsRight ? right : left

  return {
    left: clamp(chosenLeft, EDGE_MARGIN_PX, window.width - tooltip.width - EDGE_MARGIN_PX),
    top: clamp(anchor.top, 0, Math.max(0, window.height - tooltip.height)),
  }
}
