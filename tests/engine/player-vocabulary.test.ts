// The port-mismatch message is the one a player reads most often — it is the
// only feedback you get while you are still learning what connects to what.
// CONTEXTO-PARA-AGENTES §5 forbids internal engine vocabulary in anything the
// player reads; this suite pins that for every ordered pair of component types,
// on both surfaces that produce the copy: the scored finding (evaluateRules)
// and the live connection refusal (checkConnection).
import { describe, expect, it } from 'vitest'
import { CATALOG_UI } from '../../src/lib/forja/canvas/catalog-ui'
import { checkConnection } from '../../src/lib/forja/engine'
import { CATALOG } from '../../src/lib/forja/engine/catalog'
import {
  isPortCompatible,
  isTrustZoneJump,
  ZONE_NAMES,
  ZONES,
} from '../../src/lib/forja/engine/legality'
import { evaluateRules } from '../../src/lib/forja/engine/rules'
import type { ComponentType, Design, Zone } from '../../src/lib/forja/engine/types'

const TYPES = Object.keys(CATALOG) as ComponentType[]

// The internal keys. Matched case-sensitively and verbatim: the player-facing
// names are Spanish and capitalised ("CDN", "Cache"), so they can never
// collide with the kebab-case keys below.
const INTERNAL_KEYS = TYPES

const SOURCE_LABEL = 'Pieza que sale'
const TARGET_LABEL = 'Pieza que entra'

// Deliberately distinctive labels: any kebab-case key found in the produced
// copy can only have come from interpolating the internal `type`.
const pair = (source: ComponentType, target: ComponentType): Design => ({
  nodes: [
    { id: 's', type: source, label: SOURCE_LABEL, zone: 'private', props: {} },
    { id: 't', type: target, label: TARGET_LABEL, zone: 'private', props: {} },
  ],
  edges: [{ id: 's->t', from: { node: 's' }, to: { node: 't' }, dataClass: 'public' }],
})

const incompatiblePairs = TYPES.flatMap((source) =>
  TYPES.filter((target) => !isPortCompatible(source, target)).map(
    (target) => [source, target] as const,
  ),
)

const leaks = (text: string) => INTERNAL_KEYS.filter((key) => text.includes(key))

describe('forja engine — the catalog names every type in the player s language', () => {
  it('gives every component type a non-empty human name', () => {
    for (const type of TYPES) {
      expect(CATALOG[type].name, `${type} has no human name`).toBeTruthy()
    }
  })

  it('uses exactly the name the palette shows, so the player reads one word per piece', () => {
    for (const type of TYPES) {
      expect(
        CATALOG[type].name,
        `${type}: engine name and palette label drifted apart — the player would read two different names for the same piece`,
      ).toBe(CATALOG_UI[type].label)
    }
  })
})

describe('forja engine — port-mismatch speaks the player s language', () => {
  it('covers every incompatible ordered pair of component types', () => {
    expect(incompatiblePairs.length).toBeGreaterThan(300)
  })

  it('never leaks an internal type key into the finding a player reads', () => {
    const offenders: string[] = []
    for (const [source, target] of incompatiblePairs) {
      const found = evaluateRules(pair(source, target)).filter((f) => f.rule === 'port-mismatch')
      for (const key of leaks(found[0].evidence)) offenders.push(`${source}->${target} evidence: ${key}`)
      for (const key of leaks(found[0].why)) offenders.push(`${source}->${target} why: ${key}`)
    }
    expect(offenders).toEqual([])
  })

  it('never leaks an internal type key into the live connection refusal', () => {
    const offenders: string[] = []
    for (const [source, target] of incompatiblePairs) {
      const verdict = checkConnection(pair(source, target), { node: 's' }, { node: 't' })
      for (const key of leaks(verdict.why ?? '')) offenders.push(`${source}->${target} why: ${key}`)
      for (const key of leaks(verdict.consequence ?? ''))
        offenders.push(`${source}->${target} consequence: ${key}`)
    }
    expect(offenders).toEqual([])
  })

  it('names the two nodes on the canvas as its evidence, like the other rules do', () => {
    const found = evaluateRules(pair('database', 'service')).filter((f) => f.rule === 'port-mismatch')
    expect(found[0].evidence).toBe(`${SOURCE_LABEL} → ${TARGET_LABEL}`)
    const verdict = checkConnection(pair('database', 'service'), { node: 's' }, { node: 't' })
    expect(verdict.consequence).toBe(`${SOURCE_LABEL} → ${TARGET_LABEL}`)
  })

  it('explains the contract with the names of the two kinds of piece', () => {
    const found = evaluateRules(pair('database', 'service')).filter((f) => f.rule === 'port-mismatch')
    expect(found[0].why).toContain(CATALOG.service.name)
    expect(found[0].why).toContain(CATALOG.database.name)
  })

  it('tells a person which kind of piece is missing, by name', () => {
    const found = evaluateRules(pair('actor', 'service')).filter((f) => f.rule === 'port-mismatch')
    expect(found[0].why).toContain(CATALOG.service.name)
    expect(found[0].why).toMatch(/cliente/)
  })

  // Guards the other half of the brief: the copy changes, the verdict does not.
  it('still raises exactly one blocking port-mismatch for every incompatible pair', () => {
    for (const [source, target] of incompatiblePairs) {
      const found = evaluateRules(pair(source, target)).filter((f) => f.rule === 'port-mismatch')
      expect(found, `${source} -> ${target}`).toHaveLength(1)
      expect(found[0].severity, `${source} -> ${target}`).toBe('blocking')
      expect(found[0].title, `${source} -> ${target}`).toBe('Conexión imposible por contrato')
    }
  })

  it('still lets every compatible pair through the live check', () => {
    for (const source of TYPES) {
      for (const target of TYPES) {
        if (!isPortCompatible(source, target)) continue
        const verdict = checkConnection(pair(source, target), { node: 's' }, { node: 't' })
        expect(verdict.ok, `${source} -> ${target}`).toBe(true)
      }
    }
  })
})

