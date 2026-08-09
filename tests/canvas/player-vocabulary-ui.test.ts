// The interface half of the rule the engine already obeys.
//
// `tests/engine/player-vocabulary.test.ts` pins that no rule ever prints a raw
// `ComponentType` or `Zone` key inside a finding. That covered the copy the
// player reads AFTER submitting — and left the copy they read the entire time
// they are building untouched: every box on the canvas said
// "Cliente móvil · zona public", the list view said the same, and the
// accessible name said "App de familias, mobile-client, zona public".
//
// The accessible name is the worst of the three: someone using a screen reader
// hears the internal key and has no drawing to compensate with. CONTEXTO §5
// draws no distinction between surfaces — "cero vocabulario interno del motor
// en lo que lee el jugador" includes what it says out loud.
//
// Same criterion as the engine suite: the names come from CATALOG[type].name
// and ZONE_NAMES, so a rename on either side breaks the build instead of
// silently reintroducing the leak.
import { describe, expect, it } from 'vitest'
import { composeNodeAccessibleName } from '../../src/lib/forja/canvas/accessible-name'
import { componentName, nodeIdentityLine, nodeListLine, zoneName } from '../../src/lib/forja/canvas/node-identity'
import { CATALOG } from '../../src/lib/forja/engine/catalog'
import { ZONE_NAMES, ZONES } from '../../src/lib/forja/engine/legality'
import type { ComponentType, Zone } from '../../src/lib/forja/engine/types'

const TYPES = Object.keys(CATALOG) as ComponentType[]

// Matched verbatim and case-sensitively: every player-facing name is Spanish
// and capitalised ("Cliente móvil", "red pública"), so it can never collide
// with a kebab-case type key or a lowercase zone key by accident.
const INTERNAL_KEYS: string[] = [...TYPES, ...ZONES]

const leaks = (text: string) => INTERNAL_KEYS.filter((key) => text.includes(key))

const everyPair = TYPES.flatMap((type) => ZONES.map((zone) => [type, zone] as const))

