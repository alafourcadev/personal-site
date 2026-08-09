// `tests/authoring/level-gate.test.ts` already refuses a starting design that
// scores 100 — the player would open the exercise, press "probar respuesta"
// and win without deciding anything. But 100 is not the only broken number.
//
// `n11-el-motor-que-se-apaga-el-31-de-marzo` shipped a starting design worth
// 72/100, because three of its five guarantees were PRESERVATION clauses
// ("nobody sends new work to the old engine", "the old engine is still
// deployed", "the history is still readable") and the given system satisfied
// all three by doing nothing. A preservation guarantee that nothing in the
// opening frame threatens is not a guarantee, it is a free point.
//
// Measuring the whole corpus afterwards showed it was not one file's mistake.
// Nineteen exercises opened above half the board, the worst at 80. The score a
// player sees stops describing what they did and starts describing what they
// were handed.
//
// WHERE THE LINE IS, AND WHY 50.
//
// The 169 exercises measured like this the day the line was drawn — starting
// design, engine run for real, before any of the repairs below:
//
//     illegal (no score) ........ 20
//     0–49 ..................... 117
//     exactly 50 ................ 13
//     51–100 .................... 19
//
// So the corpus already lives at or below half: 130 of the 149 that score at
// all. 50 is not an arbitrary round number here, it is the shape of the thing
// being measured — the sum of the weights the given system already satisfies
// against the sum of the weights it does not. At 50 the two halves are even
// and the player still has to earn at least half of their own number. Above
// 50 the opening frame is carrying more of the grade than the decisions are,
// which is the defect.
//
// The rule that gets an exercise under the line, and the one used to repair
// the nineteen: a clause the opening frame already satisfies is scaffolding,
// so it weighs 1, and what the exercise asks the player to resolve weighs,
// between all of them, more than the scaffolding put together.
//
// Illegal starting designs are exempt because they have no score to compare —
// `evaluate` returns null and the player sees blocking findings instead.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine'
import type { Design, DesignEdge, DesignNode, ExerciseSpec } from '../../src/lib/forja/engine/types'
import { exerciseSchema, type ExerciseFrontmatter } from '../../src/lib/forja/content/exercise-schema'

const EXERCISES_DIR = join(__dirname, '../../src/content/forja/exercises')
const CEILING = 50

function specOf(exercise: ExerciseFrontmatter): ExerciseSpec {
  return { guarantees: exercise.guarantees, budget: exercise.budget, lambda: exercise.lambda }
}

function readAll(): Array<{ id: string; exercise: ExerciseFrontmatter }> {
  const all: Array<{ id: string; exercise: ExerciseFrontmatter }> = []
  for (const file of readdirSync(EXERCISES_DIR).filter((f) => f.endsWith('.md'))) {
    const parsed = exerciseSchema.safeParse(matter(readFileSync(join(EXERCISES_DIR, file), 'utf8')).data)
    if (!parsed.success) continue // the level gate and the schema suite own this failure
    all.push({ id: file.replace(/\.md$/, ''), exercise: parsed.data })
  }
  return all
}

// Every file is checked, not only the two statuses that reach a player. A
// draft that opens at 100 is not harmless, it is a defect waiting for whoever
// promotes it — and promotion is a one-word edit that no gate would re-read.
const CORPUS = readAll()

