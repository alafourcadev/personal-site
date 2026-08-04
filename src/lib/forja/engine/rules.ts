// La Forja evaluation engine — the 13 §13.7 rules, ported verbatim (logic
// from forja-canvas.html:337-480, "why" copy from doc 13 §13.7 word for word;
// port-mismatch's copy has no §13.7 entry so it is ported from the prototype).
// Two prototype defects are fixed here, not carried over: the dead
// `n.type === "stream"` branch (missing catalog entry, not a bad rule) and
// the catalog gaps closed in catalog.ts.
import { CATALOG } from './catalog'
import { isPortCompatible, isTrustZoneJump } from './legality'
import type { Design, DesignNode, Finding, RuleId, Severity } from './types'

const WHY = {
  trustZoneJump:
    'Exponés un componente restringido a una red donde no controlás quién llega. Si el cliente es comprometido, no hay capa intermedia que limite el daño.',
  volatileDurableMismatch:
    'Un reinicio borra el dato. Si tenías obligación de conservarlo, la incumpliste sin enterarte.',
  regulatedWithoutBackup:
    'La retención no es una promesa del motor de base, es una decisión tuya. Sin backup, la retención a 15 años es una afirmación sin respaldo.',
  piiToExternalModel:
    'Estás enviando datos personales a un tercero. Aunque el proveedor prometa no entrenar con ellos, la transferencia ya ocurrió y tenés que poder justificarla.',
  queueWithoutDlq:
    'Un mensaje que falla siempre bloquea o se pierde en silencio. Con una sola persona de guardia, nadie lo va a ver hasta que un cliente reclame.',
  orphanQueue:
    'Los mensajes se acumulan hasta llenar la retención y después se descartan. El sistema parece funcionar: nadie ve el error hasta que falta el dato.',
  syncChainDepth:
    'La disponibilidad se multiplica. Tres servicios al 99,9 % dan 99,7 %: pasás de 8 a 26 horas de caída al año, y ninguno de los tres estuvo "caído".',
  intermittentClient:
    'En una red inestable el cliente reintenta. Sin idempotencia, cada reintento es una operación nueva: cobros duplicados, reservas dobles, registros repetidos.',
  noObservability:
    'No vas a saber que se rompió hasta que te lo diga un usuario. El tiempo de detección pasa a ser el tiempo que tarda alguien en enojarse.',
  singlePointOfFailure:
    'Cualquier mantenimiento es una caída. No es un problema hasta que necesitás actualizar algo un martes a la tarde.',
  opsBudgetExceeded:
    'El diseño es correcto y el equipo no lo puede sostener. Un sistema que nadie puede operar es un sistema que se degrada solo.',
  undeclaredDataClass:
    'Sin saber qué viaja no se puede evaluar exposición ni retención. No es un error: es información que falta.',
  portMismatchHuman: (target: string) =>
    `Una persona no usa un ${target} directamente: usa un cliente. Falta la pieza por la que entra — móvil, web o un tercero con contrato.`,
  portMismatchStructural: (source: string, target: string) =>
    `Un ${target} no expone un puerto que acepte a un ${source}. No es una decisión discutible: es un error de forma.`,
}

const byId = (nodes: DesignNode[], id: string) => nodes.find((n) => n.id === id)

