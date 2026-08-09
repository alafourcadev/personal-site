// The tools rail's pleca, inside the island.
//
// Its twin is server-rendered Astro in ExerciseBrief.astro, because the
// statement's prose is markdown and has to be on the page before any bundle
// exists. Everything the two share lives outside both of them: the direction
// rule in rail-pleca.ts and the drawing in rail-pleca.css. What is left here is
// the wiring, which is the part that genuinely differs.
import { PLECA_CLASS, PLECA_DIRECTION_ATTRIBUTE, plecaDirection, plecaLabel, type RailSide } from '../../../lib/forja/canvas/rail-pleca'

export interface RailPlecaProps {
  side: RailSide
  collapsed: boolean
  onToggle: () => void
  // The id of the region this folds. A disclosure that does not name what it
  // controls tells a screen reader that something somewhere changed.
  controls: string
  labelWhenOpen: string
  labelWhenCollapsed: string
  testId?: string
}

export function RailPleca({
  side,
  collapsed,
  onToggle,
  controls,
  labelWhenOpen,
  labelWhenCollapsed,
  testId,
}: RailPlecaProps) {
  const label = plecaLabel(labelWhenOpen, labelWhenCollapsed, collapsed)
  return (
    <button
      type="button"
      onClick={onToggle}
      // A real <button>, so Tab reaches it and Enter and Space work without a
      // line of key handling. This playground can already be finished without a
      // mouse and a control that takes the tools away must not be the one
      // gesture that needs one.
      aria-expanded={!collapsed}
      aria-controls={controls}
      aria-label={label}
      title={label}
      className={PLECA_CLASS}
      data-pleca-side={side}
      data-testid={testId}
      {...{ [PLECA_DIRECTION_ATTRIBUTE]: plecaDirection(side, collapsed) }}
    >
      {/* Decoration: the accessible name above is the one that speaks. */}
      <span className="forja-pleca__chevron" aria-hidden="true" />
    </button>
  )
}
