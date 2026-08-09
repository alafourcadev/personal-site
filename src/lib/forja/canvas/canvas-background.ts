// The grid the diagram is drawn on.
//
// WHY IT EXISTS AS A MODULE. It shipped as `<Background />` with nothing
// passed: React Flow's defaults, `gap: 20` and `size: 1`, which is the library
// choosing how this product's working surface looks. The colour was already
// per theme, and the two themes were not the same grid: measured against each
// pane, dark was 2.57:1 and light 1.56:1, so the theme the product opens in
// had a surface almost twice as loud as the other one.
//
// WHAT A GRID IS FOR HERE. Two jobs, and they pull against each other. It has
// to say "this is a working surface with a scale", which is what makes a
// diagram feel placed rather than floating in a void. And it has to disappear
// behind the drawing, because every mark that competes with a connection is a
// mark the player has to read past. The resolution is a quiet colour and a dot
// big enough to survive being scaled down, rather than a loud colour and a
// small dot, which is what was there.
//
// WHY THE ZOOM MATTERS. React Flow multiplies BOTH the gap and the dot size by
// the live zoom (dotGridOnScreen mirrors its arithmetic). So a grid is never
// one look: it is a family of looks across every zoom the camera settles on.
// Picked at one zoom, it is a tint at another and invisible at a third.

// What the pane actually renders.
//
//   gap 26   the tile. At the zooms this workbench reaches it puts the dots
//            17px to 31px apart, which reads as a measured surface. The
//            library's 20 put them 14px apart at the widest framing, close
//            enough to start reading as a texture rather than as a scale.
//   size 1.5 the dot. It is the number that survives the camera: at the
//            SMALLEST zoom the workbench settles on, 1.5 is still just over a
//            real pixel, while the library's 1 was 0.69 of one, an
//            antialiased smudge repeated a few thousand times.
// `BackgroundVariant` is React Flow's own enum, imported rather than spelled as
// the string it happens to equal: this module's whole job is to make a choice
// on that component's behalf, and taking its type is what makes the compiler
// check the choice is one the component actually offers.
import { BackgroundVariant } from '@xyflow/react'

export const CANVAS_DOT_GRID = {
  variant: BackgroundVariant.Dots,
  gap: 26,
  size: 1.5,
} as const

// The zooms `fitView` actually settles on inside La Forja's shell, measured on
// `/forja/1/n1-el-comprobante-que-no-se-guarda` against a production build at
// 1133, 1440 and 1512, with the statement rail and the tools rail in all four
// combinations, and with the verdict open.
//
// It is deliberately NOT the camera's own limits. React Flow's floor here is
// MIN_ZOOM = 0.2 (ForjaCanvas.tsx), which exists so a narrow pane can see a
// whole graph at all, and the code that lowered it already calls legibility at
// that zoom "bad on purpose". A grid cannot be designed for a zoom the product
// itself calls a compromise, so what it is designed for is the range a player
// on a laptop actually looks at, and it degrades honestly outside it: quiet
// colour first means the failure at extreme zoom-out is a faintly lighter pane,
// never noise over the diagram.
export const SHELL_ZOOM_RANGE = { min: 0.68, max: 1.53 } as const

export interface DotGridOnScreen {
  spacingPx: number
  diameterPx: number
}

// What the grid measures on the player's screen at a given camera zoom.
//
// A mirror of React Flow's own Background maths (`scaledGap = gap * zoom`,
// `radius = size * zoom / 2`), which is what makes the choice above provable
// in a unit test instead of only inspectable in a browser.
export function dotGridOnScreen(zoom: number): DotGridOnScreen {
  return {
    spacingPx: CANVAS_DOT_GRID.gap * zoom,
    diameterPx: CANVAS_DOT_GRID.size * zoom,
  }
}
