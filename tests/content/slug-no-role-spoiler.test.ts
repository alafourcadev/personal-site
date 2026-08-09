// The other half of tests/progression/no-role-spoiler.test.ts.
//
// The brief and the level list stopped printing "Trampa" / "Contra-trampa",
// because naming a trap destroys it: the exercise works by letting the player
// give the answer they were trained to give and then showing why it fails.
// The URL kept saying it anyway — `/forja/1/n1-trap-el-pasaporte-que-no-hay-que-archivar`
// is in the list's `href`, in the browser's status bar on hover, and in the
// address bar once the exercise opens.
//
// Dropping the token from the traps alone left a subtler tell: they became the
// ONLY slugs without a role token, so a player comparing two links could read
// the ABSENCE as the answer. The fix is that no slug says anything about its
// role — the token is gone from all 169, and the level prefix is the only
// structure a slug carries.
//
// The filename IS the collection id and the URL, so this is a filename rule.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import type { ExerciseRole } from '../../src/lib/forja/progression/types'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')

const exercises = readdirSync(EXERCISES_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => {
    const data = matter(readFileSync(join(EXERCISES_DIR, file), 'utf8')).data
    return {
      id: file.replace(/\.md$/, ''),
      role: data.role as ExerciseRole,
      level: data.level as number,
    }
  })

// Every value `role` can take, plus the Spanish words the UI used to print
// for the two that spoil. A slug may not contain any of them as a segment.
const ROLE_WORDS = [
  'calibration',
  'core',
  'greenfield',
  'tradeoff',
  'synthesis',
  'trap',
  'counter-trap',
  'trampa',
  'contratrampa',
]
const ROLE_IN_SLUG = new RegExp(`(^|-)(${ROLE_WORDS.join('|')})(-|$)`)

describe('the URL never announces what kind of exercise it is', () => {
  it('has the whole corpus to check (sanity check on the check)', () => {
    expect(exercises.length).toBe(173)
    expect(exercises.filter((e) => e.role === 'trap' || e.role === 'counter-trap').length).toBe(24)
    expect(exercises.filter((e) => e.role === 'greenfield').length).toBe(4)
  })

  it('never puts a role name in ANY slug, so no slug stands out by lacking one', () => {
    const leaking = exercises.filter((exercise) => ROLE_IN_SLUG.test(exercise.id))
    expect(leaking.map((exercise) => exercise.id)).toEqual([])
  })

  it('keeps every slug unique — the id is the URL', () => {
    const ids = exercises.map((exercise) => exercise.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every slug its level prefix, and the prefix tells the truth', () => {
    for (const exercise of exercises) {
      const prefix = exercise.id.match(/^n(\d+)-/)
      expect(prefix, `${exercise.id} has no level prefix`).not.toBeNull()
      expect(Number(prefix![1]), `${exercise.id} claims a level its frontmatter denies`).toBe(exercise.level)
    }
  })

  it('leaves something after the prefix — a bare "n4-" is not a slug', () => {
    const empty = exercises.filter((exercise) => /^n\d+-$/.test(exercise.id))
    expect(empty.map((exercise) => exercise.id)).toEqual([])
  })
})
