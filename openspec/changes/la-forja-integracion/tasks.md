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

> **Apply Progress Update (2026-08-04):** R1-C is COMPLETE — all 15 tasks
> (C.1–C.15) marked `[x]`. Split into 5 commits to stay under the 400-line
> review budget: `9a20283` "feat(forja): guarantee predicate DSL over the
> design graph" (369 lines: predicates.ts, predicates.test.ts, NodeQuery/
> Predicate types), `e716a5b` "feat(forja): cost as a budget with a cliff"
> (128 lines: catalog.ts monthlyUsd, cost.ts, cost.test.ts, Budget type),
> `ab544ca` "feat(forja): the ledger — exact feedback accounting with
> largest-remainder rounding" (318 lines: score.ts, ceiling.test.ts,
> ledger.test.ts, Guarantee/ExerciseSpec types), `dff2d4d` "test(forja): prove
> the monotonicity invariant (EE6)" (115 lines: monotonicity.test.ts, the
> enumeration plus the exact prototype DLQ regression), `29a9693`
> "feat(forja): wire evaluate()/checkConnection() — the public engine
> surface" (305 lines: index.ts rewrite, rules.ts WHY export, Evaluation/
> ConnectionVerdict types, no-mutation.test.ts, evaluate.test.ts covering
> all 4 named regressions). `npm test` passes 59/59 across 13 files; `npm
> run build` stays green (50 pages, C.14 checkpoint); `tsc --noEmit` clean
> throughout. Full evidence in Engram `sdd/la-forja-integracion/
> apply-progress`. Next: R1-D1 (canvas core gestures).

- [x] C.1 RED: `tests/engine/predicates.test.ts` — two structurally distinct
      legal designs both satisfy `G2` (outbox vs. durable queue).
- [x] C.2 GREEN: `predicates.ts`, DSL → graph queries, `set` never `find`
      (defect-9 regression coverage).
- [x] C.3 RED: `tests/engine/cost.test.ts` — under-budget no penalty;
      over-budget monotonic `eficiencia` decrease.
- [x] C.4 GREEN: `cost.ts`.
- [x] C.5 RED: `tests/engine/ceiling.test.ts` — two distinct legal designs
      both score exactly 100 (also doubles as EE10 §13.10 publication test).
- [x] C.6 GREEN: `score.ts`, analytic ceiling.
- [x] C.7 RED: `tests/engine/monotonicity.test.ts` — seeded small design-space
      enumeration, `G(d')≥G(d) ∧ C(d')≤budget ⟹ score(d')≥score(d)`.
- [x] C.8 Verify EE7 already holds by D3 construction (no node-count term);
      no new production code expected — task is proof, not implementation.
- [x] C.9 RED: `tests/engine/ledger.test.ts` — `score + Σ costPoints == 100`
      exactly, largest-remainder rounding.
- [x] C.10 GREEN: ledger allocation in `score.ts`.
- [x] C.11 RED: `tests/engine/no-mutation.test.ts` — `evaluate()` does not
      alter the input `Design` object (EE11).
- [x] C.12 Verify: confirm immutability by construction; no code change
      expected unless C.11 fails.
- [x] C.13 Wire `evaluate()` / `checkConnection()` exports per the Interfaces
      contract in `engine/index.ts`.
- [x] C.14 **Risk task (design/build coupling):** after C.13, run
      `npm run build` with the engine wired but *before* `content.config.ts`
      imports it (R1-F). Confirm build stays green with the engine present
      but unused, so R1-F's later coupling failure is attributable to content
      admission, not an engine regression. Document the revert path
      (unregister the `superRefine` import) in the R1-F commit message.
- [x] C.15 Commit: `feat(forja): engine scoring, invariants, ledger`. **Scope
      note:** delivered as 5 commits per the 400-line-per-slice discipline;
      see Apply Progress Update above.

## R1-D1 — Canvas core gestures [PC1–PC6, PC10–PC13] · *value-first, not the checkpoint yet*

