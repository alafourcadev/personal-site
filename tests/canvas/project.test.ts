// Projects domain Design -> React Flow's node/edge shape (design D1: RF is
// derived from the store, never the other way for structure). Pure object
// mapping, no rendering — testable without a browser.
import { describe, expect, it } from 'vitest'
import type { Design } from '../../src/lib/forja/engine/types'
import { projectEdges, projectNodes } from '../../src/lib/forja/canvas/project'

const design: Design = {
  nodes: [
    { id: 'n1', type: 'web-client', label: 'Cliente web', zone: 'public', props: {}, position: { x: 0, y: 0 } },
    { id: 'n2', type: 'database', label: 'Base de pedidos', zone: 'restricted', props: {}, position: { x: 200, y: 0 } },
  ],
  edges: [{ id: 'e1', from: { node: 'n1' }, to: { node: 'n2' } }],
}

describe('projectNodes', () => {
  it('maps one Design node to one React Flow node carrying position and label', () => {
    const nodes = projectNodes(design, new Set(), new Set())

    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Cliente web' } })
  })

  it('composes the accessible name including the selection state [PC13]', () => {
    const nodes = projectNodes(design, new Set(['n2']), new Set())
    const restricted = nodes.find((n) => n.id === 'n2')!

    expect(restricted.ariaLabel).toContain('Base de pedidos')
    expect(restricted.ariaLabel).toContain('database')
    expect(restricted.ariaLabel).toContain('restricted')
    expect(restricted.ariaLabel).toContain('seleccionado')
    expect(nodes.find((n) => n.id === 'n1')!.ariaLabel).not.toContain('seleccionado')
  })

  it('flags a node carrying a blocking finding via data.hasError', () => {
    const nodes = projectNodes(design, new Set(), new Set(['n2']))

    expect(nodes.find((n) => n.id === 'n2')!.data.hasError).toBe(true)
    expect(nodes.find((n) => n.id === 'n1')!.data.hasError).toBe(false)
  })

  it('carries the colour through to data and the accessible name [PC16]', () => {
    const colored: Design = {
      ...design,
      nodes: design.nodes.map((n) => (n.id === 'n2' ? { ...n, color: 'violet' as const } : n)),
    }
    const nodes = projectNodes(colored, new Set(), new Set())
    const restricted = nodes.find((n) => n.id === 'n2')!

    expect(restricted.data.color).toBe('violet')
    expect(restricted.ariaLabel).toContain('color Violeta')
    expect(nodes.find((n) => n.id === 'n1')!.ariaLabel).not.toContain('color')
  })
})

describe('projectEdges', () => {
  it('maps one Design edge to one React Flow edge with source/target ids', () => {
    const edges = projectEdges(design, new Set(), new Set())

    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ id: 'e1', source: 'n1', target: 'n2' })
  })

  it('names the edge using both endpoint labels', () => {
    const edges = projectEdges(design, new Set(), new Set())

    expect(edges[0].ariaLabel).toContain('Cliente web')
    expect(edges[0].ariaLabel).toContain('Base de pedidos')
  })
})
