// Visual band backdrop [design note "Band mapping", PC7]. Deliberately NOT
// a React Flow node — see bands.ts for why `extent: 'parent'` was rejected.
// Reads React Flow's own `useViewport()` and applies the identical
// translate/scale transform to a plain decorative layer, so the three
// lanes pan and zoom in perfect sync with real nodes without ever being
// part of the `nodes` array (which would break every existing Playwright
// assertion that counts `.react-flow__node`).
import { useViewport } from '@xyflow/react'
import { BAND_ORDER, BAND_WIDTH } from '../../../lib/forja/canvas/bands'
import type { Layer } from '../../../lib/forja/engine/types'

const BAND_LABEL: Record<Layer, string> = {
  business: 'Negocio',
  application: 'Aplicación',
  infrastructure: 'Infraestructura',
}

const LANE_HEIGHT = 4000

export function BandLane() {
  const { x, y, zoom } = useViewport()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" data-testid="band-lanes">
      <div style={{ transform: `translate(${x}px, ${y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
        {BAND_ORDER.map((layer, index) => (
          <div
            key={layer}
            className="absolute top-0 border-r border-border-subtle/50"
            style={{ left: index * BAND_WIDTH, width: BAND_WIDTH, height: LANE_HEIGHT }}
          >
            <span className="sticky top-2 ml-3 select-none text-xs font-semibold uppercase tracking-wide text-txt-muted/70">
              {BAND_LABEL[layer]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
