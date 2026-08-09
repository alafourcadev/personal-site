// A store nobody writes is an empty store, and the engine cannot see it: the
// `orphan-queue` rule blocks a queue with no consumer, but there is no rule
// for a database with no producer, because "who is supposed to write this" is
// an exercise's question, not a universal one.
//
// So it has to be the guarantee that asks. In `n7-los-lunes-a-las-ocho` it did
// not: `el informe sigue teniendo de dónde leer` was a path from the reporting
// service to any store, and a player reached 100 with a reporting database
// wired by ONE connection — somebody reads it, nobody fills it. The exercise's
// own reference solution says "una base aparte para gestión, ESCRITA POR EL
// SERVICIO DE TURNOS", and the guarantee was only checking the reading half.
//
// A report that reads an empty database is not a report that survived the
// move off the live agenda. It is the same outage with an extra disk.
//
// THE MODELLING CONSTRAINT THAT DECIDES THE SHAPE OF EVERY FIX HERE.
//
// The graph does not tell a reader from a writer: `informes -> base` and
// `turnos -> base` are both arrows INTO the store, and there is no directed
// path between the two services to hang a `noVolatileCut` on. So "somebody
// fills it" can only be said by naming a SECOND role — either a second
// guarantee that names the producer, or a `via` that forces the read path to
// cross it. Both are used below; `via` is the stronger of the two, because it
// ties the store the player reads to the component that produces the data
// instead of merely asserting that some store somewhere has a producer.
//
// WHAT THE SWEEP OVER THE OTHER 165 FOUND.
//
// 105 guarantees in the corpus point a path or a `covered` at a store. Almost
// all of them are sound for one of three reasons, and those reasons are worth
// writing down because they are what separates a defect from a false alarm:
//
//   · the reader IS the producer — `policy-service -> database` is the service
//     writing its own records, and a cache is filled by whoever reads it
//     (`read-service -> cache`, `storefront-service -> cache`);
//   · the exercise already names the producer — the two level-8 extract
//     exercises carry `g-extract-is-produced`, `n9-el-auditor-con-llave-de-la-base`
//     carries `g-archive-fed`, `n6-el-finde-largo-en-que-el-hotel-atendio-a-la-mitad`
//     carries `g-reservas-sigue-escribiendo`;
//   · the store is GIVEN data, not something the player builds — the two
//     legal/teaching corpora in level 10 and the 14-month archive in
//     `n11-la-convivencia-que-salio-mas-cara-que-los-dos-sistemas-juntos`
//     arrive already written, which is why neither reference solution of that
//     exercise fills the archive either. Demanding a producer there would
//     contradict the answer.
//
// The four repaired below are the ones where none of the three applied: the
// guarantee asked somebody to read a store the player has to create, the
// exercise's own reference solutions all fill it, and nothing required that.
//
// `n7-el-minuto-a-minuto-que-puede-esperar` / `g-vivo-tiene-de-donde-leer` was
// checked and left alone: the live-blog service reading a database IS the
// newsroom writing its own copy, so reader and producer are the same
// component and there is no second role to name.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine'
import type { Design, DesignEdge, DesignNode, ExerciseSpec } from '../../src/lib/forja/engine/types'
import { exerciseSchema, type ExerciseFrontmatter } from '../../src/lib/forja/content/exercise-schema'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')

function load(id: string): ExerciseFrontmatter {
  const parsed = exerciseSchema.safeParse(matter(readFileSync(join(EXERCISES_DIR, `${id}.md`), 'utf8')).data)
  if (!parsed.success) throw new Error(`${id} no parsea: ${parsed.error.message}`)
  return parsed.data
}

function specOf(exercise: ExerciseFrontmatter): ExerciseSpec {
  return { guarantees: exercise.guarantees, budget: exercise.budget, lambda: exercise.lambda }
}

function scoreOf(design: Design, spec: ExerciseSpec): { score: number | null; unmet: string } {
  const result = evaluate(design, spec)
  return {
    score: result.score,
    unmet: result.guarantees.filter((g) => !g.satisfied).map((g) => g.id).join(', '),
  }
}

interface Mutation {
  cutEdges?: string[]
  addNodes?: DesignNode[]
  addEdges?: DesignEdge[]
}

function mutate(design: Design, m: Mutation): Design {
  const cut = new Set(m.cutEdges ?? [])
  return {
    nodes: [...design.nodes, ...(m.addNodes ?? [])],
    edges: [...design.edges.filter((e) => !cut.has(e.id)), ...(m.addEdges ?? [])],
  }
}

// A plain service that does nothing but read, used to build the design a
// player would draw if the guarantee only ever asked for a reader.
function reader(id: string, label: string): DesignNode {
  return { id, type: 'service', label, zone: 'private', props: {} } as unknown as DesignNode
}

function edge(id: string, from: string, to: string, dataClass = 'personal'): DesignEdge {
  return { id, from: { node: from }, to: { node: to }, dataClass } as unknown as DesignEdge
}

interface Case {
  id: string
  guarantee: string
  /** Which reference solution to start from — the one whose store the test empties. */
  reference: number
  /** What the player would draw if only the reading half were required. */
  readerOnly: Mutation
  why: string
}

