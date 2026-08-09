import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { beforeAll, describe, expect, it } from 'vitest'
import LevelPage from '../../src/pages/forja/[level]/index.astro'
import LevelMap from '../../src/pages/forja/niveles/index.astro'
import PlacementPage from '../../src/pages/forja/ubicacion.astro'
import {
  CURRICULUM_ARCS,
  recommendContinue,
  type GuidedExercise,
} from '../../src/lib/forja/progression/guided-route'

type ContainerComponent = Parameters<AstroContainer['renderToString']>[0]

const exercises: GuidedExercise[] = [
  { id: 'first', level: 1, title: 'Primera calibración', href: '/forja/1/first' },
  { id: 'second', level: 1, title: 'Segunda decisión', href: '/forja/1/second' },
  { id: 'third', level: 2, title: 'Tercera decisión', href: '/forja/2/third' },
]

describe('guided route model', () => {
  it('covers all twelve levels once across four named arcs', () => {
    expect(CURRICULUM_ARCS).toHaveLength(4)
    expect(CURRICULUM_ARCS.map((arc) => arc.name)).toEqual([
      'Leer el sistema',
      'Diseñar para producción',
      'Sostener escala y confianza',
      'Defender la evolución',
    ])
    expect(CURRICULUM_ARCS.flatMap((arc) => arc.levelIds)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('starts with the first exercise when this browser has no progress', () => {
    expect(recommendContinue(exercises, new Set())).toMatchObject({
      kind: 'start',
      href: '/forja/1/first',
      label: 'Empezar acá',
    })
  })

  it('continues with the first unsolved exercise in route order', () => {
    expect(recommendContinue(exercises, new Set(['first']))).toMatchObject({
      kind: 'continue',
      title: 'Segunda decisión',
      href: '/forja/1/second',
    })
  })

  it('offers review after every published exercise is solved', () => {
    expect(recommendContinue(exercises, new Set(exercises.map((exercise) => exercise.id)))).toMatchObject({
      kind: 'complete',
      href: '/forja/12',
    })
  })
})

let mapHtml = ''
let levelHtml = ''
let placementHtml = ''

beforeAll(async () => {
  const container = await AstroContainer.create()
  mapHtml = await container.renderToString(LevelMap as ContainerComponent, {
    request: new Request('https://alafourca.dev/forja/niveles'),
  })
  levelHtml = await container.renderToString(LevelPage as unknown as ContainerComponent, {
    params: { level: '4' },
    request: new Request('https://alafourca.dev/forja/4'),
  })
  placementHtml = await container.renderToString(PlacementPage as ContainerComponent, {
    request: new Request('https://alafourca.dev/forja/ubicacion'),
  })
})

describe('guided route pages', () => {
  it('groups the map into four arcs without removing any level card', () => {
    expect(mapHtml.match(/data-testid="curriculum-arc"/g)).toHaveLength(4)
    expect(mapHtml.match(/data-testid="level-card"/g)).toHaveLength(12)
  })

  it('renders one recommendation and a dismissible inline first-run guide', () => {
    expect(mapHtml.match(/data-testid="forja-continue-card"/g)).toHaveLength(1)
    expect(mapHtml).toContain('data-testid="forja-first-run"')
    expect(mapHtml).toContain('data-testid="forja-onboarding-dismiss"')
    expect(mapHtml).not.toContain('role="dialog"')
  })

  it('states that prerequisites are advice rather than locks', () => {
    expect(mapHtml).toContain('Podés entrar igual.')
    expect(levelHtml).toContain('Podés entrar igual.')
  })

  it('shows the arc and a single next-step card on a level page', () => {
    expect(levelHtml).toContain('DISEÑAR PARA PRODUCCIÓN')
    expect(levelHtml.match(/data-testid="level-continue"/g)).toHaveLength(1)
    expect(levelHtml.match(/data-testid="level-continue-link"/g)).toHaveLength(1)
  })

  it('links experienced users to four real calibration checkpoints', () => {
    expect(mapHtml).toContain('href="/forja/ubicacion"')
    expect(placementHtml.match(/data-testid="placement-checkpoint"/g)).toHaveLength(4)
    const levels = [...placementHtml.matchAll(/data-testid="placement-checkpoint" data-level-id="(\d+)"/g)].map(
      (match) => Number(match[1]),
    )
    expect(levels).toEqual([1, 4, 7, 10])
    expect(placementHtml.match(/data-testid="placement-checkpoint-link"/g)).toHaveLength(4)
  })
})
