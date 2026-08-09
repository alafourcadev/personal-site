// R1-G: `ResultPanel`'s input, one level above the raw engine `Evaluation`.
// Two shapes, never mixed: free play (`/forja`, no exercise loaded, so
// legality and findings only, see free-play.ts and its own R1-F fix) and a
// loaded exercise (`/forja/[level]/[exercise]`, a real score against real
// guarantees). Keeping this as its own union, rather than widening
// `FreePlayResult`, is what lets `ResultPanel` render "nothing to score
// against yet" for one and a real axis-by-axis breakdown for the other
// without a nullable half-populated object in between.
import type { Evaluation, Finding, Guarantee } from '../engine/types'

export interface ScoredAxis {
  id: string
  label: string
  satisfied: boolean
  weight: number
}

export interface ScoredCost {
  opsUnits: number
  monthlyUsd: number
  budget: { opsUnits: number; monthlyUsd?: number }
  overage: number
}

export type CanvasResult =
  | { kind: 'free-play'; legal: boolean; findings: Finding[] }
  | {
      kind: 'scored'
      status: 'illegal' | 'scored'
      score: number | null
      ceiling: number
      axes: ScoredAxis[]
      cost: ScoredCost
      findings: Finding[]
    }

// R1-G requirement 4: "los ejes que muestre el panel salen de las garantías
// declaradas por ese ejercicio". The engine's own `Evaluation.guarantees`
// carries only {id, satisfied, weight} (design's Interfaces contract, kept
// exercise-agnostic on purpose); this is the one place a label is resolved
// back onto that id, from the exercise's own `Guarantee[]`, never invented.
// -- The ledger, as the player reads it -------------------------------------
//
// CONTEXTO-PARA-AGENTES §4 states the accounting invariant the engine holds by
// construction: `puntaje + Σ(puntos que cuesta cada hallazgo) == techo`, or
// "no existe un punto perdido sin un hallazgo que lo explique". The engine kept it;
// the panel hid it. Measured over every exercise in the library, 114 of 168
// starting designs rendered their findings in an order where a finding worth
// nothing came before the one that explained the loss, and 192 findings were
// labelled "Sin costo", including every blocking finding, which does not cost
// points because it removes the score outright.
//
// These functions are what the panel renders instead. They are pure so the
// arithmetic is provable without a browser, and they derive every number from
// the findings actually on screen, so the panel can never claim a total the
// player cannot verify by reading the list.

function costOf(finding: Pick<Finding, 'costPoints'>): number {
  return finding.costPoints ?? 0
}

// Most expensive first. `sort` is stable in every engine this ships to, so
// findings that cost the same keep the engine's own order, which groups a
// rule's instances together instead of shuffling them by tie-break.
export function orderedFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort((a, b) => costOf(b) - costOf(a))
}

// Points were allocated only when an exercise was actually scored. Legality
// gates scoring (engine `evaluate()`), so an illegal design never reaches the
// ledger, and free play has no exercise to score against.
export function hasPointLedger(result: CanvasResult): boolean {
  return result.kind === 'scored' && result.status === 'scored'
}

// The one line under a finding that says what it cost. `null` means the panel
// says nothing: without a ledger there is no cost to quote, and printing "Sin
// costo" there asserts an accounting that never ran.
export function findingCostLabel(
  finding: Pick<Finding, 'severity' | 'costPoints'>,
  ledger: boolean,
): string | null {
  // A blocking finding never costs points because it costs the entire score:
  // it is what makes the design illegal in the first place. Labelling it "sin
  // costo" told the player the opposite of what happened.
  if (finding.severity === 'blocking') return 'Anula el puntaje entero'
  if (!ledger) return null
  const points = costOf(finding)
  if (points > 0) return `Cuesta ${points} punto${points === 1 ? '' : 's'}`
  return 'No descuenta puntos'
}

// The sentence that makes the invariant legible at the top of the list, or
// `null` when there is nothing to account for.
export function findingsLedgerNote(result: CanvasResult): string | null {
  if (result.kind !== 'scored') return null
  if (result.status === 'illegal') {
    return 'Un hallazgo bloqueante anula el puntaje entero. No hay puntos repartidos: primero el diseño tiene que ser legal.'
  }
  if (result.score === null || result.score === result.ceiling) return null
  const spent = result.findings.reduce((sum, f) => sum + costOf(f), 0)
  // Defensive on purpose: the note is arithmetic the player can redo by
  // reading the cards below it, so it is withheld rather than approximated
  // if the two sides ever fail to meet.
  if (result.score + spent !== result.ceiling) return null
  return `Tu puntaje (${result.score}) más lo que cuestan estos hallazgos (${spent}) suma el techo de ${result.ceiling}: no hay puntos perdidos sin un hallazgo que los explique.`
}

// What a failed objective cost, so the number sits next to the objective
// instead of only inside a finding further down. The engine names a missing
// guarantee's finding after the guarantee itself (`score.ts`), which is the
// only link between the two.
export function axisCostPoints(axisId: string, findings: readonly Finding[]): number | null {
  const finding = findings.find((f) => f.rule === `guarantee-missing:${axisId}`)
  return finding ? costOf(finding) : null
}

// At the ceiling the panel has nothing left to diagnose. Every objective is
// met and every finding costs nothing, so the reference solutions stop being
// an appendix and become the only thing left to read: which of the two
// decisions the player took, and in which context the other one wins. That is
// the brief's own question and the one thing a perfect score cannot answer.
// Below the ceiling the findings are the actionable part and keep their place.
export function referencesGoFirst(result: CanvasResult): boolean {
  return result.kind === 'scored' && result.status === 'scored' && result.score === result.ceiling
}

export function toScoredResult(evaluation: Evaluation, guarantees: Guarantee[]): CanvasResult {
  const labelById = new Map(guarantees.map((g) => [g.id, g.label]))
  return {
    kind: 'scored',
    status: evaluation.status,
    score: evaluation.score,
    ceiling: evaluation.ceiling,
    axes: evaluation.guarantees.map((g) => ({
      id: g.id,
      label: labelById.get(g.id) ?? g.id,
      satisfied: g.satisfied,
      weight: g.weight,
    })),
    cost: evaluation.cost,
    findings: evaluation.findings,
  }
}

// What the always-mounted status bar says the instant a design is evaluated.
//
// `handleSubmit` never announced anything: the loudest gesture in the
// product was the only silent one, and at the same moment the canvas went to
// `display: none` while focus stayed on the button that had just been
// pressed. WCAG 4.1.3 asks for the verdict to be programmatically
// determinable without moving focus; the verdict panel cannot do that job
// alone, because it is inserted into the DOM together with its own text and
// a live region born with its content is not reliably announced. The status
// bar is already on the page, so it is the one that speaks.
//
// It reads the verdict and nothing else. The panel beside it carries the
// axes, the findings and the reasoning; repeating those here would make the
// announcement longer than the thing it announces.
export function submitMessage(result: CanvasResult): string {
  if (result.kind === 'free-play') {
    return result.legal
      ? 'Diseño evaluado. Sin ejercicio cargado no hay puntaje: los hallazgos del panel siguen siendo reales.'
      : 'Diseño evaluado: ilegal, sin puntaje. El panel dice qué lo bloquea.'
  }
  if (result.status === 'illegal') return 'Diseño evaluado: ilegal, sin puntaje. El panel dice qué lo bloquea.'
  return `Diseño evaluado: ${result.score} de ${result.ceiling}. El panel tiene los ejes y los hallazgos.`
}
