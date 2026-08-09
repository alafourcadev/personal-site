import { describe, expect, it } from 'vitest'
import {
  attachTransferEvidence,
  createTransferEvidence,
  exerciseMastery,
  gameCompletionEligibility,
  selectTransferSourceForPerfectAttempt,
  validateMiniAdr,
  type MasteryAttemptEvidence,
  type MiniAdr,
} from '../../src/lib/forja/progression/mastery'
import type { ExerciseLearningConcepts } from '../../src/lib/forja/progression/learning-concepts'

const miniAdr: MiniAdr = {
  optimized: 'Latencia de lectura',
  sacrificed: 'Consistencia inmediata',
  whoPays: 'Operaciones durante reconciliaciones',
  inversionFact: 'Si los conflictos superan el 1%, elegir una fuente única',
}

const transferProfiles: ExerciseLearningConcepts[] = [
  { exerciseId: 'source', conceptIds: ['async-delivery'] },
  { exerciseId: 'target', conceptIds: ['async-delivery'] },
  { exerciseId: 'renewal', conceptIds: ['async-delivery'] },
  { exerciseId: 'unrelated', conceptIds: ['data-ownership'] },
]

function attempt(
  id: string,
  exerciseId: string,
  score: number | null,
  createdAt: string,
  adr?: MiniAdr,
): MasteryAttemptEvidence {
  return { id, exerciseId, score, ceiling: 100, createdAt, miniAdr: adr }
}

describe('mini ADR validation', () => {
  it('requires all four structured fields and normalizes whitespace', () => {
    expect(validateMiniAdr({ ...miniAdr, optimized: '  Latencia de lectura  ' })).toEqual({
      valid: true,
      value: miniAdr,
    })
    expect(validateMiniAdr({ optimized: 'Latencia baja' })).toMatchObject({
      valid: false,
      issues: [
        { field: 'sacrificed', code: 'required' },
        { field: 'whoPays', code: 'required' },
        { field: 'inversionFact', code: 'required' },
      ],
    })
  })

  it('rejects an optimized and sacrificed claim that says the same thing', () => {
    expect(validateMiniAdr({ ...miniAdr, sacrificed: 'LATENCIA DE LECTURA' })).toMatchObject({
      valid: false,
      issues: [{ field: 'sacrificed', code: 'tradeoff-not-distinct' }],
    })
  })

  it('rejects four one-character answers and accepts concise Spanish reasoning', () => {
    expect(
      validateMiniAdr({
        optimized: 'a',
        sacrificed: 'b',
        whoPays: 'c',
        inversionFact: 'd',
      }),
    ).toEqual({
      valid: false,
      issues: [
        { field: 'optimized', code: 'not-articulated' },
        { field: 'sacrificed', code: 'not-articulated' },
        { field: 'whoPays', code: 'not-articulated' },
        { field: 'inversionFact', code: 'not-articulated' },
      ],
    })
    expect(
      validateMiniAdr({
        optimized: 'Menos espera',
        sacrificed: 'Más costo',
        whoPays: 'El equipo',
        inversionFact: 'Si falla',
      }),
    ).toMatchObject({ valid: true })
  })
})

