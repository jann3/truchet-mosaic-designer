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
  };
  return { ...document, layers: [...document.layers, layer] };
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
