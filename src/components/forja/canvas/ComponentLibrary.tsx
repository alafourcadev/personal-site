// The component library palette [PC1]. Each item is a real <button>, which
// gives pointer click and keyboard Enter/Space the exact same code path for
// free — the browser's native button-activation behavior IS the keyboard
// creation gesture, no custom key handling needed here.
import { CATALOG } from '../../../lib/forja/engine/catalog'
import type { ComponentType, Layer } from '../../../lib/forja/engine/types'
import { CATALOG_COLOR_CLASS, CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import { describeComponent } from '../../../lib/forja/canvas/catalog-descriptions'
import { Icon } from './Icon'

const LAYER_LABEL: Record<Layer, string> = {
  business: 'Negocio',
  application: 'Aplicación',
  infrastructure: 'Infraestructura',
}

const LAYERS: Layer[] = ['business', 'application', 'infrastructure']
const TYPES_BY_LAYER: Record<Layer, ComponentType[]> = LAYERS.reduce(
  (acc, layer) => {
    acc[layer] = (Object.keys(CATALOG) as ComponentType[]).filter((type) => CATALOG[type].layer === layer)
    return acc
  },
  {} as Record<Layer, ComponentType[]>,
)

export interface ComponentLibraryProps {
  onCreate: (type: ComponentType) => void
}

export function ComponentLibrary({ onCreate }: ComponentLibraryProps) {
  return (
    <nav
      aria-label="Biblioteca de componentes"
      // Fixed width, never grows: the spec ("full viewport width") wants
      // surplus horizontal space going to the canvas, not stretching this
      // sidebar. `shrink-0` pairs with the canvas's own `flex-1` next to it.
      className="flex h-full w-[220px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-subtle bg-bg-surface p-3"
    >
      {LAYERS.map((layer) => (
        <div key={layer}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-txt-muted">{LAYER_LABEL[layer]}</h2>
          <ul className="flex flex-col gap-1">
            {TYPES_BY_LAYER[layer].map((type) => {
              const ui = CATALOG_UI[type]
              const descriptionId = `palette-desc-${type}`
              return (
                // "Every component explains itself on hover and on focus":
                // `group` + `group-hover`/`group-focus-within` reveal the
                // description visually; `aria-describedby` on the button
                // itself is what reaches assistive technology regardless
                // of the visual reveal — never `title` (mouse-only, no
                // keyboard path, and slow to appear).
                <li key={type} className="group relative">
                  <button
                    type="button"
                    data-testid={`palette-item-${type}`}
                    onClick={() => onCreate(type)}
                    aria-describedby={descriptionId}
                    className={`flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm text-txt-secondary transition-colors hover:border-border-subtle hover:bg-bg-surface-hover hover:text-txt-primary ${CATALOG_COLOR_CLASS[ui.color]}`}
                  >
                    <Icon icon={ui.icon} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{ui.label}</span>
                  </button>
                  <span
                    id={descriptionId}
                    role="tooltip"
                    data-testid={`palette-description-${type}`}
                    // Never `hidden`/`display:none`: opacity-0 stays out of
                    // the visual flow while remaining in the accessibility
                    // tree unconditionally, which is what an explanation
                    // that MUST be reachable by keyboard alone requires.
                    className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border-subtle bg-bg-deep px-2 py-1.5 text-xs text-txt-secondary opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    {describeComponent(type)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
