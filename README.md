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
