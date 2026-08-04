import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ENGINE_DIR = join(__dirname, '../../src/lib/forja/engine')
const FORBIDDEN = [/\bdocument\b/, /\bwindow\b/, /@xyflow/, /\bastro:/]

function engineFiles(): string[] {
  return readdirSync(ENGINE_DIR).filter((f) => f.endsWith('.ts'))
}

describe('forja engine — purity', () => {
  it('has the full module skeleton (types, catalog, legality, rules, index)', () => {
    const files = engineFiles()
    expect(files).toEqual(
      expect.arrayContaining(['types.ts', 'catalog.ts', 'legality.ts', 'rules.ts', 'index.ts']),
    )
  })

  it('imports zero DOM, window, React-flow or Astro globals', () => {
    const files = engineFiles()
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const source = readFileSync(join(ENGINE_DIR, file), 'utf8')
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(source), `${file} matched forbidden pattern ${pattern}`).toBe(false)
      }
    }
  })
})
