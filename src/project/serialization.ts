import type { Tile, TileOrientation, TruchetDocument } from '../document/types';

export const PROJECT_FORMAT_VERSION = 1;

/** Orientation values from before tile colour became independent of the diagonal — both locked the dark triangle to a top corner. */
const LEGACY_ORIENTATION: Record<string, TileOrientation> = {
  'diagonal-a': 'black-top-right',
  'diagonal-b': 'black-top-left',
};

/** Remaps any tile still using the pre-four-corner orientation scheme so older saves keep their exact appearance. */
export function migrateDocument(doc: TruchetDocument): TruchetDocument {
  let changed = false;
  const tiles: Tile[] = doc.grid.tiles.map((tile) => {
    const legacy = LEGACY_ORIENTATION[tile.orientation as string];
    if (!legacy) return tile;
    changed = true;
    return { ...tile, orientation: legacy };
  });
  return changed ? { ...doc, grid: { ...doc.grid, tiles } } : doc;
}

export interface ProjectFile {
  version: number;
  document: TruchetDocument;
}

export class ProjectFileError extends Error {}

export function isTruchetDocumentShape(value: unknown): value is TruchetDocument {
  if (typeof value !== 'object' || value === null) return false;
  const doc = value as Record<string, unknown>;
  return (
    typeof doc.id === 'string' &&
    typeof doc.name === 'string' &&
    typeof doc.grid === 'object' &&
    doc.grid !== null &&
    Array.isArray((doc.grid as Record<string, unknown>).tiles) &&
    Array.isArray(doc.layers) &&
    Array.isArray(doc.groups) &&
    Array.isArray(doc.selections) &&
    Array.isArray(doc.assets) &&
    typeof doc.exportSettings === 'object' &&
    doc.exportSettings !== null
  );
}

export function serializeDocument(doc: TruchetDocument): string {
  const file: ProjectFile = { version: PROJECT_FORMAT_VERSION, document: doc };
  return JSON.stringify(file);
}

export function deserializeDocument(json: string): TruchetDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ProjectFileError('Not a valid project file: malformed JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ProjectFileError('Not a valid Truchet project file.');
  }
  const file = parsed as Partial<ProjectFile>;
  if (typeof file.version !== 'number' || file.version > PROJECT_FORMAT_VERSION) {
    throw new ProjectFileError('This project file was saved by a newer version of the app.');
  }
  if (!isTruchetDocumentShape(file.document)) {
    throw new ProjectFileError('Not a valid Truchet project file.');
  }
  return migrateDocument(file.document);
}
