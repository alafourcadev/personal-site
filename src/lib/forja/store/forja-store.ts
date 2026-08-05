// La Forja playground — domain state store. Pure TypeScript, no DOM/React
// import (design D1: "domain state is source of truth; React Flow is
// derived"). React Flow is authoritative for position only DURING a drag
// gesture; every other mutation, and the final committed position on
// `onNodeDragStop`, goes through here.
import { checkConnection } from '../engine'
import { CATALOG } from '../engine/catalog'
import { bandForType, clampToBand } from '../canvas/bands'
import type { ComponentType, ConnectionVerdict, Design, DesignEdge, DesignNode, PlayerColor, Zone } from '../engine/types'

export interface StorePosition {
  x: number
  y: number
}

export type ForjaStoreListener = () => void
export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

export interface ConnectResult {
  edge: DesignEdge | null
  verdict: ConnectionVerdict
}

// Fixed step for keyboard-driven moves (PC2's keyboard scenario) — not tied
// to any visual grid, since band containment/snapping is R1-D2 scope.
const KEYBOARD_MOVE_STEP = 16

const ARROW_DELTA: Record<ArrowDirection, StorePosition> = {
  up: { x: 0, y: -KEYBOARD_MOVE_STEP },
  down: { x: 0, y: KEYBOARD_MOVE_STEP },
  left: { x: -KEYBOARD_MOVE_STEP, y: 0 },
  right: { x: KEYBOARD_MOVE_STEP, y: 0 },
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export class ForjaStore {
  private design: Design
  // One snapshot per committed mutation — undo is a plain stack pop, so
  // "restores the same two ports" (PC6) holds by construction: it is the
  // exact prior Design object, ids included.
  private history: Design[] = []
  private listeners = new Set<ForjaStoreListener>()

  constructor(initial: Design = { nodes: [], edges: [] }) {
    this.design = initial
  }

  getDesign(): Design {
    return this.design
  }

  subscribe(listener: ForjaStoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  canUndo(): boolean {
    return this.history.length > 0
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }

  // Every structural or positional mutation goes through here so undo has
  // exactly one place that records history.
  private commit(design: Design): void {
    this.history.push(this.design)
    this.design = design
    this.emit()
  }

  createNode(type: ComponentType, label: string, position: StorePosition): DesignNode {
    const entry = CATALOG[type]
    // Seeds the catalog's default props (e.g. database's `backup: 'none'`) —
    // rules.ts reads these to raise findings; an empty object would make
    // every node-level rule permanently silent for player-created nodes.
    const node: DesignNode = {
      id: randomId('node'),
      type,
      label,
      zone: entry.zone,
      props: { ...entry.props },
      position,
    }
    this.commit({ ...this.design, nodes: [...this.design.nodes, node] })
    return node
  }

  // Single source of truth for band containment (PC7's design note) — both
  // the drag-stop commit and keyboard moves route through here, so neither
  // gesture can push a node past its band regardless of how far the raw
  // input tries to move it. See bands.ts for why this is a manual clamp
  // rather than React Flow's `extent: 'parent'`.
  moveNode(nodeId: string, position: StorePosition): void {
    const node = this.design.nodes.find((n) => n.id === nodeId)
    if (!node) return
    const clamped = clampToBand(position, bandForType(node.type))
    this.commit({
      ...this.design,
      nodes: this.design.nodes.map((n) => (n.id === nodeId ? { ...n, position: clamped } : n)),
    })
  }

  moveNodeByKeyboard(nodeId: string, direction: ArrowDirection): void {
    const node = this.design.nodes.find((n) => n.id === nodeId)
    if (!node?.position) return
    const delta = ARROW_DELTA[direction]
    this.moveNode(nodeId, { x: node.position.x + delta.x, y: node.position.y + delta.y })
  }

  // PC15's "Renombrar" menu action — blank input is a no-op (keeps the
  // original label) rather than committing an empty string, matching the
  // rest of the store's "invalid input never mutates" convention.
  renameNode(nodeId: string, label: string): void {
    const trimmed = label.trim()
    if (!trimmed) return
    if (!this.design.nodes.some((n) => n.id === nodeId)) return
    this.commit({
      ...this.design,
      nodes: this.design.nodes.map((n) => (n.id === nodeId ? { ...n, label: trimmed } : n)),
    })
  }

  // PC15's "Duplicar" menu action — same offset convention the prototype
  // used (forja-app.html's ctxAction 'dup'), but keeps the label (suffixed)
  // rather than dropping it, so the copy is identifiable in the list view
  // without relying on position alone.
  duplicateNode(nodeId: string): DesignNode | null {
    const original = this.design.nodes.find((n) => n.id === nodeId)
    if (!original) return null
    const copy: DesignNode = {
      ...original,
      id: randomId('node'),
      label: `${original.label} (copia)`,
      position: original.position ? { x: original.position.x + 28, y: original.position.y + 28 } : undefined,
    }
    this.commit({ ...this.design, nodes: [...this.design.nodes, copy] })
    return copy
  }

  // PC16: purely presentational — never read by anything under
  // src/lib/forja/engine (tests/engine/color-neutral.test.ts is the
  // regression guard for that claim).
  setNodeColor(nodeId: string, color: PlayerColor): void {
    if (!this.design.nodes.some((n) => n.id === nodeId)) return
    this.commit({
      ...this.design,
      nodes: this.design.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n)),
    })
  }

  // Reuses the exact module the scorer gates on (design D1's connection
  // gesture diagram) — this store never re-implements legality.
  connect(fromNodeId: string, toNodeId: string): ConnectResult {
    const verdict = checkConnection(this.design, { node: fromNodeId }, { node: toNodeId })
    if (!verdict.ok) return { edge: null, verdict }

    const edge: DesignEdge = { id: randomId('edge'), from: { node: fromNodeId }, to: { node: toNodeId } }
    this.commit({ ...this.design, edges: [...this.design.edges, edge] })
    return { edge, verdict }
  }

  deleteEdge(edgeId: string): void {
    if (!this.design.edges.some((e) => e.id === edgeId)) return
    this.commit({ ...this.design, edges: this.design.edges.filter((e) => e.id !== edgeId) })
  }

  // Removes the node and every edge attached to it in a single history
  // entry, so one undo restores both (PC5 + PC6 together).
  deleteNode(nodeId: string): void {
    if (!this.design.nodes.some((n) => n.id === nodeId)) return
    this.commit({
      nodes: this.design.nodes.filter((n) => n.id !== nodeId),
      edges: this.design.edges.filter((e) => e.from.node !== nodeId && e.to.node !== nodeId),
    })
  }

  undo(): boolean {
    const previous = this.history.pop()
    if (!previous) return false
    this.design = previous
    this.emit()
    return true
  }
}