describe('mastery progression', () => {
  const first = '2026-01-01T00:00:00.000Z'
  const later = '2026-01-02T00:00:00.000Z'

  it('separates attempted, completed, mastery-ready, and mastered', () => {
    expect(exerciseMastery('source', [attempt('a1', 'source', 60, first)])).toMatchObject({
      state: 'attempted',
      attempted: true,
      completed: false,
      mastered: false,
    })
    expect(exerciseMastery('source', [attempt('a1', 'source', 100, first)])).toMatchObject({
      state: 'completed',
      completed: true,
      masteryReady: false,
      mastered: false,
    })
    expect(exerciseMastery('source', [attempt('a1', 'source', 100, first, miniAdr)])).toMatchObject({
      state: 'completed',
      completed: true,
      masteryReady: true,
      mastered: false,
    })
  })

  it('requires a later perfect result on a different exercise as transfer evidence', () => {
    const target = attempt('b1', 'target', 100, later)
    const created = createTransferEvidence('source', first, target, transferProfiles)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(created.evidence).toMatchObject({ conceptId: 'async-delivery' })
    expect(exerciseMastery('source', [attempt('a1', 'source', 100, first, miniAdr)], [created.evidence], {
      now: later,
      transferProfiles,
    })).toMatchObject({ state: 'mastered', mastered: true, reviewDue: false })
    expect(createTransferEvidence('source', first, { ...target, exerciseId: 'source' }, transferProfiles)).toEqual({
      ok: false,
      reason: 'same-exercise',
    })
    expect(createTransferEvidence('source', first, { ...target, score: 99 }, transferProfiles)).toEqual({
      ok: false,
      reason: 'target-not-perfect',
    })
  })

  it('rejects a merely later perfect exercise when no learning concept is shared', () => {
    expect(
      createTransferEvidence(
        'source',
        first,
        attempt('unrelated-1', 'unrelated', 100, later),
        transferProfiles,
      ),
    ).toEqual({ ok: false, reason: 'incompatible-exercises' })
  })

  it('attaches transfer evidence idempotently for caller-selected source exercises', () => {
    const target = attempt('b1', 'target', 100, later)
    const firstAttach = attachTransferEvidence([], 'source', first, target, transferProfiles)
    expect(firstAttach).toMatchObject({ ok: true, deduplicated: false })
    if (!firstAttach.ok) return
    const repeat = attachTransferEvidence(firstAttach.evidenceList, 'source', first, target, transferProfiles)
    expect(repeat).toMatchObject({ ok: true, deduplicated: true })
    if (repeat.ok) expect(repeat.evidenceList).toHaveLength(1)
  })

  it('marks review due from the latest successful transfer and never loses earlier mastery', () => {
    const evidence = attachTransferEvidence([], 'source', first, attempt('b1', 'target', 100, later), transferProfiles)
    if (!evidence.ok) throw new Error('test fixture must produce transfer evidence')
    const result = exerciseMastery(
      'source',
      [
        attempt('a1', 'source', 100, first, miniAdr),
        attempt('a2', 'source', 100, '2026-01-03T00:00:00.000Z', miniAdr),
      ],
      evidence.evidenceList,
      {
        now: '2026-02-02T00:00:00.000Z',
        reviewAfterMs: 30 * 24 * 60 * 60 * 1000,
        transferProfiles,
      },
    )
    expect(result).toMatchObject({ mastered: true, reviewDue: true, state: 'review-due' })
  })

  it('preserves compatible legacy evidence and ignores incompatible legacy evidence', () => {
    const own = [attempt('a1', 'source', 100, first, miniAdr)]
    const legacy = {
      sourceExerciseId: 'source',
      targetExerciseId: 'target',
      targetAttemptId: 'legacy-1',
      succeededAt: later,
    }
    expect(exerciseMastery('source', own, [legacy], { now: later, transferProfiles })).toMatchObject({
      mastered: true,
    })
    expect(
      exerciseMastery(
        'source',
        own,
        [{ ...legacy, targetExerciseId: 'unrelated' }],
        { now: later, transferProfiles },
      ),
    ).toMatchObject({ mastered: false })
  })
})

