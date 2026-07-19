import type { BlendMode, Layer, LayerFill, TruchetDocument } from './types';
import { generateId } from './generateId';

const DEFAULT_FILL: LayerFill = { type: 'solid', color: '#4f8cff' };

export function createLayer(document: TruchetDocument, name: string): TruchetDocument {
  const layer: Layer = {
    id: generateId('layer'),
    name,
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    selectionId: null,
    fill: { ...DEFAULT_FILL },
    groupId: null,
  };
  return { ...document, layers: [...document.layers, layer] };
}

/** Swaps a layer with its neighbour one slot toward the top ('up') or bottom ('down') of the paint stack. */
export function moveLayer(document: TruchetDocument, id: string, direction: 'up' | 'down'): TruchetDocument {
  const layers = [...document.layers];
  const index = layers.findIndex((layer) => layer.id === id);
  if (index === -1) return document;

  const targetIndex = direction === 'up' ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= layers.length) return document;

  [layers[index], layers[targetIndex]] = [layers[targetIndex], layers[index]];
  return { ...document, layers };
}

/** Clones a layer immediately above the original in the paint stack. */
export function duplicateLayer(document: TruchetDocument, id: string): TruchetDocument {
  const index = document.layers.findIndex((layer) => layer.id === id);
  if (index === -1) return document;

  const original = document.layers[index];
  const clone: Layer = { ...original, id: generateId('layer'), name: `${original.name} copy` };
  const layers = [...document.layers];
  layers.splice(index + 1, 0, clone);
  return { ...document, layers };
}

export function renameLayer(document: TruchetDocument, id: string, name: string): TruchetDocument {
  return { ...document, layers: document.layers.map((layer) => (layer.id === id ? { ...layer, name } : layer)) };
}

export function deleteLayer(document: TruchetDocument, id: string): TruchetDocument {
  return { ...document, layers: document.layers.filter((layer) => layer.id !== id) };
}

export function setLayerVisibility(document: TruchetDocument, id: string, visible: boolean): TruchetDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === id ? { ...layer, visible } : layer)),
  };
}

export function setLayerOpacity(document: TruchetDocument, id: string, opacity: number): TruchetDocument {
  const clamped = Math.min(1, Math.max(0, opacity));
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === id ? { ...layer, opacity: clamped } : layer)),
  };
}

export function setLayerBlendMode(document: TruchetDocument, id: string, blendMode: BlendMode): TruchetDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === id ? { ...layer, blendMode } : layer)),
  };
}

export function setLayerSelection(
  document: TruchetDocument,
  id: string,
  selectionId: string | null,
): TruchetDocument {
  return {
    ...document,
    layers: document.layers.map((layer) => (layer.id === id ? { ...layer, selectionId } : layer)),
  };
}

export function setLayerFill(document: TruchetDocument, id: string, fill: LayerFill): TruchetDocument {
  return { ...document, layers: document.layers.map((layer) => (layer.id === id ? { ...layer, fill } : layer)) };
}
