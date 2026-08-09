// Which of the brand's two themes the page is currently showing.
//
// The site's switch (Navbar.astro) toggles a `dark` class on <html> and
// remembers the choice in localStorage; an inline script in BaseLayout.astro
// re-applies it before first paint. It never touches `prefers-color-scheme`,
// which is why React Flow's own `colorMode="system"` is the wrong answer here:
// it would read the OS preference and ignore the switch the player just used.
//
// This module owns the two names and the reading of that class. It is pure on
// purpose (a string in, a theme out): the DOM plumbing lives in the hook that
// calls it, and everything else that needs to speak per theme (the token
// tables, their contrast gates) can import the type without importing React.
export type ForjaTheme = 'light' | 'dark'

// Declaration order matters nowhere; what matters is that this is the one list.
// A third theme has to appear here first, which is what makes every per-theme
// table and every contrast gate fail loudly instead of silently covering two
// thirds of the product.
export const FORJA_THEMES: ForjaTheme[] = ['light', 'dark']

// `className` rather than a DOMTokenList so this stays testable without a DOM.
// Split on whitespace instead of `includes('dark')`: `darkmode`, `dark-theme`
// and any other library's class that merely starts the same way would otherwise
// put the playground in a theme the player never chose, with no way to correct
// it from inside the canvas.
export function themeFromRootClass(className: string): ForjaTheme {
  return className.split(/\s+/).includes('dark') ? 'dark' : 'light'
}
