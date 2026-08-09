// Domain state store — pure logic (design D1: domain state is source of
// truth). No DOM, no React Flow: these are the gestures' underlying data
// mutations, testable without a browser. The pointer/keyboard *wiring* that
// drives these methods is proven separately in tests/e2e/canvas.spec.ts.
import { describe, expect, it } from 'vitest'
import { ForjaStore } from '../../src/lib/forja/store/forja-store'
import { bandXRange } from '../../src/lib/forja/canvas/bands'

describe('ForjaStore — create [PC1]', () => {
  it('adds a node of the requested type at the given position', () => {
    const store = new ForjaStore()
    const node = store.createNode('web-client', 'App móvil', { x: 40, y: 60 })

    expect(store.getDesign().nodes).toHaveLength(1)
    expect(store.getDesign().nodes[0]).toMatchObject({
      id: node.id,
      type: 'web-client',
      label: 'App móvil',
      zone: 'public',
      position: { x: 40, y: 60 },
    })
  })

  it('derives the node zone from the catalog, not from caller input', () => {
    const store = new ForjaStore()
    const node = store.createNode('database', 'Base de pedidos', { x: 0, y: 0 })

    expect(node.zone).toBe('restricted')
  })

  it('seeds the node with the catalog default props, not an empty object', () => {
    const store = new ForjaStore()
    const node = store.createNode('database', 'Base de pedidos', { x: 0, y: 0 })

    // Rules.ts reads these defaults (e.g. backup: 'none') to raise findings —
    // an empty props object would make every node-level rule permanently
    // silent for player-created nodes.
    expect(node.props.backup).toBe('none')
    expect(node.props.persistence).toBe('durable')
  })
})

describe('ForjaStore — move [PC2]', () => {
  it('updates an existing node position', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 0, y: 0 })

    // 'service' is an application-layer type; this target sits inside that
    // band's own bounds (see the band-clamp describe block below for the
    // containment behaviour itself).
    store.moveNode(node.id, { x: 450, y: 80 })

    expect(store.getDesign().nodes[0].position).toEqual({ x: 450, y: 80 })
  })

  it('is a no-op for a node id that does not exist', () => {
    const store = new ForjaStore()
    store.createNode('service', 'Cobros', { x: 0, y: 0 })

    store.moveNode('missing-id', { x: 999, y: 999 })

    expect(store.getDesign().nodes[0].position).toEqual({ x: 0, y: 0 })
  })

  it('moves a node by a fixed step in the pressed arrow direction', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 100, y: 100 })

    store.moveNodeByKeyboard(node.id, 'right')
    store.moveNodeByKeyboard(node.id, 'down')

    const moved = store.getDesign().nodes[0].position
    expect(moved!.x).toBeGreaterThan(100)
    expect(moved!.y).toBeGreaterThan(100)
  })

  it('clamps a business-band node so it can never reach the infrastructure band [PC7 design note]', () => {
    const store = new ForjaStore()
    const actor = store.createNode('actor', 'Persona usuaria', { x: 0, y: 0 })

    store.moveNode(actor.id, { x: 100000, y: 40 })

    const database = store.createNode('database', 'Base de pedidos', { x: 0, y: 0 })
    store.moveNode(database.id, { x: 0, y: 0 })

    expect(store.getDesign().nodes[0].position!.x).toBeLessThan(store.getDesign().nodes[1].position!.x)
  })

  it('clamps keyboard-driven moves to the same band bounds', () => {
    const store = new ForjaStore()
    const actor = store.createNode('actor', 'Persona usuaria', { x: 0, y: 0 })
    for (let i = 0; i < 200; i += 1) store.moveNodeByKeyboard(actor.id, 'right')

    expect(store.getDesign().nodes[0].position!.x).toBeLessThanOrEqual(bandXRange('business').max)
  })
})

