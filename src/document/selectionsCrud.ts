import type { Selection, TruchetDocument } from './types';
import { generateId } from './generateId';

export function createSelection(document: TruchetDocument, name: string): TruchetDocument {
  const selection: Selection = { id: generateId('selection'), name, triangleIds: [] };
  return { ...document, selections: [...document.selections, selection] };
}

export function renameSelection(document: TruchetDocument, id: string, name: string): TruchetDocument {
  return {
    ...document,
    selections: document.selections.map((selection) => (selection.id === id ? { ...selection, name } : selection)),
  };
}

export function duplicateSelection(document: TruchetDocument, id: string): TruchetDocument {
  const source = document.selections.find((selection) => selection.id === id);
  if (!source) return document;
  const copy: Selection = { id: generateId('selection'), name: `${source.name} copy`, triangleIds: [...source.triangleIds] };
  return { ...document, selections: [...document.selections, copy] };
}

export function deleteSelection(document: TruchetDocument, id: string): TruchetDocument {
  return { ...document, selections: document.selections.filter((selection) => selection.id !== id) };
}

export function setSelectionTriangles(document: TruchetDocument, id: string, triangleIds: string[]): TruchetDocument {
  return {
    ...document,
    selections: document.selections.map((selection) =>
      selection.id === id ? { ...selection, triangleIds } : selection,
    ),
  };
}

/** Adds/removes a single triangle from a selection's contents; a no-op if already in the target state. */
export function toggleSelectionTriangle(
  document: TruchetDocument,
  id: string,
  triangleId: string,
  include: boolean,
): TruchetDocument {
  const selection = document.selections.find((s) => s.id === id);
  if (!selection) return document;
  const has = selection.triangleIds.includes(triangleId);
  if (has === include) return document;
  const triangleIds = include
    ? [...selection.triangleIds, triangleId]
    : selection.triangleIds.filter((tid) => tid !== triangleId);
  return setSelectionTriangles(document, id, triangleIds);
}
