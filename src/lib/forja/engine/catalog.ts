// La Forja evaluation engine — closed component catalog (doc 13 §13.5).
// Closed because every type carries rules-relevant properties; the `generic`
// escape hatch exists for solutions the catalog didn't anticipate and is the
// only type without one, per §13.5's own note: "libre — el motor sólo valida
// zona y banda".
import type { ComponentType, Layer, Zone } from './types'

export interface CatalogEntry {
  layer: Layer
  zone: Zone
  opsUnits: number
  props: Record<string, string>
}

export const CATALOG: Record<ComponentType, CatalogEntry> = {
  // -- business --
  actor: { layer: 'business', zone: 'public', opsUnits: 0, props: { volume: '1200/día', connectivity: 'stable' } },
  'business-process': { layer: 'business', zone: 'public', opsUnits: 0, props: { criticality: 'medium', slaMinutes: '240' } },
  approver: { layer: 'business', zone: 'public', opsUnits: 0, props: { availability: '99.0', slaMinutes: '60' } },
  'external-party': { layer: 'business', zone: 'public', opsUnits: 0, props: { contract: 'sí', availability: '99.0' } },
  // -- application --
  service: { layer: 'application', zone: 'private', opsUnits: 1, props: { stateful: 'no', idempotent: 'no', criticality: 'high', replicas: '1' } },
  'api-gateway': { layer: 'application', zone: 'dmz', opsUnits: 1, props: { authn: 'sí', rateLimit: 'sí' } },
  'mobile-client': { layer: 'application', zone: 'public', opsUnits: 0, props: { connectivity: 'intermittent', offlineCapable: 'no' } },
  'web-client': { layer: 'application', zone: 'public', opsUnits: 0, props: { connectivity: 'stable' } },
  worker: { layer: 'application', zone: 'private', opsUnits: 1, props: { idempotent: 'sí', retryPolicy: 'exponential' } },
  'ai-model': { layer: 'application', zone: 'private', opsUnits: 1, props: { hosting: 'external', deterministic: 'no', piiPolicy: 'none' } },
  'external-provider': { layer: 'application', zone: 'dmz', opsUnits: 0, props: { availability: '99.0', slaMinutes: '60' } },
  // -- infrastructure --
  database: { layer: 'infrastructure', zone: 'restricted', opsUnits: 1, props: { consistency: 'strong', persistence: 'durable', backup: 'none', replication: 'none' } },
  cache: { layer: 'infrastructure', zone: 'private', opsUnits: 1, props: { persistence: 'volatile', ttl: '300', eviction: 'lru' } },
  queue: { layer: 'infrastructure', zone: 'private', opsUnits: 1, props: { delivery: 'at-least-once', dlq: 'no', ordering: 'no' } },
  stream: { layer: 'infrastructure', zone: 'private', opsUnits: 1, props: { retention: '7d', partitions: '3', ordering: 'sí' } },
  'object-storage': { layer: 'infrastructure', zone: 'private', opsUnits: 0, props: { durability: '99.999999999', access: 'signed' } },
  cdn: { layer: 'infrastructure', zone: 'dmz', opsUnits: 0, props: { cacheControl: 'public, max-age=3600' } },
  'identity-provider': { layer: 'infrastructure', zone: 'dmz', opsUnits: 1, props: { mfa: 'opcional', sessionRotation: 'no' } },
  'vector-store': { layer: 'infrastructure', zone: 'private', opsUnits: 1, props: { sourceTraceability: 'no' } },
  observability: { layer: 'infrastructure', zone: 'private', opsUnits: 1, props: { traces: 'sí', metrics: 'sí', logs: 'sí', alerting: 'sí' } },
  generic: { layer: 'application', zone: 'private', opsUnits: 1, props: {} },
}
