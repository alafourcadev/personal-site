# Design: La Forja — integration into alafourca.dev

> Supersedes the proposal's "vanilla TypeScript playground" recommendation. React Flow, Vitest +
> Playwright, Supabase Free, analytic ceiling, pseudonymous public ranking and level 4
> ("Comunicación entre servicios") as first playable level are **closed decisions** and are treated
> here as inputs, not options.

## Technical Approach

Three layers with one hard boundary between them.

```text
  content (Astro collections, Zod)  ──declares──▶  ENGINE  ◀──queries── UI (React Flow island)
  exercise spec: guarantees,          pure TS,                          presentation + gestures
  budget, difficulty, prereqs         no DOM,
                                      no React
```

The engine is the only artefact that must survive a runtime change (browser today, Supabase Edge
Function tomorrow), so it is written first, tested first, and is forbidden from importing anything
that is not pure TypeScript. That purity is not a style preference — it is what makes two other
things possible: the content schema can run the engine **at build time** (an exercise that cannot be
evaluated does not compile), and the same legality module that gates the score gates the connection
gesture, so there is exactly one implementation of "is this legal".

## Architecture Decisions

### D1 · Domain state is the source of truth; React Flow is derived

| Option | Trade-off | Decision |
|---|---|---|
| Domain model inside React Flow state (`Node.data`) | Fewer moving parts; but `position`, `selected`, `dragging`, `measured`, handle ids leak into persisted attempts, and the future server re-scorer would depend on a React library | Rejected |
| Separate plain-TS store, React Flow projected from it | One projection each way; store is serialisable, framework-free, server-portable | **Chosen** |

Refinement, because the naive version fights the library: **React Flow is authoritative for position
during a gesture.** Structural mutations (add node, connect, delete, edit property) flow store → RF.
Positional changes flow RF → store and are committed only on `onNodeDragStop`, never per frame.
This is safe precisely because the engine never reads `position` — which is itself a test
(§13.8: "no valida estética").

### D2 · Guarantees are a declarative predicate DSL, not functions

An exercise must declare what it demands without the engine knowing the exercise. A JS function in
content is impossible (frontmatter holds data, not code) and would require `eval` plus a second
implementation on the server. So the exercise declares a **serialisable predicate tree** over a
closed combinator vocabulary that the engine compiles into graph queries.

```ts
type NodeQuery = { type?: ComponentType[]; propEquals?: Record<string, string>; role?: RoleId }

type Predicate =
  | { op: 'exists';          node: NodeQuery }
  | { op: 'path';            from: NodeQuery; to: NodeQuery; via?: NodeQuery; forbid?: NodeQuery }
  | { op: 'noVolatileCut';   from: NodeQuery; to: NodeQuery }   // G2 in §14.3, verbatim
  | { op: 'covered';         target: NodeQuery; by: NodeQuery }
  | { op: 'edgeAbsent';      from: NodeQuery; to: NodeQuery }
  | { op: 'ruleSilent';      rule: RuleId }
  | { op: 'all' | 'any' | 'not'; of: Predicate[] }

interface Guarantee {
  id: string; label: string; weight: number
  predicate: Predicate
  whyMissing: string        // the sentence the player reads. Required, non-empty.
  consequence: string       // §13.1: rule, evidence, consequence
}
```

`role` is the indirection that keeps the engine exercise-agnostic: the brief's **given** nodes carry
a semantic role (`purchase-accepted`, `email-provider`); everything the player adds is matched by
type and properties only. `ruleSilent` lets an exercise decide which of the universal §13.7 rules
cost points *in this exercise* without the rule catalog knowing any exercise.

Rejected: graded (0..1) satisfaction in R1. Binary satisfaction makes monotonicity trivially
provable; partial credit can be expressed today as two guarantees with smaller weights.

### D3 · Scoring: the ledger is computed, not narrated

Formula per §14.3, unchanged:

```text
raw   = Σ wᵢ·satᵢ / Σ wᵢ                          ∈ [0,1]
pen   = 1 / (1 + λ · max(0, C(d) − C_budget))     ∈ (0,1]      C(d) = Σ opsUnits
score = 100 · raw · pen                            ceiling = 100 (analytic)
```

