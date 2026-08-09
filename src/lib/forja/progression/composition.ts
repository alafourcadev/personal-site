// Doc §14.4's composition tiers, as pure math over ONE level's catalog. The
// rule was previously spelled out by hand in the level-4 content test, which
// asserted a single tradeoff pair across the entire project, true only while
// level 4 was the only level with content, and red on the first level-5
// tradeoff. Taking a level's own entries as the argument makes the pair rule
// per level by construction.
//
// Two tiers, both valid, nothing in between:
//
//   beta (8)      1 calibration · 4 core · 2 tradeoff (1 pair) · 1 synthesis
//   complete (14) 1 calibration · 6 core · 4 tradeoff (2 pares)
//                 · 1 trap · 1 counter-trap · 1 synthesis
//
// The doc's own reasons for each floor: transfer needs 6 core (3 concepts ×
// 2 domains, so nobody learns "in payments, idempotency is done like this");
// discrimination needs contrasted PAIRS, so each tradeoff costs 2 exercises;
// and the trap always ships with a counter-trap, because a lone trap teaches
// the wrong metagame: "if it looks obvious, pick the other one".
//
// This reports violations rather than throwing, because it serves two callers
// with different needs: the content test wants everything wrong at once, and
// an author mid-level wants to know what is still missing without the first
// gap hiding the rest.
import type { ExerciseRole, ExerciseStatus } from './types'
import { isPlayable } from './types'

export type RoleQuota = Readonly<Partial<Record<ExerciseRole, number>>>

// C2: trap and counter-trap are deliberately absent from beta. A level that
// shipped one early would make unlock.ts require a role the player cannot
// find anywhere else in that level.
export const BETA_ROLE_QUOTA: RoleQuota = {
  calibration: 1,
  core: 4,
  tradeoff: 2,
  synthesis: 1,
}

export const COMPLETE_ROLE_QUOTA: RoleQuota = {
  calibration: 1,
  core: 6,
  tradeoff: 4,
  trap: 1,
  'counter-trap': 1,
  synthesis: 1,
}

// PRODUCT.md, Capabilities and Constraints: "levels 1 to 4 trade one core slot
// for a `greenfield` exercise that starts on an empty canvas". A trade, not an
// addition: this sums to 14 exactly like the tier above, so the corpus does not
// grow and the level map keeps its shape.
//
// The ceiling is pedagogical rather than technical. Building from zero with
// three pieces and a small budget is a good level-1 exercise. Building from
// zero at level 12, with seven pieces and four guarantees, is punishment, and
// it teaches less than repairing a system that already exists, which is also
// what the job actually looks like.
export const GREENFIELD_ROLE_QUOTA: RoleQuota = {
  calibration: 1,
  core: 5,
  greenfield: 1,
  tradeoff: 4,
  trap: 1,
  'counter-trap': 1,
  synthesis: 1,
}

export const GREENFIELD_MAX_LEVEL = 4

// The complete tier a given level ships. A caller that does not know its level
// gets the six-core tier, which is the shape eight of the twelve levels have
// and the safe default for a quota check with no level in hand.
export function completeQuotaForLevel(level?: number): RoleQuota {
  return level !== undefined && level <= GREENFIELD_MAX_LEVEL ? GREENFIELD_ROLE_QUOTA : COMPLETE_ROLE_QUOTA
}

// The minimum number of distinct business domains the core exercises must
// span, so a player transfers the concept instead of memorising one story.
const MIN_CORE_DOMAINS = 2

export interface CompositionEntry {
  role: ExerciseRole
  domain: string
  status: ExerciseStatus
  tradeoffPairId?: string
}

export type CompositionViolationCode = 'role-quota' | 'core-domain-span' | 'tradeoff-pair'

export interface CompositionViolation {
  code: CompositionViolationCode
  message: string
}

function roleQuotaViolations(playable: readonly CompositionEntry[], quota: RoleQuota): CompositionViolation[] {
  const actual = playable.reduce<Record<string, number>>((acc, e) => {
    acc[e.role] = (acc[e.role] ?? 0) + 1
    return acc
  }, {})

  // Every role the tier knows about, plus every role actually present.
  // Reporting a surplus of `trap` at the beta tier needs it named here even
  // though BETA_ROLE_QUOTA omits it.
  const roles = new Set([...Object.keys(quota), ...Object.keys(actual)])

  return [...roles]
    .map((role) => ({ role, want: quota[role as ExerciseRole] ?? 0, got: actual[role] ?? 0 }))
    .filter(({ want, got }) => want !== got)
    .map(({ role, want, got }) => ({
      code: 'role-quota' as const,
      message: `El nivel necesita ${want} ejercicio(s) de tipo "${role}" y tiene ${got}.`,
    }))
}

