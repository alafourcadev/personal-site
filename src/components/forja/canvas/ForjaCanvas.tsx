// The playground canvas island — the ONLY React island on /forja (design
// D5, client:only="react"). Wires every R1-D1 gesture to the domain store:
// domain state is source of truth (D1); React Flow is authoritative for
// node position only DURING a drag, committed to the store on
// onNodeDragStop; every structural mutation (create/connect/delete/undo)
// goes straight through ForjaStore, never through React Flow's own state.
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type FinalConnectionState,
  type NodeChange,
  type OnConnect,
  type OnConnectEnd,
  type OnNodeDrag,
  type OnEdgesDelete,
  type OnNodesDelete,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { checkConnection, evaluateLegality } from '../../../lib/forja/engine'
import { CATALOG } from '../../../lib/forja/engine/catalog'
import type { ComponentType, ConnectionVerdict, Layer } from '../../../lib/forja/engine/types'
import { projectEdges, projectNodes, type ForjaFlowEdge, type ForjaFlowNode } from '../../../lib/forja/canvas/project'
import { bandForType, bandXRange, clampToBand } from '../../../lib/forja/canvas/bands'
import { useForjaStore } from '../../../lib/forja/store/useForjaStore'
import { CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import { PLAYER_COLORS, PLAYER_COLOR_ORDER } from '../../../lib/forja/canvas/player-colors'
import { BandLane } from './BandLane'
import { ComponentLibrary } from './ComponentLibrary'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { DesignList } from './DesignList'
import { ForjaNode } from './ForjaNode'

const NODE_TYPES = { forja: ForjaNode }
const DELETE_KEYS = ['Backspace', 'Delete']

// PC15: node menus are scoped to the right-clicked node; the pane menu adds
// a component at the click's flow position.
type ContextMenuState =
  | { kind: 'node'; nodeId: string; x: number; y: number }
  | { kind: 'pane'; x: number; y: number; flowPosition: { x: number; y: number } }

function isForjaNodeElement(el: Element | null): el is HTMLElement {
  return !!el && el.classList.contains('react-flow__node') && el.hasAttribute('data-id')
}

// Places a newly created node inside its own band from the start (PC7
// design note) — stacked vertically by how many siblings of the same band
// already exist, so two nodes never spawn on top of each other. Fixes a
// real bug the band-clamp introduced: the previous grid ignored type/band
// entirely, so a freshly created node could spawn outside its own band and
// visibly jump into it on the very first drag.
function nextCreatePosition(layer: Layer, countInBand: number) {
  const { min } = bandXRange(layer)
  return { x: min, y: 80 + countInBand * 110 }
}

function ForjaCanvasInner() {
  const { store, design } = useForjaStore()
  const { screenToFlowPosition } = useReactFlow()
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'canvas' | 'list'>('canvas')
  const [status, setStatus] = useState('')
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const pendingFocusId = useRef<string | null>(null)
  // PC17: the root everything below renders inside — `relative isolate` on
  // it (see the JSX below) is what keeps ContextMenu's `position: absolute`
  // contained to the playground's own box, never the site header.
  const containerRef = useRef<HTMLDivElement>(null)

  const findings = useMemo(() => evaluateLegality(design).findings, [design])
  const errorNodeIds = useMemo(
    () => new Set(findings.filter((f) => f.severity === 'blocking').flatMap((f) => f.nodeIds)),
    [findings],
  )
  const errorEdgeIds = useMemo(
    () => new Set(findings.filter((f) => f.severity === 'blocking').flatMap((f) => f.edgeIds)),
    [findings],
  )

  const [nodes, setNodes] = useState<ForjaFlowNode[]>([])
  const [edges, setEdges] = useState<ForjaFlowEdge[]>([])

  // React Flow is derived from the store — this is the ONE place a fresh
  // projection is pushed into RF's local (controlled) state. It does not
  // fight an in-progress drag: position changes during a drag stay purely
  // local via onNodesChange until onNodeDragStop commits them, and this
  // effect only re-fires when the store's design (or selection) changes.
  // Layout effects, not plain effects: they run synchronously after the DOM
  // commit and before the browser paints, in declaration order, in the same
  // pass as the pending-focus effect below. Two rapid creations in a row
  // (fast enough that a plain `useEffect` doesn't get a chance to flush
  // between them) could otherwise leave the first `pendingFocusId` write
  // unresolved before the second overwrote it, or focus a node before its
  // own render had actually committed — reproducible under Playwright's
  // faster-than-human input, though invisible to a real player.
  useLayoutEffect(() => {
    setNodes(projectNodes(design, selectedNodeIds, errorNodeIds))
  }, [design, selectedNodeIds, errorNodeIds])

  useLayoutEffect(() => {
    setEdges(projectEdges(design, selectedEdgeIds, errorEdgeIds))
  }, [design, selectedEdgeIds, errorEdgeIds])

  useLayoutEffect(() => {
    if (!pendingFocusId.current) return
    const id = pendingFocusId.current
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
    if (el) {
      el.focus()
      pendingFocusId.current = null
    }
  }, [nodes])

  const announceVerdict = useCallback((verdict: ConnectionVerdict) => {
    setStatus(verdict.ok ? '' : `Conexión rechazada: ${verdict.why ?? ''} ${verdict.consequence ?? ''}`.trim())
  }, [])

  // Fix #7: undo used to leave the stale "X creado" text on screen (or any
  // other prior announcement) with no indication anything had happened —
  // the status bar is the same `role="status"` region for both, so an
  // explicit undo announcement replaces whatever was there before.
  const handleUndo = useCallback(() => {
    const undone = store.undo()
    setStatus(undone ? 'Se deshizo la última acción.' : 'No hay nada para deshacer.')
  }, [store])

  const handleCreate = useCallback(
    (type: ComponentType) => {
      const layer = bandForType(type)
      const countInBand = design.nodes.filter((n) => bandForType(n.type) === layer).length
      const node = store.createNode(type, CATALOG_UI[type].label, nextCreatePosition(layer, countInBand))
      pendingFocusId.current = node.id
      setStatus(`${CATALOG_UI[type].label} creado.`)
    },
    [store, design.nodes],
  )

  // Live band clamp (PC7 design note) — mirrors the store's own clamp in
  // moveNode() so the node visibly can't leave its band mid-drag, not just
  // snap back once onNodeDragStop commits. Both read the same bands.ts
  // function, so the two can never disagree about where the boundary is.
  // Only touches nodes with an ACTUAL position change in this batch — React
  // Flow also routes dimension-measurement events through onNodesChange,
  // and re-wrapping every node's object on every one of those (regardless
  // of change type) fed back into another measurement pass and produced a
  // real infinite render loop under Playwright, reproducible only in the
  // production build.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const movedIds = new Set(changes.filter((c) => c.type === 'position').map((c) => c.id))
      setNodes((current) => {
        const next = applyNodeChanges(changes, current) as ForjaFlowNode[]
        if (movedIds.size === 0) return next
        return next.map((n) => {
          if (!movedIds.has(n.id)) return n
          const domainNode = design.nodes.find((d) => d.id === n.id)
          if (!domainNode) return n
          return { ...n, position: clampToBand(n.position, bandForType(domainNode.type)) }
        })
      })
    },
    [design.nodes],
  )

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((current) => applyEdgeChanges(changes, current))
  }, [])

  const onNodeDragStop: OnNodeDrag<ForjaFlowNode> = useCallback(
    (_event, node) => {
      store.moveNode(node.id, node.position)
    },
    [store],
  )

  // Read-only prediction used by React Flow while the player is still
  // dragging (handle highlight feedback) — reuses the exact module the
  // scorer gates on, never a UI-side re-implementation of legality. The
  // store mutation itself happens once, in onConnect below.
  const isValidConnection = useCallback(
    (edgeOrConnection: Connection | ForjaFlowEdge) => {
      const source = 'source' in edgeOrConnection ? edgeOrConnection.source : undefined
      const target = 'target' in edgeOrConnection ? edgeOrConnection.target : undefined
      if (!source || !target) return false
      return checkConnection(design, { node: source }, { node: target }).ok
    },
    [design],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const result = store.connect(connection.source, connection.target)
      announceVerdict(result.verdict)
    },
    [store, announceVerdict],
  )

  // isValidConnection rejecting the drag means onConnect never fires for an
  // illegal pointer attempt — this is the only place that still sees the
  // gesture end, so it is the one that announces WHY it was refused.
  const onConnectEnd: OnConnectEnd = useCallback(
    (_event, connectionState: FinalConnectionState) => {
      if (connectionState.isValid !== false) return
      const fromId = connectionState.fromNode?.id
      const toId = connectionState.toNode?.id
      if (!fromId || !toId) return
      announceVerdict(checkConnection(design, { node: fromId }, { node: toId }))
    },
    [design, announceVerdict],
  )

  const onNodesDelete: OnNodesDelete<ForjaFlowNode> = useCallback(
    (deleted) => {
      deleted.forEach((node) => store.deleteNode(node.id))
    },
    [store],
  )

  const onEdgesDelete: OnEdgesDelete<ForjaFlowEdge> = useCallback(
    (deleted) => {
      deleted.forEach((edge) => store.deleteEdge(edge.id))
    },
    [store],
  )

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: selNodes, edges: selEdges }) => {
    setSelectedNodeIds(new Set(selNodes.map((n) => n.id)))
    setSelectedEdgeIds(new Set(selEdges.map((e) => e.id)))
  }, [])

  // Completes the context menu's "Conectar con…" (PC15) via a real pointer
  // click on the target — the same connectSourceId state machine the
  // keyboard 'c' command already drives, just finished by a different
  // gesture. checkConnection/store.connect stay the single implementation
  // of legality either way.
  //
  // Deliberately a raw window `click` listener, NOT React Flow's own
  // `onNodeClick` prop: calling store.connect() (which mutates `design`,
  // triggering a React state update) from directly inside RF's own
  // synthetic click handling caused a real, reproducible "Maximum update
  // depth exceeded" crash under Playwright — RF appears to do its own
  // internal state updates around node clicks, and nesting an app-level
  // state change inside that same synchronous handler produced a runaway
  // update chain in the production build specifically. Routing this through
  // the exact same pattern as the keyboard 'c' command (a capture-phase
  // window listener, entirely outside RF's event pipeline) avoids it.
  const connectSourceIdRef = useRef<string | null>(null)
  connectSourceIdRef.current = connectSourceId

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const sourceId = connectSourceIdRef.current
      if (!sourceId) return
      const targetEl = (event.target as HTMLElement | null)?.closest<HTMLElement>('.react-flow__node')
      const targetId = targetEl?.getAttribute('data-id')
      if (!targetId || targetId === sourceId) return
      const result = store.connect(sourceId, targetId)
      announceVerdict(result.verdict)
      setConnectSourceId(null)
    }
    window.addEventListener('click', onClick, { capture: true })
    return () => window.removeEventListener('click', onClick, { capture: true })
  }, [store, announceVerdict])

  // React Flow's own contextmenu hooks — never a hand-rolled pointerdown +
  // contextmenu race, which is exactly the prototype's B-class bug (right
  // button also triggered pointerdown, redrawing the canvas and destroying
  // the element before `contextmenu` fired, so the node menu could never
  // open). onNodeContextMenu/onPaneContextMenu already distinguish node vs
  // pane for us.
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: ForjaFlowNode) => {
    event.preventDefault()
    setSelectedNodeIds(new Set([node.id]))
    setContextMenu({ kind: 'node', nodeId: node.id, x: event.clientX, y: event.clientY })
  }, [])

  const screenToFlowPositionRef = useRef(screenToFlowPosition)
  screenToFlowPositionRef.current = screenToFlowPosition

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      const clientX = 'clientX' in event ? event.clientX : 0
      const clientY = 'clientY' in event ? event.clientY : 0
      const flowPosition = screenToFlowPositionRef.current({ x: clientX, y: clientY })
      setContextMenu({ kind: 'pane', x: clientX, y: clientY, flowPosition })
    },
    [],
  )

  const closeContextMenu = useCallback(
    (returnFocus: boolean) => {
      if (returnFocus && contextMenu?.kind === 'node') {
        pendingFocusId.current = null
        const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${contextMenu.nodeId}"]`)
        el?.focus()
      }
      setContextMenu(null)
    },
    [contextMenu],
  )

  // PC15's fixed action set (connect/rename/duplicate/colour/delete) plus
  // PC16's six swatches — every id here is also the Playwright test's
  // data-testid suffix (context-menu-item-<id>).
  const nodeMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (contextMenu?.kind !== 'node') return []
    const { nodeId } = contextMenu
    const domainNode = design.nodes.find((n) => n.id === nodeId)
    if (!domainNode) return []
    return [
      {
        id: 'connect',
        label: 'Conectar con…',
        onSelect: () => {
          setConnectSourceId(nodeId)
          setStatus('Modo conectar activo. Elegí el nodo destino con Tab y presioná Enter, o hacé clic en él. Escape para cancelar.')
        },
      },
      {
        id: 'rename',
        label: 'Renombrar',
        onSelect: () => {
          const next = window.prompt('Nuevo nombre', domainNode.label)
          if (next) store.renameNode(nodeId, next)
        },
      },
      {
        id: 'duplicate',
        label: 'Duplicar',
        onSelect: () => {
          const copy = store.duplicateNode(nodeId)
          if (copy) pendingFocusId.current = copy.id
        },
      },
      ...PLAYER_COLOR_ORDER.map((color) => ({
        id: `color-${color}`,
        label: PLAYER_COLORS[color].label,
        swatchClass: PLAYER_COLORS[color].swatchClass,
        onSelect: () => store.setNodeColor(nodeId, color),
      })),
      { id: 'delete', label: 'Eliminar', danger: true, onSelect: () => store.deleteNode(nodeId) },
    ]
  }, [contextMenu, design.nodes, store])

  const paneMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (contextMenu?.kind !== 'pane') return []
    const { flowPosition } = contextMenu
    return (Object.keys(CATALOG) as ComponentType[]).map((type) => ({
      id: `add-${type}`,
      label: CATALOG_UI[type].label,
      onSelect: () => {
        const node = store.createNode(type, CATALOG_UI[type].label, flowPosition)
        pendingFocusId.current = node.id
      },
    }))
  }, [contextMenu, store])

  // Keyboard connect command [PC3]: 'c' on a focused node starts connect
  // mode, Tab moves focus to the target, Enter completes it, Escape cancels.
  // Capture phase so this runs before React Flow's own Enter/Escape node
  // handling (elementSelectionKeys) can swallow the event.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement
      // PC15: ContextMenu key or Shift+F10 opens the focused node's menu —
      // anchored near the node itself since there is no pointer coordinate
      // for a keyboard-triggered open.
      if ((event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) && isForjaNodeElement(active)) {
        event.preventDefault()
        const id = active.getAttribute('data-id')!
        const rect = active.getBoundingClientRect()
        setContextMenu({ kind: 'node', nodeId: id, x: rect.left, y: rect.bottom })
        return
      }
      if (event.key === 'c' && !connectSourceId && isForjaNodeElement(active)) {
        const id = active.getAttribute('data-id')!
        setConnectSourceId(id)
        setStatus('Modo conectar activo. Elegí el nodo destino con Tab y presioná Enter. Escape para cancelar.')
        return
      }
      if (connectSourceId && event.key === 'Escape') {
        setConnectSourceId(null)
        setStatus('Conexión cancelada.')
        return
      }
      if (connectSourceId && event.key === 'Enter' && isForjaNodeElement(active)) {
        const targetId = active.getAttribute('data-id')!
        if (targetId === connectSourceId) return
        event.preventDefault()
        event.stopPropagation()
        const result = store.connect(connectSourceId, targetId)
        announceVerdict(result.verdict)
        setConnectSourceId(null)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [connectSourceId, store, announceVerdict, handleUndo])

  return (
    <div
      ref={containerRef}
      // PC17: `relative` gives ContextMenu its positioning ancestor;
      // `isolate` gives the whole playground its own stacking context, so
      // nothing rendered inside — no matter what z-index it uses — can ever
      // paint above the site's fixed navbar, which lives outside this box.
      className="relative isolate flex h-[75vh] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border-subtle"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface px-3 py-2">
        <div className="flex gap-1" role="tablist" aria-label="Vista del diseño">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'canvas'}
            onClick={() => setView('canvas')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'canvas' ? 'bg-accent-dim text-accent' : 'text-txt-secondary hover:text-txt-primary'}`}
          >
            Lienzo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'list'}
            onClick={() => setView('list')}
            data-testid="view-list-tab"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'list' ? 'bg-accent-dim text-accent' : 'text-txt-secondary hover:text-txt-primary'}`}
          >
            Vista de lista
          </button>
        </div>
        <button
          type="button"
          onClick={handleUndo}
          data-testid="undo-button"
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-txt-secondary hover:bg-bg-surface-hover hover:text-txt-primary"
        >
          Deshacer <kbd className="ml-1 text-xs text-txt-muted">Ctrl+Z</kbd>
        </button>
      </div>

      <div role="status" aria-live="polite" data-testid="canvas-status" className="min-h-[1.75rem] border-b border-border-subtle bg-bg-surface px-3 py-1 text-sm text-txt-secondary">
        {status}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <ComponentLibrary onCreate={handleCreate} />
        {view === 'canvas' ? (
          <div className="flex-1" data-testid="forja-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onNodeContextMenu={onNodeContextMenu}
              onPaneContextMenu={onPaneContextMenu}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              isValidConnection={isValidConnection}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              onSelectionChange={onSelectionChange}
              deleteKeyCode={DELETE_KEYS}
              nodesFocusable
              edgesFocusable
              elementsSelectable
              proOptions={{ hideAttribution: true }}
              // React Flow's Background/Controls chrome uses its own default
              // (light) palette unless told otherwise; the site itself
              // toggles light/dark independently, but ISF's default is dark
              // premium editorial, so that is this island's fixed baseline
              // for now — following the site's live toggle is a follow-up,
              // not a R1-D1 gesture concern.
              colorMode="dark"
            >
              <BandLane />
              <Background />
              <Controls showInteractive={false} />
              {design.nodes.length === 0 && (
                <Panel position="top-center">
                  <p
                    data-testid="empty-canvas-hint"
                    className="mt-16 max-w-sm rounded-lg border border-border-subtle bg-bg-surface/95 px-4 py-3 text-center text-sm text-txt-secondary shadow-lg"
                  >
                    Tu lienzo está vacío. Elegí un componente de la biblioteca para empezar a construir tu diseño.
                  </p>
                </Panel>
              )}
            </ReactFlow>
            {contextMenu?.kind === 'node' && (
              <ContextMenu
                items={nodeMenuItems}
                anchor={{ x: contextMenu.x, y: contextMenu.y }}
                containerRef={containerRef}
                onClose={closeContextMenu}
                label={`Menú de ${design.nodes.find((n) => n.id === contextMenu.nodeId)?.label ?? 'nodo'}`}
              />
            )}
            {contextMenu?.kind === 'pane' && (
              <ContextMenu
                items={paneMenuItems}
                anchor={{ x: contextMenu.x, y: contextMenu.y }}
                containerRef={containerRef}
                onClose={closeContextMenu}
                label="Agregar componente"
              />
            )}
          </div>
        ) : (
          <DesignList
            design={design}
            findings={findings}
            onDeleteNode={(id) => store.deleteNode(id)}
            onDeleteEdge={(id) => store.deleteEdge(id)}
          />
        )}
      </div>
    </div>
  )
}

export function ForjaCanvas() {
  return (
    <ReactFlowProvider>
      <ForjaCanvasInner />
    </ReactFlowProvider>
  )
}
