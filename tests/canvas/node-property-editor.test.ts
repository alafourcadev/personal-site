import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NodePropertyEditor } from '../../src/components/forja/canvas/NodePropertyEditor'
import { CATALOG } from '../../src/lib/forja/engine/catalog'

describe('NodePropertyEditor', () => {
  it('labels every decision and explains the consequence of the current value', () => {
    const markup = renderToStaticMarkup(
      createElement(NodePropertyEditor, {
        node: {
          id: 'orders-db',
          type: 'database',
          label: 'Base de pedidos',
          zone: CATALOG.database.zone,
          props: { ...CATALOG.database.props },
        },
        onChange: () => undefined,
      }),
    )

    expect(markup).toContain('Decisiones de Base de pedidos')
    expect(markup).toContain('<label for=')
    expect(markup).toContain('aria-label="Respaldo de Base de pedidos"')
    expect(markup).toContain('Respaldo')
    expect(markup).toContain('Sin respaldo')
    expect(markup).toContain('No existe una copia independiente')
    expect(markup).toContain('aria-describedby=')
    expect(markup).toContain('aria-live="polite"')
  })

  it('renders nothing for a component with no player-editable facts', () => {
    const markup = renderToStaticMarkup(
      createElement(NodePropertyEditor, {
        node: {
          id: 'actor',
          type: 'actor',
          label: 'Persona usuaria',
          zone: CATALOG.actor.zone,
          props: { ...CATALOG.actor.props },
        },
        onChange: () => undefined,
      }),
    )

    expect(markup).toBe('')
  })
})