describe('ForjaStore — connect [PC3]', () => {
  it('creates an edge between two compatible ports', () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const gateway = store.createNode('api-gateway', 'Gateway', { x: 200, y: 0 })

    const result = store.connect(client.id, gateway.id)

    expect(result.verdict.ok).toBe(true)
    expect(store.getDesign().edges).toHaveLength(1)
    expect(store.getDesign().edges[0]).toMatchObject({ from: { node: client.id }, to: { node: gateway.id } })
  })

  it('refuses an illegal connection and does not mutate the design', () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const database = store.createNode('database', 'Base de pedidos', { x: 400, y: 0 })

    const result = store.connect(client.id, database.id)

    expect(result.verdict.ok).toBe(false)
    expect(result.verdict.why).toBeTruthy()
    expect(result.edge).toBeNull()
    expect(store.getDesign().edges).toHaveLength(0)
  })
})

describe('ForjaStore — delete connection [PC4]', () => {
  it('removes exactly the targeted edge and keeps the rest', () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const gatewayA = store.createNode('api-gateway', 'Gateway A', { x: 200, y: 0 })
    const gatewayB = store.createNode('api-gateway', 'Gateway B', { x: 200, y: 150 })
    const edgeA = store.connect(client.id, gatewayA.id).edge!
    store.connect(client.id, gatewayB.id)

    store.deleteEdge(edgeA.id)

    expect(store.getDesign().edges).toHaveLength(1)
    expect(store.getDesign().edges.find((e) => e.id === edgeA.id)).toBeUndefined()
  })
})

describe('ForjaStore — delete node [PC5]', () => {
  it('removes the node and every edge attached to it', () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const gateway = store.createNode('api-gateway', 'Gateway', { x: 200, y: 0 })
    store.connect(client.id, gateway.id)

    store.deleteNode(gateway.id)

    expect(store.getDesign().nodes).toHaveLength(1)
    expect(store.getDesign().edges).toHaveLength(0)
  })
})

describe('ForjaStore — undo [PC6]', () => {
  it('restores a deleted connection between the same two ports', () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const gateway = store.createNode('api-gateway', 'Gateway', { x: 200, y: 0 })
    const edge = store.connect(client.id, gateway.id).edge!
    store.deleteEdge(edge.id)

    store.undo()

    expect(store.getDesign().edges).toHaveLength(1)
    expect(store.getDesign().edges[0]).toMatchObject({ from: { node: client.id }, to: { node: gateway.id } })
  })

  it('undoing a node deletion restores its connections too', () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const gateway = store.createNode('api-gateway', 'Gateway', { x: 200, y: 0 })
    store.connect(client.id, gateway.id)

    store.deleteNode(gateway.id)
    store.undo()

    expect(store.getDesign().nodes).toHaveLength(2)
    expect(store.getDesign().edges).toHaveLength(1)
  })

  it('reports canUndo() false on a fresh store and true after a mutation', () => {
    const store = new ForjaStore()
    expect(store.canUndo()).toBe(false)

    store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })

    expect(store.canUndo()).toBe(true)
  })
})

describe('ForjaStore — rename [PC15]', () => {
  it('updates the node label', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 0, y: 0 })

    store.renameNode(node.id, 'Cobros v2')

    expect(store.getDesign().nodes[0].label).toBe('Cobros v2')
  })

  it('ignores a blank rename, keeping the original label', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 0, y: 0 })

    store.renameNode(node.id, '   ')

    expect(store.getDesign().nodes[0].label).toBe('Cobros')
  })

  it('is undoable', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 0, y: 0 })
    store.renameNode(node.id, 'Cobros v2')

    store.undo()

    expect(store.getDesign().nodes[0].label).toBe('Cobros')
  })
})

