export interface CurriculumArc {
  id: string
  name: string
  levelIds: readonly number[]
  outcome: string
}

export interface GuidedExercise {
  id: string
  level: number
  title: string
  href: string
}

export interface ContinueRecommendation {
  kind: 'start' | 'continue' | 'complete'
  eyebrow: string
  title: string
  description: string
  href: string
  label: string
}

export const CURRICULUM_ARCS: readonly CurriculumArc[] = [
  {
    id: 'leer-el-sistema',
    name: 'Leer el sistema',
    levelIds: [1, 2, 3],
    outcome: 'Convertí requisitos, límites y datos en una decisión explicable.',
  },
  {
    id: 'disenar-para-produccion',
    name: 'Diseñar para producción',
    levelIds: [4, 5, 6],
    outcome: 'Hacé explícitos la comunicación, la observabilidad y los fallos parciales.',
  },
  {
    id: 'sostener-escala-y-confianza',
    name: 'Sostener escala y confianza',
    levelIds: [7, 8, 9],
    outcome: 'Razoná sobre capacidad, aislamiento, identidad y costo.',
  },
  {
    id: 'defender-la-evolucion',
    name: 'Defender la evolución',
    levelIds: [10, 11, 12],
    outcome: 'Evaluá IA, migraciones y decisiones difíciles de revertir.',
  },
]

export function arcForLevel(levelId: number): CurriculumArc | undefined {
  return CURRICULUM_ARCS.find((arc) => arc.levelIds.includes(levelId))
}

export function recommendContinue(
  exercises: readonly GuidedExercise[],
  solvedExerciseIds: ReadonlySet<string>,
): ContinueRecommendation | null {
  const first = exercises[0]
  if (!first) return null

  const next = exercises.find((exercise) => !solvedExerciseIds.has(exercise.id))
  if (!next) {
    return {
      kind: 'complete',
      eyebrow: 'RECORRIDO COMPLETO',
      title: 'Volvé a tu nivel más exigente',
      description: 'Ya resolviste todo lo publicado. Podés revisar el último arco y buscar otra decisión.',
      href: '/forja/12',
      label: 'Revisar el arco final',
    }
  }

  if (solvedExerciseIds.size === 0) {
    return {
      kind: 'start',
      eyebrow: 'PRIMER PASO',
      title: next.title,
      description: `Nivel ${next.level}. Empezá con una calibración corta, sin cuenta y sin bloquear el resto.`,
      href: next.href,
      label: 'Empezar acá',
    }
  }

  return {
    kind: 'continue',
    eyebrow: 'TU SIGUIENTE PASO',
    title: next.title,
    description: `Nivel ${next.level}. Es el primer ejercicio pendiente según el progreso de este navegador.`,
    href: next.href,
    label: 'Continuar',
  }
}
