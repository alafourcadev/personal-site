// PC13: accessible node names carry label + type + zone + state. Pure
// function, no DOM. The React node component only calls it and assigns
// the result to React Flow's `Node.ariaLabel` (D8-lite: full i18n dictionary
// is out of R1-D1's scope, deferred; state words are the literal Spanish
// copy the player's screen reader speaks, per project convention).
//
// The type and the zone are spoken by name, never by key. This used to
// interpolate `node.type` and `node.zone` raw, so a screen reader announced
// "App de familias, mobile-client, zona public": the internal vocabulary
// CONTEXTO §5 forbids, on the one surface where the player has no drawing to
// compensate with.
import { componentName, labelIsTypeName, zoneName } from './node-identity'
import type { ComponentType, Zone } from '../engine/types'

export interface AccessibleNameNode {
  label: string
  type: ComponentType
  zone: Zone
  // PC16: "the chosen colour MUST be named in the node's accessible
  // description". The Spanish label from PLAYER_COLORS, passed in rather
  // than looked up here so this module stays free of any UI-layer import.
  colorLabel?: string
}

export interface AccessibleNameState {
  selected?: boolean
  hasError?: boolean
}

export function composeNodeAccessibleName(node: AccessibleNameNode, state: AccessibleNameState = {}): string {
  // A node created from the palette carries its own type name as its label,
  // so announcing the type again reads "Base de datos, Base de datos, en
  // núcleo restringido". Saying it once is not information lost: PC13 wants
  // the type announced, and it is. It just happens to also be the name the
  // player left on the box.
  //
  // The same predicate the printed subtitle uses (node-identity.ts), so the
  // screen and the screen reader can never disagree about what is a repeat.
  const type = componentName(node.type)
  const named = labelIsTypeName(node.label, node.type) ? [node.label] : [node.label, type]

  // "en <zona>" rather than a bare noun: read aloud between the type and the
  // state words, the preposition is what makes the zone land as a place
  // instead of as another attribute of the piece.
  const parts = [...named, `en ${zoneName(node.zone)}`]
  if (state.selected) parts.push('seleccionado')
  if (state.hasError) parts.push('con error')
  if (node.colorLabel) parts.push(`color ${node.colorLabel}`)
  return parts.join(', ')
}
