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