function coreDomainViolations(playable: readonly CompositionEntry[]): CompositionViolation[] {
  const domains = new Set(playable.filter((e) => e.role === 'core').map((e) => e.domain))
  if (domains.size >= MIN_CORE_DOMAINS) return []
  return [
    {
      code: 'core-domain-span',
      message: `Los ejercicios de núcleo abarcan ${domains.size} dominio(s) de negocio y necesitan al menos ${MIN_CORE_DOMAINS}: sin eso el jugador memoriza una historia en vez de transferir el concepto.`,
    },
  ]
}

// A tradeoff only teaches discrimination as half of a contrasted pair, so the
// tier's tradeoff quota is always even and every pair id must appear exactly
// twice. Beta expects one pair, complete expects two.
function tradeoffPairViolations(playable: readonly CompositionEntry[], quota: RoleQuota): CompositionViolation[] {
  const tradeoffs = playable.filter((e) => e.role === 'tradeoff')
  if (tradeoffs.length === 0) return []

  const unidentified = tradeoffs.filter((e) => !e.tradeoffPairId)
  if (unidentified.length > 0) {
    return [
      {
        code: 'tradeoff-pair',
        message: `Hay ${unidentified.length} ejercicio(s) de tradeoff sin "tradeoffPairId": un tradeoff suelto no contrasta nada.`,
      },
    ]
  }

  const sizeByPair = tradeoffs.reduce<Record<string, number>>((acc, e) => {
    acc[e.tradeoffPairId as string] = (acc[e.tradeoffPairId as string] ?? 0) + 1
    return acc
  }, {})

  const lopsided = Object.entries(sizeByPair).filter(([, size]) => size !== 2)
  if (lopsided.length > 0) {
    return [
      {
        code: 'tradeoff-pair',
        message: `Cada par contrastado necesita exactamente 2 ejercicios; estos no lo cumplen: ${lopsided
          .map(([id, size]) => `"${id}" tiene ${size}`)
          .join(', ')}.`,
      },
    ]
  }

  const expectedPairs = (quota.tradeoff ?? 0) / 2
  const actualPairs = Object.keys(sizeByPair).length
  if (actualPairs !== expectedPairs) {
    return [
      {
        code: 'tradeoff-pair',
        message: `El nivel necesita ${expectedPairs} par(es) contrastado(s) de tradeoff y tiene ${actualPairs}.`,
      },
    ]
  }

  return []
}

function violationsForTier(playable: readonly CompositionEntry[], quota: RoleQuota): CompositionViolation[] {
  return [
    ...roleQuotaViolations(playable, quota),
    ...coreDomainViolations(playable),
    ...tradeoffPairViolations(playable, quota),
  ]
}

// Every rule that can be checked from a level's catalog alone, at the beta
// tier only. Kept for callers that must reject the complete tier outright.
export function betaCompositionViolations(entries: readonly CompositionEntry[]): CompositionViolation[] {
  return violationsForTier(entries.filter((e) => isPlayable(e.status)), BETA_ROLE_QUOTA)
}

// A level is valid at EITHER tier. When it is at neither, the report comes
// from whichever tier it is closer to. An author one core short of complete
// must be told "you need 6 core and have 5", never the beta tier's "you have
// too many of everything", which would send them backwards.
//
// The two rules that need the engine, each reference solution scoring
// exactly 100 and each pair's winner genuinely inverting, live in the
// content test, because they evaluate designs rather than count entries.
export function compositionViolations(
  entries: readonly CompositionEntry[],
  level?: number,
): CompositionViolation[] {
  const playable = entries.filter((e) => isPlayable(e.status))
  const beta = violationsForTier(playable, BETA_ROLE_QUOTA)
  if (beta.length === 0) return []
  const complete = violationsForTier(playable, completeQuotaForLevel(level))
  if (complete.length === 0) return []
  return complete.length < beta.length ? complete : beta
}
