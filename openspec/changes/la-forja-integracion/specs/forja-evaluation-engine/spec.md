# Forja Evaluation Engine Specification

## Purpose

Pure TypeScript module (no DOM) that scores a La Forja design graph in three
layers — legality gate, weighted guarantee predicates, cost-as-budget — and
exposes verifiable monotonicity and feedback-accounting invariants. Runs
unchanged in the browser today and in a server function later.

## Requirements

### Requirement: Pure module boundary
The engine MUST be implemented with zero DOM or browser-global imports.

#### Scenario: No DOM dependency
- GIVEN the engine module's import graph
- WHEN statically analyzed
- THEN it MUST NOT import `document`, `window`, or any DOM-only API

### Requirement: Legality gates scoring
The engine MUST evaluate legality (trust-zone bands §13.3, port compatibility
§13.6, the 13 rules — the 12 of §13.7 plus `port-mismatch`) before computing
any score. An illegal design
MUST NOT receive a numeric score derived from guarantees or cost.

#### Scenario: Illegal design has no score
- GIVEN a graph containing a `trust-zone-jump` (public → restricted) violation
- WHEN the graph is evaluated
- THEN the result MUST report `legal: false` and MUST NOT include a `score`

#### Scenario: Legal design proceeds to scoring
- GIVEN a graph with zero blocking-severity findings
- WHEN evaluated
- THEN the result MUST include `legal: true` and a numeric `score`

### Requirement: Thirteen validation rules with severities
The engine MUST implement all thirteen rules: the twelve named in §13.7
(`trust-zone-jump`, `volatile-durable-mismatch`, `regulated-without-backup`,
`pii-to-external-model`, `queue-without-dlq`, `orphan-queue`,
`sync-chain-depth`, `intermittent-client-without-idempotency`,
`no-observability-on-critical`, `single-point-of-failure`,
`ops-budget-exceeded`, `undeclared-data-class`) plus `port-mismatch` (§13.6:
a target component's inbound port that does not accept the source
component's type — "no es una decisión discutible, es un error de forma"),
each tagged `blocking | warning | note`, and MUST gate legality only on
`blocking`.

#### Scenario: Blocking rule prevents legal status
- GIVEN a design with an orphan queue (no connected consumer)
- WHEN evaluated
- THEN `orphan-queue` MUST appear with `severity: blocking` and `legal: false`

#### Scenario: Warning rule does not block
- GIVEN a design with a queue lacking a DLQ, otherwise legal
- WHEN evaluated
- THEN `queue-without-dlq` MUST appear with `severity: warning` and `legal: true`

### Requirement: Guarantee predicates over the graph
Each exercise MUST declare 3–5 weighted guarantees; each MUST be evaluated as
a predicate over graph structure, never as a match against a reference
topology.

#### Scenario: Different topologies both satisfy the same guarantee
- GIVEN two structurally distinct legal designs that satisfy guarantee G2
  ("an accepted request survives process death") via outbox and via durable
  queue respectively
- WHEN both are evaluated against the same exercise
- THEN both MUST report `G2: satisfied`

### Requirement: Cost as a budget with a cliff
The engine MUST compute cost `C(d)` as a budget: designs at or under the
exercise's declared budget MUST incur no penalty; designs over budget MUST be
penalized per `eficiencia(d) = G(d) / (1 + λ·max(0, C(d) − C_budget))`.

#### Scenario: Under-budget design is not penalized
- GIVEN a legal design with `C(d) ≤ C_budget`
- WHEN scored
- THEN the cost term MUST NOT reduce `eficiencia(d)` below `G(d)`

### Requirement: Analytic ceiling
The engine MUST use an analytic ceiling such that any design satisfying all
declared guarantees within budget scores exactly 100. The ceiling MUST NOT
depend on other players' submissions.

#### Scenario: Two distinct legal designs both reach 100
- GIVEN two structurally different legal designs each satisfying all declared
  guarantees within budget
- WHEN both are scored
- THEN both MUST receive `score: 100`

### Requirement: Monotonicity invariant
The engine MUST guarantee: if `G(d') ≥ G(d)` and `C(d') ≤ C_budget`, then
`score(d') ≥ score(d)`.

#### Scenario: Adding a satisfied guarantee never lowers the score
- GIVEN design `d` and `d'` identical to `d` plus one additional satisfied
  guarantee, both within budget
- WHEN both are scored
- THEN `score(d') MUST be ≥ score(d)`

### Requirement: Feedback accounting invariant
The engine MUST guarantee `score + Σ findings.costPoints == ceiling` for every
scored design.

#### Scenario: Score deficit is fully explained by findings
- GIVEN a design scoring 62 against a ceiling of 100
- WHEN its findings' `costPoints` are summed
- THEN the sum MUST equal 38

### Requirement: Empty-canvas guard
An empty design (zero nodes, zero connections) MUST score 0 with an explicit
message, and MUST NOT receive credit from any axis that treats absence as
passing.

#### Scenario: Empty canvas scores zero, not 30
- GIVEN a design with zero nodes and zero connections
- WHEN evaluated
- THEN the result MUST be `score: 0` with a message stating no system was
  submitted

### Requirement: Publication test — plural legal optima
An exercise MUST NOT be marked `PUBLISHED` unless at least two structurally
distinct legal reference designs both score 100 against it (§13.10).

#### Scenario: Single-optimum exercise is rejected
- GIVEN an exercise whose only 100-scoring reference design has no
  structurally distinct legal counterpart
- WHEN the publication check runs
- THEN the exercise MUST be rejected from `PUBLISHED`

### Requirement: Engine does not auto-correct
The engine MUST only report findings — it MUST NOT alter the submitted graph
or generate a corrected version.

#### Scenario: Scoring does not mutate the design
- GIVEN a submitted graph
- WHEN evaluated
- THEN the result MUST NOT include a modified graph, and the input graph MUST
  remain unchanged
