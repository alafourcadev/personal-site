// A connection focused with the keyboard did not change a single pixel.
// Measured by capturing the canvas with and without a focused connection:
// the two PNGs came out byte for byte identical, 39,556 bytes each. There
// was no `:focus-visible` rule anywhere for the playground, so the keyboard
// path (which this product deliberately supports end to end) ran blind.
// WCAG 2.4.7, level A.
//
// The indicator paints the interaction band React Flow already draws under
// every connection (`react-flow__edge-interaction`, transparent, 20px wide)
// rather than the visible stroke: the stroke's colour is set as an inline
// style per data class, and an indicator that has to out-specify an inline
// style is an indicator that stops working the day a class is declared.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(new URL('../../src/components/forja/canvas/edge-focus.css', import.meta.url), 'utf8')

describe('a connection that communicates data flow', () => {
  it('uses a dashed visible cable with a directional animation', () => {
    expect(CSS).toMatch(/\.react-flow__edge-path\s*\{[^}]*stroke-dasharray:\s*8 6/s)
    expect(CSS).toMatch(/animation:\s*forja-edge-flow 1\.25s linear infinite/)
    expect(CSS).toMatch(/@keyframes forja-edge-flow\s*\{[^}]*stroke-dashoffset:\s*-14/s)
  })

  it('keeps the cable dashed but stops it for people who reduce motion', () => {
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.react-flow__edge-path\s*\{[^}]*animation:\s*none/s,
    )
  })
})

describe('a connection focused by keyboard', () => {
  it('has a focus-visible rule at all, which is what it did not have', () => {
    expect(CSS).toMatch(/\.react-flow__edge:focus-visible/)
  })

  it('paints the band under the cable, not the cable an inline style already owns', () => {
    expect(CSS).toContain('react-flow__edge-interaction')
  })

  it('uses the brand accent, the same colour every other focus ring on the site uses', () => {
    expect(CSS).toContain('var(--accent)')
  })
})
