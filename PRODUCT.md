# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who already write code and have never designed a system. Mid level and up, Spanish speaking, most of them arriving from LinkedIn on a phone and coming back on a laptop.

Their situation is the one the brand names: an AI writes the code for them in seconds, so writing code stopped being the scarce skill. What they cannot copy is the criterion to decide, and they know it.

Their job on this site is not to read about architecture. It is to make architecture decisions and find out what those decisions cost.

Secondary audience, confirmed: Alejandro himself uses this material for mentoring at lidr.co. Anything built here can become teaching material.

## Product Purpose

Ingeniería sin Filtros is a technical editorial platform. Its center of gravity is **La Forja**: a playable architecture exercise where the player reads a real business problem, builds or repairs a system diagram on a canvas, and an evaluation engine scores the design against declared guarantees, naming what breaks and who pays for it.

Success for a player, in the product's own words at the end of the last exercise: being able to say, of every piece in their design, what problem it solves, who they took something from, and what they accepted losing in exchange.

## Positioning

Two mechanisms a neighboring product could not truthfully copy.

**An executable evaluation engine.** The design is scored by rules, not by an opinion and not by a language model. The same design always gets the same verdict, and every lost point has a finding that explains it.

**A corpus where the antagonist is right.** In five of six exercises audited at the higher levels there is someone asking for the opposite, and their argument is correct. The exercise is not won by discovering who is wrong. It is won by being able to say what you are giving up. That is what separates this from a quiz with architecture vocabulary.

## Operating Context

- Free. No install. No account required to play.
- **Desktop first.** The canvas needs pointer precision. On a small screen the product is readable, not playable: brief, level map, and reviewing an already played result. This is a decided constraint, not a gap.
- Spanish, rioplatense neutral register.
- La Forja opens **full screen with its own name**, under the Ingeniería sin Filtros brand, with an explicit way back to the blog. It does not inherit the blog's page shell.
- Most first visits arrive from LinkedIn, frequently on a phone.

## Capabilities and Constraints

**Content.** 12 levels, 14 exercises each. 168 playable. Levels 5 to 12 keep the original composition: 1 calibration, 6 core, 4 tradeoff, 1 trap, 1 counter-trap, 1 synthesis. Levels 1 to 4 trade one core slot for a `greenfield` exercise that opens on an empty canvas, so the player decides which pieces exist at all, a decision repairing an existing diagram never asks for. The role is enforced both ways: `greenfield` must open blank, no other role may, and no blank canvas may live above level 4.

**The engine is the contract.** It is validated and does not change without extraordinary evidence. The 12 executable level gates plus the suite are what proves it. Content and interface serve the engine; they do not negotiate with it.

**Declared difficulty ramps; mechanical difficulty still does not.** The nine difficulty axes climb cleanly from 7 to 28 across the levels, but nodes, edges, guarantees and budget stay flat, and **level 2 remains structurally denser than level 12** (8 nodes and 8 edges against 6.5 and 5). Level 4's budget was tightened, so it is no longer the loosest in the game, and the four greenfield exercises were calibrated to open the ramp gently. The inversion itself is open, and its cost is measured, not guessed: bringing level 2 down means redrawing 28 reference solutions across 14 files; raising level 12 above it means 26 across 13; a fully monotonic ramp across all twelve levels means 280 reference solutions across 140 files. Touching an existing exercise's structure forces rewriting both of its reference solutions and reproving they score 100.

**Canvas.** 21 component types. Zone is a fixed property of the type, not of position. Connections carry a declared data class. Node positions use exactly three x values across all 169 files.

**Progress and identity.** Today it lives in `localStorage` under a single key, so clearing the browser or changing machine erases 168 exercises. **Decided:** accounts on Supabase free tier, client side against the static site, so progress survives. Store score and date, never the design graph, which stays local. Verified limits: 50,000 monthly active users, 500 MB, projects pause after one week of inactivity.

**Ranking.** Local, per exercise, and it is the player against themselves. Nothing global is promised until accounts exist.

## Brand Commitments

- Name: Ingeniería sin Filtros. Author: Alejandro Lafourcade. Domain: alafourca.dev.
- Voice: direct, technical, human, no hype, no guru. The central editorial rule is that **no claim ships without its why**. Never "use X"; always "use X because it solves Y, and you accept cost Z".
- Visual direction: dark premium, editorial technical, sober, spaced, with the texture of real engineering. The light theme must feel equally deliberate, never the dark one with the lights turned on.
- **Binding writing constraint:** the em dash as a sentence or clause separator is forbidden across the whole product, including code comments, UI copy, exercise text and commit messages. It reads as machine written, and the human voice is the product. Replace by splitting the sentence, not by swapping the character.
- La Forja carries its own name inside the brand, with a visible return to the blog.

## Evidence on Hand

- 173 exercise files under `src/content/forja/exercises/`: 168 playable and 5 drafts, with about 46,000 words of visible brief. This corpus is the strongest asset and was audited as such.
- The engine under `src/lib/forja/engine/`, 12 executable level gates, and a suite currently at 1,371 passing unit tests and 245 browser cases.
- A 13 specialist committee audit with executed evidence at `docs/forja/COMITE_EXCELENCIA_BACKLOG.md`.
- **Absences that must never be fabricated:** there are no real users yet, no testimonials, no traffic metrics, no customers, no case studies. There are no accounts today. There is no global ranking. Nothing may claim otherwise.

## Product Principles

1. **Nothing is claimed without its why.** Applies to exercise copy, to interface copy, and to error messages.
2. **The engine is the contract.** Anything that breaks an executable gate is wrong, however good it looks.
3. **What can be measured, gets measured.** A finding without executed evidence does not count. This is how the committee killed five expensive proposals.
4. **Deleting wins.** Between adding and removing, remove. Five modules were found written, tested, and reaching no screen.
5. **The player must always be able to say what they gave up.** Any feature that lets someone win without articulating the tradeoff is working against the product.

## Accessibility & Inclusion

- **An exercise must be completable without a mouse.** This is achieved today and verified by playing it. It is a floor, not an aspiration.
- WCAG AA is the floor. Contrast currently passes with margin in dark theme and must not regress. Light theme was just brought to the same standard.
- `prefers-reduced-motion` is honored across the site and must stay honored.
- Small screens get an honest state, never a silently broken one.
