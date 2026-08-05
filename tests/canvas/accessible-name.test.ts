// PC13: "each node's accessible name MUST include its display label,
// component type, trust zone, and current state". Pure function — the raw
// spec scenario names "database"/"restricted"/"selected" as literal
// substrings the queried name must contain; state words are Spanish per
// project convention (this is player-facing copy, not code).
import { describe, expect, it } from 'vitest'
import { composeNodeAccessibleName } from '../../src/lib/forja/canvas/accessible-name'

describe('composeNodeAccessibleName [PC13]', () => {
  it('includes label, type, zone, and selected state — the literal spec scenario', () => {
    const name = composeNodeAccessibleName(
      { label: 'Base de pedidos', type: 'database', zone: 'restricted' },
      { selected: true },
    )

    expect(name).toContain('Base de pedidos')
    expect(name).toContain('database')
    expect(name).toContain('restricted')
    expect(name).toContain('seleccionado')
  })

  it('omits the selection descriptor when the node is not selected', () => {
    const name = composeNodeAccessibleName({ label: 'Cola de eventos', type: 'queue', zone: 'private' })

    expect(name).not.toContain('seleccionado')
    expect(name).toContain('queue')
    expect(name).toContain('private')
  })

  it('appends an error descriptor when the node carries a blocking finding', () => {
    const name = composeNodeAccessibleName(
      { label: 'Gateway', type: 'api-gateway', zone: 'dmz' },
      { hasError: true },
    )

    expect(name).toContain('con error')
  })
})