describe('ForjaStore — duplicate [PC15]', () => {
  it('creates a copy with a new id, an offset position, and a distinct label', () => {
    const store = new ForjaStore()
    const original = store.createNode('database', 'Base de pedidos', { x: 40, y: 40 })

    const copy = store.duplicateNode(original.id)!

    expect(copy.id).not.toBe(original.id)
    expect(copy.label).not.toBe(original.label)
    expect(copy.type).toBe('database')
    expect(copy.zone).toBe('restricted')
    expect(copy.props).toEqual(original.props)
    expect(copy.position).not.toEqual(original.position)
    expect(store.getDesign().nodes).toHaveLength(2)
  })

  it('returns null for a missing node id and does not mutate the design', () => {
    const store = new ForjaStore()
    const result = store.duplicateNode('missing-id')

    expect(result).toBeNull()
    expect(store.getDesign().nodes).toHaveLength(0)
  })
})

describe('ForjaStore — recolor [PC16]', () => {
  it('sets a player-assigned colour without touching anything else', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 0, y: 0 })

    store.setNodeColor(node.id, 'violet')

    const updated = store.getDesign().nodes[0]
    expect(updated.color).toBe('violet')
    expect(updated.type).toBe('service')
    expect(updated.label).toBe('Cobros')
  })

  it('is undoable', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 0, y: 0 })
    store.setNodeColor(node.id, 'violet')

    store.undo()

    expect(store.getDesign().nodes[0].color).toBeUndefined()
  })
})

describe('ForjaStore property decisions', () => {
  it('changes an engine-relevant property without dropping sibling facts', () => {
    const store = new ForjaStore()
    const database = store.createNode('database', 'Base de pedidos', { x: 0, y: 0 })

    expect(store.setNodeProperty(database.id, 'backup', 'diario')).toBe(true)

    expect(store.getDesign().nodes[0].props).toMatchObject({
      backup: 'diario',
      consistency: 'strong',
      persistence: 'durable',
    })
  })

  it('refuses a value that the component catalog does not expose', () => {
    const store = new ForjaStore()
    const database = store.createNode('database', 'Base de pedidos', { x: 0, y: 0 })
    const before = store.getDesign()

    expect(store.setNodeProperty(database.id, 'backup', 'cuando alguien se acuerda')).toBe(false)
    expect(store.setNodeProperty(database.id, 'dlq', 'sí')).toBe(false)

    expect(store.getDesign()).toBe(before)
  })

  it('is a no-op when the requested value is already selected', () => {
    const store = new ForjaStore()
    const database = store.createNode('database', 'Base de pedidos', { x: 0, y: 0 })

    expect(store.setNodeProperty(database.id, 'backup', 'none')).toBe(false)
    store.undo()

    expect(store.getDesign().nodes).toHaveLength(0)
  })

  it('is undoable as one history entry', () => {
    const store = new ForjaStore()
    const queue = store.createNode('queue', 'Avisos', { x: 0, y: 0 })

    store.setNodeProperty(queue.id, 'dlq', 'sí')
    store.undo()

    expect(store.getDesign().nodes[0].props.dlq).toBe('no')
  })

  it('does nothing for a node id that does not exist', () => {
    const store = new ForjaStore()
    const before = store.getDesign()

    expect(store.setNodeProperty('missing-id', 'backup', 'diario')).toBe(false)

    expect(store.getDesign()).toBe(before)
  })
})

// R1-H item 4: "reiniciar el ejercicio" — a player must be able to go back
// to the starting design without losing the page. Reset is a normal
// mutation (goes through the same commit/undo history as everything else),
// not a special escape hatch — so an accidental reset is itself undoable.
describe('ForjaStore — resetTo [R1-H]', () => {
  it('replaces the current design with the given one', () => {
    const store = new ForjaStore()
    store.createNode('service', 'Servicio', { x: 0, y: 0 })
    const starting = { nodes: [{ id: 'given-1', type: 'service' as const, label: 'Dado', zone: 'private' as const, props: {} }], edges: [] }

    store.resetTo(starting)

    expect(store.getDesign()).toEqual(starting)
  })

  it('is undoable — reset is a commit like any other mutation', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Servicio', { x: 0, y: 0 })
    store.resetTo({ nodes: [], edges: [] })

    store.undo()

    expect(store.getDesign().nodes).toHaveLength(1)
    expect(store.getDesign().nodes[0].id).toBe(node.id)
  })
})

