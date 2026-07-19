import type { TruchetDocument } from '../document/types';
import { buildExportSvg } from '../render/exportSvg';

export type RasterFormat = 'png' | 'jpg' | 'webp';

export interface VectorExportOptions {
  transparentBackground: boolean;
  includeGridLines: boolean;
}

export interface RasterExportOptions extends VectorExportOptions {
  format: RasterFormat;
  resolution: number;
}

const MIME_BY_FORMAT: Record<RasterFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/**
 * SVG export (Phase 11's "vector export") stays exact only while every layer
 * fill is itself vector — an image fill is fundamentally raster content, so
 * a document with one no longer qualifies. Gates the format option in
 * `ExportDialog` rather than failing at export time.
 */
export function canExportVector(doc: TruchetDocument): boolean {
  return !doc.layers.some((layer) => layer.fill.type === 'image');
}

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'mosaic';
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function serializeSvg(svg: SVGSVGElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
}

export function exportVectorSvg(doc: TruchetDocument, options: VectorExportOptions): void {
  const svg = buildExportSvg(doc, options);
  const blob = new Blob([serializeSvg(svg)], { type: 'image/svg+xml' });
  downloadBlob(blob, `${sanitizeFilename(doc.name)}.svg`);
}

function svgToImage(svgMarkup: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterize export SVG'));
    };
    image.src = url;
  });
}

export async function exportRaster(doc: TruchetDocument, options: RasterExportOptions): Promise<void> {
  // JPEG has no alpha channel — force an opaque background so it never
  // silently composites transparent regions onto black instead.
  const jpegSafe = options.format === 'jpg';
  const svg = buildExportSvg(doc, {
    transparentBackground: jpegSafe ? false : options.transparentBackground,
    includeGridLines: options.includeGridLines,
  });

  const { columns, rows } = doc.grid;
  const scale = options.resolution / Math.max(columns, rows);
  const width = Math.max(1, Math.round(columns * scale));
  const height = Math.max(1, Math.round(rows * scale));
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  const image = await svgToImage(serializeSvg(svg));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(image, 0, 0, width, height);

  const mimeType = MIME_BY_FORMAT[options.format];
  const quality = options.format === 'png' ? undefined : 0.92;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality));
  if (!blob) throw new Error('Could not encode exported image');

  downloadBlob(blob, `${sanitizeFilename(doc.name)}.${options.format}`);
}
