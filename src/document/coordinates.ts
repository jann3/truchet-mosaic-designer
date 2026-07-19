import type { Grid, NormalizedPoint, Tile } from './types';

/** A pixel-space rectangle, e.g. the area a canvas renderer has to draw into. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Maps a normalized document-space point into pixel space within `rect`. */
export function normalizedToPixel(point: NormalizedPoint, rect: PixelRect): PixelPoint {
  return {
    x: rect.x + point.x * rect.width,
    y: rect.y + point.y * rect.height,
  };
}

/** Maps a pixel-space point within `rect` back into normalized 0.0–1.0 document space. */
export function pixelToNormalized(point: PixelPoint, rect: PixelRect): NormalizedPoint {
  return {
    x: clamp01((point.x - rect.x) / rect.width),
    y: clamp01((point.y - rect.y) / rect.height),
  };
}

export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The normalized bounding box a tile occupies within its grid. */
export function getTileBounds(grid: Pick<Grid, 'columns' | 'rows'>, tile: Pick<Tile, 'row' | 'column'>): NormalizedBounds {
  return {
    x: tile.column / grid.columns,
    y: tile.row / grid.rows,
    width: 1 / grid.columns,
    height: 1 / grid.rows,
  };
}
