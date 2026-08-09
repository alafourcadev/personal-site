// Three drags of the same pair used to leave three identical, visually
// indistinguishable connections on the canvas and the same note repeated
// three times in the result panel, with no signal at all. Legality itself
// still belongs to the engine (checkConnection); this only answers "does
// this exact connection already exist".
import { describe, expect, it } from 'vitest'
import { duplicateConnectionMessage, findDuplicateEdge } from '../../src/lib/forja/canvas/connection-guard'
import type { Design } from '../../src/lib/forja/engine/types'

const design: Design = {
  nodes: [
    { id: 'svc', type: 'service', label: 'Servicio de cobros', zone: 'private', props: {} },
    { id: 'db', type: 'database', label: 'Base de movimientos', zone: 'restricted', props: {} },
    { id: 'q', type: 'queue', label: 'Cola de mensajes', zone: 'private', props: {} },
  ],
  edges: [{ id: 'e1', from: { node: 'svc' }, to: { node: 'db' } }],
}

describe('findDuplicateEdge', () => {
  it('finds the connection that already joins this exact pair in this exact direction', () => {
    expect(findDuplicateEdge(design, 'svc', 'db')?.id).toBe('e1')
  })

  it('the same pair in the opposite direction is a different connection, not a duplicate', () => {
    expect(findDuplicateEdge(design, 'db', 'svc')).toBeNull()
  })

  it('a pair that is not connected yet has no duplicate', () => {
    expect(findDuplicateEdge(design, 'svc', 'q')).toBeNull()
  })
})

describe('duplicateConnectionMessage', () => {
  it('names both ends so the player knows which connection already exists', () => {
    const message = duplicateConnectionMessage(design, 'svc', 'db')

    expect(message).toContain('Servicio de cobros')
    expect(message).toContain('Base de movimientos')
    expect(message.toLowerCase()).toContain('ya existe')
  })
})