**There is no node-count term anywhere.** Extra components cost only through `opsUnits`/money, and
only past the declared budget. That single omission kills defect 1 (adding a guarantee lowered the
score) by construction rather than by tuning.

The feedback invariant `score + Σ findings.costPoints == 100` is made exact, not approximate, by an
explicit loss decomposition:

| Loss source | Points | Attached finding |
|---|---|---|
| Guarantee `i` unsatisfied | `100 · (wᵢ/Σw) · pen` | `guarantee-missing:{id}` with its `whyMissing` |
| Budget overage | `100 · raw · (1 − pen)` | `ops-budget-exceeded` with the arithmetic as evidence |
| Empty design | `100` | `empty-design` — early guard, before any axis is computed |

The two rows sum to `100 − score` exactly in real arithmetic. Rounding is done in integer basis
points with **largest-remainder allocation**, so the invariant survives rounding and is a passing
unit test rather than an aspiration. Non-scored warnings still render, with `costPoints: 0`.

Blocking findings do not produce a low score — they produce **no** score: `{ status: 'illegal',
score: null }` (§14.3 layer a). Best-answer gallery stays sealed until `attempts > 0` (defect 10).

Every node query returns a **set**, never `find`. Defect 9 (duplicating a component broke the
evaluation) cannot be reintroduced; a test duplicates an irrelevant node and asserts the evaluation
is byte-identical.

### D4 · Prototype fusion — what survives

| Source | Kept | Discarded |
|---|---|---|
| `forja-canvas.html` | **All 13 rule implementations** and **their `why` copy verbatim** (lines 337–480), the `CATALOG` record shape, the `ACCEPTS` port table, the reachability walk for `intermittent-client-without-idempotency`, the findings list view | Rendering, module-level mutable globals, band clamping by pixel arithmetic |

> **Rule count, verified 2026-08-04.** The prototype implements all **12** rules of §13.7
> (`trust-zone-jump`, `volatile-durable-mismatch`, `regulated-without-backup`,
> `pii-to-external-model`, `queue-without-dlq`, `orphan-queue`, `sync-chain-depth`,
> `intermittent-client-without-idempotency`, `no-observability-on-critical`,
> `single-point-of-failure`, `ops-budget-exceeded`, `undeclared-data-class`) **plus
> `port-mismatch`** = 13 total. Each was grep-confirmed present in
> `prototipos/forja-canvas.html`. Do not port fewer than 13.
>
> Two known defects to fix while porting, not to carry over: the `n.type === "stream"`
> branch (line 397) is dead code because `stream` is absent from its `CATALOG`, and the
> catalog is missing `business-process`, `external-provider`, `stream`, `cdn` and
> `vector-store` relative to §13.5.
| `forja-app.html` | `diagnose()` copy (§14.6), the three `LEADERS[].why`, the axis-label voice ("Te enterás si falla"), the "seguí donde ibas" card, the icon/colour/port trio | `score()` **entirely** — all five verified defects live in it; the fixed `AXES` set and 35/25/20/20 weights; `nodeOf` (`find`); the ad-hoc `COMPONENTS` map; `NW/NH` constants; the view system that hid the ranking |

Catalog gap closure against §13.5: add `business-process`, `external-provider`, `stream`, `cdn`,
`vector-store`; rename `identity` → `identity-provider`. The `n.type === "stream"` branch at
`forja-canvas.html:397` is dead code **because the type is missing, not because the rule is wrong** —
it is revived by adding the type, not deleted. Guard test: `Object.keys(CATALOG)` equals the §13.5
closed list, and every type owns at least one property read by at least one rule (§13.10 criterion 1,
executable).

### D5 · Island strategy: `client:only="react"`, one island, smallest possible

| Directive | Argument | Verdict |
|---|---|---|
| `client:load` | SSR output of React Flow is discarded — it measures the DOM for node dimensions and viewport — so the server HTML is pure waste plus hydration-mismatch risk | Rejected |
| `client:visible` | The canvas *is* the page; delaying it buys a blank frame and nothing else | Rejected |
| `client:only="react"` | No wasted HTML, no mismatch, explicit about the no-JS consequence | **Chosen** |