// The sibling of setNodeColor — same shape, same guard, same commit path — and
// the opposite in kind: a colour is a personal annotation the engine promises
// never to read (tests/engine/color-neutral.test.ts), while a data class is a
// domain fact three of the engine's rules already gate on. That is why it goes
// on the edge itself and not into some UI-side side table: the engine has read
// `DesignEdge.dataClass` since R1-B, and until now nothing could write it.
describe('ForjaStore — declare the data class of a connection', () => {
  const wired = () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const gateway = store.createNode('api-gateway', 'Puerta de entrada', { x: 200, y: 0 })
    const { edge } = store.connect(client.id, gateway.id)
    return { store, edgeId: edge!.id }
  }

  it('writes the declared class onto the connection', () => {
    const { store, edgeId } = wired()

    store.setEdgeDataClass(edgeId, 'regulated')

    expect(store.getDesign().edges[0].dataClass).toBe('regulated')
  })

  it('replaces a previous declaration rather than accumulating one', () => {
    const { store, edgeId } = wired()
    store.setEdgeDataClass(edgeId, 'regulated')

    store.setEdgeDataClass(edgeId, 'public')

    expect(store.getDesign().edges[0].dataClass).toBe('public')
  })

  // Taking the declaration back has to leave the edge in the state a freshly
  // drawn one is in — undeclared — so the "Falta declarar qué dato viaja" note
  // comes back. The note is a reminder, not a defect: what was broken was that
  // it could never be closed, not that it existed.
  it('clears the declaration when no class is given', () => {
    const { store, edgeId } = wired()
    store.setEdgeDataClass(edgeId, 'secret')

    store.setEdgeDataClass(edgeId, undefined)

    expect(store.getDesign().edges[0].dataClass).toBeUndefined()
    expect(store.getDesign().edges[0]).not.toHaveProperty('dataClass')
  })

  it('is a no-op for a connection id that does not exist', () => {
    const { store } = wired()
    const before = store.getDesign()

    store.setEdgeDataClass('missing-id', 'public')

    expect(store.getDesign()).toBe(before)
  })

  it('never touches the other connections', () => {
    const store = new ForjaStore()
    const client = store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    const gateway = store.createNode('api-gateway', 'Puerta de entrada', { x: 200, y: 0 })
    const service = store.createNode('service', 'Servicio', { x: 400, y: 0 })
    const first = store.connect(client.id, gateway.id).edge!
    const second = store.connect(gateway.id, service.id).edge!

    store.setEdgeDataClass(first.id, 'personal')

    const edges = store.getDesign().edges
    expect(edges.find((e) => e.id === first.id)!.dataClass).toBe('personal')
    expect(edges.find((e) => e.id === second.id)!.dataClass).toBeUndefined()
  })

  it('is undoable — a declaration is a commit like any other mutation', () => {
    const { store, edgeId } = wired()
    store.setEdgeDataClass(edgeId, 'regulated')

    store.undo()

    expect(store.getDesign().edges[0].dataClass).toBeUndefined()
  })

  it('never mutates the design object it replaces', () => {
    const { store, edgeId } = wired()
    const before = store.getDesign()

    store.setEdgeDataClass(edgeId, 'regulated')

    expect(before.edges[0].dataClass).toBeUndefined()
    expect(store.getDesign()).not.toBe(before)
  })
})

describe('ForjaStore — subscriptions', () => {
  it('notifies listeners on a successful mutation but not on a refused connection', () => {
    const store = new ForjaStore()
    let notifications = 0
    store.subscribe(() => {
      notifications += 1
    })

    store.createNode('web-client', 'Cliente web', { x: 0, y: 0 })
    expect(notifications).toBe(1)

    const database = store.createNode('database', 'Base', { x: 400, y: 0 })
    expect(notifications).toBe(2)

    store.connect('missing', database.id)
    expect(notifications).toBe(2)
  })
})

