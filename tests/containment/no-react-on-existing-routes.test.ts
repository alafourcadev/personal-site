// D5 containment test: `/forja` is the ONLY route that pays for React.
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

describe.skipIf(!existsSync(DIST))('build output — no React outside /forja [D5]', () => {
  const htmlFiles = existsSync(DIST) ? collectHtmlFiles(DIST) : []
  const nonForjaFiles = htmlFiles.filter((f) => !relative(DIST, f).startsWith(`forja${'/'}`))

  it('found at least the known non-forja routes (sanity check on the build itself)', () => {
    expect(nonForjaFiles.length).toBeGreaterThan(10)
  })

  it('/forja is present and does reference the React island (sanity check on the check itself)', () => {
    const forjaFile = htmlFiles.find((f) => relative(DIST, f) === join('forja', 'index.html'))
    expect(forjaFile).toBeTruthy()
    expect(readFileSync(forjaFile!, 'utf-8')).toContain('ForjaCanvas')
  })

  it('no other route references the ForjaCanvas chunk or an astro-island hydration boundary', () => {
    const offenders = nonForjaFiles.filter((f) => {
      const html = readFileSync(f, 'utf-8')
      return html.includes('ForjaCanvas') || html.includes('<astro-island')
    })
    expect(offenders.map((f) => relative(DIST, f))).toEqual([])
  })
})
