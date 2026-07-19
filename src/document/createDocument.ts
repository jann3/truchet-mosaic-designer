import type { ExportSettings, Grid, Tile, TileOrientation, TruchetDocument } from './types';
import { generateId } from './generateId';

const DEFAULT_COLUMNS = 8;
const DEFAULT_ROWS = 8;
const DEFAULT_ORIENTATION: TileOrientation = 'diagonal-a';

export function createTile(row: number, column: number, orientation: TileOrientation = DEFAULT_ORIENTATION): Tile {
  return { id: `r${row}c${column}`, row, column, orientation };
}

export function createGrid(columns: number = DEFAULT_COLUMNS, rows: number = DEFAULT_ROWS): Grid {
  const tiles: Tile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      tiles.push(createTile(row, column));
    }
  }
  return { columns, rows, tiles };
}

export function createDefaultExportSettings(): ExportSettings {
  return {
    resolution: 2000,
    transparentBackground: false,
    includeGridLines: false,
    format: 'png',
  };
}

export interface CreateDocumentOptions {
  columns?: number;
  rows?: number;
  aspectRatio?: number;
  name?: string;
}

export function createDocument(options: CreateDocumentOptions = {}): TruchetDocument {
  return {
    id: generateId('document'),
    name: options.name ?? 'Untitled Mosaic',
    aspectRatio: options.aspectRatio ?? 1,
    grid: createGrid(options.columns, options.rows),
    layers: [],
    groups: [],
    selections: [],
    assets: [],
    exportSettings: createDefaultExportSettings(),
  };
}
