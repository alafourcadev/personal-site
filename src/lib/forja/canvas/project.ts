// Projects the domain Design into React Flow's node/edge shape (design D1:
// React Flow is derived, the store is authoritative for structure). Pure
// object mapping. It depends on @xyflow/react's types only and never touches the
// DOM, so it is unit-testable without a browser.
import { Position } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { composeNodeAccessibleName } from './accessible-name'
import { DATA_CLASSES, dataClassName } from './data-classes'
import { CANVAS_PANE_VAR } from './edge-theme'
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

// React Flow places an edge label at the connection's own midpoint, which is
// exactly where EdgeHitTargets pins the connection's pointer handle, and that
// handle is rendered in a layer ABOVE the SVG. Measured in the production
// build at zoom 1.2: the resting dot landed on a glyph of every label ("dato
// pe•rsonal"). Nudging the whole chip clear of the handle is the fix that keeps
// both: the handle stays exactly on the line, where the geometry in
// edge-hit.ts needs it, and the label reads as a caption under it.
//
// Applied to the text and to its background as ONE constant: the two are
// separate SVG elements (EdgeText renders a <rect> and a <text>), so two
// numbers here would eventually drift and tear the chip in half. The unit is a
// flow unit, so the offset scales with the camera and the caption never drifts
// away from its own line.
const EDGE_LABEL_OFFSET = 'translate(0, 14px)'

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
      // `domAttributes` is the only way to reach `.react-flow__node`
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

// What a connection tells assistive technology about its own gestures.
//
// Without this every connection kept React Flow's built-in description:
// "Press enter or space to select an edge. You can then press delete to
// remove it or escape to cancel." English text inside a document declared
// `lang="es"` (WCAG 3.1.2), listing a set of shortcuts that is not the set
// this playground implements. The nodes above already carried
// `domAttributes`; the edge mapping never got the same treatment.
//
// One shared description rather than one per connection: it is the same
// sentence for all of them, and 987 copies of it in the DOM would be 987
// copies to keep in step. ForjaCanvas renders the element this id points at.
export const EDGE_HELP_ID = 'forja-edge-help'
export const EDGE_HELP_TEXT =
  'Shift+F10 abre el menú de esta conexión, con las clases de dato y la opción de eliminarla.'

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
    const declared = edge.dataClass ? DATA_CLASSES[edge.dataClass] : null
    const style: Record<string, unknown> = {}
    // The class colour is the connection's baseline identity; the error red is
    // a state on top of it, and states win. Otherwise the annotation that
    // CAUSED the block would be the thing hiding it.
    if (declared) style.stroke = declared.stroke
    if (hasError) style.stroke = 'var(--forja-edge-error)'
    if (dimmed) style.opacity = 0.25
    return {
      id: edge.id,
      source: edge.from.node,
      target: edge.to.node,
      selected: selectedEdgeIds.has(edge.id),
      focusable: true,
      deletable: true,
      // "The player must be able to read the diagram and see what travels where
      // without opening a menu per connection." React Flow renders `label` as
      // real SVG text at the connection's own midpoint (BaseEdge -> EdgeText),
      // so the declaration is part of the drawing rather than a tooltip.
      // Undeclared connections stay unlabelled on purpose: the note in the
      // findings panel already says so, and a "sin declarar" tag on every fresh
      // connection would be the same permanent noise in a second place.
      label: declared?.label,
      labelStyle: declared ? { fill: declared.stroke, fontSize: 11, transform: EDGE_LABEL_OFFSET } : undefined,
      labelBgStyle: declared
        ? { fill: CANVAS_PANE_VAR, fillOpacity: 0.85, transform: EDGE_LABEL_OFFSET }
        : undefined,
      // Everything a sighted player reads off the drawing has to be said out
      // loud too, including the ABSENCE of a declaration, which is visible at
      // a glance and inaudible by default.
      ariaLabel:
        `Conexión de ${labelOf(edge.from.node)} a ${labelOf(edge.to.node)}` +
        `, ${dataClassName(edge.dataClass)}${hasError ? ', con advertencia' : ''}`,
      // Replaces React Flow's own English default. See EDGE_HELP_TEXT.
      domAttributes: { 'aria-describedby': EDGE_HELP_ID },
      style: Object.keys(style).length > 0 ? style : undefined,
    }
  })
}