The no-JS consequence is paid for, not ignored: the **§13.9 list view is not part of the island.**
`/forja/[level]/[exercise]` server-renders the brief, the level map, the ranking strip and the given
design as an accessible list — all Astro, all in the initial HTML. Only the canvas plus the result
panel hydrate. This is also what makes "result above the fold" (B3) an Astro layout problem instead
of a React one.

Containment is a test, not a promise: `tests/build/no-react-on-existing-routes.test.ts` builds and
asserts that the HTML of the 12 existing routes references no React chunk.

### D6 · Ranking: a port with a local adapter that always wins the write

Supabase Free pauses after 7 days idle, so unavailability is the **normal** case, not the failure
case.

```ts
interface RankingPort {
  submit(attempt: Attempt): Promise<SyncState>
  leaderboard(): Promise<{ rows: LeaderboardRow[]; source: 'global' | 'local' }>
}
```

`LocalRankingAdapter` (localStorage) is unconditional and synchronous; `SupabaseRankingAdapter` is
constructed only when both env vars are present, and every remote call has a 3 s timeout. Unsynced
attempt ids sit in a local outbox — the same pattern the game teaches. R1 ships the local adapter
alone, so R3 is purely additive.

### D7 · Environment through `astro:env`, not `import.meta.env`

`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` and `PUBLIC_FORJA_ENABLED` are declared in
`astro.config.mjs` as `envField.string({ context: 'client', access: 'public', optional: true })`.
Optionality is what makes "R1 builds and plays with zero credentials" a schema property instead of a
convention, and it is typed, so a missing variable is a build error rather than `undefined` at
runtime. No new dependency. **No secret is ever committed; the anon key is public by design and is
only safe because RLS is (see Trust Boundaries).**

### D8 · i18n: a missing translation must be a compile error

Three mechanisms, each aimed at a verified prototype defect:

1. **No user-facing literal in code.** All UI copy in `src/lib/forja/i18n/{es,en}.ts`; `en` is typed
   `Record<keyof typeof es, string>`, so the `RANKS`-only-in-Spanish class of bug becomes an
   `astro check` failure.
2. **No forced locale.** `toLocaleString("es")` is banned; `fmt.number/date` bind the active locale.
   A source-grep test forbids `toLocaleString(` with a literal argument under `src/**/forja/**`.
3. **Copy is split from the evaluable spec.** `src/content/forja/exercises/<id>.md` holds the
   locale-independent evaluable data (guarantees, predicates, budget, difficulty); prose lives in
   `src/content/forja/copy/{es,en}/<id>.md`. The graph cannot diverge between locales because there
   is only one. A test asserts every `PUBLISHED` exercise has copy in every supported locale.

`aria-label`s are composed from the dictionary plus node data
(`{label}, {type}, zona {zone}, {state}`), never fixed strings — this is simultaneously the fix for
the fixed zoom labels and for §13.9's "accessible name with type, zone and state".

`BaseLayout` hardcodes `lang="es"` and is **not** given a fourth prop: the Forja root element
carries `lang={locale}`, which is valid HTML and honoured by assistive technology. One less shared
touchpoint.

### D9 · Admission gates: per-entry in Zod, cross-entry in Vitest

Zod validates one entry at a time, so the 14 gates split by what they can see:

| Gate class | Where | Failure mode |
|---|---|---|
| Two reference solutions with no blocking findings; budget reachable; every guarantee has `whyMissing` + `consequence`; constraints executable (`{metric, operator, value, unit}`, never prose); every hidden fact has a discovery path; `aiBudget` declared; difficulty index inside `[2+2(N−1), 10+2(N−1)]`; no axis above its level ceiling; `D9 ≥ 1`; prerequisites ≤ N | `content.config.ts` `superRefine` — **imports the engine and runs it** | `npm run build` fails |
| Tradeoff pairs are symmetric and their `contextInversion` actually inverts; role quotas per level (≥1 calibration, ≥4 core, ≥1 tradeoff pair, ≥1 trap + counter-trap, ≥1 synthesis for beta); prerequisite graph is acyclic; copy exists in every locale | `tests/content/*.test.ts` | `npm test` fails |

"No brand is rewarded" is N/A by construction: predicates can only reference closed-catalog types,
which carry no brand names.

