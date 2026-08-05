# Forja Playground Canvas Specification

## Purpose

The interactive canvas where a player builds a design graph: create, move,
connect, delete-connection, delete-node, undo, pan, and fit-to-content —
every gesture available by pointer and by keyboard — plus the five
non-negotiable §13.9 accessibility requirements.

## Requirements

### Requirement: Node creation by pointer and keyboard
The canvas MUST let a player create a node from the component library by
pointer (drag or click-to-place) and by keyboard alone, and MUST move focus
to the newly created node.

#### Scenario: Create by pointer
- GIVEN the component library is open
- WHEN the player drags a component type onto the canvas
- THEN a node of that type MUST appear on the canvas

#### Scenario: Create by keyboard
- GIVEN the component library item has focus
- WHEN the player presses Enter
- THEN a node of that type MUST appear on the canvas and receive focus

### Requirement: Node move by pointer and keyboard
The canvas MUST let a player reposition a node by pointer drag and by
keyboard (arrow keys on a focused, selected node).

#### Scenario: Move by keyboard
- GIVEN a node is focused and selected
- WHEN the player presses an arrow key
- THEN the node's position MUST change in that direction

### Requirement: Connection creation by pointer and keyboard
The canvas MUST let a player connect two compatible ports by pointer drag
from port to port, and by keyboard (select source node, invoke "connect to",
select target node).

#### Scenario: Connect by keyboard
- GIVEN a node is focused and selected
- WHEN the player invokes the keyboard connect command and selects a
  compatible target node
- THEN a connection MUST be created between the two nodes' compatible ports

### Requirement: Connection deletion by pointer and keyboard
The canvas MUST let a player delete an existing connection by selecting it
with a real pointer click and by keyboard, and the deletion MUST persist
after the canvas re-renders.

#### Scenario: Delete a connection with the pointer
- GIVEN a connection exists between two nodes
- WHEN the player clicks the connection with a real pointer event and
  confirms delete
- THEN the connection count MUST decrease by one and the connection MUST NOT
  reappear on the next render

#### Scenario: Delete a connection with the keyboard
- GIVEN a connection is focused/selected via keyboard navigation
- WHEN the player presses Delete
- THEN the connection MUST be removed

### Requirement: Node deletion by pointer and keyboard
The canvas MUST let a player delete a selected node by pointer (context menu
or Delete key while pointer-selected) and by keyboard (Delete key while
keyboard-focused and selected), removing its connections too.

#### Scenario: Delete a keyboard-selected node
- GIVEN a node is focused and selected via keyboard
- WHEN the player presses Delete
- THEN the node and any connections attached to it MUST be removed

### Requirement: Undo
The canvas MUST support undo for create, move, connect, delete-connection,
and delete-node actions, reachable by a visible control and a keyboard
shortcut.

#### Scenario: Undo restores a deleted connection
- GIVEN the player just deleted a connection
- WHEN the player triggers undo
- THEN the connection MUST reappear between the same two ports

### Requirement: Pan and real fit-to-content
The canvas MUST support panning at any zoom level, and its "fit" control MUST
compute the bounding box of all nodes and adjust pan/zoom so every node is
visible, at viewport widths down to 1280px.

#### Scenario: Fit reveals a node outside the visible area at 1280px
- GIVEN a design whose rightmost node falls outside the visible canvas at
  1280px width
- WHEN the player triggers fit-to-content
- THEN the rightmost node MUST become fully visible without manual panning

### Requirement: Empty-canvas state
The canvas MUST render an explicit empty state (not a bare grid) when it has
zero nodes, describing what to do next.

#### Scenario: Empty canvas shows guidance
- GIVEN a canvas with zero nodes
- WHEN it is rendered
- THEN it MUST display a visible message inviting the player to add a
  component from the library

### Requirement: Cancelable gestures preserve data
Every in-progress gesture (rename, drag, connect) MUST be cancelable with
Escape without committing or discarding the underlying data; renaming
specifically MUST restore the original label on cancel.

#### Scenario: Escape during rename does not lose the name
- GIVEN a node's label is being edited
- WHEN the player types a new value and presses Escape
- THEN the node's label MUST remain the original value, not empty or partial

### Requirement: List view equivalent (§13.9)
The canvas MUST offer a list view containing the same nodes, connections, and
warnings as the graphical canvas, navigable and actionable without a pointer.

#### Scenario: List view shows the same warnings as the canvas
- GIVEN a design with one blocking finding
- WHEN the player switches to list view
- THEN the same finding MUST be visible in the list, with the same rule id
  and consequence text

### Requirement: Full keyboard construction (§13.9)
A player MUST be able to build a complete, submittable design (create nodes,
connect them, delete a node, delete a connection) using only the keyboard,
with focus management that keeps the newly acted-upon element focused.

