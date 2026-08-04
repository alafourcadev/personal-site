// La Forja evaluation engine — pure TypeScript, no DOM, no React, no Astro imports.
// R1-B wires the legality layer only. Guarantees/cost/score (predicates.ts,
// cost.ts, score.ts) and the full evaluate()/checkConnection() public
// surface per the design's Interfaces contract land in R1-C (C.13).
import { evaluateRules } from './rules'
import type { Design, Finding } from './types'

export const ENGINE_VERSION = '0.1.0-r1b'

export interface LegalityResult {
  legal: boolean
  score: number | null
  findings: Finding[]
}

// EE9: an empty design MUST score 0 with an explicit message, never be
// treated as "nothing wrong" (which the 13 rules alone would report, since
// none of them fire on an empty graph).
export function evaluateLegality(design: Design): LegalityResult {
  if (design.nodes.length === 0 && design.edges.length === 0) {
    return {
      legal: true,
      score: 0,
      findings: [
        {
          id: 'empty-canvas:0',
          rule: 'empty-canvas',
          severity: 'note',
          title: 'No hay ningún sistema para evaluar',
          evidence: '0 componentes · 0 conexiones',
          why: 'No enviaste ningún sistema. Sin componentes ni conexiones no hay nada que el motor pueda calificar.',
          nodeIds: [],
          edgeIds: [],
        },
      ],
    }
  }

  const findings = evaluateRules(design)
  const legal = findings.every((f) => f.severity !== 'blocking')
  // Guarantees/cost aren't wired yet (R1-C) — `score` stays null here for
  // BOTH outcomes: null legitimately means "illegal" per EE2, and for a
  // legal non-empty design it means "not yet computed", closed by C.13.
  return { legal, score: null, findings }
}
