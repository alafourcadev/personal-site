// "The same connection twice" is not an illegality. The engine's
// checkConnection has nothing to say about it, and it should not: two
// identical edges break no rule of the domain. It is a canvas defect: three
// drags of the same pair left three superimposed, indistinguishable
// connections and the result panel repeated the same note three times, with
// no signal that anything had been ignored.
//
// So the guard lives here, next to the gesture, and never inside the engine.
import type { Design, DesignEdge } from '../engine/types'

export function findDuplicateEdge(design: Design, fromNodeId: string, toNodeId: string): DesignEdge | null {
  return design.edges.find((edge) => edge.from.node === fromNodeId && edge.to.node === toNodeId) ?? null
}

function labelOf(design: Design, nodeId: string): string {
  return design.nodes.find((node) => node.id === nodeId)?.label ?? 'sin identificar'
}

export function duplicateConnectionMessage(design: Design, fromNodeId: string, toNodeId: string): string {
  return `Ya existe una conexión de ${labelOf(design, fromNodeId)} a ${labelOf(design, toNodeId)}. No se agregó otra igual.`
}
