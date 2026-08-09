// Keeps the playground in the theme the player chose, for as long as they are
// on the page.
//
// Everything painted through a brand token follows the theme on its own: the
// browser re-resolves `rgb(var(--bg-deep))` the instant the class on <html>
// changes. One thing does not: React Flow's `colorMode` prop, which decides
// whether the library puts its own `.react-flow.dark` class on the pane, and
// with it the dark defaults for the controls, the dot grid and the edge labels.
// That prop needs a value in React state, so this hook exists.
//
// Why the class attribute and not an event from the switch: an event would put
// a contract on Navbar.astro, a component every page on the site loads, and it
// would still miss the class BaseLayout.astro's inline script sets before any
// React code exists. Observing the attribute needs no cooperation from anybody
// and is correct for whoever writes it, including a future second switch.
//
// Why not React Flow's own `colorMode="system"`: it reads
// `prefers-color-scheme`, and this site's switch never touches the OS
// preference. A player on a light OS who chose dark would get a light canvas.
import { useEffect, useState } from 'react'
import { themeFromRootClass, type ForjaTheme } from '../../../lib/forja/canvas/site-theme'

export function useSiteTheme(): ForjaTheme {
  // Read on the first render, not in an effect: the playground is
  // `client:only="react"`, so the document is already there and already
  // carries the class. Deferring it to an effect would paint one frame of the
  // wrong theme on every load.
  const [theme, setTheme] = useState<ForjaTheme>(() =>
    typeof document === 'undefined' ? 'dark' : themeFromRootClass(document.documentElement.className),
  )

  useEffect(() => {
    const root = document.documentElement
    const read = () => setTheme(themeFromRootClass(root.className))
    // Once more on mount: between the first render and this effect the player
    // could have pressed the switch.
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return theme
}
