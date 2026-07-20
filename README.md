# Truchet Mosaic Designer

A browser-based editor for designing Truchet tile mosaics — grids of tiles whose orientation
creates flowing, maze-like patterns. The long-term goal is a full creative tool: configurable
grids, manual tile editing, reusable selections, non-destructive layers, and image masking so a
photo can be revealed through a mosaic of triangles.

The project follows a phased implementation plan (see [`CLAUDE.md`](./CLAUDE.md) for the full
spec). The core architectural principle carried through every phase: **the grid never owns the
artwork** — it's a geometric mask. Layers own appearance, selections define relationships, and
images/effects live independently in document space. Each phase adds a complete, working
capability on top of a stable document model, rather than bolting UI onto artwork logic before
the underlying data structures are correct.

## Tech stack

Vanilla TypeScript + Vite, no framework. Builds to static files, deployable as-is (e.g. to
Netlify — see `netlify.toml`).

## Getting started

```bash
npm install
npm run dev       # start dev server
npm run build     # type-check and build to dist/
npm run preview   # preview the production build
```

## Implementation progress

### Phase 1 — Application Shell & Responsive UI Framework ✅

Established the responsive editor chrome before any artwork logic exists. A `ViewportManager`
classifies the viewport into one of four breakpoints (desktop landscape, tablet landscape, tablet
portrait, mobile portrait) via `matchMedia` and stamps it onto `<html data-breakpoint>`. CSS Grid
uses that attribute to switch between a three-column layout (Layers | Canvas | Inspector) on
landscape breakpoints and a stacked layout (Toolbar → Canvas → Layers → Inspector) on portrait
ones — no fixed pixel dimensions anywhere. The Layers and Inspector panels are drag-and-keyboard
resizable and can be collapsed via toolbar toggle buttons. The canvas area, toolbar, and both side
panels are currently placeholders awaiting the document model (Phase 2) and rendering engine
(Phase 3).

### Phase 2 — Document Model & Coordinate System ✅

Added the design representation the rest of the app will read and write through, kept entirely
independent of screen size (`src/document/`). A `TruchetDocument` holds a `Grid` (columns, rows,
and a flat `Tile[]` with row/column/orientation), plus empty `layers`, `selections`, and `assets`
arrays and default `exportSettings`, all produced by `createDocument()`/`createGrid()`. Tile and
image positions are expressed in normalized `0.0–1.0` coordinates rather than pixels
(`coordinates.ts`: `normalizedToPixel`, `pixelToNormalized`, `getTileBounds`), so the model stays
valid across any canvas size or aspect ratio. A small `DocumentStore` holds the active document in
memory with a `subscribe`/`update` API, ready for the rendering engine (Phase 3) and editing UX
(Phase 5) to consume — it isn't wired into the UI yet since there's nothing to render or edit
until those phases land.

### Phase 3 — Truchet Grid Rendering Engine ✅

The canvas area now renders the document's grid, read live from a `DocumentStore` instantiated in
`main.ts` (`src/render/`). Each tile is two triangles split along its orientation's diagonal
(`tileGeometry.ts`), drawn as SVG `<polygon>`s by `TruchetRenderer`, which subscribes to the store
and re-renders whenever the document changes. The SVG's `viewBox` tracks the grid's column/row
count directly — no pixel math or resize listeners — so it scales automatically with its
container, stays vector-sharp at any resolution, and letterboxes via `preserveAspectRatio` to keep
tiles square regardless of the canvas area's shape. No editing yet; that's Phase 5. Canvas rasterization
for final export is deferred to Phase 11, per `CLAUDE.md`'s "SVG for vector rendering, Canvas only
for final raster export."

### Phase 4 — Grid Configuration Controls ✅

The Inspector panel now hosts a live grid setup form (`src/ui/GridConfigPanel.ts`): columns, rows,
and a choice of four pattern generators (`src/document/patternGenerators.ts`) — Uniform, Alternate
Rows, Alternate Counter-Clockwise, and Random, the last with a seed field and a randomize button so
results are reproducible on demand. Random uses a small seeded PRNG (mulberry32) rather than
`Math.random()` directly, so the same seed always regenerates the same layout. Hitting Generate
replaces only `document.grid` via `DocumentStore.update`, leaving the rest of the document
untouched; the renderer picks up the change immediately through its existing subscription from
Phase 3, with no changes needed there.

