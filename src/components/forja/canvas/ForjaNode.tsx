// Custom React Flow node: icon + name + subtitle (type · zone), per the
// visual language reviewed in forja-app.html (icon per type, color per
// type, name with subtitle) — adapted to the engine's 21-type catalog and
// the brand tokens in src/layouts/BaseLayout.astro, not copied verbatim.
// The wrapper div's `aria-label`/`role="group"` come from React Flow itself
// (Node.ariaLabel, set in project.ts) — this component only renders the
// visible content inside it.
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CATALOG_COLOR_CLASS, CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import type { ForjaFlowNode } from '../../../lib/forja/canvas/project'
import { Icon } from './Icon'

export function ForjaNode({ data, selected }: NodeProps<ForjaFlowNode>) {
  const ui = CATALOG_UI[data.componentType]

  return (
    <div
      className={`min-w-[168px] rounded-lg border bg-bg-surface px-3 py-2.5 shadow-sm ${CATALOG_COLOR_CLASS[ui.color]} ${
        selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-deep' : ''
      } ${data.hasError ? 'border-accent-red' : ''}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-none !bg-txt-muted" />
      <div className="flex items-center gap-2">
        <Icon icon={ui.icon} className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm font-semibold text-txt-primary">{data.label}</span>
      </div>
      <p className="mt-1 truncate text-xs text-txt-muted">
        {ui.label} · zona {data.zone}
      </p>
      {data.hasError && <p className="mt-1 text-xs font-semibold text-accent-red">Con advertencia</p>}
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-none !bg-txt-muted" />
    </div>
  )
}
