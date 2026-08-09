// Creating a component announced itself ("Servicio creado."); deleting one
// left the status bar empty — measured across six deletions. Combined with
// a mis-targeted click that selects the wrong connection, a player could
// destroy a satisfied objective and get no signal whatsoever.
import { describe, expect, it } from 'vitest'
import {
  connectionCreatedMessage,
  connectionDroppedMessage,
  deletionMessage,
  edgeDescription,
} from '../../src/lib/forja/canvas/announcements'
import type { Design } from '../../src/lib/forja/engine/types'

const design: Design = {
  nodes: [
    { id: 'svc', type: 'service', label: 'Servicio de cobros', zone: 'private', props: {} },
    { id: 'db', type: 'database', label: 'Base de movimientos', zone: 'restricted', props: {} },
  ],
  edges: [{ id: 'e1', from: { node: 'svc' }, to: { node: 'db' } }],
}

describe('edgeDescription', () => {
  it('describes a connection by both of its ends', () => {
    expect(edgeDescription(design, 'e1')).toBe('de Servicio de cobros a Base de movimientos')
  })

  it('an unknown connection still produces a readable description', () => {
    expect(edgeDescription(design, 'nope')).toBe('sin identificar')
  })
})

describe('deletionMessage', () => {
  it('says nothing when nothing was deleted', () => {
    expect(deletionMessage([], [])).toBe('')
  })

  it('names the single component that was deleted', () => {
    expect(deletionMessage(['Servicio de cobros'], [])).toBe('Se eliminó Servicio de cobros.')
  })

  it('counts several deleted components', () => {
    expect(deletionMessage(['A', 'B'], [])).toBe('Se eliminaron 2 componentes.')
  })

  it('names the single connection that was deleted', () => {
    expect(deletionMessage([], ['de Servicio de cobros a Base de movimientos'])).toBe(
      'Se eliminó la conexión de Servicio de cobros a Base de movimientos.',
    )
  })

  it('counts several deleted connections', () => {
    expect(deletionMessage([], ['de A a B', 'de B a C'])).toBe('Se eliminaron 2 conexiones.')
  })

  it('reports the connections a deleted component took down with it', () => {
    expect(deletionMessage(['Servicio de cobros'], ['de A a B', 'de B a C'])).toBe(
      'Se eliminó Servicio de cobros y sus 2 conexiones.',
    )
  })

  it('reports a single connection taken down with its component', () => {
    expect(deletionMessage(['Servicio de cobros'], ['de A a B'])).toBe('Se eliminó Servicio de cobros y su conexión.')
  })
})

// Three gestures the canvas performed in silence.
//
// A rejected connection announced itself; a SUCCESSFUL one wrote the empty
// string — `setStatus(verdict.ok ? '' : …)` — which not only said nothing,
// it wiped whatever the previous gesture had said. Creating a component
// announced itself the whole time, so the player learned that silence means
// nothing happened, and then drew a connection that worked.
//
// And a drag released anywhere other than a handle returned without a word:
// the node body is 98x32px, the handle 5.6x5.6px, so the most likely way to
// end the gesture was also the one that told the player nothing.
describe('connectionCreatedMessage', () => {
  it('names both ends of the connection that now exists', () => {
    expect(connectionCreatedMessage('de Servicio de cobros a Base de movimientos')).toContain(
      'de Servicio de cobros a Base de movimientos',
    )
  })

  // The moment the gesture succeeds is the moment the next gesture becomes
  // relevant, and the data class is the one an exercise's guarantees read.
  it('teaches the gesture that comes next, since a fresh connection declares no data', () => {
    expect(connectionCreatedMessage('de A a B')).toContain('Shift+F10')
  })

  it('never comes back empty, which is what the silence was', () => {
    expect(connectionCreatedMessage('de A a B').length).toBeGreaterThan(0)
  })
})

describe('connectionDroppedMessage', () => {
  it('says the drag ended nowhere and where it had to end instead', () => {
    const message = connectionDroppedMessage()

    expect(message.length).toBeGreaterThan(0)
    expect(message).toContain('conector')
  })
})
