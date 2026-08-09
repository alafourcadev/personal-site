// La Forja evaluation engine: closed component catalog (doc 13 §13.5).
// Closed because every type carries rules-relevant properties; the `generic`
// escape hatch exists for solutions the catalog didn't anticipate and is the
// only type without one, per §13.5's own note: "libre: el motor sólo valida
// zona y banda".
import type { ComponentType, Layer, Zone } from './types'

// These are the node facts a player may deliberately change. The list stays
// closed for the same reason ComponentType does: every exposed value can move
// an engine verdict, so authoring, the store and the UI must agree on it.
export type PlayerNodePropertyKey =
  | 'access'
  | 'backup'
  | 'criticality'
  | 'dlq'
  | 'hosting'
  | 'idempotent'
  | 'mfa'
  | 'partitions'
  | 'replicas'
  | 'sessionRotation'
  | 'sourceTraceability'

export interface CatalogEntry {
  // The name of this kind of piece in the player's language. The engine
  // already narrates in Spanish (every string in rules.ts's WHY table), so a
  // noun is domain vocabulary, not presentation: it carries no icon, no
  // colour, no class name, and keeps `engine/` pure TypeScript with zero
  // presentation imports. It exists so no rule ever has to fall back to the
  // internal `ComponentType` key in copy the player reads (§5).
  // Kept character-identical to the palette label the player dragged, which
  // is CATALOG_UI[type].label, and pinned there by
  // tests/engine/player-vocabulary.test.ts.
  name: string
  layer: Layer
  zone: Zone
  opsUnits: number
  // R1-C addition: doc 13 §13.4's `cost` anatomy has both `opsUnits` and
  // `monthlyUsd` (its own worked example: database -> monthlyUsd: 120). Only
  // that one value is sourced from the doc; the rest are authored, reasonable
  // defaults (not exhaustively verified against any pricing source),
  // flagged in apply-progress for the owner, same precedent as R1-B's ACCEPTS
  // table for the 5 gap-closed types.
  monthlyUsd: number
  props: Record<string, string>
  // Values a player can choose in the playground. Properties omitted here
  // are facts of the component or the exercise, not editable architecture
  // decisions. The default in `props` must be one of these choices.
  editableProps?: Partial<Record<PlayerNodePropertyKey, readonly string[]>>
}

export const CATALOG: Record<ComponentType, CatalogEntry> = {
  // -- business --
  actor: { name: 'Persona usuaria', layer: 'business', zone: 'public', opsUnits: 0, monthlyUsd: 0, props: { volume: '1200/día', connectivity: 'stable' } },
  'business-process': { name: 'Proceso de negocio', layer: 'business', zone: 'public', opsUnits: 0, monthlyUsd: 0, props: { criticality: 'medium', slaMinutes: '240' } },
  approver: { name: 'Aprobador', layer: 'business', zone: 'public', opsUnits: 0, monthlyUsd: 0, props: { availability: '99.0', slaMinutes: '60' } },
  'external-party': { name: 'Tercero externo', layer: 'business', zone: 'public', opsUnits: 0, monthlyUsd: 0, props: { contract: 'sí', availability: '99.0' } },
  // -- application --
  service: {
    name: 'Servicio',
    layer: 'application',
    zone: 'private',
    opsUnits: 1,
    monthlyUsd: 25,
    props: { stateful: 'no', idempotent: 'no', criticality: 'high', replicas: '1' },
    editableProps: {
      idempotent: ['no', 'sí'],
      criticality: ['high', 'medium'],
      replicas: ['1', '2', '3'],
    },
  },
  'api-gateway': { name: 'Puerta de entrada', layer: 'application', zone: 'dmz', opsUnits: 1, monthlyUsd: 30, props: { authn: 'sí', rateLimit: 'sí' } },
  'mobile-client': { name: 'Cliente móvil', layer: 'application', zone: 'public', opsUnits: 0, monthlyUsd: 0, props: { connectivity: 'intermittent', offlineCapable: 'no' } },
  'web-client': { name: 'Cliente web', layer: 'application', zone: 'public', opsUnits: 0, monthlyUsd: 0, props: { connectivity: 'stable' } },
  worker: { name: 'Procesador', layer: 'application', zone: 'private', opsUnits: 1, monthlyUsd: 20, props: { idempotent: 'sí', retryPolicy: 'exponential' } },
  'ai-model': {
    name: 'Modelo de IA',
    layer: 'application',
    zone: 'private',
    opsUnits: 1,
    monthlyUsd: 200,
    props: { hosting: 'external', deterministic: 'no', piiPolicy: 'none' },
    editableProps: { hosting: ['external', 'interno'] },
  },
  'external-provider': { name: 'Proveedor externo', layer: 'application', zone: 'dmz', opsUnits: 0, monthlyUsd: 0, props: { availability: '99.0', slaMinutes: '60' } },
  // -- infrastructure --
  database: {
    name: 'Base de datos',
    layer: 'infrastructure',
    zone: 'restricted',
    opsUnits: 1,
    monthlyUsd: 120,
    props: { consistency: 'strong', persistence: 'durable', backup: 'none', replication: 'none' },
    editableProps: { backup: ['none', 'diario', 'cada hora'] },
  },
  cache: { name: 'Caché', layer: 'infrastructure', zone: 'private', opsUnits: 1, monthlyUsd: 40, props: { persistence: 'volatile', ttl: '300', eviction: 'lru' } },
  queue: {
    name: 'Cola de mensajes',
    layer: 'infrastructure',
    zone: 'private',
    opsUnits: 1,
    monthlyUsd: 30,
    props: { delivery: 'at-least-once', dlq: 'no', ordering: 'no' },
    editableProps: { dlq: ['no', 'sí'] },
  },
  stream: {
    name: 'Registro de eventos',
    layer: 'infrastructure',
    zone: 'private',
    opsUnits: 1,
    monthlyUsd: 60,
    props: { retention: '7d', partitions: '3', ordering: 'sí' },
    editableProps: { partitions: ['1', '3', '6', '8', '12', '24', '32'] },
  },
  'object-storage': {
    name: 'Almacenamiento de objetos',
    layer: 'infrastructure',
    zone: 'private',
    opsUnits: 0,
    monthlyUsd: 10,
    props: { durability: '99.999999999', access: 'signed' },
    editableProps: { access: ['public', 'signed'] },
  },
  cdn: { name: 'CDN', layer: 'infrastructure', zone: 'dmz', opsUnits: 0, monthlyUsd: 20, props: { cacheControl: 'public, max-age=3600' } },
  'identity-provider': {
    name: 'Proveedor de identidad',
    layer: 'infrastructure',
    zone: 'dmz',
    opsUnits: 1,
    monthlyUsd: 50,
    props: { mfa: 'opcional', sessionRotation: 'no' },
    editableProps: { mfa: ['opcional', 'obligatorio'], sessionRotation: ['no', 'sí'] },
  },
  'vector-store': {
    name: 'Base vectorial',
    layer: 'infrastructure',
    zone: 'private',
    opsUnits: 1,
    monthlyUsd: 80,
    props: { sourceTraceability: 'no' },
    editableProps: { sourceTraceability: ['no', 'sí'] },
  },
  observability: { name: 'Observabilidad', layer: 'infrastructure', zone: 'private', opsUnits: 1, monthlyUsd: 40, props: { traces: 'sí', metrics: 'sí', logs: 'sí', alerting: 'sí' } },
  generic: { name: 'Componente genérico', layer: 'application', zone: 'private', opsUnits: 1, monthlyUsd: 25, props: {} },
}
