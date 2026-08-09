// Visual band backdrop [design note "Band mapping", PC7]. Deliberately NOT
// a React Flow node. See bands.ts for why `extent: 'parent'` was rejected.
// Reads React Flow's own `useViewport()` and applies the identical
// translate/scale transform to a plain decorative layer, so the three
// lanes pan and zoom in perfect sync with real nodes without ever being
// part of the `nodes` array (which would break every existing Playwright
// assertion that counts `.react-flow__node`).
//
// The lanes and their names are drawn in two different spaces on purpose.
// The dividers belong to the diagram, so they stay inside the transformed
// layer. The names are chrome: they used to ride the same transform, held up
// by a `sticky top-2` with no scrolling ancestor to stick to, and once the
// starting designs got taller `fitView` framed the content low enough to carry
// the whole label row out of the pane, measured at 36 of 60 exercise/width
// framings. They are now placed in the pane's own screen space by
// band-label-position.ts, which is where the geometry is tested.
import { useViewport } from '@xyflow/react'
import { useEffect, useRef, useState } from 'react'
import { BAND_ORDER, BAND_TOP, BAND_WIDTH } from '../../../lib/forja/canvas/bands'
import { bandLabelPlacements } from '../../../lib/forja/canvas/band-label-position'
import type { Layer } from '../../../lib/forja/engine/types'

const BAND_LABEL: Record<Layer, string> = {
  business: 'Negocio',
  application: 'Aplicación',
  infrastructure: 'Infraestructura',
}

// A band is a column, not a box, and this is how far the column is drawn.
//
// It used to run from the bands' own top edge downwards only, on the argument
// that a diagram grows downwards and nothing is ever above it. That stopped
// being true when the camera started framing the three bands instead of just
// the pieces (band-camera.ts): on a diagram narrower than the bands the camera
// zooms out far enough to show empty canvas above them. Measured on a
// production build of `/forja/4/n4-el-pago-que-espera-al-email` at 1440 with
// the objective open, the pane's top edge sat at flow y -323, so the top 200px
// of the pane had no divider in it at all while the three band NAMES, which
// are chrome and always sit at the top of the pane, labelled nothing.
//
// Drawn symmetrically now, and the number is the same kind of "wider than any
// camera will reach" the 4000 always was: at the camera's own zoom floor of
// 0.2 a 768px pane sees 3840 flow units, so 4000 above and 4000 below covers
// every camera a player can reach from the frame the exercise opens on.
const LANE_REACH = 4000
const LANE_TOP = BAND_TOP - LANE_REACH
const LANE_HEIGHT = LANE_REACH * 2

export interface BandLaneProps {
  // How far down the pane the names start. It is the same number the camera
  // keeps clear at the top (forja-shell.ts's briefFitPadding), which is what
  // stops the objective card's folded strip from covering all three names at
  // once: fold the card and the strip takes the top 40px, so the names move
  // to just under it rather than behind it.
  labelTopPx: number
}

export function BandLane({ labelTopPx }: BandLaneProps) {
  const { x, y, zoom } = useViewport()
  const paneRef = useRef<HTMLDivElement>(null)
  const [paneWidth, setPaneWidth] = useState(0)

  // The placement needs the pane's real width, and the pane is resized by
  // three things that never notify React: the window, the tab bar switching
  // panes, and the result panel opening beside the canvas. ResizeObserver is
  // the only one of those that reports all three.
  useEffect(() => {
    const pane = paneRef.current
    if (!pane) return
    const observer = new ResizeObserver(([entry]) => setPaneWidth(entry.contentRect.width))
    observer.observe(pane)
    setPaneWidth(pane.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={paneRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
      data-testid="band-lanes"
    >
      <div style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        {BAND_ORDER.map((layer, index) => (
          <div
            key={layer}
            className="absolute border-r border-forja-divider"
            style={{ left: index * BAND_WIDTH, top: LANE_TOP, width: BAND_WIDTH, height: LANE_HEIGHT }}
          />
        ))}
      </div>
      {/* `leading-4` rather than `text-xs`: the size is the decision
          band-label-position.ts makes (a phone's bands are too narrow for
          "Infraestructura" at 12px), and the line height stays fixed so the
          row sits at the same height whichever size it lands on. */}
      {bandLabelPlacements({ x, zoom }, paneWidth).map(({ layer, leftPx, fontPx }) => (
        <span
          key={layer}
          data-testid={`band-label-${layer}`}
          className="absolute select-none whitespace-nowrap leading-4 font-semibold uppercase tracking-wide text-txt-muted"
          style={{ left: leftPx, top: labelTopPx, fontSize: fontPx }}
        >
          {BAND_LABEL[layer]}
        </span>
      ))}
    </div>
  )
}