### Phase 5 — Grid Editing UX ✅

The canvas is now directly editable (`src/edit/`). `GridEditingController` listens for pointer and
keyboard events on the renderer's SVG: a plain click flips the clicked tile's orientation and
selects its triangle; dragging paints a run of tiles to the orientation the drag started with (so
retracing over an already-painted tile is a no-op, not a re-flip); shift-click toggles a triangle
into/out of a multi-selection without touching orientation; Escape clears the selection. Hover and
selection are tracked by a small `SelectionEngine` at triangle granularity (`tileId:a`/`tileId:b`),
kept separate from the document — it's ephemeral interaction state, not the reusable named
`Selection`s planned for Phase 6. `TruchetRenderer` mirrors that state onto the affected SVG
polygons directly (`src/styles/canvas.css`'s `--hover`/`--selected` classes) rather than
re-rendering the grid on every hover change.

Undo/redo is a generic `HistoryManager` wrapping `DocumentStore` snapshots, not tile-specific:
callers call `history.record()` immediately before whichever `store.update()` call(s) they want
undoable, so a whole paint drag (many tile updates) or a grid regeneration (the Phase 4 Generate
button, now wired through history too) each undo as a single step. Wired to toolbar Undo/Redo
buttons (enabled state follows `canUndo`/`canRedo`) and to Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z / Ctrl+Y,
guarded to skip while a text input has focus.

### Phase 6 — Selection System ✅

Named, reusable selections now live on the document (`TruchetDocument.selections`, each a
`{ id, name, triangleIds }`) — distinct from Phase 5's ephemeral `SelectionEngine`, which still
drives hover/click highlighting but no longer owns anything persistent. A new Inspector section
(`src/ui/SelectionsPanel.ts`) lists them with create/rename (inline, click the pencil)/duplicate/
delete, plus a set of one-shot tools (`src/document/selectionOperations.ts`) that replace the active
selection's contents: Select All, Invert, Select Colour (the 'a'/'b' half — always dark/light
regardless of tile orientation), Select Orientation (both triangles of every matching tile), and
Select Row/Column.

The canvas itself gained a second interaction mode. A new Edit/Select toggle in the toolbar
(`EditorModeStore`) switches `GridEditingController` between Phase 5's flip/paint behaviour and a
select mode where click/drag instead toggles triangles into or out of the active selection
(`ActiveSelectionStore` tracks which one) — no shift key needed, since every gesture in this mode is
already a selection edit. Activating a selection from the panel (or hitting "+ New") auto-switches
to select mode so it's immediately editable. A small binder in `CanvasArea.ts` keeps
`SelectionEngine`'s highlighted set mirroring the active selection's `triangleIds` while in select
mode, so the existing Phase 5 highlight-diffing in `TruchetRenderer` renders it with no renderer
changes needed. All of it goes through the same `HistoryManager` as tile edits, so selection edits
undo/redo alongside grid edits.

### Phase 7 — Layer System ✅

Layers are now the main design mechanism, composited on top of the base black/white grid rather
than replacing it — the grid stays a geometric mask, per `CLAUDE.md`'s core architectural
principle. Each `Layer` (`document/layersCrud.ts`) holds a name, visibility, opacity, blend mode, a
reference to one of Phase 6's named `Selection`s, and a fill: solid colour, linear gradient, or
image. The Layers panel (`src/ui/LayersPanel.ts`, replacing its Phase 1 placeholder) lists layers
topmost-first with inline controls for all of it, including an image file picker that reads the
upload as a data URL and stores it as an `Asset` (`document/assetsCrud.ts`) — there's no
backend, so assets live in the document itself. Continuous controls (opacity, colour pickers,
gradient angle, image transform) commit to the document (and undo history) on `change`, not
`input`, since the panel fully re-renders on every document change and rebuilding a control
mid-drag would drop its focus.

