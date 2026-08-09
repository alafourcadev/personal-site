// The three list surfaces, rendered through Astro's container API so what is
// asserted is the HTML a browser actually receives — not a grep over the
// source, which proves only that a string was typed somewhere.
//
// Level 1 is the subject: it is the only level whose fourteen exercises are
// all published AND whose slugs carry the role, so the canonical order is
// checkable against the content itself rather than against a fixture.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import matter from 'gray-matter'
import { beforeAll, describe, expect, it } from 'vitest'
import LevelPage from '../../src/pages/forja/[level]/index.astro'
import LevelMap from '../../src/pages/forja/niveles/index.astro'
import RankingStrip from '../../src/components/forja/RankingStrip.astro'
import { domainLabel } from '../../src/lib/forja/progression/domain-label'
import { ROLE_LABEL, isPlayable, type ExerciseRole, type ExerciseStatus } from '../../src/lib/forja/progression/types'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')
const LEVEL = 1

// A page that exports getStaticPaths is typed as taking `never` props, which
// the container's own signature rejects — this is the shape it actually wants.
type ContainerComponent = Parameters<AstroContainer['renderToString']>[0]

interface ContentExercise {
  id: string
  level: number
  status: ExerciseStatus
  role: ExerciseRole
  domain: string
}

function levelExercises(level: number): ContentExercise[] {
  return readdirSync(EXERCISES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { data } = matter(readFileSync(join(EXERCISES_DIR, file), 'utf8'))
      return { id: file.replace(/\.md$/, ''), ...(data as Omit<ContentExercise, 'id'>) }
    })
    .filter((e) => e.level === level && isPlayable(e.status))
}

// The ids in the order the page lays them out, read straight from the markup.
function renderedOrder(html: string): string[] {
  return [...html.matchAll(/data-exercise-id="([^"]+)"/g)].map((m) => m[1])
}

function text(html: string): string {
  return html.replace(/\s+/g, ' ')
}

const content = levelExercises(LEVEL)
const roleOf = new Map(content.map((e) => [e.id, e.role]))
let levelHtml = ''
let mapHtml = ''

beforeAll(async () => {
  const container = await AstroContainer.create()
  levelHtml = await container.renderToString(LevelPage as unknown as ContainerComponent, {
    params: { level: String(LEVEL) },
    request: new Request(`https://alafourca.dev/forja/${LEVEL}`),
  })
  mapHtml = await container.renderToString(LevelMap as ContainerComponent, {
    request: new Request('https://alafourca.dev/forja/niveles'),
  })
})

describe('the content this runs against (sanity check on the check itself)', () => {
  it('level 1 ships a full level, including the trap and the counter-trap that answers it', () => {
    expect(content).toHaveLength(14)
    expect(content.filter((e) => e.role === 'trap')).toHaveLength(1)
    expect(content.filter((e) => e.role === 'counter-trap')).toHaveLength(1)
  })
})

// Fix A. `getCollection` returns the filesystem's alphabetical order of the
// slug, which put `counter-trap` 8th and the `trap` it answers 14th — while
// the counter-trap's own body says "el mismo hotel del ejercicio anterior".
describe('the level page — the order the player is given', () => {
  it('lists every published exercise of the level', () => {
    expect(renderedOrder(levelHtml).sort()).toEqual(content.map((e) => e.id).sort())
  })

  it('puts the trap before the counter-trap that answers it', () => {
    const order = renderedOrder(levelHtml)
    const at = (role: ExerciseRole) => order.findIndex((id) => roleOf.get(id) === role)
    expect(at('trap')).toBeLessThan(at('counter-trap'))
  })

  it('opens with the calibration and closes with the synthesis', () => {
    const order = renderedOrder(levelHtml)
    expect(roleOf.get(order[0])).toBe('calibration')
    expect(roleOf.get(order[order.length - 1])).toBe('synthesis')
  })

  it('is not the alphabetical order of the slug', () => {
    const order = renderedOrder(levelHtml)
    expect(order).not.toEqual([...order].sort())
  })
})

// Fix B. The list rendered ROLE_LABEL above the title, so it announced
// "Trampa" and "Contra-trampa" before the player read a word of the brief —
// the exact metagame the 24 trap/counter-trap exercises exist to prevent.
describe('the level page — the list never says which exercise is the trap', () => {
  for (const role of ['trap', 'counter-trap'] as const) {
    it(`never prints "${ROLE_LABEL[role]}"`, () => {
      expect(levelHtml).not.toContain(ROLE_LABEL[role])
    })
  }

  it('prints no role label at all — a partial scheme makes the absence itself the tell', () => {
    for (const label of Object.values(ROLE_LABEL)) {
      expect(levelHtml, label).not.toContain(label)
    }
  })

  it('still links to every exercise by its own title', () => {
    for (const { id } of content) {
      expect(levelHtml).toContain(`href="/forja/${LEVEL}/${id}"`)
    }
  })
})

