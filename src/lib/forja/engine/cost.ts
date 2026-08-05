// La Forja evaluation engine — cost as a budget with a cliff (design D3,
// doc §14.3 layer c). Below the declared budget: free. Past it: a cliff, not
// a linear tax — this is how a real team's operating capacity behaves.
import { CATALOG } from './catalog'
import type { Budget, Design } from './types'

export interface CostBreakdown {
  opsUnits: number
  monthlyUsd: number
  budget: Budget
  overage: number
}

export function computeCost(design: Design, budget: Budget): CostBreakdown {
  const opsUnits = design.nodes.reduce((sum, n) => sum + CATALOG[n.type].opsUnits, 0)
  const monthlyUsd = design.nodes.reduce((sum, n) => sum + CATALOG[n.type].monthlyUsd, 0)
  const overage = Math.max(0, opsUnits - budget.opsUnits)
  return { opsUnits, monthlyUsd, budget, overage }
}

// pen ∈ (0,1]. At or under budget, overage is 0 and pen is exactly 1 — the
// flat side of the cliff, no penalty at all. Past it, pen falls monotonically
// with the overage itself, never with how many components exist: that
// node-count term is exactly defect 1 (adding a guarantee lowered the score).
export function penalty(overage: number, lambda: number): number {
  return 1 / (1 + lambda * overage)
}
