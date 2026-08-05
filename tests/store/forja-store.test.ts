// Domain state store — pure logic (design D1: domain state is source of
// truth). No DOM, no React Flow: these are the gestures' underlying data
// mutations, testable without a browser. The pointer/keyboard *wiring* that
// drives these methods is proven separately in tests/e2e/canvas.spec.ts.
import { describe, expect, it } from 'vitest'
import { ForjaStore } from '../../src/lib/forja/store/forja-store'

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
})

describe('ForjaStore — move [PC2]', () => {
  it('updates an existing node position', () => {
    const store = new ForjaStore()
    const node = store.createNode('service', 'Cobros', { x: 0, y: 0 })

    store.moveNode(node.id, { x: 120, y: 80 })

    expect(store.getDesign().nodes[0].position).toEqual({ x: 120, y: 80 })
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
