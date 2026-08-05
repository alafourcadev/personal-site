// The 12-level map (doc §14.4, "Mapa propuesto"). Static reference data —
// prerequisites, not difficulty, decide which level a topic lives in (see
// difficulty.ts's own header comment). Every level's prerequisite is the
// level directly before it: the map is a straight chain, not a DAG, because
// each topic explicitly builds on the concept the previous one taught.
export interface LevelInfo {
  id: number
  name: string
  prerequisiteLevel: number | null
  // The concept from the prerequisite level that makes this one possible —
  // the doc's own "Prerrequisito que lo habilita" column, used verbatim in
  // the locked-level message [PR1].
  enabledBy: string
}

export const LEVELS: LevelInfo[] = [
  { id: 1, name: 'Pensar antes de diseñar', prerequisiteLevel: null, enabledBy: 'el vocabulario del motor — sin canvas' },
  { id: 2, name: 'Acoplamiento, cohesión y límites', prerequisiteLevel: 1, enabledBy: 'requisitos, para decidir qué agrupar' },
  { id: 3, name: 'Datos, integridad y clasificación', prerequisiteLevel: 2, enabledBy: 'límites, para saber quién es dueño de qué' },
  { id: 4, name: 'Comunicación entre servicios', prerequisiteLevel: 3, enabledBy: 'integridad — la idempotencia necesita "la misma operación"' },
  { id: 5, name: 'Producción y operación', prerequisiteLevel: 4, enabledBy: 'algo que falle en silencio, que motive observar' },
  { id: 6, name: 'Resiliencia y fallo parcial', prerequisiteLevel: 5, enabledBy: 'señales — no se recupera lo que no se detecta' },
  { id: 7, name: 'Escala, capacidad y costo', prerequisiteLevel: 6, enabledBy: 'degradación — a 10x lo que se rompe es parcial' },
  { id: 8, name: 'Datos a gran escala y multi-tenencia', prerequisiteLevel: 7, enabledBy: 'capacidad y clasificación de datos' },
  { id: 9, name: 'Seguridad, identidad y cumplimiento', prerequisiteLevel: 8, enabledBy: 'multi-tenencia — aislamiento es medio control de acceso' },
  { id: 10, name: 'Arquitectura con IA', prerequisiteLevel: 9, enabledBy: 'seguridad, resiliencia y costo' },
  { id: 11, name: 'Evolución y migración', prerequisiteLevel: 10, enabledBy: 'todo lo anterior — se migra un sistema, no un componente' },
  { id: 12, name: 'Liderazgo técnico y defensa', prerequisiteLevel: 11, enabledBy: 'decisiones irreversibles que defender' },
]

export function levelById(id: number): LevelInfo | undefined {
  return LEVELS.find((l) => l.id === id)
}

// PR1: a locked level MUST state which prerequisite is missing. `null`
// means the level is open — either it has no prerequisite, or the
// prerequisite is already in the player's completed set.
export function lockedReason(level: LevelInfo, completedLevelIds: ReadonlySet<number>): string | null {
  if (level.prerequisiteLevel === null) return null
  if (completedLevelIds.has(level.prerequisiteLevel)) return null
  const prereq = levelById(level.prerequisiteLevel)
  return `Se abre al terminar el nivel ${level.prerequisiteLevel}${prereq ? ` (${prereq.name})` : ''}.`
}
