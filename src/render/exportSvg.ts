import type { TruchetDocument } from '../document/types';
import { getTileTriangles, type Point } from './tileGeometry';
import { renderDocumentLayers } from './svgLayers';

const SVG_NS = 'http://www.w3.org/2000/svg';

const GRID_LINE_COLOR = 'rgba(128, 128, 128, 0.55)';
const GRID_LINE_WIDTH = 0.015;
const SEAM_STROKE_WIDTH = 0.02;

export interface ExportRenderOptions {
  transparentBackground: boolean;
  includeGridLines: boolean;
}

function pointsToString(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

/**
 * Reads the app's live "ink"/"surface" theme colours straight off the
 * document root, rather than hardcoding the `variables.css` hex values here —
 * a standalone exported file can't reference the app's stylesheet, but the
 * colours it bakes in should still track whatever the editor is actually
 * showing (including any future theming) rather than a second, driftable copy.
 */
function readBaseColors(): { ink: string; surface: string } {
  const styles = getComputedStyle(document.documentElement);
  return {
    ink: styles.getPropertyValue('--color-text').trim() || '#1c1e21',
    surface: styles.getPropertyValue('--color-surface').trim() || '#ffffff',
  };
}

/**
 * Builds a standalone SVG element for `doc` — independent of any live,
 * subscribed renderer or app stylesheet, so it's safe to serialize as a
 * downloadable .svg or rasterize to a canvas. Mirrors `TruchetRenderer`'s
 * base-grid-plus-layers compositing (the base grid is always part of the
 * artwork, never something layers replace — see `CLAUDE.md`), plus two
 * export-only options: `transparentBackground` drops the "surface" half of
 * each tile instead of painting it white, and `includeGridLines` overlays a
 * thin per-tile outline as a design reference.
 */
export function buildExportSvg(doc: TruchetDocument, options: ExportRenderOptions): SVGSVGElement {
  const { ink, surface } = readBaseColors();

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', `0 0 ${doc.grid.columns} ${doc.grid.rows}`);
  svg.setAttribute('width', String(doc.grid.columns));
  svg.setAttribute('height', String(doc.grid.rows));

  const defs = document.createElementNS(SVG_NS, 'defs');
  svg.appendChild(defs);

  const baseGroup = document.createElementNS(SVG_NS, 'g');
  for (const tile of doc.grid.tiles) {
    const { a, b } = getTileTriangles(tile);
    baseGroup.appendChild(createFilledTriangle(a.points, ink));
    if (!options.transparentBackground) {
      baseGroup.appendChild(createFilledTriangle(b.points, surface));
    }
  }
  svg.appendChild(baseGroup);

  const layersGroup = document.createElementNS(SVG_NS, 'g');
  renderDocumentLayers(layersGroup, defs, doc);
  svg.appendChild(layersGroup);

  if (options.includeGridLines) {
    svg.appendChild(createGridLines(doc.grid.columns, doc.grid.rows));
  }

  return svg;
}

function createFilledTriangle(points: readonly Point[], color: string): SVGPolygonElement {
  const polygon = document.createElementNS(SVG_NS, 'polygon');
  polygon.setAttribute('points', pointsToString(points));
  polygon.setAttribute('fill', color);
  // Stroking each triangle in its own fill colour closes the hairline seam
  // antialiasing would otherwise leave between adjacent triangles/tiles —
  // invisible by design, unrelated to the visible `includeGridLines` overlay.
  polygon.setAttribute('stroke', color);
  polygon.setAttribute('stroke-width', String(SEAM_STROKE_WIDTH));
  return polygon;
}

function createGridLines(columns: number, rows: number): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke', GRID_LINE_COLOR);
  g.setAttribute('stroke-width', String(GRID_LINE_WIDTH));
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(column));
      rect.setAttribute('y', String(row));
      rect.setAttribute('width', '1');
      rect.setAttribute('height', '1');
      g.appendChild(rect);
    }
  }
  return g;
}
