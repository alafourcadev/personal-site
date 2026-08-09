// C2: every attempt is stored and no screen reads it. With 168 exercises a
// player has no way to tell what they already solved, and `/forja/niveles`
// says "Jugable" twelve times. These are the pure reads the two list pages'
// client scripts run against the SAME LocalRankingAdapter the canvas writes
// to — no second storage layer, no recount of what the port already knows.
import { describe, expect, it } from 'vitest'
import {
  LocalRankingAdapter,
  type KeyValueStorage,
} from '../../src/lib/forja/ranking/local-adapter'
import type { Design } from '../../src/lib/forja/engine/types'
import {
  bestScore,
  exerciseProgress,
  overallProgressLabel,
  progressLabel,
  progressStateLabel,
  publishedLabel,
  solvedCount,
} from '../../src/lib/forja/progression/progress'

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  }
}

const design: Design = {
  nodes: [
    {
      id: 'n1',
      type: 'service',
      label: 'Servicio',
      zone: 'private',
      props: {},
    },
  ],
  edges: [],
}

function adapterWith(
  attempts: { exerciseId: string; score: number | null }[],
): LocalRankingAdapter {
  const adapter = new LocalRankingAdapter(memoryStorage())
  for (const { exerciseId, score } of attempts) {
    adapter.submit({
      exerciseId,
      design,
      score,
      ceiling: 100,
      engineVersion: 'test',
    })
  }
  return adapter
}

describe('bestScore', () => {
  it('is null for an exercise the player never opened', () => {
    expect(bestScore(adapterWith([]), 'n4-core-uno')).toBeNull()
  })

  it('is the best attempt, not the most recent one — a worse retry never erases a 100', () => {
    const adapter = adapterWith([
      { exerciseId: 'n4-core-uno', score: 100 },
      { exerciseId: 'n4-core-uno', score: 41 },
    ])
    expect(bestScore(adapter, 'n4-core-uno')).toBe(100)
  })

  it('ignores unscored attempts — an illegal design is history, not a score', () => {
    const adapter = adapterWith([
      { exerciseId: 'n4-core-uno', score: null },
      { exerciseId: 'n4-core-uno', score: 63 },
    ])
    expect(bestScore(adapter, 'n4-core-uno')).toBe(63)
  })

  it('is null when every attempt on the exercise was illegal', () => {
    expect(
      bestScore(
        adapterWith([{ exerciseId: 'n4-core-uno', score: null }]),
        'n4-core-uno',
      ),
    ).toBeNull()
  })

  it('never reads another exercise’s attempts', () => {
    const adapter = adapterWith([{ exerciseId: 'otro', score: 100 }])
    expect(bestScore(adapter, 'n4-core-uno')).toBeNull()
  })
})

describe('exerciseProgress', () => {
  it('reports an untouched exercise as unsolved with no score', () => {
    expect(exerciseProgress(adapterWith([]), 'n4-core-uno')).toMatchObject({
      exerciseId: 'n4-core-uno',
      attempted: false,
      completed: false,
      mastered: false,
      reviewDue: false,
      state: 'unattempted',
      solved: false,
      bestScore: null,
    })
  })

  it('reports a scored but imperfect exercise as attempted, not solved', () => {
    const adapter = adapterWith([{ exerciseId: 'n4-core-uno', score: 88 }])
    expect(exerciseProgress(adapter, 'n4-core-uno')).toMatchObject({
      exerciseId: 'n4-core-uno',
      attempted: true,
      completed: false,
      state: 'attempted',
      solved: false,
      bestScore: 88,
    })
  })

  it('uses a perfect result as the compatibility definition of solved', () => {
    const adapter = adapterWith([
      { exerciseId: 'perfect', score: 100 },
      { exerciseId: 'imperfect', score: 99 },
      { exerciseId: 'illegal', score: null },
    ])
    expect(exerciseProgress(adapter, 'perfect').solved).toBe(true)
    expect(exerciseProgress(adapter, 'imperfect').solved).toBe(false)
    expect(exerciseProgress(adapter, 'illegal').solved).toBe(false)
  })
})

