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
}

export type ForjaFlowNode = Node<ForjaNodeData, 'forja'>
export type ForjaFlowEdge = Edge

export function projectNodes(
  design: Design,
  selectedNodeIds: ReadonlySet<string>,
  errorNodeIds: ReadonlySet<string>,
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
      data: { label: node.label, componentType: node.type, zone: node.zone, hasError, color: node.color },
    }
  })
}

export function projectEdges(
  design: Design,
  selectedEdgeIds: ReadonlySet<string>,
  errorEdgeIds: ReadonlySet<string>,
): ForjaFlowEdge[] {
  const labelOf = (nodeId: string) => design.nodes.find((n) => n.id === nodeId)?.label ?? '?'

  return design.edges.map((edge) => {
    const hasError = errorEdgeIds.has(edge.id)
    return {
      id: edge.id,
      source: edge.from.node,
      target: edge.to.node,
      selected: selectedEdgeIds.has(edge.id),
      focusable: true,
      deletable: true,
      ariaLabel: `Conexión de ${labelOf(edge.from.node)} a ${labelOf(edge.to.node)}${hasError ? ', con advertencia' : ''}`,
      style: hasError ? { stroke: 'rgb(var(--accent-red))' } : undefined,
    }
  })
}
