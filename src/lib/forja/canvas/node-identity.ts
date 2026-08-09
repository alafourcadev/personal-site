// One place where the interface turns a node's internal keys into the words a
// player reads. Every canvas surface that used to interpolate `node.type` or
// `node.zone` directly goes through here instead.
//
// The names are not invented here: they are the ones the engine already
// narrates with: CATALOG[type].name (character-identical to the palette label
// the player dragged, pinned by tests/engine/player-vocabulary.test.ts) and
// ZONE_NAMES. Consuming them rather than keeping a second table is the whole
// point: a rename on either side has exactly one place to reach, and the
// player never reads two different words for the same thing.
//
// Import direction is UI -> engine, which is the direction that already
// exists (catalog-ui.ts, project.ts, accessible-name.ts all import engine
// types). Nothing here is imported by `engine/`, so the engine stays free of
// presentation.
import { CATALOG } from '../engine/catalog'
import { ZONE_NAMES } from '../engine/legality'
import type { ComponentType, Zone } from '../engine/types'

export function componentName(type: ComponentType): string {
  return CATALOG[type].name
}

export function zoneName(zone: Zone): string {
  return ZONE_NAMES[zone]
}

// Whether the name on the box is already the type's own name, which is the
// normal case and not an odd one: every piece a starting design ships with, and
// every piece created from the palette, is labelled with its type's name until
// the player renames it.
//
// Shared with accessible-name.ts on purpose. The rule for "this word is a
// repeat" has to be ONE rule: the moment the screen and the screen reader own
// separate copies of it, a node can print its type and not say it, or the
// reverse, and nobody notices until someone using both is confused.
export function labelIsTypeName(label: string, type: ComponentType): boolean {
  return label.trim().toLowerCase() === componentName(type).toLowerCase()
}

// The subtitle under a node's own label, on the canvas and in the list view:
// what kind of piece this is, and which trust zone it sits in.
//
// No "zona" before the zone name. ZONE_NAMES already reads as a place
// ("red pública", "núcleo restringido"), so the word produced "zona red
// pública", which is wrong Spanish and the kind of seam that makes copy feel
// machine-assembled. The separator carries the same structure the palette
// already uses.
//
// `label` is what the line is printed UNDER. Given it, the type is dropped
// when the label already says it, because a second line whose first half
// repeats the first line teaches nothing and costs the zone its emphasis,
// measured in the production build as "Base de datos" over "Base de datos ·
// núcleo restringido" on 92 of 96 exercise/width framings. Omitted (no label
// in play), the full line is returned unchanged: the type is only redundant
// next to a label that already carries it.
export function nodeIdentityLine(type: ComponentType, zone: Zone, label?: string): string {
  if (label !== undefined && labelIsTypeName(label, type)) return zoneName(zone)
  return `${componentName(type)} · ${zoneName(zone)}`
}

// The whole line the list view prints for a node, the label first, because
// that view has no box to put it in. Built here rather than assembled in the
// component so it obeys the same no-repeat rule as the canvas: concatenated by
// hand, a kept default label printed its own name THREE times.
export function nodeListLine(label: string, type: ComponentType, zone: Zone): string {
  return `${label} · ${nodeIdentityLine(type, zone, label)}`
}
