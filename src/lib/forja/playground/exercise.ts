// Free-play placeholder exercise — NOT real exercise content. The
// `forja-exercise-content` schema (R1-F: level/role/D1-D9 axes,
// prerequisites, reference solutions) does not exist yet, and `/forja` is
// free-play only (see pages/forja/index.astro's own comment). This gives
// evaluate() something to score against so the result panel is buildable
// now; it is replaced once a real `/forja/[level]/[exercise]` route reads
// content-collection data instead.
import type { ExerciseSpec } from '../engine/types'

export const PLAYGROUND_EXERCISE_ID = 'playground-free-play'

export const PLAYGROUND_EXERCISE: ExerciseSpec = {
  guarantees: [
    {
      id: 'g-observability',
      label: 'El servicio crítico está observado',
      weight: 1,
      predicate: { op: 'covered', target: { type: ['service'] }, by: { type: ['observability'] } },
      whyMissing: 'Ningún servicio está conectado a un componente de observabilidad.',
      consequence: 'No vas a saber que algo falló hasta que un usuario se queje.',
    },
  ],
  // Generous on purpose — free play should not silently fail the budget
  // gate while a player is still exploring the canvas, unrelated to what
  // they came here to see (the guarantee/legality feedback).
  budget: { opsUnits: 12 },
  lambda: 0.5,
}