describe('the level page — the domain is language, not an authoring key', () => {
  it('renders every domain through the presentation map', () => {
    for (const domain of new Set(content.map((e) => e.domain))) {
      expect(text(levelHtml), domain).toContain(`>${domainLabel(domain)}<`)
    }
  })

  it('never prints the raw unaccented key', () => {
    for (const domain of new Set(content.map((e) => e.domain))) {
      if (domainLabel(domain) === domain) continue
      expect(text(levelHtml), domain).not.toContain(`>${domain}<`)
    }
  })
})

// Fix C2. The page is static and the attempts live in localStorage, so the
// marks are filled in by the client. What the server renders must be true for
// every player at once — and must give that script something to hook onto.
describe('the level page — the progress the client fills in', () => {
  it('gives the client script the id of every exercise', () => {
    expect(renderedOrder(levelHtml)).toHaveLength(content.length)
  })

  it('reserves a per-exercise mark for the best score', () => {
    expect([...levelHtml.matchAll(/data-testid="exercise-solved"/g)]).toHaveLength(content.length)
  })

  it('states the size of the level and claims nothing about progress on first paint', () => {
    expect(text(levelHtml)).toContain(`${content.length} ejercicios publicados`)
    expect(text(levelHtml)).not.toContain('0 de')
  })
})

describe('the level map — twelve cards no longer all say the same word', () => {
  it('no longer labels every playable level with the bare word "Jugable"', () => {
    expect(mapHtml).not.toContain('>Jugable<')
  })

  it('says how many exercises each playable level has', () => {
    expect(text(mapHtml)).toContain(`${content.length} ejercicios publicados`)
  })

  it('publishes the exercise ids per level so the client can count what is solved', () => {
    const payload = mapHtml.match(/data-testid="forja-level-exercise-ids"[^>]*>([\s\S]*?)<\/script>/)?.[1]
    expect(payload).toBeTruthy()
    const byLevel = JSON.parse(payload!)
    expect(byLevel[String(LEVEL)].sort()).toEqual(content.map((e) => e.id).sort())
  })

  it('shows an overall line whose figure is the real published total', () => {
    const byLevel = JSON.parse(mapHtml.match(/forja-level-exercise-ids"[^>]*>([\s\S]*?)<\/script>/)![1])
    const total = Object.values(byLevel).flat().length
    expect(text(mapHtml)).toContain(`data-testid="forja-overall-progress"`)
    expect(text(mapHtml)).toContain(`${total} ejercicios publicados`)
  })

  it('still marks each level playable or not by its content alone, never by a flag', () => {
    const byLevel = JSON.parse(mapHtml.match(/forja-level-exercise-ids"[^>]*>([\s\S]*?)<\/script>/)![1])
    const cards = [...mapHtml.matchAll(/data-level-id="(\d+)" data-playable="(true|false)"/g)]
    expect(cards).toHaveLength(12)
    for (const [, levelId, playable] of cards) {
      expect(playable === 'true', `nivel ${levelId}`).toBe((byLevel[levelId] ?? []).length > 0)
    }
  })
})

// Fix C1. The strip read the whole local history on every page, so opening an
// exercise you had never touched showed another exercise's score as yours.
describe('the ranking strip — a score always belongs to a named exercise', () => {
  async function render(props: Record<string, unknown> = {}): Promise<string> {
    const container = await AstroContainer.create()
    return container.renderToString(RankingStrip, { props })
  }

  it('renders without the prop — the free-play pages pass nothing and must keep working', async () => {
    const html = await render()
    expect(html).toContain('data-testid="ranking-strip"')
    expect(html).toContain('data-testid="ranking-label"')
    expect(html).not.toContain('data-exercise-id')
  })

  it('scopes itself to the exercise when one is given', async () => {
    expect(await render({ exerciseId: 'n1-el-pasaporte-que-no-hay-que-archivar' })).toContain(
      'data-exercise-id="n1-el-pasaporte-que-no-hay-que-archivar"',
    )
  })

  it('ships the exercise titles ONLY when unscoped — that is the only strip whose rows need naming', async () => {
    expect(await render()).toContain('data-testid="ranking-exercise-titles"')
    expect(await render({ exerciseId: 'n1-el-tramite-que-nadie-leyo-dos-veces' })).not.toContain(
      'data-testid="ranking-exercise-titles"',
    )
  })

  it('names an exercise the player has attempts on, so no row is a number without a subject', async () => {
    const payload = (await render()).match(/data-testid="ranking-exercise-titles"[^>]*>([\s\S]*?)<\/script>/)?.[1]
    const titles = JSON.parse(payload!)
    expect(titles['n1-el-pasaporte-que-no-hay-que-archivar']).toBeTruthy()
  })

  it('tells a first-time player they have not played THIS exercise, not that nothing exists', async () => {
    expect(await render({ exerciseId: 'n1-el-turno-que-sale-de-una-copia' })).toContain('en este ejercicio')
  })
})

// The client scripts are bundled, so the rendered HTML only references them.
// This one assertion stays at source level because it is the whole defect and
// nothing downstream can observe it without a browser.
describe('the ranking strip — the defect itself, guarded at the source', () => {
  it('never asks the port for a snapshot with no exercise id again', () => {
    const source = readFileSync(join(__dirname, '../../src/components/forja/RankingStrip.astro'), 'utf8')
    expect(source).not.toMatch(/getSnapshot\(\s*\)/)
  })
})
