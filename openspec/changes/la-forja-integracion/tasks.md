# Tasks: La Forja — integration into alafourca.dev

Traceability legend: `EE`=forja-evaluation-engine, `PC`=forja-playground-canvas,
`EC`=forja-exercise-content, `PR`=forja-progression, `RK`=forja-ranking
(numbers follow each spec's requirement order, top to bottom).

## Conflict resolutions (orchestrator, 2026-08-04) — BINDING

**C1 → implement 13 rules. The spec text is stale; update it.**
`port-mismatch` is a legitimate rule, not an extra. §13.6 of doc 13 says a mobile client
wired straight to a database *"no es una decisión discutible, es un error de forma"* — a
structural error is a rule by definition. §13.7 also calls itself a *"Catálogo inicial"*,
so its list of 12 was never exhaustive. All 13 were grep-verified present in the prototype.
Action: implement 13; amend the `forja-evaluation-engine` spec text from "twelve" to
"thirteen" and add `port-mismatch` to its enumeration as part of R1-B.

**C2 → the beta floor is 8. The admission gate must be state-aware.**
The design collapsed two different gates into one. Doc 14 §14.4 separates them explicitly:
beta publishable = **8** (1 calibration + 4 core + 1 tradeoff pair + 1 synthesis);
level complete = **14** (adds 2 core, a second tradeoff pair, trap + counter-trap, and a
second synthesis). Trap and counter-trap are required for **complete**, never for **beta** —
the reason the beta floor is 8 and not lower is that below 8 a contrasted tradeoff pair does
not fit, and without a contrasted pair a level teaches recall instead of judgement. That
argument does not extend to traps.
Action: split the cross-entry Vitest gate into `assertBetaComposition` (8) and
`assertCompleteComposition` (14). Only a level passing the second grants the level badge.

**C3 → the spec wins. Local history never enters the scored ranking.**
Decided by the owner on 2026-08-04: local history is preserved as personal history and is
visible to the player, but contributes zero ranking points. The design's counter-proposal
(import the designs and re-score at merge time) does not solve the problem it claims to,
because server-side re-scoring is deferred out of R1–R3 — a re-score would still be computed
in the browser and would still be unverified. Importing it would launder unverified scores
into the ranking.
Action: implement the spec's unconditional MUST NOT. Revisit only once server-side
re-scoring exists, and treat that as a new change, not an amendment.

**Gaps G1–G6 → all become tasks, none are waived.** G5 (player rank and XP absent from the
design's data model) is the most consequential: doc 14 §14.4 established that the content
level and the player's rank are two different counters, and that rank comes from competency
coverage per §6.2, not from finishing levels. R1 needs local XP and rank at minimum; the
persisted version is R3.

---

## Conflicts spec ↔ design (as found by the tasks phase — resolutions above are binding)

**C1 — Rule count, 12 vs 13.** Spec `forja-evaluation-engine`, *"Twelve
validation rules with severities"*: enumerates exactly 12 named rules, no
`port-mismatch`. Design D4 (already-corrected, 2026-08-04 grep-verified):
*"the prototype implements all 12 rules of §13.7 ... plus `port-mismatch` =
13 total ... Do not port fewer than 13."* The spec's binding requirement text
still says twelve. Tasks below implement **13** per the design correction,
but the spec text needs an update or an explicit waiver before `sdd-apply`
freezes scope.

**C2 — Beta level composition, 8 vs ≥10 exercises.** Spec
`forja-progression`, *"Beta level composition"*: floor = 1 calibration + 4
core + 1 tradeoff pair (2 exercises) + 1 synthesis = **8**, no trap/
counter-trap in that MUST. Design D9 cross-entry Vitest gate: *"role quotas
per level (≥1 calibration, ≥4 core, ≥1 tradeoff pair, **≥1 trap + counter-
trap**, ≥1 synthesis for beta)"* — pushes the effective floor to **10**. The
design's own gate would reject content that satisfies the spec's literal
8-exercise floor. Progression spec's separate *"Unlock by role"* requirement
does list trap/counter-trap as a role, but never ties it to the numeric beta
floor.

**C3 — Local history on account creation.** Spec `forja-ranking`, *"Local
history does not retroactively score"*: unconditional MUST — prior local
attempts *"MUST NOT be imported into the scored ranking."* Design's Open
Questions leaves this explicitly unresolved and recommends the opposite:
*"import the designs and re-score them under the current `engine_version` at
merge time; never import a score."* Re-scoring and injecting those designs
into the ranked total contradicts the spec's MUST NOT. Blocks R3 detail only,
not R1 — but must be resolved before R3 tasks start.

### Gaps (spec requirement with no design mechanism — not contradictions)

- **G1** `PC8` empty-canvas UI state — design covers only the engine's
  empty-*score* guard (EE9), never a canvas empty-state component.
- **G2** `PC9` cancelable gestures / Escape-restores-label — unmentioned.
- **G3** `PC14` optional auto-layout — unmentioned anywhere in design.
- **G4** `EC6` publication state machine — no design decision names which
  component filters non-`PILOT`/`PUBLISHED` exercises from the playable list.
- **G5** `PR3` content level decoupled from player rank (XP) — the `profiles`
  table in design's Supabase schema has no rank/XP field at all; no rank
  computation is designed anywhere.
- **G6** `RK10` structural-diversity curation for best answers — design only
  gates *when* `exercise_best` is visible, not *how* diverse designs are
  chosen over raw top-score.
- Note (not a gap): `EC7` "rubric dimension with observable signal" maps to
  design's guarantee `predicate` + `whyMissing`, different vocabulary, same
  mechanism — flagged for terminology alignment, not blocking.

No other requirement of the 5 spec files is uncovered by the design.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~2,010 total for R1 (chained), ~300/level for R2, ~380 for R3 |
| 400-line budget risk | High |
| Chained PRs recommended | No — see Chain strategy note |
| Suggested split | R1-A → R1-B → R1-C → R1-D1 → R1-D2 → R1-E → R1-F → (R2 per level) → R3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High

**Chain strategy note (explicit orchestrator override):** no PRs are opened.
Every slice is one local commit on `feat/la-forja`; the owner reviews by
running the app, not a diff. The 400-line/slice discipline still governs each
commit's size — `R1-D` is split into `R1-D1`/`R1-D2` to stay under budget,
since design confirms it "shrinks" from library gestures but the spike, band
clamp, empty state and 8 Playwright blocker tests add it back.

### Suggested Work Units

| Unit | Goal | Est. lines | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| R1-A | Test harness + config gate | ~200 | `npm test` | `npm run build` | revert `vitest.config.ts`, `playwright.config.ts`, package.json scripts |
| R1-B | Engine legality, 13 rules | ~400 | `npm test -- rules` | N/A (pure module) | delete `src/lib/forja/engine/{legality,rules,catalog}.ts` |
| R1-C | Engine scoring + invariants | ~350 | `npm test -- score` | N/A (pure module) | delete `src/lib/forja/engine/{predicates,cost,score}.ts` |
| R1-D1 | Canvas core gestures | ~250 | `npm run test:e2e -- gestures` | `npm run dev`, click at `/forja` | remove `ForjaCanvas.tsx` gesture handlers |
| R1-D2 | Bands, spike decision, pan/fit, empty state | ~200 | `npm run test:e2e -- canvas` | `npm run dev` at 1280px | revert `BandLane.tsx`, fit/empty-state code |
| R1-E | Result panel + local ranking | ~330 | `npm run test:e2e -- result` | `npm run dev`, submit a design | remove `ResultPanel.tsx`, `RankingStrip.astro`, `local-adapter.ts` |
| R1-F | Level 4 content + admission gates | ~300 | `npm test -- content` | `npm run build` | remove `src/content/forja/**`, unregister collection |
| R2 (×N) | §13.9 remainder, contrast, per-level content | ~300 each | `npm test && npm run test:e2e` | `npm run dev` | per-level content removal is independent |
| R3 | Supabase accounts + RLS + degraded mode | ~380 | `npm test -- ranking` | manual: pause/unreachable Supabase | revert `supabase/migrations/0001_forja.sql`, adapters |

## R1-A — Test harness (blocks `strict_tdd`)

- [x] A.1 Run `npm info vitest peerDependencies` + `npm ls vite`; confirm a
      single Vite 7.3.2 instance satisfies the range (design's install gate).
- [x] A.2 Install `vitest`, `@playwright/test` (dev). **Scope note (orchestrator,
      2026-08-04):** `@astrojs/react`, `react`, `react-dom`, `@xyflow/react` are
      explicitly OUT of R1-A scope and deferred to R1-D — this slice is the test
      harness only, not the island runtime.
- [x] A.3 Create `vitest.config.ts` wrapping Astro `getViteConfig()`.
- [x] A.4 Create `playwright.config.ts`, `webServer: npm run build && npm run preview`.
- [x] A.5 Add `test`, `test:watch`, `test:e2e`, `test:e2e:ui` to `package.json`.
- [x] A.6 Set `rules.apply.test_command` and `rules.verify.test_command` to
      `npm test` in `openspec/config.yaml` (unblocks apply per config gap).
- [x] A.7 RED: `tests/engine/smoke.test.ts` asserts `ENGINE_VERSION` export exists.
- [x] A.8 GREEN: `src/lib/forja/engine/index.ts` stub exporting `ENGINE_VERSION`.
- [x] A.9 Verify `npm run build` stays green with new deps installed but unused.
- [x] A.10 Commit: `feat(forja): add test harness and unblock strict TDD gate`.

## R1-B — Engine legality [EE1, EE2, EE3(C1), EE9]

> **Apply Progress Update (2026-08-04):** R1-B is COMPLETE — all 11 tasks
> (B.1–B.11) marked `[x]`. Split into two commits to stay under the 400-line
> review budget (the ~400 forecast was for the whole slice, and the actual
> port came to ~675 authored lines once the 13-rule port and its 14 test
> cases were written out): `abd4f51` "feat(forja): engine legality
> foundation — catalog, zones, ports" (277 lines: types.ts, catalog.ts,
> legality.ts, rules.ts skeleton, purity/catalog/legality tests) and
> `2bd2f4a` "feat(forja): port the 13-rule legality engine and
> empty-canvas guard" (398 lines: full rules.ts, index.ts's
> `evaluateLegality`, rules.test.ts with 14 cases, empty-canvas.test.ts).
> `npm test` passes 27/27 across 6 files; `npm run build` stays green (50
> pages); `tsc --noEmit` is clean. Spec `forja-evaluation-engine` amended
> from "twelve" to "thirteen" rules incl. `port-mismatch` per C1, in the
> docs commit (not the code commits). Full evidence in Engram
> `sdd/la-forja-integracion/apply-progress`. Next: R1-C (engine scoring).

- [x] B.1 RED: `tests/engine/purity.test.ts` — source scan, no `document`/
      `window`/`@xyflow`/`astro:` import under `src/lib/forja/engine/**`.
- [x] B.2 GREEN: engine module skeleton with zero DOM imports.
- [x] B.3 RED: `tests/engine/catalog.test.ts` — `Object.keys(CATALOG)` equals
      §13.5 closed list incl. `business-process`, `external-provider`,
      `stream`, `cdn`, `vector-store`, `identity-provider`; every type owns
      ≥1 property read by ≥1 rule.
- [x] B.4 GREEN: `catalog.ts` closing the gap (D4).
- [x] B.5 RED: `tests/engine/legality.test.ts` — band/zone/`trust-zone-jump`,
      port-compatibility (`ACCEPTS` table) legality gate.
- [x] B.6 GREEN: `legality.ts`.
- [x] B.7 RED: one Vitest case per rule (13 cases, per C1) in
      `tests/engine/rules.test.ts` — each asserts severity
      (`blocking|warning|note`) and legality gating.
- [x] B.8 GREEN: `rules.ts` porting all 13 rule bodies + verbatim `why` copy
      from `forja-canvas.html`; revive the `stream` branch via the catalog
      fix (D4), not by deleting it.
- [x] B.9 RED: `tests/engine/empty-canvas.test.ts` — zero nodes/edges scores 0.
- [x] B.10 GREEN: empty-design early guard in the evaluation pipeline.
- [x] B.11 Commit: `feat(forja): port 13-rule legality engine`. **Scope note:**
      delivered as two commits (`abd4f51`, `2bd2f4a`) per the 400-line-per-slice
      discipline; see Apply Progress Update above.

## R1-C — Engine scoring [EE4–EE8, EE10, EE11 + risk item]

- [ ] C.1 RED: `tests/engine/predicates.test.ts` — two structurally distinct
      legal designs both satisfy `G2` (outbox vs. durable queue).
- [ ] C.2 GREEN: `predicates.ts`, DSL → graph queries, `set` never `find`
      (defect-9 regression coverage).
- [ ] C.3 RED: `tests/engine/cost.test.ts` — under-budget no penalty;
      over-budget monotonic `eficiencia` decrease.
- [ ] C.4 GREEN: `cost.ts`.
- [ ] C.5 RED: `tests/engine/ceiling.test.ts` — two distinct legal designs
      both score exactly 100 (also doubles as EE10 §13.10 publication test).
- [ ] C.6 GREEN: `score.ts`, analytic ceiling.
- [ ] C.7 RED: `tests/engine/monotonicity.test.ts` — seeded small design-space
      enumeration, `G(d')≥G(d) ∧ C(d')≤budget ⟹ score(d')≥score(d)`.
- [ ] C.8 Verify EE7 already holds by D3 construction (no node-count term);
      no new production code expected — task is proof, not implementation.
- [ ] C.9 RED: `tests/engine/ledger.test.ts` — `score + Σ costPoints == 100`
      exactly, largest-remainder rounding.
- [ ] C.10 GREEN: ledger allocation in `score.ts`.
- [ ] C.11 RED: `tests/engine/no-mutation.test.ts` — `evaluate()` does not
      alter the input `Design` object (EE11).
- [ ] C.12 Verify: confirm immutability by construction; no code change
      expected unless C.11 fails.
- [ ] C.13 Wire `evaluate()` / `checkConnection()` exports per the Interfaces
      contract in `engine/index.ts`.
- [ ] C.14 **Risk task (design/build coupling):** after C.13, run
      `npm run build` with the engine wired but *before* `content.config.ts`
      imports it (R1-F). Confirm build stays green with the engine present
      but unused, so R1-F's later coupling failure is attributable to content
      admission, not an engine regression. Document the revert path
      (unregister the `superRefine` import) in the R1-F commit message.
- [ ] C.15 Commit: `feat(forja): engine scoring, invariants, ledger`.

## R1-D1 — Canvas core gestures [PC1–PC6, PC10–PC13] · *value-first, not the checkpoint yet*

- [ ] D1.1 RED (Playwright): create node by pointer and by keyboard, focus
      moves to the new node [PC1].
- [ ] D1.2 GREEN: `ForjaCanvas.tsx` node creation wired to the store.
- [ ] D1.3 RED (Playwright): move a focused/selected node with arrow keys [PC2].
- [ ] D1.4 GREEN: keyboard move handler.
- [ ] D1.5 RED (Playwright): connect by pointer drag and by keyboard
      command; illegal connection announced via `aria-live`, never color
      alone [PC3, PC12].
- [ ] D1.6 GREEN: `isValidConnection` → `engine.checkConnection` wiring per
      the connection-gesture diagram.
- [ ] D1.7 RED (Playwright, real pointer — **B4 blocker, PC4**): click an
      existing connection, confirm delete; count decreases by one and it
      does **not** reappear on next render.
- [ ] D1.8 GREEN: edge deletion (React Flow edge selection + delete).
- [ ] D1.9 RED (Playwright): delete a keyboard-selected node removes its
      connections too [PC5].
- [ ] D1.10 GREEN: node deletion handler.
- [ ] D1.11 RED (Playwright): undo restores a deleted connection between the
      same two ports [PC6].
- [ ] D1.12 GREEN: undo wiring (store history).
- [ ] D1.13 RED: accessible name includes label, type, zone, state [PC13];
      `DesignList.astro` shows the same findings as the canvas [PC10].
- [ ] D1.14 GREEN: `aria-label` composition (D8) + `DesignList.astro`.
- [ ] D1.15 RED (Playwright): full keyboard build (create, connect, move,
      delete) matches an equivalent pointer-built design [PC11].
- [ ] D1.16 GREEN: close any remaining keyboard gaps found by D1.15.
- [ ] D1.17 Commit: `feat(forja): canvas core gestures`.

## R1-D2 — Bands, spike, pan/fit, empty state [PC7, PC8(G1)] · **🔴 HUMAN VERIFICATION POINT**

> Owner's literal request: *"una vez que todo esté bien quiero que se agregue
> a mi blog para yo ir haciendo pruebas."* After this slice, `/forja` is
> openable in `npm run dev` and clickable end to end. This is the first
> point where Alejandro should actually play.

- [ ] D2.1 **Spike (unverified design risk, item 8):** prototype React Flow
      group nodes with `extent: 'parent'` for band containment in a
      throwaway component; timebox to one session. If a node can be dragged
      out of its band under a real pointer (extent doesn't hold), fall back
      to **manual clamping in `onNodesChange`**: compute each band's x/y
      bounds and clamp the node's position on every change event. Record the
      chosen approach in a one-paragraph note before continuing.
- [ ] D2.2 GREEN: apply the spike's chosen mechanism to all bands in
      `BandLane.tsx`.
- [ ] D2.3 RED (Playwright, real pointer — **B2 blocker, PC7**): at 1280px
      width, a design whose rightmost node is off-screen — fit-to-content
      makes it fully visible without manual panning.
- [ ] D2.4 GREEN: `fitView` wiring computing the bounding box of all nodes.
- [ ] D2.5 RED: empty canvas (zero nodes) renders a visible guidance
      message, not a bare grid [PC8 — closes G1].
- [ ] D2.6 GREEN: empty-state component.
- [ ] D2.7 GREEN: `tests/build/no-react-on-existing-routes.test.ts` — the 12
      existing routes' `dist` HTML references no React chunk (D5 containment
      test, run against `npm run build` output).
- [ ] D2.8 Manual verification: `npm run dev`, open `/forja`, build and play
      one exercise end to end. **Owner confirms before continuing to R1-E.**
- [ ] D2.9 Commit: `feat(forja): band containment, real fit, empty state`.

## R1-E — Result panel + local ranking [RK1, RK5, RK7 + B3 blocker]

- [ ] E.1 RED (Playwright — **B3 blocker**): after submit, the score is
      visible without scrolling at a standard viewport.
- [ ] E.2 GREEN: `ResultPanel` layout as an Astro layout concern (D5), tab
      switches to "Resultado".
- [ ] E.3 RED (Playwright — **B1 blocker, RK1**): ranking strip has non-zero
      screen space in every view (map, level, playground, results).
- [ ] E.4 GREEN: `RankingStrip.astro` rendered in the page shell, outside
      the island.
- [ ] E.5 RED: findings highlight the correct `nodeIds`/`edgeIds` on canvas.
- [ ] E.6 GREEN: wire `findings` → canvas highlight.
- [ ] E.7 RED: `LocalRankingAdapter.submit()` stores the attempt as a
      **graph** (not just score) in `localStorage`, synchronously [RK7].
- [ ] E.8 GREEN: `port.ts`, `local-adapter.ts`.
- [ ] E.9 GREEN: ranking strip labelled "local" honestly [RK5] — full label
      text finalized in R3 once a global source exists.
- [ ] E.10 Commit: `feat(forja): result panel and local ranking`.

## R1-F — Level 4 content + admission gates [EC1–EC7, PR1, PR2, PR5, C2 pending]

- [ ] F.1 RED: exercise missing `D3` fails schema validation [EC1].
- [ ] F.2 GREEN: Zod schema in `content.config.ts`, registers `forja`
      collections additively; `blog` untouched.
- [ ] F.3 RED: level-4 exercise with index 22 (band 8–16) rejected [EC2];
      axis over its level ceiling rejected [EC3].
- [ ] F.4 GREEN: `superRefine` admission gates — **this is the coupling
      point flagged in C.14: run `npm run build` immediately after wiring
      and confirm any failure is a legitimate content rejection.**
- [ ] F.5 RED: prerequisite level greater than own level rejected [EC4].
- [ ] F.6 GREEN: prerequisite gate.
- [ ] F.7 RED: single-reference-solution exercise fails validation [EC5];
      §13.10 test generated from `referenceSolutions`, both score 100 [EE10].
- [ ] F.8 GREEN: two-reference-solution + `contextInversion` gate.
- [ ] F.9 RED: `DRAFT` exercise absent from the playable level list [EC6 —
      closes G4]; rubric dimension without a linked predicate/metric
      rejected [EC7].
- [ ] F.10 GREEN: status filter in the level/exercise route query + rubric
      gate.
- [ ] F.11 Author level 4 content (*"Comunicación entre servicios"*, first
      playable per PR5), including *"El pago que espera al email"* as a core
      exercise. **Use the spec's literal 8-exercise floor (1/4/1-pair/1)
      unless C2 is resolved to require trap+counter-trap** — do not silently
      pick a number.
- [ ] F.12 RED: passing only core exercises does not unlock the next level
      [PR2]; locked level states its missing prerequisite [PR1].
- [ ] F.13 GREEN: role-quota unlock logic (`unlockRequires`), not a count.
- [ ] F.14 RED: level 4 is the first level with playable exercises on a new
      player's level map [PR5].
- [ ] F.15 Commit: `feat(forja): level 4 content and admission gates`.

## R2 — §13.9 remainder, contrast, per-level content [PC9(G2), PC14(G3)]

- [ ] R2.1 RED: Escape during rename restores the original label, no commit
      or discard of underlying data [PC9 — closes G2].
- [ ] R2.2 GREEN: cancelable-gesture handling for rename/drag/connect.
- [ ] R2.3 RED: auto-layout runs only on explicit player invocation, never
      automatically, positions unchanged by any other action [PC14 — closes
      G3].
- [ ] R2.4 GREEN: player-triggered auto-layout action.
- [ ] R2.5 RED: light-theme contrast ratios (arrows, CTA, selection ring)
      computed as a pure function over the token table, meet WCAG.
- [ ] R2.6 GREEN: token fixes.
- [ ] R2.7 RED (Playwright): sub-1000px tab layout doesn't clip any brief
      node or control.
- [ ] R2.8 GREEN: responsive layout fix.
- [ ] R2.9 Per remaining level (one commit each): repeat F.1–F.15's content
      pattern.

## R3 — Supabase accounts, global ranking, RLS, degraded mode [RK2–RK4, RK6, RK8–RK10]

- [ ] R3.0 **Blocked until C3 is resolved** by the orchestrator: implement
      per the spec's unconditional MUST (never import local attempts into
      the scored ranking), not the design's open "import + re-score"
      recommendation, unless the orchestrator explicitly overrides the spec.
