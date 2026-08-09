// PC10 asks the list view to be *equivalent* to the canvas. It was reading a
// different set of findings: `ForjaCanvas.tsx` handed it the live legality
// pass, which runs before any exercise is scored and therefore allocates no
// points, while the result panel next to it rendered the scored evaluation's
// own findings with their costs. Same design, two lists, different contents —
// and the list was the accessible, pointer-free path, so the player who
// depended on it read the weaker one.
//
// This is the one decision that fix needs, kept pure: which findings the list
// shows, and whether it is allowed to quote what they cost.
import { describe, expect, it } from 'vitest'
import { listViewSource } from '../../src/lib/forja/canvas/list-view-source'
import type { CanvasResult } from '../../src/lib/forja/playground/result'
import type { Finding } from '../../src/lib/forja/engine/types'

function finding(id: string, costPoints?: number): Finding {
  return {
    id,
    rule: 'orphan-queue',
    severity: 'warning',
    title: id,
    why: 'why',
    evidence: 'evidence',
    nodeIds: [],
    edgeIds: [],
    costPoints,
  }
}

const live = [finding('live-a'), finding('live-b')]

const scored: CanvasResult = {
  kind: 'scored',
  status: 'scored',
  score: 83,
  ceiling: 100,
  axes: [],
  cost: { opsUnits: 3, monthlyUsd: 0, budget: { opsUnits: 5 }, overage: 0 },
  findings: [finding('scored-a', 17)],
}

const illegal: CanvasResult = { ...scored, status: 'illegal', score: null, findings: [finding('scored-blocking')] }

const freePlay: CanvasResult = { kind: 'free-play', legal: true, findings: [finding('free-a')] }

describe('listViewSource', () => {
  // Before the first submit there is no verdict to be equivalent to, and the
  // live pass is exactly what the canvas is highlighting right now.
  it('falls back to the live legality pass while nothing has been submitted', () => {
    expect(listViewSource(null, live)).toEqual({ findings: live, ledger: false })
  })

  it('shows the same findings the verdict panel shows once there is a verdict', () => {
    expect(listViewSource(scored, live).findings).toEqual(scored.findings)
  })

  // Quoting a cost is only honest where points were actually allocated —
  // legality gates scoring, so an illegal design never reached the ledger.
  it('may quote what a finding cost only when the design was actually scored', () => {
    expect(listViewSource(scored, live).ledger).toBe(true)
    expect(listViewSource(illegal, live).ledger).toBe(false)
    expect(listViewSource(freePlay, live).ledger).toBe(false)
  })

  it('shows free play its own submitted findings, still without a ledger', () => {
    expect(listViewSource(freePlay, live)).toEqual({ findings: freePlay.findings, ledger: false })
  })
})
