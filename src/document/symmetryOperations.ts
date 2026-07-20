import type { Grid, TileOrientation } from './types';
import { createTile } from './createDocument';

/** Corner the dark triangle lands on after reflecting the tile pattern left-right (top/bottom unchanged, left/right swap). */
const HORIZONTAL_MIRROR: Record<TileOrientation, TileOrientation> = {
  'black-top-left': 'black-top-right',
  'black-top-right': 'black-top-left',
  'black-bottom-left': 'black-bottom-right',
  'black-bottom-right': 'black-bottom-left',
};

/** Corner the dark triangle lands on after reflecting the tile pattern top-bottom (left/right unchanged, top/bottom swap). */
const VERTICAL_MIRROR: Record<TileOrientation, TileOrientation> = {
  'black-top-left': 'black-bottom-left',
  'black-bottom-left': 'black-top-left',
  'black-top-right': 'black-bottom-right',
  'black-bottom-right': 'black-top-right',
};

/** Corner the dark triangle lands on after a 180° rotation (opposite corner). */
const ROTATE_180: Record<TileOrientation, TileOrientation> = {
  'black-top-left': 'black-bottom-right',
  'black-bottom-right': 'black-top-left',
  'black-top-right': 'black-bottom-left',
  'black-bottom-left': 'black-top-right',
};

/**
 * Rebuilds the grid by, for every tile position, pulling the orientation from
 * `sourcePosition`'s tile and running it through `transformOrientation`. Tile
 * ids stay keyed to their own (row, column) — only orientation moves — so
 * existing selections (which reference tiles by position) keep pointing at
 * the same physical triangles after the symmetry operation.
 */
function remapGrid(
  grid: Grid,
  sourcePosition: (row: number, column: number) => readonly [number, number],
  transformOrientation: (orientation: TileOrientation) => TileOrientation,
): Grid {
  const bySource = new Map(grid.tiles.map((tile) => [`${tile.row}:${tile.column}`, tile]));
  const tiles = grid.tiles.map((tile) => {
    const [sourceRow, sourceColumn] = sourcePosition(tile.row, tile.column);
    const source = bySource.get(`${sourceRow}:${sourceColumn}`);
    const orientation = source ? transformOrientation(source.orientation) : tile.orientation;
    return createTile(tile.row, tile.column, orientation);
  });
  return { ...grid, tiles };
}

/** Reflects the tile pattern left-right — each tile's dark corner mirrors from left to right (or vice versa). */
export function mirrorHorizontal(grid: Grid): Grid {
  return remapGrid(grid, (row, column) => [row, grid.columns - 1 - column], (o) => HORIZONTAL_MIRROR[o]);
}

/** Reflects the tile pattern top-bottom — each tile's dark corner mirrors from top to bottom (or vice versa). */
export function mirrorVertical(grid: Grid): Grid {
  return remapGrid(grid, (row, column) => [grid.rows - 1 - row, column], (o) => VERTICAL_MIRROR[o]);
}

/** Rotates the tile pattern 180° — each tile's dark corner moves to the opposite corner. */
export function rotate180(grid: Grid): Grid {
  return remapGrid(grid, (row, column) => [grid.rows - 1 - row, grid.columns - 1 - column], (o) => ROTATE_180[o]);
}
