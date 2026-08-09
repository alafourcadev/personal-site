// La Forja playground: domain state store. Pure TypeScript, no DOM or React
// import (design D1: "domain state is source of truth; React Flow is
// derived"). React Flow is authoritative for position only DURING a drag
// gesture; every other mutation, and the final committed position on
// `onNodeDragStop`, goes through here.
import { checkConnection } from '../engine'
import { CATALOG, type PlayerNodePropertyKey } from '../engine/catalog'
import { bandForType, clampToBand } from '../canvas/bands'
import { isPlayerNodePropertyValue } from '../playground/node-properties'
import type { ComponentType, ConnectionVerdict, DataClass, Design, DesignEdge, DesignNode, PlayerColor, Zone } from '../engine/types'

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

// Fixed step for keyboard-driven moves (PC2's keyboard scenario), not tied
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
  // One snapshot per committed mutation. Undo is a plain stack pop, so
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
    // Seeds the catalog's default props (e.g. database's `backup: 'none'`).
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

  // Single source of truth for band containment (PC7's design note). Both
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

  // "Ordenar el diagrama": one arrangement, one history entry, so Ctrl+Z is
  // one press and not one press per piece.
  //
  // It goes through the same band clamp every other movement does. A layout is
  // not allowed to be the one path that can put a piece outside its own band,
  // however carefully auto-layout.ts already places them.
  //
  // Returns whether anything actually moved, and commits nothing when nothing
  // did. That is what makes pressing the button on an already arranged diagram
  // a real no-op instead of an empty history entry the player then has to undo
  // before reaching their own last action.
  applyPositions(positions: Record<string, StorePosition>): boolean {
    let moved = false
    const nodes = this.design.nodes.map((node) => {
      const next = positions[node.id]
      if (!next) return node
      const clamped = clampToBand(next, bandForType(node.type))
      if (node.position?.x === clamped.x && node.position?.y === clamped.y) return node
      moved = true
      return { ...node, position: clamped }
    })
    if (!moved) return false
    this.commit({ ...this.design, nodes })
    return true
  }

  moveNodeByKeyboard(nodeId: string, direction: ArrowDirection): void {
    const node = this.design.nodes.find((n) => n.id === nodeId)
    if (!node?.position) return
    const delta = ARROW_DELTA[direction]
    this.moveNode(nodeId, { x: node.position.x + delta.x, y: node.position.y + delta.y })
  }

  // PC15's "Renombrar" menu action. Blank input is a no-op (it keeps the
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

  // PC15's "Duplicar" menu action, with the same offset convention the prototype
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

  // PC16: purely presentational, never read by anything under
  // src/lib/forja/engine (tests/engine/color-neutral.test.ts is the
  // regression guard for that claim).
  setNodeColor(nodeId: string, color: PlayerColor): void {
    if (!this.design.nodes.some((n) => n.id === nodeId)) return
    this.commit({
      ...this.design,
      nodes: this.design.nodes.map((n) => (n.id === nodeId ? { ...n, color } : n)),
    })
  }

  // A property can change the engine verdict, so the mutation accepts only
  // the closed choices declared by that component type. Invalid input and an
  // already selected value are real no-ops: neither notifies nor consumes an
  // undo step.
  setNodeProperty(nodeId: string, key: PlayerNodePropertyKey, value: string): boolean {
    const node = this.design.nodes.find((candidate) => candidate.id === nodeId)
    if (!node || !isPlayerNodePropertyValue(node.type, key, value) || node.props[key] === value) return false
    this.commit({
      ...this.design,
      nodes: this.design.nodes.map((candidate) =>
        candidate.id === nodeId
          ? { ...candidate, props: { ...candidate.props, [key]: value } }
          : candidate,
      ),
    })
    return true
  }

  // Reuses the exact module the scorer gates on (design D1's connection
  // gesture diagram). This store never re-implements legality.
  connect(fromNodeId: string, toNodeId: string): ConnectResult {
    const verdict = checkConnection(this.design, { node: fromNodeId }, { node: toNodeId })
    if (!verdict.ok) return { edge: null, verdict }

    const edge: DesignEdge = { id: randomId('edge'), from: { node: fromNodeId }, to: { node: toNodeId } }
    this.commit({ ...this.design, edges: [...this.design.edges, edge] })
    return { edge, verdict }
  }

  // The sibling of setNodeColor above, and its opposite in kind. A colour is a
  // personal annotation the engine promises never to read
  // (tests/engine/color-neutral.test.ts); a data class is a domain fact three
  // engine rules already gate on (volatile-durable-mismatch,
  // pii-to-external-model, regulated-without-backup). The engine has read
  // `DesignEdge.dataClass` since R1-B, but until now nothing could write it, so
  // those three rules were unreachable for every connection a player drew.
  //
  // `undefined` clears the declaration and DELETES the key rather than storing
  // an explicit undefined: `evaluateRules` tests `if (!e.dataClass)` to raise
  // the "Falta declarar qué dato viaja" note, and the whole design persists
  // through JSON (local-adapter.ts), where an explicit undefined disappears
  // anyway. Deleting keeps the in-memory shape and the reloaded shape identical.
  setEdgeDataClass(edgeId: string, dataClass?: DataClass): void {
    if (!this.design.edges.some((e) => e.id === edgeId)) return
    this.commit({
      ...this.design,
      edges: this.design.edges.map((e) => {
        if (e.id !== edgeId) return e
        if (!dataClass) {
          const { dataClass: _cleared, ...rest } = e
          return rest
        }
        return { ...e, dataClass }
      }),
    })
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

  // R1-H item 4: "reiniciar el ejercicio". It goes back to the given design
  // (the exercise's own startingDesign) through the exact same commit path
  // as every other mutation, so it is undoable like anything else and never a
  // special escape hatch that bypasses history.
  resetTo(design: Design): void {
    this.commit(design)
  }

  undo(): boolean {
    const previous = this.history.pop()
    if (!previous) return false
    this.design = previous
    this.emit()
    return true
  }
}
