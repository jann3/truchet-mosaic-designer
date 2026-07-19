import type { Asset, TruchetDocument } from './types';
import { generateId } from './generateId';

/** Adds an image asset (e.g. a data URL read from an uploaded file) to the document. */
export function addImageAsset(
  document: TruchetDocument,
  name: string,
  src: string,
  width: number,
  height: number,
): { document: TruchetDocument; assetId: string } {
  const asset: Asset = { id: generateId('asset'), name, type: 'image', src, width, height };
  return { document: { ...document, assets: [...document.assets, asset] }, assetId: asset.id };
}