describe('canvas vocabulary — the shared identity line speaks the player s language', () => {
  it('names every type with the same word the palette and the engine use', () => {
    for (const type of TYPES) {
      expect(componentName(type), type).toBe(CATALOG[type].name)
    }
  })

  it('names every zone with the same word the engine s findings use', () => {
    for (const zone of ZONES) {
      expect(zoneName(zone), zone).toBe(ZONE_NAMES[zone])
    }
  })

  it('never leaks an internal key for any type/zone combination', () => {
    const offenders: string[] = []
    for (const [type, zone] of everyPair) {
      for (const key of leaks(nodeIdentityLine(type, zone))) {
        offenders.push(`${type}/${zone}: ${key}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('carries both names, so the line still says what the piece is and where it sits', () => {
    for (const [type, zone] of everyPair) {
      const line = nodeIdentityLine(type, zone)
      expect(line, `${type}/${zone}`).toContain(CATALOG[type].name)
      expect(line, `${type}/${zone}`).toContain(ZONE_NAMES[zone])
    }
  })
})

// The stutter the accessible name already refuses to say out loud was still
// PRINTED, on the two surfaces that show a node's identity. Measured in the
// production build, sweeping 24 exercises x 4 viewport widths: 92 of 96
// framings had at least one node reading
//
//   Base de datos                        <- the label the player kept
//   Base de datos · núcleo restringido   <- the subtitle under it
//
// and the list view was worse, because it prints the label itself first:
// "Base de datos · Base de datos · núcleo restringido". It is the common case,
// not an edge case — a starting design labels its pieces with their own type
// names, so every untouched node stutters.
//
// The second line's job is what the first one does NOT say. When the label is
// already the type's name, that is only the trust zone.
describe('canvas vocabulary — a node never prints its own name twice', () => {
  it('drops the type from the subtitle when the label already is the type s name', () => {
    expect(nodeIdentityLine('database', 'restricted', 'Base de datos')).toBe('núcleo restringido')
  })

  it('keeps the type when the player gave the node a name of its own', () => {
    expect(nodeIdentityLine('database', 'restricted', 'Base de pedidos')).toBe(
      'Base de datos · núcleo restringido',
    )
  })

  it('ignores case and surrounding space, exactly like the spoken name does', () => {
    expect(nodeIdentityLine('database', 'restricted', '  base de datos ')).toBe('núcleo restringido')
  })

  it('still carries both names when no label is in play at all', () => {
    expect(nodeIdentityLine('database', 'restricted')).toBe('Base de datos · núcleo restringido')
  })

  it('never loses the zone, whichever branch it takes', () => {
    for (const [type, zone] of everyPair) {
      expect(nodeIdentityLine(type, zone, CATALOG[type].name), `${type}/${zone}`).toContain(ZONE_NAMES[zone])
      expect(nodeIdentityLine(type, zone, 'Base de pedidos'), `${type}/${zone}`).toContain(ZONE_NAMES[zone])
    }
  })

  // The two surfaces cannot disagree about when a name is a repeat: the
  // screen reader would say one thing and the screen show another.
  it('drops the type on exactly the same condition the accessible name does', () => {
    for (const [type, zone] of everyPair) {
      for (const label of [CATALOG[type].name, CATALOG[type].name.toUpperCase(), 'Base de pedidos']) {
        const spokenRepeatsType = composeNodeAccessibleName({ label, type, zone }).includes(
          `${label}, ${CATALOG[type].name}`,
        )
        const printedRepeatsType = nodeIdentityLine(type, zone, label).startsWith(CATALOG[type].name)
        expect(printedRepeatsType, `${type}/${zone} "${label}"`).toBe(spokenRepeatsType)
      }
    }
  })
})

describe('canvas vocabulary — the list view prints the same identity as the canvas', () => {
  it('does not repeat a kept default label three times', () => {
    expect(nodeListLine('Base de datos', 'database', 'restricted')).toBe('Base de datos · núcleo restringido')
  })

  it('keeps the player s own name AND the type it is', () => {
    expect(nodeListLine('Base de pedidos', 'database', 'restricted')).toBe(
      'Base de pedidos · Base de datos · núcleo restringido',
    )
  })

  it('always opens with the label the player sees on the canvas', () => {
    for (const [type, zone] of everyPair) {
      expect(nodeListLine('Base de pedidos', type, zone), `${type}/${zone}`).toMatch(/^Base de pedidos · /)
    }
  })

  it('never leaks an internal key', () => {
    const offenders: string[] = []
    for (const [type, zone] of everyPair) {
      for (const label of [CATALOG[type].name, 'Base de pedidos']) {
        for (const key of leaks(nodeListLine(label, type, zone))) offenders.push(`${type}/${zone}: ${key}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('canvas vocabulary — the accessible name speaks the player s language', () => {
  it('never leaks an internal key into what a screen reader says', () => {
    const offenders: string[] = []
    for (const [type, zone] of everyPair) {
      for (const state of [{}, { selected: true }, { hasError: true }]) {
        const name = composeNodeAccessibleName({ label: 'App de familias', type, zone }, state)
        for (const key of leaks(name)) offenders.push(`${type}/${zone} ${JSON.stringify(state)}: ${key}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('never leaks an internal key when a colour was assigned either', () => {
    const offenders: string[] = []
    for (const [type, zone] of everyPair) {
      const name = composeNodeAccessibleName(
        { label: 'App de familias', type, zone, colorLabel: 'Violeta' },
        { selected: true, hasError: true },
      )
      for (const key of leaks(name)) offenders.push(`${type}/${zone}: ${key}`)
    }
    expect(offenders).toEqual([])
  })

  it('still says what the piece is and where it sits, by name', () => {
    for (const [type, zone] of everyPair) {
      const name = composeNodeAccessibleName({ label: 'App de familias', type, zone })
      expect(name, `${type}/${zone}`).toContain('App de familias')
      expect(name, `${type}/${zone}`).toContain(CATALOG[type].name)
      expect(name, `${type}/${zone}`).toContain(ZONE_NAMES[zone])
    }
  })

  // A node created from the palette is labelled with its own type name, so
  // naming the type again turns the announcement into a stutter: measured in
  // the DOM as "Base de datos, Base de datos, en núcleo restringido". The
  // internal key used to hide this, because the second token was a different
  // string ("database") — the stutter arrived with the fix, so it belongs to
  // the fix.
  it('does not say the same name twice when the player kept the default label', () => {
    const name = composeNodeAccessibleName({ label: 'Base de datos', type: 'database', zone: 'restricted' })

    expect(name).toBe('Base de datos, en núcleo restringido')
  })

  it('still names the type when the player renamed the node', () => {
    const name = composeNodeAccessibleName({ label: 'Base de pedidos', type: 'database', zone: 'restricted' })

    expect(name).toContain('Base de pedidos')
    expect(name).toContain('Base de datos')
  })

  it('ignores case and surrounding space when deciding the label is the type name', () => {
    const name = composeNodeAccessibleName({ label: '  base de datos ', type: 'database', zone: 'restricted' })

    expect(name).toBe('  base de datos , en núcleo restringido')
  })

  // The literal string measured in the DOM before the fix, kept as the one
  // regression this suite exists for.
  it('says the reported case out loud without either key', () => {
    const name = composeNodeAccessibleName(
      { label: 'App de familias', type: 'mobile-client', zone: 'public' },
      { hasError: true },
    )

    expect(name).not.toContain('mobile-client')
    expect(name).not.toContain('public')
    expect(name).toContain('Cliente móvil')
    expect(name).toContain('red pública')
    expect(name).toContain('con error')
  })
})
