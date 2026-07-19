import type { Tile } from '../document/types';

type Point = readonly [number, number];

export interface Triangle {
  points: readonly [Point, Point, Point];
}

export interface TileTriangles {
  a: Triangle;
  b: Triangle;
}

/**
 * The two triangles a tile splits into, as grid-space coordinates (each tile
 * occupies one unit square at its column/row). 'diagonal-a' splits along
 * top-left→bottom-right; 'diagonal-b' splits along top-right→bottom-left.
 */
export function getTileTriangles(tile: Pick<Tile, 'row' | 'column' | 'orientation'>): TileTriangles {
  const x0 = tile.column;
  const y0 = tile.row;
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const topLeft: Point = [x0, y0];
  const topRight: Point = [x1, y0];
  const bottomLeft: Point = [x0, y1];
  const bottomRight: Point = [x1, y1];

  if (tile.orientation === 'diagonal-a') {
    return {
      a: { points: [topLeft, topRight, bottomRight] },
      b: { points: [topLeft, bottomRight, bottomLeft] },
    };
  }

  return {
    a: { points: [topLeft, topRight, bottomLeft] },
    b: { points: [topRight, bottomRight, bottomLeft] },
  };
}
