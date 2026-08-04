# Proposal: La Forja — integration into alafourca.dev

## Intent

La Forja exists only as two disjoint HTML prototypes in the brand repo: `forja-app.html` scores
without the 12 canvas rules, `forja-canvas.html` implements the 12 rules without scoring. The
owner's request is literal: *"una vez que todo esté bien quiero que se agregue a mi blog para yo
ir haciendo pruebas"*. He cannot play it today, and the prototype has four verified blockers that
make a real play session useless (§14.2, §14.6bis).

Success = Alejandro opens `/forja` on the live site, plays one exercise end to end (build → submit
→ read what is wrong → fix), sees his ranking position at all times, and nothing else on the site
changes.

## Scope

### In Scope

- New route tree `/forja` on the existing **static** Astro build (no adapter, no Vercel functions,
  no deploy change).
- Evaluation engine as a **pure TypeScript module** (no DOM imports) — runs in the browser today,
  in a Supabase Edge Function later, unchanged.
- Canvas playground: legality (bands, trust zones, ports), the 12 rules of §13.7, guarantee
  predicates, cost-as-budget scoring with the monotonicity and feedback invariants of §14.3.
- Fixes to the four verified blockers: delete-a-connection, ranking visible in every view,
  sub-1480px node loss (pan + real fit), result above the fold; plus empty-canvas 30/100 guard,
  light-theme contrast on arrows/CTA/selection ring, and the five §13.9 accessibility requirements.
- 12-level curriculum per §14.4 (content, cards, unlock by exercise **role**, not by count).
- Supabase Free: accounts, attempts, global ranking, row-level security.
- Test harness (repo has none today; `strict_tdd: true` blocks apply).

### Out of Scope

- Server-side anti-cheat re-scoring. **Deferred, verified reason:** Vercel Hobby is
  non-commercial-only and the site has a paid `servicios` page. Later this becomes a Supabase Edge
  Function (free tier), which is only possible because attempts store **the design graph, not the
  score** (§14.6ter).
- Populational ceiling / percentile (open decision §14.7.1). Analytic ceiling ships first.
- Nav link, `noindex` removal, public launch — a separate, explicitly approved slice.
- Full 12×14 exercise catalogue. Beta floor is 8 per level (§14.4); slices deliver level by level.
- Any change to `index`, `blog`, `100-architecture-days`, `empieza-aqui`, `newsletter`,
  `servicios`, `sobre-mi`, `uses`, `confirmacion`, `gracias`, `404`, `rss.xml.ts`.
- Site-wide Tailwind palette debate (§14.7.4) and the `advocate` naming question (§14.7.3).
- Anything with a monthly cost. Everything proposed here is on a free tier.

## Capabilities

### New Capabilities

- `forja-evaluation-engine`: graph model, legality gate, guarantee predicates, cost budget,
  analytic ceiling, findings ledger, scoring invariants.
- `forja-playground-canvas`: build/connect/move/delete gestures, undo, pan/zoom/fit, empty state,
  and the §13.9 accessibility parity (list view, full keyboard build, text-not-only-colour
  warnings, accessible names with type/zone/state, optional auto-layout).
- `forja-exercise-content`: content collection + Zod schema + the 14 admission gates and the
  9-axis difficulty index (§14.4).
- `forja-progression`: 12 levels, prerequisites, unlock by exercise role, content level decoupled
  from player rank.
- `forja-ranking`: accounts, attempt persistence, always-visible ranking, privacy and RLS,
  degraded mode when the backend is unavailable.

### Modified Capabilities

None — no existing spec files exist in `openspec/specs/`.

## Approach

**Playground built as vanilla TypeScript inside Astro (recommendation, reversible).** The
prototype's `nodes/wires/sel/linking/ghost/zoom` model ports almost directly, zero framework
weight, and the repo has no islands framework installed. React Flow would give documented keyboard
+ ARIA for free, but costs React + ReactDOM + ~59 KB gzip and a real rewrite of the state model.
Flagged as the one open technical fork — see the question round.

**Engine first, UI second.** The engine is the only part that must survive a runtime change, so it
is written and tested as a pure module before any pixel is placed.

### Test runner: Vitest + Playwright — with one gate before installing

Astro's official testing guide documents this pairing; `getViteConfig()` reuses the project's real
Vite/TS resolution, so path aliases and `astro:content` work without a second config to maintain.
Three test targets, three tools would be one too many: Vitest covers the pure engine **and** the
exercise-content schema (same Zod schema, imported directly); Playwright covers canvas gestures in
a real browser, which is the only way to catch the delete-connection class of bug — that bug was
invisible to synthetic `dispatchEvent` and only appeared under a real pointer (§14.1).

