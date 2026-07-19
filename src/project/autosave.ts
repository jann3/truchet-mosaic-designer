import type { TruchetDocument } from '../document/types';
import { isTruchetDocumentShape, PROJECT_FORMAT_VERSION } from './serialization';

const STORAGE_KEY = 'truchet-mosaic-designer:autosave';

interface AutosaveRecord {
  version: number;
  savedAt: number;
  document: TruchetDocument;
}

export interface AutosaveEntry {
  savedAt: number;
  document: TruchetDocument;
}

/** Best-effort: private browsing or a full quota silently drops the autosave rather than interrupting the user. */
export function writeAutosave(doc: TruchetDocument): void {
  const record: AutosaveRecord = { version: PROJECT_FORMAT_VERSION, savedAt: Date.now(), document: doc };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignored — see doc comment
  }
}

export function readAutosave(): AutosaveEntry | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as Partial<AutosaveRecord>;
    if (typeof record.savedAt !== 'number' || !isTruchetDocumentShape(record.document)) {
      return null;
    }
    return { savedAt: record.savedAt, document: record.document };
  } catch {
    return null;
  }
}

export function clearAutosave(): void {
  localStorage.removeItem(STORAGE_KEY);
}
