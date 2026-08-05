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
}

export interface AccessibleNameState {
  selected?: boolean
  hasError?: boolean
}

export function composeNodeAccessibleName(node: AccessibleNameNode, state: AccessibleNameState = {}): string {
  const parts = [node.label, node.type, `zona ${node.zone}`]
  if (state.selected) parts.push('seleccionado')
  if (state.hasError) parts.push('con error')
  return parts.join(', ')
}
