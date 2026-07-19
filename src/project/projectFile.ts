import type { TruchetDocument } from '../document/types';
import { sanitizeFilename } from '../utils/sanitizeFilename';
import { deserializeDocument, serializeDocument } from './serialization';

const FILE_EXTENSION = '.truchet';

export function downloadProjectFile(doc: TruchetDocument): void {
  const blob = new Blob([serializeDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(doc.name)}${FILE_EXTENSION}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function readProjectFile(file: File): Promise<TruchetDocument> {
  const text = await file.text();
  return deserializeDocument(text);
}
