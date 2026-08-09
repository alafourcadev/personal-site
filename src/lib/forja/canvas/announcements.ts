// What the status bar says when something LEAVES the canvas. Creating
// already announced itself ("Servicio creado."); deleting said nothing at
// all, measured empty across six deletions. That silence is what turns a
// mis-targeted click into an invisible loss: the player deletes a
// connection that was satisfying an objective and the system never
// mentions it.
//
// Pure string composition, no DOM: the exact wording is the contract, so it
// is asserted in Vitest rather than eyeballed.
import type { Design } from '../engine/types'

export function edgeDescription(design: Design, edgeId: string): string {
  const edge = design.edges.find((e) => e.id === edgeId)
  if (!edge) return 'sin identificar'
  const labelOf = (nodeId: string) => design.nodes.find((n) => n.id === nodeId)?.label ?? 'sin identificar'
  return `de ${labelOf(edge.from.node)} a ${labelOf(edge.to.node)}`
}

export function deletionMessage(
  nodeLabels: readonly string[],
  edgeDescriptions: readonly string[],
): string {
  const nodes = nodeLabels.length
  const edges = edgeDescriptions.length
  if (nodes === 0 && edges === 0) return ''

  if (nodes === 0) {
    return edges === 1 ? `Se eliminó la conexión ${edgeDescriptions[0]}.` : `Se eliminaron ${edges} conexiones.`
  }

  const subject = nodes === 1 ? `Se eliminó ${nodeLabels[0]}` : `Se eliminaron ${nodes} componentes`
  if (edges === 0) return `${subject}.`
  return edges === 1 ? `${subject} y su conexión.` : `${subject} y sus ${edges} conexiones.`
}

// What the status bar says when a connection is CREATED.
//
// It used to say nothing: `setStatus(verdict.ok ? '' : …)` wrote the empty
// string on success, which also wiped whatever the previous gesture had
// announced. Creating a component announced itself the whole time, so
// silence had already been taught to mean "nothing happened".
//
// It also teaches the gesture that has just become relevant. A fresh
// connection carries no data class, and three engine rules read that field.
// The moment it exists is the moment the player can declare it, so the
// shortcut is named there rather than in a legend nobody opens.
export function connectionCreatedMessage(description: string): string {
  return `Conexión creada ${description}. Todavía no declara qué dato viaja: Shift+F10 sobre la conexión para declararlo.`
}

// What the status bar says when a connection drag is released on nothing.
//
// The handle is 5.6x5.6px on screen and the node body around it is 98x32px,
// so releasing on the body is the likeliest way to end the gesture, and it
// returned without a word, leaving the player to guess whether the design
// had changed. Names the target rather than the failure: the useful half is
// where the drag had to land.
export function connectionDroppedMessage(): string {
  return 'La conexión no se creó: soltaste fuera de un conector. Arrastrá desde el conector del borde derecho de un componente hasta el del borde izquierdo del otro.'
}
