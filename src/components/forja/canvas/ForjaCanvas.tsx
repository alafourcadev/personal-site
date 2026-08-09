// The playground canvas island, the ONLY React island on /forja (design
// D5, client:only="react"). Wires every R1-D1 gesture to the domain store:
// domain state is source of truth (D1); React Flow is authoritative for
// node position only DURING a drag, committed to the store on
// onNodeDragStop; every structural mutation (create/connect/delete/undo)
// goes straight through ForjaStore, never through React Flow's own state.
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  ControlButton,
  Controls,
  Panel,
  applyEdgeChanges,
  applyNodeChanges,
  useNodesInitialized,
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
import './edge-focus.css'
import './rail-pleca.css'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import {
  checkConnection,
  ENGINE_VERSION,
  evaluate,
  evaluateLegality,
} from '../../../lib/forja/engine'
import {
  CATALOG,
  type PlayerNodePropertyKey,
} from '../../../lib/forja/engine/catalog'
import type {
  ComponentType,
  ConnectionVerdict,
  DataClass,
  Finding,
} from '../../../lib/forja/engine/types'
import {
  EDGE_HELP_ID,
  EDGE_HELP_TEXT,
  projectEdges,
  projectNodes,
  type ForjaFlowEdge,
  type ForjaFlowNode,
} from '../../../lib/forja/canvas/project'
import { bandForType, clampToBand } from '../../../lib/forja/canvas/bands'
import {
  BAND_TRANSLATE_EXTENT,
  bandFramingBounds,
  bandMaxZoom,
} from '../../../lib/forja/canvas/band-camera'
import { arrangedPositions } from '../../../lib/forja/canvas/auto-layout'
import { CANVAS_EDGE_STYLE_VARS } from '../../../lib/forja/canvas/edge-theme'
import { isFullyVisible } from '../../../lib/forja/canvas/viewport-fit'
import {
  DEFAULT_NODE_SIZE,
  findFreePosition,
  type PlacementRect,
} from '../../../lib/forja/canvas/placement'
import {
  duplicateConnectionMessage,
  findDuplicateEdge,
} from '../../../lib/forja/canvas/connection-guard'
import {
  connectionCreatedMessage,
  connectionDroppedMessage,
  deletionMessage,
  edgeDescription,
} from '../../../lib/forja/canvas/announcements'
import {
  DATA_CLASSES,
  DATA_CLASS_ORDER,
} from '../../../lib/forja/canvas/data-classes'
import {
  dataClassMessage,
  edgeEndpoints,
  newlyBlockingFindings,
} from '../../../lib/forja/canvas/data-class-feedback'
import { listViewSource } from '../../../lib/forja/canvas/list-view-source'
import {
  effectiveView,
  libraryIsOwnPane,
  paneLayout,
  paneVisibility,
  resultIsRail,
  type PlaygroundView,
} from '../../../lib/forja/canvas/responsive-layout'
import { useForjaStore } from '../../../lib/forja/store/useForjaStore'
import { CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import {
  PLAYER_COLORS,
  PLAYER_COLOR_ORDER,
} from '../../../lib/forja/canvas/player-colors'
import { FREE_PLAY_EXERCISE_ID } from '../../../lib/forja/playground/free-play'
import {
  continuedDesign,
  shouldRestoreVerdict,
} from '../../../lib/forja/playground/continue-design'
import {
  toExerciseSpec,
  type LoadedExercise,
} from '../../../lib/forja/playground/loaded-exercise'
import {
  submitMessage,
  toScoredResult,
  type CanvasResult,
} from '../../../lib/forja/playground/result'
import { localRankingAdapter } from '../../../lib/forja/ranking/local-adapter'
import type {
  StorageWriteStatus,
  SubmitAttemptResult,
} from '../../../lib/forja/ranking/port'
import {
  exerciseMastery,
  gameCompletionEligibility,
  isValidMiniAdr,
  selectTransferSourceForPerfectAttempt,
  type MiniAdr,
} from '../../../lib/forja/progression/mastery'
import { localTransferEvidenceAdapter } from '../../../lib/forja/progression/transfer-evidence-local-adapter'
import type { ExerciseLearningConcepts } from '../../../lib/forja/progression/learning-concepts'
import {
  playerNodePropertyDefinitions,
  playerNodePropertyOption,
} from '../../../lib/forja/playground/node-properties'
import { CANVAS_DOT_GRID } from '../../../lib/forja/canvas/canvas-background'
import { BandLane } from './BandLane'
import { ComponentLibrary } from './ComponentLibrary'
import { NodePropertyEditor } from './NodePropertyEditor'
import { RailPleca } from './RailPleca'
import { useToolsCollapsed } from './use-tools-collapsed'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { DesignList } from './DesignList'
import { EdgeHitTargets } from './EdgeHitTargets'
import { ForjaNode } from './ForjaNode'
import { ResultPanel } from './ResultPanel'
import {
  FREE_PLAY_FIT_PADDING,
  PLAYGROUND_SCROLL_MARGIN_PX,
} from './playground-chrome'
import {
  closestReferenceIndex,
  designFingerprint,
  shouldRevealReferences,
  type ReferenceSolutionView,
} from './reference-solutions'
import type { NextStep } from './next-step'
import { sameSelection } from './selection-sync'
import { useSiteTheme } from './use-site-theme'
import { useStatementCollapsed } from './use-statement-collapsed'
import { STATEMENT_COLLAPSED_ATTRIBUTE } from '../../../lib/forja/canvas/statement-visibility'
import {
  FORJA_ACTIONS_SLOT_ID,
  PLAYABLE_MEDIA_QUERY,
  BRIEF_CARD_INSET_PX,
  WIDE_WORKBENCH_MEDIA_QUERY,
  PANE_GEOMETRY_VARS,
  briefFitPadding,
  canvasPaneWidth,
  paneGeometryStyle,
  railWidth,
} from '../../../lib/forja/canvas/forja-shell'

// The page shell's RankingStrip.astro script listens for this to refresh
// itself. It lives entirely outside the island (design D5), so a DOM
// CustomEvent is the only channel that reaches it without giving it a
// direct import into React state.
const RANKING_UPDATED_EVENT = 'forja:ranking-updated'

function persistenceWarning(
  status: StorageWriteStatus,
  subject: 'intento' | 'defensa' | 'transferencia',
): string {
  if (status.ok) return ''
  const reason =
    status.reason === 'quota-exceeded'
      ? 'el espacio local está lleno'
      : status.reason === 'storage-unavailable'
        ? 'el almacenamiento local no está disponible'
        : 'el navegador rechazó la escritura'
  return `No pude guardar ${subject === 'intento' ? 'el' : 'la'} ${subject}: ${reason}. Esta sesión sigue funcionando, pero el avance puede perderse al cerrar la página.`
}

const NODE_TYPES = { forja: ForjaNode }

// The camera controls' own names. React Flow ships them in English ("Zoom In",
// "Zoom Out", "Control Panel"), and they are what a screen reader announces on
// the only chrome the canvas has. Everything else the player hears here is in
// their own language, down to the engine's findings. Merged with React Flow's
// defaults, so only these four change.
const CANVAS_CONTROL_LABELS = {
  'controls.ariaLabel': 'Controles de la cámara',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Encuadrar el diagrama',
}
const DELETE_KEYS = ['Backspace', 'Delete']

// The region the tools rail's pleca folds, named so `aria-controls` has a real
// target. The statement rail's own id lives in ExerciseBrief.astro, where that
// rail is rendered.
const TOOLS_RAIL_REGION_ID = 'forja-tools-rail-region'

// React Flow's own default floor is 0.5, and `fitView` obeys it: at 390px the
// starting designs needed less than that to fit, so the camera stopped at 0.5
// and simply left 4 of 7 nodes outside the pane, so the player could not see
// the shape of the system the brief was about. A lower floor only PERMITS
// zooming out further; `fitView` still zooms exactly as far as the content
// requires, so a desktop pane, which never needed to go below 0.5, is
// unaffected. Legibility at that zoom is bad on purpose: seeing the whole
// graph and pinching into a region beats reading three of seven nodes and
// having no idea the other four exist.
const MIN_ZOOM = 0.2

// The playground reads its own width to decide how many panes fit (see
// responsive-layout.ts). It used to read `window.innerWidth` instead, which
// was the same number only while the playground owned the whole row.
//
// It no longer does: an exercise page wide enough puts the statement in a
// column beside it (exercise-page-layout.ts), and there the two differ by
// ~500px. A playground still reading the window would claim three columns
// inside a 748px box and leave the canvas 68px, narrower than both sidebars,
// which is the exact defect responsive-layout.ts exists to prevent, moved one
// level up. Measuring the real box is also what makes the page's layout and
// the island's arithmetic impossible to drift apart: there is only one width,
// and it is the rendered one.
//
// `useLayoutEffect`, not `useEffect`: it runs after the DOM commit and before
// the browser paints, so the first measured render is also the first painted
// one and no pane flashes at the wrong size.
//
// `null` until the box exists, deliberately, and not a `window.innerWidth` seed
// pretending to be a measurement. The caller falls back to the window for the
// single render before the ref is attached, and the null tells the re-framing
// effect below that arriving at a real width is not the pane CHANGING width.
function usePlaygroundWidth(
  ref: React.RefObject<HTMLElement | null>,
): number | null {
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setWidth(element.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}

// The row in the shell's top bar that the three game actions belong to.
//
// They need the canvas's own state, so they are built here; the owner wants
// them read as part of the shell's one row of chrome. A bar made of an Astro
// half and an island half on the same line is the clean way to have both.
// `null` on /forja, which has no bar, and the buttons stay where they are.
//
// State rather than a ref read during render: the container is server-rendered
// and therefore already in the document, but a `client:only` island's first
// render still happens before React has touched anything, and reading the DOM
// during render is what makes a component unable to say when it changed.
function useActionsSlot(): HTMLElement | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    setSlot(document.getElementById(FORJA_ACTIONS_SLOT_ID))
  }, [])
  return slot
}

// Publishes the canvas pane's own box, so the statement rail can anchor to it.
//
// The rail is server-rendered markdown and lives outside this island, so it
// cannot ask React Flow where the pane is. It has to be told, and told again
// whenever the box moves, which it now does for three separate reasons: the
// tools rail folding to its pleca, the verdict taking that rail, and the
// window. So the pane measures itself and the stylesheet reads the result.
//
// The publication has to keep up, and a stale one is not cosmetic: the rail is
// SIZED from --forja-pane-height, so a rail that ever lands in the layout flow
// takes height from the pane it is sized by. Measured once, before
// tests/e2e/rails.spec.ts existed: the pane oscillated between 632px and 200px
// about every 5ms, for as long as the page was open.
//
// Written on <html> rather than on a wrapper because the card is a sibling of
// this island, not a descendant, and because that is already where the theme
// and the fold state live. Cleared on unmount so free play never leaves a
// stale box behind for the next page.
function usePublishedPaneBox(
  ref: React.RefObject<HTMLElement | null>,
  visible: boolean,
): void {
  useEffect(() => {
    const root = document.documentElement
    const element = ref.current
    const clear = () => {
      for (const name of Object.values(PANE_GEOMETRY_VARS))
        root.style.removeProperty(name)
    }
    if (!element || !visible) {
      clear()
      return
    }
    const publish = () => {
      const box = element.getBoundingClientRect()
      if (box.width <= 0 || box.height <= 0) return
      for (const [name, value] of Object.entries(paneGeometryStyle(box)))
        root.style.setProperty(name, value)
    }
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    // The pane's own box moves with the window even when its size does not:
    // the top bar is fixed height, but a zoomed page or a scrollbar appearing
    // shifts the left edge, and the card would stay where the pane was.
    window.addEventListener('resize', publish)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', publish)
      clear()
    }
  }, [ref, visible])
}

