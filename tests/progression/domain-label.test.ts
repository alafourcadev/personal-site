// Doc §5: "cero vocabulario interno del motor ... en lo que lee el jugador".
// The exercise list used to print `exercise.data.domain` raw, so the player
// read `facturacion`, `hoteleria`, `procesamiento-de-imagenes` — an authoring
// key, lowercase, unaccented, hyphenated. The frontmatter key is the author's
// index; this is the player's word for the same thing.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { DOMAIN_LABEL, domainLabel } from '../../src/lib/forja/progression/domain-label'

const EXERCISES_DIR = path.join(process.cwd(), 'src/content/forja/exercises')

function realDomains(): string[] {
  const domains = fs
    .readdirSync(EXERCISES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => matter(fs.readFileSync(path.join(EXERCISES_DIR, file), 'utf-8')).data.domain as string)
  return [...new Set(domains)]
}

describe('domainLabel — the accents the authoring key drops', () => {
  it('restores the accent the frontmatter key cannot carry', () => {
    expect(domainLabel('facturacion')).toBe('Facturación')
    expect(domainLabel('hoteleria')).toBe('Hotelería')
    expect(domainLabel('logistica')).toBe('Logística')
  })

  // The four keys that lost their accent when the corpus was normalised to one
  // spelling per domain. Before the map carried them, `nomina` rendered
  // "Nomina" — the exact damage the exhaustiveness gate below now prevents.
  it('carries the accent for every key normalisation stripped', () => {
    expect(domainLabel('nomina')).toBe('Nómina')
    expect(domainLabel('telefonia')).toBe('Telefonía')
    expect(domainLabel('prestamos')).toBe('Préstamos')
    expect(domainLabel('formacion')).toBe('Formación')
  })
})

describe('domainLabel — the shape of a key is never shown', () => {
  it('turns a hyphenated key into a sentence', () => {
    expect(domainLabel('recursos-humanos')).toBe('Recursos humanos')
    expect(domainLabel('procesamiento-de-imagenes')).toBe('Procesamiento de imágenes')
  })

  it('capitalises an unmapped key instead of printing it raw', () => {
    expect(domainLabel('cadena-de-frio')).toBe('Cadena de frio')
  })

  it('returns an empty string for an empty key, never the word "undefined"', () => {
    expect(domainLabel('')).toBe('')
  })
})

// The gate. `domainLabel` has a fallback that makes an unmapped key readable,
// and that fallback is a trap for exactly one class of key: a Spanish word
// whose label needs an accent the key had to drop. Nothing at runtime can tell
// `nomina` (needs "Nómina") from `retail` (needs "Retail"), so the only place
// the difference can be enforced is here, against the real content.
describe('domainLabel — every domain the corpus uses has an explicit label', () => {
  const domains = realDomains()

  it('found the real domains (sanity check on the check itself)', () => {
    expect(domains.length).toBeGreaterThan(10)
  })

  it('never falls through to the fallback — an accent would be lost silently', () => {
    const unmapped = domains.filter((d) => !(d in DOMAIN_LABEL))
    expect(
      unmapped,
      'Agregá cada una de estas claves a DOMAIN_LABEL en src/lib/forja/progression/domain-label.ts, con su acento.',
    ).toEqual([])
  })

  it('keeps every key in the authoring shape: minúsculas, sin acento, con guiones', () => {
    const malformed = domains.filter((d) => !/^[a-z]+(-[a-z]+)*$/.test(d))
    expect(
      malformed,
      'Una clave de dominio es un índice de autoría, no prosa: minúsculas ASCII y guiones. El acento lo pone DOMAIN_LABEL.',
    ).toEqual([])
  })

  it('never renders a lowercase first letter', () => {
    const offenders = domains.filter((d) => {
      const first = domainLabel(d).charAt(0)
      return first !== first.toLocaleUpperCase('es')
    })
    expect(offenders).toEqual([])
  })

  it('never renders a hyphen — that is file-naming, not language', () => {
    expect(domains.filter((d) => domainLabel(d).includes('-'))).toEqual([])
  })

  it('carries no label for a domain the corpus abandoned', () => {
    const orphans = Object.keys(DOMAIN_LABEL).filter((key) => !domains.includes(key))
    expect(
      orphans,
      'Una etiqueta sin ejercicio detrás es una regla muerta: borrala o el próximo autor la va a leer como convención vigente.',
    ).toEqual([])
  })
})
