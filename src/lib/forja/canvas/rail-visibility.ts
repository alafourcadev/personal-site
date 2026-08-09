// The workbench's two rails, and the storage contract they share.
//
// The exercise screen is a canvas between two rails: the statement on the
// left, the tools on the right. Each folds with a pleca on its own outer edge,
// and each remembers its own answer, because "keep the problem in front of me"
// and "get the tools out of my way" are two different statements and a player
// making one of them is not making the other.
//
// WHY ONE MODULE FOR BOTH. The part worth writing once is the defensive part.
// Safari's private mode throws on storage ACCESS rather than returning null,
// and the statement's read runs inside the page's own unbundled first-paint
// script, where an exception would leave the rest of that script unrun. A full
// quota has to cost a player their preference and never their exercise. Two
// copies of that reasoning is one copy that drifts, which is the same argument
// layout-literals.test.ts already makes about the library rail's width.
//
// WHY ANYTHING UNRECOGNISED READS AS OPEN. A rail whose preference cannot be
// read must never be the reason a player arrives at an exercise without the
// statement it is about, or without the components it is built from. Defaulting
// to open costs a keystroke; defaulting to folded costs the exercise.

export const RAILS = ['statement', 'tools'] as const

export type Rail = (typeof RAILS)[number]

// The statement's key is the one that already shipped, unchanged: a player who
// folded the statement last week must not find it open again because this
// module was introduced.
//
// Neither key lives inside `forja:attempts:v1`. That entry holds designs and
// grows without a ceiling, so a display preference written into it would be the
// first casualty of any pruning, and pruning designs has nothing to do with a
// rail.
export const RAIL_STORAGE_KEYS: Record<Rail, string> = {
  statement: 'forja:statement-collapsed:v1',
  tools: 'forja:tools-collapsed:v1',
}

const COLLAPSED = '1'
const EXPANDED = '0'

type Readable = Pick<Storage, 'getItem'>
type Writable = Pick<Storage, 'setItem'>

export function readRailCollapsed(storage: Readable | null | undefined, rail: Rail): boolean {
  if (!storage) return false
  try {
    return storage.getItem(RAIL_STORAGE_KEYS[rail]) === COLLAPSED
  } catch {
    return false
  }
}

// Reopening writes '0' rather than removing the key: "I want this rail" and "I
// have never chosen" produce the same layout today, but only one of them is a
// decision, and a later change of default must not silently reverse it.
export function writeRailCollapsed(storage: Writable | null | undefined, rail: Rail, collapsed: boolean): void {
  if (!storage) return
  try {
    storage.setItem(RAIL_STORAGE_KEYS[rail], collapsed ? COLLAPSED : EXPANDED)
  } catch {
    // A full quota costs the player their preference, never their exercise.
  }
}

// The fold state as something outside this module wrote onto an attribute.
//
// The statement rail needs this because the page's unbundled first-paint script
// applies the stored preference before any bundle exists, so the island reads
// the state off the DOM rather than being handed it. Anything other than the
// exact string that contract writes reads as open, for the reason above.
export function collapsedFromAttribute(value: string | null | undefined): boolean {
  return value === 'true'
}

export { EXPANDED, COLLAPSED }
