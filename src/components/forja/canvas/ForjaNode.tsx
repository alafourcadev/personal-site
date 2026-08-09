// Custom React Flow node: icon + name + subtitle (type · zone), per the
// visual language reviewed in forja-app.html (icon per type, color per
// type, name with subtitle), adapted to the engine's 21-type catalog and
// the brand tokens in src/layouts/BaseLayout.astro, not copied verbatim.
// The wrapper div's `aria-label`/`role="group"` come from React Flow itself
// (Node.ariaLabel, set in project.ts). This component only renders the
// visible content inside it.
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CATALOG_COLOR_CLASS, CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import { describeComponent } from '../../../lib/forja/canvas/catalog-descriptions'
import { nodeIdentityLine } from '../../../lib/forja/canvas/node-identity'
import { PLAYER_COLORS } from '../../../lib/forja/canvas/player-colors'
import type { ForjaFlowNode } from '../../../lib/forja/canvas/project'
import { Icon } from './Icon'

export function ForjaNode({ id, data, selected }: NodeProps<ForjaFlowNode>) {
  const ui = CATALOG_UI[data.componentType]
  // PC16: the player colour is a small dot NEXT TO the icon/label, never a
  // replacement for either: §13.9 forbids conveying meaning by colour
  // alone, so the node stays identifiable by icon + text with the dot
  // removed entirely; the colour's name is also in the accessible name
  // (composed in project.ts), not just this visual swatch.
  const playerColor = data.color ? PLAYER_COLORS[data.color] : null

  return (
    <div
      className={`relative min-w-[168px] rounded-lg border bg-white dark:bg-bg-surface px-3 py-2.5 shadow-elevation-1 transition-opacity ${CATALOG_COLOR_CLASS[ui.color]} ${
        selected ? 'ring-2 ring-forja-mark ring-offset-2 ring-offset-bg-deep' : ''
      } ${data.hasError ? 'border-accent-red' : ''} ${data.dimmed ? 'opacity-30' : 'opacity-100'}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-none !bg-txt-muted" />
      <div className="flex items-center gap-2">
        <Icon icon={ui.icon} className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-semibold text-txt-primary">{data.label}</span>
        {playerColor && (
          <span
            className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full ${playerColor.swatchClass}`}
            aria-hidden="true"
            data-testid="node-color-dot"
          />
        )}
      </div>
      {/* The subtitle used to print the raw `Zone` key ("Cliente móvil · zona
          public"): the most visible leak left, on screen at all times rather
          than only when something fails. Both halves now come from
          node-identity.ts, which is the same vocabulary the engine's findings
          and the accessible name use.

          The label goes in too: a node that kept its default name printed that
          name twice, once in the title above and again as the first half of
          this line. node-identity.ts drops the half the title already said. */}
      <p className="mt-1 truncate text-xs text-txt-muted">
        {nodeIdentityLine(data.componentType, data.zone, data.label)}
      </p>
      {data.hasError && <p className="mt-1 text-xs font-semibold text-danger-ink">Con advertencia</p>}
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-none !bg-txt-muted" />
      {/* "Every component explains itself on hover and on focus". The
          reveal is plain CSS (node-tooltip.css) keyed off the stable
          `.react-flow__node-forja` class React Flow always adds; this id
          is what project.ts's `domAttributes['aria-describedby']` points
          at on the actual focusable wrapper element. */}
      <span
        id={`node-desc-${id}`}
        role="tooltip"
        data-testid={`node-description-${id}`}
        className="forja-node-tooltip pointer-events-none absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border-card bg-bg-raised px-2 py-1.5 text-xs text-txt-secondary shadow-elevation-1"
      >
        {describeComponent(data.componentType)}
      </span>
    </div>
  )
}
