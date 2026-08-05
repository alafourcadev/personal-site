// PC16: a player-assigned colour is "purely presentational: it MUST NOT
// affect evaluation, legality, or score." Proven at the engine boundary,
// not the UI — colour is a scoring-irrelevant concern by construction if
// (and only if) nothing under src/lib/forja/engine ever reads `node.color`.
import { describe, expect, it } from 'vitest'
import { evaluate, evaluateLegality, checkConnection } from '../../src/lib/forja/engine/index'
import type { Design, DesignNode, ExerciseSpec } from '../../src/lib/forja/engine/types'

function design(color?: DesignNode['color']): Design {
  return {
    nodes: [
      { id: 'a', type: 'web-client', zone: 'public', label: 'Cliente', props: {}, color },
      { id: 'b', type: 'api-gateway', zone: 'dmz', label: 'Gateway', props: { authn: 'sí', rateLimit: 'sí' }, color },
    ],
    edges: [{ id: 'a->b', from: { node: 'a' }, to: { node: 'b' } }],
  }
}

const exercise: ExerciseSpec = {
  guarantees: [
    {
      id: 'g1',
      label: 'hay una puerta de entrada',
      weight: 1,
      predicate: { op: 'exists', node: { type: ['api-gateway'] } },
      whyMissing: 'Falta la puerta de entrada.',
      consequence: 'Nada valida el tráfico entrante.',
    },
  ],
  budget: { opsUnits: 10 },
  lambda: 0.5,
}

describe('player colour is engine-neutral [PC16]', () => {
  it('evaluate() returns the same score and findings regardless of colour', () => {
    const withoutColor = evaluate(design(undefined), exercise)
    const withColor = evaluate(design('violet'), exercise)

    expect(withColor.score).toBe(withoutColor.score)
    expect(withColor.status).toBe(withoutColor.status)
    expect(withColor.findings.map((f) => f.rule)).toEqual(withoutColor.findings.map((f) => f.rule))
  })

  it('evaluateLegality() is unaffected by colour', () => {
    const withoutColor = evaluateLegality(design(undefined))
    const withColor = evaluateLegality(design('rose'))

    expect(withColor.legal).toBe(withoutColor.legal)
    expect(withColor.findings).toEqual(withoutColor.findings)
  })

  it('checkConnection() verdicts are unaffected by colour', () => {
    const withoutColor = checkConnection(design(undefined), { node: 'a' }, { node: 'b' })
    const withColor = checkConnection(design('amber'), { node: 'a' }, { node: 'b' })

    expect(withColor).toEqual(withoutColor)
  })

  it('no source file under the engine reads `.color`', async () => {
    const { readFileSync } = await import('node:fs')
    const files = [
      'src/lib/forja/engine/legality.ts',
      'src/lib/forja/engine/rules.ts',
      'src/lib/forja/engine/predicates.ts',
      'src/lib/forja/engine/cost.ts',
      'src/lib/forja/engine/score.ts',
      'src/lib/forja/engine/index.ts',
    ]
    for (const file of files) {
      const source = readFileSync(file, 'utf-8')
      expect(source.includes('.color')).toBe(false)
    }
  })
})
