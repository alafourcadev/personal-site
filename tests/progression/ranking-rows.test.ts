// C1: the strip called `getSnapshot()` with no exerciseId, so opening an
// exercise you never touched showed "#1 · Vos · 100" — another exercise's
// score, presented as this one's. Filtering fixes the scoped case; the
// unscoped case (free play at `/forja`, which legitimately shows every
// exercise) needs the opposite: a row must never be a number without saying
// what it is a number OF.
import { describe, expect, it } from 'vitest'
import { rankingEmptyLabel, rankingRowLabel } from '../../src/lib/forja/progression/ranking-rows'

const titles = { 'n4-el-pago-que-espera-al-email': 'El pago que espera al email' }

describe('rankingRowLabel — a strip scoped to one exercise', () => {
  it('does not repeat the exercise name the page already shows', () => {
    expect(rankingRowLabel({ position: 1, exerciseId: 'n4-el-pago-que-espera-al-email', titles: null })).toBe('#1 · Vos')
  })

  it('numbers the row from 1, not from the array index', () => {
    expect(rankingRowLabel({ position: 3, exerciseId: 'x', titles: null })).toBe('#3 · Vos')
  })
})

describe('rankingRowLabel — the unscoped strip', () => {
  it('names the exercise every row belongs to', () => {
    expect(rankingRowLabel({ position: 1, exerciseId: 'n4-el-pago-que-espera-al-email', titles })).toBe(
      '#1 · Vos · El pago que espera al email',
    )
  })

  it('says so honestly when the attempt belongs to an exercise that is no longer published', () => {
    expect(rankingRowLabel({ position: 2, exerciseId: 'n7-trap-un-ejercicio-retirado', titles })).toBe(
      '#2 · Vos · Ejercicio que ya no está publicado',
    )
  })

  // The slug carries the exercise's authoring role ("…-trap-…"). Falling back
  // to it would leak exactly what fix B removes from the list page.
  it('never falls back to the raw slug', () => {
    const label = rankingRowLabel({ position: 2, exerciseId: 'n7-trap-un-ejercicio-retirado', titles })
    expect(label).not.toContain('trap')
    expect(label).not.toContain('n7-')
  })
})

// The same string is rendered twice — once by the server into the static
// HTML, once by the client script when it finds no attempt — so it lives
// here rather than being typed into the component in two places.
describe('rankingEmptyLabel', () => {
  it('says the player has not played THIS exercise when the strip is scoped to one', () => {
    expect(rankingEmptyLabel(true)).toBe('Todavía no guardaste ningún intento en este ejercicio.')
  })

  it('stays general when the strip is not scoped', () => {
    expect(rankingEmptyLabel(false)).toBe('Todavía no hay intentos guardados.')
  })
})
