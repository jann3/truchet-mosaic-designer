import type { DocumentStore } from '../document/DocumentStore';
import type { Asset, Layer, LayerFill, TruchetDocument } from '../document/types';
import { computeImageFillGeometry, type ImageFillGeometry } from '../render/imageFillGeometry';
import { setLayerFill } from '../document/layersCrud';
import type { HistoryManager } from './HistoryManager';
import type { SelectedLayerStore } from './SelectedLayerStore';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Grid-unit-to-pixel ratio swings wildly with grid size (a 2-row grid vs. a
// 40-row grid in the same viewport), so handle size/offset is computed in
// screen pixels each render and converted to grid units via the SVG's CTM —
// a fixed grid-unit constant would put the rotate handle off-screen for
// small grids and make it invisible for large ones.
const HANDLE_RADIUS_PX = 8;
const ROTATE_HANDLE_OFFSET_PX = 28;
const MIN_SCALE = 0.05;
const MAX_SCALE = 10;

type ImageFill = Extract<LayerFill, { type: 'image' }>;

interface Selected {
  layer: Layer;
  fill: ImageFill;
  asset: Asset;
  geometry: ImageFillGeometry;
}

type DragMode = 'move' | 'resize' | 'rotate';

interface DragState {
  mode: DragMode;
  layerId: string;
  fill: ImageFill;
  center: { x: number; y: number };
  startGrid: { x: number; y: number };
  startDistance: number;
}

function findSelected(doc: TruchetDocument, layerId: string | null): Selected | null {
  if (!layerId) return null;
  const layer = doc.layers.find((l) => l.id === layerId);
  if (!layer || layer.fill.type !== 'image') return null;
  const fill = layer.fill;
  const asset = doc.assets.find((a) => a.id === fill.assetId);
  if (!asset) return null;
  return { layer, fill, asset, geometry: computeImageFillGeometry(fill, asset, doc.grid) };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Draws move/resize/rotate handles over the currently selected image layer
 * and wires pointer drags on them to `fill.position/scale/rotation` — the
 * "Image interaction" piece of Phase 8. Handle geometry always comes from
 * `computeImageFillGeometry`, the same helper `TruchetRenderer` uses to
 * place the image itself, so the handles never drift from what's rendered.
 */
export class ImageOverlayController {
  readonly group: SVGGElement;
  private readonly svg: SVGSVGElement;
  private readonly store: DocumentStore;
  private readonly history: HistoryManager;
  private readonly selectedLayer: SelectedLayerStore;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeSelection: () => void;
  private drag: DragState | null = null;

  constructor(svg: SVGSVGElement, store: DocumentStore, history: HistoryManager, selectedLayer: SelectedLayerStore) {
    this.svg = svg;
    this.store = store;
    this.history = history;
    this.selectedLayer = selectedLayer;

    this.group = document.createElementNS(SVG_NS, 'g');
    this.group.classList.add('truchet-grid__overlay');
    this.svg.appendChild(this.group);

    this.unsubscribeStore = store.subscribe(() => this.render());
    this.unsubscribeSelection = selectedLayer.subscribe(() => this.render());
    this.render();
  }

  destroy(): void {
    this.unsubscribeStore();
    this.unsubscribeSelection();
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.group.remove();
  }

  private pixelsPerUnit(): number {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return 1;
    return Math.hypot(ctm.a, ctm.b) || 1;
  }

  private render(): void {
    this.group.replaceChildren();

    const selected = findSelected(this.store.get(), this.selectedLayer.get());
    if (!selected) return;
    const { geometry } = selected;
    const scale = this.pixelsPerUnit();
    const handleRadius = HANDLE_RADIUS_PX / scale;
    const rotateOffset = ROTATE_HANDLE_OFFSET_PX / scale;

    const rotateGroup = document.createElementNS(SVG_NS, 'g');
    if (selected.fill.rotation) {
      rotateGroup.setAttribute('transform', `rotate(${selected.fill.rotation} ${geometry.cx} ${geometry.cy})`);
    }

    const bounds = document.createElementNS(SVG_NS, 'rect');
    bounds.classList.add('truchet-grid__overlay-bounds');
    bounds.setAttribute('x', String(geometry.displayX));
    bounds.setAttribute('y', String(geometry.displayY));
    bounds.setAttribute('width', String(geometry.displayWidth));
    bounds.setAttribute('height', String(geometry.displayHeight));
    bounds.addEventListener('pointerdown', (event) => this.startDrag(event, 'move'));

    const rotateAnchorX = geometry.cx;
    const rotateAnchorY = geometry.displayY - rotateOffset;
    const rotateLine = document.createElementNS(SVG_NS, 'line');
    rotateLine.classList.add('truchet-grid__overlay-rotate-line');
    rotateLine.setAttribute('x1', String(geometry.cx));
    rotateLine.setAttribute('y1', String(geometry.displayY));
    rotateLine.setAttribute('x2', String(rotateAnchorX));
    rotateLine.setAttribute('y2', String(rotateAnchorY));

    const rotateHandle = document.createElementNS(SVG_NS, 'circle');
    rotateHandle.classList.add('truchet-grid__overlay-handle', 'truchet-grid__overlay-handle--rotate');
    rotateHandle.setAttribute('cx', String(rotateAnchorX));
    rotateHandle.setAttribute('cy', String(rotateAnchorY));
    rotateHandle.setAttribute('r', String(handleRadius));
    rotateHandle.addEventListener('pointerdown', (event) => this.startDrag(event, 'rotate'));

    const resizeHandle = document.createElementNS(SVG_NS, 'circle');
    resizeHandle.classList.add('truchet-grid__overlay-handle', 'truchet-grid__overlay-handle--resize');
    resizeHandle.setAttribute('cx', String(geometry.displayX + geometry.displayWidth));
    resizeHandle.setAttribute('cy', String(geometry.displayY + geometry.displayHeight));
    resizeHandle.setAttribute('r', String(handleRadius));
    resizeHandle.addEventListener('pointerdown', (event) => this.startDrag(event, 'resize'));

    rotateGroup.append(bounds, rotateLine, rotateHandle, resizeHandle);
    this.group.appendChild(rotateGroup);
  }

  private clientToGrid(clientX: number, clientY: number): { x: number; y: number } {
    const ctm = this.svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = this.svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  private startDrag = (event: PointerEvent, mode: DragMode): void => {
    if (event.button !== 0) return;
    const selected = findSelected(this.store.get(), this.selectedLayer.get());
    if (!selected) return;

    event.preventDefault();
    event.stopPropagation();

    const startGrid = this.clientToGrid(event.clientX, event.clientY);
    const center = { x: selected.geometry.cx, y: selected.geometry.cy };

    this.history.record();
    this.drag = {
      mode,
      layerId: selected.layer.id,
      fill: selected.fill,
      center,
      startGrid,
      startDistance: Math.max(distance(center, startGrid), 0.0001),
    };

    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp, { once: true });
  };

  private handlePointerMove = (event: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    const point = this.clientToGrid(event.clientX, event.clientY);

    if (drag.mode === 'move') {
      const doc = this.store.get();
      const dx = point.x - drag.startGrid.x;
      const dy = point.y - drag.startGrid.y;
      const position = {
        x: drag.fill.position.x + dx / doc.grid.columns,
        y: drag.fill.position.y + dy / doc.grid.rows,
      };
      this.updateFill(drag.layerId, { ...drag.fill, position });
      return;
    }

    if (drag.mode === 'resize') {
      const ratio = distance(drag.center, point) / drag.startDistance;
      const scale = clamp(drag.fill.scale * ratio, MIN_SCALE, MAX_SCALE);
      this.updateFill(drag.layerId, { ...drag.fill, scale });
      return;
    }

    const angle = (Math.atan2(point.y - drag.center.y, point.x - drag.center.x) * 180) / Math.PI + 90;
    const normalized = ((((angle + 180) % 360) + 360) % 360) - 180;
    this.updateFill(drag.layerId, { ...drag.fill, rotation: Math.round(normalized) });
  };

  private handlePointerUp = (): void => {
    this.drag = null;
    window.removeEventListener('pointermove', this.handlePointerMove);
  };

  private updateFill(layerId: string, fill: ImageFill): void {
    this.store.update((doc) => setLayerFill(doc, layerId, fill));
  }
}
