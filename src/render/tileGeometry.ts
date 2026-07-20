import type { Tile } from '../document/types';

export type TriangleHalf = 'a' | 'b';

export function getTriangleId(tileId: string, half: TriangleHalf): string {
  return `${tileId}:${half}`;
}

/** Inverse of `getTriangleId` — splits `${tileId}:a`/`${tileId}:b` back into its parts. */
export function parseTriangleId(triangleId: string): { tileId: string; half: TriangleHalf } {
  const separatorIndex = triangleId.lastIndexOf(':');
  return {
    tileId: triangleId.slice(0, separatorIndex),
    half: triangleId.slice(separatorIndex + 1) as TriangleHalf,
  };
}

export type Point = readonly [number, number];

export interface Triangle {
  points: readonly [Point, Point, Point];
}

export interface TileTriangles {
  a: Triangle;
  b: Triangle;
}

/**
 * The two triangles a tile splits into, as grid-space coordinates (each tile
 * occupies one unit square at its column/row). `a` (dark) is always the
 * triangle occupying the orientation's named corner; `b` (light) is the
 * other half of whichever diagonal that implies.
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

  switch (tile.orientation) {
    case 'black-top-right':
      return {
        a: { points: [topLeft, topRight, bottomRight] },
        b: { points: [topLeft, bottomRight, bottomLeft] },
      };
    case 'black-bottom-left':
      return {
        a: { points: [topLeft, bottomRight, bottomLeft] },
        b: { points: [topLeft, topRight, bottomRight] },
      };
    case 'black-top-left':
      return {
        a: { points: [topLeft, topRight, bottomLeft] },
        b: { points: [topRight, bottomRight, bottomLeft] },
      };
    case 'black-bottom-right':
      return {
        a: { points: [topRight, bottomRight, bottomLeft] },
        b: { points: [topLeft, topRight, bottomLeft] },
      };
  }
}

/** The diagonal line shape an orientation renders, ignoring which side is dark — two orientations share each line. */
export type DiagonalDirection = 'tl-br' | 'tr-bl';

export function diagonalDirectionOf(orientation: Tile['orientation']): DiagonalDirection {
  return orientation === 'black-top-right' || orientation === 'black-bottom-left' ? 'tl-br' : 'tr-bl';
}
