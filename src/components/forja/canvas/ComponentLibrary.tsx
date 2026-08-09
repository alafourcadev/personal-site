// The component library palette [PC1], which is what the workbench's RIGHT rail
// holds while the player is building. Each item is a real <button>, which gives
// pointer click and keyboard Enter/Space the exact same code path for free: the
// browser's native button-activation behavior IS the keyboard creation gesture,
// no custom key handling needed here.
//
// It owns none of its own geometry. Which side it is on, how wide the rail is,
// whether the rail is folded to its pleca and whether the verdict has taken the
// rail instead are all decided where the row is composed (ForjaCanvas.tsx) from
// railWidth() and paneVisibility(). This file is the palette, not the rail.
//
// Two measured defects shaped the current layout:
//
// 1. The single-column list was 1000px of content inside a 593px box. At
//    the default scroll position the last entries were laid out BELOW that
//    box, so `document.elementFromPoint` over "Observabilidad", used by 12
//    of 14 exercises in several levels, returned the ranking panel behind
//    the playground and the click was a silent no-op. Twenty-one entries at
//    the 24px minimum target size plus three headings cannot fit one column
//    in this box; two columns fit with room to spare, so the entries are
//    now all reachable without scrolling at every supported height.
// 2. The explanations were absolutely positioned children of this same
//    scrolling box, which clips in both axes: measured on a real page, the
//    first entry's balloon showed 0 of its 78px and the last one 47 of 94.
//    They are now `position: fixed` and placed by tooltip-position.ts, so
//    no ancestor's overflow can cut them.
import { useCallback, useState } from 'react'
import { CATALOG } from '../../../lib/forja/engine/catalog'
import type { ComponentType, Layer } from '../../../lib/forja/engine/types'
import { CATALOG_COLOR_CLASS, CATALOG_UI } from '../../../lib/forja/canvas/catalog-ui'
import { describeComponent } from '../../../lib/forja/canvas/catalog-descriptions'
import { tooltipPosition, type AnchorRect } from '../../../lib/forja/canvas/tooltip-position'
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

// Matches the `w-56` the balloon renders at. The height is an over-estimate
// of the tallest description (the tallest measured 94px): it is only used to
// keep the balloon off the bottom of the window, and over-estimating there
// costs a few pixels of headroom, while under-estimating would push a
// description off-screen, the exact defect this replaces.
const TOOLTIP_WIDTH_PX = 224
const TOOLTIP_HEIGHT_PX = 120

export interface ComponentLibraryProps {
  onCreate: (type: ComponentType) => void
}

interface ActiveTooltip {
  type: ComponentType
  left: number
  top: number
}

export function ComponentLibrary({ onCreate }: ComponentLibraryProps) {
  const [active, setActive] = useState<ActiveTooltip | null>(null)

  const show = useCallback((type: ComponentType, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const anchor: AnchorRect = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
    const { left, top } = tooltipPosition(
      anchor,
      { width: TOOLTIP_WIDTH_PX, height: TOOLTIP_HEIGHT_PX },
      { width: window.innerWidth, height: window.innerHeight },
    )
    setActive({ type, left, top })
  }, [])

  const hide = useCallback((type: ComponentType) => {
    setActive((current) => (current?.type === type ? null : current))
  }, [])

  return (
    <nav
      aria-label="Biblioteca de componentes"
      // It fills whatever box the rail gives it and declares no width of its
      // own. The rail's width used to be a Tailwind arbitrary value here, tied
      // by a source-text test to the constant every pane calculation reads,
      // because a drift between the two is a broken layout with a green suite.
      // It now comes from that constant directly, through railWidth()
      // (forja-shell.ts), so there are no longer two copies to tie together.
      //
      // `overflow-y-auto` stays as a last-resort escape hatch for a viewport
      // shorter than anything supported, and the two-column grid is what makes
      // it never actually engage.
      className="flex h-full min-w-0 flex-1 flex-col gap-3 overflow-y-auto bg-bg-surface p-2"
    >
      <div className="sticky top-0 z-10 -mx-2 -mt-2 border-b border-border-subtle bg-bg-surface px-3 py-2.5">
        <h2 className="font-heading text-sm font-semibold text-txt-primary">Componentes</h2>
        <p className="mt-0.5 text-xs text-txt-muted">Elegí una pieza para agregarla al lienzo</p>
      </div>
      {LAYERS.map((layer) => (
        <div key={layer}>
          <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-txt-muted">{LAYER_LABEL[layer]}</h2>
          <ul className="grid grid-cols-2 gap-1">
            {TYPES_BY_LAYER[layer].map((type) => {
              const ui = CATALOG_UI[type]
              const descriptionId = `palette-desc-${type}`
              const isActive = active?.type === type
              return (
                // "Every component explains itself on hover and on focus":
                // the reveal is driven by real pointer enter and real focus
                // rather than `group-hover`, because the balloon is no
                // longer a positioned child of this item: it is a fixed
                // box that has to be told where to go. `aria-describedby` on
                // the button is what reaches assistive technology either
                // way, never `title` (mouse-only, no keyboard path).
                <li key={type}>
                  <button
                    type="button"
                    data-testid={`palette-item-${type}`}
                    onClick={() => onCreate(type)}
                    onMouseEnter={(event) => show(type, event.currentTarget)}
                    onMouseLeave={() => hide(type)}
                    onFocus={(event) => show(type, event.currentTarget)}
                    onBlur={() => hide(type)}
                    aria-describedby={descriptionId}
                    className={`flex min-h-[24px] w-full items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1.5 text-left text-xs text-txt-secondary transition-colors hover:border-border-subtle hover:bg-bg-surface-hover hover:text-txt-primary ${CATALOG_COLOR_CLASS[ui.color]}`}
                  >
                    <Icon icon={ui.icon} className="h-3.5 w-3.5 shrink-0" />
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
                    // `fixed` is what escapes this panel's own overflow:
                    // an ancestor's `overflow` never clips a fixed box.
                    className={`pointer-events-none fixed z-50 w-56 rounded-md border border-border-card bg-bg-raised px-2 py-1.5 text-xs text-txt-secondary shadow-elevation-1 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                    // Parked far off-screen while hidden: a fixed box left at
                    // 0,0 would sit over the site header, and 21 of them
                    // would stack there.
                    style={isActive ? { left: active.left, top: active.top } : { left: -9999, top: 0 }}
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
