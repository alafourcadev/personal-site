// Whether the tools rail is folded, and remembering the answer.
//
// Unlike the statement's fold, this one needs no attribute on <html> and no
// cooperation from anybody outside the island. The reason is the difference
// between the two rails: the statement rail is anchored OVER the pane, so
// folding it does not resize anything and the island's ResizeObserver never
// fires, which is why that state has to be read off the DOM. The tools rail is
// a real column in the flex row, so folding it resizes the pane, the observer
// fires, the camera re-frames and the statement rail's published geometry
// follows, all through machinery that already exists.
//
// The storage contract itself is rail-visibility.ts, shared with the statement,
// because the defensive half of it (private mode throwing on access, a full
// quota costing a preference and never an exercise) is the half worth having
// only one copy of.
import { useCallback, useState } from 'react'
import { readRailCollapsed, writeRailCollapsed } from '../../../lib/forja/canvas/rail-visibility'

export interface ToolsCollapsed {
  collapsed: boolean
  revision: number
  toggle: () => void
}

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function useToolsCollapsed(): ToolsCollapsed {
  // Read on the first render rather than in an effect: the playground is
  // `client:only="react"`, so the document is already there. Deferring it would
  // frame the diagram once for the wrong pane width and again for the right one.
  const [state, setState] = useState(() => ({
    collapsed: readRailCollapsed(storage(), 'tools'),
    revision: 0,
  }))

  const toggle = useCallback(() => {
    setState((current) => {
      const next = !current.collapsed
      // Pressing the pleca IS the decision, so it is the thing that gets
      // remembered. Nothing else in the product writes this key.
      writeRailCollapsed(storage(), 'tools', next)
      // Revision records the gesture even when two rapid presses return the
      // boolean to its original value in one React batch. The camera still has
      // to frame the final pane after both physical resizes.
      return { collapsed: next, revision: current.revision + 1 }
    })
  }, [])

  return { ...state, toggle }
}
