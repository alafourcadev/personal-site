// List view equivalent (PC10, §13.9) — same nodes, connections and warnings
// as the canvas, navigable and actionable without a pointer (plain buttons,
// no drag). Design D5 places this outside the island only once a real
// [level]/[exercise] route exists (R1-F); D1 has no such route yet, so it
// lives inside the same React island as a toggled view, sharing the store.
// Deviation from D5's literal "DesignList.astro" naming — noted in apply
// progress. `finding.why` stands in for the spec's "consequence text": the
// shipped Finding type (R1-B) has no separate `consequence` field.
import type { Design, Finding } from '../../../lib/forja/engine/types'
import { CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'

export interface DesignListProps {
  design: Design
  findings: Finding[]
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string) => void
}

export function DesignList({ design, findings, onDeleteNode, onDeleteEdge }: DesignListProps) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4" data-testid="design-list">
      <section aria-labelledby="design-list-nodes">
        <h3 id="design-list-nodes" className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted">
          Componentes ({design.nodes.length})
        </h3>
        {design.nodes.length === 0 ? (
          <p className="text-sm text-txt-muted">Todavía no agregaste ningún componente.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {design.nodes.map((node) => (
              <li
                key={node.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-2 py-1.5 text-sm text-txt-primary"
              >
                <span>
                  {node.label} · {CATALOG_UI[node.type].label} · zona {node.zone}
                </span>
                <button type="button" onClick={() => onDeleteNode(node.id)} className="text-xs text-accent-red hover:underline">
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="design-list-edges">
        <h3 id="design-list-edges" className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted">
          Conexiones ({design.edges.length})
        </h3>
        {design.edges.length === 0 ? (
          <p className="text-sm text-txt-muted">Todavía no conectaste ningún componente.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {design.edges.map((edge) => {
              const from = design.nodes.find((n) => n.id === edge.from.node)
              const to = design.nodes.find((n) => n.id === edge.to.node)
              return (
                <li
                  key={edge.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border-subtle px-2 py-1.5 text-sm text-txt-primary"
                >
                  <span>
                    {from?.label ?? '?'} → {to?.label ?? '?'}
                  </span>
                  <button type="button" onClick={() => onDeleteEdge(edge.id)} className="text-xs text-accent-red hover:underline">
                    Eliminar
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="design-list-findings">
        <h3 id="design-list-findings" className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted">
          Hallazgos ({findings.length})
        </h3>
        {findings.length === 0 ? (
          <p className="text-sm text-txt-muted">El motor no reportó ningún hallazgo todavía.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {findings.map((finding) => (
              <li key={finding.id} data-rule={finding.rule} className="rounded-md border border-border-subtle px-2 py-1.5 text-sm">
                <p className="font-semibold text-txt-primary">
                  [{finding.severity}] {finding.title}
                </p>
                <p className="text-txt-secondary">{finding.why}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
