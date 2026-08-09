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
// call the same `onClose`. It only switches the tab away and never clears
// `result`, so reopening shows the same result.
//
// "Free play without a loaded exercise produces no score": no per-axis
// ("ejes") section exists for free play at all. That requires a real
// ExerciseSpec's guarantees, which free play never has (see free-play.ts).
// R1-G: a loaded exercise (`result.kind === 'scored'`) DOES carry a real
// score, ceiling and per-axis breakdown (`toScoredResult`: the axes'
// labels are resolved from the exercise's own guarantees, never invented
// here). Either way, findings, which are always real, render underneath.
//
// "Plain language everywhere except canonical technical terms": severity
// is rendered as a Spanish word, never the engine's own literal value; the
// internal rule id is a `data-rule` TEST attribute only, never visible text.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  axisCostPoints,
  findingCostLabel,
  findingsLedgerNote,
  hasPointLedger,
  orderedFindings,
  referencesGoFirst,
} from '../../../lib/forja/playground/result'
import type { CanvasResult } from '../../../lib/forja/playground/result'
import type { Finding, Severity } from '../../../lib/forja/engine/types'
import type { MiniAdr } from '../../../lib/forja/progression/mastery'
import type { ReferenceSolutionView } from './reference-solutions'
import type { NextStep } from './next-step'
import { MiniAdrForm } from './MiniAdrForm'

export interface RevealedReferences {
  solutions: ReferenceSolutionView[]
  // Which one the submitted design leans toward, or null when it sits equally
  // close to both. See closestReferenceIndex()'s own note on why null is the
  // honest answer there and not a fallback.
  closestIndex: number | null
}

export interface ResultPanelProps {
  result: CanvasResult | null
  // Present only once the exercise's reasoning has been earned (the gate
  // lives in reference-solutions.ts). Absent means the panel says nothing
  // about it at all. No teaser, no lock icon.
  references?: RevealedReferences | null
  // Where to go after this exercise; absent in free play, which has no level
  // order behind it.
  nextStep?: NextStep
  // Route position alone never earns the ending. The caller computes this
  // from the persisted mastery record for the whole curriculum.
  gameCompleteEligible?: boolean
  masteryComplete?: boolean
  miniAdr?: MiniAdr | null
  onSaveMiniAdr?: (value: MiniAdr) => void
  hoveredFindingId: string | null
  onHoverFinding: (findingId: string | null) => void
  onSelectFinding: (finding: Finding) => void
  onClose: () => void
  // Where the canvas cannot be shown beside it, the panel is not a rail: it
  // takes the whole row (see responsive-layout.ts). At 390px the 380px rail
  // left the canvas 0px wide and clipped its own prose mid-word.
  fullWidth?: boolean
}

export function shouldOfferNextStep(
  result: CanvasResult | null,
  nextStep: NextStep | undefined,
  gameCompleteEligible = false,
): boolean {
  if (!nextStep || !result || result.kind !== 'scored') return false
  if (result.status !== 'scored' || result.score !== result.ceiling)
    return false
  return nextStep.kind !== 'game-complete' || gameCompleteEligible
}

// One place for the shell, so the sidebar and the full-width pane cannot
// drift apart: same padding, same scroll box, same border side.
function panelClassName(fullWidth: boolean): string {
  const box =
    'flex h-full flex-col gap-4 overflow-y-auto border-border-subtle bg-bg-surface p-4'
  return fullWidth
    ? `${box} min-w-0 flex-1`
    : `${box} w-[380px] shrink-0 border-l`
}

// This whole file had zero `aria-live`, `role="status"`, `role="alert"`,
// `role="region"` and `aria-label` across 455 lines: the verdict of the one
// gesture the product is built around reached assistive technology as an
// unnamed div appearing somewhere on the page. WCAG 4.1.3, level AA.
//
// The panel is a named landmark so it can be found, and it takes focus when
// a verdict arrives. The button that was pressed stays where it is while
// the canvas beside it goes to `display: none`, which used to leave focus
// pointing at a control whose surroundings had been replaced.
//
// Focus lands on the panel itself rather than a heading inside it: a heading
// would have to be either visible (pushing the score down, and the score
// being visible without scrolling is a requirement this panel already pays
// for) or screen-reader-only (a focus ring nobody sighted can see).
const PANEL_LABEL = 'Resultado de tu diseño'

