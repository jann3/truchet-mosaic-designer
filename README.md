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
