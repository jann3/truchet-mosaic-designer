import type { Asset, Grid, Layer, Tile, TruchetDocument } from '../document/types';
import type { DocumentStore } from '../document/DocumentStore';
import type { SelectionEngine, SelectionState } from '../edit/SelectionEngine';
import { getTileTriangles, getTriangleId, parseTriangleId, type Point, type TriangleHalf } from './tileGeometry';
import { gradientLine } from './gradient';
import { computeImageFillGeometry } from './imageFillGeometry';

const SVG_NS = 'http://www.w3.org/2000/svg';

const EMPTY_SELECTION_STATE: SelectionState = { hoveredTriangleId: null, selectedTriangleIds: new Set() };

const HOVER_CLASS = 'truchet-grid__triangle--hover';
const SELECTED_CLASS = 'truchet-grid__triangle--selected';

function pointsToString(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x},${y}`).join(' ');
}

/**
 * Renders a document's grid as an SVG of Truchet tile triangles. The SVG's
 * viewBox tracks the grid's column/row count and scales via CSS (width/height
 * 100%), so it resizes with its container and stays vector-sharp at any
 * resolution without any pixel math here. Also mirrors hover/selection state
 * from a `SelectionEngine` onto the affected triangles without re-rendering
 * the whole grid.
 *
 * Layers (Phase 7) paint over this base grid: each visible layer fills the
 * triangles named by its selection reference according to its fill type,
 * inside a `<g>` carrying the layer's opacity and CSS `mix-blend-mode` — the
 * base grid is always the foundation layers composite on top of, never
 * something they replace, per the "grid never owns the artwork" principle.
 */
export class TruchetRenderer {
  readonly svg: SVGSVGElement;
  private readonly defs: SVGDefsElement;
  private readonly baseGroup: SVGGElement;
  private readonly layersGroup: SVGGElement;
  private readonly unsubscribeDoc: () => void;
  private readonly unsubscribeSelection: () => void;
  private readonly triangleElements = new Map<string, SVGPolygonElement>();
  private appliedSelectionState: SelectionState = EMPTY_SELECTION_STATE;

  constructor(container: HTMLElement, store: DocumentStore, selectionEngine: SelectionEngine) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('truchet-grid');

    this.defs = document.createElementNS(SVG_NS, 'defs');
    this.baseGroup = document.createElementNS(SVG_NS, 'g');
    this.baseGroup.classList.add('truchet-grid__base');
    this.layersGroup = document.createElementNS(SVG_NS, 'g');
    this.layersGroup.classList.add('truchet-grid__layers');
    this.svg.append(this.defs, this.baseGroup, this.layersGroup);

    container.appendChild(this.svg);

    this.render(store.get(), selectionEngine.getState());
    this.unsubscribeDoc = store.subscribe((doc) => this.render(doc, selectionEngine.getState()));
    this.unsubscribeSelection = selectionEngine.subscribe((state) => this.applyHighlightDiff(state));
  }

  destroy(): void {
    this.unsubscribeDoc();
    this.unsubscribeSelection();
    this.svg.remove();
  }

  private render(doc: TruchetDocument, selectionState: SelectionState): void {
    this.svg.setAttribute('viewBox', `0 0 ${doc.grid.columns} ${doc.grid.rows}`);
    this.renderBase(doc.grid);
    this.renderLayers(doc);

    // Freshly created base elements carry no highlight classes yet, so
    // re-apply the current selection state against the new map rather than
    // diffing.
    this.appliedSelectionState = EMPTY_SELECTION_STATE;
    this.applyHighlightDiff(selectionState);
  }

  private renderBase(grid: Grid): void {
    this.baseGroup.replaceChildren();
    this.triangleElements.clear();

    const fragment = document.createDocumentFragment();
    for (const tile of grid.tiles) {
      const { a, b } = getTileTriangles(tile);
      fragment.appendChild(this.createTriangle(tile.id, 'a', a.points, 'truchet-grid__triangle--a'));
      fragment.appendChild(this.createTriangle(tile.id, 'b', b.points, 'truchet-grid__triangle--b'));
    }
    this.baseGroup.appendChild(fragment);
  }

  private createTriangle(
    tileId: string,
    half: TriangleHalf,
    points: readonly Point[],
    className: string,
  ): SVGPolygonElement {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', pointsToString(points));
    polygon.classList.add(className);
    polygon.dataset.tileId = tileId;
    polygon.dataset.half = half;
    this.triangleElements.set(getTriangleId(tileId, half), polygon);
    return polygon;
  }

  private renderLayers(doc: TruchetDocument): void {
    this.layersGroup.replaceChildren();
    this.defs.replaceChildren();

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
        .map((triangleId) => this.pointsForTriangle(tileById, triangleId))
        .filter((points): points is readonly Point[] => points !== null);
      if (trianglePoints.length === 0) continue;

      const g = document.createElementNS(SVG_NS, 'g');
      g.style.opacity = String(effectiveOpacity);
      g.style.mixBlendMode = layer.blendMode;

      if (layer.fill.type === 'solid') {
        this.appendSolidTriangles(g, trianglePoints, layer.fill.color);
      } else if (layer.fill.type === 'gradient') {
        this.appendGradientTriangles(g, trianglePoints, layer, doc.grid);
      } else {
        this.appendImageFill(g, trianglePoints, layer, doc.grid, doc.assets);
      }

      this.layersGroup.appendChild(g);
    }
  }

  private pointsForTriangle(tileById: Map<string, Tile>, triangleId: string): readonly Point[] | null {
    const { tileId, half } = parseTriangleId(triangleId);
    const tile = tileById.get(tileId);
    if (!tile) return null;
    const { a, b } = getTileTriangles(tile);
    return half === 'a' ? a.points : b.points;
  }

  private appendSolidTriangles(g: SVGGElement, trianglePoints: readonly (readonly Point[])[], color: string): void {
    for (const points of trianglePoints) {
      const polygon = document.createElementNS(SVG_NS, 'polygon');
      polygon.setAttribute('points', pointsToString(points));
      polygon.setAttribute('fill', color);
      g.appendChild(polygon);
    }
  }

  private appendGradientTriangles(
    g: SVGGElement,
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
    this.defs.appendChild(gradientEl);

    for (const points of trianglePoints) {
      const polygon = document.createElementNS(SVG_NS, 'polygon');
      polygon.setAttribute('points', pointsToString(points));
      polygon.setAttribute('fill', `url(#${gradientId})`);
      g.appendChild(polygon);
    }
  }

  private appendImageFill(
    g: SVGGElement,
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
    this.defs.appendChild(clipPath);

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
    this.defs.appendChild(cropClip);

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

  private applyHighlightDiff(state: SelectionState): void {
    const previous = this.appliedSelectionState;

    if (previous.hoveredTriangleId !== state.hoveredTriangleId) {
      this.setHighlightClass(previous.hoveredTriangleId, HOVER_CLASS, false);
      this.setHighlightClass(state.hoveredTriangleId, HOVER_CLASS, true);
    }

    for (const id of previous.selectedTriangleIds) {
      if (!state.selectedTriangleIds.has(id)) this.setHighlightClass(id, SELECTED_CLASS, false);
    }
    for (const id of state.selectedTriangleIds) {
      if (!previous.selectedTriangleIds.has(id)) this.setHighlightClass(id, SELECTED_CLASS, true);
    }

    this.appliedSelectionState = state;
  }

  private setHighlightClass(triangleId: string | null, className: string, on: boolean): void {
    if (!triangleId) return;
    this.triangleElements.get(triangleId)?.classList.toggle(className, on);
  }
}
