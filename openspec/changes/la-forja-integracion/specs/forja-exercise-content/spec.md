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
