// A pointer target for every connection, pinned to the connection's own
// midpoint. See edge-hit.ts for the measurements: 73 of 964 connections
// across the 165 playable exercises could not be selected by clicking their
// own midpoint: some because they are 0-6px long, some because a node is
// painted over the stroke, some because a neighbouring connection's
// interaction band wins the hit test and the player deletes the wrong one.
//
// `ViewportPortal` is the point of the whole component: it is the ONLY
// layer React Flow renders AFTER its node renderer inside the same
// transformed viewport (read directly from @xyflow/react's GraphView:
// EdgeRenderer, connection line, edge-label renderer, NodeRenderer,
// viewport-portal, in that order), so a target rendered there is never
// buried by a node. The explicit z-index above 1000 covers the one case
// DOM order does not: React Flow's `elevateNodesOnSelect` gives a selected
// node z-index 1000.
//
// The midpoint itself is read from the path React Flow actually drew
// (`getPointAtLength(length / 2)`) rather than recomputed from node
// positions: the target then sits exactly on the curve the player sees, for
// every edge type, with no second implementation of the path maths that
// could drift from the library's.
import { ViewportPortal, useReactFlow, useStore } from '@xyflow/react'
import { useCallback, useEffect, useState } from 'react'
import {
  EDGE_HIT_TARGET_PX,
  edgeHitTargetStyle,
  ownerOfPointer,
  pickHitPoint,
  type HitTarget,
} from '../../../lib/forja/canvas/edge-hit'
import type { ForjaFlowEdge, ForjaFlowNode } from '../../../lib/forja/canvas/project'
import './edge-hit-target.css'

export interface EdgeHitTargetsProps {
  edges: ForjaFlowEdge[]
  // Not read directly: it is the change signal. Node positions and node
  // measurements are what move a connection's midpoint, and both arrive as
  // a new `nodes` array.
  nodes: ForjaFlowNode[]
  selectedEdgeIds: ReadonlySet<string>
  onSelect: (edgeId: string) => void
  // A right-click has to reach the same connection a left-click does. Without
  // this the target, which sits at z-index 1200 precisely so nothing buries it,
  // swallowed the `contextmenu` event's position and let it bubble to the
  // pane, so right-clicking a connection opened the "add component" menu.
  onContextMenu: (edgeId: string, event: React.MouseEvent) => void
  edgeLabel: (edgeId: string) => string
}

function pathOf(edgeId: string): SVGPathElement | null {
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(edgeId) : edgeId
  return document.querySelector<SVGPathElement>(`.react-flow__edge[data-id="${escaped}"] .react-flow__edge-path`)
}

export function EdgeHitTargets({ edges, nodes, selectedEdgeIds, onSelect, onContextMenu, edgeLabel }: EdgeHitTargetsProps) {
  const zoom = useStore((state) => state.transform[2])
  const { screenToFlowPosition } = useReactFlow()
  const [targets, setTargets] = useState<HitTarget[]>([])

  // Two boxes 24px wide kept 24px apart still overlap, and the browser
  // resolves an overlap by paint order, so the connection drawn last
  // answered for every point it covered, including the exact centre of the
  // one drawn first. The press names where it landed; ownerOfPointer names
  // whose it is. See edge-hit.ts for the measurement.
  const ownerOf = useCallback(
    (pressedId: string, event: React.MouseEvent) =>
      ownerOfPointer(targets, screenToFlowPosition({ x: event.clientX, y: event.clientY }), zoom, pressedId),
    [targets, screenToFlowPosition, zoom],
  )

  // Measured after paint, on the next frame: on the first render of a
  // loaded exercise the edge paths do not exist yet, because React Flow needs the
  // nodes' real measurements before it can lay a single edge out.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const next: HitTarget[] = []
      // The separation is expressed in flow units because the points are:
      // a target is EDGE_HIT_TARGET_PX wide ON SCREEN, which is that many
      // flow units divided by the current zoom.
      const minDistance = EDGE_HIT_TARGET_PX / Math.max(zoom, 0.01)
      for (const edge of edges) {
        const path = pathOf(edge.id)
        if (!path) continue
        const length = path.getTotalLength()
        // A zero-length path still yields a point: those are exactly the
        // 0px and 1px connections the sweep found, and they need a target
        // more than any other connection does.
        const point = pickHitPoint(
          (fraction) => {
            const p = path.getPointAtLength(length * fraction)
            return { x: p.x, y: p.y }
          },
          next,
          minDistance,
        )
        next.push({ id: edge.id, x: point.x, y: point.y })
      }
      setTargets((current) =>
        current.length === next.length && current.every((t, i) => t.id === next[i].id && t.x === next[i].x && t.y === next[i].y)
          ? current
          : next,
      )
    })
    return () => cancelAnimationFrame(frame)
    // `zoom` is a real input, not noise: how far apart two targets have to
    // be in flow units to stay distinguishable on screen depends on it.
  }, [edges, nodes, zoom])

  return (
    <ViewportPortal>
      {targets.map((target) => {
        const style = edgeHitTargetStyle(target, zoom)
        const selected = selectedEdgeIds.has(target.id)
        return (
          <div
            key={target.id}
            // `nopan`/`nodrag` are React Flow's own opt-out classes: without
            // them a press on this target starts a canvas pan instead of
            // selecting the connection.
            className="forja-edge-hit nopan nodrag"
            data-edge-hit={target.id}
            data-selected={selected ? 'true' : 'false'}
            title={edgeLabel(target.id)}
            // Pointer-only affordance, deliberately invisible to assistive
            // technology: the connection itself is already focusable and
            // already carries the accessible name (project.ts), so exposing
            // this would announce every connection twice.
            aria-hidden="true"
            onClick={(event) => {
              event.stopPropagation()
              onSelect(ownerOf(target.id, event))
            }}
            onContextMenu={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onContextMenu(ownerOf(target.id, event), event)
            }}
            style={{
              left: style.left,
              top: style.top,
              width: style.width,
              height: style.height,
              transform: style.transform,
              pointerEvents: 'all',
              zIndex: 1200,
            }}
          />
        )
      })}
    </ViewportPortal>
  )
}