// PC15: node menus are scoped to the right-clicked node; the pane menu adds
// a component at the click's flow position. The edge menu is the third: it is
// where a player declares what travels through a connection, the gesture the
// exercises' own statements describe and the playground never had.
type ContextMenuState =
  | { kind: 'node'; nodeId: string; x: number; y: number }
  | { kind: 'edge'; edgeId: string; x: number; y: number }
  | {
      kind: 'pane'
      x: number
      y: number
      flowPosition: { x: number; y: number }
    }

// One tab of the view bar. Extracted when the library became a fourth,
// conditional tab: four copies of the same markup differing by one string is
// where a selected-state class silently stops matching on one of them.
function ViewTab({
  view,
  currentView,
  onSelect,
  testId,
  children,
}: {
  view: PlaygroundView
  currentView: PlaygroundView
  onSelect: (view: PlaygroundView) => void
  testId?: string
  children: React.ReactNode
}) {
  const selected = currentView === view
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(view)}
      data-testid={testId}
      // Tighter horizontal padding below `lg`: with four tabs the bar is the
      // difference between one row and two, and two rows of chrome come
      // straight out of the canvas's own height on the viewport that has the
      // least of it.
      className={`rounded-md px-2 py-2 text-xs font-medium lg:px-3 lg:py-1.5 lg:text-sm ${
        selected
          ? 'bg-accent-dim text-accent-ink'
          : 'text-txt-secondary hover:text-txt-primary'
      }`}
    >
      {children}
    </button>
  )
}

function isForjaNodeElement(el: Element | null): el is HTMLElement {
  return (
    !!el &&
    el.classList.contains('react-flow__node') &&
    el.hasAttribute('data-id')
  )
}

// The edge's own focusable group element (React Flow renders it with
// `focusable`/`ariaLabel` from project.ts). An SVG element, not an HTMLElement
// This is exactly why it needs its own predicate rather than a widened
// version of the one above.
function isForjaEdgeElement(el: Element | null): el is SVGGElement {
  return (
    !!el &&
    el.classList.contains('react-flow__edge') &&
    el.hasAttribute('data-id')
  )
}

// The boxes a new component has to avoid, in flow coordinates. React Flow
// hands us its own `measured` width/height once it has laid a node out, the
// real box with label length included, and only falls back to the nominal
// size for a node created in the same tick that has not been measured yet.
function occupiedRects(nodes: ForjaFlowNode[]): PlacementRect[] {
  return nodes.map((node) => ({
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? DEFAULT_NODE_SIZE.width,
    height: node.measured?.height ?? DEFAULT_NODE_SIZE.height,
  }))
}

interface ForjaCanvasInnerProps {
  // R1-G: a level route (`/forja/[level]/[exercise]`) passes its own real
  // exercise; `/forja` alone stays free play (undefined here), unchanged
  // from R1-F's "free play without a loaded exercise produces no score".
  exercise?: LoadedExercise
  // The exercise's own reference solutions, as prose + component types (see
  // reference-solutions.ts). Deliberately NOT part of `LoadedExercise`: that
  // type is documented as "only what the engine evaluates against", and the
  // engine never evaluates a reference solution.
  referenceSolutions?: ReferenceSolutionView[]
  // Where the player goes after this one, resolved at build time from the
  // level's own play order (next-step.ts).
  nextStep?: NextStep
  // The curriculum's synthesis milestones. A route being last is not enough
  // to finish the game: each of these must have a 100, a mini-ADR and later
  // transfer evidence from a different exercise.
  requiredMasteryExerciseIds?: string[]
  // Explicit curriculum concepts for every exercise. Transfer never falls
  // back to chronology or to matching player-facing copy.
  transferProfiles?: ExerciseLearningConcepts[]
  // Whether this playground is inside La Forja's full-screen shell, which is
  // true only on an exercise page. It decides three things: the box takes the
  // height it is given instead of 75vh, the actions row goes to the shell's
  // top bar, and the camera leaves room for the objective card floating over
  // the canvas. `/forja`'s free play passes nothing and is unchanged.
  shell?: boolean
}

