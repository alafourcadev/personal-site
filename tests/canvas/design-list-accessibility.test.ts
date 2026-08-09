import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DesignList } from '../../src/components/forja/canvas/DesignList'
import type { Design } from '../../src/lib/forja/engine/types'

const design: Design = {
  nodes: [
    { id: 'service', type: 'service', label: 'Servicio de pedidos', zone: 'private', props: {} },
    { id: 'database', type: 'database', label: 'Base de pedidos', zone: 'restricted', props: {} },
  ],
  edges: [
    { id: 'writes', from: { node: 'service' }, to: { node: 'database' } },
  ],
}

describe('DesignList accessible destructive controls', () => {
  it('names the component or connection each delete button affects', () => {
    const markup = renderToStaticMarkup(
      createElement(DesignList, {
        design,
        findings: [],
        ledger: false,
        onDeleteNode: () => undefined,
        onDeleteEdge: () => undefined,
        onSetEdgeDataClass: () => undefined,
        onSetNodeProperty: () => undefined,
      }),
    )

    expect(markup).toContain('aria-label="Eliminar el componente Servicio de pedidos"')
    expect(markup).toContain('aria-label="Eliminar el componente Base de pedidos"')
    expect(markup).toContain('aria-label="Eliminar la conexión Servicio de pedidos → Base de pedidos"')
  })
})