**Verified here:** Astro 6.1.9 declares `vite: ^7.3.2` and `node_modules/vite` is exactly
**7.3.2**. **Not verified (no network in this phase):** that the chosen Vitest version accepts Vite
7.3.2. This is a hard gate in slice R1-A: run `npm info vitest peerDependencies` + `npm ls vite`
after install, and confirm a single Vite instance. If the range excludes Vite 7.3.2, fall back to
`node:test` + Playwright — `gray-matter` is already installed for content fixtures, and this
requires confirming the local Node is ≥ 22.18 for flag-less TypeScript stripping.

### Slices (chained PRs, 400 authored lines each)

Release **R1 — playable** is the smallest thing that lets Alejandro really test.

| # | Slice | Forecast |
|---|---|---|
| R1-A | Test harness: `vitest.config.ts`, `playwright.config.ts`, scripts, first red→green engine test | ~120 |
| R1-B | Engine legality: graph types, bands, zones, ports, the 12 rules, empty-canvas guard + tests | ~380 |
| R1-C | Engine scoring: guarantee predicates, cost budget, analytic ceiling, findings; monotonicity + `score + Σ findings.costPoints == ceiling` invariant tests | ~350 |
| R1-D | `/forja` route + canvas interaction: create, connect, **delete connection**, move, delete, undo, pan, real fit, empty state | ~400 |
| R1-E | Result panel `Problema \| Resultado \| Mejores`, findings that highlight the canvas, result above the fold, local ranking strip present in every view (labelled local), attempts stored as **graphs** in `localStorage` | ~330 |
| R1-F | One level's exercises against the content schema + admission-gate tests | ~300 |
| **R2** | §13.9 accessibility parity, light-theme contrast fixes, sub-1000px tab layout, remaining levels' content (one PR per level) | ~300 each |
| **R3** | Supabase accounts + global ranking + RLS + degraded mode | ~380 |

Total forecast ≈ 1.9k authored lines for R1. Single PR is impossible; chained PRs are mandatory.

### Data model (Supabase Free, browser talks directly to it)

| Object | Shape | Row-level security |
|---|---|---|
| `profiles` | `id` → `auth.users`, `display_name` (unique, player-chosen), `locale`, `is_public`, `created_at` | insert/update only where `auth.uid() = id`; no anon select |
| `attempts` | `id`, `user_id`, `exercise_id`, `design jsonb` (**the graph**), `score`, `ceiling`, `legal`, `engine_version`, `is_shared` (default false), `created_at` | select/insert only own rows; never readable by anon |
| `leaderboard` (view) | `display_name`, `total_score`, `exercises_done`, `rank` — filtered to `is_public` | anon select allowed; exposes no `user_id`, no email, no design |
| `exercise_best` (view) | `exercise_id`, `display_name`, `design`, `score` where `is_shared AND legal` | anon select; UI gates it until the player has submitted (§14.3 defect 10) |

**Privacy:** email never leaves `auth.users` and is never rendered. Display name is a
player-chosen pseudonym. Opting out (`is_public = false`) removes the row from the ranking view.
Sharing a design is opt-in per attempt. `engine_version` is stored so scores can be recomputed
honestly when server-side re-scoring exists.

**Honesty requirement:** until server-side re-scoring exists, the ranking is client-computed and
therefore falsifiable. It must say so in the UI. Brand rule: no claim without its why.

