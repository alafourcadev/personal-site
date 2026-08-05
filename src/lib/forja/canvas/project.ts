// Projects the domain Design into React Flow's node/edge shape (design D1:
// React Flow is derived, the store is authoritative for structure). Pure
// object mapping — depends on @xyflow/react's types only, never touches the
// DOM, so it is unit-testable without a browser.
import { Position } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { composeNodeAccessibleName } from './accessible-name'
import { PLAYER_COLORS } from './player-colors'
import type { ComponentType, Design, PlayerColor, Zone } from '../engine/types'

export interface ForjaNodeData extends Record<string, unknown> {
  label: string
  componentType: ComponentType
  zone: Zone
  hasError: boolean
  color?: PlayerColor
  // R1-E: a hovered result-panel finding dims every node/edge outside its
  // own nodeIds/edgeIds, so the finding visibly points at the canvas
  // instead of the player translating prose into geometry by hand.
  dimmed: boolean
}

export type ForjaFlowNode = Node<ForjaNodeData, 'forja'>
export type ForjaFlowEdge = Edge

const EMPTY_SET: ReadonlySet<string> = new Set()

export function projectNodes(
  design: Design,
  selectedNodeIds: ReadonlySet<string>,
  errorNodeIds: ReadonlySet<string>,
  dimmedNodeIds: ReadonlySet<string> = EMPTY_SET,
): ForjaFlowNode[] {
  return design.nodes.map((node) => {
    const selected = selectedNodeIds.has(node.id)
    const hasError = errorNodeIds.has(node.id)
    const colorLabel = node.color ? PLAYER_COLORS[node.color].label : undefined
    return {
      id: node.id,
      type: 'forja',
      position: node.position ?? { x: 0, y: 0 },
      selected,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      ariaLabel: composeNodeAccessibleName({ ...node, colorLabel }, { selected, hasError }),
      // "Every component explains itself on hover and on focus": the
      // description ForjaNode renders as a child span (id `node-desc-
      // {id}`) is bound to the actual focusable wrapper element via this
      // — `domAttributes` is the only way to reach `.react-flow__node`
      // itself (className/event handlers are excluded from its type on
      // purpose, so this never fights the library's own gesture wiring).
      domAttributes: { 'aria-describedby': `node-desc-${node.id}` },
      data: {
        label: node.label,
        componentType: node.type,
        zone: node.zone,
        hasError,
        color: node.color,
        dimmed: dimmedNodeIds.has(node.id),
      },
    }
  })
}

export function projectEdges(
  design: Design,
  selectedEdgeIds: ReadonlySet<string>,
  errorEdgeIds: ReadonlySet<string>,
  dimmedEdgeIds: ReadonlySet<string> = EMPTY_SET,
): ForjaFlowEdge[] {
  const labelOf = (nodeId: string) => design.nodes.find((n) => n.id === nodeId)?.label ?? '?'

  return design.edges.map((edge) => {
    const hasError = errorEdgeIds.has(edge.id)
    const dimmed = dimmedEdgeIds.has(edge.id)
    const style: Record<string, unknown> = {}
    if (hasError) style.stroke = 'rgb(var(--accent-red))'
    if (dimmed) style.opacity = 0.25
    return {
      id: edge.id,
      source: edge.from.node,
      target: edge.to.node,
      selected: selectedEdgeIds.has(edge.id),
      focusable: true,
      deletable: true,
      ariaLabel: `Conexión de ${labelOf(edge.from.node)} a ${labelOf(edge.to.node)}${hasError ? ', con advertencia' : ''}`,
      style: Object.keys(style).length > 0 ? style : undefined,
    }
  })
}
