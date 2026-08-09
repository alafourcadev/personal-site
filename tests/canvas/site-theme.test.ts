// Which theme the playground is in, and how it finds out.
//
// The canvas used to answer that question with a constant:
// `<ReactFlow colorMode="dark">`. That is why a player who had switched the
// site to light mode got a light page, a light library rail, light node cards
// and a dark blue rectangle where the drawing surface should be.
//
// React Flow's own `colorMode` accepts 'light' | 'dark' | 'system'. 'system'
// is NOT the answer: it reads `prefers-color-scheme`, and this site's switch
// does not touch the OS preference: it writes a `dark` class on <html>
// (Navbar.astro) and remembers it in localStorage. So the only source of truth
// is that class, and this is the pure function that reads it.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FORJA_THEMES, themeFromRootClass } from '../../src/lib/forja/canvas/site-theme'

function source(path: string): string {
  return readFileSync(new URL(`../../src/components/forja/canvas/${path}`, import.meta.url), 'utf8')
}

describe('the theme the site is currently showing', () => {
  it('knows the two themes the brand actually ships', () => {
    expect([...FORJA_THEMES].sort()).toEqual(['dark', 'light'])
  })

  it('reads dark from the class the site’s own switch writes on <html>', () => {
    expect(themeFromRootClass('dark')).toBe('dark')
  })

  it('reads light when that class is absent, which is what the switch leaves behind', () => {
    expect(themeFromRootClass('')).toBe('light')
  })

  it('finds the class among the others <html> carries', () => {
    expect(themeFromRootClass('scroll-smooth dark antialiased')).toBe('dark')
  })

  // `darkmode`, `dark-theme` and friends are other people's class names. A
  // substring match on them would put the playground in the wrong theme with
  // no way for the player to correct it.
  it('never mistakes a class that merely starts with the same letters', () => {
    expect(themeFromRootClass('darkmode')).toBe('light')
  })
})

describe('the canvas asks instead of assuming', () => {
  it('no longer hardcodes a colour mode on the React Flow surface', () => {
    expect(source('ForjaCanvas.tsx')).not.toContain('colorMode="dark"')
  })

  it('hands React Flow the theme the site is actually in', () => {
    expect(source('ForjaCanvas.tsx')).toContain('colorMode={theme}')
  })

  // Not a CustomEvent from Navbar.astro: that would put a contract on a
  // component every page on the site loads, and it would still miss the class
  // the inline head script sets before any React code exists. Observing the
  // attribute itself needs no cooperation from anybody.
  it('watches the class attribute rather than waiting to be told', () => {
    const hook = readFileSync(new URL('../../src/components/forja/canvas/use-site-theme.ts', import.meta.url), 'utf8')
    expect(hook).toContain('MutationObserver')
    expect(hook).toContain("attributeFilter: ['class']")
  })
})
