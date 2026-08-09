// The canonical order a level's exercises are played in. Until now the list
// page rendered whatever `getCollection` returned, which is the filesystem's
// alphabetical order of the slug — so `counter-trap` landed before `synthesis`
// before `tradeoff` before `trap`, in all twelve levels.
//
// That is not a cosmetic complaint. The counter-trap's own body says "recién
// saliste de un ejercicio donde la respuesta era no guardar" and "el mismo
// hotel del ejercicio anterior", referring to a trap that alphabetical order
// puts SIX positions further down. The text was correct; the order lied.
//
// Doc §14.4's sequence: calibración → núcleo → tradeoff (en pares) →
// trampa → contra-trampa → síntesis.
import { describe, expect, it } from 'vitest'
import { ROLE_ORDER, nextExercise, orderExercises, type OrderableExercise } from '../../src/lib/forja/progression/order'

function ex(overrides: Partial<OrderableExercise> & { id: string }): OrderableExercise {
  return {
    role: 'core',
    difficultyIndex: 10,
    ...overrides,
  }
}

describe('ROLE_ORDER', () => {
  it('puts every role of both tiers in the doc’s own sequence', () => {
    expect(ROLE_ORDER).toEqual([
      'calibration',
      'core',
      'greenfield',
      'tradeoff',
      'trap',
      'counter-trap',
      'synthesis',
    ])
  })

  // The empty canvas asks which pieces should exist. A player can only be
  // asked to choose the pieces after the level's own core exercises have shown
  // what those pieces do, so it comes after core and before the contrasted
  // pairs that trade one against another.
  it('opens the empty canvas after the core exercises that teach the pieces', () => {
    expect(ROLE_ORDER.indexOf('core')).toBeLessThan(ROLE_ORDER.indexOf('greenfield'))
    expect(ROLE_ORDER.indexOf('greenfield')).toBeLessThan(ROLE_ORDER.indexOf('tradeoff'))
  })

  it('places the trap before the counter-trap that answers it', () => {
    expect(ROLE_ORDER.indexOf('trap')).toBeLessThan(ROLE_ORDER.indexOf('counter-trap'))
  })

  it('closes the level with the synthesis', () => {
    expect(ROLE_ORDER[ROLE_ORDER.length - 1]).toBe('synthesis')
  })

  it('opens the level with the calibration', () => {
    expect(ROLE_ORDER[0]).toBe('calibration')
  })
})

describe('orderExercises — by role first', () => {
  it('sorts a shuffled level into the canonical sequence', () => {
    const shuffled = [
      ex({ id: 'syn', role: 'synthesis' }),
      ex({ id: 'ct', role: 'counter-trap' }),
      ex({ id: 'core1', role: 'core' }),
      ex({ id: 'cal', role: 'calibration' }),
      ex({ id: 'tr', role: 'trap' }),
      ex({ id: 'td', role: 'tradeoff', tradeoffPairId: 'p' }),
    ]
    expect(orderExercises(shuffled).map((e) => e.id)).toEqual(['cal', 'core1', 'td', 'tr', 'ct', 'syn'])
  })

  it('is stable — ordering an already-ordered level changes nothing', () => {
    const once = orderExercises([
      ex({ id: 'b', role: 'core', difficultyIndex: 12 }),
      ex({ id: 'a', role: 'core', difficultyIndex: 10 }),
    ])
    expect(orderExercises(once).map((e) => e.id)).toEqual(once.map((e) => e.id))
  })

  it('never drops or duplicates an entry', () => {
    const input = [
      ex({ id: '1', role: 'trap' }),
      ex({ id: '2', role: 'core' }),
      ex({ id: '3', role: 'synthesis' }),
    ]
    const out = orderExercises(input)
    expect(out).toHaveLength(3)
    expect(new Set(out.map((e) => e.id))).toEqual(new Set(['1', '2', '3']))
  })
})

