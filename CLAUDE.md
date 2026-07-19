# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

I would structure this as a **progressive editor architecture**, where each phase adds a complete capability while keeping the underlying document model stable. The biggest risk with a tool like this is building UI features before the underlying coordinate system, rendering model, and data structures are correct. Therefore the early phases should focus on the foundation.

The recommended implementation sequence:

# Truchet Mosaic Designer — Implementation Plan

---

# Phase 1 — Application Shell & Responsive UI Framework

## Goal

Create the responsive editor framework before implementing any artwork logic.

The application should establish the overall layout and behaviour across desktop, tablet, and portrait/mobile screens.

## Features

### Responsive editor layout

Implement a CSS Grid-based application shell:

Desktop:

```
+------------------------------------------------+
| Toolbar                                        |
+--------------+-------------------+-------------+
|              |                   |             |
| Layers       | Canvas            | Inspector   |
| Panel        | Area              | Panel       |
|              |                   |             |
+--------------+-------------------+-------------+
```

Portrait:

```
+--------------------+
| Toolbar            |
+--------------------+
|                    |
| Canvas             |
|                    |
+--------------------+
| Layers             |
+--------------------+
| Inspector          |
+--------------------+
```

## Requirements

* Use modern CSS Grid/Flexbox.
* No fixed pixel canvas dimensions.
* Panels should collapse, resize, or stack depending on available space.
* Support:

  * desktop landscape
  * tablet landscape
  * tablet portrait
  * mobile portrait

## Implement

* Application viewport manager.
* Panel containers.
* Toolbar.
* Canvas container.
* Properties panel.
* Responsive breakpoints.

---

# Phase 2 — Document Model & Coordinate System

## Goal

Create the underlying design representation.

Do this before visual features.

The document should be independent of screen size.

## Implement

Document object:

```
Document

Grid
 ├ Columns
 ├ Rows
 └ Tiles

Layers

Selections

Assets

Export Settings
```

Example:

```
Document
{
 columns:8,
 rows:8,
 aspectRatio:1
}
```

## Coordinate system

Everything should use logical coordinates:

```
0.0 → 1.0
```

rather than pixels.

Example:

Image:

```
x:0.25
y:0.40
scale:1.2
```

This ensures:

* resizing works
* aspect ratios work
* exports work
* layouts remain responsive

---

# Phase 3 — Truchet Grid Rendering Engine

## Goal

Render the actual tile grid.

No editing yet.

## Features

Generate:

* square grid
* diagonal triangles
* configurable rows
* configurable columns

Initial default:

```
8 × 8
```

Each tile:

```
Tile

Orientation
 |
 +-- Triangle A
 +-- Triangle B
```

## Rendering requirements

The renderer must:

* scale automatically
* maintain aspect ratio
* resize with viewport
* support high resolution rendering

Recommended rendering approach:

* SVG for vector rendering
* Canvas only for final raster export

---

# Phase 4 — Grid Configuration Controls

## Goal

Allow users to configure the basic Truchet structure.

## UI

Configuration panel:

```
Grid

Columns
[8]

Rows
[8]

Pattern

○ Uniform

○ Alternate Rows

○ Alternate Counter-Clockwise

○ Random

[Generate]
```

## Implement pattern generators

### Uniform

All tiles same orientation.

### Alternate Rows

Rows alternate:

```
\\\\\\
//////
\\\\\\
```

### Alternate Counter-Clockwise

Checker rotation:

```
\/\/
/\/\
\/\/
```

### Random

Random orientation per tile.

Include:

* random seed
* regenerate button

---

# Phase 5 — Grid Editing UX

## Goal

Allow users to manually modify tiles.

## Features

Basic editing:

* click tile → flip orientation
* drag painting
* shift-click
* undo/redo

Selection highlighting:

* hovered triangle
* selected triangle
* active layer triangles

## Implement

Selection engine:

```
Selection

Triangle IDs[]
```

Support:

* individual triangle selection
* multiple selection
* clear selection

---

# Phase 6 — Selection System

## Goal

Create reusable selections independent from layers.

This is a major architectural milestone.

## Features

Selection panel:

```
Selections

✓ Black Triangles

✓ White Triangles

✓ Portrait Area

✓ Custom Selection
```

