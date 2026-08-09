// Presentation catalog: icon key + color category + Spanish label per
// engine ComponentType. Pure data, with no DOM and no React import, so the
// mapping is completeness-checked in Vitest without a browser. Colors are
// the four categorical brand tokens from src/layouts/BaseLayout.astro
// (accent, accent-blue, accent-amber, txt-muted); accent-red is reserved
// for finding severity, never for a component's baseline identity.
import type { ComponentType } from '../engine/types'

export type CatalogColor = 'neutral' | 'blue' | 'brand' | 'amber'

export type IconKey =
  | 'person'
  | 'check-person'
  | 'flow'
  | 'handshake'
  | 'browser'
  | 'phone'
  | 'square-lines'
  | 'gate'
  | 'gear'
  | 'spark'
  | 'cloud'
  | 'cylinder'
  | 'bolt'
  | 'stack'
  | 'wave'
  | 'cube'
  | 'globe'
  | 'key'
  | 'grid'
  | 'pulse'
  | 'dashed'

export interface CatalogUiEntry {
  label: string
  icon: IconKey
  color: CatalogColor
}

export const CATALOG_UI: Record<ComponentType, CatalogUiEntry> = {
  // -- business: who's outside the system --
  actor: { label: 'Persona usuaria', icon: 'person', color: 'neutral' },
  'business-process': { label: 'Proceso de negocio', icon: 'flow', color: 'neutral' },
  approver: { label: 'Aprobador', icon: 'check-person', color: 'neutral' },
  'external-party': { label: 'Tercero externo', icon: 'handshake', color: 'neutral' },
  // -- application: entry points and what runs --
  'web-client': { label: 'Cliente web', icon: 'browser', color: 'blue' },
  'mobile-client': { label: 'Cliente móvil', icon: 'phone', color: 'blue' },
  'api-gateway': { label: 'Puerta de entrada', icon: 'gate', color: 'blue' },
  service: { label: 'Servicio', icon: 'square-lines', color: 'brand' },
  worker: { label: 'Procesador', icon: 'gear', color: 'brand' },
  'ai-model': { label: 'Modelo de IA', icon: 'spark', color: 'brand' },
  'external-provider': { label: 'Proveedor externo', icon: 'cloud', color: 'neutral' },
  // -- infrastructure: where data lives --
  database: { label: 'Base de datos', icon: 'cylinder', color: 'amber' },
  cache: { label: 'Caché', icon: 'bolt', color: 'amber' },
  queue: { label: 'Cola de mensajes', icon: 'stack', color: 'amber' },
  stream: { label: 'Registro de eventos', icon: 'wave', color: 'amber' },
  'object-storage': { label: 'Almacenamiento de objetos', icon: 'cube', color: 'amber' },
  cdn: { label: 'CDN', icon: 'globe', color: 'blue' },
  'identity-provider': { label: 'Proveedor de identidad', icon: 'key', color: 'blue' },
  'vector-store': { label: 'Base vectorial', icon: 'grid', color: 'amber' },
  observability: { label: 'Observabilidad', icon: 'pulse', color: 'neutral' },
  generic: { label: 'Componente genérico', icon: 'dashed', color: 'neutral' },
}

export const CATALOG_COLOR_CLASS: Record<CatalogColor, string> = {
  neutral: 'text-txt-muted border-border-subtle',
  blue: 'text-accent-blue border-accent-blue/40',
  brand: 'text-accent border-accent/40',
  amber: 'text-accent-amber border-accent-amber/40',
}
