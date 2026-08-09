// The role of an exercise — `trap`, `counter-trap` — is authoring metadata,
// and printing it to the player destroys the exercise it labels: a trap works
// because the player gives the answer they were trained to give and finds out
// why it fails. Announcing it teaches the metagame the counter-traps exist to
// prevent ("if it looks obvious, pick the other one").
//
// The level list already dropped it. This gate exists because it survived one
// click: `ExerciseBrief.astro` printed it again on the exercise page itself,
// so a player who opened the trap still read the word before the first
// sentence of the brief.
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import { getCollection } from 'astro:content'
import { describe, expect, it } from 'vitest'
import ExerciseBrief from '../../src/components/forja/ExerciseBrief.astro'
import { ROLE_LABEL } from '../../src/lib/forja/progression/types'

const SPOILERS = [ROLE_LABEL.trap, ROLE_LABEL['counter-trap']]

async function renderBrief(exercise: unknown): Promise<string> {
  const container = await AstroContainer.create()
  return container.renderToString(ExerciseBrief, { props: { exercise } })
}

describe('the exercise brief never names the exercise’s role', () => {
  it('renders a trap without the word that gives it away', async () => {
    const [trap] = await getCollection('forjaExercises', ({ data }) => data.role === 'trap')
    expect(trap, 'no hay ningún ejercicio de tipo trap en el contenido').toBeDefined()

    const html = await renderBrief(trap.data)
    expect(html).toContain(trap.data.title)
    for (const spoiler of SPOILERS) {
      expect(html, `el brief imprime "${spoiler}"`).not.toContain(spoiler)
    }
  })

  it('renders a counter-trap without it either', async () => {
    const [counterTrap] = await getCollection('forjaExercises', ({ data }) => data.role === 'counter-trap')
    expect(counterTrap).toBeDefined()

    const html = await renderBrief(counterTrap.data)
    for (const spoiler of SPOILERS) {
      expect(html, `el brief imprime "${spoiler}"`).not.toContain(spoiler)
    }
  })

  it('shows the business domain in plain language, not the raw key', async () => {
    const [entry] = await getCollection('forjaExercises', ({ data }) => data.domain === 'facturacion')
    if (!entry) return // the domain is content, not contract — skip rather than fail
    const html = await renderBrief(entry.data)
    expect(html).toContain('Facturación')
  })
})