`TruchetRenderer` gained a layer-compositing pass (`src/render/`): each visible layer gets an SVG
`<g>` carrying its opacity and CSS `mix-blend-mode`, filled per its fill type — solid polygons,
a single grid-spanning `<linearGradient>` (`render/gradient.ts` ports CSS's angle-to-line geometry
so the gradient reads as one continuous sweep across the layer's triangles, not one per triangle),
or an `<image>` clipped to the selection's triangle shapes. This paints strictly on top of the
Phase 3 base triangles, in a `pointer-events: none` group, so Phase 5/6 grid editing and selection
gestures keep landing on the base grid underneath exactly as before — a layer's artwork never
intercepts a click meant for the tile beneath it. Image position/scale/rotation are plain numeric
fields for now; drag/resize/rotate handles on the canvas are Phase 8.

Deleting a `Selection` that a layer references clears that layer's reference back to `null`
(`selectionsCrud.ts`) rather than leaving it dangling, so a referencing layer just stops rendering
instead of erroring.

### Phase 8 — Image Mask System ✅

Image fills gained a `crop` rectangle (`document/types.ts`'s `NormalizedRect`) — a sub-region of
the source asset, normalized 0.0–1.0, defaulting to the full image — plus interactive on-canvas
move/resize/rotate handles, replacing Phase 7's numeric-fields-only workflow (the fields are still
there for precise entry; the handles are additive). `render/imageFillGeometry.ts` computes the
image's display rect, its crop-adjusted source placement, and center point from
`{position, scale, rotation, crop}` — the single source of truth both `TruchetRenderer` (rendering)
and the new `ImageOverlayController` (handles) read from, so the two can never disagree about where
the image actually is.

Rendering an image fill is now three nested clip groups: an outer group clipped to the selection's
triangle polygons (the mask — fixed to the grid, unaffected by the image's own transform), a
rotation group turning the image and its crop together around the display rect's center, and an
inner group clipped to the crop rectangle in the image's local space. The oversized, unclipped
`<image>` element sits inside all three, positioned so its crop sub-rect lines up exactly with the
visible display rect.

Selecting a layer (click its row in the Layers panel — a new `SelectedLayerStore`, alongside Phase
6's `EditorModeStore`/`ActiveSelectionStore`) draws move/resize/rotate handles over it on the
canvas when its fill is an image, via `ImageOverlayController` (`src/edit/`). Handle drags follow
the same pattern as Phase 5's `GridEditingController` paint-drag: `history.record()` once on
pointerdown, then `store.update()` on every pointermove, so a whole drag gesture undoes as a single
step. Handle size and the rotate handle's offset from the image are computed in screen pixels each
render (via the SVG's `getScreenCTM()`) rather than fixed grid units — grid-unit-to-pixel ratio
varies hugely with grid size, so a fixed-unit offset put the rotate handle off-screen for small
grids reaching the canvas edge. The move handle is the display rect itself; it needed
`pointer-events: all` rather than `auto`; since the rect has `fill: none`, `auto` (≈
`visiblePainted`) only hit-tests the stroke outline, not the interior, which was letting drags fall
through to the grid underneath.

### Phase 9 — Advanced Composition Tools ✅

Blend modes were already complete as of Phase 7 (`BlendMode` in `document/types.ts`: Normal,
Multiply, Screen, Overlay, Difference, Darken, Lighten — driven straight through to CSS
`mix-blend-mode`), so this phase's new work was layer ordering, transform alignment, and grid
symmetry tools.

**Layer ordering.** `layersCrud.ts` gained `moveLayer` (swaps a layer with its array neighbour —
"up"/"down" in the panel's topmost-first display maps to higher/lower array index, since later
array entries paint on top) and `duplicateLayer` (clones with a new id, inserted directly above the
original). The Layers panel exposes both as ↑/↓/⧉ buttons per row, disabled at the top/bottom of
the stack, each wrapped in `history.record()` like every other document mutation.

**Grouping** (`document/groupsCrud.ts`, `LayerGroup` in `types.ts`) is deliberately a tag, not a
tree: a `Layer.groupId` references a `LayerGroup` holding its own name/visible/opacity/collapsed —
grouping never reorders `document.layers`, so it can't disturb paint order. The Layers panel adds a
checkbox per layer (ephemeral `groupCandidates` UI state, not part of the document) and a header
"Group" button that tags every checked layer with a new group; `renderList` then clusters a group's
members into one collapsible block wherever its topmost member falls in the topmost-first list,
even if the members aren't contiguous in `document.layers`. `TruchetRenderer` folds group state into
each member's effective visibility/opacity at render time (`layer.visible && group.visible`,
`layer.opacity * group.opacity`) rather than wrapping members in their own SVG group, keeping the
existing per-layer compositing pass unchanged.

**Transform / align.** Image layers already had move/scale/rotate from Phase 8; this phase adds six
align buttons (left/center/right, top/center/bottom) to the image fill controls, computed from
`computeImageFillGeometry` — the same geometry helper the renderer and drag handles use — so "align
left" reads the image's current display width and solves for the `position.x` that puts its edge at
the grid boundary, rather than guessing at a fixed offset.

**Symmetry tools** (`document/symmetryOperations.ts`) are one-shot grid operations in the same style
as Phase 4's pattern generators: `mirrorHorizontal`, `mirrorVertical`, and `rotate180` rebuild
`document.grid.tiles`, keeping each tile's id pinned to its own (row, column) but pulling its
orientation from the mirrored/rotated source position. Mirroring swaps `diagonal-a`/`diagonal-b`
(a TL→BR diagonal reflects into a TR→BL one) while 180° rotation leaves orientation untouched (a
diagonal maps onto itself under a half-turn) — both are pure functions of the grid, wired into the
Inspector's Grid panel next to Generate and going through the same `history.record()` +
`store.update()` as every other grid-replacing action, so they undo as a single step.

### Phase 10 — Responsive Design Adaptation ✅

Grid resizing (`document/gridResize.ts`, `resizeGrid`) changes the tile count in place rather than
replacing the grid wholesale — the important distinction from Phase 4's "Generate", which already
covered "put a brand-new pattern at size N×M" but always discarded whatever was there before. Since
tile ids are deterministic (`r{row}c{column}`, from `createTile`), resizing is just a position
lookup: for every (row, column) inside the new bounds, reuse the existing tile (id and orientation
both preserved) if one was there, otherwise create a fresh default-orientation tile; any tile outside
the new bounds is dropped. Reusing the same id — not just the same orientation — matters because
selections reference triangles by id (`${tileId}:a`/`${tileId}:b`), so a surviving tile keeps every
selection membership it had, with zero remapping needed.

For tiles that fall outside the shrunk grid, `resizeGrid` also prunes any selection's `triangleIds`
that pointed at them — otherwise a selection would keep dangling references to triangles that no
longer exist. Layers and image assets aren't touched at all: layers reference a selection by id, not
tiles directly, so a layer whose selection just lost some triangles keeps painting normally over
whatever remains, and image fills store position/scale/rotation/crop as grid-independent normalized
values, so they carry over unchanged (visually, an image may now cover more or less of the grid if
the aspect ratio changed, but nothing about the transform itself is reset or distorted).

The Inspector's Grid panel gained a second button, "Resize", next to "Generate" — both read the same
Columns/Rows fields, but "Generate" replaces the grid with a new pattern (destructive) while "Resize"
calls `resizeGrid` (preserves layers, selections, and images). Verified in-browser: built an 8×8
alternate-rows grid, selected three triangles (two interior, one in the last row/column) and painted
them via a solid-fill layer, then resized down to 5×5 — the out-of-bounds triangle was pruned from
the selection (3 → 2) while the other two and the layer survived untouched, and every surviving
tile's orientation matched exactly what it was before the resize (checked via the rendered SVG
polygon points, not just visually). Growing back up to 8×9 confirmed the reverse: original tiles keep
their exact orientation, new rows/columns fill in with the default orientation, and the preserved
selection/layer kept painting the same two triangles.

### Phase 11 — Export System ✅

Exporting reuses the live renderer's compositing logic rather than re-implementing it: Phase 7/8's
layer-painting code (gradients, image clips, blend modes) was pulled out of `TruchetRenderer` into a
standalone `render/svgLayers.ts` (`renderDocumentLayers`), which both the live, subscribed canvas and
the new export path now call — so a layer can never render one way on screen and another way in an
export. `render/exportSvg.ts` (`buildExportSvg`) builds on top of that: a self-contained `<svg>`
independent of any live DOM or app stylesheet, since a downloaded file can't reference
`variables.css`. It reads the app's current `--color-text`/`--color-surface` theme values straight off
`document.documentElement` via `getComputedStyle` rather than hardcoding a second copy of those hex
values, so the export always matches whatever the editor is actually showing. Per `CLAUDE.md`'s "grid
never owns the artwork" principle and Phase 7's design, the base black/white grid is always part of
the exported artwork, not just an editing aid — layers composite on top of it exactly as they do
on-screen.

Two export-only options apply on top of that base render: `transparentBackground` omits each tile's
"surface" (light) triangle instead of painting it white, so the "ink" (dark) triangles and any layer
content sit on alpha instead of a white backing; `includeGridLines` overlays a thin semi-transparent
stroke around every tile square as a design reference, layered on top of everything else so it's
never hidden by an opaque layer.

`export/exportDocument.ts` turns that SVG into a download. Vector export (`exportVectorSvg`) just
serializes it. Raster export (`exportRaster`) resizes the SVG's `width`/`height` to the chosen
resolution (the longer of columns/rows maps to the resolution value, the other scales to match, so
non-square grids export without distortion), loads it into an off-screen `Image` via a blob URL,
draws that onto a canvas, and reads back a PNG/JPEG/WebP blob via `canvas.toBlob`. Since asset images
are already stored as data URLs (Phase 7), there's no CORS taint risk in reading the canvas back.
JPEG has no alpha channel, so `exportRaster` unconditionally forces `transparentBackground` off for
that format rather than trusting the caller, so a stale/pre-existing setting can never silently
produce a black-background JPEG. `canExportVector` gates SVG availability on there being no
image-fill layer in the document — an image fill is inherently raster content, so it can't be
represented in a vector export.

The Export dialog (`ui/ExportDialog.ts`, opened via a new toolbar button) is a modal with a Format
select, a Resolution radio group (1000/2000/4000px, hidden for SVG since vector output is
resolution-independent), and the two checkboxes above (Transparent background disables itself for
JPG). Its settings persist onto `TruchetDocument.exportSettings` (already defined in `types.ts`, so
this is forward-compatible with Phase 12 save/load) on every change — but deliberately without
`history.record()`, unlike every other document mutation in the app: picking an export format isn't a
creative edit, so it shouldn't be a step in the undo stack. One re-entrancy pitfall surfaced while
writing the dialog: its `render()` initially tried to auto-correct a stale `format: 'svg'` (e.g. left
over from before an image layer was added) by calling `store.update()` from inside the same render
pass, which — since `DocumentStore.notify()` calls listeners synchronously and `render` is itself a
listener — recursed back into `render()` before the outer call had appended its own DOM, producing a
duplicated dialog body. Fixed by never writing that correction to the store at all: an `effectiveFormat()`
helper computes the display/export fallback locally, so `svg` only ever reaches the document if the
user actually picks it while it's valid.

Verified in-browser: built an 8×8 grid, painted two triangles red via a selection-backed layer, then
exported PNG at 1000px with grid lines and transparent background both on — confirmed the downloaded
file is exactly 1000×1000, decoded its raw pixels and found the layer's red triangle opaque, the
untouched "ink" triangles opaque at the exact `--color-text` value, the untouched "surface" triangles
fully transparent (alpha 0), and a semi-transparent grey pixel at every tile boundary from the grid
line overlay. Switched to SVG format (resolution control correctly disappears) and exported: the
downloaded file is a valid standalone `<svg>` with all 64 base triangles, the two red layer
polygons, and the grid-line `<rect>` overlay, openable with no external dependencies. Switched to JPG
and confirmed "Transparent background" auto-unchecks and disables; exported successfully with no
console errors across all three raster formats plus SVG.

### Phase 12 — Save / Load / Project Files ✅

The `.truchet` project format is just the `TruchetDocument` itself, wrapped with a format version:
`{ version, document }` (`project/serialization.ts`). No separate save schema was needed — every
document field, including image assets (already data URLs since Phase 7) and per-layer transforms
(position/scale/rotation, already part of `LayerFill`), round-trips as plain JSON with no extra
encoding step. `deserializeDocument` validates the parsed shape (required fields present, arrays
where arrays are expected, version not newer than this app supports) before handing it to the
store, so a corrupt or foreign file fails with a message instead of crashing the editor.
`project/projectFile.ts` turns that into a real file: `downloadProjectFile` triggers a
`.truchet` download the same way Phase 11's exports do, and `readProjectFile` reads a picked
`File` back into a document.

`project/ProjectController.ts` is the non-UI controller (parallel to `DocumentStore` and
`HistoryManager`) that owns New/Save/Open and unsaved-changes tracking. It subscribes to the
`DocumentStore` directly: *any* store update — not just project-menu actions — marks the project
dirty, since a grid edit, layer change, or selection tweak is exactly the kind of change a user
doesn't want to lose. Loading a new document resets `HistoryManager`'s undo/redo stacks (a new
`reset()` method) so a freshly opened project can't be undone back into the document it replaced.

Autosave is unconditional and debounced: every document change schedules a write of the current
document to `localStorage` a second later (coalescing rapid edits, e.g. a paint drag, into one
write), independent of whether the user has ever explicitly saved. On startup,
`ProjectController` checks for a leftover autosave entry and exposes it as `pendingRecovery`;
`AppShell` offers to restore it via a confirm dialog before the user does anything else. Restoring
loads that document and marks it dirty (it was never an explicit save, just a safety net);
discarding clears the `localStorage` entry so the prompt doesn't reappear on the next reload. An
explicit Save or successful Open also clears the pending-recovery entry and, for Save, the
`localStorage` copy — a `.truchet` file (or the just-loaded document) is now the safety net, so the
in-progress autosave from before that point is no longer relevant. `localStorage.setItem` is
wrapped in a try/catch so a full quota or private-browsing restrictions degrade autosave silently
rather than breaking the app.

New UI: `ui/ConfirmDialog.ts` is a small reusable modal (`confirm({ title, message, confirmLabel,
cancelLabel })` returning a `Promise<boolean>`) built the same backdrop-modal way as
`ExportDialog`, deliberately avoiding `window.confirm`/`alert` so behavior stays consistent and
scriptable. Passing `cancelLabel: null` hides the Cancel button, turning it into a plain
acknowledgement dialog — used for the "could not open project" error case. The toolbar gained a
New/Save/Open button group (Open uses a hidden `<input type="file" accept=".truchet">`) and a
project-status label showing the document name with a trailing "•" while dirty. New and Open both
route through the same confirm dialog when the document is dirty ("This discards your unsaved
changes") before proceeding.

Verified in-browser: flipped a tile, confirmed the toolbar label switched to "Untitled Mosaic •";
waited for the autosave debounce and found the entry in `localStorage`; reloaded the page and got
the "Restore autosaved project?" prompt, confirmed Restore reproduced the exact flipped tile;
clicked Save and inspected the downloaded `.truchet` file directly — valid JSON, `version: 1`, 64
tiles, the flipped tile's `orientation: "diagonal-b"` intact — and confirmed the dirty dot cleared.
Clicked New with a clean document (no prompt, as expected) and loaded a project file via a
programmatically-populated file input, confirming the document name and tile orientations restored
correctly. Made an edit, then triggered Open again: the "discards your unsaved changes" prompt
appeared with the target filename in the message; confirmed both Cancel (aborts, edit preserved)
and loading a deliberately malformed file (shows a "Could not open project" alert with the parse
error, and — since the failure happens before the store is touched — leaves the current document
completely unchanged). No console errors in any of these flows.

### Phase 13 — Accessibility & Quality Improvements ✅

**Keyboard grid editing.** Before this phase the Truchet grid itself was pointer-only. Every
triangle `<polygon>` is now `role="button"` with a roving `tabindex` — `GridEditingController`
keeps exactly one triangle tab-reachable at a time and moves it with the arrow keys (a per-triangle
tab stop would make the grid impossible to tab past). Enter/Space mirrors a click (flip the tile in
edit mode, toggle it in the active selection in select mode, or — with Shift, in edit mode — toggle
it into the ephemeral multi-selection, mirroring shift-click). Delete/Backspace gives keyboard users
a deterministic action Enter's toggle can't: reset the tile to its default orientation (edit mode),
or explicitly exclude the triangle from the active selection (select mode) rather than flip it.

Getting DOM focus to survive an edit took two fixes. First, SVG shapes aren't in the browser's
default click-focusable set, so `handlePointerDown` calls `event.preventDefault()` before its own
`.focus()` call — without it, the browser's own post-dispatch focus handling clobbers our focus
back to `<body>`. Second, both `TruchetRenderer` and `LayersPanel` fully rebuild their DOM
(`replaceChildren()`) on every relevant change, which destroys whatever was focused; every
grid/layer interaction that mutates the document re-finds and re-focuses the corresponding element
(by tile id, or a `data-layer-id` attribute added to layer rows) immediately afterward, so keyboard
navigation doesn't get dropped back to `<body>` mid-flow. `GridEditingController` also reapplies the
roving tabindex on *every* document change via its own `store.subscribe` (registered after
`TruchetRenderer`'s, so it runs against the already-rebuilt DOM) — otherwise a mouse-driven edit
would silently leave the grid with no tab stop at all.

**Global shortcuts.** `edit/GlobalShortcuts.ts` wires Ctrl/Cmd+S (save), Ctrl/Cmd+O (open),
Ctrl/Cmd+N (new), and `?` (shortcuts help) at the window level — deliberately by simulating clicks
on the existing toolbar buttons rather than duplicating their logic, so e.g. Ctrl+N still goes
through the toolbar's own dirty-document confirmation flow. `?` is guarded by the existing
typing-target check (extracted to `utils/isTypingTarget.ts`, now shared with
`GridEditingController`'s undo/redo/Escape handler) so it doesn't fire while renaming a layer to
something ending in "?". `ui/ShortcutsDialog.ts` is a static reference modal (same backdrop-modal
pattern as `ExportDialog`/`ConfirmDialog`) listing every shortcut in the app, opened from the
toolbar's "?" button or the key itself.

**ARIA.** Every triangle gets an `aria-label` ("Row 3, column 7, black triangle") and `aria-pressed`
kept in sync with the selected-triangle highlight; the grid `<svg>` gets a dimension-describing
`aria-label` and `aria-describedby` pointing at a visually-hidden instructions paragraph
(`CanvasArea.ts`). `SelectionsPanel` gained a visually-hidden `aria-live="polite"` region announcing
the active selection's triangle count on every change — appended once and never torn down by the
panel's own re-renders, since removing and re-inserting a live region can make some screen readers
stop treating it as live. Layer rows (`LayersPanel.ts`) were previously a `<div>` with only a click
handler — not reachable by keyboard at all; they're now `role="button"` with `tabIndex`, a
descriptive `aria-label`, and `aria-pressed`. Every range/select/color/file input across
`LayersPanel.ts` (opacity, blend mode, selection, fill type, colours) now has a properly associated
`<label for>`; the handful of fields where one heading labels two adjacent inputs at once (gradient
colours, image position/scale/rotation/crop) use a plain `<span>` heading plus a per-input
`aria-label` instead, since `for` can't target two inputs.

**Visual accessibility.** Toggle buttons (`aria-pressed="true"`) now carry bold weight and an
underline in addition to the accent background, and the active layer/selection list item bolds its
name — neither state relies on colour alone. `styles/a11y.css` adds a `.visually-hidden` utility, an
app-wide `:focus-visible` outline, and a **high-contrast mode**: a toolbar toggle (persisted to
`localStorage`, `ui/preferences.ts`) sets `data-theme="high-contrast"` on `<html>`, remapping the
theme's CSS variables to a pure black/white/yellow palette; a `prefers-contrast: more` media query
applies the same palette automatically until the user makes an explicit choice. The grid's own
focus ring couldn't reuse the generic `outline` rule — the SVG viewBox is in tile units (often under
a dozen across), not CSS pixels, so a `2px` outline would render several tiles wide — so focused
triangles instead get a dashed `stroke` sized in the same fractional units as the existing
hover/selected highlights, keeping it visually distinct from the (solid) selected-triangle stroke.

Verified in-browser: tabbed/arrow-keyed across the grid and confirmed the dashed focus ring tracked
correctly, including immediately after an Enter-triggered flip (DOM rebuild) restored focus to the
same triangle rather than dropping to `<body>`; toggled a triangle into a selection with Enter and
watched the live region announce the updated count, then excluded it again with Delete; focused a
layer row directly, toggled it selected with Enter and confirmed focus survived the panel's
re-render, then deleted it with Delete; opened the shortcuts dialog with `?` and closed it with
Escape; toggled high-contrast mode and confirmed the palette swap and `localStorage` persistence
across reload. No console errors in any of these flows.
