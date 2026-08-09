// Two rules still printed raw property keys and English values in the
// evidence line the player reads — `backup: none` and `at-least-once` —
// while their neighbour `single-point-of-failure` already translates its
// own (`réplicas: 1 · criticidad: alta`). They were the last two that did
// not follow the rule the file had already set for itself.
//
// §5 of the shared context: zero engine vocabulary in what the player reads.
import { describe, expect, it } from 'vitest'
import { evaluateLegality } from '../../src/lib/forja/engine'
import type { Design } from '../../src/lib/forja/engine/types'

function evidenceFor(rule: string, design: Design): string {
  const finding = evaluateLegality(design).findings.find((f) => f.rule === rule)
  expect(finding, `la regla ${rule} no disparó`).toBeDefined()
  return finding!.evidence
}

describe('regulated-without-backup — la evidencia no nombra la propiedad interna', () => {
  const design: Design = {
    nodes: [
      { id: 's', type: 'service', label: 'Servicio de legajos', zone: 'private', props: {} },
      { id: 'db', type: 'database', label: 'Base de legajos', zone: 'restricted', props: { backup: 'none' } },
    ],
    edges: [{ id: 'e', from: { node: 's' }, to: { node: 'db' }, dataClass: 'regulated' }],
  }

  it('no imprime la clave `backup`', () => {
    expect(evidenceFor('regulated-without-backup', design)).not.toContain('backup')
  })

  it('no imprime el valor `none`', () => {
    expect(evidenceFor('regulated-without-backup', design)).not.toContain('none')
  })

  it('sigue nombrando la pieza para que se sepa cuál es', () => {
    expect(evidenceFor('regulated-without-backup', design)).toContain('Base de legajos')
  })

  it('dice en castellano que no tiene respaldo', () => {
    expect(evidenceFor('regulated-without-backup', design).toLowerCase()).toContain('respaldo')
  })
})

describe('queue-without-dlq — la evidencia no nombra el valor interno', () => {
  const design: Design = {
    nodes: [
      { id: 's', type: 'service', label: 'Servicio de avisos', zone: 'private', props: {} },
      { id: 'q', type: 'queue', label: 'Cola de avisos', zone: 'private', props: { delivery: 'at-least-once', dlq: 'no' } },
      { id: 'w', type: 'worker', label: 'Procesador', zone: 'private', props: {} },
    ],
    edges: [
      { id: 'e1', from: { node: 's' }, to: { node: 'q' } },
      { id: 'e2', from: { node: 'q' }, to: { node: 'w' } },
    ],
  }

  it('no imprime `at-least-once`', () => {
    expect(evidenceFor('queue-without-dlq', design)).not.toContain('at-least-once')
  })

  it('sigue nombrando la pieza', () => {
    expect(evidenceFor('queue-without-dlq', design)).toContain('Cola de avisos')
  })

  it('sigue diciendo que le falta el destino de los fallos', () => {
    expect(evidenceFor('queue-without-dlq', design).toLowerCase()).toContain('muertos')
  })
})

describe('el veredicto no cambió — sólo el texto', () => {
  it('regulated-without-backup sigue siendo bloqueante', () => {
    const design: Design = {
      nodes: [
        { id: 's', type: 'service', label: 'S', zone: 'private', props: {} },
        { id: 'db', type: 'database', label: 'DB', zone: 'restricted', props: { backup: 'none' } },
      ],
      edges: [{ id: 'e', from: { node: 's' }, to: { node: 'db' }, dataClass: 'regulated' }],
    }
    const f = evaluateLegality(design).findings.find((x) => x.rule === 'regulated-without-backup')
    expect(f?.severity).toBe('blocking')
    expect(f?.title).toBe('Dato regulado sin respaldo')
  })

  it('queue-without-dlq sigue siendo advertencia', () => {
    const design: Design = {
      nodes: [
        { id: 's', type: 'service', label: 'S', zone: 'private', props: {} },
        { id: 'q', type: 'queue', label: 'Q', zone: 'private', props: { delivery: 'at-least-once', dlq: 'no' } },
        { id: 'w', type: 'worker', label: 'W', zone: 'private', props: {} },
      ],
      edges: [
        { id: 'e1', from: { node: 's' }, to: { node: 'q' } },
        { id: 'e2', from: { node: 'q' }, to: { node: 'w' } },
      ],
    }
    const f = evaluateLegality(design).findings.find((x) => x.rule === 'queue-without-dlq')
    expect(f?.severity).toBe('warning')
    expect(f?.title).toBe('Cola sin destino para mensajes fallidos')
  })
})
