# Forja Exercise Content Specification

## Purpose

Exercise data as an Astro content collection with a Zod schema, carrying the
nine-axis difficulty index (§14.4), the fourteen admission gates, and a
publication state machine, so an exercise cannot enter play without the data
the engine and progression system require.

## Requirements

### Requirement: Content collection schema
Exercises MUST be defined as an Astro content collection with a Zod schema
that requires: `id`, `level` (1–12), `role`
(`calibration|core|tradeoff|trap|counter-trap|synthesis`), the nine
difficulty axes `D1`–`D9` (each 0–4), `prerequisiteLevels`, hidden facts with
a discovery path, an executable budget, a rubric with an observable signal
per dimension, at least two reference solutions, and a lifecycle `status`.

#### Scenario: Exercise missing a required field fails validation
- GIVEN an exercise entry omitting `D3`
- WHEN the content collection is built
- THEN the build MUST fail schema validation

### Requirement: Nine-axis difficulty index
The schema MUST compute `índice = Σ(D1..D9)` and MUST reject an exercise
whose index falls outside its level's band `[2+2(N−1), 10+2(N−1)]`.

#### Scenario: Index out of band is rejected
- GIVEN a level-4 exercise whose D1–D9 sum to 22 (band is 8–16)
- WHEN admission gates run
- THEN the exercise MUST be rejected with a message naming the out-of-band
  index

### Requirement: Per-axis ceiling gate
The schema MUST reject an exercise where any single axis exceeds its level's
per-axis ceiling as defined in the axis table (§14.4).

#### Scenario: Axis over its ceiling is rejected
- GIVEN a level-2 exercise with `D3 = 4` (D3's ceiling of 4 requires level 8+)
- WHEN admission gates run
- THEN the exercise MUST be rejected naming the offending axis

### Requirement: Prerequisite gate
The schema MUST reject an exercise declaring a prerequisite level greater
than its own assigned level.

#### Scenario: Forward-referencing prerequisite is rejected
- GIVEN an exercise at level 3 declaring a prerequisite of level 5
- WHEN admission gates run
- THEN the exercise MUST be rejected

### Requirement: Two reference solutions with context inversion
Every exercise MUST declare at least two structurally distinct, legal
reference solutions, and MUST declare which contextual conditions make each
one the better choice (`contextInversion`), consistent with the engine's
publication test (§13.10).

#### Scenario: Single-solution exercise fails content validation
- GIVEN an exercise with exactly one reference solution
- WHEN the content collection is built
- THEN the build MUST fail schema validation

### Requirement: Publication state machine
Every exercise MUST carry `status: DRAFT | REVIEW | PILOT | PUBLISHED`, and
MUST NOT be served to players unless `status` is `PILOT` or `PUBLISHED`.

#### Scenario: DRAFT exercise is not served
- GIVEN an exercise with `status: DRAFT`
- WHEN the level page is rendered for a player
- THEN that exercise MUST NOT appear in the playable list

### Requirement: Rubric dimensions have observable signals
Each rubric dimension MUST declare an observable signal computable from the
submitted graph, not a subjective judgment call.

#### Scenario: Rubric entry without a computable signal is rejected
- GIVEN a rubric dimension with no linked predicate or metric
- WHEN admission gates run
- THEN the exercise MUST be rejected

### Requirement: An exercise ships the system it describes
Every exercise whose brief describes an existing system MUST ship a starting
design: the nodes and connections that system already has, each carrying the
`role` its guarantees anchor on. The playground MUST load that starting design
when the exercise opens.

A guarantee MUST NOT anchor on a `role` that no node in the starting design
carries, unless the player has a way to assign that role. An exercise that
violates this MUST fail the admission gate at build time.

Rationale — this is the defect that made the product uncompletable. Guarantees
anchor on roles (`payment-service`, `email-sent`). Exercises shipped with no
starting design, and the player cannot assign roles to the components they drag
in. So a role-anchored guarantee could never be satisfied by playing: a sound
hand-built design measured 33/100 with no path to 100. The reference solutions
only reached 100 because their roles are authored into the fixture.

It is also the wrong pedagogy. The brief describes a system that already exists;
the player's job is to fix it, not to reconstruct it from memory. The owner
stated this at the outset: "hay una situación X, están todos los componentes y
nosotros decidimos qué hacer".

#### Scenario: Opening an exercise shows the system described in its brief
- GIVEN an exercise whose brief describes an existing system
- WHEN the player opens it
- THEN the canvas MUST already contain that system's nodes and connections
- AND each node the guarantees anchor on MUST carry its declared role

#### Scenario: Every anchored role exists, or the build fails
- GIVEN an exercise with a guarantee anchored on a role
- WHEN the collection is validated at build time
- THEN a node carrying that role MUST exist in the starting design
- AND if it does not, the build MUST fail naming the missing role

#### Scenario: A player can reach the ceiling by playing
- GIVEN an exercise opened normally, with no seeded storage and no authored fixture
- WHEN the player edits the starting design into a solution that satisfies every
  guarantee within budget, using only pointer and keyboard
- THEN the result MUST show 100
