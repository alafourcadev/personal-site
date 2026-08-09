// WCAG 2.x relative luminance and contrast ratio. Pure math over hex
// strings, no DOM. Reused by R2's future light-theme token contrast gate
// (R2.5/R2.6) as well as this file's own dark-canvas fix.
function channelToLinear(channel255: number): number {
  const s = channel255 / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

// Exported as well as used here: elevation on a dark theme is an ORDERING
// of surfaces, and "the thing that floats is lighter than the thing under
// it" is a claim about luminance, not about contrast between the two.
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

// Half the pairs worth measuring are not two opaque colours: `bg-accent-dim`
// is the accent at 8%, the failed-objective card is the error red at 5%, and a
// border at 40% is not the colour it names. A ratio taken against the unmixed
// colour is fiction, so this flattens the layer first, with the same simple
// source-over the browser does when both layers are opaque underneath.
export function compositeOver(hexForeground: string, alpha: number, hexBackdrop: string): string {
  const channels = (hex: string) => {
    const clean = hex.replace('#', '')
    return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16))
  }
  const fg = channels(hexForeground)
  const bg = channels(hexBackdrop)
  const mixed = fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]))
  return `#${mixed.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}
