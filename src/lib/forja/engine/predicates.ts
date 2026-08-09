// La Forja evaluation engine: the guarantee predicate DSL (design D2, doc
// §14.3 layer b). An exercise declares a serialisable predicate tree over a
// closed combinator vocabulary; this module compiles it into graph queries.
// The engine never imports or references any specific exercise.
import { CATALOG } from './catalog'
import type { ComponentType, Design, DesignNode, Finding, NodeQuery, Predicate } from './types'

// Every query returns a set, never `find`: duplicating an irrelevant node
// must never change which nodes match (defect 9 regression, D3).
export function matchNodes(design: Design, query: NodeQuery): DesignNode[] {
  return design.nodes.filter((n) => {
    if (query.type && !query.type.includes(n.type)) return false
    if (query.role && n.role !== query.role) return false
    if (query.propEquals) {
      for (const [key, value] of Object.entries(query.propEquals)) {
        if (n.props[key] !== value) return false
      }
    }
    return true
  })
}

// A node counts as a durable witness if its catalog entry says so explicitly
// (`persistence: 'durable'`), is explicitly volatile (`cache`'s
// `persistence: 'volatile'`, never a witness), or is one of the storage
// types that are durable by nature even without declaring the prop.
const DURABLE_BY_NATURE = new Set<ComponentType>(['queue', 'stream', 'object-storage', 'vector-store'])

function isDurableWitness(type: ComponentType): boolean {
  const persistence = CATALOG[type].props.persistence
  if (persistence === 'volatile') return false
  if (persistence === 'durable') return true
  return DURABLE_BY_NATURE.has(type)
}

interface PathOptions {
  via?: NodeQuery
  forbid?: NodeQuery
  requireDurableWitness?: boolean
}

// DFS over the directed edge graph. Tracks, per branch, whether a `via` node
// and/or a durable node has been seen so far. Both are path properties, not
// node properties, so a plain visited-node set is not enough.
function pathExists(design: Design, from: NodeQuery, to: NodeQuery, opts: PathOptions = {}): boolean {
  const starts = matchNodes(design, from)
  const goalIds = new Set(matchNodes(design, to).map((n) => n.id))
  const forbiddenIds = opts.forbid ? new Set(matchNodes(design, opts.forbid).map((n) => n.id)) : null
  const viaIds = opts.via ? new Set(matchNodes(design, opts.via).map((n) => n.id)) : null
  const byId = new Map(design.nodes.map((n) => [n.id, n]))

  for (const start of starts) {
    if (forbiddenIds?.has(start.id)) continue

    type Branch = { id: string; sawVia: boolean; sawDurable: boolean }
    const stack: Branch[] = [
      { id: start.id, sawVia: viaIds?.has(start.id) ?? false, sawDurable: isDurableWitness(start.type) },
    ]
    const visited = new Set<string>()

    while (stack.length) {
      const cur = stack.pop() as Branch
      const goalReached =
        goalIds.has(cur.id) &&
        (!viaIds || cur.sawVia) &&
        (!opts.requireDurableWitness || cur.sawDurable)
      if (goalReached) return true

      const key = `${cur.id}:${cur.sawVia ? 1 : 0}:${cur.sawDurable ? 1 : 0}`
      if (visited.has(key)) continue
      visited.add(key)

      for (const e of design.edges) {
        if (e.from.node !== cur.id) continue
        if (forbiddenIds?.has(e.to.node)) continue
        const next = byId.get(e.to.node)
        if (!next) continue
        stack.push({
          id: e.to.node,
          sawVia: cur.sawVia || (viaIds?.has(e.to.node) ?? false),
          sawDurable: cur.sawDurable || isDurableWitness(next.type),
        })
      }
    }
  }
  return false
}

export function evaluatePredicate(design: Design, predicate: Predicate, findings: Finding[]): boolean {
  switch (predicate.op) {
    case 'exists':
      return matchNodes(design, predicate.node).length > 0

    case 'path':
      return pathExists(design, predicate.from, predicate.to, { via: predicate.via, forbid: predicate.forbid })

    case 'noVolatileCut':
      return pathExists(design, predicate.from, predicate.to, { requireDurableWitness: true })

    case 'covered': {
      const targets = matchNodes(design, predicate.target)
      const byIds = new Set(matchNodes(design, predicate.by).map((n) => n.id))
      return targets.every((t) =>
        design.edges.some(
          (e) => (e.from.node === t.id && byIds.has(e.to.node)) || (e.to.node === t.id && byIds.has(e.from.node)),
        ),
      )
    }

    case 'edgeAbsent': {
      const fromIds = new Set(matchNodes(design, predicate.from).map((n) => n.id))
      const toIds = new Set(matchNodes(design, predicate.to).map((n) => n.id))
      return !design.edges.some((e) => fromIds.has(e.from.node) && toIds.has(e.to.node))
    }

    case 'ruleSilent':
      return !findings.some((f) => f.rule === predicate.rule)

    case 'all':
      return predicate.of.every((p) => evaluatePredicate(design, p, findings))

    case 'any':
      return predicate.of.some((p) => evaluatePredicate(design, p, findings))

    case 'not':
      return !predicate.of.every((p) => evaluatePredicate(design, p, findings))
  }
}