const CASES: Case[] = [
  {
    // The industry report's aggregate. Both reference solutions produce it —
    // one from the learning service directly, one through an exporter hanging
    // off the same stream — and `g-analysis-on-extract` only asked that the
    // analysis process reach an object storage.
    id: 'n8-la-plataforma-que-vendio-aislamiento-por-contrato',
    guarantee: 'g-analysis-on-extract',
    reference: 0,
    readerOnly: { cutEdges: ['cursos-extracto'] },
    why: 'el proceso de análisis llega a un depósito y nadie exige que alguien lo produzca',
  },
  {
    // The passenger's cheap copy. Both reference solutions fill it from the
    // positions service — the only component that receives where the buses
    // are — and `g-consulta-barata` only asked that the query service reach a
    // cache or a file store.
    id: 'n7-los-micros-que-reportan-cada-diez-segundos',
    guarantee: 'g-consulta-barata',
    reference: 0,
    readerOnly: { cutEdges: ['posiciones-ultima'] },
    why: 'el servicio de consulta llega a una copia rápida que nadie llena',
  },
  {
    // The claim status the neighbour looks up. There is no store at all in the
    // opening frame, so the player builds one — and `g-vecino-puede-consultar`
    // accepted any database reachable from the front door, including one hung
    // off a service that never took a report.
    id: 'n6-el-corte-que-nadie-pudo-reportar',
    guarantee: 'g-vecino-puede-consultar',
    reference: 0,
    readerOnly: {
      cutEdges: ['reclamos-base'],
      addNodes: [reader('consultas', 'Servicio de consultas')],
      addEdges: [edge('gw-consultas', 'gw', 'consultas'), edge('consultas-base', 'consultas', 'base')],
    },
    why: 'el estado del reclamo se lee de una base que ningún componente del flujo escribe',
  },
  {
    // Same shape on the submission receipt: the student has to be able to see
    // that the delivery was recorded, and the guarantee never said that the
    // component recording it is the one on the other end of that read.
    id: 'n6-la-entrega-que-no-espera-al-antiplagio',
    guarantee: 'g-entrega-consultable-sin-el-proveedor',
    reference: 0,
    readerOnly: {
      cutEdges: ['entregas-base'],
      addNodes: [reader('consultas', 'Servicio de consultas')],
      addEdges: [edge('gw-consultas', 'gw', 'consultas'), edge('consultas-base', 'consultas', 'base')],
    },
    why: 'la entrega se consulta contra una base que el servicio de entregas ya no escribe',
  },
]

describe('un almacén que alguien lee tiene que ser un almacén que alguien llena', () => {
  for (const testCase of CASES) {
    describe(`${testCase.id} · ${testCase.guarantee}`, () => {
      const exercise = load(testCase.id)
      const spec = specOf(exercise)
      const reference = exercise.referenceSolutions[testCase.reference].design as Design

      it('la solución de referencia sigue llegando a 100', () => {
        const { score, unmet } = scoreOf(reference, spec)
        expect(score, `sin cumplir: ${unmet}`).toBe(100)
      })

      it(`no llega a 100 con el almacén vacío — ${testCase.why}`, () => {
        const { score } = scoreOf(mutate(reference, testCase.readerOnly), spec)
        expect(
          score,
          'el jugador llega a 100 con un almacén que en producción está vacío: alguien lo lee y nadie lo escribe.',
        ).not.toBe(100)
      })

      it('la garantía sigue existiendo con ese id', () => {
        expect(exercise.guarantees.map((g) => g.id)).toContain(testCase.guarantee)
      })
    })
  }
})

// The original finding, kept on the exercise it was found in because its
// repair took a different shape: there the reading half and the writing half
// live inside one `all`, anchored on two roles the opening frame provides.
describe('n7-los-lunes-a-las-ocho: la fuente del informe tiene las dos puntas', () => {
  const EXERCISE_ID = 'n7-los-lunes-a-las-ocho'
  const exercise = load(EXERCISE_ID)
  const spec = specOf(exercise)
  const starting = exercise.startingDesign as Design

  const REPORTING_STORE = {
    id: 'gestion',
    type: 'database',
    label: 'Base de gestión',
    zone: 'restricted',
    props: { backup: 'diario' },
  } as unknown as DesignNode

  const READ_EDGE = edge('informes-gestion', 'informes', 'gestion')
  const WRITE_EDGE = edge('turnos-gestion', 'turnos', 'gestion')

  // The move the exercise asks for: the report stops reading the live agenda.
  const offTheAgenda: Design = {
    ...starting,
    edges: starting.edges.filter((e) => e.id !== 'informes-agenda'),
  }

  it('no llega a 100 con una base de informes que nadie llena', () => {
    const orphanStore: Design = {
      nodes: [...offTheAgenda.nodes, REPORTING_STORE],
      edges: [...offTheAgenda.edges, READ_EDGE],
    }
    expect(scoreOf(orphanStore, spec).score).not.toBe(100)
  })

  it('llega a 100 cuando el servicio de turnos escribe en ella', () => {
    const withWriter: Design = {
      nodes: [...offTheAgenda.nodes, REPORTING_STORE],
      edges: [...offTheAgenda.edges, READ_EDGE, WRITE_EDGE],
    }
    const { score, unmet } = scoreOf(withWriter, spec)
    expect(score, `sin cumplir: ${unmet}`).toBe(100)
  })

  it('sigue sin aceptar la agenda en vivo como nueva fuente del informe', () => {
    expect(scoreOf(starting, spec).score).not.toBe(100)
  })
})
