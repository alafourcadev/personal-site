// PC13: "each node's accessible name MUST include its display label,
// component type, trust zone, and current state". Pure function.
//
// The raw spec scenario named "database"/"restricted" as the literal
// substrings the queried name must contain, and this suite pinned exactly
// that — which is how the leak survived two rounds of vocabulary cleanup.
// PC13 asks for the type and the zone, not for their internal keys: a screen
// reader was announcing "App de familias, mobile-client, zona public", the one
// surface where the player cannot compensate by looking at the drawing.
// The identifiers here are now the names the rest of the product uses
// (CATALOG[type].name, ZONE_NAMES) — see player-vocabulary-ui.test.ts, which
// sweeps every type/zone pair so neither can regress.
import { describe, expect, it } from 'vitest'
import { composeNodeAccessibleName } from '../../src/lib/forja/canvas/accessible-name'

describe('composeNodeAccessibleName [PC13]', () => {
  it('includes label, type, zone, and selected state — the literal spec scenario', () => {
    const name = composeNodeAccessibleName(
      { label: 'Base de pedidos', type: 'database', zone: 'restricted' },
      { selected: true },
    )

    expect(name).toContain('Base de pedidos')
    expect(name).toContain('Base de datos')
    expect(name).toContain('núcleo restringido')
    expect(name).toContain('seleccionado')
  })

  it('omits the selection descriptor when the node is not selected', () => {
    const name = composeNodeAccessibleName({ label: 'Cola de eventos', type: 'queue', zone: 'private' })

    expect(name).not.toContain('seleccionado')
    expect(name).toContain('Cola de mensajes')
    expect(name).toContain('red interna')
  })

  it('appends an error descriptor when the node carries a blocking finding', () => {
    const name = composeNodeAccessibleName(
      { label: 'Gateway', type: 'api-gateway', zone: 'dmz' },
      { hasError: true },
    )

    expect(name).toContain('con error')
  })

  it('names the player-assigned colour as text, alongside label/type/zone [PC16]', () => {
    const name = composeNodeAccessibleName(
      { label: 'Base de pedidos', type: 'database', zone: 'restricted', colorLabel: 'Violeta' },
      { selected: true },
    )

    expect(name).toContain('Base de pedidos')
    expect(name).toContain('Base de datos')
    expect(name).toContain('núcleo restringido')
    expect(name).toContain('seleccionado')
    expect(name).toContain('color Violeta')
  })

  it('omits the colour descriptor when no colour was assigned', () => {
    const name = composeNodeAccessibleName({ label: 'Cola de eventos', type: 'queue', zone: 'private' })

    expect(name).not.toContain('color')
  })
})
