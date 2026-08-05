// React binding for ForjaStore — the only place in the store layer that
// imports React, keeping forja-store.ts itself DOM/React-free and Vitest
// testable in isolation.
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { ForjaStore } from './forja-store'
import type { Design } from '../engine/types'

export function useForjaStore(initial?: Design) {
  const [store] = useState(() => new ForjaStore(initial))
  const design = useSyncExternalStore(
    useCallback((listener) => store.subscribe(listener), [store]),
    () => store.getDesign(),
  )
  return useMemo(() => ({ store, design }), [store, design])
}
