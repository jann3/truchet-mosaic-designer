import type { Grid, Tile, TileOrientation } from './types';

export function flipOrientation(orientation: TileOrientation): TileOrientation {
  return orientation === 'diagonal-a' ? 'diagonal-b' : 'diagonal-a';
}

/** Returns a grid with `tileId`'s orientation set, or the same grid instance if nothing changed. */
export function setTileOrientation(grid: Grid, tileId: string, orientation: TileOrientation): Grid {
  let changed = false;
  const tiles: Tile[] = grid.tiles.map((tile) => {
    if (tile.id !== tileId || tile.orientation === orientation) return tile;
    changed = true;
    return { ...tile, orientation };
  });
  return changed ? { ...grid, tiles } : grid;
}
