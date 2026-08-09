// Which findings the list view reads.
//
// PC10 asks the list view to be *equivalent* to the canvas, with the same
// nodes, connections and warnings, because it is the pointer-free path through
// the playground. It was not equivalent: `ForjaCanvas.tsx` handed it the live
// legality pass (`evaluateLegality(design)`), which runs before an exercise is
// scored and therefore allocates no points, while the result panel beside it
// rendered the scored evaluation's own findings with their costs. Same design,
// two lists, different contents, and the weaker one was the accessible one.
//
// The fallback matters as much as the fix: before the first submit there is no
// verdict to be equivalent to, and the live pass is exactly what the canvas is
// highlighting at that moment.
import type { CanvasResult } from '../playground/result'
import { hasPointLedger } from '../playground/result'
import type { Finding } from '../engine/types'

export interface ListViewSource {
  findings: readonly Finding[]
  // Whether the list may quote what a finding cost. Points exist only where
  // an exercise was actually scored: legality gates scoring, so an illegal
  // design never reached the ledger and free play has nothing to score
  // against. Printing a cost anywhere else would be inventing one.
  ledger: boolean
}

export function listViewSource(
  result: CanvasResult | null,
  liveFindings: readonly Finding[],
): ListViewSource {
  if (!result) return { findings: liveFindings, ledger: false }
  return { findings: result.findings, ledger: hasPointLedger(result) }
}
