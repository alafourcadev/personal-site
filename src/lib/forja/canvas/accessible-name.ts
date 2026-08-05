// PC13: accessible node names carry label + type + zone + state. Pure
// function, no DOM — the React node component only calls it and assigns
// the result to React Flow's `Node.ariaLabel` (D8-lite: full i18n dictionary
// is out of R1-D1's scope, deferred; state words are the literal Spanish
// copy the player's screen reader speaks, per project convention).
import type { ComponentType, Zone } from '../engine/types'

export interface AccessibleNameNode {
  label: string
  type: ComponentType
  zone: Zone
  // PC16: "the chosen colour MUST be named in the node's accessible
  // description" — the Spanish label from PLAYER_COLORS, passed in rather
  // than looked up here so this module stays free of any UI-layer import.
  colorLabel?: string
}

export interface AccessibleNameState {
  selected?: boolean
  hasError?: boolean
}

export function composeNodeAccessibleName(node: AccessibleNameNode, state: AccessibleNameState = {}): string {
  const parts = [node.label, node.type, `zona ${node.zone}`]
  if (state.selected) parts.push('seleccionado')
  if (state.hasError) parts.push('con error')
  if (node.colorLabel) parts.push(`color ${node.colorLabel}`)
  return parts.join(', ')
}
