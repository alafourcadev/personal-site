# Forja Progression Specification

## Purpose

The 12-level curriculum map (§14.4), unlock-by-role gating, and the
decoupling of content level from player rank, so a player cannot skip the
roles a level exists to teach.

## Requirements

### Requirement: Twelve-level map with prerequisites
The system MUST expose exactly the 12 levels of §14.4 in order, each carrying
the prerequisite concept that enables it, and MUST NOT allow a player to
enter a level whose prerequisite level is incomplete.

#### Scenario: Locked level is not enterable
- GIVEN a player who has not completed level 3
- WHEN the player attempts to open level 4
- THEN the system MUST block entry and state which prerequisite is missing

### Requirement: Unlock by exercise role, not by count
A level MUST be marked complete only when the player has a passing attempt
for at least one exercise of every required role present in that level
(calibration, core, tradeoff pair, trap/counter-trap, synthesis) — never by a
raw completed-count threshold.

#### Scenario: Completing only core exercises does not unlock the next level
- GIVEN a player who has passed every core-role exercise in level 4 but no
  tradeoff, trap, or synthesis exercise
- WHEN the system evaluates level completion
- THEN level 4 MUST remain incomplete and the next level MUST stay locked

### Requirement: Content level decoupled from player rank
The player's rank (XP-derived) MUST be tracked independently from which
content level is unlocked; unlocking a level MUST depend only on role
completion, never on rank alone.

#### Scenario: High rank does not bypass role completion
- GIVEN a player with rank sufficient for level 6 but missing the synthesis
  exercise of level 4
- WHEN the system evaluates access to level 5
- THEN level 5 MUST remain locked

### Requirement: Beta level composition
Each level published for beta MUST ship with at least 8 exercises composed
as: 1 calibration, 4 core, 1 contrasted tradeoff pair (2 exercises), and 1
synthesis.

#### Scenario: Level below the beta floor is not publishable
- GIVEN a level with 6 exercises and no tradeoff pair
- WHEN the level is checked for beta publication
- THEN it MUST be rejected from publication

### Requirement: First playable level is level 4
The beta's first playable level MUST be level 4, "Comunicación entre
servicios", carrying the existing evaluated exercise ("El pago que espera al
email") as one of its core exercises.

#### Scenario: Beta ships level 4 as the entry point
- GIVEN the beta content set
- WHEN a new player opens the level map
- THEN level 4 MUST be the first level with playable (non-locked,
  `PILOT`/`PUBLISHED`) exercises