**Credentials:** `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` as environment variables,
never in the repo. The project does not exist yet; R1 ships and works with no credentials at all
(local mode), so R1 is not blocked on the owner creating it.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/pages/forja/**` | New | Route tree — no existing route touched |
| `src/components/forja/**`, `src/lib/forja/**` | New | Canvas UI + pure engine module |
| `src/content/forja/**` | New | Exercise content collection |
| `src/content.config.ts` | Modified (additive) | Register the `forja` collection; blog collection untouched |
| `src/layouts/BaseLayout.astro` | Modified (additive, ~4 lines) | Optional `noindex` prop, default `false` → zero change to existing pages |
| `astro.config.mjs` | Modified (~3 lines) | Sitemap `filter` to exclude `/forja` during beta |
| `package.json` | Modified | Test scripts + two dev dependencies |
| `supabase/migrations/*.sql` | New (R3) | Tables, views, RLS policies |
| `vercel.json`, adapter, deploy | **Untouched** | The site stays 100% static |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Vitest rejects Vite 7.3.2 | Med | Gate in R1-A before writing tests; fallback `node:test` + Playwright (needs Node ≥ 22.18) |
| Supabase Free pauses after 7 days idle | High | Client must degrade to local mode; game stays playable, ranking says "unavailable" — a tested scenario, not an assumption. Un-pausing is manual and free |
| Client-computed scores are falsifiable | High | Store the graph, not the score; label the ranking honestly; Edge Function re-scores later without a data migration |
| Canvas accessibility in vanilla TS is manual work | Med | R2 is a dedicated slice with the five §13.9 requirements as explicit acceptance criteria |
| Content volume (12 levels × 8 beta exercises) dwarfs the code | High | Content ships level by level, one PR each; R1 needs one level only |
| R1 spans 6 chained PRs before he can play | Med | Order is value-first; R1-D is the first branch he can open in `npm run dev` and click |
| Bundle/build regression breaks the live site | Low | `npm run build` gate per slice; `/forja` unlinked and `noindex` until explicitly launched |

## Rollback Plan

1. **Beta containment:** `/forja` is not in the nav, is `noindex`, and is excluded from the
   sitemap. Reachable only by direct URL. Nothing on the site links to it.
2. **Build-time kill switch:** `PUBLIC_FORJA_ENABLED=false` → `/forja` renders a placeholder page.
   Rebuild + redeploy, no code revert.
3. **Full removal:** revert the chained commits. All Forja code lives under new paths; the only
   shared touchpoints are three additive edits (`BaseLayout` prop, sitemap filter,
   `content.config.ts` collection), each revertible on its own without affecting any existing page.
4. **Backend failure:** Supabase paused, unreachable, or credentials removed → the client falls
   back to local mode automatically. The game keeps working; only the global ranking degrades.
5. `src/content/blog/checkpoint-clean-code.md` is never staged or touched; staging is always by
   explicit path, verified with `git diff --cached --name-only`.

## Dependencies

- Owner creates the Supabase project (his account) and provides URL + anon key — required for R3
  only, not for R1.
- `vitest`, `@playwright/test` (+ browser binaries) as dev dependencies. Free.
- `@supabase/supabase-js` as a runtime dependency (R3). Free.
- Open decision: analytic vs. populational ceiling (§14.7.1). R1 ships analytic; populational
  cannot ship before R3 anyway.

## Success Criteria

- [ ] `npm test` and `npm run test:e2e` exist, run, and are red before they are green.
- [ ] Alejandro plays one exercise end to end at `/forja` in `npm run dev` and on production.
- [ ] The four verified blockers are gone, each proven by a test: a connection can be deleted with
      a real pointer; the ranking has a non-zero box in every view; nothing from the brief is
      clipped at 1280px; the score is visible without scrolling after submitting.
- [ ] An empty canvas scores 0 with an explicit message, not 30/100.
- [ ] Adding a guarantee never lowers the score (monotonicity test) and every lost point has a
      finding attached (feedback invariant test).
- [ ] Two structurally different legal designs both score 100 on the same exercise (§13.10).
- [ ] Light theme meets WCAG on arrows, CTA, and the selection ring.
- [ ] The other 12 routes render byte-identically apart from the `noindex` meta they do not emit.
- [ ] `npm run build` passes on every slice.
- [ ] Monthly cost: 0.

## Proposal question round

Interactive mode, but this phase has no channel to ask directly. These five product questions
change the proposal; answers should be routed back before `sdd-spec` starts.

1. **Ranking privacy.** Ranking is public by design, but what is the default: real display name or
   pseudonym? Can a player stay in the game but out of the ranking (`is_public = false`), and is
   the ranking visible to logged-out visitors or only to players?
2. **Beta reach.** Is `/forja` for Alejandro and invitees by direct URL for now (assumed here:
   unlinked + `noindex`), or public from day one? Public changes auth, moderation, and the
   honesty label on client-computed scores.
3. **Score ceiling (§14.7.1, still open).** Analytic ceiling is assumed for R1 — a 100 stays a 100
   forever. The populational reading makes today's 100 become an 87 next month. Confirm analytic
   as the record score and populational as a separate, unscored signal?
4. **First playable level.** R1-F ships one level's content. Which one: level 1 *Pensar antes de
   diseñar* (no canvas, tests the framing) or level 3 *Datos, integridad y clasificación* (the only
   level with real exercises today, and the one that exercises the canvas)? And how many exercises
   for a real test — the beta floor is 8.
5. **Local progress when accounts arrive.** Does a player's local history merge into the new
   account, or does the account start clean? Merging means importing client-computed scores that
   were never verified.

Assumptions made in the absence of answers: playground built in vanilla TypeScript; `/forja`
unlinked and `noindex` during beta; analytic ceiling; ranking labelled as local until R3; email
never displayed; designs private unless explicitly shared.
