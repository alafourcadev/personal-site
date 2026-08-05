// Doc §14.4's nine-axis difficulty index. Pure and level-generic on purpose
// — it gates level 4's content in R1-F, and every remaining level in R2
// reuses this exact math without a second implementation.
//
// "El TEMA y sus prerrequisitos determinan EN QUÉ NIVEL vive el ejercicio.
//  El ÍNDICE de carga cognitiva determina QUÉ LUGAR OCUPA DENTRO del nivel."
// A single number was rejected in the doc's own design note: an author
// could raise an exercise's level just by piling axes onto it, and a player
// would reach level 7 without ever seeing the concepts levels 4-6 exist to
// teach. The level lives in `content.config.ts`'s `level` field; this file
// only computes whether an exercise's difficulty FITS the level it declares.
export type Axis = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6' | 'D7' | 'D8' | 'D9'

export const AXES: Axis[] = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9']

export type DifficultyAxes = Record<Axis, number>

export const AXIS_LABEL: Record<Axis, string> = {
  D1: 'Información oculta',
  D2: 'Restricciones en conflicto',
  D3: 'Garantías en juego',
  D4: 'Horizonte y reversibilidad',
  D5: 'Superficie de diseño',
  D6: 'Presión de presupuesto',
  D7: 'Fallo parcial',
  D8: 'Oposición',
  D9: 'Ambigüedad de la respuesta',
}

// "Vale 3 desde" / "vale 4 desde" per axis, verbatim from the doc's own
// table — the level at which an axis is FIRST allowed to reach that value.
const AXIS_THRESHOLDS: Record<Axis, { tier3: number; tier4: number }> = {
  D1: { tier3: 5, tier4: 8 },
  D2: { tier3: 5, tier4: 9 },
  D3: { tier3: 3, tier4: 8 },
  D4: { tier3: 6, tier4: 11 },
  D5: { tier3: 5, tier4: 8 },
  D6: { tier3: 5, tier4: 7 },
  D7: { tier3: 4, tier4: 6 },
  D8: { tier3: 9, tier4: 11 },
  D9: { tier3: 6, tier4: 10 },
}

// The highest value a single axis may declare at a given level — one of the
// three computable admission gates (EC3, "per-axis ceiling"); the other two
// are difficultyIndex()'s band membership and the prerequisite gate in
// levels.ts.
export function axisCeiling(axis: Axis, level: number): 2 | 3 | 4 {
  const { tier3, tier4 } = AXIS_THRESHOLDS[axis]
  if (level >= tier4) return 4
  if (level >= tier3) return 3
  return 2
}

export function difficultyIndex(axes: DifficultyAxes): number {
  return AXES.reduce((sum, axis) => sum + axes[axis], 0)
}

// [2+2(N-1), 10+2(N-1)] — bands overlap on purpose (the doc's own note):
// what separates one level from another is the prerequisite, not the load.
export function levelBand(level: number): [number, number] {
  return [2 + 2 * (level - 1), 10 + 2 * (level - 1)]
}
