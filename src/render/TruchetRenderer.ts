import type { Grid } from '../document/types';
import type { DocumentStore } from '../document/DocumentStore';
import type { SelectionEngine, SelectionState } from '../edit/SelectionEngine';
import { getTileTriangles, getTriangleId, type TriangleHalf } from './tileGeometry';

const SVG_NS = 'http://www.w3.org/2000/svg';

const EMPTY_SELECTION_STATE: SelectionState = { hoveredTriangleId: null, selectedTriangleIds: new Set() };

const HOVER_CLASS = 'truchet-grid__triangle--hover';
const SELECTED_CLASS = 'truchet-grid__triangle--selected';

/**
 * Renders a document's grid as an SVG of Truchet tile triangles. The SVG's
 * viewBox tracks the grid's column/row count and scales via CSS (width/height
 * 100%), so it resizes with its container and stays vector-sharp at any
 * resolution without any pixel math here. Also mirrors hover/selection state
 * from a `SelectionEngine` onto the affected triangles without re-rendering
 * the whole grid.
 */
export class TruchetRenderer {
  readonly svg: SVGSVGElement;
  private readonly unsubscribeDoc: () => void;
  private readonly unsubscribeSelection: () => void;
  private readonly triangleElements = new Map<string, SVGPolygonElement>();
  private appliedSelectionState: SelectionState = EMPTY_SELECTION_STATE;

  constructor(container: HTMLElement, store: DocumentStore, selectionEngine: SelectionEngine) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('truchet-grid');
    container.appendChild(this.svg);

    this.render(store.get().grid, selectionEngine.getState());
    this.unsubscribeDoc = store.subscribe((doc) => this.render(doc.grid, selectionEngine.getState()));
    this.unsubscribeSelection = selectionEngine.subscribe((state) => this.applyHighlightDiff(state));
  }

  destroy(): void {
    this.unsubscribeDoc();
    this.unsubscribeSelection();
    this.svg.remove();
  }

  private render(grid: Grid, selectionState: SelectionState): void {
    this.svg.setAttribute('viewBox', `0 0 ${grid.columns} ${grid.rows}`);
    this.svg.replaceChildren();
    this.triangleElements.clear();

    const fragment = document.createDocumentFragment();
    for (const tile of grid.tiles) {
      const { a, b } = getTileTriangles(tile);
      fragment.appendChild(this.createTriangle(tile.id, 'a', a.points, 'truchet-grid__triangle--a'));
      fragment.appendChild(this.createTriangle(tile.id, 'b', b.points, 'truchet-grid__triangle--b'));
    }
    this.svg.appendChild(fragment);

    // Freshly created elements carry no highlight classes yet, so re-apply
    // the current selection state against the new map rather than diffing.
    this.appliedSelectionState = EMPTY_SELECTION_STATE;
    this.applyHighlightDiff(selectionState);
  }

  private createTriangle(
    tileId: string,
    half: TriangleHalf,
    points: readonly (readonly [number, number])[],
    className: string,
  ): SVGPolygonElement {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', points.map(([x, y]) => `${x},${y}`).join(' '));
    polygon.classList.add(className);
    polygon.dataset.tileId = tileId;
    polygon.dataset.half = half;
    this.triangleElements.set(getTriangleId(tileId, half), polygon);
    return polygon;
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
