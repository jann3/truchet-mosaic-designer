import type { Asset, Grid, Layer, Tile, TruchetDocument } from '../document/types';
import { getTileTriangles, parseTriangleId, type Point } from './tileGeometry';
import { gradientLine } from './gradient';
import { computeImageFillGeometry } from './imageFillGeometry';

const SVG_NS = 'http://www.w3.org/2000/svg';

function pointsToString(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

/**
 * Renders `doc.layers` (Phase 7/8's compositing pass) into `layersGroup`,
 * populating `defs` with whatever gradients/clip paths they need. Pure DOM
 * building, no interaction/highlight bookkeeping — shared by `TruchetRenderer`
 * (the live, subscribed canvas) and the export builders (`render/exportSvg.ts`),
 * so the two can never drift apart on how a layer paints.
 */
export function renderDocumentLayers(layersGroup: SVGGElement, defs: SVGDefsElement, doc: TruchetDocument): void {
  const tileById = new Map(doc.grid.tiles.map((tile) => [tile.id, tile]));
  const groupById = new Map(doc.groups.map((group) => [group.id, group]));

  for (const layer of doc.layers) {
    const group = layer.groupId ? groupById.get(layer.groupId) : undefined;
    const effectiveVisible = layer.visible && (!group || group.visible);
    const effectiveOpacity = layer.opacity * (group ? group.opacity : 1);
    if (!effectiveVisible || effectiveOpacity <= 0) continue;
    const selection = layer.selectionId ? doc.selections.find((s) => s.id === layer.selectionId) : null;
    if (!selection || selection.triangleIds.length === 0) continue;

    const trianglePoints = selection.triangleIds
      .map((triangleId) => pointsForTriangle(tileById, triangleId))
      .filter((points): points is readonly Point[] => points !== null);
    if (trianglePoints.length === 0) continue;

    const g = document.createElementNS(SVG_NS, 'g');
    g.style.opacity = String(effectiveOpacity);
    g.style.mixBlendMode = layer.blendMode;

    if (layer.fill.type === 'solid') {
      appendSolidTriangles(g, trianglePoints, layer.fill.color);
    } else if (layer.fill.type === 'gradient') {
      appendGradientTriangles(g, defs, trianglePoints, layer, doc.grid);
    } else {
      appendImageFill(g, defs, trianglePoints, layer, doc.grid, doc.assets);
    }

    layersGroup.appendChild(g);
  }
}

function pointsForTriangle(tileById: Map<string, Tile>, triangleId: string): readonly Point[] | null {
  const { tileId, half } = parseTriangleId(triangleId);
  const tile = tileById.get(tileId);
  if (!tile) return null;
  const { a, b } = getTileTriangles(tile);
  return half === 'a' ? a.points : b.points;
}

function appendSeamStroke(polygon: SVGPolygonElement, paint: string): void {
  // Matches the base grid's own seam-sealing trick (see canvas.css): without
  // a same-colour stroke, the hairline antialiasing gap between adjacent
  // triangles lets the base grid's black/white stroke show through the
  // layer's fill, standing out as thin lines wherever a layer recolours
  // tiles away from that default palette.
  polygon.setAttribute('stroke', paint);
  polygon.setAttribute('stroke-width', '1');
  polygon.style.vectorEffect = 'non-scaling-stroke';
  polygon.setAttribute('stroke-linejoin', 'round');
}

function appendSolidTriangles(g: SVGGElement, trianglePoints: readonly (readonly Point[])[], color: string): void {
  for (const points of trianglePoints) {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', pointsToString(points));
    polygon.setAttribute('fill', color);
    appendSeamStroke(polygon, color);
    g.appendChild(polygon);
  }
}

function appendGradientTriangles(
  g: SVGGElement,
  defs: SVGDefsElement,
  trianglePoints: readonly (readonly Point[])[],
  layer: Layer,
  grid: Grid,
): void {
  if (layer.fill.type !== 'gradient') return;
  const fill = layer.fill;
  const gradientId = `layer-gradient-${layer.id}`;
  const { x1, y1, x2, y2 } = gradientLine(fill.angle, grid.columns, grid.rows);

  const gradientEl = document.createElementNS(SVG_NS, 'linearGradient');
  gradientEl.setAttribute('id', gradientId);
  gradientEl.setAttribute('gradientUnits', 'userSpaceOnUse');
  gradientEl.setAttribute('x1', String(x1));
  gradientEl.setAttribute('y1', String(y1));
  gradientEl.setAttribute('x2', String(x2));
  gradientEl.setAttribute('y2', String(y2));
  for (const stop of fill.stops) {
    const stopEl = document.createElementNS(SVG_NS, 'stop');
    stopEl.setAttribute('offset', String(stop.offset));
    stopEl.setAttribute('stop-color', stop.color);
    gradientEl.appendChild(stopEl);
  }
  defs.appendChild(gradientEl);

  for (const points of trianglePoints) {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', pointsToString(points));
    polygon.setAttribute('fill', `url(#${gradientId})`);
    appendSeamStroke(polygon, `url(#${gradientId})`);
    g.appendChild(polygon);
  }
}

function appendImageFill(
  g: SVGGElement,
  defs: SVGDefsElement,
  trianglePoints: readonly (readonly Point[])[],
  layer: Layer,
  grid: Grid,
  assets: Asset[],
): void {
  if (layer.fill.type !== 'image') return;
  const fill = layer.fill;
  const asset = assets.find((a) => a.id === fill.assetId);
  if (!asset) return;

  const clipId = `layer-clip-${layer.id}`;
  const clipPath = document.createElementNS(SVG_NS, 'clipPath');
  clipPath.setAttribute('id', clipId);
  for (const points of trianglePoints) {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', pointsToString(points));
    clipPath.appendChild(polygon);
  }
  defs.appendChild(clipPath);

  const geometry = computeImageFillGeometry(fill, asset, grid);

  // The crop rectangle is clipped in the image's own (unrotated) local
  // space, nested inside the rotation group, so it rotates together with
  // the image content it bounds rather than staying axis-aligned.
  const cropClipId = `layer-crop-${layer.id}`;
  const cropClip = document.createElementNS(SVG_NS, 'clipPath');
  cropClip.setAttribute('id', cropClipId);
  const cropRect = document.createElementNS(SVG_NS, 'rect');
  cropRect.setAttribute('x', String(geometry.displayX));
  cropRect.setAttribute('y', String(geometry.displayY));
  cropRect.setAttribute('width', String(geometry.displayWidth));
  cropRect.setAttribute('height', String(geometry.displayHeight));
  cropClip.appendChild(cropRect);
  defs.appendChild(cropClip);

  // Triangle mask stays fixed on the grid regardless of the image's own
  // rotation, so it wraps the rotation group rather than living inside it.
  const maskGroup = document.createElementNS(SVG_NS, 'g');
  maskGroup.setAttribute('clip-path', `url(#${clipId})`);

  const rotateGroup = document.createElementNS(SVG_NS, 'g');
  if (fill.rotation) {
    rotateGroup.setAttribute('transform', `rotate(${fill.rotation} ${geometry.cx} ${geometry.cy})`);
  }

  const cropGroup = document.createElementNS(SVG_NS, 'g');
  cropGroup.setAttribute('clip-path', `url(#${cropClipId})`);

  const image = document.createElementNS(SVG_NS, 'image');
  image.setAttribute('href', asset.src);
  image.setAttribute('x', String(geometry.imageX));
  image.setAttribute('y', String(geometry.imageY));
  image.setAttribute('width', String(geometry.imageWidth));
  image.setAttribute('height', String(geometry.imageHeight));
  image.setAttribute('preserveAspectRatio', 'none');

  cropGroup.appendChild(image);
  rotateGroup.appendChild(cropGroup);
  maskGroup.appendChild(rotateGroup);
  g.appendChild(maskGroup);
}