Unlocking is by **role**, not count: `forjaLevels` declares `unlockRequires` as a role quota, killing
the `done ≥ ceil(total/2)` shortcut at `forja-app.html:823`.

## Data Flow

### Evaluation pipeline

```text
Design (nodes, edges)                Exercise spec (content)
        │                                     │
        ▼                                     ▼
  ┌───────────────┐  illegal   ┌──────────────────────────────┐
  │ (a) LEGALITY  │──────────▶ │ status: illegal · score: null │
  │ bands · zones │            │ blocking findings only        │
  │ ports · block │            └──────────────────────────────┘
  └───────┬───────┘
          │ legal
          ▼
  ┌───────────────┐     ┌──────────────┐     ┌───────────────────┐
  │ (b) GUARANTEES│────▶│ (c) COST     │────▶│ LEDGER            │
  │ predicates→sat│ raw │ Σ opsUnits   │ pen │ largest-remainder │
  └───────────────┘     │ vs budget    │     │ score + Σ costPts │
                        └──────────────┘     │      == 100       │
                                             └─────────┬─────────┘
                                                       ▼
                                      findings[] → highlight nodeIds / edgeIds
```

### Connection gesture (why the separation pays)

```text
player drags handle A ──▶ React Flow isValidConnection(conn)
                                │
                                ├─ project handles → engine.checkConnection(design, from, to)
                                │        (same module the scorer gates on)
                                │
                    ok ─────────┴───────── refused
                     │                        │
          store.connect(edge)        aria-live: "{why} — {consequence}"
                     │                (never colour alone, §13.9)
                     ▼
          store.notify() → RF re-projects → engine.evaluate() (debounced)
```

### Submit and degraded ranking

```text
[Probar respuesta] ──▶ engine.evaluate() ──▶ result panel (tab switches to "Resultado")
                                │
                                ▼
                    LocalRankingAdapter.submit()   ← synchronous, always succeeds
                                │
                                ▼
                    SupabaseRankingAdapter.submit()  (only if env vars present)
                       │                    │
                   ok  │                    │ timeout 3 s / 4xx / 5xx / paused project
                       ▼                    ▼
              strip: "global"        strip: "local — el ranking global no está disponible"
                                     attempt id → local outbox, retried on next submit
```

