// R1-E result panel. Fixes B3 (score buried below the fold): rendered as
// a side panel next to the canvas (never a full-page tab that unmounts
// the canvas), so the score sits at the panel's own top, always the first
// thing in view, no page scroll required. Findings point AT the canvas
// (per the R1-D2 wiring in ForjaCanvas.tsx): hover previews the highlight,
// click/Enter persists the selection so the player can switch back to the
// canvas tab and still see it circled.
//
// "Every panel that opens can be closed": a visible close control (below)
// plus Escape (wired in ForjaCanvas.tsx's global keydown handler) both
// call the same `onClose`, which only switches the tab away — it never
// clears `evaluation`, so reopening shows the same result.
//
// "Plain language everywhere except canonical technical terms": severity
// is rendered as a Spanish word, never the engine's own literal value; the
// internal rule id is a `data-rule` TEST attribute only, never visible
// text; a guarantee's numeric `weight` (an engine scoring internal, not
// player vocabulary) is not shown at all — satisfied/not is what a player
// needs to act on.
import type { Evaluation, ExerciseSpec, Finding, Severity } from '../../../lib/forja/engine/types'

export interface ResultPanelProps {
  evaluation: Evaluation | null
  exercise: ExerciseSpec
  hoveredFindingId: string | null
  onHoverFinding: (findingId: string | null) => void
  onSelectFinding: (finding: Finding) => void
  onClose: () => void
}

const SEVERITY_LABEL: Record<Severity, string> = {
  blocking: 'Bloqueante',
  warning: 'Advertencia',
  note: 'Nota',
}

function guaranteeLabel(exercise: ExerciseSpec, id: string): string {
  return exercise.guarantees.find((g) => g.id === id)?.label ?? id
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      data-testid="close-result-panel"
      aria-label="Cerrar el panel de resultado"
      className="rounded-md p-1.5 text-txt-muted hover:bg-bg-surface-hover hover:text-txt-primary"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  )
}

export function ResultPanel({ evaluation, exercise, hoveredFindingId, onHoverFinding, onSelectFinding, onClose }: ResultPanelProps) {
  if (!evaluation) {
    return (
      <div
        // Fixed width + shrink-0: spec "the playground uses the full
        // viewport width" wants surplus space going to the canvas, not
        // this sidebar.
        className="flex h-full w-[380px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border-subtle bg-bg-surface p-4"
        data-testid="result-panel"
      >
        <div className="flex items-start justify-between gap-2">
          <p data-testid="result-empty" className="text-sm text-txt-secondary">
            Todavía no probaste tu diseño. Usá <strong>Probar respuesta</strong> para ver tu puntaje y los hallazgos
            del motor.
          </p>
          <CloseButton onClose={onClose} />
        </div>
      </div>
    )
  }

  const isIllegal = evaluation.status === 'illegal'

  return (
    <div
      className="flex h-full w-[380px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-border-subtle bg-bg-surface p-4"
      data-testid="result-panel"
    >
      <div className="flex items-start justify-between gap-2">
        {/* Score sits first, unconditionally — this is what B3 requires
            visible without scrolling immediately after submit. */}
        <div data-testid="result-score" className="flex-1 rounded-lg border border-border-subtle p-3">
          {isIllegal ? (
            <p className="text-lg font-semibold text-accent-red">Diseño ilegal — sin puntaje</p>
          ) : (
            <p className="text-lg font-semibold text-txt-primary">
              {evaluation.score} <span className="text-sm font-normal text-txt-muted">/ {evaluation.ceiling}</span>
            </p>
          )}
        </div>
        <CloseButton onClose={onClose} />
      </div>

      {!isIllegal && (
        <section aria-labelledby="result-axes-heading">
          <h3 id="result-axes-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted">
            Ejes
          </h3>
          <ul className="flex flex-col gap-1" data-testid="result-axes">
            {evaluation.guarantees.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 text-sm text-txt-secondary">
                <span>{guaranteeLabel(exercise, g.id)}</span>
                <span className={g.satisfied ? 'text-accent' : 'text-accent-red'}>{g.satisfied ? '✓ Cumplido' : '✗ Falta'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="result-findings-heading">
        <h3 id="result-findings-heading" className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted">
          Hallazgos ({evaluation.findings.length})
        </h3>
        {evaluation.findings.length === 0 ? (
          <p className="text-sm text-txt-muted">El motor no reportó ningún hallazgo.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="result-findings">
            {evaluation.findings.map((finding) => (
              <li key={finding.id}>
                <button
                  type="button"
                  data-testid={`finding-${finding.id}`}
                  // The internal rule id is a TEST hook only — never
                  // rendered as visible player-facing text (see the file
                  // header comment).
                  data-rule={finding.rule}
                  onMouseEnter={() => onHoverFinding(finding.id)}
                  onMouseLeave={() => onHoverFinding(null)}
                  onFocus={() => onHoverFinding(finding.id)}
                  onBlur={() => onHoverFinding(null)}
                  onClick={() => onSelectFinding(finding)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-sm ${
                    hoveredFindingId === finding.id
                      ? 'border-accent bg-accent-dim'
                      : 'border-border-subtle hover:bg-bg-surface-hover'
                  }`}
                >
                  <p className="font-semibold text-txt-primary">
                    <span className="font-normal text-txt-muted">{SEVERITY_LABEL[finding.severity]} · </span>
                    {finding.title}
                  </p>
                  <p className="mt-0.5 text-xs text-txt-secondary">{finding.evidence}</p>
                  <p className="mt-0.5 text-xs text-txt-secondary">{finding.why}</p>
                  <p className="mt-0.5 text-xs text-txt-muted">
                    {finding.costPoints ? `Cuesta ${finding.costPoints} punto${finding.costPoints === 1 ? '' : 's'}` : 'Sin costo'}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
