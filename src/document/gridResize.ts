import type { Grid, Tile, TruchetDocument } from './types';
import { createTile } from './createDocument';

/**
 * Resizes the grid to `columns`×`rows` in place: any tile at a (row, column)
 * that already exists keeps its id and orientation (tile ids are `r{row}c{column}`,
 * so reuse is just a position lookup), newly added rows/columns get fresh
 * default-orientation tiles, and tiles that fall outside the new bounds are
 * dropped. Layers and images are untouched — they don't reference tiles
 * directly — but any selection that pointed at a dropped tile's triangles has
 * those ids pruned so it never dangles.
 */
export function resizeGrid(doc: TruchetDocument, columns: number, rows: number): TruchetDocument {
  const { grid } = doc;
  if (columns === grid.columns && rows === grid.rows) return doc;

  const byPosition = new Map(grid.tiles.map((tile) => [`${tile.row}:${tile.column}`, tile]));
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      tiles.push(byPosition.get(`${row}:${column}`) ?? createTile(row, column));
    }
  }

  const removedTileIds = grid.tiles
    .filter((tile) => tile.row >= rows || tile.column >= columns)
    .map((tile) => tile.id);

  const newGrid: Grid = { columns, rows, tiles };
  if (removedTileIds.length === 0) {
    return { ...doc, grid: newGrid };
  }

  const removedTriangleIds = new Set(removedTileIds.flatMap((tileId) => [`${tileId}:a`, `${tileId}:b`]));
  return {
    ...doc,
    grid: newGrid,
    selections: doc.selections.map((selection) => ({
      ...selection,
      triangleIds: selection.triangleIds.filter((id) => !removedTriangleIds.has(id)),
    })),
  };
}
