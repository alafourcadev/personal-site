// The only keyboard documentation the product has said "Enter para
// crear/conectar". Enter on a focused component does nothing: the connect
// gesture starts with `c`, and Enter only closes a connection that is
// already in progress. The state of the design before and after pressing
// Enter on a node is identical.
//
// Wrong documentation of a keyboard path is worse than none. It is the
// difference between a player who looks for the gesture and one who
// concludes the gesture does not exist. So the legend is asserted against
// the handler rather than against a string somebody remembered.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CANVAS = readFileSync(
  new URL('../../src/components/forja/canvas/ForjaCanvas.tsx', import.meta.url),
  'utf8',
)
// The legend renders its keys in `<kbd>`, so the markup is stripped before
// matching: what is asserted is what a player reads, not how it is marked up.
const FREE_CANVAS = readFileSync(new URL('../../src/pages/forja/lienzo.astro', import.meta.url), 'utf8').replace(
  /<[^>]+>/g,
  '',
)

// The branch that starts connect mode, read from the handler itself.
const connectKey = CANVAS.match(/event\.key === '(\w+)' && !connectSourceId/)?.[1]

describe('the keyboard legend on /forja/lienzo', () => {
  it('is written against a handler that really starts a connection with one key', () => {
    expect(connectKey).toBeDefined()
  })

  // `\b` is ASCII in JavaScript and does not close after an accented letter,
  // so the left edge is asserted with a unicode lookbehind instead.
  it('names that exact key', () => {
    expect(FREE_CANVAS).toMatch(new RegExp(`(?<![\\p{L}])${connectKey} para`, 'u'))
  })

  // Enter alone never starts anything. It completes a connection whose
  // source is already chosen, and the legend has to say which half it is.
  it('never promises that Enter on its own creates or connects', () => {
    expect(FREE_CANVAS).not.toMatch(/Enter para crear\/conectar/)
  })

  // The menu shortcut is implemented for both nodes and connections and was
  // documented nowhere, which is how a player ends up believing a connection
  // cannot declare what travels through it.
  it('names the shortcut that opens a component’s or a connection’s menu', () => {
    expect(CANVAS).toContain("event.key === 'F10'")
    expect(FREE_CANVAS).toContain('Shift+F10')
  })
})
