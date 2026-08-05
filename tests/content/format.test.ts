// R1-G requirement 2: "el jugador tiene que saber contra qué está
// diseñando... aplicá el requisito de lenguaje llano, no filtres
// vocabulario interno del motor." `opsUnits` is a field name from the
// engine's own `Budget` type — the brief must never print that literal
// identifier, only "unidades operativas" (the same phrase the exercise
// prose itself already uses, e.g. core-el-pago-que-espera-al-email.md).
import { describe, expect, it } from 'vitest'
import { formatBudget, formatConstraint } from '../../src/lib/forja/content/format'

describe('formatConstraint', () => {
  it('renders operator, value and unit as a plain sentence, never the raw comparator symbol', () => {
    const text = formatConstraint({ metric: 'tiempo de confirmación', operator: '<=', value: 2, unit: 'segundos' })
    expect(text).toBe('tiempo de confirmación: como máximo 2 segundos')
    expect(text).not.toContain('<=')
  })

  it('covers every operator with a distinct plain-language word', () => {
    const words = (['>=', '<=', '=', '<', '>'] as const).map(
      (operator) => formatConstraint({ metric: 'm', operator, value: 1, unit: 'u' }).split(': ')[1].split(' ')[0],
    )
    expect(new Set(words).size).toBe(5)
  })
})

describe('formatBudget', () => {
  it('never prints the internal field name "opsUnits"', () => {
    const text = formatBudget({ opsUnits: 8 })
    expect(text).not.toContain('opsUnits')
    expect(text).toContain('8')
    expect(text).toContain('unidades operativas')
  })

  it('pluralizes a single unit correctly', () => {
    expect(formatBudget({ opsUnits: 1 })).toContain('1 unidad operativa')
  })

  it('appends the monthly USD figure only when the exercise declares one', () => {
    expect(formatBudget({ opsUnits: 8 })).not.toContain('USD')
    expect(formatBudget({ opsUnits: 8, monthlyUsd: 50 })).toContain('USD 50')
  })
})