#### Scenario: End-to-end keyboard build
- GIVEN an empty canvas and no pointer input
- WHEN the player creates two nodes and connects them using only keyboard
  commands
- THEN the resulting design MUST be submittable and MUST match what an
  equivalent pointer-built design would produce

### Requirement: Text-based warnings, never color-only (§13.9)
Every warning or finding severity MUST be conveyed through visible text (not
color alone), and canvas elements carrying a warning MUST expose it via an
accessible live region or equivalent text alternative.

#### Scenario: Severity is readable without color
- GIVEN a finding of `blocking` severity
- WHEN rendered on the canvas or in the list view
- THEN its severity MUST be stated in text, not conveyed only by a colored
  indicator

### Requirement: Accessible node names with type/zone/state (§13.9)
Each node's accessible name MUST include its display label, component type,
trust zone, and current state (e.g. selected, has-error), and MUST NOT
replace or hide the visible label from assistive technology.

#### Scenario: Screen reader announces type, zone, and state
- GIVEN a node labeled "Base de pedidos" of type `database` in zone
  `restricted`, currently selected
- WHEN its accessible name is queried
- THEN it MUST include the label, "database", "restricted", and "selected"

### Requirement: Optional auto-layout (§13.9)
Auto-layout MUST be available as an explicit, player-triggered action and
MUST NOT run automatically or be required to complete an exercise.

#### Scenario: Auto-layout does not run without invocation
- GIVEN a design with manually positioned nodes
- WHEN the player performs any other canvas action
- THEN node positions MUST remain exactly as the player placed them

### Requirement: Per-node context menu on right-click
Right-clicking a node MUST open a context menu scoped to that node, offering
at least: connect to another component, rename, duplicate, delete, and change
colour. Right-clicking empty canvas MUST open a separate menu that adds a
component at the pointer position. The menu MUST be operable by keyboard
(the ContextMenu key or Shift+F10 opens it, arrow keys move between items,
Escape closes it and returns focus to the node), MUST expose `role="menu"`
with `role="menuitem"` children, and MUST stay within the viewport.

Rationale: this is an explicit owner requirement carried over from the
approved prototype, and it is the only pointer path to "connect to" that does
not require a precise drag between two 10px handles — which WCAG 2.5.8 target
size makes hostile on a trackpad.

#### Scenario: Right-click on a node opens the node menu, not the canvas menu
- GIVEN a canvas containing at least one node
- WHEN the player right-clicks directly on that node
- THEN the node menu MUST open with that node selected
- AND the empty-canvas "add component" menu MUST NOT open
- AND the node MUST NOT be deleted, moved, or otherwise mutated by the gesture

#### Scenario: Connecting through the context menu
- GIVEN two nodes whose connection is legal
- WHEN the player opens the source node's context menu and chooses "conectar
  con…" and then picks the target
- THEN a connection MUST be created identical to one made by dragging handles

#### Scenario: The menu is fully keyboard operable
- GIVEN a focused node
- WHEN the player presses the ContextMenu key or Shift+F10
- THEN the menu MUST open and focus MUST move to its first item
- AND Escape MUST close it and return focus to the node

### Requirement: Player-assigned node colour
A player MUST be able to assign a colour to any node from a small fixed
palette, the colour MUST persist with the design, and it MUST be purely
presentational: it MUST NOT affect evaluation, legality, or score.
Because §13.9 forbids conveying meaning by colour alone, every node MUST
remain identifiable by its icon and text label regardless of colour, and the
chosen colour MUST be named in the node's accessible description.

Rationale: an explicit owner requirement. Colour lets a player group parts of
a large design by their own reasoning — a personal annotation, not a system
signal.

#### Scenario: Colour changes nothing about the score
- GIVEN a design with a known score
- WHEN the player recolours any node
- THEN the score, the findings, and the legality verdict MUST be unchanged

#### Scenario: Colour never carries meaning alone
- GIVEN a node with a player-assigned colour
- WHEN its accessible name and description are queried
- THEN the type, zone, state, and colour name MUST all be present as text

### Requirement: Canvas chrome must not overlap the site shell
Canvas overlays — status announcements, refusal messages, menus and toolbars —
MUST render inside the playground's own stacking context and MUST NOT cover
the site header, its navigation, or any control outside the playground.

#### Scenario: A refusal message does not cover the site navigation
- GIVEN the player triggers a connection refusal
- WHEN the refusal message is announced
- THEN it MUST be fully readable within the playground area
- AND every site navigation link MUST remain visible and clickable

