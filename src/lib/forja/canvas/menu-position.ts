// Clamps a menu's on-screen position to a bounding rect [PC15's "stay
// within the viewport", PC17's overlay containment]. Pure function: the
// caller decides what "bounds" means (the playground root's own
// getBoundingClientRect, converted to local coordinates); this never knows
// about the DOM, so it is Vitest-testable without a browser.
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export function clampMenuPosition(anchor: Point, menuSize: Size, bounds: Rect): Point {
  const maxX = bounds.x + bounds.width - menuSize.width
  const maxY = bounds.y + bounds.height - menuSize.height
  const x = Math.min(Math.max(anchor.x, bounds.x), Math.max(bounds.x, maxX))
  const y = Math.min(Math.max(anchor.y, bounds.y), Math.max(bounds.y, maxY))
  return { x, y }
}
