// Two level-8 exercises ask the player to move a heavy comparison off the
// live store and onto "un extracto". A player who built exactly that with a
// separate DATABASE — a read model, the textbook answer — scored 50. The same
// design with an object storage scored 100.
//
// Nothing in either exercise said why. The guarantee's `whyMissing` read "no
// hay ningún camino desde el servicio de informes hasta un extracto" and never
// defined what counts as one, so half the board disappeared without a reason.
//
// The decision taken: BOTH pieces are accepted, because both actually solve
// the problem these exercises pose. What the briefs argue for is an aggregate,
// produced by whoever knows which tenant each row belongs to, living outside
// the table that serves customers. A separate read-model database satisfies
// every word of that — it ends the lock contention on the booking table and it
// keeps the aggregation at the producer. Neither brief contains a single
// argument that points at files rather than rows; requiring object storage
// taught "analytics extracts live in buckets", which is not true and is not
// what the exercise is about.
//
// The live store stays excluded, because reading it IS the defect the exercise
// exists to remove.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine'
import type { Design, ExerciseSpec } from '../../src/lib/forja/engine/types'
import { exerciseSchema } from '../../src/lib/forja/content/exercise-schema'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')

function specOf(id: string): ExerciseSpec {
  const parsed = exerciseSchema.safeParse(matter(readFileSync(join(EXERCISES_DIR, `${id}.md`), 'utf8')).data)
  if (!parsed.success) throw new Error(`${id} does not parse: ${parsed.error.message}`)
  return { guarantees: parsed.data.guarantees, budget: parsed.data.budget, lambda: parsed.data.lambda }
}

function startingOf(id: string): Design {
  const parsed = exerciseSchema.safeParse(matter(readFileSync(join(EXERCISES_DIR, `${id}.md`), 'utf8')).data)
  if (!parsed.success) throw new Error(`${id} does not parse`)
  return parsed.data.startingDesign as Design
}

// The same shape as each exercise's simplest reference solution, with the
// extract kept in its own database instead of an object storage.
const READ_MODEL_DESIGNS: Record<string, Design> = {
  'n8-el-tablero-que-leia-la-base-de-todas-las-clinicas': {
    nodes: [
      { id: 'paciente', type: 'actor', label: 'Paciente', zone: 'public', props: {} },
      { id: 'portal', type: 'web-client', label: 'Portal de turnos', zone: 'public', props: {} },
      { id: 'gw', type: 'api-gateway', label: 'Puerta de entrada', zone: 'dmz', props: {} },
      {
        id: 'turnos',
        type: 'service',
        label: 'Servicio de turnos',
        zone: 'private',
        role: 'booking-service',
        props: { criticality: 'high', replicas: '2' },
      },
      { id: 'tablero', type: 'service', label: 'Tablero comparativo', zone: 'private', role: 'analytics-service', props: {} },
      {
        id: 'extracto',
        type: 'database',
        label: 'Base del extracto agregado',
        zone: 'restricted',
        props: { backup: 'diario' },
      },
      {
        id: 'base',
        type: 'database',
        label: 'Base de turnos',
        zone: 'restricted',
        role: 'clinic-store',
        props: { backup: 'diario' },
      },
    ],
    edges: [
      { id: 'paciente-portal', from: { node: 'paciente' }, to: { node: 'portal' }, dataClass: 'public' },
      { id: 'portal-gw', from: { node: 'portal' }, to: { node: 'gw' }, dataClass: 'personal' },
      { id: 'gw-turnos', from: { node: 'gw' }, to: { node: 'turnos' }, dataClass: 'personal' },
      { id: 'gw-tablero', from: { node: 'gw' }, to: { node: 'tablero' }, dataClass: 'public' },
      { id: 'turnos-base', from: { node: 'turnos' }, to: { node: 'base' }, dataClass: 'personal' },
      { id: 'turnos-extracto', from: { node: 'turnos' }, to: { node: 'extracto' }, dataClass: 'public' },
      { id: 'tablero-extracto', from: { node: 'tablero' }, to: { node: 'extracto' }, dataClass: 'public' },
    ],
  } as unknown as Design,
  'n8-el-barrio-que-se-vende-comparado': {
    nodes: [
      { id: 'dueno', type: 'actor', label: 'Dueño del local', zone: 'public', props: {} },
      { id: 'panel', type: 'web-client', label: 'Panel del local', zone: 'public', props: {} },
      { id: 'gw', type: 'api-gateway', label: 'Puerta de entrada', zone: 'dmz', props: {} },
      {
        id: 'ventas',
        type: 'service',
        label: 'Servicio de punto de venta',
        zone: 'private',
        role: 'tenant-service',
        props: { criticality: 'high', replicas: '2' },
      },
      {
        id: 'informes',
        type: 'service',
        label: 'Servicio de informes',
        zone: 'private',
        role: 'insight-service',
        props: { criticality: 'high', replicas: '2' },
      },
      {
        id: 'extracto',
        type: 'database',
        label: 'Base del extracto comparativo',
        zone: 'restricted',
        props: { backup: 'diario' },
      },
      {
        id: 'base',
        type: 'database',
        label: 'Base de ventas',
        zone: 'restricted',
        role: 'tenant-store',
        props: { backup: 'diario' },
      },
    ],
    edges: [
      { id: 'dueno-panel', from: { node: 'dueno' }, to: { node: 'panel' }, dataClass: 'public' },
      { id: 'panel-gw', from: { node: 'panel' }, to: { node: 'gw' }, dataClass: 'personal' },
      { id: 'gw-ventas', from: { node: 'gw' }, to: { node: 'ventas' }, dataClass: 'personal' },
      { id: 'gw-informes', from: { node: 'gw' }, to: { node: 'informes' }, dataClass: 'public' },
      { id: 'ventas-base', from: { node: 'ventas' }, to: { node: 'base' }, dataClass: 'personal' },
      { id: 'ventas-extracto', from: { node: 'ventas' }, to: { node: 'extracto' }, dataClass: 'public' },
      { id: 'informes-extracto', from: { node: 'informes' }, to: { node: 'extracto' }, dataClass: 'public' },
    ],
  } as unknown as Design,
}

describe('"extracto" means an aggregate off the live store, not one specific catalog piece', () => {
  for (const [id, design] of Object.entries(READ_MODEL_DESIGNS)) {
    it(`${id}: a read model in its own database also reaches 100`, () => {
      const result = evaluate(design, specOf(id))
      const unmet = result.guarantees.filter((g) => !g.satisfied).map((g) => g.id)
      expect(result.score, `unmet: ${unmet.join(', ')}`).toBe(100)
    })

    // The guarantee has to keep meaning something. Widening it to accept any
    // database would let the live store itself count, and the exercise would
    // reward exactly the design it was written to remove.
    it(`${id}: reading the live store still does not count as an extract`, () => {
      expect(evaluate(startingOf(id), specOf(id)).score).not.toBe(100)
    })
  }
})
