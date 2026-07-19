/**
 * Truchet tiles are unit squares split by one diagonal into two triangles.
 * Orientation names the diagonal: 'a' runs top-left→bottom-right, 'b' runs
 * top-right→bottom-left. Flipping a tile toggles between the two.
 */
export type TileOrientation = 'diagonal-a' | 'diagonal-b';

export interface Tile {
  id: string;
  row: number;
  column: number;
  orientation: TileOrientation;
}

export interface Grid {
  columns: number;
  rows: number;
  tiles: Tile[];
}

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'difference'
  | 'darken'
  | 'lighten';

/** A point in document space, both axes normalized to 0.0–1.0 regardless of pixel size. */
export interface NormalizedPoint {
  x: number;
  y: number;
}

/** A rectangle within an image asset's own pixel space, normalized 0.0–1.0 on both axes. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayerFill =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; angle: number; stops: Array<{ offset: number; color: string }> }
  | {
      type: 'image';
      assetId: string;
      position: NormalizedPoint;
      scale: number;
      rotation: number;
      /** Sub-rectangle of the source asset that's actually shown; `{x:0,y:0,width:1,height:1}` is the full image. */
      crop: NormalizedRect;
    };

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  /** References a Selection by id, or null to mean "no tiles yet". */
  selectionId: string | null;
  fill: LayerFill;
}

export interface Selection {
  id: string;
  name: string;
  /** Triangle ids in `${tileId}:a` / `${tileId}:b` form — see `getTriangleId`. */
  triangleIds: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: 'image';
  src: string;
  width: number;
  height: number;
}

export interface ExportSettings {
  resolution: number;
  transparentBackground: boolean;
  includeGridLines: boolean;
  format: 'png' | 'jpg' | 'webp' | 'svg';
}

export interface TruchetDocument {
  id: string;
  name: string;
  /** width / height of the overall design, independent of any on-screen canvas size. */
  aspectRatio: number;
  grid: Grid;
  layers: Layer[];
  selections: Selection[];
  assets: Asset[];
  exportSettings: ExportSettings;
}
