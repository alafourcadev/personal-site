// D5 containment test: `/forja/lienzo` is the ONLY static landing route that
// pays for the free-play React island. The marketing route stays static.
// Walks the real `npm run build` output (not source) — every other page's
// HTML must reference neither the ForjaCanvas chunk nor an astro-island
// hydration boundary. Requires `dist/` to exist; skips (not fails) when it
// doesn't, since `npm test` alone never builds — `npm run build && npm
// test` (or this repo's CI order) is what makes this assertion real.
//
// Lives under tests/containment/, not tests/build/ (task D2.7's literal
// path) — a machine-local global gitignore (`**/build/`) silently excludes
// any directory literally named "build" anywhere in the tree, which would
// have made this test file untrackable by git without the author ever
// seeing a warning from a plain `git add tests/`.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const DIST = join(process.cwd(), 'dist')

function collectHtmlFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectHtmlFiles(full))
    } else if (entry.endsWith('.html')) {
      files.push(full)
    }
  }
  return files
}

describe.skipIf(!existsSync(DIST))('build output — the marketing landing stays static [D5]', () => {
  const htmlFiles = existsSync(DIST) ? collectHtmlFiles(DIST) : []
  const nonForjaFiles = htmlFiles.filter((f) => !relative(DIST, f).startsWith(`forja${'/'}`))

  it('found at least the known non-forja routes (sanity check on the build itself)', () => {
    expect(nonForjaFiles.length).toBeGreaterThan(10)
  })

  it('/forja is present and contains product evidence without hydrating the canvas', () => {
    const landingFile = htmlFiles.find((f) => relative(DIST, f) === join('forja', 'index.html'))
    expect(landingFile).toBeTruthy()
    const html = readFileSync(landingFile!, 'utf-8')
    expect(html).toContain('/forja/product-canvas.webp')
    expect(html).not.toContain('ForjaCanvas')
    expect(html).not.toContain('<astro-island')
  })

  it('/forja/lienzo owns the free-play React island', () => {
    const canvasFile = htmlFiles.find((f) => relative(DIST, f) === join('forja', 'lienzo', 'index.html'))
    expect(canvasFile).toBeTruthy()
    expect(readFileSync(canvasFile!, 'utf-8')).toContain('ForjaCanvas')
  })

  it('no non-forja route references the ForjaCanvas chunk or an astro-island hydration boundary', () => {
    const offenders = nonForjaFiles.filter((f) => {
      const html = readFileSync(f, 'utf-8')
      return html.includes('ForjaCanvas') || html.includes('<astro-island')
    })
    expect(offenders.map((f) => relative(DIST, f))).toEqual([])
  })
})