describe('orderExercises — inside a role, easiest first', () => {
  it('orders the six core exercises by difficulty index ascending', () => {
    const cores = [
      ex({ id: 'c14', role: 'core', difficultyIndex: 14 }),
      ex({ id: 'c10', role: 'core', difficultyIndex: 10 }),
      ex({ id: 'c12', role: 'core', difficultyIndex: 12 }),
    ]
    expect(orderExercises(cores).map((e) => e.id)).toEqual(['c10', 'c12', 'c14'])
  })

  it('breaks a difficulty tie by id, so the order never depends on input shuffle', () => {
    const a = orderExercises([ex({ id: 'zeta' }), ex({ id: 'alfa' })]).map((e) => e.id)
    const b = orderExercises([ex({ id: 'alfa' }), ex({ id: 'zeta' })]).map((e) => e.id)
    expect(a).toEqual(b)
    expect(a).toEqual(['alfa', 'zeta'])
  })
})

describe('orderExercises — a contrasted pair is never split', () => {
  it('keeps both halves of a pair adjacent even when a third tradeoff sorts between them', () => {
    // Difficulty alone would interleave the two pairs: 10, 11, 12, 13.
    // The pair is the teaching unit, so it must stay whole.
    const tradeoffs = [
      ex({ id: 'a1', role: 'tradeoff', tradeoffPairId: 'A', difficultyIndex: 10 }),
      ex({ id: 'b1', role: 'tradeoff', tradeoffPairId: 'B', difficultyIndex: 11 }),
      ex({ id: 'a2', role: 'tradeoff', tradeoffPairId: 'A', difficultyIndex: 12 }),
      ex({ id: 'b2', role: 'tradeoff', tradeoffPairId: 'B', difficultyIndex: 13 }),
    ]
    const ids = orderExercises(tradeoffs).map((e) => e.id)
    expect(ids).toEqual(['a1', 'a2', 'b1', 'b2'])
  })

  it('orders the pairs themselves by their easiest half', () => {
    const tradeoffs = [
      ex({ id: 'hard1', role: 'tradeoff', tradeoffPairId: 'H', difficultyIndex: 20 }),
      ex({ id: 'easy1', role: 'tradeoff', tradeoffPairId: 'E', difficultyIndex: 8 }),
      ex({ id: 'hard2', role: 'tradeoff', tradeoffPairId: 'H', difficultyIndex: 21 }),
      ex({ id: 'easy2', role: 'tradeoff', tradeoffPairId: 'E', difficultyIndex: 9 }),
    ]
    expect(orderExercises(tradeoffs).map((e) => e.id)).toEqual(['easy1', 'easy2', 'hard1', 'hard2'])
  })

  it('does not choke on a tradeoff with no pair id', () => {
    const out = orderExercises([
      ex({ id: 'lonely', role: 'tradeoff' }),
      ex({ id: 'paired', role: 'tradeoff', tradeoffPairId: 'P' }),
    ])
    expect(out).toHaveLength(2)
  })
})

describe('nextExercise — what the player opens after finishing one', () => {
  const level = [
    ex({ id: 'syn', role: 'synthesis' }),
    ex({ id: 'cal', role: 'calibration' }),
    ex({ id: 'core', role: 'core' }),
  ]

  it('follows the canonical order, not the input order', () => {
    expect(nextExercise(level, 'cal')?.id).toBe('core')
    expect(nextExercise(level, 'core')?.id).toBe('syn')
  })

  it('returns null on the last exercise of the level', () => {
    expect(nextExercise(level, 'syn')).toBeNull()
  })

  it('returns null for an id that is not in the level', () => {
    expect(nextExercise(level, 'no-existe')).toBeNull()
  })

  it('never sends the player back to the exercise they just finished', () => {
    for (const e of level) {
      expect(nextExercise(level, e.id)?.id).not.toBe(e.id)
    }
  })
})
