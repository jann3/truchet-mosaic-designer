import type { Grid, TileOrientation } from './types';
import { createTile } from './createDocument';

function swapOrientation(orientation: TileOrientation): TileOrientation {
  return orientation === 'diagonal-a' ? 'diagonal-b' : 'diagonal-a';
}

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

/** Reflects the tile pattern left-right. A diagonal running TL→BR mirrors into one running TR→BL, so orientation flips too. */
export function mirrorHorizontal(grid: Grid): Grid {
  return remapGrid(grid, (row, column) => [row, grid.columns - 1 - column], swapOrientation);
}

/** Reflects the tile pattern top-bottom. Same diagonal-flip reasoning as `mirrorHorizontal`, just across the other axis. */
export function mirrorVertical(grid: Grid): Grid {
  return remapGrid(grid, (row, column) => [grid.rows - 1 - row, column], swapOrientation);
}

/** Rotates the tile pattern 180°. Each diagonal maps onto itself under a half-turn, so orientation is unchanged. */
export function rotate180(grid: Grid): Grid {
  return remapGrid(grid, (row, column) => [grid.rows - 1 - row, grid.columns - 1 - column], (orientation) => orientation);
}
