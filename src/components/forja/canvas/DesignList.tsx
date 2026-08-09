// List view equivalent (PC10, §13.9): same nodes, connections and warnings
// as the canvas, navigable and actionable without a pointer (plain buttons,
// no drag). Design D5 places this outside the island only once a real
// [level]/[exercise] route exists (R1-F); D1 has no such route yet, so it
// lives inside the same React island as a toggled view, sharing the store.
// Deviation from D5's literal "DesignList.astro" naming, noted in apply
// progress. `finding.why` stands in for the spec's "consequence text": the
// shipped Finding type (R1-B) has no separate `consequence` field.
// "Plain language everywhere except canonical technical terms": severity
// renders as a Spanish word, so the engine's own literal value ('blocking')
// stays out of player-facing text.
// PC10's "equivalent" is the whole point and it was not equivalent: on the
// canvas a finding reads "Farmacéutico → Terminal de mostrador", and here the
// same six findings rendered as six identical cards, because `evidence`, the
// only field that says WHICH connection each one is about, was never printed.
// The product's editorial rule ("ninguna afirmación sin su porqué") asks each
// warning for three things: the rule, the evidence from the diagram, and the
// consequence. This view was printing two of the three.
import type { DataClass, Design, Finding, Severity } from '../../../lib/forja/engine/types'
import type { PlayerNodePropertyKey } from '../../../lib/forja/engine/catalog'
import { findingCostLabel, orderedFindings } from '../../../lib/forja/playground/result'
import { nodeListLine } from '../../../lib/forja/canvas/node-identity'
import { DATA_CLASSES, DATA_CLASS_ORDER, UNDECLARED_DATA_CLASS_NAME } from '../../../lib/forja/canvas/data-classes'
import { playerNodePropertyDefinitions } from '../../../lib/forja/playground/node-properties'
import { NodePropertyEditor } from './NodePropertyEditor'

// The `<select>`'s own value for "no declaration". A `<select>` cannot carry
// `undefined` as an option value, so the empty string is the sentinel and this
// is the single place that knows it.
const UNDECLARED_VALUE = ''

const SEVERITY_LABEL: Record<Severity, string> = {
  blocking: 'Bloqueante',
  warning: 'Advertencia',
  note: 'Nota',
}

export interface DesignListProps {
  design: Design
  // The same findings the result panel is showing. See list-view-source.ts,
  // which is what picks them and what decides whether `ledger` is allowed to
  // be true. This view used to read the live legality pass instead, so the
  // pointer-free path through the playground showed a different, weaker list
  // than the one next to it.
  findings: readonly Finding[]
  // Whether points were actually allocated, and therefore whether a cost may
  // be quoted at all. Never hardcoded here: an unscored design has no cost to
  // print, and printing one would be inventing it.
  ledger: boolean
  onDeleteNode: (id: string) => void
  onDeleteEdge: (id: string) => void
  // PC10's "equivalent" applied to the newest gesture: declaring what travels
  // through a connection exists on the canvas as a context menu, and here as a
  // real form control. This view is the pointer-free path through the
  // playground, and a `<select>` is the one control that is keyboard- and
  // screen-reader-native without any wiring of ours.
  onSetEdgeDataClass: (id: string, dataClass?: DataClass) => void
  onSetNodeProperty: (id: string, key: PlayerNodePropertyKey, value: string) => void
}