- [ ] R3.1 RED: anonymous Supabase client querying `attempts` returns zero
      rows [RK8].
- [ ] R3.2 GREEN: `supabase/migrations/0001_forja.sql` — tables, RLS
      policies, definer-rights `leaderboard`/`exercise_best` views.
- [ ] R3.3 RED: play continues and ranking shows "unavailable" when Supabase
      is unreachable (mocked timeout/paused project) [RK6].
- [ ] R3.4 GREEN: `SupabaseRankingAdapter`, 3 s timeout, local outbox.
- [ ] R3.5 RED: opted-out (`is_public=false`) player absent from the
      ranking query [RK3]; email never appears in ranking DOM [RK2];
      anonymous visitor sees populated ranking rows [RK4].
- [ ] R3.6 GREEN: `is_public` filter on `leaderboard`; pseudonym-only
      rendering.
- [ ] R3.7 RED: best answers hidden until the player's first scored
      submission for that exercise [RK10, first half].
- [ ] R3.8 GREEN: gate `exercise_best` query in the UI.
- [ ] R3.9 **Design addendum required (G6):** structural-diversity curation
      algorithm for best-answer selection has no design mechanism yet —
      block RK10's second scenario until a design decision exists; do not
      implement an ad-hoc heuristic here.
- [ ] R3.10 Commit: `feat(forja): supabase ranking, RLS, degraded mode`.