const SEVERITY_LABEL: Record<Severity, string> = {
  blocking: 'Bloqueante',
  warning: 'Advertencia',
  note: 'Nota',
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
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </svg>
    </button>
  )
}

// The part of the product that was written and switched off: every exercise
// declares two reference solutions, each with the paragraph that says in
// which context THAT one is the better decision and the other is not. Until
// now nobody had read one. A player could solve the same exercise two ways,
// score 100 both times, and never learn whether the reasoning the brief asked
// for was right. When it is shown (and when it is not) is decided upstream in
// reference-solutions.ts; this only renders it.
function ReferenceSolutions({ solutions, closestIndex }: RevealedReferences) {
  return (
    <section
      aria-labelledby="result-references-heading"
      data-testid="result-references"
    >
      <h3
        id="result-references-heading"
        className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted"
      >
        Por qué ésta y no la otra
      </h3>
      <p className="mb-2 text-xs text-txt-secondary">
        Las dos llegan a 100. Lo que las separa no es la nota: es el contexto en
        el que cada una es la decisión correcta.
      </p>
      <ul className="flex flex-col gap-2">
        {solutions.map((solution, index) => (
          <li
            key={solution.label}
            data-testid={`reference-solution-${index}`}
            data-closest={index === closestIndex ? 'true' : undefined}
            className={`rounded-md border px-2 py-1.5 ${
              index === closestIndex
                ? 'border-accent-ink bg-accent-dim'
                : 'border-border-card'
            }`}
          >
            <p className="text-sm font-semibold text-txt-primary">
              {solution.label}
            </p>
            {index === closestIndex && (
              <p
                data-testid={`reference-closest-${index}`}
                className="mt-0.5 text-xs font-medium text-accent-ink"
              >
                Tu diseño se parece más a ésta.
              </p>
            )}
            <p className="mt-1 text-xs leading-relaxed text-txt-secondary">
              {solution.contextInversion}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

// "Hay scroll, pero ninguna señal visible de que lo haya."
//
// The panel is 380px wide inside a 669px-tall viewport and its content ran to
// 718px on level 2: "POR QUÉ ÉSTA Y NO LA OTRA" started near the bottom edge
// and its first sentence was cut in half, with nothing on screen saying there
// was more. Four of level 4's eight exercises are reachable at 100 on the
// first try, and in those a player leaves for the next exercise having never
// read the one thing the exercise had left to teach.
//
// So the panel watches its own scroll box and, while there is content below
// the fold, shows a control that NAMES what is down there and takes the player
// to it. It disappears at the bottom, because an affordance that stays after
// it has been obeyed is decoration.
function useScrollAffordance(dependency: unknown) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    // A 4px slack absorbs sub-pixel rounding of fractional layout heights,
    // which otherwise leaves the control on screen at the very bottom.
    const update = () =>
      setHasMoreBelow(
        element.scrollTop + element.clientHeight < element.scrollHeight - 4,
      )
    update()
    element.addEventListener('scroll', update, { passive: true })
    // The box's own height changes with the viewport; its content's height
    // changes when a section appears (the references are revealed mid-session).
    // Both have to re-run the measurement, so both are observed.
    const observer = new ResizeObserver(update)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    return () => {
      element.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [dependency])

  const scrollToEnd = useCallback(() => {
    const element = scrollRef.current
    if (!element) return
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    element.scrollTo({
      top: element.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }, [])

  return { scrollRef, hasMoreBelow, scrollToEnd }
}

function ScrollAffordance({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="result-scroll-more"
      className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-center gap-1.5 border-t border-border-subtle bg-bg-surface/95 px-4 py-2 text-xs font-medium text-txt-primary backdrop-blur hover:bg-bg-surface-hover"
    >
      {label}
      <span aria-hidden="true">&darr;</span>
    </button>
  )
}

// "Terminar un ejercicio no ofrece el siguiente": the only link inside <main>
// used to be "← Nivel N", so continuing cost two clicks and a guess about
// which of the level's 14 exercises came next. The destination comes from the
// level's own play order (next-step.ts), resolved at build time.
// The end of the game, which is a different event from the end of a level.
//
// A player who reached this line crossed twelve levels; before this they were
// handed the same "era el último ejercicio de este nivel" as somebody who
// finished level 4. It is written once and read once, so it says the only
// thing worth saying at that moment: what the person can now do, and why the
// score was never the point. No celebration, no badge, no confetti: the
// audience is senior engineers and the product's own rule is that it never
// becomes a children's game.
//
// It closes the loop the last exercise opens: that brief ends with "Terminás
// el juego cuando podés decir, de cada pieza de tu diseño, qué problema
// resuelve, a quién le sacaste algo y qué aceptaste perder a cambio."
function GameComplete() {
  return (
    <section
      data-testid="game-complete"
      aria-labelledby="game-complete-heading"
      className="flex flex-col gap-2"
    >
      <h3
        id="game-complete-heading"
        className="text-base font-semibold text-txt-primary"
      >
        Terminaste La Forja.
      </h3>
      <p className="text-sm leading-relaxed text-txt-secondary">
        Ningún ejercicio tuvo una sola respuesta correcta. Cada uno admitía al
        menos dos diseños distintos que llegaban a 100, y lo que los separaba
        nunca fue la nota: era el contexto en el que cada decisión era la buena.
      </p>
      <p className="text-sm leading-relaxed text-txt-secondary">
        Lo que te queda es el criterio, no el puntaje. De cada pieza de un
        diseño, sea tuyo o te toque revisarlo, vas a poder decir qué problema
        resuelve, a quién le sacaste algo y qué aceptaste perder a cambio. Acá
        te lo decía el motor en el momento. Un sistema real te lo cobra después,
        y se lo cobra a otro.
      </p>
      <a
        href="/forja/niveles"
        data-testid="game-complete-levels-link"
        className="mt-1 block rounded-md border border-border-card px-3 py-2 text-sm text-txt-primary shadow-elevation-1 hover:border-accent hover:bg-bg-surface-hover"
      >
        Volver a los niveles &rarr;
      </a>
    </section>
  )
}

function NextStepLink({ nextStep }: { nextStep: NextStep }) {
  if (nextStep.kind === 'game-complete') return <GameComplete />
  if (nextStep.kind === 'last-of-level') {
    return (
      <p data-testid="next-step-last" className="text-sm text-txt-secondary">
        Era el último ejercicio de este nivel.
      </p>
    )
  }
  return (
    <a
      href={nextStep.href}
      data-testid="next-exercise-link"
      className="block rounded-md border border-border-card px-3 py-2 text-sm text-txt-primary shadow-elevation-1 hover:border-accent hover:bg-bg-surface-hover"
    >
      <span className="font-medium">Siguiente ejercicio &rarr;</span>
      <span className="mt-0.5 block text-xs text-txt-secondary">
        {nextStep.title}
      </span>
    </a>
  )
}

export function ResultPanel({
  result,
  references,
  nextStep,
  gameCompleteEligible = false,
  masteryComplete = false,
  miniAdr,
  onSaveMiniAdr,
  hoveredFindingId,
  onHoverFinding,
  onSelectFinding,
  onClose,
  fullWidth = false,
}: ResultPanelProps) {
  const { scrollRef, hasMoreBelow, scrollToEnd } = useScrollAffordance(result)

  // A verdict arrives and focus is still on the button that asked for it,
  // next to a canvas that has just been hidden. `result` is a fresh object
  // per submit, so this fires on every evaluation and not on re-renders in
  // between. `scrollRef` is the panel's own box, the same element that
  // carries the region role below.
  useEffect(() => {
    if (result) scrollRef.current?.focus()
  }, [result, scrollRef])

  if (!result) {
    return (
      <div
        // As a sidebar: fixed width + shrink-0, so the spec's "the playground
        // uses the full viewport width" sends surplus space to the canvas
        // rather than stretching this. As a full-width pane (below three
        // columns) there is no canvas beside it to protect.
        className={panelClassName(fullWidth)}
        data-testid="result-panel"
        role="region"
        aria-label={PANEL_LABEL}
      >
        <div className="flex items-start justify-between gap-2">
          <p data-testid="result-empty" className="text-sm text-txt-secondary">
            Todavía no probaste tu diseño. Usá <strong>Probar respuesta</strong>{' '}
            para ver tus hallazgos.
          </p>
          <CloseButton onClose={onClose} />
        </div>
      </div>
    )
  }

  const ledger = hasPointLedger(result)
  const ledgerNote = findingsLedgerNote(result)
  const findings = orderedFindings(result.findings)
  // The reference solutions render in the same place except at the ceiling.
  // See referencesGoFirst() for why that one case inverts.
  const referencesSection = references ? (
    <ReferenceSolutions
      solutions={references.solutions}
      closestIndex={references.closestIndex}
    />
  ) : null
  const referencesFirst =
    referencesSection !== null && referencesGoFirst(result)

  return (
    <div
      ref={scrollRef}
      className={panelClassName(fullWidth)}
      data-testid="result-panel"
      role="region"
      aria-label={PANEL_LABEL}
      // Programmatic focus only: the panel is not a tab stop of its own, it
      // is where focus is PUT when a verdict replaces the canvas.
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Score/status sits first, unconditionally. This is what B3
            requires visible without scrolling immediately after submit.
            `role="status"` makes it a live region for every submit AFTER the
            first: once the panel is open, a second evaluation changes text
            inside a region that already existed, which is the case screen
            readers announce reliably. The first one is announced by the
            playground's own always-mounted status bar (submitMessage). */}
        <div
          data-testid="result-score"
          role="status"
          aria-live="polite"
          className="flex-1 rounded-lg border border-border-card p-3 shadow-elevation-1"
        >
          {result.kind === 'free-play' ? (
            result.legal ? (
              <p
                data-testid="result-no-exercise"
                className="text-sm text-txt-secondary"
              >
                Todavía no hay un ejercicio cargado, así que no hay nada contra
                qué puntuar. Los hallazgos de abajo siguen siendo reales.
              </p>
            ) : (
              <p className="text-lg font-semibold text-danger-ink">
                Diseño ilegal: sin puntaje
              </p>
            )
          ) : result.status === 'illegal' ? (
            <p className="text-lg font-semibold text-danger-ink">
              Diseño ilegal: sin puntaje
            </p>
          ) : (
            <p
              data-testid="result-score-value"
              className="text-2xl font-semibold text-txt-primary"
            >
              {result.score}{' '}
              <span className="text-sm font-normal text-txt-muted">
                / {result.ceiling}
              </span>
            </p>
          )}
        </div>
        <CloseButton onClose={onClose} />
      </div>

      {/* R1-G requirement 4: "los ejes que muestre el panel salen de las
          garantías declaradas por ese ejercicio". Only for a real scored
          result: free play and an illegal design have nothing to show
          here (result-axes stays absent, matching the existing free-play
          Playwright assertion). */}
      {result.kind === 'scored' && result.status === 'scored' && (
        <section aria-labelledby="result-axes-heading">
          <h3
            id="result-axes-heading"
            className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted"
          >
            Ejes evaluados
          </h3>
          <ul className="flex flex-col gap-1" data-testid="result-axes">
            {result.axes.map((axis) => {
              // What a failed objective cost, right where the player reads
              // that it failed. Without it the panel showed an objective in ✗
              // and, further down, a separate card carrying its points. That
              // is how a player came to read 83/100 next to a warning labelled
              // "Sin costo".
              const cost = axis.satisfied
                ? null
                : axisCostPoints(axis.id, result.findings)
              return (
                <li
                  key={axis.id}
                  data-testid={`axis-${axis.id}`}
                  className={`rounded-md border px-2 py-1.5 text-sm ${
                    axis.satisfied
                      ? 'border-border-card'
                      : 'border-danger-ink bg-accent-red/5'
                  }`}
                >
                  <span aria-hidden="true">{axis.satisfied ? '✓' : '✗'}</span>{' '}
                  <span
                    className={
                      axis.satisfied ? 'text-txt-primary' : 'text-txt-secondary'
                    }
                  >
                    {axis.label}
                  </span>
                  {cost !== null && (
                    <span
                      data-testid={`axis-cost-${axis.id}`}
                      className="mt-0.5 block text-xs text-danger-ink"
                    >
                      Cuesta {cost} punto{cost === 1 ? '' : 's'}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <p data-testid="result-cost" className="mt-2 text-xs text-txt-muted">
            {result.cost.opsUnits} / {result.cost.budget.opsUnits} unidades
            operativas
            {result.cost.overage > 0 ? ' · presupuesto excedido' : ''}
          </p>
        </section>
      )}

      {referencesFirst && referencesSection}

      <section aria-labelledby="result-findings-heading">
        <h3
          id="result-findings-heading"
          className="mb-2 text-xs font-semibold uppercase tracking-wide text-txt-muted"
        >
          Hallazgos ({findings.length})
        </h3>
        {/* The accounting invariant, in words, before the list it describes:
            "no existe un punto perdido sin un hallazgo que lo explique". It
            held inside the engine and was invisible here, which is how a
            player read a score and a list that seemed to sum to nothing. */}
        {ledgerNote && (
          <p
            data-testid="result-ledger-note"
            className="mb-2 text-xs leading-relaxed text-txt-secondary"
          >
            {ledgerNote}
          </p>
        )}
        {findings.length === 0 ? (
          <p className="text-sm text-txt-muted">
            El motor no reportó ningún hallazgo.
          </p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="result-findings">
            {findings.map((finding) => (
              <li key={finding.id}>
                <button
                  type="button"
                  data-testid={`finding-${finding.id}`}
                  // The internal rule id is a TEST hook only. It is never
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
                      ? 'border-accent-ink bg-accent-dim'
                      : 'border-border-card hover:bg-bg-surface-hover'
                  }`}
                >
                  <p className="font-semibold text-txt-primary">
                    <span className="font-normal text-txt-muted">
                      {SEVERITY_LABEL[finding.severity]} ·{' '}
                    </span>
                    {finding.title}
                  </p>
                  <p className="mt-0.5 text-xs text-txt-secondary">
                    {finding.evidence}
                  </p>
                  <p className="mt-0.5 text-xs text-txt-secondary">
                    {finding.why}
                  </p>
                  {/* The half of §13.1 the player never got to read. `why`
                      says what the design fails to do; this says what that
                      costs, in the exercise's own business terms. Quieter
                      than the sentence above on purpose: it is the second
                      beat of one thought, not a second finding. */}
                  {finding.consequence && (
                    <p
                      data-testid={`finding-consequence-${finding.id}`}
                      className="mt-1 border-l-2 border-border-subtle pl-2 text-xs italic leading-relaxed text-txt-muted"
                    >
                      {finding.consequence}
                    </p>
                  )}
                  {/* Never the bare "Sin costo" this used to print under every
                      finding it could not price, including blocking ones,
                      which cost the whole score. See findingCostLabel(). */}
                  {findingCostLabel(finding, ledger) && (
                    <p
                      data-testid={`finding-cost-${finding.id}`}
                      className={`mt-0.5 text-xs ${finding.severity === 'blocking' ? 'text-danger-ink' : 'text-txt-muted'}`}
                    >
                      {findingCostLabel(finding, ledger)}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!referencesFirst && referencesSection}

      {result.kind === 'scored' &&
        result.status === 'scored' &&
        result.score === result.ceiling &&
        onSaveMiniAdr && (
          <MiniAdrForm
            initial={miniAdr}
            saved={Boolean(miniAdr)}
            transferDemonstrated={masteryComplete}
            onSave={onSaveMiniAdr}
          />
        )}

      {nextStep?.kind === 'game-complete' &&
        result.kind === 'scored' &&
        result.status === 'scored' &&
        result.score === result.ceiling &&
        !gameCompleteEligible && (
          <section
            data-testid="game-complete-pending"
            className="rounded-md border border-border-card bg-bg-raised p-3 text-sm text-txt-secondary shadow-elevation-1"
          >
            <h3 className="font-semibold text-txt-primary">
              El grafo llegó a 100. El recorrido todavía no terminó.
            </h3>
            <p className="mt-1">
              El cierre se gana cuando también completás la defensa de tus
              decisiones y la transferencia pendiente.
            </p>
            <a
              href="/forja/niveles"
              className="mt-2 inline-flex font-medium text-accent hover:underline"
            >
              Ver mi dominio pendiente
            </a>
          </section>
        )}

      {/* Last, deliberately: leaving comes after reading the verdict and, when
          it has been earned, the reasoning behind it. */}
      {shouldOfferNextStep(result, nextStep, gameCompleteEligible) &&
        nextStep && <NextStepLink nextStep={nextStep} />}

      {hasMoreBelow && (
        <ScrollAffordance
          label={
            referencesSection && !referencesFirst
              ? 'Por qué ésta y no la otra'
              : 'Hay más abajo'
          }
          onClick={scrollToEnd}
        />
      )}
    </div>
  )
}
