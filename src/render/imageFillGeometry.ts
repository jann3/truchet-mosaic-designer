import type { Asset, Grid, LayerFill, NormalizedRect } from '../document/types';

export const DEFAULT_CROP: NormalizedRect = { x: 0, y: 0, width: 1, height: 1 };

export interface ImageFillGeometry {
  /** Center of the displayed (cropped) rectangle, in grid units. */
  cx: number;
  cy: number;
  /** Top-left of the displayed (cropped) rectangle, in grid units. */
  displayX: number;
  displayY: number;
  displayWidth: number;
  displayHeight: number;
  /** Size/position the full (uncropped) `<image>` element needs so its crop sub-rect lines up with the display rect. */
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
}

/**
 * Computes where an image fill's cropped rectangle sits in grid space, and
 * the oversized `<image>` placement needed so that rectangle — once clipped —
 * shows exactly the requested crop of the source asset. Shared by
 * `TruchetRenderer` (rendering) and `ImageOverlayController` (interactive
 * handles) so the two never disagree about where the image actually is.
 */
export function computeImageFillGeometry(
  fill: Extract<LayerFill, { type: 'image' }>,
  asset: Asset,
  grid: Grid,
): ImageFillGeometry {
  const crop = fill.crop ?? DEFAULT_CROP;
  const cropWidth = Math.max(0.01, crop.width);
  const cropHeight = Math.max(0.01, crop.height);

  const displayWidth = grid.columns * fill.scale;
  const displayHeight = (displayWidth * (cropHeight * asset.height)) / (cropWidth * asset.width);

  const imageWidth = displayWidth / cropWidth;
  const imageHeight = displayHeight / cropHeight;

  const cx = fill.position.x * grid.columns;
  const cy = fill.position.y * grid.rows;
  const displayX = cx - displayWidth / 2;
  const displayY = cy - displayHeight / 2;

  const imageX = displayX - crop.x * imageWidth;
  const imageY = displayY - crop.y * imageHeight;

  return { cx, cy, displayX, displayY, displayWidth, displayHeight, imageX, imageY, imageWidth, imageHeight };
}
