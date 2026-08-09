// Acquisition path for La Forja. Before this test the product had none: no
// route on the site linked to `/forja` or `/forja/niveles`, so 168 playable
// exercises were reachable only by typing the URL. Two things are asserted
// here because they are the two ends of the same path:
//
//   1. the site's main navigation offers La Forja on EVERY route (Navbar is
//      rendered by BaseLayout, which every page uses), and
//   2. `/forja` — the shortest, most shareable URL of the product — is not a
//      dead end: it says what La Forja is and links to the level map.
//
// Rendered through Astro's container API rather than grepping the source, so
// what is asserted is the HTML a browser actually receives.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import reactRenderer from '@astrojs/react/server.js'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import Navbar from '../../src/components/Navbar.astro'
import ForjaIndex from '../../src/pages/forja/index.astro'
import { LEVELS } from '../../src/lib/forja/progression/levels'
import { isPlayable } from '../../src/lib/forja/progression/types'

const LEVELS_HREF = '/forja/niveles'
const LABEL = 'La Forja'
const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')

async function renderNavbar(
  variant: 'home' | 'blog' = 'home',
  pathname = '/',
): Promise<string> {
  const container = await AstroContainer.create()
  return container.renderToString(Navbar, {
    props: { variant },
    request: new Request(`https://alafourca.dev${pathname}`),
  })
}

function anchorsTo(html: string, href: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].filter((m) => m[0].includes(`href="${href}"`)).map((m) => m[0])
}

describe('main navigation — La Forja is reachable from every route', () => {
  for (const variant of ['home', 'blog'] as const) {
    it(`the "${variant}" navbar links to the level map`, async () => {
      const html = await renderNavbar(variant)
      expect(html).toContain(`href="${LEVELS_HREF}"`)
      expect(html).toContain(LABEL)
    })
  }

  it('offers the link in both the desktop bar and the mobile menu', async () => {
    // Two separate <nav> elements render the same link list; a link present in
    // only one of them is invisible to half the traffic.
    expect(anchorsTo(await renderNavbar(), LEVELS_HREF)).toHaveLength(2)
  })

  it('marks La Forja as the current section anywhere under /forja', async () => {
    // The product spans /forja, /forja/niveles, /forja/[level] and
    // /forja/[level]/[exercise]; the nav entry is the section, not one page.
    for (const pathname of ['/forja', '/forja/niveles', '/forja/4', '/forja/4/n4-core-el-pedido']) {
      const anchors = anchorsTo(await renderNavbar('blog', pathname), LEVELS_HREF)
      expect(anchors.length, pathname).toBeGreaterThan(0)
      expect(anchors[0], pathname).toContain('aria-current="page"')
    }
  })

  it('stays plain HTML — the entry point must not put React on every page [D5]', async () => {
    // The navbar renders on every route through BaseLayout, so anything
    // hydrated here would be downloaded site-wide. `/forja` is the only route
    // that may pay for React; a link is free and must stay that way.
    const html = await renderNavbar('blog', '/blog')
    expect(html).not.toContain('<astro-island')
    expect(html).not.toContain('ForjaCanvas')
  })

  it('does not mark La Forja as current on unrelated routes', async () => {
    const anchors = anchorsTo(await renderNavbar('blog', '/blog'), LEVELS_HREF)
    expect(anchors[0]).not.toContain('aria-current')
  })
})

// The number of playable exercises, counted from the content files with the
// same rule the site uses (EC6: PILOT and PUBLISHED are served, nothing else).
// The page must not state a figure a reader can disprove by counting.
function playableExerciseCount(): number {
  return readdirSync(EXERCISES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => matter(readFileSync(join(EXERCISES_DIR, f), 'utf8')).data)
    .filter((data) => isPlayable(data.status)).length
}

async function renderForjaIndex(): Promise<string> {
  const container = await AstroContainer.create()
  await container.addServerRenderer({ name: '@astrojs/react', renderer: reactRenderer })
  container.addClientRenderer({ name: '@astrojs/react', entrypoint: '@astrojs/react/client.js' })
  return container.renderToString(ForjaIndex, {
    request: new Request('https://alafourca.dev/forja'),
  })
}

// The navbar renders inside this page too, so its own link would satisfy any
// naive assertion. What is under test is the PAGE's body: someone who lands on
// `/forja` and reads it must find the way on, without hunting the chrome.
function withoutNavigation(html: string): string {
  return html.replace(/<nav\b[\s\S]*?<\/nav>/g, '')
}

describe('/forja — the shortest URL of the product is not a dead end', () => {
  it('offers a way into the level map from its own content, not only from the navbar', async () => {
    const body = withoutNavigation(await renderForjaIndex())
    expect(anchorsTo(body, LEVELS_HREF).length).toBeGreaterThan(0)
  })

  it('states how much there is to play, in figures taken from the real content', async () => {
    const html = withoutNavigation(await renderForjaIndex())
    // Both figures with their unit, so a bare number appearing anywhere else
    // in the markup (a class, an id, a colour) cannot make this pass.
    expect(html.replace(/\s+/g, ' ')).toContain(`${LEVELS.length} niveles`)
    expect(html.replace(/\s+/g, ' ')).toContain(`${playableExerciseCount()} ejercicios jugables`)
  })

  it('keeps the free canvas and its ranking on the same route', async () => {
    // The route does not move (D5's containment and every shared link depend
    // on it): the intro is added above the playground, never instead of it.
    const html = await renderForjaIndex()
    expect(html).toContain('ForjaCanvas')
    expect(html).toContain('data-testid="ranking-strip"')
  })
})
