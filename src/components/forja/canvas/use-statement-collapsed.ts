// Whether the objective card over the canvas is open or folded.
//
// The island needs this for one reason: the card is out of the layout flow, so
// folding it does not change the canvas's box and the ResizeObserver that
// drives every other re-frame never fires. What the fold does change is the
// room the camera may use, which is the card's own footprint in pane pixels
// (forja-shell.ts's briefFitPadding).
//
// Why the attribute on <html> and not a prop or an event. A prop cannot carry
// it: the page's own unbundled first-paint script is what applies the stored
// preference, and it runs before this island exists. An event would put a
// contract on that script. Observing an attribute needs no cooperation from
// whoever writes it, which is exactly the argument use-site-theme.ts already
// makes for the theme, and this is the same mechanism for the same reason.
import { useEffect, useState } from 'react'
import { STATEMENT_COLLAPSED_ATTRIBUTE, collapsedFromRootAttribute } from '../../../lib/forja/canvas/statement-visibility'

export interface StatementCollapsed {
  collapsed: boolean
  revision: number
}

export function useStatementCollapsed(): StatementCollapsed {
  // Read on the first render rather than in an effect: the playground is
  // `client:only="react"`, so the document is already there and the page's
  // first-paint script has already written the attribute. Deferring it would
  // frame the diagram once for the wrong state and again for the right one.
  const [state, setState] = useState<StatementCollapsed>(() => ({
    collapsed:
      typeof document === 'undefined'
        ? false
        : collapsedFromRootAttribute(document.documentElement.getAttribute(STATEMENT_COLLAPSED_ATTRIBUTE)),
    revision: 0,
  }))

  useEffect(() => {
    const root = document.documentElement
    const read = () =>
      setState((current) => ({
        collapsed: collapsedFromRootAttribute(root.getAttribute(STATEMENT_COLLAPSED_ATTRIBUTE)),
        // MutationObserver may coalesce two quick folds into one callback. A
        // revision still tells the camera that real geometry changed even if
        // the final boolean equals the value before both presses.
        revision: current.revision + 1,
      }))
    // Once more on mount: between the first render and this effect the player
    // could have pressed the control.
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: [STATEMENT_COLLAPSED_ATTRIBUTE] })
    return () => observer.disconnect()
  }, [])

  return state
}
