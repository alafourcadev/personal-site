// Turning the exercises' `referenceSolutions` into something a player can
// actually read.
//
// Every exercise declares at least two reference solutions, and every one of
// them carries a `contextInversion`: the paragraph explaining in which context
// THAT solution is the better one and the other is not. It is the product's
// central claim, two correct decisions in different contexts, and it was
// dead weight: the field appeared nowhere outside the content schema, so no
// player had ever read one. A reviewer solved the same exercise two different
// ways, scored 100 both times, and was never told whether the reasoning the
// brief asked him for was right.
//
// It lives next to the canvas (not in lib/forja/playground) on purpose:
// `LoadedExercise` is documented as "only what the engine evaluates against",
// and the engine never evaluates a reference solution. This is player-facing
// pedagogy travelling alongside the exercise, not engine input.
import type { CanvasResult } from '../../../lib/forja/playground/result'

// The serializable slice the exercise route hands to the island: the prose,
// plus the component types the solution uses, never the full reference
// design. The comparison below only needs the types, and shipping the whole
// graph would turn the panel into a copy-and-paste answer key, which is the
// opposite of an engine that deliberately does not autocorrect.
export interface ReferenceSolutionView {
  label: string
  contextInversion: string
  // The design's structural fingerprint. See `designFingerprint`. Not a list
  // of component types: it also carries the connections, keyed by the types
  // they join, which is what lets a solution tell itself apart from its own
  // alternative.
  fingerprint: string[]
}

// Structurally typed on purpose: this runs against an engine `Design` (the
// player's own, in the island) AND against the content collection's parsed
// reference designs (in the exercise route), which are the same shape but not
// the same declared type.
export interface FingerprintDesign {
  nodes: readonly { id: string; type: string }[]
  edges?: readonly { from: { node: string }; to: { node: string } }[]
}

// What separates one reference solution of an exercise from the other.
//
// This used to be the set of component types alone, on the argument that two
// solutions "differ by the decision the exercise is about (a cache versus a
// CDN)". That is true of some exercises and false of most: measured across the
// whole library, 92 of 336 reference designs could not identify THEMSELVES
// under a type-set comparison, because the pair uses the same pieces and
// differs by a connection or by how many copies of one piece it runs. A
// comparison that cannot tell a design apart from its own alternative is not a
// comparison.
//
// So the connections are in the fingerprint, keyed by the TYPES they join and
// never by node ids, which are private to whoever drew the graph. Node types
// stay deduplicated (drawing a second identical service is not an architecture
// decision) while connections are counted, because "one logistics operator or
// two" is exactly the decision some exercises are about.
//
// Labels, zones, positions, colours and props are all absent: none of them is
// the decision either, and props in particular are what the two truly
// indistinguishable pairs in the library differ by. Those two get no mark at
// all, which is the honest outcome.
export function designFingerprint(design: FingerprintDesign): string[] {
  const typeById = new Map(design.nodes.map((node) => [node.id, node.type]))
  const tokens = new Set(design.nodes.map((node) => node.type))
  const connections = new Map<string, number>()
  for (const edge of design.edges ?? []) {
    const from = typeById.get(edge.from.node)
    const to = typeById.get(edge.to.node)
    // A dangling edge names a node that is not in the design. It describes
    // nothing, so it contributes nothing rather than a made-up endpoint type.
    if (from === undefined || to === undefined) continue
    const key = `${from}>${to}`
    connections.set(key, (connections.get(key) ?? 0) + 1)
  }
  for (const [key, count] of connections) tokens.add(`${key}*${count}`)
  return [...tokens].sort()
}

// Which reference the player actually built, or null.
//
// Exact match, not nearest neighbour. Nearest neighbour is what produced the
// worst failure of this panel: a player who had connected a file store read a
// finding saying the system was writing the document to its own storage, and
// directly underneath it the panel marked "el documento no se guarda" as the
// closest solution, because that reference happened to have one component
// fewer. Being a superset of a reference is not being that reference, and two
// contradictory claims inside one panel destroy the only line that orients
// somebody who just lost points.
//
// So null is the answer whenever the player's design is not one of the
// references, and also whenever two references are indistinguishable from each
// other: marking wrong is worse than not marking.
export function closestReferenceIndex(
  playerFingerprint: readonly string[],
  solutions: readonly ReferenceSolutionView[],
): number | null {
  const key = (tokens: readonly string[]) => [...tokens].sort().join('')
  const player = key(playerFingerprint)
  const matches = solutions.reduce<number[]>(
    (found, solution, index) => (key(solution.fingerprint) === player ? [...found, index] : found),
    [],
  )
  return matches.length === 1 ? matches[0] : null
}

// When the reasoning is allowed to surface.
//
// The engine does not autocorrect and "el remedio nunca se revela en el primer
// nivel" (CONTEXTO-PARA-AGENTES §4), so the first attempt gets findings only:
// what you lost and why, never what to do instead. Two conditions open it:
//
//   1. the second attempt, where the player has committed twice and read the
//      findings once; withholding past that stops being pedagogy and starts
//      being an obstacle;
//   2. a first attempt that already reaches the ceiling, where there is no remedy
//      left to give away, and the one thing a perfect score CANNOT tell the
//      player is whether the reasoning behind it was the right one for this
//      context, which is precisely what the brief asked.
//
// Free play has no exercise behind it and therefore no references at all.
export function shouldRevealReferences(attempts: number, result: CanvasResult | null): boolean {
  if (!result || result.kind !== 'scored') return false
  if (attempts >= 2) return true
  return attempts >= 1 && result.status === 'scored' && result.score === result.ceiling
}
