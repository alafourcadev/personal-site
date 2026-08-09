// The canvas draws three vertical bands — business, application,
// infrastructure — and the whole point of the layout is that the band a
// component sits in IS its layer. `clampToBand` enforces it for anything the
// player moves, but a `startingDesign` is placed by an author in the
// markdown, and nothing was checking those coordinates.
//
// Authors wrote columns at x = 28 / 388 / 660, which look like three columns
// and are not the three bands: 28 and 660 fall outside every band's own
// range. The result was a database drawn under the APPLICATION heading and a
// web client under BUSINESS — the exercise teaching that the band means
// something, and its own opening example denying it in the first second.
//
// This checks the opening frame against the same functions the canvas uses,
// so the two can never drift apart.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { bandForType, bandXRange } from '../../src/lib/forja/canvas/bands'
import type { ComponentType } from '../../src/lib/forja/engine/types'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')

interface StartingNode {
  id: string
  type: ComponentType
  position?: { x: number; y: number }
}

const exercises = readdirSync(EXERCISES_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const { data } = matter(readFileSync(join(EXERCISES_DIR, file), 'utf8'))
    return {
      id: file.replace(/\.md$/, ''),
      nodes: (data.startingDesign?.nodes ?? []) as StartingNode[],
    }
  })

describe('the starting design a player opens obeys the bands it is drawn on', () => {
  // 173 files: the original 169 plus the four `greenfield` exercises levels 1
  // to 4 now ship. Those four are also the only ones with nothing to place,
  // which is what the role means, so every rule below is about the other 169.
  it('has starting designs to check (sanity check on the check)', () => {
    expect(exercises.length).toBe(173)
    expect(exercises.reduce((total, e) => total + e.nodes.length, 0)).toBeGreaterThan(1000)
  })

  it('gives every starting node an explicit position — nothing is left to chance', () => {
    const missing = exercises.flatMap((e) => e.nodes.filter((n) => !n.position).map((n) => `${e.id}:${n.id}`))
    expect(missing).toEqual([])
  })

  it('places every starting node inside the horizontal range of its own band', () => {
    const outside = exercises.flatMap((exercise) =>
      exercise.nodes
        .filter((node) => {
          const { min, max } = bandXRange(bandForType(node.type))
          return node.position!.x < min || node.position!.x > max
        })
        .map((node) => {
          const layer = bandForType(node.type)
          const { min, max } = bandXRange(layer)
          return `${exercise.id}:${node.id} (${node.type}, ${layer}) x=${node.position!.x} outside [${min}, ${max}]`
        }),
    )
    expect(outside).toEqual([])
  })

  // A band gives 142px of horizontal slack (360 wide, minus a 190px node and
  // two 14px paddings) so two nodes of the same layer CANNOT sit side by side
  // — pushing them into their band and leaving them on one row buries the
  // left one's label under the right one's box. Inside a band the only layout
  // the geometry allows is a single column, and the separation has to come
  // from `y`. This is the check that says so.
  const NODE_BOX = { width: 190, height: 86 }

  it('never leaves two nodes overlapping each other', () => {
    const overlapping = exercises.flatMap((exercise) => {
      const hits: string[] = []
      for (let i = 0; i < exercise.nodes.length; i++) {
        for (let j = i + 1; j < exercise.nodes.length; j++) {
          const a = exercise.nodes[i]
          const b = exercise.nodes[j]
          const dx = Math.abs(a.position!.x - b.position!.x)
          const dy = Math.abs(a.position!.y - b.position!.y)
          if (dx < NODE_BOX.width && dy < NODE_BOX.height) {
            hits.push(`${exercise.id}: ${a.id} and ${b.id} overlap (dx=${dx}, dy=${dy})`)
          }
        }
      }
      return hits
    })
    expect(overlapping).toEqual([])
  })
})
