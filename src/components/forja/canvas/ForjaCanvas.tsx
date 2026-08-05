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
import './node-tooltip.css'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { checkConnection, ENGINE_VERSION, evaluate, evaluateLegality } from '../../../lib/forja/engine'
import { CATALOG } from '../../../lib/forja/engine/catalog'
import type { ComponentType, ConnectionVerdict, Finding, Layer } from '../../../lib/forja/engine/types'
import { projectEdges, projectNodes, type ForjaFlowEdge, type ForjaFlowNode } from '../../../lib/forja/canvas/project'
import { bandForType, bandXRange, clampToBand } from '../../../lib/forja/canvas/bands'
import { CANVAS_EDGE_STYLE_VARS } from '../../../lib/forja/canvas/edge-theme'
import { isFullyVisible } from '../../../lib/forja/canvas/viewport-fit'
import { useForjaStore } from '../../../lib/forja/store/useForjaStore'
import { CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import { PLAYER_COLORS, PLAYER_COLOR_ORDER } from '../../../lib/forja/canvas/player-colors'
import { FREE_PLAY_EXERCISE_ID } from '../../../lib/forja/playground/free-play'
import { continuedDesign } from '../../../lib/forja/playground/continue-design'
import { toExerciseSpec, type LoadedExercise } from '../../../lib/forja/playground/loaded-exercise'
import { toScoredResult, type CanvasResult } from '../../../lib/forja/playground/result'
import { localRankingAdapter } from '../../../lib/forja/ranking/local-adapter'
import { BandLane } from './BandLane'
import { ComponentLibrary } from './ComponentLibrary'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { DesignList } from './DesignList'
import { ForjaNode } from './ForjaNode'
import { ResultPanel } from './ResultPanel'

// The page shell's RankingStrip.astro script listens for this to refresh
// itself — it lives entirely outside the island (design D5), so a DOM
// CustomEvent is the only channel that reaches it without giving it a
// direct import into React state.
const RANKING_UPDATED_EVENT = 'forja:ranking-updated'

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

interface ForjaCanvasInnerProps {
  // R1-G: a level route (`/forja/[level]/[exercise]`) passes its own real
  // exercise; `/forja` alone stays free play (undefined here), unchanged
  // from R1-F's "free play without a loaded exercise produces no score".
  exercise?: LoadedExercise
}

function ForjaCanvasInner({ exercise }: ForjaCanvasInnerProps) {
  // R1-G requirement 6, "volver y seguir": the initial design is the last
  // graph LocalRankingAdapter already has on file for this exerciseId —
  // reusing the existing ranking port (continuedDesign), never a second
  // storage mechanism. Free play keeps its own separate history under
  // FREE_PLAY_EXERCISE_ID, exactly as before.
  //
  // R1-H: a first-time visit (empty history) now falls back to the loaded
  // exercise's OWN startingDesign — the system its brief describes — never
  // a blank canvas. Free play has no starting design and keeps its prior
  // blank-canvas fallback (continuedDesign()'s own default).
  const [initialDesign] = useState(() =>
    continuedDesign(
      localRankingAdapter.getHistory(exercise?.id ?? FREE_PLAY_EXERCISE_ID),
      exercise?.startingDesign,
    ),
  )
  const { store, design } = useForjaStore(initialDesign)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<'canvas' | 'list' | 'result'>('canvas')
  const [status, setStatus] = useState('')
  // Free play (no exercise prop): legality + findings, never a score (see
  // free-play.ts). A loaded exercise: a real scored Evaluation, projected
  // through toScoredResult so the panel gets per-axis labels too.
  const [result, setResult] = useState<CanvasResult | null>(null)
  // Skips the FIRST design-change effect run below — that first run is the
  // continued design being loaded, not a new edit, so persisting it again
  // as a fresh draft attempt would be a no-op write on every mount.
  const isFirstDesignEffect = useRef(true)
  // R1-E: hover previews a finding's nodeIds/edgeIds on the canvas without
  // mutating the persistent selection; click (below) reuses the existing
  // selectedNodeIds/selectedEdgeIds so the highlight survives a tab switch.
  const [hoveredFindingId, setHoveredFindingId] = useState<string | null>(null)
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const pendingFocusId = useRef<string | null>(null)
  // PC17: the root everything below renders inside — `relative isolate` on
  // it (see the JSX below) is what keeps ContextMenu's `position: absolute`
  // contained to the playground's own box, never the site header.
  const containerRef = useRef<HTMLDivElement>(null)
  // R1-I ("the canvas frames its own content"): the React Flow pane's own
  // box — NOT containerRef, which also spans the toolbar/status bar above
  // it — is what a node's rect is compared against to decide whether a
  // just-created node landed somewhere the player can actually see.
  const paneRef = useRef<HTMLDivElement>(null)
  // "Every panel that opens can be closed": closing the result panel
  // returns focus HERE, to the exact control that opened it.
  const submitButtonRef = useRef<HTMLButtonElement>(null)

  // A loaded exercise's own budget IS the team's operational capacity for
  // the "too many components to operate" rule (engine's evaluate() passes
  // exercise.budget.opsUnits as this same second argument) — live canvas
  // highlighting must agree with what submit() will actually score against.
  const findings = useMemo(() => evaluateLegality(design, exercise?.budget.opsUnits).findings, [design, exercise])
  const errorNodeIds = useMemo(
    () => new Set(findings.filter((f) => f.severity === 'blocking').flatMap((f) => f.nodeIds)),
    [findings],
  )
  const errorEdgeIds = useMemo(
    () => new Set(findings.filter((f) => f.severity === 'blocking').flatMap((f) => f.edgeIds)),
    [findings],
  )

  const hoveredFinding = useMemo(
    () => result?.findings.find((f) => f.id === hoveredFindingId) ?? null,
    [result, hoveredFindingId],
  )
  // A hovered finding dims every node/edge OUTSIDE its own nodeIds/edgeIds —
  // this is the "findings must point at the canvas" requirement: the
  // prototype made the player translate prose into geometry by hand for 7
  // of 8 diagnoses. An empty union (a guarantee-missing finding never
  // carries nodeIds — see score.ts) dims nothing, which is an acceptable,
  // honest degrade: there is nothing on the canvas to circle.
  const dimmedNodeIds = useMemo(() => {
    if (!hoveredFinding || hoveredFinding.nodeIds.length === 0) return new Set<string>()
    const keep = new Set(hoveredFinding.nodeIds)
    return new Set(design.nodes.filter((n) => !keep.has(n.id)).map((n) => n.id))
  }, [design.nodes, hoveredFinding])
  const dimmedEdgeIds = useMemo(() => {
    if (!hoveredFinding || hoveredFinding.edgeIds.length === 0) return new Set<string>()
    const keep = new Set(hoveredFinding.edgeIds)
    return new Set(design.edges.filter((e) => !keep.has(e.id)).map((e) => e.id))
  }, [design.edges, hoveredFinding])

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
    setNodes(projectNodes(design, selectedNodeIds, errorNodeIds, dimmedNodeIds))
  }, [design, selectedNodeIds, errorNodeIds, dimmedNodeIds])

  useLayoutEffect(() => {
    setEdges(projectEdges(design, selectedEdgeIds, errorEdgeIds, dimmedEdgeIds))
  }, [design, selectedEdgeIds, errorEdgeIds, dimmedEdgeIds])

  // R1-I ("the canvas frames its own content"), scenario "a newly added
  // component is brought into view": the same layout effect that already
  // moves focus to a just-created/duplicated node (both go through
  // pendingFocusId) also checks whether that node's real rendered rect
  // fits inside the pane's own rect — nextCreatePosition/duplicateNode can
  // place a node past the pane's visible bottom edge once enough siblings
  // stack up in the same band. `fitView()` (the exact same instance method
  // the "encuadrar" control already calls) re-frames every current node,
  // never just the new one, so the rest of the design stays visible too.
  //
  // `{ preventScroll: true }` on the focus call is deliberate: a plain
  // `el.focus()` on an element the browser considers off-screen triggers
  // its OWN native scroll-into-view, at the PAGE level — a second, uncoded
  // scroll mechanism racing the pane-relative `fitView()` right below it.
  // Measured directly: without this, five rapid creates left the page
  // scrolled to a page-level y of -143 (partially above the window) while
  // fitView had already framed the content correctly relative to the pane,
  // and the two corrections fought each other into a broken final state.
  // `fitView()` (or, for a loaded exercise, the mount/reset scrollIntoView
  // above) stays the single, deliberate mechanism for bringing content into
  // view; focus should only ever move focus.
  useLayoutEffect(() => {
    if (!pendingFocusId.current) return
    const id = pendingFocusId.current
    const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
    if (el) {
      el.focus({ preventScroll: true })
      pendingFocusId.current = null
      const paneRect = paneRef.current?.getBoundingClientRect() ?? null
      if (!isFullyVisible(el.getBoundingClientRect(), paneRect)) {
        void fitView()
      }
    }
  }, [nodes, fitView])

  // R1-I ("the canvas frames its own content"), the scenario that actually
  // measures the defect: "GIVEN an exercise whose starting design is taller
  // than the visible canvas ... every node and connection MUST be inside
  // the visible canvas area." `fitView()` alone re-frames the CAMERA inside
  // the pane's own box — it cannot fix the pane's own box sitting below the
  // fold. Measured directly (production build, 1920x1080): the exercise
  // brief above the canvas pushes the pane's own top to y≈795, so its lower
  // edges (e.g. the connection the brief is literally about) land at
  // y≈1249 — 169px past the window's bottom edge — with the CAMERA already
  // fitted to the content and totally unchanged, because the content
  // already fits comfortably inside the pane's own (729px) box; the pane
  // itself is just positioned off-window by ordinary page layout. A plain
  // `scrollIntoView()` on the playground's own root (not just the React
  // Flow pane, so the toolbar/reset/submit controls land in view too) is
  // what a player would otherwise have to do by hand — confirmed against
  // the same measurement: it alone moves that edge from y≈1249 to y≈636.
  // Reduced motion is already handled site-wide for every `scrollIntoView`
  // call (BaseLayout.astro's own `@media (prefers-reduced-motion: reduce)`
  // forces `scroll-behavior: auto`), so no extra branching is needed here.
  useEffect(() => {
    if (!exercise) return
    containerRef.current?.scrollIntoView({ block: 'start' })
    // Mount-once, deliberately: this is "when an exercise opens", not
    // "whenever the exercise prop happens to be re-evaluated" — Astro's
    // multi-page routing remounts this island fresh on every real
    // navigation to a different exercise, which is the only time "opens"
    // actually recurs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // R1-H item 4: "reiniciar el ejercicio" — goes back to the starting
  // design without leaving the page. Only meaningful for a loaded exercise
  // (free play has no startingDesign to reset to); a normal store commit,
  // so it stays undoable like every other mutation, and the existing
  // auto-persist effect below saves it as the new "volver y seguir" state.
  // R1-I: "the same MUST hold after a reset" — re-frames the starting
  // design exactly like the initial open does, unconditionally (never
  // gated on whether anything actually landed off-screen): the same
  // scrollIntoView() that brings the whole playground back on-screen, plus
  // fitView() as the within-pane backstop for a starting design taller than
  // the pane's own box.
  const handleReset = useCallback(() => {
    if (!exercise) return
    store.resetTo(exercise.startingDesign)
    setSelectedNodeIds(new Set())
    setSelectedEdgeIds(new Set())
    setStatus('Ejercicio reiniciado al diseño inicial.')
    containerRef.current?.scrollIntoView({ block: 'start' })
    void fitView()
  }, [store, exercise, fitView])

  // R1-G requirement 6, "volver y seguir": persists the current design as a
  // draft (score: null — RK7, never a score) every time it actually changes,
  // reusing the exact same LocalRankingAdapter.submit() the explicit submit
  // button already calls. Free play keeps its own prior behaviour (only an
  // explicit submit persists); this effect only runs once an exercise is
  // loaded, so /forja's existing tests and semantics are untouched.
  useEffect(() => {
    if (!exercise) return
    if (isFirstDesignEffect.current) {
      isFirstDesignEffect.current = false
      return
    }
    localRankingAdapter.submit({
      exerciseId: exercise.id,
      design,
      score: null,
      ceiling: 100,
      engineVersion: ENGINE_VERSION,
    })
  }, [exercise, design])

  // B3 blocker: submit switches straight to the Resultado tab, which —
  // unlike the prototype — keeps the canvas mounted next to it (see the JSX
  // below) rather than replacing it, so a finding's highlight is visible the
  // moment the player looks at the canvas tab too.
  //
  // "Free play without a loaded exercise produces no score": no exercise
  // prop means this calls evaluateLegality alone — legality and findings,
  // never a guarantee/cost/score pass. Scoring free play against a
  // placeholder exercise is the exact defect this replaces (see
  // free-play.ts). R1-G: a REAL loaded exercise calls the real evaluate(),
  // the same engine surface every reference-solution test already proves
  // reaches exactly 100 for its two structurally distinct designs.
  //
  // RK7: LocalRankingAdapter.submit() always stores the full graph, legal
  // or not — free play never has a score to store (score: null), so it
  // becomes personal history only, same as an illegal attempt today (see
  // local-adapter.ts's getSnapshot(), which filters null scores out of the
  // ranked total).
  const handleSubmit = useCallback(() => {
    if (exercise) {
      const evaluation = evaluate(design, toExerciseSpec(exercise))
      setResult(toScoredResult(evaluation, exercise.guarantees))
      localRankingAdapter.submit({
        exerciseId: exercise.id,
        design,
        score: evaluation.status === 'scored' ? evaluation.score : null,
        ceiling: evaluation.ceiling,
        engineVersion: ENGINE_VERSION,
      })
    } else {
      const legality = evaluateLegality(design)
      setResult({ kind: 'free-play', legal: legality.legal, findings: legality.findings })
      localRankingAdapter.submit({
        exerciseId: FREE_PLAY_EXERCISE_ID,
        design,
        score: null,
        ceiling: 100,
        engineVersion: ENGINE_VERSION,
      })
    }
    setView('result')
    window.dispatchEvent(new CustomEvent(RANKING_UPDATED_EVENT))
  }, [design, exercise])

  const handleHoverFinding = useCallback((findingId: string | null) => {
    setHoveredFindingId(findingId)
  }, [])

  // Click persists the highlight as the canvas's own selection (the exact
  // state onSelectionChange already drives) — it survives switching back
  // to the Lienzo tab, unlike hover.
  const handleSelectFinding = useCallback((finding: Finding) => {
    setSelectedNodeIds(new Set(finding.nodeIds))
    setSelectedEdgeIds(new Set(finding.edgeIds))
  }, [])

  // "Every panel that opens can be closed": switches the tab away from
  // 'result' and returns focus to the control that opened it — never
  // clears `evaluation`, so reopening the Resultado tab shows the exact
  // same result, not a blank one.
  const handleCloseResultPanel = useCallback(() => {
    setView('canvas')
    submitButtonRef.current?.focus()
  }, [])

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
      // "Every panel that opens can be closed": Escape closes the result
      // panel, same as its own close button. Guarded on `!contextMenu` —
      // that overlay owns Escape when it is the thing actually open.
      if (event.key === 'Escape' && view === 'result' && !contextMenu) {
        handleCloseResultPanel()
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
  }, [connectSourceId, store, announceVerdict, handleUndo, view, contextMenu, handleCloseResultPanel])

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
          <button
            type="button"
            role="tab"
            aria-selected={view === 'result'}
            onClick={() => setView('result')}
            data-testid="view-result-tab"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === 'result' ? 'bg-accent-dim text-accent' : 'text-txt-secondary hover:text-txt-primary'}`}
          >
            Resultado
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            ref={submitButtonRef}
            type="button"
            onClick={handleSubmit}
            data-testid="submit-button"
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-bg-deep hover:bg-accent-strong"
          >
            Probar respuesta
          </button>
          <button
            type="button"
            onClick={handleUndo}
            data-testid="undo-button"
            className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-txt-secondary hover:bg-bg-surface-hover hover:text-txt-primary"
          >
            Deshacer <kbd className="ml-1 text-xs text-txt-muted">Ctrl+Z</kbd>
          </button>
          {exercise && (
            <button
              type="button"
              onClick={handleReset}
              data-testid="reset-exercise-button"
              className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-txt-secondary hover:bg-bg-surface-hover hover:text-txt-primary"
            >
              Reiniciar ejercicio
            </button>
          )}
        </div>
      </div>

      <div role="status" aria-live="polite" data-testid="canvas-status" className="min-h-[1.75rem] border-b border-border-subtle bg-bg-surface px-3 py-1 text-sm text-txt-secondary">
        {status}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* "The correction loop never loses its tools": shown alongside the
            canvas AND the result panel — only 'list' hides it, since that
            view replaces the canvas workspace entirely. Reading a finding
            and immediately adding the component it implies is missing must
            never require leaving the Resultado tab first. */}
        {view !== 'list' && <ComponentLibrary onCreate={handleCreate} />}
        {view !== 'list' ? (
          // Mounted for BOTH 'canvas' and 'result' — never unmounted when
          // switching to Resultado, unlike the Lienzo/Vista de lista toggle
          // below. This is what lets a hovered finding highlight real
          // canvas nodes: the ReactFlow instance (and its live state) is
          // never torn down just because the result panel is what has
          // visual focus. `min-w-0` keeps this flex-1 child from refusing
          // to shrink below its content's intrinsic width, which is what
          // actually lets the fixed-width ResultPanel sidebar coexist with
          // it instead of overflowing the row.
          <div ref={paneRef} className="min-w-0 flex-1" data-testid="forja-canvas">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              // R1-I: "when an exercise opens, the canvas MUST frame its
              // starting design" — React Flow's own `fitView` prop fires
              // exactly once, the first time `nodes` becomes non-empty AND
              // measured (its internal `fitViewQueued && nodesInitialized`
              // gate — see @xyflow/react's index.mjs), which is precisely
              // the loaded exercise's starting design landing in `nodes`
              // after the layout effect above runs. Scoped to `Boolean(
              // exercise)` deliberately: free play's own empty-canvas start
              // is untouched (design D8/PC8's empty-canvas hint, R1-D2), so
              // this never changes free play's default zoom/pan for its
              // very first player-created node.
              fitView={Boolean(exercise)}
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
              // R1-E contrast fix: React Flow's own dark-mode default edge
              // stroke (#3e3e3e on its own #141414 pane) measures ~1.72:1,
              // under WCAG 1.4.11's 3:1 floor for a graphical object — see
              // edge-theme.ts and tests/canvas/edge-contrast.test.ts. Inline
              // style wins the cascade over the library's own
              // `.react-flow.dark` class rule for the same custom
              // properties, which an ancestor override or a same-specificity
              // utility class could not guarantee.
              style={CANVAS_EDGE_STYLE_VARS as React.CSSProperties}
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
        {view === 'result' && (
          <ResultPanel
            result={result}
            hoveredFindingId={hoveredFindingId}
            onHoverFinding={handleHoverFinding}
            onSelectFinding={handleSelectFinding}
            onClose={handleCloseResultPanel}
          />
        )}
      </div>
    </div>
  )
}

export interface ForjaCanvasProps {
  // R1-G: passed by `/forja/[level]/[exercise].astro` only. Absent here,
  // the canvas is `/forja`'s free play, unchanged since R1-F.
  exercise?: LoadedExercise
}

export function ForjaCanvas({ exercise }: ForjaCanvasProps) {
  return (
    <ReactFlowProvider>
      <ForjaCanvasInner exercise={exercise} />
    </ReactFlowProvider>
  )
}
