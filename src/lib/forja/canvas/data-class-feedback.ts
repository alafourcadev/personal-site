// What the status bar says after the player declares what travels through a
// connection. Pure string and array work, no DOM and no engine call, so the exact
// wording is the contract, so it is asserted in Vitest rather than eyeballed,
// like announcements.ts next to it.
//
// The interesting half is the second-order effect. Three engine rules only ever
// fire on an edge that HAS a `dataClass`: volatile-durable-mismatch,
// pii-to-external-model and regulated-without-backup. Before this gesture
// existed they were unreachable for any connection the player drew. Now
// declaring the truth about a connection can turn a scored design into an
// illegal one.
//
// The gesture does NOT follow announceVerdict's refuse-and-explain precedent
// for that case. A refused connection is about something that cannot exist; a
// declaration is about something that is already true, and refusing it would
// teach the player that the way to stay legal is to not say what travels. The
// opposite of what the exercises are about. So the declaration always commits,
// and this message carries the consequence: the declaration was kept, the
// problem is not new, here is what it is.
import type { Design, Finding } from '../engine/types'

// The blocking findings that the declaration itself brought into existence.
//
// "Brought into existence" is matched by rule + reach, not by finding id: ids
// carry a per-evaluation sequence number (`${rule}:${seq}`), so the same rule
// firing on the same connection gets a different id whenever an unrelated
// finding is added or removed ahead of it in the list.
//
// `nodeIds` is part of the reach on purpose. `regulated-without-backup` is
// raised against the database, with an EMPTY `edgeIds`. Matching on edges
// alone would leave the one rule that most often fires on a fresh declaration
// silently unannounced.
export function newlyBlockingFindings(
  before: readonly Finding[],
  after: readonly Finding[],
  edgeId: string,
  touchedNodeIds: readonly string[] = [],
): Finding[] {
  const reaches = (f: Finding) =>
    f.edgeIds.includes(edgeId) || f.nodeIds.some((id) => touchedNodeIds.includes(id))
  const alreadyThere = new Set(before.filter((f) => f.severity === 'blocking' && reaches(f)).map((f) => f.rule))
  return after.filter((f) => f.severity === 'blocking' && reaches(f) && !alreadyThere.has(f.rule))
}

// The two node ids a connection touches, which is what `newlyBlockingFindings` needs to
// recognise a node-level consequence of an edge-level declaration.
export function edgeEndpoints(design: Design, edgeId: string): string[] {
  const edge = design.edges.find((e) => e.id === edgeId)
  return edge ? [edge.from.node, edge.to.node] : []
}

export function dataClassMessage(
  // From announcements.ts's edgeDescription: "de X a Y".
  edgeText: string,
  // The class's player-facing name, or null when the player took the
  // declaration back.
  className: string | null,
  newlyBlocking: readonly Finding[],
): string {
  if (!className) return `Quitaste la clase de dato de la conexión ${edgeText}.`

  const declared = `Declaraste ${className} en la conexión ${edgeText}.`
  if (newlyBlocking.length === 0) return declared

  const heading = newlyBlocking.length === 1 ? 'Bloqueante' : 'Bloqueantes'
  const titles = newlyBlocking.map((f) => f.title).join(' · ')
  const whys = newlyBlocking.map((f) => f.why).join(' ')
  return (
    `${declared} La declaración se guardó: no apareció un problema nuevo, se volvió visible el que ya estaba. ` +
    `${heading}: ${titles}. ${whys}`
  )
}