describe('progressStateLabel', () => {
  const base = {
    attempted: false,
    completed: false,
    masteryReady: false,
    mastered: false,
    reviewDue: false,
    bestScore: null,
  }

  it('distinguishes partial work, structural completion, defense, transfer and review', () => {
    expect(
      progressStateLabel({ ...base, attempted: true, bestScore: 74 }),
    ).toBe('Intentado · mejor puntaje 74')
    expect(
      progressStateLabel({
        ...base,
        attempted: true,
        completed: true,
        bestScore: 100,
      }),
    ).toBe('100 · falta defender la decisión')
    expect(
      progressStateLabel({
        ...base,
        attempted: true,
        completed: true,
        masteryReady: true,
        bestScore: 100,
      }),
    ).toBe('100 · transferencia pendiente')
    expect(
      progressStateLabel({
        ...base,
        attempted: true,
        completed: true,
        masteryReady: true,
        mastered: true,
        bestScore: 100,
      }),
    ).toBe('Dominado')
    expect(
      progressStateLabel({
        ...base,
        attempted: true,
        completed: true,
        masteryReady: true,
        mastered: true,
        reviewDue: true,
        bestScore: 100,
      }),
    ).toBe('Repaso pendiente')
  })

  it('uses compact labels in the exercise menu', () => {
    expect(
      progressStateLabel(
        { ...base, attempted: true, bestScore: 74 },
        'compact',
      ),
    ).toBe('74')
    expect(
      progressStateLabel(
        { ...base, attempted: true, completed: true, bestScore: 100 },
        'compact',
      ),
    ).toBe('defender')
    expect(
      progressStateLabel(
        {
          ...base,
          attempted: true,
          completed: true,
          masteryReady: true,
          bestScore: 100,
        },
        'compact',
      ),
    ).toBe('transferir')
  })
})

describe('solvedCount', () => {
  it('counts exercises with a perfect completion, not merely a score', () => {
    const adapter = adapterWith([
      { exerciseId: 'a', score: 100 },
      { exerciseId: 'a', score: 90 },
      { exerciseId: 'b', score: 50 },
    ])
    expect(solvedCount(adapter, ['a', 'b', 'c'])).toBe(1)
  })

  it('counts nothing on a first visit', () => {
    expect(solvedCount(adapterWith([]), ['a', 'b'])).toBe(0)
  })

  it('never counts an exercise that is not in the given level', () => {
    const adapter = adapterWith([{ exerciseId: 'de-otro-nivel', score: 100 }])
    expect(solvedCount(adapter, ['a', 'b'])).toBe(0)
  })

  it('is 0 for a level with no published exercises', () => {
    expect(
      solvedCount(adapterWith([{ exerciseId: 'a', score: 100 }]), []),
    ).toBe(0)
  })
})

describe('progressLabel — the copy the player reads', () => {
  it('states both numbers, never a bare count', () => {
    expect(progressLabel(3, 14)).toBe('3 de 14 resueltos')
  })

  it('says nothing is solved yet instead of printing a hollow 0', () => {
    expect(progressLabel(0, 14)).toBe(
      '14 ejercicios · todavía ninguno resuelto',
    )
  })

  it('says the level is finished when every exercise is solved', () => {
    expect(progressLabel(14, 14)).toBe('14 de 14 resueltos · nivel completo')
  })

  it('is honest about a level with nothing published yet', () => {
    expect(progressLabel(0, 0)).toBe('Todavía sin ejercicios publicados')
  })

  it('never says "1 ejercicios"', () => {
    expect(progressLabel(0, 1)).toBe('1 ejercicio · todavía ninguno resuelto')
  })

  it('never says "1 resueltos"', () => {
    expect(progressLabel(1, 14)).toBe('1 de 14 resuelto')
  })
})

// Both list pages are static HTML; the progress lives in localStorage and
// can only be read in the browser. This is what the server renders in the
// meantime — it must be true for every player at once, which any sentence
// containing a solved count is not.
describe('publishedLabel — the honest state before localStorage is read', () => {
  it('states the size of the level and claims nothing about progress', () => {
    const label = publishedLabel(14)
    expect(label).toBe('14 ejercicios publicados')
    expect(label).not.toContain('resuel')
  })

  it('never says "1 ejercicios"', () => {
    expect(publishedLabel(1)).toBe('1 ejercicio publicado')
  })

  it('is honest about a level with nothing published', () => {
    expect(publishedLabel(0)).toBe('Todavía sin ejercicios publicados')
  })
})

describe('overallProgressLabel — the same numbers across the whole game', () => {
  it('says what the figures are about — a bare "12 de 168" means nothing on a map page', () => {
    expect(overallProgressLabel(12, 168)).toBe(
      '12 de 168 ejercicios resueltos en toda La Forja',
    )
  })

  it('does not claim a level is complete — it is not talking about a level', () => {
    expect(overallProgressLabel(168, 168)).not.toContain('nivel')
  })

  it('states the size of the game before the player has solved anything', () => {
    expect(overallProgressLabel(0, 168)).toBe(
      '168 ejercicios publicados · todavía ninguno resuelto',
    )
  })
})
