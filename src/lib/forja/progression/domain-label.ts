// The player's word for an exercise's business domain.
//
// `domain` in the frontmatter is an authoring key: lowercase, unaccented,
// hyphenated (`facturacion`, `hoteleria`, `procesamiento-de-imagenes`). The
// level list printed it verbatim, which put engine-adjacent vocabulary in
// front of the player. Doc §5 forbids exactly that ("cero vocabulario
// interno del motor ... en lo que lee el jugador"). Keeping the key as the
// index and mapping it here means authors keep a stable, greppable id and the
// player reads Spanish.
//
// The map is EXHAUSTIVE over the corpus, and `tests/progression/domain-label`
// fails when a `domain:` value has no entry here. It used to carry only the
// keys the fallback could not get right, which worked until the corpus was
// normalised: `logística` and `logistica` were two keys for one domain, both
// rendering "Logística", so nothing on screen ever showed the split, while
// `composition.ts` counted them as two distinct business domains when it
// checks that a level's core exercises span enough of them. Unifying the keys
// moved the risk to the other side: `nomina` and `telefonia` lost the accent
// the map did not carry, and would have rendered "Nomina" and "Telefonia".
// An exhaustive map plus a gate is the only version of this file where a new
// domain cannot render wrong silently.
export const DOMAIN_LABEL: Record<string, string> = {
  aviacion: 'Aviación',
  banca: 'Banca',
  checkout: 'Checkout',
  clasificados: 'Clasificados',
  cobranzas: 'Cobranzas',
  comercio: 'Comercio',
  deportes: 'Deportes',
  educacion: 'Educación',
  energia: 'Energía',
  facturacion: 'Facturación',
  farmacia: 'Farmacia',
  fintech: 'Fintech',
  formacion: 'Formación',
  gastos: 'Gastos',
  gastronomia: 'Gastronomía',
  gobierno: 'Gobierno',
  hospital: 'Hospital',
  hoteleria: 'Hotelería',
  industria: 'Industria',
  inmobiliaria: 'Inmobiliaria',
  laboratorio: 'Laboratorio',
  legal: 'Legal',
  logistica: 'Logística',
  marketplace: 'Marketplace',
  medios: 'Medios',
  movilidad: 'Movilidad',
  municipio: 'Municipio',
  nomina: 'Nómina',
  notificaciones: 'Notificaciones',
  onboarding: 'Onboarding',
  pagos: 'Pagos',
  precios: 'Precios',
  prestamos: 'Préstamos',
  'procesamiento-de-imagenes': 'Procesamiento de imágenes',
  reclutamiento: 'Reclutamiento',
  'recursos-humanos': 'Recursos humanos',
  reservas: 'Reservas',
  retail: 'Retail',
  salud: 'Salud',
  seguros: 'Seguros',
  soporte: 'Soporte',
  telecomunicaciones: 'Telecomunicaciones',
  telefonia: 'Telefonía',
  transporte: 'Transporte',
  videojuegos: 'Videojuegos',
}

export function domainLabel(domain: string): string {
  const key = domain.trim()
  if (key === '') return ''

  const mapped = DOMAIN_LABEL[key.toLocaleLowerCase('es')]
  if (mapped) return mapped

  // Reached only by a key the gate has not seen yet: a half-written file
  // during authoring, never a published one. Readable is better than raw, so
  // a hyphen becomes a space and the phrase gets a capital. Capitalising only
  // the first letter is deliberate: "Recursos humanos", not title case,
  // because Spanish does not capitalise every word of a common noun phrase. What this
  // cannot do is invent an accent, which is exactly why it is not the
  // published path.
  const words = key.replace(/-/g, ' ')
  return words.charAt(0).toLocaleUpperCase('es') + words.slice(1)
}
