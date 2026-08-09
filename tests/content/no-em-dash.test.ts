// PRODUCT.md, under Brand Commitments, as a binding writing constraint:
//
//   "the em dash as a sentence or clause separator is forbidden across the
//    whole product, including code comments, UI copy, exercise text and commit
//    messages. It reads as machine written, and the human voice is the
//    product. Replace by splitting the sentence, not by swapping the
//    character."
//
// The 169 exercise files were swept and the code was not: 682 of them were
// left under `src/`, 21 in the verdict panel the player reads after every
// submission, 9 in the names and descriptions of the twelve levels, 7 in the
// ranking strip, 5 in the tooltips of the component palette, and one inside a
// connection-refusal message.
//
// This is the gate that keeps the sweep from having to happen twice. It reads
// the shipped source rather than a list, so a file added tomorrow is covered
// the day it lands.
//
// Scoped to `src/` deliberately. `docs/` is a working archive rather than the
// product, and the browser suite under `tests/` is the next batch, not this
// one.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const EM_DASH = '—'
const SRC = new URL('../../src/', import.meta.url)

function everyFileUnder(dir: URL): string[] {
  return readdirSync(dir).flatMap((name) => {
    const entry = new URL(name, dir)
    if (statSync(entry).isDirectory()) return everyFileUnder(new URL(`${name}/`, dir))
    return [entry.pathname]
  })
}

// A constraint checked by reading the source is only as good as the source
// being readable, and one file was not. `order.ts` carried a literal NUL byte
// inside a template literal, which makes `file` call it "data", makes grep
// skip it silently as binary, and makes git print "Binary files differ"
// instead of a diff. Three em dashes lived in it, invisible to the sweep and
// to the command the sweep was verified with.
//
// So the readability of the source is its own assertion, before the one about
// what the source says.
describe('the source under src/, which every gate has to be able to read', () => {
  it('is text, with no byte that makes a file binary to grep, to git or to a reviewer', () => {
    const offenders = everyFileUnder(SRC)
      .filter((path) => !path.endsWith('.DS_Store'))
      .filter((path) => readFileSync(path).includes(0))
      .map((path) => path.slice(path.indexOf('/src/') + 1))

    expect(offenders, `files git and grep will treat as binary:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('the em dash, which PRODUCT.md forbids across the whole product', () => {
  it('appears nowhere under src/, in copy or in a comment', () => {
    const offenders = everyFileUnder(SRC)
      .map((path) => {
        const lines = readFileSync(path, 'utf8').split('\n')
        const hits = lines
          .map((line, index) => ({ line, number: index + 1 }))
          .filter(({ line }) => line.includes(EM_DASH))
        return { path: path.slice(path.indexOf('/src/') + 1), hits }
      })
      .filter(({ hits }) => hits.length > 0)

    const report = offenders
      .flatMap(({ path, hits }) => hits.map(({ line, number }) => `${path}:${number}: ${line.trim()}`))
      .join('\n')

    expect(report, `em dashes still shipped:\n${report}`).toBe('')
  })
})
