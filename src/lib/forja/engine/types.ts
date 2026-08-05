// La Forja evaluation engine — shared types. Pure data, no DOM/React/Astro imports.

export type Layer = 'business' | 'application' | 'infrastructure'
export type Zone = 'public' | 'dmz' | 'private' | 'restricted'
export type Severity = 'blocking' | 'warning' | 'note'
export type DataClass = 'public' | 'personal' | 'regulated' | 'secret'

export type ComponentType =
  | 'actor'
  | 'business-process'
  | 'approver'
  | 'external-party'
  | 'service'
  | 'api-gateway'
  | 'mobile-client'
  | 'web-client'
  | 'worker'
  | 'ai-model'
  | 'external-provider'
  | 'database'
  | 'cache'
  | 'queue'
  | 'stream'
  | 'object-storage'
  | 'cdn'
  | 'identity-provider'
  | 'vector-store'
  | 'observability'
  | 'generic'

export interface DesignNode {
  id: string
  type: ComponentType
  label: string
  zone: Zone
  props: Record<string, string>
  role?: string
  given?: boolean
  position?: { x: number; y: number }
}

export interface DesignEdge {
  id: string
  from: { node: string; port?: string }
  to: { node: string; port?: string }
  protocol?: string
  sync?: boolean
  dataClass?: DataClass
}

export interface Design {
  nodes: DesignNode[]
  edges: DesignEdge[]
}

// Stable rule id — the same value across every finding raised by a rule,
// so highlighting and "why" copy can be looked up deterministically.
export type RuleId =
  | 'trust-zone-jump'
  | 'port-mismatch'
  | 'volatile-durable-mismatch'
  | 'regulated-without-backup'
  | 'pii-to-external-model'
  | 'queue-without-dlq'
  | 'orphan-queue'
  | 'sync-chain-depth'
  | 'intermittent-client-without-idempotency'
  | 'no-observability-on-critical'
  | 'single-point-of-failure'
  | 'ops-budget-exceeded'
  | 'undeclared-data-class'
  // EE9 empty-canvas guard — not one of the 13 §13.7 rules, a separate
  // legality-layer requirement that an empty design must never pass silently.
  | 'empty-canvas'

export interface Finding {
  // Per-instance id — a rule can fire more than once per evaluation, so this
  // disambiguates instances; `rule` below is the stable, reusable rule id.
  id: string
  rule: RuleId
  severity: Severity
  title: string
  evidence: string
  why: string
  nodeIds: string[]
  edgeIds: string[]
  // Allocated by score.ts's ledger (R1-C) — not populated by the legality/rules layer.
  costPoints?: number
}

// -- R1-C: guarantee predicate DSL (design D2) --------------------------
// An exercise declares what it demands as data, never as a function — the
// engine compiles this closed combinator vocabulary into graph queries and
// never learns anything about any specific exercise.

export interface NodeQuery {
  type?: ComponentType[]
  propEquals?: Record<string, string>
  role?: string
}

export type Predicate =
  | { op: 'exists'; node: NodeQuery }
  | { op: 'path'; from: NodeQuery; to: NodeQuery; via?: NodeQuery; forbid?: NodeQuery }
  // G2 in §14.3, verbatim: no cut in the path where the accepted state lives
  // only in volatile memory. Satisfied by an outbox, a durable queue, log
  // tailing or a reconciliation job alike — the predicate is over structure.
  | { op: 'noVolatileCut'; from: NodeQuery; to: NodeQuery }
  | { op: 'covered'; target: NodeQuery; by: NodeQuery }
  | { op: 'edgeAbsent'; from: NodeQuery; to: NodeQuery }
  // Lets an exercise decide which universal §13.7 rule costs points *in this
  // exercise*, without the rule catalog knowing any exercise.
  | { op: 'ruleSilent'; rule: RuleId }
  | { op: 'all' | 'any' | 'not'; of: Predicate[] }