Selections can be:

* created
* renamed
* edited
* duplicated
* deleted

## Selection tools

Implement:

* select triangle
* select colour
* select orientation
* select row
* select column
* invert selection
* select all

---

# Phase 7 — Layer System

## Goal

Introduce non-destructive composition.

Layers become the main design mechanism.

## Layer structure

Each layer contains:

```
Layer

Name

Visibility

Opacity

Blend Mode

Selection Reference

Fill
```

Example:

```
Obama Portrait

Selection:
Black Triangles

Fill:
Image

Blend:
Normal

Opacity:
100%
```

## Layer types

Initial:

* Solid colour
* Gradient
* Image

Future:

* Pattern
* Noise
* Procedural
* Adjustment layers

---

# Phase 8 — Image Mask System

## Goal

Allow images to fill triangle selections.

This is the core creative feature.

## Implement image layers

Image properties:

```
Image

Position
X
Y

Scale

Rotation

Crop

Opacity
```

## Image interaction

When selected:

* drag image
* resize image
* rotate image
* reposition image

## Mask behaviour

The image exists independently.

Triangles reveal the image.

Example:

```
Obama Image

        ↓

Black Triangle Selection

        ↓

Rendered Mosaic
```

Changing the grid does not destroy the image placement.

---

# Phase 9 — Advanced Composition Tools

## Goal

Add professional editing features.

## Features

### Blend modes

Implement:

* Normal
* Multiply
* Screen
* Overlay
* Difference
* Darken
* Lighten

---

### Layer ordering

Support:

* reorder
* duplicate
* group
* rename

---

### Transform controls

For layers:

* move
* scale
* rotate
* align

---

### Symmetry tools

Optional but valuable:

* horizontal mirror
* vertical mirror
* rotational symmetry

---

# Phase 10 — Responsive Design Adaptation

## Goal

Handle changing canvas dimensions elegantly.

This phase specifically addresses:

```
8×8

becoming

4×12
```

## Features

Grid resizing:

* increase columns
* decrease columns
* increase rows
* decrease rows

Preserve:

* layers
* images
* selections
* transforms

Implement rules for:

* adding tiles
* removing tiles
* remapping selections

---

# Phase 11 — Export System

## Goal

Export completed designs.

## Vector export

Available when:

* no image layers
* no unsupported effects

Formats:

* SVG

---

## Raster export

Always available.

Formats:

* PNG
* JPG
* WebP

Controls:

```
Export

Resolution

1000px
2000px
4000px

Transparent Background

Include Grid Lines
```

---

# Phase 12 — Save / Load / Project Files

## Goal

Allow users to save editable designs.

Implement:

Project format:

```
.truchet
```

Containing:

* document settings
* grid
* layers
* selections
* image assets
* transforms

Features:

* new project
* save
* load
* autosave

---

# Phase 13 — Accessibility & Quality Improvements

## Goal

Make the editor usable by a broad audience.

## Implement

Keyboard controls:

* arrows
* delete
* undo
* redo
* shortcuts

ARIA:

* labelled controls
* layer descriptions
* selection summaries

Visual accessibility:

* avoid colour-only indicators
* high contrast mode
* scalable UI

---

# Phase 14 — Advanced Creative Features (Optional)

Possible future additions:

## Procedural generators

* noise-based patterns
* radial patterns
* spiral patterns
* symmetry generators

## Image analysis

Automatically generate:

* triangle selections from image brightness
* colour mapping
* edge detection

## AI-assisted generation

Examples:

"Create a Truchet portrait using two images"

"Generate a cyberpunk colour palette"

---

## Recommended milestone checkpoints

### Milestone 1 — Basic Designer

After Phase 5:

* responsive UI
* editable Truchet grid
* pattern generation

### Milestone 2 — Creative Tool

After Phase 8:

* layers
* images
* masks
* composition

### Milestone 3 — Professional Editor

After Phase 12:

* export
* save/load
* advanced transforms

---

The key architectural decision is that **the grid should never own the artwork**. The grid is a geometric mask system. Layers own appearance. Selections define relationships. Images and effects exist independently in document space.

If that principle is followed from Phase 2 onwards, the later features (image mosaics, resizing, responsive layouts, exporting) become much simpler rather than requiring rewrites.