export function evaluateRules(design: Design, opsCapacity = 4): Finding[] {
  const { nodes, edges } = design
  const findings: Finding[] = []
  let seq = 0
  const add = (
    rule: RuleId,
    severity: Severity,
    title: string,
    evidence: string,
    why: string,
    nodeIds: string[],
    edgeIds: string[] = [],
  ) => findings.push({ id: `${rule}:${seq++}`, rule, severity, title, evidence, why, nodeIds, edgeIds })

  // -- per connection --
  edges.forEach((e) => {
    const a = byId(nodes, e.from.node)
    const b = byId(nodes, e.to.node)
    if (!a || !b) return

    if (isTrustZoneJump(a.zone, b.zone))
      add('trust-zone-jump', 'blocking', 'Salto de zona de confianza',
        `${a.label} (${a.zone}) → ${b.label} (${b.zone})`, WHY.trustZoneJump, [a.id, b.id], [e.id])

    if (!isPortCompatible(a.type, b.type)) {
      const humanSource = a.type === 'actor' || a.type === 'approver'
      add('port-mismatch', 'blocking', 'Conexión imposible por contrato',
        `${a.type} → ${b.type}`,
        humanSource ? WHY.portMismatchHuman(b.type) : WHY.portMismatchStructural(a.type, b.type),
        [a.id, b.id], [e.id])
    }

    // Doc 13 §13.7 binds this rule to `regulated` OR `personal`. The prototype only
    // checked `regulated`; porting that verbatim would have left PII in a cache silent.
    if ((e.dataClass === 'regulated' || e.dataClass === 'personal') && b.type === 'cache')
      add('volatile-durable-mismatch', 'blocking', 'Dato sensible en almacenamiento volátil',
        `${a.label} → ${b.label} · dato ${e.dataClass === 'regulated' ? 'regulado' : 'personal'}`,
        WHY.volatileDurableMismatch, [b.id], [e.id])

    if (e.dataClass === 'personal' && b.type === 'ai-model' && b.props.hosting === 'external')
      add('pii-to-external-model', 'blocking', 'Datos personales hacia un modelo externo',
        `${a.label} → ${b.label} · hosting externo`, WHY.piiToExternalModel, [b.id], [e.id])

    if (!e.dataClass)
      add('undeclared-data-class', 'note', 'Falta declarar qué dato viaja',
        `${a.label} → ${b.label}`, WHY.undeclaredDataClass, [], [e.id])
  })

  // -- per node --
  nodes.forEach((n) => {
    const inbound = edges.filter((e) => e.to.node === n.id)
    const outbound = edges.filter((e) => e.from.node === n.id)

    if (n.type === 'database' && n.props.backup === 'none' && inbound.some((e) => e.dataClass === 'regulated'))
      add('regulated-without-backup', 'blocking', 'Dato regulado sin respaldo',
        `${n.label} · backup: none`, WHY.regulatedWithoutBackup, [n.id])

    if (n.type === 'queue' && n.props.delivery === 'at-least-once' && n.props.dlq === 'no')
      add('queue-without-dlq', 'warning', 'Cola sin destino para mensajes fallidos',
        `${n.label} · at-least-once · sin cola de mensajes muertos`, WHY.queueWithoutDlq, [n.id])

    // Revived vs. the prototype: `stream` is now a real catalog type (D4),
    // so this branch fires instead of being unreachable dead code.
    if ((n.type === 'queue' || n.type === 'stream') && outbound.length === 0)
      add('orphan-queue', 'blocking', 'Cola sin consumidor',
        `${n.label} · 0 consumidores`, WHY.orphanQueue, [n.id])

    if (n.type === 'service' && n.props.criticality === 'high' && n.props.replicas === '1')
      add('single-point-of-failure', 'warning', 'Punto único de falla en camino crítico',
        `${n.label} · réplicas: 1 · criticidad: alta`, WHY.singlePointOfFailure, [n.id])
  })

  // -- reachability: intermittent client hitting a non-idempotent service.
  //    Grouped by the service at fault: the defect belongs to the service. --
  const atRisk = new Map<string, DesignNode[]>()
  nodes.filter((n) => n.props.connectivity === 'intermittent').forEach((src) => {
    const seen = new Set([src.id])
    const stack = [src.id]
    while (stack.length) {
      const cur = stack.pop() as string
      edges.filter((e) => e.from.node === cur).forEach((e) => {
        if (seen.has(e.to.node)) return
        seen.add(e.to.node)
        stack.push(e.to.node)
        const t = byId(nodes, e.to.node)
        if (t && t.type === 'service' && t.props.idempotent === 'no') {
          if (!atRisk.has(t.id)) atRisk.set(t.id, [])
          atRisk.get(t.id)?.push(src)
        }
      })
    }
  })
  atRisk.forEach((srcs, tid) => {
    const t = byId(nodes, tid) as DesignNode
    add('intermittent-client-without-idempotency', 'warning', 'Reintentos sin idempotencia',
      `${t.label} (idempotente: no) alcanzado por ${srcs.map((s) => s.label).join(', ')}`,
      WHY.intermittentClient, [tid, ...srcs.map((s) => s.id)])
  })

  // -- observability coverage --
  const critical = nodes.filter((n) => n.type === 'service' && n.props.criticality === 'high')
  const obs = nodes.filter((n) => n.type === 'observability')
  if (critical.length && !obs.length)
    add('no-observability-on-critical', 'warning', 'Servicio crítico sin observabilidad',
      `${critical.map((n) => n.label).join(', ')} · 0 componentes de observabilidad`,
      WHY.noObservability, critical.map((n) => n.id))

  // -- sync chain depth --
  const depth = (id: string, d: number, seen: Set<string>): number => {
    if (seen.has(id)) return d
    seen.add(id)
    const outs = edges
      .filter((e) => e.from.node === id)
      .map((e) => byId(nodes, e.to.node))
      .filter((t): t is DesignNode => !!t && t.type === 'service')
    return outs.length ? Math.max(...outs.map((t) => depth(t.id, d + 1, seen))) : d
  }
  nodes.filter((n) => n.type === 'service').forEach((n) => {
    if (depth(n.id, 1, new Set()) >= 3)
      add('sync-chain-depth', 'warning', 'Cadena síncrona profunda',
        `3 o más servicios encadenados desde ${n.label}`, WHY.syncChainDepth, [n.id])
  })

  // -- operational budget --
  const opsUsed = nodes.reduce((sum, n) => sum + CATALOG[n.type].opsUnits, 0)
  if (opsUsed > opsCapacity)
    add('ops-budget-exceeded', 'warning', 'El equipo no puede operar este diseño',
      `${opsUsed} piezas que operar · capacidad declarada: ${opsCapacity}`, WHY.opsBudgetExceeded, [])

  const order: Record<Severity, number> = { blocking: 0, warning: 1, note: 2 }
  return findings.sort((a, b) => order[a.severity] - order[b.severity])
}
