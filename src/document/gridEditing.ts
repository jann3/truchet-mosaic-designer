import type { Grid, Tile, TileOrientation } from './types';

/** Flip order: the dark corner walks top-left → bottom-left → bottom-right → top-right → top-left. */
const FLIP_CYCLE: readonly TileOrientation[] = [
  'black-top-left',
  'black-bottom-left',
  'black-bottom-right',
  'black-top-right',
];

export function flipOrientation(orientation: TileOrientation): TileOrientation {
  const index = FLIP_CYCLE.indexOf(orientation);
  return FLIP_CYCLE[(index + 1) % FLIP_CYCLE.length];
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