describe('ForjaStore: arrange the whole diagram at once', () => {
  it('moves every piece the layout has an answer for', () => {
    const store = new ForjaStore()
    const service = store.createNode('service', 'Cobros', { x: 400, y: 500 })
    const database = store.createNode('database', 'Base', { x: 760, y: 900 })

    store.applyPositions({ [service.id]: { x: 400, y: 80 }, [database.id]: { x: 760, y: 80 } })

    expect(store.getDesign().nodes.map((node) => node.position)).toEqual([
      { x: 400, y: 80 },
      { x: 760, y: 80 },
    ])
  })

  // One history entry for the whole arrangement, so Ctrl+Z is one press and
  // not one press per piece.
  it('is undone by a single undo', () => {
    const store = new ForjaStore()
    const service = store.createNode('service', 'Cobros', { x: 400, y: 500 })
    const database = store.createNode('database', 'Base', { x: 760, y: 900 })

    store.applyPositions({ [service.id]: { x: 400, y: 80 }, [database.id]: { x: 760, y: 80 } })
    store.undo()

    expect(store.getDesign().nodes.map((node) => node.position)).toEqual([
      { x: 400, y: 500 },
      { x: 760, y: 900 },
    ])
  })

  // "A diagram that is already arranged does not move." Pressing the button
  // twice must leave the second press with nothing to undo either, or the
  // player's own last action disappears behind an empty history entry.
  it('records nothing when every piece is already where it belongs', () => {
    const store = new ForjaStore()
    const service = store.createNode('service', 'Cobros', { x: 400, y: 80 })

    expect(store.applyPositions({ [service.id]: { x: 400, y: 80 } })).toBe(false)
    expect(store.canUndo()).toBe(true)
    store.undo()
    expect(store.getDesign().nodes).toHaveLength(0)
  })

  it('reports whether anything actually moved', () => {
    const store = new ForjaStore()
    const service = store.createNode('service', 'Cobros', { x: 400, y: 500 })

    expect(store.applyPositions({ [service.id]: { x: 400, y: 80 } })).toBe(true)
  })

  // The same clamp every other movement goes through. A layout is not allowed
  // to be the one path that can put a piece outside its own band.
  it('clamps a position that would leave the piece outside its band', () => {
    const store = new ForjaStore()
    const service = store.createNode('service', 'Cobros', { x: 400, y: 80 })

    store.applyPositions({ [service.id]: { x: -900, y: 80 } })

    expect(store.getDesign().nodes[0].position!.x).toBe(bandXRange('application').min)
  })

  it('leaves a piece the layout said nothing about exactly where it was', () => {
    const store = new ForjaStore()
    const service = store.createNode('service', 'Cobros', { x: 400, y: 500 })
    const database = store.createNode('database', 'Base', { x: 760, y: 900 })

    store.applyPositions({ [service.id]: { x: 400, y: 80 } })

    expect(store.getDesign().nodes[1].position).toEqual({ x: 760, y: 900 })
    expect(store.getDesign().nodes[1].id).toBe(database.id)
  })

  it('never touches the structure the engine scores', () => {
    const store = new ForjaStore()
    const service = store.createNode('service', 'Cobros', { x: 400, y: 500 })
    const database = store.createNode('database', 'Base', { x: 760, y: 900 })
    store.connect(service.id, database.id)
    const before = store.getDesign()

    store.applyPositions({ [service.id]: { x: 400, y: 80 }, [database.id]: { x: 760, y: 80 } })
    const after = store.getDesign()

    expect(after.edges).toEqual(before.edges)
    expect(after.nodes.map((node) => ({ ...node, position: undefined }))).toEqual(
      before.nodes.map((node) => ({ ...node, position: undefined })),
    )
  })
})
