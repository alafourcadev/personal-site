// "Volver y seguir": the design a player sees when returning to an
// exercise. Deliberately reads the SAME `RankingPort.getHistory(exerciseId)`
// the existing `LocalRankingAdapter` already exposes — persistence is not
// reinvented, this is just the pure read side of it: the most recently
// saved attempt's graph, or `fallback` for a first-time visit.
//
// R1-H: a first-time visit used to always fall back to a blank canvas — the
// empty-canvas defect that made every role-anchored exercise unplayable
// (there was no way to give a player-created node a role). `fallback` is
// now a parameter, defaulting to blank only for free play (which has no
// starting design); a real exercise passes its own `startingDesign`.
import type { Attempt } from '../ranking/port'
import type { Design } from '../engine/types'

const BLANK: Design = { nodes: [], edges: [] }

export function continuedDesign(history: Pick<Attempt, 'design'>[], fallback: Design = BLANK): Design {
  const last = history[history.length - 1]
  return last?.design ?? fallback
}
