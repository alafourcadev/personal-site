// The learning idea each curriculum level is designed to exercise. These ids
// are domain data, not labels inferred from titles or brief prose. Transfer is
// compatible only when two exercises carry the same explicit concept id.
export const LEVEL_LEARNING_CONCEPT = {
  1: 'requisitos-y-preferencias',
  2: 'acoplamiento-cohesion-y-limites',
  3: 'datos-integridad-y-clasificacion',
  4: 'comunicacion-entre-servicios',
  5: 'produccion-y-operacion',
  6: 'resiliencia-y-fallo-parcial',
  7: 'escala-capacidad-y-costo',
  8: 'datos-a-gran-escala-y-multitenencia',
  9: 'seguridad-identidad-y-cumplimiento',
  10: 'arquitectura-con-ia',
  11: 'evolucion-y-migracion',
  12: 'liderazgo-tecnico-y-defensa',
} as const satisfies Record<number, string>

export interface ExerciseLearningConcepts {
  exerciseId: string
  conceptIds: string[]
}

export interface LeveledExerciseIdentity {
  id: string
  level: number
}

export function learningConceptForLevel(level: number): string | null {
  return LEVEL_LEARNING_CONCEPT[level as keyof typeof LEVEL_LEARNING_CONCEPT] ?? null
}

export function learningConceptProfiles(
  exercises: readonly LeveledExerciseIdentity[],
): ExerciseLearningConcepts[] {
  return exercises.flatMap((exercise) => {
    const concept = learningConceptForLevel(exercise.level)
    return concept ? [{ exerciseId: exercise.id, conceptIds: [concept] }] : []
  })
}

export function sharedLearningConcepts(
  sourceExerciseId: string,
  targetExerciseId: string,
  profiles: readonly ExerciseLearningConcepts[],
): string[] {
  const source = profiles.find((profile) => profile.exerciseId === sourceExerciseId)
  const target = profiles.find((profile) => profile.exerciseId === targetExerciseId)
  if (!source || !target) return []
  const targetConcepts = new Set(target.conceptIds)
  return [...new Set(source.conceptIds)]
    .filter((concept) => targetConcepts.has(concept))
    .sort()
}