describe('transfer source selection', () => {
  it('selects the most recent eligible source before a later perfect target', () => {
    const older = exerciseMastery('older', [attempt('a1', 'older', 100, '2026-01-01T00:00:00.000Z', miniAdr)])
    const recent = exerciseMastery('recent', [attempt('a2', 'recent', 100, '2026-01-03T00:00:00.000Z', miniAdr)])
    const alreadyMastered = {
      ...exerciseMastery('mastered', [attempt('a3', 'mastered', 100, '2026-01-04T00:00:00.000Z', miniAdr)]),
      mastered: true,
    }
    const target = attempt('target-1', 'target', 100, '2026-01-05T00:00:00.000Z')
    const profiles: ExerciseLearningConcepts[] = [
      { exerciseId: 'older', conceptIds: ['shared'] },
      { exerciseId: 'recent', conceptIds: ['shared'] },
      { exerciseId: 'mastered', conceptIds: ['shared'] },
      { exerciseId: 'target', conceptIds: ['shared'] },
    ]

    expect(selectTransferSourceForPerfectAttempt([older, alreadyMastered, recent], target, profiles)).toEqual({
      sourceExerciseId: 'recent',
      sourceCompletedAt: '2026-01-03T00:00:00.000Z',
      conceptId: 'shared',
    })
  })

  it('excludes the target exercise, future readiness, mastered rows, and imperfect targets', () => {
    const same = exerciseMastery('target', [attempt('a1', 'target', 100, '2026-01-01T00:00:00.000Z', miniAdr)])
    const future = exerciseMastery('future', [attempt('a2', 'future', 100, '2026-01-06T00:00:00.000Z', miniAdr)])
    const target = attempt('target-1', 'target', 100, '2026-01-05T00:00:00.000Z')
    const profiles: ExerciseLearningConcepts[] = [
      { exerciseId: 'target', conceptIds: ['shared'] },
      { exerciseId: 'future', conceptIds: ['shared'] },
    ]
    expect(selectTransferSourceForPerfectAttempt([same, future], target, profiles)).toBeNull()
    expect(selectTransferSourceForPerfectAttempt([future], { ...target, score: 99 }, profiles)).toBeNull()
  })

  it('renews a review-due source with newer compatible evidence', () => {
    const first = '2026-01-01T00:00:00.000Z'
    const initialTransfer = attachTransferEvidence(
      [],
      'source',
      first,
      attempt('target-1', 'target', 100, '2026-01-02T00:00:00.000Z'),
      transferProfiles,
    )
    if (!initialTransfer.ok) throw new Error('fixture must create initial evidence')
    const due = exerciseMastery(
      'source',
      [attempt('source-1', 'source', 100, first, miniAdr)],
      initialTransfer.evidenceList,
      { now: '2026-02-02T00:00:00.000Z', transferProfiles },
    )
    expect(due.reviewDue).toBe(true)

    const renewalAttempt = attempt('renewal-1', 'renewal', 100, '2026-02-03T00:00:00.000Z')
    const selected = selectTransferSourceForPerfectAttempt([due], renewalAttempt, transferProfiles)
    expect(selected).toMatchObject({ sourceExerciseId: 'source', conceptId: 'async-delivery' })
    if (!selected) throw new Error('review-due source must remain eligible')
    const renewedEvidence = attachTransferEvidence(
      initialTransfer.evidenceList,
      selected.sourceExerciseId,
      selected.sourceCompletedAt,
      renewalAttempt,
      transferProfiles,
    )
    if (!renewedEvidence.ok) throw new Error('fixture must create renewal evidence')
    const renewed = exerciseMastery(
      'source',
      [attempt('source-1', 'source', 100, first, miniAdr)],
      renewedEvidence.evidenceList,
      { now: renewalAttempt.createdAt, transferProfiles },
    )
    expect(renewed).toMatchObject({ mastered: true, reviewDue: false, state: 'mastered' })
    expect(gameCompletionEligibility(['source'], [renewed])).toMatchObject({
      eligible: true,
      reviewDueExerciseIds: [],
    })
  })
})

describe('game completion eligibility', () => {
  it('requires every unique required exercise to be mastered and current', () => {
    const current = {
      exerciseId: 'a',
      state: 'mastered' as const,
      attempted: true,
      completed: true,
      masteryReady: true,
      mastered: true,
      reviewDue: false,
      bestScore: 100,
      completedAt: '2026-01-01T00:00:00.000Z',
      masteryReadyAt: '2026-01-01T00:00:00.000Z',
      lastTransferAt: '2026-01-02T00:00:00.000Z',
    }
    expect(gameCompletionEligibility(['a', 'a'], [current])).toMatchObject({
      eligible: true,
      requiredCount: 1,
      masteredCount: 1,
    })
    expect(gameCompletionEligibility(['a', 'b'], [current])).toMatchObject({
      eligible: false,
      missingExerciseIds: ['b'],
    })
    expect(gameCompletionEligibility([], [])).toMatchObject({ eligible: false, requiredCount: 0 })
    expect(gameCompletionEligibility(['a'], [{ ...current, state: 'review-due', reviewDue: true }])).toMatchObject({
      eligible: false,
      reviewDueExerciseIds: ['a'],
    })
  })
})