The strip has a non-zero box in **every** state and every view (B1). It is rendered by Astro in the
page shell, outside the island.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/forja/engine/{types,catalog,legality,rules,predicates,cost,score,index}.ts` | Create | Pure engine. No DOM, no React, no Astro imports |
| `src/lib/forja/store/forja-store.ts` | Create | Plain-TS domain store + subscribe |
| `src/lib/forja/ranking/{port,local-adapter,supabase-adapter}.ts` | Create | `RankingPort` + adapters |
| `src/lib/forja/i18n/{index,es,en}.ts` | Create | Typed dictionary + locale-bound formatters |
| `src/components/forja/canvas/{ForjaCanvas,ForjaNode,ForjaEdge,BandLane,Inspector,ResultPanel}.tsx` | Create | The single island and its parts |
| `src/components/forja/{RankingStrip,ExerciseBrief,DesignList}.astro` | Create | Server-rendered shell, list view (§13.9) |
| `src/pages/forja/index.astro`, `src/pages/forja/[level]/index.astro`, `src/pages/forja/[level]/[exercise].astro` | Create | New route tree only |
| `src/content/forja/{levels,exercises,copy}/**` | Create | Content collections |
| `src/content.config.ts` | Modify (additive) | Register 3 collections; `blog` untouched |
| `src/layouts/BaseLayout.astro` | Modify (additive, ~4 lines) | `noindex?: boolean = false` + conditional robots meta |
| `astro.config.mjs` | Modify (additive, 3 independent edits) | `react()` integration · sitemap `filter` excluding `/forja` · `env.schema` |
| `package.json` | Modify | Scripts + dependencies |
| `vitest.config.ts`, `playwright.config.ts` | Create | Test harness |
| `supabase/migrations/0001_forja.sql` | Create (R3) | Tables, views, RLS |
| `tests/**` | Create | See Testing Strategy |

**Delta from the proposal, stated openly:** `astro.config.mjs` receives three additive edits, not
one. Each is independently revertible; none affects an existing route's output.

## Interfaces / Contracts

```ts
// engine/types.ts — position is present, and the engine never reads it.
interface DesignNode {
  id: NodeId; type: ComponentType; label: string; zone: Zone
  role?: RoleId                       // only on brief-given nodes
  props: Readonly<Record<string, string>>
  position: { x: number; y: number }  // presentation-only, asserted by test
  given?: true                        // brief-provided, not deletable
}
interface DesignEdge {
  id: EdgeId
  from: { node: NodeId; port: PortId }
  to:   { node: NodeId; port: PortId }
  protocol: Protocol; sync: boolean; dataClass?: DataClass
}
interface Design { nodes: DesignNode[]; edges: DesignEdge[] }

interface Finding {
  id: string; rule: RuleId | `guarantee-missing:${string}`
  severity: 'blocking' | 'warning' | 'note'
  title: string; evidence: string; why: string; consequence: string
  costPoints: number                  // 0 for non-scored advice
  nodeIds: NodeId[]; edgeIds: EdgeId[]
}
interface Evaluation {
  status: 'illegal' | 'scored'
  score: number | null; ceiling: 100
  guarantees: { id: string; satisfied: boolean; weight: number }[]
  cost: { opsUnits: number; monthlyUsd: number; budget: Budget; overage: number }
  findings: Finding[]
  engineVersion: string
}

export function evaluate(design: Design, exercise: ExerciseSpec): Evaluation
export function checkConnection(d: Design, from: EndPoint, to: EndPoint): ConnectionVerdict
export const ENGINE_VERSION: string
```

### Supabase schema (R3)

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name citext unique not null,        -- player-chosen pseudonym
  locale text not null default 'es',
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  exercise_id text not null,
  design jsonb not null,                      -- the graph, never the score alone
  score int, ceiling int not null, legal boolean not null,
  engine_version text not null,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;
alter table attempts enable row level security;
-- own rows only; anon gets nothing from base tables
create policy p_own_profile on profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy p_own_attempt on attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`leaderboard` and `exercise_best` are **definer-rights views** (`security_invoker` left off), owned by
a privileged role, exposing only `display_name`, aggregates and — for `exercise_best` — designs that
are both `is_shared` and `legal`. `grant select` to `anon` on the views only. This is the
load-bearing security decision: the anon key is safe **only** because the base tables deny anon and
the views are the sole read surface. It gets a dedicated test.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (Vitest, `environment: 'node'`) | One test per §13.7 rule (12+); predicate combinators; port/zone/band legality; cost cliff at and past the budget; largest-remainder allocation | Pure function calls on hand-built graphs |
| Invariants (Vitest, property-style with a seeded generator) | Monotonicity (`G(d′) ≥ G(d)` ∧ `C(d′) ≤ budget` ⟹ `score(d′) ≥ score(d)`); `score + Σ costPoints === 100`; position-independence; duplicate-node stability; empty canvas ⟹ 0 with an explicit finding | Enumerate small design spaces, assert over all pairs |
| §13.10 | For every published exercise, its two reference solutions are both legal and both score 100 | Generated from the exercise's own `referenceSolutions`; doubles as the "≥2 witnesses" publication gate |
| Content (Vitest) | Cross-entry gates from D9; contrast ratios of the light-theme tokens computed as a pure function (no axe dependency) | Load the collection, assert |
| Purity (Vitest) | `src/lib/forja/engine/**` contains no `document`, `window`, `@xyflow`, or `astro:` import | Source scan |
| Build (Vitest) | The 12 existing routes' `dist` HTML references no React chunk | Post-build assertion |
| E2E (Playwright, real pointer) | **Delete a connection** (B4 — the bug synthetic events could not see); node stays inside its band and drag-out is refused; illegal connection announced with its why; at 1280×800 every brief node is reachable via fit/pan (B2); score visible without scrolling after submit (B3); ranking strip non-zero in every view (B1); full keyboard build — create, connect, move, delete | `page.mouse.*` / `dragTo`, never `dispatchEvent` |

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

`vitest.config.ts` wraps Astro's `getViteConfig()` so `@/*` and `astro:content` resolve without a
second config. `playwright.config.ts` uses `webServer: 'npm run build && npm run preview'` — not
`dev` — because the island boundary and the bundle guard only exist in the real output.
`openspec/config.yaml` `rules.apply.test_command` and `rules.verify.test_command` must be set to
`npm test` in R1-A; they are empty today and `strict_tdd: true` blocks apply until they are.

### New dependencies — each justified

| Dependency | Kind | Why it earns its place | What it replaces |
|---|---|---|---|
| `@xyflow/react` | runtime, `/forja` only | Documented keyboard navigation and ARIA on real DOM+SVG (§13.9 is non-negotiable and `litegraph.js` renders to `<canvas>`, where there is nothing to hang ARIA on); gives pan, real `fitView`, edge selection and edge deletion — the direct structural fixes for B2 and B4 | ~600 lines of hand-written gesture, viewport and focus code, and the accessibility work R2 would otherwise own entirely |
| `react`, `react-dom` | runtime, `/forja` only | Peer requirement of the above; the island is the only consumer | — |
| `@astrojs/react` | build | Compiles the island. Ships nothing to pages without one | — |
| `vitest` | dev | Astro's documented pairing; `getViteConfig()` reuses the real resolution | A second, divergent build config |
| `@playwright/test` | dev | The only tool that reproduces the B4 class of bug | Nothing — `dispatchEvent` provably misses it |
| `@supabase/supabase-js` (R3) | runtime | Auth + PostgREST client | Hand-rolled fetch + token refresh |

`@axe-core/playwright` was considered and **rejected**: the only accessibility check that needs
numbers is contrast, which is a pure computation over the token table and belongs in Vitest.

Monthly cost of the entire set: 0.

## Trust Boundaries

The `references/threat-matrix.md` matrix covers shell, git, commit/push state and PR command
composition. **N/A — this change introduces no shell command, no subprocess, no VCS or PR
automation, and no executable-file classification.** The route added is a static page, not a request
router. The boundaries this change *does* introduce are different in kind and are handled above:

| Boundary | Response |
|---|---|
| Public anon key against a public database | RLS denies anon on both base tables; definer-rights views are the only read surface; dedicated test asserts an anon `select` on `attempts` returns nothing |
| Client-computed score is falsifiable | Store the **graph**, not the score; `engine_version` stamped; the UI says so in words. Server re-scoring is deferred, not forgotten, and needs no data migration |
| Untrusted design JSON loaded from localStorage or the DB | Parsed through the same Zod schema as content before it ever reaches the engine; unknown node types are rejected, not rendered |
| PII | Email never leaves `auth.users` and is never rendered; `display_name` is a player-chosen pseudonym; `is_public = false` removes the row from the view |

## Migration / Rollout

No data migration. Rollout is the proposal's slice chain, with two design-driven changes:

- **R1-A grows** (~120 → ~200 lines): it now installs and wires `@astrojs/react` plus the React Flow
  runtime, and sets the two empty `test_command` fields in `openspec/config.yaml`.
- **R1-D shrinks**: pan, `fitView`, edge selection, edge deletion and undo come from the library, so
  the slice is custom nodes/edges, band lanes and the projection, not a gesture engine.

Containment is unchanged: `/forja` unlinked, `noindex`, excluded from the sitemap;
`PUBLIC_FORJA_ENABLED=false` renders a placeholder without a code revert; the three shared
touchpoints revert independently.

## Open Questions

- [ ] **Local progress when accounts arrive** (proposal question 5, still unanswered). Merging
      imports client-computed scores that were never verified. Recommendation: import the **designs**
      and re-score them under the current `engine_version` at merge time; never import a score.
      Blocks R3 design detail only, not R1.
- [ ] **λ and the budget for level 4.** The formula is fixed; the constant is a per-exercise field
      with a default that has to be calibrated against the 11 relocated exercises. Needs one play
      session, not a decision.
- [ ] **Exact versions** of `@xyflow/react`, `react`, `@astrojs/react` and `vitest` against Astro
      6.1.9. Resolved at install in R1-A with the same gate discipline the proposal applied to
      Vitest — no network in this phase.
- [ ] **Byte-identical guard for the 12 existing routes.** A committed hash baseline of their `dist`
      HTML is the honest check but is brittle against unrelated content edits. Proposed as an
      opt-in guard, not a blocking gate.
