import type { Grid, TileOrientation } from './types';
import { getTriangleId, type TriangleHalf } from '../render/tileGeometry';

/** Every triangle in the grid — both halves of every tile. */
export function selectAll(grid: Grid): string[] {
  const ids: string[] = [];
  for (const tile of grid.tiles) {
    ids.push(getTriangleId(tile.id, 'a'), getTriangleId(tile.id, 'b'));
  }
  return ids;
}

/** "Select colour": every tile's `half` triangle (the 'a' half always renders dark, 'b' always light). */
export function selectByHalf(grid: Grid, half: TriangleHalf): string[] {
  return grid.tiles.map((tile) => getTriangleId(tile.id, half));
}

/** Both triangles of every tile whose orientation matches. */
export function selectByOrientation(grid: Grid, orientation: TileOrientation): string[] {
  const ids: string[] = [];
  for (const tile of grid.tiles) {
    if (tile.orientation !== orientation) continue;
    ids.push(getTriangleId(tile.id, 'a'), getTriangleId(tile.id, 'b'));
  }
  return ids;
}

/** Both triangles of every tile in `row`. */
export function selectByRow(grid: Grid, row: number): string[] {
  const ids: string[] = [];
  for (const tile of grid.tiles) {
    if (tile.row !== row) continue;
    ids.push(getTriangleId(tile.id, 'a'), getTriangleId(tile.id, 'b'));
  }
  return ids;
}

/** Both triangles of every tile in `column`. */
export function selectByColumn(grid: Grid, column: number): string[] {
  const ids: string[] = [];
  for (const tile of grid.tiles) {
    if (tile.column !== column) continue;
    ids.push(getTriangleId(tile.id, 'a'), getTriangleId(tile.id, 'b'));
  }
  return ids;
}

/** Every triangle not currently in `triangleIds`. */
export function invertSelection(grid: Grid, triangleIds: readonly string[]): string[] {
  const current = new Set(triangleIds);
  return selectAll(grid).filter((id) => !current.has(id));
}