// -- trust-zone-jump ------------------------------------------------------
// The blocking rule that fires most while someone is still learning to wire
// two boxes together. It used to print the raw `Zone` keys, so a level-1
// player read "Comprador (public) → Servicio de pagos (private)" next to
// "Diseño ilegal — sin puntaje": two English identifiers nobody taught them,
// at the worst possible moment. Same criterion as CATALOG[type].name above.

// The four internal keys, matched verbatim. The player-facing names are
// Spanish and accented ("red pública", never "public"), so no name can
// collide with a key by accident.
const ZONE_KEYS = ZONES

// `service -> service` is port-compatible, so trust-zone-jump is the only
// blocking rule these designs can raise — the zone pair is the variable.
const zonePair = (from: Zone, to: Zone): Design => ({
  nodes: [
    { id: 's', type: 'service', label: SOURCE_LABEL, zone: from, props: {} },
    { id: 't', type: 'service', label: TARGET_LABEL, zone: to, props: {} },
  ],
  edges: [{ id: 's->t', from: { node: 's' }, to: { node: 't' }, dataClass: 'public' }],
})

const jumpingPairs = ZONES.flatMap((from) =>
  ZONES.filter((to) => isTrustZoneJump(from, to)).map((to) => [from, to] as const),
)

const zoneLeaks = (text: string) => ZONE_KEYS.filter((key) => text.includes(key))

describe('forja engine — every trust zone has a name in the player s language', () => {
  it('names all four zones', () => {
    for (const zone of ZONES) {
      expect(ZONE_NAMES[zone], `${zone} has no human name`).toBeTruthy()
    }
  })

  it('never reuses the internal key as the name', () => {
    for (const zone of ZONES) {
      expect(ZONE_NAMES[zone], `${zone}: the name is still the key`).not.toBe(zone)
    }
  })

  it('gives each zone a distinct name, so two zones never read the same', () => {
    const names = ZONES.map((zone) => ZONE_NAMES[zone])
    expect(new Set(names).size).toBe(ZONES.length)
  })
})

describe('forja engine — trust-zone-jump speaks the player s language', () => {
  it('covers every ordered pair of zones that jumps', () => {
    expect(jumpingPairs.length).toBe(6)
  })

  it('never leaks an internal zone key into the finding a player reads', () => {
    const offenders: string[] = []
    for (const [from, to] of jumpingPairs) {
      const found = evaluateRules(zonePair(from, to)).filter((f) => f.rule === 'trust-zone-jump')
      for (const key of zoneLeaks(found[0].evidence)) offenders.push(`${from}->${to} evidence: ${key}`)
      for (const key of zoneLeaks(found[0].why)) offenders.push(`${from}->${to} why: ${key}`)
    }
    expect(offenders).toEqual([])
  })

  it('never leaks an internal zone key into the live connection refusal', () => {
    const offenders: string[] = []
    for (const [from, to] of jumpingPairs) {
      const verdict = checkConnection(zonePair(from, to), { node: 's' }, { node: 't' })
      for (const key of zoneLeaks(verdict.why ?? '')) offenders.push(`${from}->${to} why: ${key}`)
      for (const key of zoneLeaks(verdict.consequence ?? ''))
        offenders.push(`${from}->${to} consequence: ${key}`)
    }
    expect(offenders).toEqual([])
  })

  it('qualifies each of the two boxes with the name of the zone it sits in', () => {
    const found = evaluateRules(zonePair('public', 'restricted')).filter(
      (f) => f.rule === 'trust-zone-jump',
    )
    expect(found[0].evidence).toBe(
      `${SOURCE_LABEL} (${ZONE_NAMES.public}) → ${TARGET_LABEL} (${ZONE_NAMES.restricted})`,
    )
    const verdict = checkConnection(zonePair('public', 'restricted'), { node: 's' }, { node: 't' })
    expect(verdict.consequence).toBe(
      `${SOURCE_LABEL} (${ZONE_NAMES.public}) → ${TARGET_LABEL} (${ZONE_NAMES.restricted})`,
    )
  })

  // Guards the other half of the brief: the copy changes, the verdict does not.
  it('still raises exactly one blocking trust-zone-jump for every jumping pair', () => {
    for (const [from, to] of jumpingPairs) {
      const found = evaluateRules(zonePair(from, to)).filter((f) => f.rule === 'trust-zone-jump')
      expect(found, `${from} -> ${to}`).toHaveLength(1)
      expect(found[0].severity, `${from} -> ${to}`).toBe('blocking')
      expect(found[0].title, `${from} -> ${to}`).toBe('Salto de zona de confianza')
    }
  })

  it('still lets every pair one zone apart or closer through the live check', () => {
    for (const from of ZONES) {
      for (const to of ZONES) {
        if (isTrustZoneJump(from, to)) continue
        const verdict = checkConnection(zonePair(from, to), { node: 's' }, { node: 't' })
        expect(verdict.ok, `${from} -> ${to}`).toBe(true)
      }
    }
  })
})
