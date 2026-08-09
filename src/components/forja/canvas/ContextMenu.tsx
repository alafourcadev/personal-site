// Generic role="menu" popup for PC15 (per-node and empty-canvas context
// menus). Historical bug this deliberately avoids: the prototype's
// pointerdown handler ran for every mouse button, redrawing the canvas and
// destroying the right-clicked element before the browser's `contextmenu`
// event ever fired, so the node menu could never open, only the canvas
// one. This component never listens to pointerdown for its own triggering;
// ForjaCanvas.tsx opens it exclusively from React Flow's own
// onNodeContextMenu/onPaneContextMenu hooks, which the library already
// scopes correctly to node vs pane and which never fire for a left-button
// drag. Positioned `absolute` inside the playground's own `relative
// isolate` root, never `fixed`, clamped there via a pure function
// (menu-position.ts), which is what keeps it inside the playground's own
// stacking context and off the site header (PC17).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clampMenuPosition } from '../../../lib/forja/canvas/menu-position'

export interface ContextMenuItem {
  id: string
  label: string
  onSelect: () => void
  danger?: boolean
  swatchClass?: string
  // Same swatch, given as a colour instead of a utility class, for the data
  // classes, whose colour is a hex the SVG stroke also uses (data-classes.ts).
  // Keeping one source means the dot in the menu and the line on the canvas can
  // never disagree about what "dato regulado" looks like.
  swatchColor?: string
  // Present only on items that are one option of a set (the four data classes).
  // It turns the item into a `menuitemradio`, so a screen reader announces
  // WHICH one is currently declared instead of reading four identical commands.
  checked?: boolean
}

export interface ContextMenuProps {
  items: ContextMenuItem[]
  // Viewport coordinates: typically a MouseEvent's clientX/clientY, or an
  // approximated point near a keyboard-focused node for the Shift+F10 path.
  anchor: { x: number; y: number }
  containerRef: React.RefObject<HTMLElement | null>
  onClose: (returnFocus: boolean) => void
  label: string
}

export function ContextMenu({ items, anchor, containerRef, onClose, label }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState(anchor)

  // Runs before paint: clamps the raw anchor into the container's own local
  // coordinate space, using the menu's real measured size, with no flash of the
  // unclamped position.
  useLayoutEffect(() => {
    const container = containerRef.current
    const menu = menuRef.current
    if (!container || !menu) return
    const containerRect = container.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const local = { x: anchor.x - containerRect.x, y: anchor.y - containerRect.y }
    setPosition(
      clampMenuPosition(
        local,
        { width: menuRect.width, height: menuRect.height },
        { x: 0, y: 0, width: containerRect.width, height: containerRect.height },
      ),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const menuItems = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]')
    menuItems?.[activeIndex]?.focus()
  }, [activeIndex])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      const count = items.length
      if (count === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => (i + 1) % count)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => (i - 1 + count) % count)
      } else if (event.key === 'Home') {
        event.preventDefault()
        setActiveIndex(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        setActiveIndex(count - 1)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onClose(true)
      }
    }
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }
  }, [items.length, onClose])

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      data-testid="context-menu"
      className="absolute z-10 min-w-[200px] rounded-lg border border-border-card bg-bg-raised shadow-elevation-1 py-1"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          // `menuitem` unless the item is one option of a set. The keyboard
          // handler above queries `[role="menuitem"]`, so both roles are matched
          // there. A radio item that fell out of the roving-tabindex ring would
          // be a menu you can see and cannot reach with the arrow keys.
          role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
          aria-checked={item.checked}
          data-testid={`context-menu-item-${item.id}`}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => {
            item.onSelect()
            onClose(false)
          }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-bg-surface-hover ${
            item.danger ? 'text-danger-ink' : 'text-txt-primary'
          }`}
        >
          {item.swatchClass && <span className={`h-3 w-3 rounded-full ${item.swatchClass}`} aria-hidden="true" />}
          {item.swatchColor && (
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.swatchColor }} aria-hidden="true" />
          )}
          {item.label}
          {/* `aria-checked` above is what a screen reader announces; this is the
              same fact for someone who can see the menu. Hidden from assistive
              technology so it is never said twice. */}
          {item.checked && (
            <span className="ml-auto text-accent-ink" aria-hidden="true">
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
