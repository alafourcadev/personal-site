// R1-G: the minimal, serializable shape a level route hands to the
// `ForjaCanvas` island (`client:only="react"`, so props must be plain
// JSON-serializable data: no functions, no class instances). Deliberately
// not the full content-collection `ExerciseFrontmatter` (title/domain/
// difficulty axes/brief prose live in the Astro page and `ExerciseBrief`
// only). The canvas only ever needs what the engine evaluates against,
// mirroring the engine's own `ExerciseSpec` minimalism (see engine/types.ts).
import type { Budget, Design, ExerciseSpec, Guarantee } from '../engine/types'

export interface LoadedExercise {
  id: string
  title: string
  guarantees: Guarantee[]
  budget: Budget
  lambda: number
  // R1-H: the system the brief describes, already on the canvas the moment
  // the exercise opens. It is the fallback continuedDesign() uses on a first
  // visit (never a blank canvas, which is what made a role-anchored
  // guarantee impossible to ever satisfy by playing).
  startingDesign: Design
}

// The single, pure adapter back to the engine's own evaluate() input. Kept
// as its own function (never inlined at each call site) so it stays the one
// place a `LoadedExercise` becomes an `ExerciseSpec`, matching the exact
// mapping tests/content/level-4-composition.test.ts's own `toExerciseSpec`
// already proves at the content layer.
export function toExerciseSpec(exercise: LoadedExercise): ExerciseSpec {
  return { guarantees: exercise.guarantees, budget: exercise.budget, lambda: exercise.lambda }
}
