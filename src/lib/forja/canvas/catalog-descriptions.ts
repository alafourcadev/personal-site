// "Every component explains itself on hover and on focus" — product copy,
// not engineering copy: what each component IS and what it is FOR, in the
// tone of rules.ts's WHY dictionary (plain, direct, no hedging). La Forja
// teaches architecture, so it cannot assume the vocabulary it exists to
// teach — an icon plus a bare noun means nothing to a level-1 player.
// opsUnits cost is appended at render time from CATALOG itself (never
// duplicated here), so the two can never drift apart.
import { CATALOG } from '../engine/catalog'
import type { ComponentType } from '../engine/types'

const WHAT_AND_WHY: Record<ComponentType, string> = {
  actor: 'Una persona real que usa el sistema desde afuera. No es parte de lo que vos diseñás: es quien lo usa.',
  'business-process': 'El paso de negocio que dispara todo lo demás. Es la razón por la que el sistema existe, no un componente técnico.',
  approver: 'Una persona que autoriza algo antes de que el flujo siga. Un punto de decisión humana, no algo para automatizar sin perder el control.',
  'external-party': 'Un tercero fuera de tu control — un banco, un proveedor, otra empresa. Integrás con él, pero no lo operás.',
  'web-client': 'El navegador de quien usa tu sistema. No guarda lógica de negocio propia: pide datos y los muestra.',
  'mobile-client': 'La app en el teléfono de quien usa tu sistema. Igual que el cliente web, pero con conexión menos confiable.',
  'api-gateway': 'La puerta de entrada única al sistema. Autentica, limita el tráfico y decide a qué servicio interno llega cada pedido.',
  service: 'Una pieza de lógica de negocio que corre sola y responde pedidos. El bloque más común de un diseño.',
  worker: 'Un proceso que hace trabajo en segundo plano, sin que nadie espere su respuesta al momento.',
  'ai-model': 'Un modelo de IA que el sistema consulta — casi siempre externo, con un costo y un riesgo de datos propios.',
  'external-provider': 'Un servicio externo que tu sistema usa pero no controla. Su disponibilidad no depende de vos.',
  database: 'Donde vive el dato que tiene que sobrevivir un reinicio. Si no tiene respaldo, ese dato se pierde con un solo golpe.',
  cache: 'Una copia rápida y descartable de un dato. Sirve para leer rápido, nunca para guardar algo que no podés perder.',
  queue: 'Una cola de mensajes: desacopla a quien pide de quien resuelve. Sin nadie que la consuma, es un buzón que nadie revisa.',
  stream: 'Un flujo continuo de eventos, no mensajes puntuales. Pensado para que varios lean el mismo historial.',
  'object-storage': 'Almacenamiento para archivos grandes — imágenes, videos, respaldos. No sirve para consultar, sí para guardar barato.',
  cdn: 'Una red que sirve contenido cerca de quien lo pide, para que no todo el tráfico llegue a tu origen.',
  'identity-provider': 'Quien confirma que alguien es quien dice ser. Centraliza el login para que ningún servicio lo reinvente por su cuenta.',
  'vector-store': 'Guarda datos como vectores para buscar por parecido. La base de datos detrás de un sistema con IA.',
  observability: 'Los ojos del sistema en producción: métricas, registros y trazas. Sin esto, un fallo se entera por un usuario enojado.',
  generic: 'Un componente libre para lo que el catálogo no anticipó. El motor sólo valida su zona y su banda.',
}

function pluralOpsUnits(units: number): string {
  return units === 1 ? '1 unidad operativa' : `${units} unidades operativas`
}

export function describeComponent(type: ComponentType): string {
  return `${WHAT_AND_WHY[type]} Costo operativo: ${pluralOpsUnits(CATALOG[type].opsUnits)}.`
}
