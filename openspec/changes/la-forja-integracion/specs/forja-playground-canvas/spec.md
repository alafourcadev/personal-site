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