> **Apply Progress Update (2026-08-04):** R1-D1 is COMPLETE — all 17 tasks
> (D1.1–D1.17) marked `[x]`. Delivered as 8 commits on `feat/la-forja`
> (no PRs, per the owner's explicit override): `c4ad861` deps + react()
> integration, `c9f7205` domain store, `6237497` presentation catalog +
> accessible-name composer, `5c92d35` Design→React Flow projection,
> `b95e162` store default-props fix, `1cf0b22` presentation components
> (icons, node, palette, list view), `a2e0fb1` ForjaCanvas orchestrator +
> `/forja` mount, `4866e08` the 16-scenario Playwright suite, `1d0277e`
> dark-theme Controls + a real post-create focus race fix found while
> stress-testing. `npm test`: 84/84 (59 baseline + 25 new). `npm run
> build`: 51 pages, only `/forja/index.html` references the React chunk
> (grepped across `dist/**/*.html`). Playwright: 16/16 against the
> production build, stress-tested 80/80 and 75/75 under `--repeat-each`.
> `DesignList` shipped as a React component inside the island, not
> `DesignList.astro` — design D5 places the list view outside the island
> only once a real `[level]/[exercise]` route exists (R1-F); noted as a
> deviation. Full evidence in Engram `sdd/la-forja-integracion/apply-progress`.

- [x] D1.1 RED (Playwright): create node by pointer and by keyboard, focus
      moves to the new node [PC1].
- [x] D1.2 GREEN: `ForjaCanvas.tsx` node creation wired to the store.
- [x] D1.3 RED (Playwright): move a focused/selected node with arrow keys [PC2].
- [x] D1.4 GREEN: keyboard move handler.
- [x] D1.5 RED (Playwright): connect by pointer drag and by keyboard
      command; illegal connection announced via `aria-live`, never color
      alone [PC3, PC12].
- [x] D1.6 GREEN: `isValidConnection` → `engine.checkConnection` wiring per
      the connection-gesture diagram.
- [x] D1.7 RED (Playwright, real pointer — **B4 blocker, PC4**): click an
      existing connection, confirm delete; count decreases by one and it
      does **not** reappear on next render.
- [x] D1.8 GREEN: edge deletion (React Flow edge selection + delete).
- [x] D1.9 RED (Playwright): delete a keyboard-selected node removes its
      connections too [PC5].
- [x] D1.10 GREEN: node deletion handler.
- [x] D1.11 RED (Playwright): undo restores a deleted connection between the
      same two ports [PC6].
- [x] D1.12 GREEN: undo wiring (store history).
- [x] D1.13 RED: accessible name includes label, type, zone, state [PC13];
      `DesignList.astro` shows the same findings as the canvas [PC10].
- [x] D1.14 GREEN: `aria-label` composition (D8) + `DesignList.astro`.
      **Deviation:** shipped as `DesignList.tsx`, a React component inside
      the island — see Apply Progress Update above.
- [x] D1.15 RED (Playwright): full keyboard build (create, connect, move,
      delete) matches an equivalent pointer-built design [PC11].
- [x] D1.16 GREEN: close any remaining keyboard gaps found by D1.15.
- [x] D1.17 Commit: `feat(forja): canvas core gestures`. **Scope note:**
      delivered as 8 commits per the 400-line-per-slice discipline; see
      Apply Progress Update above.

## R1-D2 — Bands, spike, pan/fit, empty state [PC7, PC8(G1)] · **🔴 HUMAN VERIFICATION POINT**

> Owner's literal request: *"una vez que todo esté bien quiero que se agregue
> a mi blog para yo ir haciendo pruebas."* After this slice, `/forja` is
> openable in `npm run dev` and clickable end to end. This is the first
> point where Alejandro should actually play.

> **Apply Progress Update (2026-08-05):** R1-D2 and R1-D2b are COMPLETE.
> Full evidence, deviations, and the production-only infinite-loop bug (and
> its fix) are recorded in Engram `sdd/la-forja-integracion/apply-progress`.

- [x] D2.1 **Spike:** confirmed via @xyflow/system's own `NodeBase` type
      (`extent?: 'parent' | CoordinateExtent | null`) and @xyflow/react's
      `evaluateAbsolutePosition()` call site that `extent: 'parent'` makes a
      child's `position` PARENT-RELATIVE once `parentId` is set — a real,
      documented coordinate-space change that would have broken design D1's
      "position is absolute domain state" invariant across the store,
      project.ts, and the drag-commit path. Chose the documented fallback:
      **manual clamping**, done centrally in `ForjaStore.moveNode()` (single
      source of truth for both drag-stop and keyboard moves) plus a live
      mirror in `onNodesChange` for in-flight visual feedback.
- [x] D2.2 GREEN: `bands.ts` (pure clamp math) + `BandLane.tsx` — a
      decorative layer synced to React Flow's own `useViewport()`,
      deliberately NOT a React Flow node (would have broken every existing
      `.react-flow__node` count assertion).
- [x] D2.3 RED (Playwright, real pointer): rewritten mid-slice from a pixel
      -coordinate comparison (flaky — the canvas pane's own box can extend
      past the browser viewport at 1280×720) to `toBeInViewport()` against a
      deliberately short test-scoped viewport; a real pointer drag pushes
      the node out, `fitView` (React Flow's own Controls button, zero custom
      code) brings it back.
- [x] D2.4 GREEN: no new production code — React Flow's stock `<Controls>`
      already includes a working fit-view button (`showInteractive={false}`
      only hides the interactive-lock toggle); this task ended up being the
      proving test alone.
- [x] D2.5 RED: empty canvas renders a `<Panel>` guidance message [PC8 —
      closes G1].
- [x] D2.6 GREEN: conditional `<Panel position="top-center">` inside
      `<ReactFlow>`, `data-testid="empty-canvas-hint"`.
- [x] D2.7 GREEN: `tests/containment/no-react-on-existing-routes.test.ts`
      (not `tests/build/` — a machine-local global gitignore rule silently
      excludes any directory named "build" anywhere in the tree, noted in
      the file itself). Walks real `npm run build` output; skips, not
      fails, when `dist/` doesn't exist.
- [ ] D2.8 Manual verification: **NOT done by the implementer** — the
      owner's own browser session is what this task asks for. `/forja`
      builds green (51 pages) and passes 36/36 Playwright scenarios across
      3 spec files, stress-tested to 90/90 clean under `--repeat-each=3`
      (2 workers), but nobody but the owner can close this task.
- [x] D2.9 Commits: `feat(forja): band-clamp math, menu-position clamp,
      player colour palette` (band math only — BandLane landed with D2.11's
      commit since both needed the context-menu wiring pass to test
      end-to-end), `feat(forja): colour on the node, visual band lanes`,
      `feat(forja): wire the context menu, band clamp, empty state, overlay
      containment`, `test(forja): Playwright proof for fit-view, empty
      state, undo and overlay containment`, `test(forja): D5 containment
      check`.

## R1-D2b — Owner-requested additions [PC15, PC16, PC17]

> **Orchestrator gap, not the implementer's:** these three requirements were
> dictated explicitly by the owner during design review but never made it
> into the design/tasks handoff. They now exist as formal requirements at
> the end of `specs/forja-playground-canvas/spec.md` (added out of band by
> the orchestrator once the gap was found) — this subsection is their task
> breakdown, written retroactively before implementation starts. Traceability
> numbers continue the `forja-playground-canvas` spec's own requirement
> order (14 prior requirements, these are #15–#17).

- [x] D2.10 RED (Playwright, real right-click): right-click on a node opens
      the node menu, not the pane menu; node not mutated [PC15].
- [x] D2.11 GREEN: `onNodeContextMenu`/`onPaneContextMenu` (React Flow's own
      hooks) + reusable `ContextMenu.tsx` (`role="menu"`/`role="menuitem"`,
      roving tabindex, Escape closes and returns focus, click-outside
      closes, positioned via `clampMenuPosition`).
- [x] D2.12 RED (Playwright, real right-click on empty canvas): opens the
      "add component" menu; an item creates a node at the clicked flow
      position via `screenToFlowPosition`.
- [x] D2.13 GREEN: pane menu wired to `store.createNode` at that position.
- [x] D2.14 RED (Playwright, real pointer): "Conectar con…" + a real click
      on a legal target creates the same connection a drag would.
- [x] D2.15 GREEN — **with a real deviation from the plan:** the menu's
      "Conectar con…" completion is a raw capture-phase `window` `click`
      listener, NOT React Flow's `onNodeClick` prop as originally planned.
      Calling `store.connect()` (mutating `design`) from directly inside
      RF's own synthetic click handling produced a real, reproducible
      "Maximum update depth exceeded" crash under Playwright — specific to
      the **production build** (never reproduced against `npm run dev`),
      root-caused and fixed; see apply-progress for the full investigation.
      A second, related bug fixed in the same pass: `onNodesChange` was
      unconditionally rebuilding every node's object reference on every
      change event (including React Flow's own dimension-measurement
      events, not just position drags), which fed back into another
      measurement pass — narrowed the clamp to only nodes with an actual
      position change in the batch.
- [x] D2.16 RED (Playwright, real keyboard): Shift+F10 opens the menu with
      focus on the first item; ArrowDown moves focus; Escape closes and
      returns focus to the node.
- [x] D2.17 GREEN: capture-phase keydown branch for ContextMenu key /
      Shift+F10 (anchored near the focused node's own bounding rect) +
      the menu's internal roving-tabindex arrow navigation.
- [x] D2.18 RED (Vitest, pure): `renameNode`/`duplicateNode`/`setNodeColor`,
      each one undoable history entry.
- [x] D2.19 GREEN: the three `ForjaStore` mutations.
- [x] D2.20 RED (Vitest, pure, engine-level): `evaluate()`/
      `checkConnection()`/`evaluateLegality()` identical regardless of
      `node.color`, plus a source-grep asserting no engine file contains
      `.color` at all.
- [x] D2.21 GREEN: `DesignNode.color` added to `types.ts`; the D2.20 grep is
      the actual enforcement, not a comment.
- [x] D2.22 RED (Playwright, real pointer): picking a swatch persists the
      colour, the accessible name gains `color {Spanish name}`, label/type
      /zone text unchanged [PC16].
- [x] D2.23 GREEN: `player-colors.ts` (six Tailwind-default swatches, not
      new BaseLayout tokens — rationale in the file), `ContextMenu`'s
      colour row, `composeNodeAccessibleName`'s colour segment, `ForjaNode`'s
      colour dot (next to, never replacing, icon/label).
- [x] D2.24 RED (Playwright, real interaction): a connection refusal AND an
      open node menu, both followed by a real click on a nav link — the
      only genuine proof nothing is drawn on top of it (a covered element
      fails Playwright's own actionability check) [PC17].
- [x] D2.25 GREEN: `relative isolate` on the playground root; `ContextMenu`
      is `position: absolute` inside it, never `fixed`, clamped via the
      shared `clampMenuPosition` helper.
- [x] D2.26 Commits: `feat(forja): reusable context menu component,
      band-width tuning`, `feat(forja): wire the context menu, band clamp,
      empty state, overlay containment`, `test(forja): Playwright suite for
      the context menu`, `test(forja): Playwright proof for fit-view, empty
      state, undo and overlay containment`. `BAND_WIDTH` itself moved twice
      during this slice (320 → 520 → 360) — the first two values either
      starved the pointer-drag test of slack or pushed cross-band nodes off
      the canvas pane's real ~915px width (measured directly, not guessed);
      360 is the value that satisfies both.

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
