// La Forja evaluation engine — band/zone/port legality (doc 13 §13.3, §13.6).
import type { ComponentType, Zone } from './types'

export const ZONES: Zone[] = ['public', 'dmz', 'private', 'restricted']

export function zoneDistance(a: Zone, b: Zone): number {
  return Math.abs(ZONES.indexOf(a) - ZONES.indexOf(b))
}

// Structural rule: a connection may not jump more than one trust zone.
// public -> restricted is always a blocking error, no configurable exception.
export function isTrustZoneJump(a: Zone, b: Zone): boolean {
  return zoneDistance(a, b) > 1
}

// Which source types a target type's inbound port accepts. A mobile client
// has no sql-out port, so wiring it straight into a database is a shape
// error, not a design debate (§13.6).
export const ACCEPTS: Partial<Record<ComponentType, ComponentType[]>> = {
  'mobile-client': ['actor'],
  'web-client': ['actor'],
  'api-gateway': ['mobile-client', 'web-client', 'external-party'],
  service: ['api-gateway', 'service', 'worker', 'queue', 'stream', 'approver', 'business-process'],
  worker: ['queue', 'stream', 'service'],
  'ai-model': ['service', 'worker'],
  database: ['service', 'worker'],
  cache: ['service', 'worker'],
  queue: ['service', 'worker'],
  stream: ['service', 'worker'],
  'object-storage': ['service', 'worker'],
  cdn: ['object-storage', 'service'],
  'identity-provider': ['api-gateway', 'service'],
  'vector-store': ['service', 'worker'],
  observability: ['service', 'worker', 'database', 'queue', 'stream', 'api-gateway'],
  approver: ['service'],
  'external-party': ['service'],
  'external-provider': ['service', 'worker'],
}

export function isPortCompatible(source: ComponentType, target: ComponentType): boolean {
  if (target === 'generic') return true
  return (ACCEPTS[target] ?? []).includes(source)
}