export function DesignList({
  design,
  findings,
  ledger,
  onDeleteNode,
  onDeleteEdge,
  onSetEdgeDataClass,
  onSetNodeProperty,
}: DesignListProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4" data-testid="design-list">
      <section aria-labelledby="design-list-nodes">
        <h3 id="design-list-nodes" className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted">
          Componentes ({design.nodes.length})
        </h3>
        {design.nodes.length === 0 ? (
          <p className="text-sm text-txt-muted">Todavía no agregaste ningún componente.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {design.nodes.map((node) => (
              <li key={node.id} className="rounded-md border border-border-card px-2 py-1.5 text-sm text-txt-primary">
                {/* Same words as the box on the canvas, from the same
                    function, including the trust zone, which this view was
                    printing as its raw key. PC10's "equivalent" has to cover
                    the vocabulary too: the pointer-free path cannot be the
                    one that still shows engine internals.

                    The whole line comes from node-identity.ts now, label
                    included. Assembled here by hand, a node that kept its
                    default name printed it three times over: "Base de datos ·
                    Base de datos · núcleo restringido". */}
                <div className="flex items-center justify-between gap-2">
                  <span>{nodeListLine(node.label, node.type, node.zone)}</span>
                  <button
                    type="button"
                    aria-label={`Eliminar el componente ${node.label}`}
                    onClick={() => onDeleteNode(node.id)}
                    className="text-xs text-danger-ink hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
                {playerNodePropertyDefinitions(node.type).length > 0 && (
                  <details className="mt-2 border-t border-border-subtle pt-2">
                    <summary className="cursor-pointer text-xs font-medium text-accent">
                      Configurar decisiones evaluables
                    </summary>
                    <NodePropertyEditor
                      node={node}
                      onChange={onSetNodeProperty}
                      className="mt-2 border-t-0 px-0 pb-1"
                    />
                  </details>
                )}
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
              const route = `${from?.label ?? '?'} → ${to?.label ?? '?'}`
              return (
                <li
                  key={edge.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-card px-2 py-1.5 text-sm text-txt-primary"
                >
                  <span>{route}</span>
                  <div className="flex items-center gap-2">
                    {/* The gesture the whole playground was missing, in its
                        accessible form. `aria-label` rather than a visible
                        <label>: the row already names the connection, and a
                        second copy of "Cliente web → Base de pedidos" on every
                        row would be the noise this change exists to remove. */}
                    <select
                      aria-label={`Clase de dato de la conexión ${route}`}
                      data-testid={`edge-data-class-${edge.id}`}
                      value={edge.dataClass ?? UNDECLARED_VALUE}
                      onChange={(event) =>
                        onSetEdgeDataClass(
                          edge.id,
                          event.target.value === UNDECLARED_VALUE ? undefined : (event.target.value as DataClass),
                        )
                      }
                      className="rounded-md border border-border-card bg-bg-surface px-1.5 py-1 text-xs text-txt-secondary"
                    >
                      <option value={UNDECLARED_VALUE}>{UNDECLARED_DATA_CLASS_NAME}</option>
                      {DATA_CLASS_ORDER.map((dataClass) => (
                        <option key={dataClass} value={dataClass}>
                          {DATA_CLASSES[dataClass].label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Eliminar la conexión ${route}`}
                      onClick={() => onDeleteEdge(edge.id)}
                      className="text-xs text-danger-ink hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
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
            {orderedFindings(findings).map((finding) => {
              // Same ordering and same cost rule as the result panel, from
              // the same two functions, which is what "equivalent" has to
              // mean for a player who reads this view instead of the canvas.
              const cost = findingCostLabel(finding, ledger)
              return (
                <li
                  key={finding.id}
                  data-rule={finding.rule}
                  className="rounded-md border border-border-card px-2 py-1.5 text-sm"
                >
                  <p className="font-semibold text-txt-primary">
                    <span className="font-normal text-txt-muted">{SEVERITY_LABEL[finding.severity]} · </span>
                    {finding.title}
                  </p>
                  <p className="text-xs text-txt-secondary">{finding.evidence}</p>
                  <p className="text-txt-secondary">{finding.why}</p>
                  {cost && (
                    <p
                      data-testid={`list-finding-cost-${finding.id}`}
                      className={`text-xs ${finding.severity === 'blocking' ? 'text-danger-ink' : 'text-txt-muted'}`}
                    >
                      {cost}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
