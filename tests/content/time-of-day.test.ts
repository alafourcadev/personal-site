// The gate. `remarkDirective` is applied to every markdown file on the site
// (astro.config.mjs), and it parses the `:56` of "las 23:56" as a *text
// directive*: the minutes vanish from the page, the `<p>`/`<em>` around them
// are torn apart, and an empty `<div>` is left in their place.
//
// It deleted facts, not decoration. `n12-trap-la-copia-del-catalogo-que-pide-comercial`
// says "El dato que decide es este: el proveedor publica la lista una sola vez
// por día, a las 06:00" — and the player was reading "a las 06".
//
// So: every `H:MM` an exercise writes must appear in the HTML it renders to.
//
// The markdown processor is built from `astro.config.mjs`'s own `markdown`
// block, through the same `createMarkdownProcessor(config.markdown)` call
// Astro's content layer makes (astro/dist/content/content-layer.js). That is
// deliberate over reading the rendered content out of `astro:content`: the
// content store is a cache on disk, so a stale store would let this gate pass
// green while the shipped site is broken. Here a regression anywhere in the
// configured remark chain fails the test with no build step in between.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createMarkdownProcessor } from '@astrojs/markdown-remark'
import matter from 'gray-matter'
import { beforeAll, describe, expect, it } from 'vitest'
import astroConfig from '../../astro.config.mjs'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')

// `\d{1,2}:\d{2}` — the exact shape remark-directive mistakes for a directive.
// Bounded on both sides so an ISO-ish `1:2:30` is not double counted.
const TIME = /(?<![\d:])(\d{1,2}):(\d{2})(?![\d:])/g

function times(source: string): string[] {
  return [...source.matchAll(TIME)].map((m) => m[0])
}

function tally(list: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1)
  return counts
}

interface Exercise {
  id: string
  body: string
}

// The markdown BODY only: the frontmatter never reaches the remark pipeline,
// so a time inside `hiddenFacts` is not what this gate is about.
const exercises: Exercise[] = readdirSync(EXERCISES_DIR)
  .filter((file) => file.endsWith('.md'))
  .map((file) => ({ id: file.replace(/\.md$/, ''), body: matter(readFileSync(join(EXERCISES_DIR, file), 'utf8')).content }))

// Asserting on all 169 would be 140-odd empty expectations; the subject is
// every exercise that states a time of day at all.
const withTimes = exercises.filter((exercise) => times(exercise.body).length > 0)

let rendered = new Map<string, string>()

beforeAll(async () => {
  // `AstroUserConfig['markdown']` is the partial the user writes; Astro widens
  // it to the processor's own options before this same call.
  const processor = await createMarkdownProcessor(astroConfig.markdown as Parameters<typeof createMarkdownProcessor>[0])
  rendered = new Map(
    await Promise.all(
      exercises.map(async (exercise) => [exercise.id, (await processor.render(exercise.body)).code] as const),
    ),
  )
}, 60_000)

describe('every time of day survives the markdown pipeline', () => {
  it('reads the whole exercise collection (sanity check on the check)', () => {
    expect(exercises.length).toBe(173)
    expect(withTimes.length).toBeGreaterThan(0)
  })

  it.each(withTimes.map((exercise) => [exercise.id, exercise] as const))('%s keeps every H:MM it wrote', (_id, exercise) => {
    const html = rendered.get(exercise.id) ?? ''
    const actual = tally(times(html))

    for (const [time, count] of tally(times(exercise.body))) {
      expect(actual.get(time) ?? 0, `"${time}" lost between source and HTML`).toBeGreaterThanOrEqual(count)
    }
  })

  it('leaves no empty <div> behind in any exercise, timed or not', () => {
    const broken = exercises.filter((exercise) => /<div>\s*<\/div>/.test(rendered.get(exercise.id) ?? ''))
    expect(broken.map((exercise) => exercise.id)).toEqual([])
  })
})