describe('el diseño inicial es el problema, no la mitad de la respuesta', () => {
  it('el corpus se pudo leer', () => {
    expect(CORPUS.length).toBeGreaterThan(160)
  })

  it.each(CORPUS.map((e) => [e.id, e] as const))(
    '%s: su diseño inicial no regala más de la mitad del tablero',
    (_id, { exercise }) => {
      const result = evaluate(exercise.startingDesign as Design, specOf(exercise))
      if (result.score === null) return // illegal: there is no number to give away

      const met = result.guarantees.filter((g) => g.satisfied)
      const detail = met.map((g) => `${g.id} (peso ${g.weight})`).join(', ')
      expect(
        result.score,
        `El sistema que trae el ejercicio ya cumple ${met.length} de ${result.guarantees.length} garantías` +
          ` — ${detail} — y el jugador abre con ${result.score} de 100 antes de decidir nada.` +
          ` Una cláusula que el diseño inicial ya cumple es andamiaje y pesa 1;` +
          ` lo que el ejercicio pide resolver tiene que pesar, entre todo, más que el andamiaje junto.`,
      ).toBeLessThanOrEqual(CEILING)
    },
  )

  // The corpus-wide rule above says nothing about the ORDER the number moves
  // in, and that was the other half of the level-11 defect: the two corrections
  // the brief asks for took the player DOWN to 71 before the design climbed
  // back to 100. The history was only reachable THROUGH the very connection
  // the exercise asks you to cut, so obeying the brief cost more than it paid
  // — and a player who moves in the right direction and watches the number
  // fall stops trusting the number, which is the only feedback this product
  // has.
  //
  // This half stays pinned to the exercise it was found in. A corpus-wide
  // version of it flags exercises where cutting one connection is genuinely an
  // INCOMPLETE move (the end state needs a replacement path, so the
  // intermediate design really is worse), and those are not defects: measured
  // over the 169, that rule fires on eighteen files and every one of them is a
  // queue losing its consumer or a lane cut before its replacement is wired.
  describe('n11-el-motor-que-se-apaga-el-31-de-marzo: cada paso correcto paga', () => {
    const EXERCISE_ID = 'n11-el-motor-que-se-apaga-el-31-de-marzo'
    const found = CORPUS.find((e) => e.id === EXERCISE_ID)

    it('el ejercicio sigue existiendo con ese nombre', () => {
      expect(found, `No hay ningún ${EXERCISE_ID}.md`).toBeDefined()
    })

    const exercise = found?.exercise
    const spec = exercise ? specOf(exercise) : null
    const starting = exercise ? (exercise.startingDesign as Design) : null

    function scoreOf(design: Design): number {
      const result = evaluate(design, spec!)
      expect(result.score, 'el diseño es ilegal, así que no hay puntaje que comparar').not.toBeNull()
      return result.score!
    }

    function without(design: Design, edgeId: string): Design {
      return { ...design, edges: design.edges.filter((edge) => edge.id !== edgeId) }
    }

    function plus(design: Design, edge: DesignEdge): Design {
      return { ...design, edges: [...design.edges, edge] }
    }

    const routed = () =>
      plus(without(starting!, 'gw-viejo'), {
        id: 'gw-nuevo',
        from: { node: 'gw' },
        to: { node: 'nuevo' },
        dataClass: 'personal',
      } as DesignEdge)

    const rerouted = () =>
      plus(without(routed(), 'canal-viejo'), {
        id: 'canal-nuevo',
        from: { node: 'canal' },
        to: { node: 'nuevo' },
        dataClass: 'personal',
      } as DesignEdge)

    it('sube cuando la puerta de entrada deja de llamar al motor viejo', () => {
      expect(scoreOf(without(starting!, 'gw-viejo'))).toBeGreaterThan(scoreOf(starting!))
    })

    it('vuelve a subir cuando el motor nuevo empieza a contestar', () => {
      expect(scoreOf(routed())).toBeGreaterThan(scoreOf(without(starting!, 'gw-viejo')))
    })

    it('vuelve a subir cuando el canal de agencias deja de alimentar al motor viejo', () => {
      expect(scoreOf(rerouted())).toBeGreaterThan(scoreOf(routed()))
    })

    // The last one closes the exercise, which proves the ladder actually leads
    // somewhere instead of just going up.
    it('llega a 100 cuando el histórico tiene un camino de lectura que no pasa por el motor viejo', () => {
      const complete = plus(rerouted(), {
        id: 'nuevo-dbviejo',
        from: { node: 'nuevo' },
        to: { node: 'dbviejo' },
        dataClass: 'personal',
      } as DesignEdge)
      expect(scoreOf(complete)).toBe(100)
    })
  })
})

