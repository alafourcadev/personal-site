// The authoring gate for ONE level, scoped by the FORJA_LEVEL environment
// variable. It exists so several authors can work on different levels at
// the same time without reading each other's half-written files: the full
// content suite parses every exercise in the project and goes red when any
// of them is mid-edit, which says nothing about the level you are on.
//
//   FORJA_LEVEL=5 npm run forja:level
//
// It runs the same gates the publication suite runs — the admission schema,
// the beta composition floor, every reference solution scoring exactly 100,
// and the tradeoff pair's winner inverting — but only over the level asked
// for, and it reports WHY a solution missed 100 instead of just that it did.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../../src/lib/forja/engine'
import type { Design, Evaluation, ExerciseSpec } from '../../src/lib/forja/engine/types'
import { exerciseSchema, type ExerciseFrontmatter } from '../../src/lib/forja/content/exercise-schema'
import { compositionViolations } from '../../src/lib/forja/progression/composition'
import { axisCeiling, AXES, difficultyIndex, levelBand } from '../../src/lib/forja/progression/difficulty'
import { levelById } from '../../src/lib/forja/progression/levels'
import { isPlayable } from '../../src/lib/forja/progression/types'

const EXERCISES_DIR = path.join(process.cwd(), 'src/content/forja/exercises')
const LEVEL = Number(process.env.FORJA_LEVEL)

interface RawEntry {
  file: string
  data: Record<string, unknown>
}

// Frontmatter is read WITHOUT the schema first, so a file belonging to
// another level is filtered out before it can fail anything here.
//
// Reading it is itself failure-prone, though, and an earlier version of this
// function claimed otherwise: `matter()` throws a YAMLException on malformed
// frontmatter, which killed the whole gate before the level filter ever ran.
// Three authors working in parallel hit it on each other's half-written
// files, which is exactly the interference this file exists to prevent.
//
// So an unreadable file is caught and attributed by FILENAME instead. The
// `n{level}-` convention makes that attribution reliable for everything
// written since, and the level-4 files that predate it are all valid — but
// attribution is only ever used to decide whose problem it is, never to
// decide what a readable file contains.
interface UnreadableEntry {
  file: string
  reason: string
}

function readEntries(level: number): { raw: RawEntry[]; unreadable: UnreadableEntry[] } {
  const raw: RawEntry[] = []
  const unreadable: UnreadableEntry[] = []

  for (const file of fs.readdirSync(EXERCISES_DIR).filter((f) => f.endsWith('.md'))) {
    try {
      const data = matter(fs.readFileSync(path.join(EXERCISES_DIR, file), 'utf-8')).data
      if (data.level === level) raw.push({ file, data })
    } catch (error) {
      // Only this level's own broken files are reported; another author's
      // unparseable draft is silently skipped, which is the whole point.
      if (file.startsWith(`n${level}-`)) {
        unreadable.push({ file, reason: error instanceof Error ? error.message : String(error) })
      }
    }
  }

  return { raw, unreadable }
}

function toExerciseSpec(exercise: ExerciseFrontmatter): ExerciseSpec {
  return { guarantees: exercise.guarantees, budget: exercise.budget, lambda: exercise.lambda }
}

// A reference solution that misses 100 is the single most common authoring
// failure, and "expected 100, got 87" alone is not enough to fix it. This
// turns the engine's own ledger into the list of things that cost points.
function explain(result: Evaluation): string {
  if (result.status === 'illegal') {
    const blocking = result.findings.filter((f) => f.severity === 'blocking')
    return `ILEGAL — el diseño no llega a puntuar. Bloqueantes:\n${blocking
      .map((f) => `    · ${f.title}: ${f.why}`)
      .join('\n')}`
  }
  const unmet = result.guarantees.filter((g) => !g.satisfied)
  const costly = result.findings.filter((f) => (f.costPoints ?? 0) > 0)
  const lines = [`puntuó ${result.score} de 100.`]
  if (unmet.length > 0) {
    lines.push(`  Garantías sin cumplir: ${unmet.map((g) => `${g.id} (peso ${g.weight})`).join(', ')}`)
  }
  if (costly.length > 0) {
    lines.push(`  Hallazgos que restan: ${costly.map((f) => `${f.title} (-${f.costPoints})`).join(', ')}`)
  }
  if (result.cost.overage > 0) {
    lines.push(`  Excede el presupuesto en ${result.cost.overage} unidades operativas.`)
  }
  return lines.join('\n')
}

const enabled = Number.isInteger(LEVEL) && LEVEL >= 1 && LEVEL <= 12

