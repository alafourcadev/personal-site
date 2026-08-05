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
  applyEdgeChanges,
  applyNodeChanges,
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
import type { ComponentType, ConnectionVerdict } from '../../../lib/forja/engine/types'
import { projectEdges, projectNodes, type ForjaFlowEdge, type ForjaFlowNode } from '../../../lib/forja/canvas/project'
import { useForjaStore } from '../../../lib/forja/store/useForjaStore'
import { CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import { ComponentLibrary } from './ComponentLibrary'
import { DesignList } from './DesignList'
import { ForjaNode } from './ForjaNode'

const NODE_TYPES = { forja: ForjaNode }
const DELETE_KEYS = ['Backspace', 'Delete']

function isForjaNodeElement(el: Element | null): el is HTMLElement {
  return !!el && el.classList.contains('react-flow__node') && el.hasAttribute('data-id')
}

function nextCreatePosition(count: number) {
  return { x: 80 + (count % 4) * 220, y: 80 + Math.floor(count / 4) * 140 }
}

function ForjaCanvasInner() {
  const { store, design } = useForjaStore()
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'canvas' | 'list'>('canvas')
  const [status, setStatus] = useState('')
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  const pendingFocusId = useRef<string | null>(null)

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

  const handleCreate = useCallback(
    (type: ComponentType) => {
      const node = store.createNode(type, CATALOG_UI[type].label, nextCreatePosition(design.nodes.length))
      pendingFocusId.current = node.id
      setStatus(`${CATALOG_UI[type].label} creado.`)
    },
    [store, design.nodes.length],
  )

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => applyNodeChanges(changes, current) as ForjaFlowNode[])
  }, [])

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

  // Keyboard connect command [PC3]: 'c' on a focused node starts connect
  // mode, Tab moves focus to the target, Enter completes it, Escape cancels.
  // Capture phase so this runs before React Flow's own Enter/Escape node
  // handling (elementSelectionKeys) can swallow the event.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement
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
        store.undo()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [connectSourceId, store, announceVerdict])

  return (
    <div className="flex h-[75vh] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border-subtle">
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
          onClick={() => store.undo()}
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
              <Background />
              <Controls showInteractive={false} />
            </ReactFlow>
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
