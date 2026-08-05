// R1-G requirement 2: the exercise brief must state its budget and
// constraints in plain language, never the engine's own field names
// (`opsUnits`) or comparator symbols (`<=`). Pure formatting only — no
// content-schema or engine import here, so `ExerciseBrief.astro` can call
// these directly without pulling in the evaluator.
import type { Budget } from '../engine/types'

const OPERATOR_LABEL: Record<'>=' | '<=' | '=' | '<' | '>', string> = {
  '>=': 'al menos',
  '<=': 'como máximo',
  '=': 'exactamente',
  '<': 'menos de',
  '>': 'más de',
}

export interface ConstraintLike {
  metric: string
  operator: '>=' | '<=' | '=' | '<' | '>'
  value: number
  unit: string
}

export function formatConstraint(constraint: ConstraintLike): string {
  return `${constraint.metric}: ${OPERATOR_LABEL[constraint.operator]} ${constraint.value} ${constraint.unit}`
}

export function formatBudget(budget: Budget): string {
  const opsWord = budget.opsUnits === 1 ? 'unidad operativa' : 'unidades operativas'
  const opsLine = `${budget.opsUnits} ${opsWord}`
  if (budget.monthlyUsd === undefined) return opsLine
  return `${opsLine} y USD ${budget.monthlyUsd} por mes`
}
