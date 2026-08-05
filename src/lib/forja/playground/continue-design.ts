// "Volver y seguir": the design a player sees when returning to an
// exercise. Deliberately reads the SAME `RankingPort.getHistory(exerciseId)`
// the existing `LocalRankingAdapter` already exposes — persistence is not
// reinvented, this is just the pure read side of it: the most recently
// saved attempt's graph, or a blank canvas for a first-time visit.
import type { Attempt } from '../ranking/port'
import type { Design } from '../engine/types'

const BLANK: Design = { nodes: [], edges: [] }

export function continuedDesign(history: Pick<Attempt, 'design'>[]): Design {
  const last = history[history.length - 1]
  return last?.design ?? BLANK
}
