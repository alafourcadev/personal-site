// Reads the brand's design tokens from where they are DECLARED
// (src/layouts/BaseLayout.astro) rather than copying them into the tests.
// A copied token is a token that can drift; a read one cannot.
//
// Not a `.test.ts` file on purpose: vitest.config.ts collects
// `tests/**/*.test.ts`, so this module is a helper the specs import, never a
// spec of its own.
//
// The playground now has TWO themes to be right in, so every reader takes the
// theme as an argument. `:root` is the light block (it applies to `<html>`
// whether or not the toggle has added `dark`), `html.dark` is the dark one.
import { readFileSync } from 'node:fs'
import { FORJA_THEMES, type ForjaTheme } from '../../src/lib/forja/canvas/site-theme'

// One definition of "which themes exist", owned by the module the components
// import too. A second list here is a second thing to keep in step.
export type Theme = ForjaTheme

export const THEMES = FORJA_THEMES

const BASE_LAYOUT = readFileSync(new URL('../../src/layouts/BaseLayout.astro', import.meta.url), 'utf8')

const SELECTOR: Record<Theme, string> = { light: ':root', dark: 'html.dark' }

// The declarations of one theme and nothing else. Slicing to the block's own
// closing brace is what keeps a light-mode lookup from silently falling
// through into the dark block that follows it in the same file.
export function themeBlock(theme: Theme): string {
  const start = BASE_LAYOUT.indexOf(`${SELECTOR[theme]} {`)
  if (start === -1) throw new Error(`no ${SELECTOR[theme]} block in BaseLayout.astro`)
  const end = BASE_LAYOUT.indexOf('\n  }', start)
  if (end === -1) throw new Error(`the ${SELECTOR[theme]} block in BaseLayout.astro is never closed`)
  return BASE_LAYOUT.slice(start, end)
}

// A channel-triplet token (`--bg-deep: 236 240 246`), as the hex string the
// contrast maths needs. Tailwind composes these with
// `rgb(var(--bg-deep) / <alpha-value>)`, which is why they are stored as
// channels rather than as a colour.
export function token(theme: Theme, name: string): string {
  const match = themeBlock(theme).match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`))
  if (!match) throw new Error(`no ${theme} token --${name} in BaseLayout.astro`)
  return `#${[1, 2, 3].map((i) => Number(match[i]).toString(16).padStart(2, '0')).join('')}`
}

// A token declared as a whole CSS value rather than as channels
// (`--forja-pane: rgb(var(--bg-deep))`, `--elevation-1: none`). Returned
// verbatim, trimmed.
export function declaration(theme: Theme, name: string): string {
  const match = themeBlock(theme).match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`no ${theme} declaration --${name} in BaseLayout.astro`)
  return match[1].trim()
}

export function declares(theme: Theme, name: string): boolean {
  return new RegExp(`--${name}:`).test(themeBlock(theme))
}
