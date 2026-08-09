// La Forja evaluation engine: shared types. Pure data, no DOM, React or Astro imports.

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

// PC16: a small, fixed palette a player can assign to any node, purely
// presentational (see tests/engine/color-neutral.test.ts). Deliberately not
// one of the four categorical CATALOG_UI colours, which already carry
// component-type identity: this is a personal annotation, never a system
// signal, so it lives on DesignNode as its own optional field, never read
// by anything under src/lib/forja/engine.
export type PlayerColor = 'slate' | 'emerald' | 'blue' | 'amber' | 'violet' | 'rose'

export interface DesignNode {
  id: string
  type: ComponentType
  label: string
  zone: Zone
  props: Record<string, string>
  role?: string
  given?: boolean
  position?: { x: number; y: number }
  color?: PlayerColor
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

// Stable rule id: the same value across every finding raised by a rule,
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
  // EE9 empty-canvas guard. Not one of the 13 §13.7 rules, but a separate
  // legality-layer requirement that an empty design must never pass silently.
  | 'empty-canvas'

export interface Finding {
  // Per-instance id. A rule can fire more than once per evaluation, so this
  // disambiguates instances; `rule` below is the stable, reusable rule id.
  id: string
  // Widened in R1-C: a legal-but-unsatisfied guarantee also produces a
  // finding, per the design's Interfaces contract. `RuleId` alone covers
  // only the 13 §13.7 rules plus `empty-canvas`.
  rule: RuleId | `guarantee-missing:${string}`
  severity: Severity
  title: string
  evidence: string
  why: string
  // What the missing rule costs, in the exercise's own terms. Optional
  // because only the guarantee findings have one written for them: `why`
  // names what the design fails to do, this names who pays for it.
  consequence?: string
  nodeIds: string[]
  edgeIds: string[]
  // Allocated by score.ts's ledger (R1-C), not by the legality or rules layer.
  costPoints?: number
}

// -- R1-C: guarantee predicate DSL (design D2) --------------------------
// An exercise declares what it demands as data, never as a function. The
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
  // tailing or a reconciliation job alike, because the predicate is over structure.
  | { op: 'noVolatileCut'; from: NodeQuery; to: NodeQuery }
  | { op: 'covered'; target: NodeQuery; by: NodeQuery }
  | { op: 'edgeAbsent'; from: NodeQuery; to: NodeQuery }
  // Lets an exercise decide which universal §13.7 rule costs points *in this
  // exercise*, without the rule catalog knowing any exercise.
  | { op: 'ruleSilent'; rule: RuleId }
  | { op: 'all' | 'any' | 'not'; of: Predicate[] }

// -- R1-C: cost as a budget with a cliff (design D3) ---------------------

export interface Budget {
  opsUnits: number
  monthlyUsd?: number
}

export interface Guarantee {
  id: string
  label: string
  weight: number
  predicate: Predicate
  whyMissing: string // the sentence the player reads. Required, non-empty.
  consequence: string // §13.1: rule, evidence, consequence
}

// Minimal projection the engine needs from an exercise, deliberately not
// the full content-collection schema (difficulty axes, prereqs, copy live
// in R1-F). Mirrors R1-B's `opsCapacity` precedent: the engine only takes
// what it evaluates against, so it stays exercise-agnostic.
export interface ExerciseSpec {
  guarantees: Guarantee[]
  budget: Budget
  lambda: number
}

// -- R1-C: the public evaluate() / checkConnection() surface -------------

export interface Evaluation {
  status: 'illegal' | 'scored'
  score: number | null
  ceiling: 100
  guarantees: { id: string; satisfied: boolean; weight: number }[]
  cost: { opsUnits: number; monthlyUsd: number; budget: Budget; overage: number }
  findings: Finding[]
  engineVersion: string
}

export interface ConnectionVerdict {
  ok: boolean
  why?: string
  consequence?: string
}
