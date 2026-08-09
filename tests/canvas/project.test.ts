// Projects domain Design -> React Flow's node/edge shape (design D1: RF is
// derived from the store, never the other way for structure). Pure object
// mapping, no rendering — testable without a browser.
import { describe, expect, it } from 'vitest'
import type { DataClass, Design } from '../../src/lib/forja/engine/types'
import { EDGE_HELP_ID, EDGE_HELP_TEXT, projectEdges, projectNodes } from '../../src/lib/forja/canvas/project'
import { DATA_CLASSES, UNDECLARED_DATA_CLASS_NAME } from '../../src/lib/forja/canvas/data-classes'

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
    // By name, never by key — see player-vocabulary-ui.test.ts.
    expect(restricted.ariaLabel).toContain('Base de datos')
    expect(restricted.ariaLabel).toContain('núcleo restringido')
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

// "The player must be able to read the diagram and see what travels where
// WITHOUT opening a menu per connection." The declared class is therefore a
// property of the drawing itself: React Flow's own edge label (rendered at the
// connection's midpoint) plus a stroke colour, both derived here rather than
// looked up by a component, so what the canvas paints and what a screen reader
// says come from one place.
const declared = (dataClass: DataClass): Design => ({
  ...design,
  edges: [{ id: 'e1', from: { node: 'n1' }, to: { node: 'n2' }, dataClass }],
})

describe('projectEdges — a declared data class is visible on the connection itself', () => {
  it('labels the connection with the class name, in the player s words', () => {
    expect(projectEdges(declared('regulated'), new Set(), new Set())[0].label).toBe(DATA_CLASSES.regulated.label)
  })

  it('leaves an undeclared connection unlabelled, so only real declarations add ink', () => {
    expect(projectEdges(design, new Set(), new Set())[0].label).toBeUndefined()
  })

  it('paints the connection with the class colour', () => {
    const edge = projectEdges(declared('secret'), new Set(), new Set())[0]

    expect((edge.style as Record<string, unknown>).stroke).toBe(DATA_CLASSES.secret.stroke)
  })

  // A blocking finding already paints the connection red (the "something is
  // wrong here" signal). A class colour that overrode it would hide the error
  // behind the annotation that caused it.
  it('lets the error colour win over the class colour', () => {
    const edge = projectEdges(declared('secret'), new Set(), new Set(['e1']))[0]

    expect((edge.style as Record<string, unknown>).stroke).toBe('var(--forja-edge-error)')
  })

  // The label's text and its background are two separate SVG elements. They
  // are nudged clear of the connection's own pointer handle (see project.ts),
  // and two offsets that drifted apart would tear the chip in half — the text
  // sitting outside its own background.
  it('moves the label text and its background by exactly the same offset', () => {
    const edge = projectEdges(declared('public'), new Set(), new Set())[0]

    const text = (edge.labelStyle as Record<string, unknown>).transform
    expect(text).toBeTruthy()
    expect((edge.labelBgStyle as Record<string, unknown>).transform).toBe(text)
  })

  it('says the class out loud, since a screen reader has no colour and no label to read', () => {
    expect(projectEdges(declared('personal'), new Set(), new Set())[0].ariaLabel).toContain(
      DATA_CLASSES.personal.label,
    )
  })

  // The absence of a label is information a sighted player reads at a glance
  // and a screen-reader user cannot. It has to be spoken.
  it('says an undeclared connection is undeclared, out loud', () => {
    expect(projectEdges(design, new Set(), new Set())[0].ariaLabel).toContain(UNDECLARED_DATA_CLASS_NAME)
  })
})

// A connection kept React Flow's own default description, in English, inside
// a document declared `lang="es"`: "Press enter or space to select an edge.
// You can then press delete to remove it or escape to cancel." Two defects in
// one string: WCAG 3.1.2, and a set of shortcuts that is not the set this
// playground implements. Nodes were already covered: project.ts gave them
// `domAttributes`, and the edge mapping right below it never got the same
// treatment.
describe('projectEdges: what a connection tells assistive technology about its own gestures', () => {
  it('points every connection at the playground’s own description instead of React Flow’s English default', () => {
    for (const edge of projectEdges(design, new Set(), new Set())) {
      expect(edge.domAttributes?.['aria-describedby']).toBe(EDGE_HELP_ID)
    }
  })

  it('describes the shortcut the playground really implements', () => {
    expect(EDGE_HELP_TEXT).toContain('Shift+F10')
  })

  it('says it in the language the page is written in', () => {
    expect(EDGE_HELP_TEXT).not.toMatch(/\b(press|enter|space|delete|escape)\b/i)
  })
})