// Raising the ceiling is only half of it. The other half is that the number
// has to MOVE in the right direction while the player works, and every
// exercise touched for the ceiling above is walked here from its opening
// frame toward its own first reference solution, one decision at a time.
//
// A step is a decision, not a gesture: "the labels get built off the request"
// is one step even though it draws three pieces and four connections, because
// a player who has decided that draws all of it before pressing anything.
// Splitting a single decision into its gestures is what manufactures the
// false drop — cut the old lane, watch the number fall, wire the new one. The
// exercise never asked for the intermediate state and nothing here pretends
// it did.
describe('los ejercicios reparados siguen pagando el movimiento que piden', () => {
  interface Step {
    id: string
    cut?: string[]
    drop?: string[]
    addNodes?: DesignNode[]
    add?: DesignEdge[]
  }

  function node(id: string, type: string, label: string, zone: string, props: Record<string, string> = {}) {
    return { id, type, label, zone, props } as unknown as DesignNode
  }

  function link(id: string, from: string, to: string, dataClass = 'personal') {
    return { id, from: { node: from }, to: { node: to }, dataClass } as unknown as DesignEdge
  }

  const LADDERS: Array<{ id: string; steps: Step[] }> = [
    {
      // Deleting the schedule cache is the whole exercise.
      id: 'n1-el-turno-que-sale-de-una-copia',
      steps: [{ id: 'se borra la copia de horarios', cut: ['turnos-copia'] }],
    },
    {
      // The report stops being served from the edge.
      id: 'n1-el-informe-que-quedo-publicado-en-el-borde',
      steps: [{ id: 'el archivo deja de publicarse en el borde', cut: ['archivo-borde'] }],
    },
    {
      // The passport image stops being stored at all.
      id: 'n1-el-pasaporte-que-no-hay-que-archivar',
      steps: [{ id: 'el documento deja de archivarse', cut: ['checkin-archivo'] }],
    },
    {
      // The price stops being answered from a copy.
      id: 'n1-el-precio-que-tiene-que-ser-el-registrado',
      steps: [{ id: 'el catálogo deja de leer la copia', cut: ['catalogo-copia'] }],
    },
    {
      // The premium calculation comes back in-house: the third party leaves
      // the drawing, not just the wire that reaches it.
      id: 'n1-la-prima-que-hay-que-poder-reconstruir',
      steps: [
        { id: 'se saca el cotizador de terceros', cut: ['polizas-cotizador'], drop: ['cotizador'] },
      ],
    },
    {
      // Promotions stops reading the catalog's store.
      id: 'n2-la-columna-que-rompio-a-otro-equipo',
      steps: [{ id: 'promociones deja de entrar a la base ajena', cut: ['promociones-catalogodb'] }],
    },
    {
      // The record service stops handing the whole file to the platform.
      id: 'n9-la-plataforma-que-recibe-el-legajo-entero',
      steps: [{ id: 'el legajo completo deja de salir directo', cut: ['academico-supervision'] }],
    },
    {
      // Same shape, clinical version.
      id: 'n9-el-laboratorio-que-manda-el-historial-entero',
      steps: [{ id: 'el historial completo deja de salir directo', cut: ['historias-imprenta'] }],
    },
    {
      // The repeated read gets a copy in front of the register.
      id: 'n1-el-precio-que-tiene-que-aguantar-el-viernes',
      steps: [
        {
          id: 'aparece una copia del lado del servidor',
          addNodes: [node('copia', 'cache', 'Copia de precios', 'private')],
          add: [link('catalogo-copia', 'catalogo', 'copia', 'public')],
        },
      ],
    },
    {
      // The signed authorisation gets somewhere durable to live.
      id: 'n1-la-autorizacion-que-si-hay-que-archivar',
      steps: [
        {
          id: 'la autorización se guarda como documento',
          addNodes: [node('archivo', 'object-storage', 'Archivo de autorizaciones', 'private')],
          add: [link('cargos-archivo', 'cargos', 'archivo')],
        },
      ],
    },
    {
      // The premium starts being asked of the official rate table.
      id: 'n1-la-prima-que-la-fija-el-ente',
      steps: [
        {
          id: 'el servicio de pólizas consulta el tarifario oficial',
          addNodes: [node('ente', 'external-provider', 'Tarifario oficial', 'dmz')],
          add: [link('polizas-ente', 'polizas', 'ente', 'public')],
        },
      ],
    },
    {
      // A second way to the shipment status that does not hang off tracking.
      id: 'n6-el-envio-que-solo-se-rastrea-si-el-rastreador-esta-vivo',
      steps: [
        {
          id: 'un segundo servicio lee la misma base',
          addNodes: [
            node('consultas', 'service', 'Servicio de consultas', 'private', {
              criticality: 'high',
              replicas: '2',
            }),
          ],
          add: [link('gw-consultas', 'gw', 'consultas'), link('consultas-base', 'consultas', 'base')],
        },
      ],
    },
    {
      // One decision: the labels stop being built inside the request. It draws
      // a queue, a background worker and a file store, and it is still one
      // decision — which is why it is one step.
      id: 'n7-las-diez-mil-etiquetas-de-la-madrugada',
      steps: [
        {
          id: 'las etiquetas se arman fuera del pedido',
          cut: ['despacho-etiquetas', 'etiquetas-envios'],
          drop: ['etiquetas'],
          addNodes: [
            node('cola', 'queue', 'Cola de lotes', 'private', {
              delivery: 'at-least-once',
              dlq: 'sí',
              ordering: 'no',
            }),
            node('generador', 'worker', 'Generador de etiquetas', 'private'),
            node('archivos', 'object-storage', 'Archivos de etiquetas', 'private'),
          ],
          add: [
            link('despacho-cola', 'despacho', 'cola'),
            link('cola-generador', 'cola', 'generador'),
            link('generador-envios', 'generador', 'envios'),
            link('generador-archivos', 'generador', 'archivos'),
          ],
        },
      ],
    },
    {
      // Two decisions, and the brief states them in this order: first the
      // doors get watched, then the component that executes the manoeuvre.
      id: 'n9-la-orden-de-corte-que-nadie-firmo',
      steps: [
        {
          id: 'las dos entradas quedan registradas',
          addNodes: [
            node('registroaccesos', 'observability', 'Registro de accesos', 'private', {
              logs: 'sí',
              alerting: 'sí',
            }),
          ],
          add: [
            link('gwcontrol-registroaccesos', 'gwcontrol', 'registroaccesos'),
            link('gwcampo-registroaccesos', 'gwcampo', 'registroaccesos'),
          ],
        },
        {
          id: 'la maniobra también queda registrada',
          add: [link('maniobras-registroaccesos', 'maniobras', 'registroaccesos', 'regulated')],
        },
      ],
    },
    {
      // The partner door starts asking the same question as the customer one.
      id: 'n9-el-portal-de-socios-que-entra-por-otra-puerta',
      steps: [
        {
          id: 'la puerta de socios también comprueba identidad',
          add: [link('gwsocios-identidad', 'gwsocios', 'identidad', 'secret')],
        },
      ],
    },
    {
      // One decision — "every service re-checks whose request it is" — so both
      // wires belong to the same step. Drawing one of the two first leaves the
      // guarantee unmet, which is the guarantee saying EVERY, not a defect.
      id: 'n9-el-servicio-que-no-puede-confiar-en-quien-lo-llama',
      steps: [
        {
          id: 'los dos servicios vuelven a preguntar',
          add: [
            link('tramites-identidad', 'tramites', 'identidad', 'secret'),
            link('expedientes-identidad', 'expedientes', 'identidad', 'secret'),
          ],
        },
      ],
    },
    {
      // The buffered lane goes away as a unit: dropping the queue without its
      // consumer is an illegal half-move, not a step the brief asks for.
      id: 'n9-el-consentimiento-que-se-revoco-anoche',
      steps: [
        {
          id: 'el servicio clínico entrega en el momento',
          cut: ['clinico-lote', 'lote-exportador', 'exportador-consorcio'],
          drop: ['lote', 'exportador'],
          add: [link('clinico-consorcio', 'clinico', 'consorcio', 'regulated')],
        },
      ],
    },
    {
      // Two decisions in the order the brief states them: first see the two
      // engines, then feed the new one.
      id: 'n11-el-motor-de-siniestros-que-corre-a-oscuras',
      steps: [
        {
          id: 'los dos motores quedan observados',
          addNodes: [node('monitoreo', 'observability', 'Monitoreo', 'private')],
          add: [
            link('motorviejo-monitoreo', 'motorviejo', 'monitoreo', 'public'),
            link('motornuevo-monitoreo', 'motornuevo', 'monitoreo', 'public'),
          ],
        },
        {
          id: 'el motor nuevo recibe los mismos siniestros por un canal durable',
          addNodes: [
            node('registro', 'stream', 'Registro de siniestros', 'private', {
              retention: '7d',
              partitions: '6',
            }),
          ],
          add: [
            link('recepcion-registro', 'recepcion', 'registro'),
            link('registro-motornuevo', 'registro', 'motornuevo'),
            link('motornuevo-comparacion', 'motornuevo', 'comparacion'),
          ],
        },
      ],
    },
  ]

  for (const ladder of LADDERS) {
    it(`${ladder.id}: el movimiento que pide el brief sube el puntaje`, () => {
      const found = CORPUS.find((e) => e.id === ladder.id)
      expect(found, `No hay ningún ${ladder.id}.md`).toBeDefined()
      const spec = specOf(found!.exercise)

      let design = found!.exercise.startingDesign as Design
      let previous = evaluate(design, spec).score
      expect(previous, 'el diseño inicial es ilegal, no hay escalera que medir').not.toBeNull()

      for (const step of ladder.steps) {
        const cut = new Set(step.cut ?? [])
        const dropped = new Set(step.drop ?? [])
        design = {
          nodes: [...design.nodes.filter((n) => !dropped.has(n.id)), ...(step.addNodes ?? [])],
          edges: [...design.edges.filter((e) => !cut.has(e.id)), ...(step.add ?? [])],
        }
        const next = evaluate(design, spec).score
        expect(
          next,
          `«${step.id}» dejó el diseño ilegal: el jugador que hace lo que pide el brief pierde el puntaje entero.`,
        ).not.toBeNull()
        expect(
          next!,
          `«${step.id}» bajó el puntaje de ${previous} a ${next}. Un jugador que avanza en la dirección correcta no puede ver caer el número.`,
        ).toBeGreaterThan(previous!)
        previous = next
      }
    })
  }
})
