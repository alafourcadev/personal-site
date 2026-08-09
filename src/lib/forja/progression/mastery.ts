import {
  sharedLearningConcepts,
  type ExerciseLearningConcepts,
} from './learning-concepts'

export const MINI_ADR_FIELDS = ['optimized', 'sacrificed', 'whoPays', 'inversionFact'] as const
export type MiniAdrField = (typeof MINI_ADR_FIELDS)[number]

export interface MiniAdr {
  optimized: string
  sacrificed: string
  whoPays: string
  inversionFact: string
}

export const MAX_MINI_ADR_FIELD_LENGTH = 600
export const MIN_MINI_ADR_CONTENT_CHARACTERS = 6

export type MiniAdrValidationIssueCode =
  | 'required'
  | 'too-long'
  | 'not-articulated'
  | 'tradeoff-not-distinct'

export interface MiniAdrValidationIssue {
  field: MiniAdrField
  code: MiniAdrValidationIssueCode
}

export type MiniAdrValidationResult =
  | { valid: true; value: MiniAdr }
  | { valid: false; issues: MiniAdrValidationIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function comparable(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('es')
}

function isArticulated(text: string): boolean {
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? []
  const contentCharacters = words.join('').length
  return words.length >= 2 && contentCharacters >= MIN_MINI_ADR_CONTENT_CHARACTERS
}

export function validateMiniAdr(input: unknown): MiniAdrValidationResult {
  const source = isRecord(input) ? input : {}
  const value = {} as MiniAdr
  const issues: MiniAdrValidationIssue[] = []

  for (const field of MINI_ADR_FIELDS) {
    const raw = source[field]
    const text = typeof raw === 'string' ? raw.trim() : ''
    value[field] = text
    if (text.length === 0) issues.push({ field, code: 'required' })
    else if (text.length > MAX_MINI_ADR_FIELD_LENGTH) issues.push({ field, code: 'too-long' })
    else if (!isArticulated(text)) issues.push({ field, code: 'not-articulated' })
  }

  if (
    value.optimized.length > 0 &&
    value.sacrificed.length > 0 &&
    comparable(value.optimized) === comparable(value.sacrificed)
  ) {
    issues.push({ field: 'sacrificed', code: 'tradeoff-not-distinct' })
  }

  return issues.length === 0 ? { valid: true, value } : { valid: false, issues }
}

export function isValidMiniAdr(input: unknown): input is MiniAdr {
  return validateMiniAdr(input).valid
}

export interface MasteryAttemptEvidence {
  id: string
  exerciseId: string
  score: number | null
  ceiling: number
  createdAt: string
  miniAdr?: unknown
}

export interface TransferEvidence {
  sourceExerciseId: string
  targetExerciseId: string
  targetAttemptId: string
  succeededAt: string
  // Optional only for evidence written before learning-concept compatibility
  // was introduced. A legacy entry is accepted only when the current domain
  // profiles can still prove a shared concept between source and target.
  conceptId?: string
}

export type TransferEvidenceFailureReason =
  | 'same-exercise'
  | 'target-not-perfect'
  | 'target-not-later'
  | 'incompatible-exercises'
  | 'invalid-date'

export type CreateTransferEvidenceResult =
  | { ok: true; evidence: TransferEvidence }
  | { ok: false; reason: TransferEvidenceFailureReason }

function timestamp(value: string | Date | number): number | null {
  const parsed = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function createTransferEvidence(
  sourceExerciseId: string,
  sourceCompletedAt: string,
  target: MasteryAttemptEvidence,
  profiles: readonly ExerciseLearningConcepts[],
): CreateTransferEvidenceResult {
  if (sourceExerciseId === target.exerciseId) return { ok: false, reason: 'same-exercise' }
  if (target.score !== 100 || target.ceiling !== 100) return { ok: false, reason: 'target-not-perfect' }

  const [conceptId] = sharedLearningConcepts(sourceExerciseId, target.exerciseId, profiles)
  if (!conceptId) return { ok: false, reason: 'incompatible-exercises' }

  const completedAt = timestamp(sourceCompletedAt)
  const succeededAt = timestamp(target.createdAt)
  if (completedAt === null || succeededAt === null) return { ok: false, reason: 'invalid-date' }
  if (succeededAt <= completedAt) return { ok: false, reason: 'target-not-later' }

  return {
    ok: true,
    evidence: {
      sourceExerciseId,
      targetExerciseId: target.exerciseId,
      targetAttemptId: target.id,
      succeededAt: target.createdAt,
      conceptId,
    },
  }
}

export type AttachTransferEvidenceResult =
  | {
      ok: true
      evidence: TransferEvidence
      evidenceList: TransferEvidence[]
      deduplicated: boolean
    }
  | { ok: false; reason: TransferEvidenceFailureReason }

export function attachTransferEvidence(
  existing: readonly TransferEvidence[],
  sourceExerciseId: string,
  sourceCompletedAt: string,
  target: MasteryAttemptEvidence,
  profiles: readonly ExerciseLearningConcepts[],
): AttachTransferEvidenceResult {
  const created = createTransferEvidence(sourceExerciseId, sourceCompletedAt, target, profiles)
  if (!created.ok) return created

  const duplicate = existing.some(
    (item) =>
      item.sourceExerciseId === created.evidence.sourceExerciseId &&
      item.targetAttemptId === created.evidence.targetAttemptId,
  )
  return {
    ok: true,
    evidence: created.evidence,
    evidenceList: duplicate ? [...existing] : [...existing, created.evidence],
    deduplicated: duplicate,
  }
}

export const DEFAULT_REVIEW_AFTER_MS = 30 * 24 * 60 * 60 * 1000

export type MasteryState = 'unattempted' | 'attempted' | 'completed' | 'mastered' | 'review-due'

export interface ExerciseMastery {
  exerciseId: string
  state: MasteryState
  attempted: boolean
  completed: boolean
  masteryReady: boolean
  mastered: boolean
  reviewDue: boolean
  bestScore: number | null
  completedAt: string | null
  masteryReadyAt: string | null
  lastTransferAt: string | null
}

export interface MasteryOptions {
  now?: string | Date | number
  reviewAfterMs?: number
  transferProfiles?: readonly ExerciseLearningConcepts[]
}

export interface TransferSourceSelection {
  sourceExerciseId: string
  sourceCompletedAt: string
  conceptId: string
}

export function selectTransferSourceForPerfectAttempt(
  mastery: readonly ExerciseMastery[],
  target: MasteryAttemptEvidence,
  profiles: readonly ExerciseLearningConcepts[],
): TransferSourceSelection | null {
  if (target.score !== 100 || target.ceiling !== 100) return null
  const targetAt = timestamp(target.createdAt)
  if (targetAt === null) return null

  const candidate = mastery
    .filter(
      (entry): entry is ExerciseMastery & { masteryReadyAt: string } =>
        entry.exerciseId !== target.exerciseId &&
        entry.masteryReady &&
        (!entry.mastered || entry.reviewDue) &&
        entry.masteryReadyAt !== null &&
        timestamp(entry.masteryReadyAt) !== null &&
        (timestamp(entry.masteryReadyAt) as number) < targetAt &&
        sharedLearningConcepts(entry.exerciseId, target.exerciseId, profiles).length > 0,
    )
    .sort(
      (left, right) =>
        (timestamp(right.masteryReadyAt) as number) - (timestamp(left.masteryReadyAt) as number) ||
        left.exerciseId.localeCompare(right.exerciseId),
    )[0]

  if (!candidate) return null
  const [conceptId] = sharedLearningConcepts(candidate.exerciseId, target.exerciseId, profiles)
  return conceptId
    ? {
        sourceExerciseId: candidate.exerciseId,
        sourceCompletedAt: candidate.masteryReadyAt,
        conceptId,
      }
    : null
}

function newest<T extends { createdAt: string }>(items: readonly T[]): T | null {
  return (
    [...items].sort((left, right) => (timestamp(right.createdAt) ?? -Infinity) - (timestamp(left.createdAt) ?? -Infinity))[0] ??
    null
  )
}

function latestTransfer(items: readonly TransferEvidence[]): TransferEvidence | null {
  return (
    [...items].sort(
      (left, right) => (timestamp(right.succeededAt) ?? -Infinity) - (timestamp(left.succeededAt) ?? -Infinity),
    )[0] ?? null
  )
}

export function exerciseMastery(
  exerciseId: string,
  attempts: readonly MasteryAttemptEvidence[],
  transferEvidence: readonly TransferEvidence[] = [],
  options: MasteryOptions = {},
): ExerciseMastery {
  const ownAttempts = attempts.filter((attempt) => attempt.exerciseId === exerciseId)
  const scored = ownAttempts.filter((attempt): attempt is MasteryAttemptEvidence & { score: number } => attempt.score !== null)
  const perfect = ownAttempts.filter((attempt) => attempt.score === 100 && attempt.ceiling === 100)
  const masteryReadyAttempts = perfect.filter((attempt) => isValidMiniAdr(attempt.miniAdr))
  const latestCompletion = newest(perfect)
  const latestMasteryReady = newest(masteryReadyAttempts)
  const earliestMasteryReady = [...masteryReadyAttempts].sort(
    (left, right) => (timestamp(left.createdAt) ?? Infinity) - (timestamp(right.createdAt) ?? Infinity),
  )[0]
  const validTransfers = transferEvidence.filter((evidence) => {
    if (evidence.sourceExerciseId !== exerciseId || !earliestMasteryReady) return false
    const sharedConcepts = sharedLearningConcepts(
      evidence.sourceExerciseId,
      evidence.targetExerciseId,
      options.transferProfiles ?? [],
    )
    if (sharedConcepts.length === 0) return false
    if (evidence.conceptId && !sharedConcepts.includes(evidence.conceptId)) return false
    const readyAt = timestamp(earliestMasteryReady.createdAt)
    const transferredAt = timestamp(evidence.succeededAt)
    return readyAt !== null && transferredAt !== null && transferredAt > readyAt
  })
  const transfer = latestTransfer(validTransfers)
  const now = timestamp(options.now ?? Date.now()) ?? Date.now()
  const reviewAfterMs = Math.max(0, options.reviewAfterMs ?? DEFAULT_REVIEW_AFTER_MS)
  const transferAt = transfer ? timestamp(transfer.succeededAt) : null
  const mastered = transfer !== null
  const reviewDue = mastered && transferAt !== null && now - transferAt >= reviewAfterMs
  const attempted = ownAttempts.length > 0
  const completed = perfect.length > 0
  const bestScore = scored.length === 0 ? null : Math.max(...scored.map((attempt) => attempt.score))
  const state: MasteryState = reviewDue
    ? 'review-due'
    : mastered
      ? 'mastered'
      : completed
        ? 'completed'
        : attempted
          ? 'attempted'
          : 'unattempted'

  return {
    exerciseId,
    state,
    attempted,
    completed,
    masteryReady: latestMasteryReady !== null,
    mastered,
    reviewDue,
    bestScore,
    completedAt: latestCompletion?.createdAt ?? null,
    masteryReadyAt: latestMasteryReady?.createdAt ?? null,
    lastTransferAt: transfer?.succeededAt ?? null,
  }
}

export interface GameCompletionEligibility {
  eligible: boolean
  requiredCount: number
  masteredCount: number
  missingExerciseIds: string[]
  reviewDueExerciseIds: string[]
}

export function gameCompletionEligibility(
  requiredExerciseIds: readonly string[],
  mastery: readonly ExerciseMastery[],
): GameCompletionEligibility {
  const required = [...new Set(requiredExerciseIds)]
  const byExercise = new Map(mastery.map((entry) => [entry.exerciseId, entry]))
  const missingExerciseIds = required.filter((id) => !byExercise.get(id)?.mastered)
  const reviewDueExerciseIds = required.filter((id) => byExercise.get(id)?.reviewDue === true)
  const masteredCount = required.filter((id) => byExercise.get(id)?.mastered === true).length

  return {
    eligible: required.length > 0 && missingExerciseIds.length === 0 && reviewDueExerciseIds.length === 0,
    requiredCount: required.length,
    masteredCount,
    missingExerciseIds,
    reviewDueExerciseIds,
  }
}