### Requirement: The playground uses the full viewport width
The playground is a tool, not an article, and MUST NOT be constrained by the
site's prose container. It MUST span the full viewport width minus a small
gutter, and the canvas MUST receive the largest share of the horizontal space —
larger than the component library and larger than the exercise/result panel.
The library and the panel MAY have a maximum width so that surplus space goes
to the canvas rather than stretching sidebars.

Rationale: an explicit owner requirement, stated twice. On a 2000px display the
1200px article container left roughly 800px of dead margin while the canvas —
the actual work surface — was cramped. Space spent on empty gutters is space
taken from the diagram the player is reasoning about.

#### Scenario: No dead margin on a wide display
- GIVEN a viewport 1920px wide or wider
- WHEN the playground is rendered
- THEN the playground MUST occupy the full width minus its gutter
- AND the canvas MUST be wider than the library and wider than the side panel

#### Scenario: Surplus width goes to the canvas
- GIVEN the viewport grows from 1440px to 2560px
- WHEN the layout reflows
- THEN the canvas MUST absorb the majority of the added width
- AND neither the library nor the side panel may grow without bound

### Requirement: Every panel that opens can be closed
Any panel, drawer or overlay the playground opens MUST be dismissible by the
player: a visible close control, the Escape key, and — where it does not
conflict with canvas selection — a click outside. Closing MUST return focus to
the control that opened it, and MUST NOT discard the player's work.

Rationale: the result panel currently slides in from the right and cannot be
closed. On a canvas the player is still reasoning about, a panel that cannot be
dismissed permanently steals horizontal space from the work surface.

#### Scenario: The result panel closes and the score survives
- GIVEN the player has submitted a design and the result panel is open
- WHEN the player activates its close control or presses Escape
- THEN the panel MUST close and focus MUST return to the submit control
- AND reopening it MUST show the same result, not a cleared one

### Requirement: Every component explains itself on hover and on focus
Each entry in the component library, and each node on the canvas, MUST expose a
short explanation available both on pointer hover and on keyboard focus. The
explanation MUST state what the component is, what it is for, and its
operational cost in `opsUnits`. It MUST be exposed to assistive technology via
`aria-describedby`, MUST NOT rely on the `title` attribute, and MUST NOT be the
only way to identify the component.

Rationale: an explicit owner requirement — "qué cosa es un servicio suelto". La
Forja teaches architecture, so it cannot assume the architectural vocabulary it
exists to teach. The library is the first surface where the product teaches, and
an icon plus a bare noun teaches nothing to the level-1 player.

#### Scenario: Hovering a library entry explains it
- GIVEN the component library is visible
- WHEN the player hovers or keyboard-focuses any entry
- THEN an explanation MUST appear stating what it is, what it is for, and its
  operational cost
- AND it MUST be reachable by keyboard alone, without a pointer

#### Scenario: The explanation is not the only identifier
- GIVEN a component whose explanation is not displayed
- WHEN the player looks at it
- THEN its icon and text label MUST still identify it

### Requirement: Plain language everywhere except canonical technical terms
Interface prose — instructions, findings, panel copy, empty states, errors —
MUST be written in plain language a competent developer reads without effort.
Canonical architectural terms MUST be kept exactly (a queue is "cola de
mensajes", not a simplified metaphor), because renaming them would teach the
wrong vocabulary. When such a term first appears to the player, it MUST be
explained once, in place.

Interface prose MUST NOT expose the engine's internal vocabulary — rule ids,
predicate names, axis keys, schema fields — as player-facing copy.

Rationale: an explicit owner requirement, and it matches the brand rule "ninguna
afirmación sin su porqué". The already-approved finding copy is the reference
register: it states a production consequence in ordinary words without
softening the technical noun.

#### Scenario: A finding reads as a consequence, not as a rule id
- GIVEN a finding produced by the engine
- WHEN it is rendered to the player
- THEN it MUST state the consequence in plain language
- AND its internal rule id MUST NOT be the player-facing title

### Requirement: The correction loop never loses its tools
Reading the result MUST NOT hide the component library or the canvas. The loop
is brief → build → submit → read what is wrong → correct, and the correction
step MUST be reachable without navigating away from the finding that motivated
it. The result MAY share the viewport with the canvas, but MUST NOT replace the
workspace.

Rationale: the result currently lives in a tab that hides the library, so the
player must leave the finding to act on it. This is the same defect the
prototype had in another form — there the result fell below the fold, here it
takes the tools away.

#### Scenario: The library stays reachable while a result is shown
- GIVEN the player has submitted a design and is reading the findings
- WHEN they decide to add a component the finding implies is missing
- THEN the component library MUST be usable without dismissing the result
- AND the canvas MUST remain visible so the highlighted nodes stay in context
