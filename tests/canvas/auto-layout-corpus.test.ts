// "Ordenar el diagrama" against the real corpus rather than against a diagram
// invented to make it look good. Every starting design in
// `src/content/forja/exercises/` is arranged and the result checked, including
// the densest ones (11 pieces, 13 cables) and the four `greenfield` exercises,
// which have nothing to arrange at all.
//
// A hand-built case proves the algorithm untangles. This proves it never
// breaks anything: no piece leaves its band, no two pieces of a band land on
// top of each other, and the second press changes nothing. Those are the three
// ways this feature could quietly damage a diagram a player is working on.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { bandForType, bandXRange } from '../../src/lib/forja/canvas/bands'
import { DEFAULT_NODE_SIZE, DEFAULT_TOP } from '../../src/lib/forja/canvas/placement'
import { LAYOUT_ROW_STEP, arrangedPositions, countCrossings } from '../../src/lib/forja/canvas/auto-layout'
import type { Design } from '../../src/lib/forja/engine/types'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')

const corpus = readdirSync(EXERCISES_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const { data } = matter(readFileSync(join(EXERCISES_DIR, file), 'utf8'))
    const design = (data.startingDesign ?? { nodes: [], edges: [] }) as Design
    return { id: file.replace(/\.md$/, ''), design: { nodes: design.nodes ?? [], edges: design.edges ?? [] } }
  })

function arrange(design: Design): Design {
  const positions = arrangedPositions(design)
  return { ...design, nodes: design.nodes.map((node) => ({ ...node, position: positions[node.id] ?? node.position })) }
}

describe('arranging every diagram the corpus ships', () => {
  it('has the whole corpus to work on, blank canvases included', () => {
    expect(corpus.length).toBe(173)
    expect(corpus.filter((entry) => entry.design.nodes.length === 0).length).toBe(4)
    expect(Math.max(...corpus.map((entry) => entry.design.nodes.length))).toBeGreaterThanOrEqual(11)
  })

  it('never takes a piece out of its own band', () => {
    const escaped = corpus.flatMap((entry) => {
      const positions = arrangedPositions(entry.design)
      return entry.design.nodes
        .filter((node) => {
          const { min, max } = bandXRange(bandForType(node.type))
          return positions[node.id].x < min || positions[node.id].x > Math.max(min, max)
        })
        .map((node) => `${entry.id}:${node.id}`)
    })
    expect(escaped).toEqual([])
  })

  it('never lands two pieces of the same band on top of each other', () => {
    const collisions = corpus.flatMap((entry) => {
      const positions = arrangedPositions(entry.design)
      const found: string[] = []
      for (const a of entry.design.nodes) {
        for (const b of entry.design.nodes) {
          if (a.id >= b.id) continue
          if (positions[a.id].x !== positions[b.id].x) continue
          if (Math.abs(positions[a.id].y - positions[b.id].y) < DEFAULT_NODE_SIZE.height) {
            found.push(`${entry.id}:${a.id}+${b.id}`)
          }
        }
      }
      return found
    })
    expect(collisions).toEqual([])
  })

  it('rows every band on the same step', () => {
    const offGrid = corpus.flatMap((entry) => {
      const positions = arrangedPositions(entry.design)
      return entry.design.nodes
        .filter((node) => (positions[node.id].y - DEFAULT_TOP) % LAYOUT_ROW_STEP !== 0)
        .map((node) => `${entry.id}:${node.id}`)
    })
    expect(offGrid).toEqual([])
  })

  it('computes the identical answer on the second press', () => {
    const drifted = corpus
      .filter((entry) => {
        const once = arrangedPositions(entry.design)
        return JSON.stringify(arrangedPositions(arrange(entry.design))) !== JSON.stringify(once)
      })
      .map((entry) => entry.id)
    expect(drifted).toEqual([])
  })

  // Not "it always improves": a diagram an author already drew clean has
  // nothing to improve, and a layered layout is a heuristic, not an optimum.
  // What it may never do is make a diagram worse than it found it.
  it('never leaves a diagram with more crossings than it found', () => {
    const worse = corpus
      .filter((entry) => countCrossings(arrange(entry.design)) > countCrossings(entry.design))
      .map((entry) => `${entry.id}: ${countCrossings(entry.design)} -> ${countCrossings(arrange(entry.design))}`)
    expect(worse).toEqual([])
  })
})