describe.skipIf(!enabled)(`nivel ${LEVEL} — puerta de autoría`, () => {
  const { raw, unreadable } = enabled ? readEntries(LEVEL) : { raw: [], unreadable: [] }
  const info = enabled ? levelById(LEVEL) : undefined

  it('el nivel existe en el mapa de 12 niveles', () => {
    expect(info, `No hay ningún nivel ${LEVEL} en levels.ts`).toBeDefined()
  })

  it('todos los archivos del nivel tienen un frontmatter que se puede leer', () => {
    expect(
      unreadable.map((u) => `${u.file}: ${u.reason}`),
      'Un archivo con YAML inválido no se puede evaluar. Lo más común: un valor sin comillas que contiene ": ".',
    ).toEqual([])
  })

  it('el nivel tiene al menos un archivo de ejercicio', () => {
    expect(
      raw.length,
      `No hay ningún .md con "level: ${LEVEL}" en ${EXERCISES_DIR}`,
    ).toBeGreaterThan(0)
  })

  describe.skipIf(raw.length === 0)('admisión — cada archivo por separado', () => {
    it.each(raw.map((r) => [r.file, r] as const))('%s pasa el esquema de admisión', (_file, entry) => {
      const parsed = exerciseSchema.safeParse(entry.data)
      const detail = parsed.success
        ? ''
        : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n    ')
      expect(parsed.success, `\n    ${detail}`).toBe(true)
    })

    it.each(raw.map((r) => [r.file, r] as const))(
      '%s declara una dificultad que entra en la banda del nivel',
      (_file, entry) => {
        const parsed = exerciseSchema.safeParse(entry.data)
        if (!parsed.success) return // already reported by the admission test
        const exercise = parsed.data
        const [min, max] = levelBand(LEVEL)
        const index = difficultyIndex(exercise)
        expect(
          index,
          `El índice de dificultad (${index}) queda fuera de la banda [${min}, ${max}] del nivel ${LEVEL}.`,
        ).toBeGreaterThanOrEqual(min)
        expect(index).toBeLessThanOrEqual(max)

        for (const axis of AXES) {
          const ceiling = axisCeiling(axis, LEVEL)
          expect(
            exercise[axis],
            `El eje ${axis} vale ${exercise[axis]} y en el nivel ${LEVEL} el techo es ${ceiling}.`,
          ).toBeLessThanOrEqual(ceiling)
        }
      },
    )
  })

  describe.skipIf(raw.length === 0)('el nivel como conjunto', () => {
    const parsed = raw
      .map((r) => exerciseSchema.safeParse(r.data))
      .filter((p): p is { success: true; data: ExerciseFrontmatter } => p.success)
      .map((p) => p.data)

    // The complete tier is level-dependent: levels 1 to 4 trade one of their
    // six core slots for the `greenfield` exercise that opens on an empty
    // canvas, so the level has to be handed in or the quota checked is the
    // wrong one.
    it('cumple uno de los dos tramos: beta (8) o completo (14)', () => {
      expect(compositionViolations(parsed, LEVEL).map((v) => v.message)).toEqual([])
    })

    const playable = parsed.filter((e) => isPlayable(e.status))

    it.each(playable.map((e) => [e.title, e] as const))(
      '%s: sus soluciones de referencia puntúan exactamente 100',
      (_title, exercise) => {
        const spec = toExerciseSpec(exercise)
        expect(
          exercise.referenceSolutions.length,
          'Un ejercicio publicable necesita al menos dos soluciones de referencia.',
        ).toBeGreaterThanOrEqual(2)

        for (const solution of exercise.referenceSolutions) {
          const result = evaluate(solution.design as Design, spec)
          expect(result.score, `\n  "${solution.label}" ${explain(result)}\n`).toBe(100)
        }
      },
    )

    // An exercise whose given system already satisfies every guarantee has
    // nothing to play: the player opens it, presses "probar respuesta" and
    // gets 100 without a decision. No other gate catches this — the schema
    // only ever evaluates the reference solutions, never the starting point.
    it.each(playable.map((e) => [e.title, e] as const))(
      '%s: su diseño inicial todavía no puntúa 100 — hay algo que resolver',
      (_title, exercise) => {
        const result = evaluate(exercise.startingDesign as Design, toExerciseSpec(exercise))
        expect(
          result.score,
          'El sistema que trae el ejercicio ya cumple todas las garantías: el jugador llega a 100 sin tomar ninguna decisión.',
        ).not.toBe(100)
      },
    )

    // Beta ships one contrasted pair, complete ships two, so the unit here is
    // the pair. Composition already reported a wrong pair count; this only
    // proves that each well-formed pair earns its name.
    const tradeoffPairs = (() => {
      const byId = new Map<string, typeof playable>()
      for (const e of playable.filter((x) => x.role === 'tradeoff')) {
        const key = e.tradeoffPairId ?? '(sin id)'
        byId.set(key, [...(byId.get(key) ?? []), e])
      }
      return [...byId.entries()].filter(([, members]) => members.length === 2)
    })()

    it('el nivel tiene al menos un par de tradeoff bien formado', () => {
      expect(
        tradeoffPairs.length,
        'Ningún "tradeoffPairId" del nivel tiene exactamente dos ejercicios.',
      ).toBeGreaterThanOrEqual(1)
    })

    it.each(tradeoffPairs)('el par "%s" invierte el ganador de verdad', (_pairId, members) => {
      const [a, b] = members
      const specA = toExerciseSpec(a)
      const specB = toExerciseSpec(b)

      for (const solution of a.referenceSolutions) {
        expect(
          evaluate(solution.design as Design, specB).score,
          `"${solution.label}" de "${a.title}" también puntúa 100 bajo "${b.title}": el contexto no invierte nada, son el mismo ejercicio contado dos veces.`,
        ).not.toBe(100)
      }
      for (const solution of b.referenceSolutions) {
        expect(
          evaluate(solution.design as Design, specA).score,
          `"${solution.label}" de "${b.title}" también puntúa 100 bajo "${a.title}": el contexto no invierte nada, son el mismo ejercicio contado dos veces.`,
        ).not.toBe(100)
      }
    })
  })
})