function ForjaCanvasInner({
  exercise,
  referenceSolutions,
  nextStep,
  requiredMasteryExerciseIds = [],
  transferProfiles = [],
  shell = false,
}: ForjaCanvasInnerProps) {
  // Which of the brand's two themes the page is in. Only React Flow's own
  // chrome needs it in React state: every brand token on this canvas is a CSS
  // custom property and follows the switch on its own.
  const theme = useSiteTheme()
  // R1-G requirement 6, "volver y seguir": the initial design is the last
  // graph LocalRankingAdapter already has on file for this exerciseId,
  // reusing the existing ranking port (continuedDesign), never a second
  // storage mechanism. Free play keeps its own separate history under
  // FREE_PLAY_EXERCISE_ID, exactly as before.
  //
  // R1-H: a first-time visit (empty history) now falls back to the loaded
  // exercise's OWN startingDesign, the system its brief describes, never
  // a blank canvas. Free play has no starting design and keeps its prior
  // blank-canvas fallback (continuedDesign()'s own default).
  const [initialDesign] = useState(() =>
    continuedDesign(
      localRankingAdapter.getHistory(exercise?.id ?? FREE_PLAY_EXERCISE_ID),
      exercise?.startingDesign,
    ),
  )
  const { store, design } = useForjaStore(initialDesign)
  const { screenToFlowPosition, fitBounds, getNodes, getNodesBounds } =
    useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())
  const [propertyNodeId, setPropertyNodeId] = useState<string | null>(null)
  const selectedNode = useMemo(() => {
    const [selectedId] = selectedNodeIds
    const nodeId = selectedNodeIds.size === 1 ? selectedId : propertyNodeId
    if (!nodeId) return null
    return design.nodes.find((node) => node.id === nodeId) ?? null
  }, [design.nodes, selectedNodeIds, propertyNodeId])
  const [view, setView] = useState<PlaygroundView>('canvas')
  // PC17: the root everything below renders inside. `relative isolate` on
  // it (see the JSX below) is what keeps ContextMenu's `position: absolute`
  // contained to the playground's own box, never the site header. It is also
  // the box whose measured width decides how many panes fit, which is why it
  // is declared before the layout that reads it.
  const containerRef = useRef<HTMLDivElement>(null)
  // How many panes this playground can hold at once, and which of them render.
  // `currentView` is what the tab bar reflects: growing the window past the
  // library's own pane resolves 'library' back to 'canvas' rather than
  // leaving the playground on a view that no longer has a tab.
  const measuredWidth = usePlaygroundWidth(containerRef)
  const layout = paneLayout(measuredWidth ?? window.innerWidth)
  const currentView = effectiveView(layout, view)
  const panes = paneVisibility(layout, view)
  // The verdict keeps a tab of its own everywhere except inside the shell
  // while it is open as a rail beside the canvas. There it is not an
  // alternative to the canvas, it is next to it (responsive-layout.ts's
  // resultIsRail), and the tab bar has to say what the workspace is actually
  // showing, which is the canvas.
  const verdictHasOwnTab = !(shell && resultIsRail(panes))
  const tabView = verdictHasOwnTab ? currentView : 'canvas'
  // Where the shell's top bar wants the three game actions, and whether the
  // objective card floating over the canvas is open. Both are null/false on
  // /forja, which has no shell, and the playground behaves exactly as before.
  const actionsSlot = useActionsSlot()
  const {
    collapsed: statementCollapsed,
    revision: statementLayoutRevision,
  } = useStatementCollapsed()
  // The other rail's own answer, remembered under its own key: "keep the
  // problem in front of me" and "get the tools out of my way" are two different
  // statements, and a player making one of them is not making the other.
  const {
    collapsed: toolsCollapsed,
    revision: toolsLayoutRevision,
    toggle: toggleTools,
  } = useToolsCollapsed()
  // Memoised because it is an effect dependency: a fresh object every render
  // would re-run the re-framing effect on every keystroke.
  // What the diagram's own pane is left with once the rails have taken theirs.
  // The card's footprint is charged against THIS and not against the window:
  // at 1440 with the verdict open the pane is 760px, and a camera still
  // framing around a 432px card left the design 312px at the exact moment the
  // verdict asks the player to look at it.
  const paneWidth = canvasPaneWidth(
    measuredWidth ?? (typeof window === 'undefined' ? 0 : window.innerWidth),
    { library: panes.library, result: panes.result, toolsCollapsed },
  )
  const statementInFlow = useMediaQuery(Boolean(shell), WIDE_WORKBENCH_MEDIA_QUERY)
  const fitPadding = useMemo(
    () =>
      shell
        ? briefFitPadding(statementCollapsed, paneWidth, statementInFlow)
        : FREE_PLAY_FIT_PADDING,
    [shell, statementCollapsed, paneWidth, statementInFlow],
  )
  // How far in the camera may go, and it is a measured number rather than a
  // constant: the pane's width is what decides whether the three bands still
  // fit across it. See band-camera.ts for the defect this closes and for what
  // it cost in type size.
  const maxZoom = bandMaxZoom(paneWidth, MIN_ZOOM)

  // THE ONE WAY THE CAMERA MOVES ON ITS OWN.
  //
  // It used to be React Flow's `fitView`, which frames the NODES. That is the
  // whole defect: measured on this repo, an exercise whose diagram is 1005
  // flow units wide inside 1080 units of band was framed on the 1005, and the
  // camera settled centred on the pieces with the third band divider outside
  // the pane. `fitBounds` takes the rectangle explicitly, so the rectangle can
  // be "the pieces AND the three bands" (bandFramingBounds), which is the only
  // framing that can honour the owner's rule.
  //
  // The bounds come from React Flow's own measured nodes rather than from the
  // store's positions, because a node's real rendered height depends on its
  // label and on whether it is carrying a warning line, and the vertical half
  // of the framing is the half that reads those.
  const frameDiagram = useCallback(
    (options?: { duration?: number }) => {
      const nodes = getNodes()
      const content = nodes.length > 0 ? getNodesBounds(nodes) : null
      // `fitBounds` declares `padding` as a plain number while `fitView`
      // declares the per-side shape, and the two call the identical function:
      // both end in `getViewportForBounds(..., padding)`, which parses the
      // object form (read in @xyflow/system's own build, not assumed). The
      // cast is against the declaration, never against the behaviour, and the
      // per-side padding is what keeps the objective card off the diagram.
      const padding = fitPadding as unknown as number
      void fitBounds(bandFramingBounds(content), {
        padding,
        duration: options?.duration,
      })
    },
    [fitBounds, fitPadding, getNodes, getNodesBounds],
  )
  // React Flow's own "the viewport exists" signal, which is the moment
  // `fitBounds` has a pane size to work against. Framing before it computes a
  // camera for a 0x0 pane.
  const [viewportReady, setViewportReady] = useState(false)
  const handleFlowInit = useCallback(() => setViewportReady(true), [])
  // Where the band names sit inside the pane: the same offset the camera keeps
  // clear at the top, so the objective card's folded strip never covers all
  // three at once. Free play's padding is a fraction of the pane rather than a
  // number of pixels, and there the names keep the offset they always had.
  const bandLabelTopPx =
    typeof fitPadding === 'number'
      ? BRIEF_CARD_INSET_PX
      : Number.parseInt(fitPadding.top, 10)
  const [status, setStatus] = useState('')
  // Free play (no exercise prop): legality + findings, never a score (see
  // free-play.ts). A loaded exercise: a real scored Evaluation, projected
  // through toScoredResult so the panel gets per-axis labels too.
  // Seeded from the attempt that produced `initialDesign`, so returning to an
  // exercise you already solved reopens on its verdict instead of "todavía no
  // probaste tu diseño", which is what it said while localStorage held the
  // attempt with score 100 and the canvas had already restored its edges.
  //
  // Recomputed, never read from storage: only the score is persisted, so the
  // findings have to come from the engine, and running it now means the
  // player reads today's verdict rather than a stale one. It deliberately
  // does NOT bump `attempts`: restoring is not playing, and the reference
  // solutions stay earned rather than handed over on a reload.
  const [result, setResult] = useState<CanvasResult | null>(() => {
    if (!exercise) return null
    const history = localRankingAdapter.getHistory(exercise.id)
    if (!shouldRestoreVerdict(history)) return null
    return toScoredResult(
      evaluate(initialDesign, toExerciseSpec(exercise)),
      exercise.guarantees,
    )
  })
  // How many times the player has actually pressed "Probar respuesta" in this
  // session, and the component types of the design that produced the current
  // verdict. Both feed the reference-solution reveal: the gate is attempt
  // count, and the "your design leans toward this one" mark must compare the
  // SUBMITTED design, not whatever the player edited afterwards.
  //
  // Session-scoped on purpose: a reload restarts the count, which errs toward
  // withholding the reasoning rather than handing it over unearned.
  const [attempts, setAttempts] = useState(0)
  const [submittedTypes, setSubmittedTypes] = useState<string[]>([])
  // Keep the exact graph that produced the visible verdict. The player can
  // continue editing while the panel is open, but the mini-ADR must travel
  // with the evaluated decision, not with those later edits.
  const [submittedDesign, setSubmittedDesign] = useState(initialDesign)
  const [miniAdr, setMiniAdr] = useState<MiniAdr | null>(() => {
    if (!exercise) return null
    const attempt = [...localRankingAdapter.getHistory(exercise.id)]
      .reverse()
      .find((candidate) => isValidMiniAdr(candidate.miniAdr))
    return attempt && isValidMiniAdr(attempt.miniAdr) ? attempt.miniAdr : null
  })
  // These session mirrors include a just-created attempt even when browser
  // storage rejects the write. Progress can still respond honestly now while
  // the status region warns that it will not survive a reload.
  const [masteryAttempts, setMasteryAttempts] = useState(() =>
    localRankingAdapter.getHistory(),
  )
  const [transferEvidence, setTransferEvidence] = useState(() =>
    localTransferEvidenceAdapter.getAll(),
  )
  // Skips the FIRST design-change effect run below. That first run is the
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
  // R1-I ("the canvas frames its own content"): the React Flow pane's own
  // box, and NOT containerRef, which also spans the toolbar and status bar
  // above it, is what a node's rect is compared against to decide whether a
  // just-created node landed somewhere the player can actually see.
  const paneRef = useRef<HTMLDivElement>(null)
  // "Every panel that opens can be closed": closing the result panel
  // returns focus HERE, to the exact control that opened it.
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  // The same box, published for the objective card that floats over it. Only
  // inside the shell: free play has no card, and a stale custom property left
  // on <html> would anchor the next page's card to a pane that is gone.
  usePublishedPaneBox(paneRef, shell && panes.canvas)

  // A loaded exercise's own budget IS the team's operational capacity for
  // the "too many components to operate" rule (engine's evaluate() passes
  // exercise.budget.opsUnits as this same second argument). Live canvas
  // highlighting must agree with what submit() will actually score against.
  const findings = useMemo(
    () => evaluateLegality(design, exercise?.budget.opsUnits).findings,
    [design, exercise],
  )
  const errorNodeIds = useMemo(
    () =>
      new Set(
        findings
          .filter((f) => f.severity === 'blocking')
          .flatMap((f) => f.nodeIds),
      ),
    [findings],
  )
  const errorEdgeIds = useMemo(
    () =>
      new Set(
        findings
          .filter((f) => f.severity === 'blocking')
          .flatMap((f) => f.edgeIds),
      ),
    [findings],
  )

  // PC10's "equivalent": the list view reads the same findings the result
  // panel is showing, with the same right to quote what they cost, and not the
  // live legality pass, which runs before scoring and allocates no points.
  // Before the first submit there is no verdict yet and it falls back to the
  // live pass, which is exactly what the canvas is highlighting then. See
  // list-view-source.ts.
  const { findings: listFindings, ledger: listLedger } = useMemo(
    () => listViewSource(result, findings),
    [result, findings],
  )

  const hoveredFinding = useMemo(
    () => result?.findings.find((f) => f.id === hoveredFindingId) ?? null,
    [result, hoveredFindingId],
  )
  // A hovered finding dims every node and edge OUTSIDE its own ids. This is
  // the "findings must point at the canvas" requirement: the
  // prototype made the player translate prose into geometry by hand for 7
  // of 8 diagnoses. An empty union (a guarantee-missing finding never
  // carries nodeIds, see score.ts) dims nothing, which is an acceptable,
  // honest degrade: there is nothing on the canvas to circle.
  const dimmedNodeIds = useMemo(() => {
    if (!hoveredFinding || hoveredFinding.nodeIds.length === 0)
      return new Set<string>()
    const keep = new Set(hoveredFinding.nodeIds)
    return new Set(design.nodes.filter((n) => !keep.has(n.id)).map((n) => n.id))
  }, [design.nodes, hoveredFinding])
  const dimmedEdgeIds = useMemo(() => {
    if (!hoveredFinding || hoveredFinding.edgeIds.length === 0)
      return new Set<string>()
    const keep = new Set(hoveredFinding.edgeIds)
    return new Set(design.edges.filter((e) => !keep.has(e.id)).map((e) => e.id))
  }, [design.edges, hoveredFinding])

  // The exercise's own reasoning, once the player has earned it (the gate and
  // its reasoning live in reference-solutions.ts). `null` means the panel
  // shows nothing at all about it, never a locked or teaser state, which would
  // just be the remedy advertised instead of given.
  const references = useMemo(() => {
    if (!referenceSolutions || referenceSolutions.length === 0) return null
    if (!shouldRevealReferences(attempts, result)) return null
    // A perfect first attempt has earned the structural verdict, but the
    // reasoning stays the player's until they articulate the tradeoff. A
    // second attempt still uses the existing pedagogical reveal rule.
    if (
      attempts === 1 &&
      result?.kind === 'scored' &&
      result.score === result.ceiling &&
      !miniAdr
    )
      return null
    return {
      solutions: referenceSolutions,
      closestIndex: closestReferenceIndex(submittedTypes, referenceSolutions),
    }
  }, [referenceSolutions, attempts, result, submittedTypes, miniAdr])

  const masteryRows = useMemo(
    () =>
      requiredMasteryExerciseIds.map((exerciseId) =>
        exerciseMastery(exerciseId, masteryAttempts, transferEvidence, {
          transferProfiles,
        }),
      ),
    [requiredMasteryExerciseIds, masteryAttempts, transferEvidence, transferProfiles],
  )
  const completionEligibility = useMemo(
    () => gameCompletionEligibility(requiredMasteryExerciseIds, masteryRows),
    [requiredMasteryExerciseIds, masteryRows],
  )
  const currentMastery = exercise
    ? (masteryRows.find((entry) => entry.exerciseId === exercise.id) ?? null)
    : null

  const recordTransferForAttempt = useCallback(
    (attempt: SubmitAttemptResult): StorageWriteStatus | null => {
      const source = selectTransferSourceForPerfectAttempt(
        masteryRows,
        attempt,
        transferProfiles,
      )
      if (!source) return null
      const saved = localTransferEvidenceAdapter.save({
        sourceExerciseId: source.sourceExerciseId,
        targetExerciseId: attempt.exerciseId,
        targetAttemptId: attempt.id,
        succeededAt: attempt.createdAt,
        conceptId: source.conceptId,
      })
      setTransferEvidence((current) => {
        if (
          current.some(
            (item) =>
              item.sourceExerciseId === saved.sourceExerciseId &&
              item.targetAttemptId === saved.targetAttemptId,
          )
        ) {
          return current
        }
        return [...current, saved]
      })
      return saved.storage
    },
    [masteryRows, transferProfiles],
  )

  const [nodes, setNodes] = useState<ForjaFlowNode[]>([])
  const [edges, setEdges] = useState<ForjaFlowEdge[]>([])
  // Read by callbacks that must not re-create themselves on every
  // measurement React Flow emits (creation, and the pane menu's own item
  // list, which would otherwise rebuild while the menu is open).
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  // What the camera is actually showing, in flow coordinates. A new
  // component has to be born inside it: level 2 measured one landing at
  // screen x=-22 while the canvas started at x=241, because placement had
  // no idea where the camera was looking. Both corners go through React
  // Flow's own screen->flow conversion, so pan and zoom are already in it.
  const visibleFlowRect = useCallback((): PlacementRect | null => {
    const pane = paneRef.current?.getBoundingClientRect()
    if (!pane || pane.width <= 0 || pane.height <= 0) return null
    const topLeft = screenToFlowPosition({ x: pane.left, y: pane.top })
    const bottomRight = screenToFlowPosition({ x: pane.right, y: pane.bottom })
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    }
  }, [screenToFlowPosition])

  // React Flow is derived from the store. This is the ONE place a fresh
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
  // own render had actually committed, reproducible under Playwright's
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
  // fits inside the pane's own rect: nextCreatePosition and duplicateNode can
  // place a node past the pane's visible bottom edge once enough siblings
  // stack up in the same band. `fitView()` (the exact same instance method
  // the "encuadrar" control already calls) re-frames every current node,
  // never just the new one, so the rest of the design stays visible too.
  //
  // `{ preventScroll: true }` on the focus call is deliberate: a plain
  // `el.focus()` on an element the browser considers off-screen triggers
  // its OWN native scroll-into-view, at the PAGE level: a second, uncoded
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
    const el = document.querySelector<HTMLElement>(
      `.react-flow__node[data-id="${id}"]`,
    )
    if (el) {
      el.focus({ preventScroll: true })
      pendingFocusId.current = null
      const paneRect = paneRef.current?.getBoundingClientRect() ?? null
      if (!isFullyVisible(el.getBoundingClientRect(), paneRect)) {
        frameDiagram()
      }
    }
  }, [nodes, frameDiagram])

  // THE FIRST FRAME, which used to belong to React Flow's `fitView` prop.
  //
  // R1-I ("the canvas frames its own content") plus the owner's rule that a
  // band division may never be hidden. Both are one camera call now, and it
  // runs once, on the first render where there is something real to frame
  // against: the pane has been measured (`viewportReady`), it is actually on
  // screen, and the pieces, if there are any, have been measured too, because
  // their real rendered heights are the vertical half of the frame.
  //
  // A blank canvas does not wait for pieces, and that is the point. A
  // `greenfield` exercise opens with none, so React Flow's own prop never
  // fired: measured on a production build of
  // `/forja/1/n1-el-taller-que-todavia-anota-en-papel` at 1133, that canvas
  // opened at zoom 1 and pan 0 with the third band divider at x=1080 inside an
  // 833px pane, and only got a frame when the player dropped their first
  // piece. The bands are the only thing a blank canvas has to show, so they
  // are what it opens on.
  //
  // Without animation on purpose: this is the state the player arrives in
  // rather than a transition from another one, and an animated arrival is what
  // raced their first gesture (see the re-framing effect below, which skips
  // its own first run for the same reason).
  const framedOnArrival = useRef(false)
  useEffect(() => {
    if (framedOnArrival.current) return
    if (!viewportReady || !panes.canvas) return
    if (design.nodes.length > 0 && !nodesInitialized) return
    framedOnArrival.current = true
    frameDiagram({ duration: 0 })
  }, [
    viewportReady,
    panes.canvas,
    design.nodes.length,
    nodesInitialized,
    frameDiagram,
  ])

  // Opening an exercise deliberately does NOT scroll the page.
  //
  // It used to: a `containerRef.current?.scrollIntoView({ block: 'start' })`
  // ran on mount, to serve R1-I ("the canvas frames its own content"). The
  // pane's own box sat below the fold, so `fitView()`, which only moves the
  // CAMERA inside that box, could not bring its lower edges into the
  // window. That scroll fixed the framing and broke something worth more.
  // Measured at 390, 768, 1280, 1440 and 1920: it left exactly 64px of a
  // 515–991px statement on screen, underneath the fixed navbar
  // (`elementFromPoint(195, 32)` at 390px returned the navbar), with the
  // exercise title 400–730px above the top of the window. The product's
  // loop is statement → build → test, and the player was landing on step
  // two with step one out of sight.
  //
  // R1-I is a requirement about the camera: `fitView` must frame the
  // diagram inside the pane. That still holds, unchanged: the ReactFlow
  // `fitView` prop below, the reset handler, and the create handler are
  // untouched, and the camera it computes does not depend on where the
  // pane sits on the page. What is gone is the page-level scroll that was
  // bolted onto it, so the pane is simply where the page's own layout puts
  // it: below the statement, which is where it belongs. Every node and
  // connection is inside the window once the player reaches the canvas,
  // which is what canvas-frames-content.spec.ts now measures, and the
  // statement is readable on arrival, which brief-on-arrival.spec.ts
  // measures.
  //
  // Not scrolling also stops fighting the browser: on a back-navigation the
  // page restores the player's own scroll position, and a mount-time scroll
  // would have thrown it away.

  // Success used to write the empty string, which said nothing AND wiped
  // whatever the previous gesture had announced, while creating a component
  // announced itself the whole time, so the player had already been taught
  // that silence means nothing happened. It now names both ends of the
  // connection that exists and the gesture that has just become relevant:
  // a fresh connection declares no data class, and three engine rules read
  // that field.
  const announceVerdict = useCallback(
    (verdict: ConnectionVerdict, created: string | null) => {
      if (verdict.ok) {
        setStatus(created ? connectionCreatedMessage(created) : '')
        return
      }
      setStatus(
        `Conexión rechazada: ${verdict.why ?? ''} ${verdict.consequence ?? ''}`.trim(),
      )
    },
    [],
  )

  // Fix #7: undo used to leave the stale "X creado" text on screen (or any
  // other prior announcement) with no indication anything had happened.
  // The status bar is the same `role="status"` region for both, so an
  // explicit undo announcement replaces whatever was there before.
  const handleUndo = useCallback(() => {
    const undone = store.undo()
    setStatus(
      undone ? 'Se deshizo la última acción.' : 'No hay nada para deshacer.',
    )
  }, [store])

  const handleSetNodeProperty = useCallback(
    (nodeId: string, key: PlayerNodePropertyKey, value: string) => {
      const node = store
        .getDesign()
        .nodes.find((candidate) => candidate.id === nodeId)
      if (!node || !store.setNodeProperty(nodeId, key, value)) return
      const property = playerNodePropertyDefinitions(node.type).find(
        (definition) => definition.key === key,
      )
      const option = playerNodePropertyOption(node.type, key, value)
      setStatus(
        `${property?.label ?? key}: ${option?.label ?? value}. ${option?.consequence ?? 'La decisión quedó actualizada.'}`,
      )
    },
    [store],
  )

  // "Ordenar el diagrama". One store commit, so Ctrl+Z undoes the whole
  // arrangement with one press, and no commit at all when nothing moved, so a
  // second press does not bury the player's own last action under an empty
  // history entry. Both are the store's own guarantees (applyPositions).
  //
  // It announces which of the two happened. Silence after pressing a button is
  // what teaches a player that nothing happened, and "it was already tidy" is
  // a different answer from "it has been tidied".
  //
  // The re-frame is deliberately behind two frames: the store commit has to
  // reach React state, that state has to reach React Flow's own store, and
  // React Flow has to re-measure, before a camera computed from node bounds
  // means anything. That is the same reason the re-framing effect below waits.
  const handleArrange = useCallback(() => {
    if (!store.applyPositions(arrangedPositions(store.getDesign()))) {
      setStatus('El diagrama ya estaba ordenado.')
      return
    }
    setStatus(
      'Diagrama ordenado: una columna por banda y menos cables cruzados. Ctrl+Z lo deja como estaba.',
    )
    requestAnimationFrame(() => requestAnimationFrame(() => frameDiagram()))
  }, [store, frameDiagram])

  // R1-H item 4: "reiniciar el ejercicio". It goes back to the starting
  // design without leaving the page. Only meaningful for a loaded exercise
  // (free play has no startingDesign to reset to); a normal store commit,
  // so it stays undoable like every other mutation, and the existing
  // auto-persist effect below saves it as the new "volver y seguir" state.
  // R1-I: "the same MUST hold after a reset". It re-frames the starting
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
    frameDiagram()
  }, [store, exercise, frameDiagram])

  // R1-G requirement 6, "volver y seguir": persists the current design as a
  // draft (score: null, per RK7, never a score) every time it actually changes,
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
    const saved = localRankingAdapter.submit({
      exerciseId: exercise.id,
      design,
      score: null,
      ceiling: 100,
      engineVersion: ENGINE_VERSION,
    })
    const warning = persistenceWarning(saved.storage, 'intento')
    if (warning) setStatus(warning)
  }, [exercise, design])

  // B3 blocker: submit switches straight to the Resultado tab, which, unlike
  // the prototype, keeps the canvas mounted next to it (see the JSX
  // below) rather than replacing it, so a finding's highlight is visible the
  // moment the player looks at the canvas tab too.
  //
  // "Free play without a loaded exercise produces no score": no exercise
  // prop means this calls evaluateLegality alone: legality and findings,
  // never a guarantee/cost/score pass. Scoring free play against a
  // placeholder exercise is the exact defect this replaces (see
  // free-play.ts). R1-G: a REAL loaded exercise calls the real evaluate(),
  // the same engine surface every reference-solution test already proves
  // reaches exactly 100 for its two structurally distinct designs.
  //
  // RK7: LocalRankingAdapter.submit() always stores the full graph, legal
  // or not. Free play never has a score to store (score: null), so it
  // becomes personal history only, same as an illegal attempt today (see
  // local-adapter.ts's getSnapshot(), which filters null scores out of the
  // ranked total).
  const handleSubmit = useCallback(() => {
    let submitted: CanvasResult
    let savedAttempt: SubmitAttemptResult
    let transferStorage: StorageWriteStatus | null = null
    if (exercise) {
      const evaluation = evaluate(design, toExerciseSpec(exercise))
      submitted = toScoredResult(evaluation, exercise.guarantees)
      setResult(submitted)
      savedAttempt = localRankingAdapter.submit({
        exerciseId: exercise.id,
        design,
        score: evaluation.status === 'scored' ? evaluation.score : null,
        ceiling: evaluation.ceiling,
        engineVersion: ENGINE_VERSION,
      })
      setMasteryAttempts((current) => [...current, savedAttempt])
      transferStorage = recordTransferForAttempt(savedAttempt)
    } else {
      const legality = evaluateLegality(design)
      submitted = {
        kind: 'free-play',
        legal: legality.legal,
        findings: legality.findings,
      }
      setResult(submitted)
      savedAttempt = localRankingAdapter.submit({
        exerciseId: FREE_PLAY_EXERCISE_ID,
        design,
        score: null,
        ceiling: 100,
        engineVersion: ENGINE_VERSION,
      })
    }
    // The loudest gesture in the product was the only silent one: this never
    // announced anything, so the always-mounted live region kept saying
    // whatever the previous gesture had left there while the canvas went to
    // `display: none`. See submitMessage() for why the verdict panel cannot
    // carry this announcement on its own.
    const messages = [submitMessage(submitted)]
    if (transferStorage?.ok)
      messages.push(
        'También demostraste transferencia de una decisión anterior.',
      )
    const attemptWarning = persistenceWarning(savedAttempt.storage, 'intento')
    const transferWarning = transferStorage
      ? persistenceWarning(transferStorage, 'transferencia')
      : ''
    if (attemptWarning) messages.push(attemptWarning)
    if (transferWarning) messages.push(transferWarning)
    setStatus(messages.join(' '))
    setAttempts((n) => n + 1)
    setSubmittedTypes(designFingerprint(design))
    setSubmittedDesign(design)
    setView('result')
    // The statement folds out of the verdict's way, at every width.
    //
    // The verdict takes a 380px rail out of the pane, and what is left is the
    // diagram every finding in that verdict points at. An open statement either
    // stands on that diagram or makes the camera frame it into whatever is left
    // beside a 432px footprint, and measured, both are worse than folding: at
    // 1512 keeping it open framed the design at zoom 0.681 where folding frames
    // it at ~1.06. See forja-shell.ts for the table this replaced a threshold
    // with.
    //
    // Written straight to the attribute on <html> and NOT to the stored
    // preference: this is the arrangement the verdict needs, not a decision the
    // player made, and a player who never chose must not find their next
    // exercise folded because a verdict once arrived. The page's own script
    // reads that attribute rather than keeping a copy, so the pleca has already
    // turned round and one press brings the statement back. Pressing it IS a
    // decision, and that one is remembered.
    if (shell) {
      document.documentElement.setAttribute(
        STATEMENT_COLLAPSED_ATTRIBUTE,
        'true',
      )
    }
    window.dispatchEvent(new CustomEvent(RANKING_UPDATED_EVENT))
  }, [design, exercise, shell, recordTransferForAttempt])

  const handleSaveMiniAdr = useCallback(
    (value: MiniAdr) => {
      if (
        !exercise ||
        !result ||
        result.kind !== 'scored' ||
        result.status !== 'scored' ||
        result.score !== result.ceiling
      ) {
        return
      }
      const savedAttempt = localRankingAdapter.submit({
        exerciseId: exercise.id,
        design: submittedDesign,
        score: result.score,
        ceiling: result.ceiling,
        engineVersion: ENGINE_VERSION,
        miniAdr: value,
      })
      setMiniAdr(value)
      setMasteryAttempts((current) => [...current, savedAttempt])
      const transferStorage = recordTransferForAttempt(savedAttempt)
      const messages = [
        'Defensa guardada. Tu decisión ya puede recibir evidencia de transferencia.',
      ]
      if (transferStorage?.ok)
        messages.push(
          'También demostraste transferencia de una decisión anterior.',
        )
      const defenseWarning = persistenceWarning(savedAttempt.storage, 'defensa')
      const transferWarning = transferStorage
        ? persistenceWarning(transferStorage, 'transferencia')
        : ''
      if (defenseWarning) messages.push(defenseWarning)
      if (transferWarning) messages.push(transferWarning)
      setStatus(messages.join(' '))
      window.dispatchEvent(new CustomEvent(RANKING_UPDATED_EVENT))
    },
    [exercise, result, submittedDesign, recordTransferForAttempt],
  )

  // Every way the canvas pane's own width can change under it.
  //
  // Opening the result panel used to be the only one (`w-[380px] shrink-0`:
  // measured at 1440x900 the pane went from 1170px to 790px wide and two of
  // seven nodes left the view), so the design the verdict is about could be
  // partly outside the pane at the exact moment the player is asked to look
  // at it. Now the pane can also go from hidden to full width (a phone
  // switching back from Resultado to Lienzo) or from a third of the row to
  // all of it (rotating a tablet), and a stale camera transform is the same
  // defect in each case. So the trigger is the framing itself, the view, the
  // layout AND the playground's measured width, rather than one named tab.
  //
  // The width belongs in that key because the pane can now change size without
  // changing pane layout at all: on an exercise page the statement takes a
  // fixed column beside the playground, so every pixel the window gains or
  // loses goes straight to the canvas while `layout` stays put. Keying only on
  // the tier would leave the camera framing a width the pane no longer has.
  //
  // The first run is skipped deliberately: on mount the framing has not
  // changed yet, and React Flow's own `fitView` prop (or, in free play, the
  // untouched empty-canvas default zoom of R1-D2) already owns that moment.
  // "First" means the first run with a real measured width, not the render
  // before the container had a box. Treating that transition as a change
  // fires a 240ms camera animation on arrival, which then races the player's
  // very first gesture. Measured: 5 of 147 e2e specs failed against a
  // production build, every one of them a drag or a right-click issued from a
  // bounding box read moments earlier, all 5 green again with this gate.
  //
  // Nested requestAnimationFrame, not a bare effect: React Flow learns its
  // new pane size through a ResizeObserver, whose callbacks are delivered
  // after the frame's animation callbacks, so fitting on the first frame
  // would fit against the pane's old width. The second frame runs once the
  // observer has already updated the store.
  // Both folds are in the key, for two different reasons, and neither is
  // covered by the observer above.
  //
  // The statement's, because that rail is out of the layout flow: folding it
  // does not resize the pane, so the ResizeObserver never fires, and the only
  // thing that changed is the room the camera may use.
  //
  // The tools', because the observer above watches the PLAYGROUND's box, not
  // the pane's, and the playground does not change size when a rail inside it
  // folds. The pane does, by 280px, and React Flow's own resize handling
  // updates its dimensions without touching the camera: without this the
  // diagram would keep the zoom it had in the narrow pane and simply sit in a
  // wider one, which hands back the room and none of the legibility.
  const framing = `${currentView}|${layout}|${measuredWidth === null ? '?' : Math.round(measuredWidth)}|${statementCollapsed}:${statementLayoutRevision}|${toolsCollapsed}:${toolsLayoutRevision}|${JSON.stringify(fitPadding)}`
  const lastFraming = useRef<string | null>(null)
  useEffect(() => {
    if (measuredWidth === null) return
    if (lastFraming.current === framing) return
    const first = lastFraming.current === null
    lastFraming.current = framing
    if (first) return
    // Nothing to re-frame while the pane is `display: none`: it has no box.
    // Its next appearance changes `framing` again and fits it then.
    if (!panes.canvas) return
    // Layout re-frames are immediate. Two animated fits can otherwise race
    // when both rails are reopened quickly: the first animation finishes
    // against an obsolete pane width and leaves the last band clipped. The
    // gesture already supplies the visible movement through the changing pane;
    // the camera's job is to be correct on that same frame.
    let inner = 0
    let settle = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        // React Flow applies its own max-zoom constraint after its resize
        // observer has updated the pane. A short final task runs after that
        // constraint, so it cannot overwrite this fit with the zoom from the
        // wider pane that existed one gesture earlier.
        settle = window.setTimeout(() => frameDiagram({ duration: 0 }), 50)
      })
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
      window.clearTimeout(settle)
    }
  }, [framing, measuredWidth, panes.canvas, frameDiagram, fitPadding])

  const handleHoverFinding = useCallback((findingId: string | null) => {
    setHoveredFindingId(findingId)
  }, [])

  // Click persists the highlight as the canvas's own selection (the exact
  // state onSelectionChange already drives). It survives switching back
  // to the Lienzo tab, unlike hover.
  const handleSelectFinding = useCallback((finding: Finding) => {
    setSelectedNodeIds(new Set(finding.nodeIds))
    setSelectedEdgeIds(new Set(finding.edgeIds))
  }, [])

  // "Every panel that opens can be closed": switches the tab away from
  // 'result' and returns focus to the control that opened it. It never
  // clears `evaluation`, so reopening the Resultado tab shows the exact
  // same result, not a blank one.
  const handleCloseResultPanel = useCallback(() => {
    setView('canvas')
    submitButtonRef.current?.focus()
  }, [])

  // A new component looks for a real hole inside its own band, inside what
  // the camera is showing, clear of every box already on the canvas. The
  // rule it replaces stacked by sibling count and never looked at the other
  // nodes at all: swept with physical clicks across every playable
  // exercise, 165 of 495 creations landed ON TOP of an existing node in 121
  // of the 165 exercises, including one that buried the source handle of
  // the very service the exercise asked the player to connect.
  const handleCreate = useCallback(
    (type: ComponentType) => {
      const position = findFreePosition({
        layer: bandForType(type),
        occupied: occupiedRects(nodesRef.current),
        viewport: visibleFlowRect(),
      })
      const node = store.createNode(type, CATALOG_UI[type].label, position)
      pendingFocusId.current = node.id
      // Creation moves keyboard focus and opens the new node's decisions,
      // but does not claim that the graph selection changed before the player
      // selects it. Those are separate states in the accessible name.
      setPropertyNodeId(node.id)
      setSelectedEdgeIds(new Set())
      setStatus(`${CATALOG_UI[type].label} creado.`)
      // Where the library has a column of its own, the new piece appears next
      // to it and there is nothing to do. Where it is a pane of its own (a
      // phone), the player just acted on something they cannot see, so the
      // playground goes to look at it, which is also what the announcement
      // above is claiming happened.
      setView((current) => (current === 'library' ? 'canvas' : current))
    },
    [store, visibleFlowRect],
  )

  // Everything that leaves the canvas in one gesture, announced as one
  // sentence. React Flow reports a node deletion and the connections it
  // took down with it through two separate callbacks in the same tick, so
  // they are buffered and flushed together. "Se eliminó X." followed
  // immediately by "Se eliminaron 2 conexiones." would read as two
  // unrelated events, and `role="status"` only keeps the last one anyway.
  const pendingDeletion = useRef<{ nodes: string[]; edges: string[] } | null>(
    null,
  )
  const announceDeletion = useCallback(
    (nodeLabels: string[], edgeLabels: string[]) => {
      if (!pendingDeletion.current) {
        pendingDeletion.current = { nodes: [], edges: [] }
        queueMicrotask(() => {
          const batch = pendingDeletion.current
          pendingDeletion.current = null
          if (batch) setStatus(deletionMessage(batch.nodes, batch.edges))
        })
      }
      pendingDeletion.current.nodes.push(...nodeLabels)
      pendingDeletion.current.edges.push(...edgeLabels)
    },
    [],
  )

  // For the paths that call the store directly (the node context menu, the
  // list view). React Flow is not involved there, so nothing else reports
  // the connections the node takes down with it. Resolved against the
  // design as it is BEFORE the deletion commits: afterwards the labels are
  // gone and the message would name nothing.
  const deleteNodeWithAnnouncement = useCallback(
    (nodeId: string) => {
      const node = design.nodes.find((n) => n.id === nodeId)
      if (!node) return
      const attached = design.edges.filter(
        (e) => e.from.node === nodeId || e.to.node === nodeId,
      )
      announceDeletion(
        [node.label],
        attached.map((e) => edgeDescription(design, e.id)),
      )
      store.deleteNode(nodeId)
    },
    [design, announceDeletion, store],
  )

  const deleteEdgeWithAnnouncement = useCallback(
    (edgeId: string) => {
      if (!design.edges.some((e) => e.id === edgeId)) return
      announceDeletion([], [edgeDescription(design, edgeId)])
      store.deleteEdge(edgeId)
    },
    [design, announceDeletion, store],
  )

  // The gesture the exercises' own statements assume exists: declaring WHAT
  // travels through a connection. Every surface that offers it (the edge
  // context menu, its keyboard equivalent, the list view's select) calls this
  // one function, so the mutation, the announcement and the consequence are
  // identical whichever way the player got there.
  //
  // It deliberately does not refuse a declaration that turns the design
  // illegal. See data-class-feedback.ts for the argument. `evaluateLegality`
  // runs twice around the commit so the message can name exactly what the
  // declaration caused and nothing that was already there; the second pass
  // reads `store.getDesign()` rather than `design`, which is still the
  // pre-commit projection at this point in the render.
  const setEdgeDataClass = useCallback(
    (edgeId: string, dataClass?: DataClass) => {
      if (!design.edges.some((e) => e.id === edgeId)) return
      const endpoints = edgeEndpoints(design, edgeId)
      const description = edgeDescription(design, edgeId)
      store.setEdgeDataClass(edgeId, dataClass)
      const after = evaluateLegality(
        store.getDesign(),
        exercise?.budget.opsUnits,
      ).findings
      setStatus(
        dataClassMessage(
          description,
          dataClass ? DATA_CLASSES[dataClass].label : null,
          newlyBlockingFindings(findings, after, edgeId, endpoints),
        ),
      )
    },
    [design, findings, store, exercise],
  )

  // Live band clamp (PC7 design note). It mirrors the store's own clamp in
  // moveNode() so the node visibly can't leave its band mid-drag, not just
  // snap back once onNodeDragStop commits. Both read the same bands.ts
  // function, so the two can never disagree about where the boundary is.
  // Only touches nodes with an ACTUAL position change in this batch. React
  // Flow also routes dimension-measurement events through onNodesChange,
  // and re-wrapping every node's object on every one of those (regardless
  // of change type) fed back into another measurement pass and produced a
  // real infinite render loop under Playwright, reproducible only in the
  // production build.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const movedIds = new Set(
        changes.filter((c) => c.type === 'position').map((c) => c.id),
      )
      setNodes((current) => {
        const next = applyNodeChanges(changes, current) as ForjaFlowNode[]
        if (movedIds.size === 0) return next
        return next.map((n) => {
          if (!movedIds.has(n.id)) return n
          const domainNode = design.nodes.find((d) => d.id === n.id)
          if (!domainNode) return n
          return {
            ...n,
            position: clampToBand(n.position, bandForType(domainNode.type)),
          }
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
  // dragging (handle highlight feedback). It reuses the exact module the
  // scorer gates on, never a UI-side re-implementation of legality. The
  // store mutation itself happens once, in onConnect below.
  const isValidConnection = useCallback(
    (edgeOrConnection: Connection | ForjaFlowEdge) => {
      const source =
        'source' in edgeOrConnection ? edgeOrConnection.source : undefined
      const target =
        'target' in edgeOrConnection ? edgeOrConnection.target : undefined
      if (!source || !target) return false
      if (findDuplicateEdge(design, source, target)) return false
      return checkConnection(design, { node: source }, { node: target }).ok
    },
    [design],
  )

  // The one place every gesture that creates a connection goes through, so
  // "the same connection twice" is refused identically by drag, by the
  // keyboard command and by the context menu. Three drags of the same pair
  // used to leave three superimposed, indistinguishable connections and
  // make the result panel repeat the same note three times, with no signal.
  // Duplication is not an engine concern (it breaks no domain rule), so the
  // check lives beside the gesture and never inside checkConnection.
  const attemptConnection = useCallback(
    (fromNodeId: string, toNodeId: string) => {
      if (findDuplicateEdge(design, fromNodeId, toNodeId)) {
        setStatus(duplicateConnectionMessage(design, fromNodeId, toNodeId))
        return
      }
      const result = store.connect(fromNodeId, toNodeId)
      // The description is read from the design the store just committed. The
      // `design` in this closure is still the pre-commit projection, and would
      // not contain the edge whose creation is being announced.
      announceVerdict(
        result.verdict,
        result.edge ? edgeDescription(store.getDesign(), result.edge.id) : null,
      )
    },
    [design, store, announceVerdict],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      attemptConnection(connection.source, connection.target)
    },
    [attemptConnection],
  )

  // isValidConnection rejecting the drag means onConnect never fires for an
  // illegal pointer attempt, so this is the only place that still sees the
  // gesture end, so it is the one that announces WHY it was refused.
  const onConnectEnd: OnConnectEnd = useCallback(
    (_event, connectionState: FinalConnectionState) => {
      if (connectionState.isValid !== false) return
      const fromId = connectionState.fromNode?.id
      const toId = connectionState.toNode?.id
      // The drag was released on nothing: the pane, or the body of a node
      // rather than its handle. This returned without a word, which is the
      // likeliest way the gesture ends: the handle is 5.6px on screen and
      // the node body around it is 98x32px.
      if (!fromId || !toId) {
        setStatus(connectionDroppedMessage())
        return
      }
      if (findDuplicateEdge(design, fromId, toId)) {
        setStatus(duplicateConnectionMessage(design, fromId, toId))
        return
      }
      announceVerdict(
        checkConnection(design, { node: fromId }, { node: toId }),
        null,
      )
    },
    [design, announceVerdict],
  )

  // React Flow reports the deleted nodes and the connections they took down
  // with them through these two callbacks in the same tick (see its own
  // handleDelete: onEdgesDelete(matchingEdges) then onNodesDelete(
  // matchingNodes)), which is why both only BUFFER their half of the
  // sentence. announceDeletion flushes the whole batch as one message.
  const onNodesDelete: OnNodesDelete<ForjaFlowNode> = useCallback(
    (deleted) => {
      announceDeletion(
        deleted.map(
          (node) =>
            design.nodes.find((n) => n.id === node.id)?.label ??
            node.data.label,
        ),
        [],
      )
      deleted.forEach((node) => store.deleteNode(node.id))
    },
    [store, design.nodes, announceDeletion],
  )

  const onEdgesDelete: OnEdgesDelete<ForjaFlowEdge> = useCallback(
    (deleted) => {
      announceDeletion(
        [],
        deleted.map((edge) => edgeDescription(design, edge.id)),
      )
      deleted.forEach((edge) => store.deleteEdge(edge.id))
    },
    [store, design, announceDeletion],
  )

  // Selecting a connection with the pointer, from its own midpoint target
  // (EdgeHitTargets). Focus moves to React Flow's real edge element, so the
  // Delete key, the accessible name and the focus ring all behave exactly
  // as they do when the connection is reached with the keyboard. This is a
  // second way IN, never a second selection mechanism.
  const handleSelectEdge = useCallback((edgeId: string) => {
    setSelectedNodeIds(new Set())
    setSelectedEdgeIds(new Set([edgeId]))
    const escaped =
      typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(edgeId) : edgeId
    const el = document.querySelector<SVGGElement>(
      `.react-flow__edge[data-id="${escaped}"]`,
    )
    el?.focus?.({ preventScroll: true })
  }, [])

  const describeEdge = useCallback(
    (edgeId: string) => edgeDescription(design, edgeId),
    [design],
  )

  // Writes state ONLY when the selection actually changed. React Flow emits
  // this on its own schedule, including on remount with a selection
  // identical to the one already held, and an unconditional `new Set(...)`
  // is a new identity every time. The node/edge reprojection effect keys on
  // that identity, so an unchanged selection still produced a new nodes
  // array, which React Flow synced into its own store, which emitted
  // selection-change again: an infinite render loop that unmounted the whole
  // playground (React error #185).
  //
  // Reproduced with physical input: open an exercise, drag any node, switch
  // to "Vista de lista", switch back to "Lienzo": 7 nodes and 3 tabs became
  // 0 and 0, and only a reload brought the game back. The drag matters: it
  // leaves a selection behind for the remount to re-emit.
  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selNodes, edges: selEdges }) => {
      const nodeIds = selNodes.map((n) => n.id)
      const edgeIds = selEdges.map((e) => e.id)
      if (nodeIds.length === 1) setPropertyNodeId(nodeIds[0])
      setSelectedNodeIds((current) =>
        sameSelection(current, nodeIds) ? current : new Set(nodeIds),
      )
      setSelectedEdgeIds((current) =>
        sameSelection(current, edgeIds) ? current : new Set(edgeIds),
      )
    },
    [],
  )

  // Completes the context menu's "Conectar con…" (PC15) via a real pointer
  // click on the target, through the same connectSourceId state machine the
  // keyboard 'c' command already drives, just finished by a different
  // gesture. checkConnection/store.connect stay the single implementation
  // of legality either way.
  //
  // Deliberately a raw window `click` listener, NOT React Flow's own
  // `onNodeClick` prop: calling store.connect() (which mutates `design`,
  // triggering a React state update) from directly inside RF's own
  // synthetic click handling caused a real, reproducible "Maximum update
  // depth exceeded" crash under Playwright. RF appears to do its own
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
      const targetEl = (
        event.target as HTMLElement | null
      )?.closest<HTMLElement>('.react-flow__node')
      const targetId = targetEl?.getAttribute('data-id')
      if (!targetId || targetId === sourceId) return
      attemptConnection(sourceId, targetId)
      setConnectSourceId(null)
    }
    window.addEventListener('click', onClick, { capture: true })
    return () => window.removeEventListener('click', onClick, { capture: true })
  }, [attemptConnection])

  // React Flow's own contextmenu hooks, never a hand-rolled pointerdown plus
  // contextmenu race, which is exactly the prototype's B-class bug (right
  // button also triggered pointerdown, redrawing the canvas and destroying
  // the element before `contextmenu` fired, so the node menu could never
  // open). onNodeContextMenu/onPaneContextMenu already distinguish node vs
  // pane for us.
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: ForjaFlowNode) => {
      event.preventDefault()
      setSelectedNodeIds(new Set([node.id]))
      setContextMenu({
        kind: 'node',
        nodeId: node.id,
        x: event.clientX,
        y: event.clientY,
      })
    },
    [],
  )

  // Opening the edge menu, from either pointer route. React Flow's own
  // `onEdgeContextMenu` covers a right-click that lands on the rendered stroke;
  // EdgeHitTargets covers the rest, which is not a corner case: 73 of 964
  // connections across the playable exercises cannot be hit on their stroke at
  // all (see EdgeHitTargets.tsx). Both funnel here so the menu, the selection
  // and the focus behave identically either way.
  const openEdgeMenu = useCallback((edgeId: string, x: number, y: number) => {
    setSelectedNodeIds(new Set())
    setSelectedEdgeIds(new Set([edgeId]))
    setContextMenu({ kind: 'edge', edgeId, x, y })
  }, [])

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: ForjaFlowEdge) => {
      event.preventDefault()
      openEdgeMenu(edge.id, event.clientX, event.clientY)
    },
    [openEdgeMenu],
  )

  const onEdgeHitContextMenu = useCallback(
    (edgeId: string, event: React.MouseEvent) =>
      openEdgeMenu(edgeId, event.clientX, event.clientY),
    [openEdgeMenu],
  )

  const screenToFlowPositionRef = useRef(screenToFlowPosition)
  screenToFlowPositionRef.current = screenToFlowPosition

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault()
      const clientX = 'clientX' in event ? event.clientX : 0
      const clientY = 'clientY' in event ? event.clientY : 0
      const flowPosition = screenToFlowPositionRef.current({
        x: clientX,
        y: clientY,
      })
      setContextMenu({ kind: 'pane', x: clientX, y: clientY, flowPosition })
    },
    [],
  )

  const closeContextMenu = useCallback(
    (returnFocus: boolean) => {
      if (returnFocus && contextMenu?.kind === 'node') {
        pendingFocusId.current = null
        const el = document.querySelector<HTMLElement>(
          `.react-flow__node[data-id="${contextMenu.nodeId}"]`,
        )
        el?.focus()
      }
      // Same contract for a connection: Escape puts focus back on the thing the
      // menu was about, so a keyboard player never lands nowhere.
      if (returnFocus && contextMenu?.kind === 'edge') {
        const el = document.querySelector<SVGGElement>(
          `.react-flow__edge[data-id="${contextMenu.edgeId}"]`,
        )
        el?.focus?.()
      }
      setContextMenu(null)
    },
    [contextMenu],
  )

  // PC15's fixed action set (connect/rename/duplicate/colour/delete) plus
  // PC16's six swatches. Every id here is also the Playwright test's
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
          setStatus(
            'Modo conectar activo. Elegí el nodo destino con Tab y presioná Enter, o hacé clic en él. Escape para cancelar.',
          )
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
      ...(playerNodePropertyDefinitions(domainNode.type).length > 0
        ? [
            {
              id: 'configure',
              label: 'Configurar decisiones',
              onSelect: () => {
                setSelectedNodeIds(new Set([nodeId]))
                setSelectedEdgeIds(new Set())
                if (toolsCollapsed) toggleTools()
                setStatus(`Configuración abierta para ${domainNode.label}.`)
              },
            },
          ]
        : []),
      ...PLAYER_COLOR_ORDER.map((color) => ({
        id: `color-${color}`,
        label: PLAYER_COLORS[color].label,
        swatchClass: PLAYER_COLORS[color].swatchClass,
        onSelect: () => store.setNodeColor(nodeId, color),
      })),
      {
        id: 'delete',
        label: 'Eliminar',
        danger: true,
        onSelect: () => deleteNodeWithAnnouncement(nodeId),
      },
    ]
  }, [
    contextMenu,
    design.nodes,
    store,
    deleteNodeWithAnnouncement,
    toolsCollapsed,
    toggleTools,
  ])

  // The connection menu: declare what travels (four options, radio semantics
  // because exactly one of them can hold), take the declaration back, delete.
  //
  // "Sin declarar" only appears once there IS a declaration to remove. An
  // option that undoes nothing is one more thing to read past on the menu a
  // player opens most.
  const edgeMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (contextMenu?.kind !== 'edge') return []
    const { edgeId } = contextMenu
    const edge = design.edges.find((e) => e.id === edgeId)
    if (!edge) return []
    return [
      ...DATA_CLASS_ORDER.map((dataClass) => ({
        id: `data-class-${dataClass}`,
        label: DATA_CLASSES[dataClass].label,
        swatchColor: DATA_CLASSES[dataClass].stroke,
        checked: edge.dataClass === dataClass,
        onSelect: () => setEdgeDataClass(edgeId, dataClass),
      })),
      ...(edge.dataClass
        ? [
            {
              id: 'data-class-clear',
              label: 'Sin declarar',
              onSelect: () => setEdgeDataClass(edgeId, undefined),
            },
          ]
        : []),
      {
        id: 'delete-edge',
        label: 'Eliminar conexión',
        danger: true,
        onSelect: () => deleteEdgeWithAnnouncement(edgeId),
      },
    ]
  }, [contextMenu, design.edges, setEdgeDataClass, deleteEdgeWithAnnouncement])

  const paneMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (contextMenu?.kind !== 'pane') return []
    const { flowPosition } = contextMenu
    return (Object.keys(CATALOG) as ComponentType[]).map((type) => ({
      id: `add-${type}`,
      label: CATALOG_UI[type].label,
      onSelect: () => {
        // The point the player right-clicked is a request, not an order:
        // it is honoured when it is free and inside the type's own band,
        // and the nearest real hole is used when it is not. Dropping a
        // component exactly where another one already sits is the same
        // defect as the library path, reached by a different gesture.
        const position = findFreePosition({
          layer: bandForType(type),
          occupied: occupiedRects(nodesRef.current),
          viewport: visibleFlowRect(),
          preferred: flowPosition,
        })
        const node = store.createNode(type, CATALOG_UI[type].label, position)
        pendingFocusId.current = node.id
        setStatus(`${CATALOG_UI[type].label} creado.`)
      },
    }))
  }, [contextMenu, store, visibleFlowRect])

  // Keyboard connect command [PC3]: 'c' on a focused node starts connect
  // mode, Tab moves focus to the target, Enter completes it, Escape cancels.
  // Capture phase so this runs before React Flow's own Enter/Escape node
  // handling (elementSelectionKeys) can swallow the event.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const active = document.activeElement
      // PC15: ContextMenu key or Shift+F10 opens the focused node's menu,
      // anchored near the node itself since there is no pointer coordinate
      // for a keyboard-triggered open.
      const menuKey =
        event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')
      if (menuKey && isForjaNodeElement(active)) {
        event.preventDefault()
        const id = active.getAttribute('data-id')!
        const rect = active.getBoundingClientRect()
        setContextMenu({
          kind: 'node',
          nodeId: id,
          x: rect.left,
          y: rect.bottom,
        })
        return
      }
      // "Every gesture has a keyboard equivalent." A connection is already
      // reachable with Tab and already carries its own accessible name
      // (project.ts), so the same key that opens a node's menu opens its own:
      // one rule for both, rather than a second shortcut to learn. Anchored at
      // the edge's own rendered box, like the node path.
      if (menuKey && isForjaEdgeElement(active)) {
        event.preventDefault()
        const id = active.getAttribute('data-id')!
        const rect = active.getBoundingClientRect()
        openEdgeMenu(id, rect.left, rect.bottom)
        return
      }
      if (event.key === 'c' && !connectSourceId && isForjaNodeElement(active)) {
        const id = active.getAttribute('data-id')!
        setConnectSourceId(id)
        setStatus(
          'Modo conectar activo. Elegí el nodo destino con Tab y presioná Enter. Escape para cancelar.',
        )
        return
      }
      // "Every panel that opens can be closed": Escape closes the result
      // panel, same as its own close button. Guarded on `!contextMenu`,
      // because that overlay owns Escape when it is the thing actually open.
      if (event.key === 'Escape' && view === 'result' && !contextMenu) {
        handleCloseResultPanel()
        return
      }
      if (connectSourceId && event.key === 'Escape') {
        setConnectSourceId(null)
        setStatus('Conexión cancelada.')
        return
      }
      if (
        connectSourceId &&
        event.key === 'Enter' &&
        isForjaNodeElement(active)
      ) {
        const targetId = active.getAttribute('data-id')!
        if (targetId === connectSourceId) return
        event.preventDefault()
        event.stopPropagation()
        attemptConnection(connectSourceId, targetId)
        setConnectSourceId(null)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () =>
      window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [
    connectSourceId,
    attemptConnection,
    handleUndo,
    view,
    contextMenu,
    handleCloseResultPanel,
    openEdgeMenu,
  ])

  // The three game actions, built once and rendered in whichever row owns them.
  // Extracted rather than duplicated for the two cases: two copies of three
  // buttons is where a handler silently stops being wired on one of them.
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        ref={submitButtonRef}
        type="button"
        onClick={handleSubmit}
        data-testid="submit-button"
        className={
          shell
            ? 'h-10 rounded-md bg-accent px-2 text-xs font-medium text-on-accent hover:bg-accent-strong lg:px-4 lg:text-sm lg:font-semibold'
            : 'rounded-md bg-accent px-2 py-2 text-xs font-medium text-on-accent hover:bg-accent-strong lg:px-3 lg:py-1.5 lg:text-sm'
        }
      >
        Probar respuesta
      </button>
      <button
        type="button"
        onClick={handleUndo}
        data-testid="undo-button"
        className={
          shell
            ? 'h-10 rounded-md border border-border-subtle px-2 text-xs font-medium text-txt-secondary hover:bg-bg-surface-hover hover:text-txt-primary lg:px-3 lg:text-sm'
            : 'rounded-md border border-border-subtle px-2 py-2 text-xs text-txt-secondary hover:bg-bg-surface-hover hover:text-txt-primary lg:px-3 lg:py-1.5 lg:text-sm'
        }
      >
        {/* The shortcut hint is for a large desktop only. On a compact
            workbench those pixels belong to the exercise title. */}
        Deshacer{' '}
        <kbd className="ml-1 hidden font-sans text-xs text-txt-muted 2xl:inline">
          Ctrl+Z
        </kbd>
      </button>
      {exercise && (
        <button
          type="button"
          onClick={handleReset}
          data-testid="reset-exercise-button"
          aria-label="Reiniciar ejercicio"
          className={
            shell
              ? 'h-10 rounded-md border border-border-subtle px-2 text-xs font-medium text-txt-secondary hover:bg-bg-surface-hover hover:text-txt-primary lg:px-3 lg:text-sm'
              : 'rounded-md border border-border-subtle px-2 py-2 text-xs text-txt-secondary hover:bg-bg-surface-hover hover:text-txt-primary lg:px-3 lg:py-1.5 lg:text-sm'
          }
        >
          Reiniciar<span aria-hidden="true" className="hidden lg:inline"> ejercicio</span>
        </button>
      )}
    </div>
  )

  return (
    <div
      ref={containerRef}
      // The playground scrolls itself into view when it is reset (opening
      // an exercise no longer scrolls at all; see the comment above the
      // reset handler). Without this margin, `block: 'start'` aligns this
      // box with y=0, underneath the site's fixed navbar, and the toolbar
      // below stops being clickable with a pointer (see playground-chrome.ts
      // for the measurement). Inline rather than a Tailwind class so the
      // number and its test have a single source.
      style={{ scrollMarginTop: PLAYGROUND_SCROLL_MARGIN_PX }}
      // PC17: `relative` gives ContextMenu its positioning ancestor;
      // `isolate` gives the whole playground its own stacking context, so
      // nothing rendered inside, no matter what z-index it uses, can ever
      // paint above the site's fixed navbar, which lives outside this box.
      className={
        shell
          ? // Inside the shell the playground takes the row the page gives it
            // and nothing else: no rounding, no border, no 75vh. That is what
            // "lienzo a sangre" is, and it is only correct where the page
            // itself owns the window height (BaseLayout.astro's app chrome).
            'relative isolate flex h-full min-h-0 flex-col overflow-hidden'
          : 'relative isolate flex h-[75vh] min-h-[560px] flex-col overflow-hidden rounded-lg border border-border-subtle'
      }
    >
      {/* `flex-wrap`: at 390px the tabs and the three actions are ~700px of
          content in a 366px row. Wrapping costs one row of height and keeps
          every control reachable; without it the actions overflowed the box's
          own `overflow-hidden` and "Probar respuesta" was unreachable, the
          same class of defect as the navbar overlap one viewport smaller.

          Inside the shell the actions leave this row for the top bar, so what
          is left is the view switcher on its own. */}
      <div
        data-testid="playground-view-bar"
        className={
          shell
            ? // Inside the shell this row is not a bar. It shipped with the
              // top bar's own `bg-bg-surface` and `border-b border-border-subtle`,
              // which made 56px of chrome read as 96px of it with an arbitrary
              // rule through the middle. The shell declares one row
              // (forja-shell.ts) and this is how it keeps its word: the tabs
              // stay, the surface and the line go, and the row belongs to the
              // workspace under it instead of to the chrome over it.
              'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2'
            : // Free play is a boxed playground inside an ordinary page, where
              // this row is its entire toolbar and its own line is what tells
              // it apart from the article around it.
              'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border-subtle bg-bg-surface px-3 py-2'
        }
      >
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Vista del diseño"
        >
          {/* The library only earns a tab where it has no column of its own.
              See responsive-layout.ts. First, because picking a piece is the
              first thing a player does. */}
          {libraryIsOwnPane(layout) && (
            <ViewTab
              view="library"
              currentView={currentView}
              onSelect={setView}
              testId="view-library-tab"
            >
              Biblioteca
            </ViewTab>
          )}
          <ViewTab view="canvas" currentView={tabView} onSelect={setView}>
            Lienzo
          </ViewTab>
          <ViewTab
            view="list"
            currentView={tabView}
            onSelect={setView}
            testId="view-list-tab"
          >
            Vista de lista
          </ViewTab>
          {/* Absent while the verdict is a rail beside the canvas: a tab that
              switches to something already on screen is the same noise the
              library rail has never had a tab for (resultIsRail). Closing the
              verdict brings it back, which is what keeps it the way to reopen
              one. */}
          {verdictHasOwnTab && (
            <ViewTab
              view="result"
              currentView={tabView}
              onSelect={setView}
              testId="view-result-tab"
            >
              Resultado
            </ViewTab>
          )}
        </div>
        {/* The three game actions. Where they RENDER depends on the shell:
            inside it they belong to the top bar, which is where the owner
            wants them read. The portal is what lets them move without the
            wiring moving: they keep this component's state, its callbacks and
            the `data-testid`s the browser suite drives. Free play has no bar,
            so `actionsSlot` is null and they stay in this row. */}
        {actionsSlot === null ? actions : createPortal(actions, actionsSlot)}
      </div>

      {/* The description every connection points at (project.ts's
          EDGE_HELP_ID). One element rather than one per connection: it is
          the same sentence for all of them, and 987 copies would be 987
          copies to keep in step. It replaces React Flow's own English
          default, which described shortcuts this playground does not have. */}
      <span id={EDGE_HELP_ID} className="sr-only">
        {EDGE_HELP_TEXT}
      </span>

      <div className="flex flex-1 overflow-hidden">
        {
          // Mounted for EVERY view, including 'list'. Hidden with CSS, never
          // torn down. Two reasons, one of them a crash:
          //
          // 1. Unmounting and remounting the ReactFlow instance made it
          //    re-measure a node array we replace wholesale from the store.
          //    Each measurement emitted onNodesChange, which set our state,
          //    which React Flow's own StoreUpdater synced back and measured
          //    again: an infinite render loop that unmounted the entire
          //    playground (React error #185, "Maximum update depth
          //    exceeded"), preceded by React Flow's own warning that it was
          //    "trying to drag a node that is not initialized". Reproduced
          //    with physical input: drag any node, switch to "Vista de
          //    lista", switch back to "Lienzo". 7 nodes and 3 tabs became 0.
          // 2. It is what lets a hovered finding highlight real canvas nodes
          //    while the result panel has visual focus, which is the reason the
          //    instance was already kept alive for 'result'.
          //
          // `min-w-0` keeps this flex-1 child from refusing to shrink below
          // its content's intrinsic width, which is what actually lets the
          // fixed-width ResultPanel sidebar coexist with it instead of
          // overflowing the row.
          <div
            ref={paneRef}
            className={panes.canvas ? 'min-w-0 flex-1' : 'hidden'}
            data-testid="forja-canvas"
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              // R1-I: "when an exercise opens, the canvas MUST frame its
              // starting design". That used to be React Flow's own `fitView`
              // prop, which fires once, the first time `nodes` is both
              // non-empty and measured. It is gone for two reasons, and
              // `frameDiagram` (see the arrival effect above) replaces it.
              //
              // It frames the NODES, and the camera now owes the three bands a
              // frame too. And it never fires at all where there are no nodes,
              // which is exactly the `greenfield` exercises that open blank:
              // that canvas sat at zoom 1 and pan 0 with a band divider
              // outside the pane until the player dropped their first piece.
              //
              // See band-camera.ts for both, and for what the change cost.
              onInit={handleFlowInit}
              // See MIN_ZOOM: React Flow's own 0.5 floor is what left 4 of 7
              // nodes outside a 136px pane.
              minZoom={MIN_ZOOM}
              // The other half of the same rule, and the half that answers the
              // player's own gestures rather than the camera's: no wheel and no
              // drag may hide a band division. `maxZoom` keeps at least the
              // bands' full width inside the pane; `translateExtent` pins that
              // width horizontally, which d3-zoom implements by centring an
              // extent narrower than the viewport. Vertical panning is
              // untouched. See band-camera.ts.
              maxZoom={maxZoom}
              translateExtent={BAND_TRANSLATE_EXTENT}
              ariaLabelConfig={CANVAS_CONTROL_LABELS}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onNodeContextMenu={onNodeContextMenu}
              onEdgeContextMenu={onEdgeContextMenu}
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
              // This used to be the string "dark", on the argument that ISF's
              // default is dark premium editorial. The argument was wrong the
              // moment a player used the site's own switch: they got a light
              // page, a light library rail, light node cards, and React Flow's
              // dark chrome painting a #0a0f1a rectangle in the middle of it.
              // Now it follows the class the switch writes on <html>. See
              // use-site-theme.ts for why that class and not a
              // `prefers-color-scheme` read.
              colorMode={theme}
              // R1-E contrast fix: React Flow's own default edge stroke fails
              // WCAG 1.4.11's 3:1 floor for a graphical object in BOTH of the
              // library's themes (#3e3e3e on #141414, #b1b1b7 on near-white).
              // See edge-theme.ts and tests/canvas/edge-contrast.test.ts.
              // Inline style wins the cascade over the library's own
              // `.react-flow.dark` class rule for the same custom
              // properties, which an ancestor override or a same-specificity
              // utility class could not guarantee. The values are custom
              // properties rather than colours, so one declaration serves both
              // themes without giving that win up.
              style={CANVAS_EDGE_STYLE_VARS as React.CSSProperties}
            >
              <BandLane labelTopPx={bandLabelTopPx} />
              {/* The working surface. It used to be a bare `<Background />`,
                  which is React Flow choosing how this product's canvas looks:
                  its own gap of 20 and dot of 1, and a colour that measured
                  2.57:1 on the dark theme against 1.56:1 on the light one, so
                  the theme the product opens in had a grid almost twice as
                  loud. Both numbers and both colours are now chosen and
                  measured, and the reasoning is in canvas-background.ts. */}
              <Background
                variant={CANVAS_DOT_GRID.variant}
                gap={CANVAS_DOT_GRID.gap}
                size={CANVAS_DOT_GRID.size}
              />
              {/* Bottom RIGHT, which is React Flow's own default moved once and
                  for a measured reason. The statement is the left rail now, and
                  it runs the pane's full height, so the pane's bottom-left
                  corner is underneath it: measured, a real click on
                  "encuadrar" was intercepted by the rail and three e2e specs
                  that drive that control failed on a production build. The
                  pane's right edge is where the tools rail starts, and the rail
                  is outside the pane, so nothing overlaps this corner in any
                  combination of the two folds. */}
              {/* React Flow's own "fit view" button is off and replaced by
                  the identical-looking one below. Its handler calls `fitView`,
                  which frames the pieces and would put a band division back
                  outside the pane on every press, and passing `onFitView`
                  does not replace that call, it only runs after it. The class
                  name is kept because it is the control the browser suite
                  already drives, and the accessible name is now in the
                  player's own language instead of React Flow's English. */}
              <Controls
                showInteractive={false}
                showFitView={false}
                position="bottom-right"
              >
                <ControlButton
                  className="react-flow__controls-fitview"
                  onClick={() => frameDiagram()}
                  title={CANVAS_CONTROL_LABELS['controls.fitView.ariaLabel']}
                  aria-label={
                    CANVAS_CONTROL_LABELS['controls.fitView.ariaLabel']
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 32 30"
                    aria-hidden="true"
                  >
                    <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
                  </svg>
                </ControlButton>
                {/* Ordering changes the diagram's presentation, just like the
                    camera controls change its view. Keeping it in this stack
                    makes the four spatial actions one predictable group. */}
                <ControlButton
                  onClick={handleArrange}
                  data-testid="arrange-button"
                  title="Ordenar el diagrama"
                  aria-label="Ordenar el diagrama"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M3 4h18v4H3V4Zm4 6h14v4H7v-4Zm-4 6h18v4H3v-4Z" />
                  </svg>
                </ControlButton>
              </Controls>
              {/* Rendered inside ReactFlow on purpose: it needs the live
                  zoom and React Flow's own ViewportPortal, the only layer
                  that paints after the nodes. See EdgeHitTargets.tsx. */}
              <EdgeHitTargets
                edges={edges}
                nodes={nodes}
                selectedEdgeIds={selectedEdgeIds}
                onSelect={handleSelectEdge}
                onContextMenu={onEdgeHitContextMenu}
                edgeLabel={describeEdge}
              />
              {design.nodes.length === 0 && (
                <Panel position="top-center">
                  <p
                    data-testid="empty-canvas-hint"
                    className="mt-16 max-w-sm rounded-lg border border-border-card bg-bg-surface/95 px-4 py-3 text-center text-sm text-txt-secondary shadow-elevation-1"
                  >
                    {/* It has to name a route that is actually on screen. With
                        the tools folded, the old copy sent the player to a rail
                        they had just put away, which is the one state where an
                        empty canvas and this sentence can both be true. */}
                    {toolsCollapsed && panes.canvas
                      ? 'Tu lienzo está vacío. Abrí la biblioteca con la pleca de la derecha, o hacé clic derecho acá, para elegir un componente.'
                      : 'Tu lienzo está vacío. Elegí un componente de la biblioteca para empezar a construir tu diseño.'}
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
            {contextMenu?.kind === 'edge' && (
              <ContextMenu
                items={edgeMenuItems}
                anchor={{ x: contextMenu.x, y: contextMenu.y }}
                containerRef={containerRef}
                onClose={closeContextMenu}
                label={`Menú de la conexión ${edgeDescription(design, contextMenu.edgeId)}`}
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
        }
        {panes.list && (
          <DesignList
            design={design}
            findings={listFindings}
            ledger={listLedger}
            onDeleteNode={deleteNodeWithAnnouncement}
            onDeleteEdge={deleteEdgeWithAnnouncement}
            onSetEdgeDataClass={setEdgeDataClass}
            onSetNodeProperty={handleSetNodeProperty}
          />
        )}
        {/* THE TOOLS RAIL, on the right, which is where the owner put it.
            It shares that rail with the verdict, and the two are exclusive in
            time: while you build it holds the tools, while you evaluate it
            holds the verdict (responsive-layout.ts). Closing the verdict hands
            the rail straight back to the tools, in whatever fold state the
            player left them, because `toolsCollapsed` lives in the island and
            not in this subtree.

            The correction loop survives that swap without the rail: the
            canvas's own context menu offers all 21 components at every width,
            which canvas-survives-the-verdict.spec.ts drives with a real
            right-click.

            The width comes from railWidth() rather than from a class, so the
            number the pane arithmetic reads and the number the browser renders
            are the same number and cannot drift. Where the tools are a pane of
            their own instead of a rail (a phone, reached from the tab bar)
            there is no canvas beside them to protect, so they take the row and
            there is nothing for a pleca to give room to. */}
        {panes.library && (
          <div
            data-testid="forja-tools-rail"
            className={
              panes.canvas
                ? 'flex h-full shrink-0'
                : 'flex h-full min-w-0 flex-1'
            }
            style={
              panes.canvas
                ? {
                    width: railWidth({
                      library: true,
                      result: false,
                      toolsCollapsed,
                    }),
                  }
                : undefined
            }
          >
            {panes.canvas && (
              <RailPleca
                side="right"
                collapsed={toolsCollapsed}
                onToggle={toggleTools}
                controls={TOOLS_RAIL_REGION_ID}
                labelWhenOpen="Ocultar las herramientas"
                labelWhenCollapsed="Ver las herramientas"
                testId="tools-pleca"
              />
            )}
            {/* Hidden rather than unmounted while folded: it is the region the
                pleca names with `aria-controls`, and a disclosure whose target
                does not exist is a disclosure that controls nothing. */}
            <div
              id={TOOLS_RAIL_REGION_ID}
              className={
                toolsCollapsed && panes.canvas
                  ? 'hidden'
                  : 'flex min-w-0 flex-1 flex-col overflow-hidden'
              }
            >
              <NodePropertyEditor
                node={selectedNode}
                onChange={handleSetNodeProperty}
                className="max-h-[45%] shrink-0 overflow-y-auto"
              />
              <ComponentLibrary onCreate={handleCreate} />
            </div>
          </div>
        )}
        {panes.result && (
          <ResultPanel
            result={result}
            references={references}
            nextStep={nextStep}
            gameCompleteEligible={completionEligibility.eligible}
            masteryComplete={Boolean(
              currentMastery?.mastered && !currentMastery.reviewDue,
            )}
            miniAdr={miniAdr}
            onSaveMiniAdr={handleSaveMiniAdr}
            hoveredFindingId={hoveredFindingId}
            onHoverFinding={handleHoverFinding}
            onSelectFinding={handleSelectFinding}
            onClose={handleCloseResultPanel}
            fullWidth={!panes.canvas}
          />
        )}
      </div>

      {/* The running commentary, under the canvas rather than over it.
          Above it, it was the last row of chrome between the top of the
          workspace and the diagram, and the objective card would have had to
          know its height to anchor below it. Under it, the canvas starts at
          the top of the row it was given and the card anchors to the pane
          itself.

          Always rendered, never conditionally mounted: a `role="status"` that
          appears with its own text is a region a screen reader may not
          announce, and this is the only channel three gestures have. */}
      <div
        role="status"
        aria-live="polite"
        data-testid="canvas-status"
        className="min-h-[1.75rem] shrink-0 border-t border-border-subtle bg-bg-surface px-3 py-1 text-sm text-txt-secondary"
      >
        {status}
      </div>
    </div>
  )
}

export interface ForjaCanvasProps {
  // R1-G: passed by `/forja/[level]/[exercise].astro` only. Absent here,
  // the canvas is `/forja`'s free play, unchanged since R1-F.
  exercise?: LoadedExercise
  referenceSolutions?: ReferenceSolutionView[]
  nextStep?: NextStep
  requiredMasteryExerciseIds?: string[]
  transferProfiles?: ExerciseLearningConcepts[]
  requirePlayableWidth?: boolean
  shell?: boolean
}

// Whether this window is wide enough to be handed a canvas at all.
//
// La Forja is readable and not playable under PLAYABLE_MIN_PX (PRODUCT.md), so
// the shell hides the workspace there. Hiding it is not enough: React Flow
// still mounts into a 0x0 box and its own `<Background />` computes the dot
// pattern from that, which at 390px filled the console with 70 errors of the
// shape `<circle> attribute cx: Expected length, "NaN"`. Not mounting it stops
// that and stops a phone paying for a graph editor it is never shown.
//
// A media query rather than a resize listener: it fires once per crossing
// instead of once per pixel, and it is the same threshold the stylesheet uses.
function useMediaQuery(enabled: boolean, queryText: string): boolean {
  const [matches, setMatches] = useState(
    () =>
      !enabled ||
      typeof window === 'undefined' ||
      window.matchMedia(queryText).matches,
  )
  useEffect(() => {
    if (!enabled) return
    const query = window.matchMedia(queryText)
    const read = () => setMatches(query.matches)
    read()
    query.addEventListener('change', read)
    return () => query.removeEventListener('change', read)
  }, [enabled, queryText])
  return matches
}

function usePlayableWindow(enabled: boolean): boolean {
  return useMediaQuery(enabled, PLAYABLE_MEDIA_QUERY)
}

export function ForjaCanvas({
  exercise,
  referenceSolutions,
  nextStep,
  requiredMasteryExerciseIds,
  transferProfiles,
  requirePlayableWidth = false,
  shell,
}: ForjaCanvasProps) {
  const playable = usePlayableWindow(Boolean(shell) || requirePlayableWidth)
  if (!playable) return null
  return (
    <ReactFlowProvider>
      <ForjaCanvasInner
        exercise={exercise}
        referenceSolutions={referenceSolutions}
        nextStep={nextStep}
        requiredMasteryExerciseIds={requiredMasteryExerciseIds}
        transferProfiles={transferProfiles}
        shell={shell}
      />
    </ReactFlowProvider>
  )
}
