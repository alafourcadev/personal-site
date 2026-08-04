# Forja Ranking Specification

## Purpose

Accounts, attempt persistence, and an always-visible ranking, honestly
labeled as local until server-side verification exists, with privacy by
default and row-level security in Supabase Free.

## Requirements

### Requirement: Ranking visible in every view
A non-empty ranking element MUST be present and rendered in every La Forja
view (map, level, playground, results, profile, settings) — never
conditional on the current view.

#### Scenario: Ranking box has non-zero size in the playground
- GIVEN a player inside an exercise's playground view
- WHEN the view is measured
- THEN the ranking element MUST occupy non-zero screen space

### Requirement: Pseudonym-first identity and privacy
A player's ranking display name MUST default to a player-chosen pseudonym
(`display_name`), and the player's email MUST NOT be rendered anywhere in
ranking, profile, or attempt views.

#### Scenario: Email never appears in ranking UI
- GIVEN a logged-in player with an email address
- WHEN the ranking is rendered
- THEN the email MUST NOT appear in the DOM

### Requirement: Opt-out from the ranking
A player MUST be able to set `is_public = false` and continue playing while
excluded from the ranking view; the setting MUST take effect on the player's
next ranking query.

#### Scenario: Opted-out player is absent from the ranking
- GIVEN a player with `is_public = false` and at least one scored attempt
- WHEN the ranking view is queried
- THEN that player's row MUST NOT appear

### Requirement: Ranking visible to logged-out visitors
The global ranking MUST be readable by visitors without an active session.

#### Scenario: Anonymous visitor sees the ranking
- GIVEN no authenticated session
- WHEN `/forja` is opened
- THEN the ranking view MUST render populated rows, not an empty or
  auth-gated placeholder

### Requirement: Honest local-vs-server labeling
While no server-side re-scoring exists, every ranking display MUST carry a
visible label stating the ranking is client-computed and unverified.

#### Scenario: Ranking discloses its verification status
- GIVEN the current release has no server-side re-scoring
- WHEN the ranking is rendered
- THEN it MUST display text disclosing scores are client-computed and not
  server-verified

### Requirement: Degraded mode when backend is unavailable
When Supabase is unreachable (paused, network failure, missing credentials),
the game MUST remain fully playable and MUST show the ranking as
"unavailable" rather than fail the page or block play.

#### Scenario: Play continues when Supabase is paused
- GIVEN Supabase returns a connection failure for all ranking queries
- WHEN the player opens any La Forja view
- THEN the canvas and exercise flow MUST work normally, and the ranking
  element MUST show an "unavailable" state

### Requirement: Attempts persist the graph, not just the score
Every attempt record MUST store the submitted design graph (`design jsonb`)
alongside the score, so scores can be recomputed honestly once server-side
re-scoring exists.

#### Scenario: Attempt row includes the full graph
- GIVEN a player submits a design and it is scored
- WHEN the resulting `attempts` row is inspected
- THEN it MUST contain the complete graph, not only the numeric score

### Requirement: Row-level security on profiles and attempts
`profiles` MUST allow insert/update only where `auth.uid() = id` and MUST NOT
allow anonymous select. `attempts` MUST allow select/insert only for the
owning `user_id` and MUST NOT be anonymously readable.

#### Scenario: Anonymous client cannot read another player's attempts
- GIVEN an anonymous Supabase client
- WHEN it queries the `attempts` table
- THEN the query MUST return zero rows

### Requirement: Local history does not retroactively score
When a player creates an account, their prior local (unauthenticated)
attempt history MUST be preserved as personal history but MUST NOT be
imported into the scored ranking; only attempts made with an active session
count toward ranking.

#### Scenario: Local attempts remain unranked after signup
- GIVEN a player with local attempts made before creating an account
- WHEN the account is created
- THEN those local attempts MUST remain visible as personal history and MUST
  NOT appear in the player's ranked total

### Requirement: Best-answers gate and structural-diversity curation
Best/reference answers for an exercise MUST NOT be revealed until the
player's first scored submission for that exercise, and the answers shown
MUST be curated for structural diversity rather than by raw score ranking
alone.

#### Scenario: Best answers are hidden before any submission
- GIVEN a player who has not yet submitted a design for an exercise
- WHEN the player views that exercise
- THEN best/reference answers MUST NOT be visible or loadable

#### Scenario: Curation avoids showing near-duplicate topologies
- GIVEN the top three scoring shared designs for an exercise are all
  outbox-based
- WHEN best answers are selected for display
- THEN the shown set MUST include at least one structurally different
  approach (e.g. a durable queue or reconciliation job) rather than three
  outbox variants
