import type { Grid } from '../document/types';
import type { DocumentStore } from '../document/DocumentStore';
import { getTileTriangles } from './tileGeometry';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Renders a document's grid as an SVG of Truchet tile triangles. The SVG's
 * viewBox tracks the grid's column/row count and scales via CSS (width/height
 * 100%), so it resizes with its container and stays vector-sharp at any
 * resolution without any pixel math here.
 */
export class TruchetRenderer {
  readonly svg: SVGSVGElement;
  private readonly unsubscribe: () => void;

  constructor(container: HTMLElement, store: DocumentStore) {
    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('truchet-grid');
    container.appendChild(this.svg);

    this.render(store.get().grid);
    this.unsubscribe = store.subscribe((doc) => this.render(doc.grid));
  }

  destroy(): void {
    this.unsubscribe();
    this.svg.remove();
  }

  private render(grid: Grid): void {
    this.svg.setAttribute('viewBox', `0 0 ${grid.columns} ${grid.rows}`);
    this.svg.replaceChildren();

    const fragment = document.createDocumentFragment();
    for (const tile of grid.tiles) {
      const { a, b } = getTileTriangles(tile);
      fragment.appendChild(this.createTriangle(a.points, 'truchet-grid__triangle--a'));
      fragment.appendChild(this.createTriangle(b.points, 'truchet-grid__triangle--b'));
    }
    this.svg.appendChild(fragment);
  }

  private createTriangle(points: readonly (readonly [number, number])[], className: string): SVGPolygonElement {
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', points.map(([x, y]) => `${x},${y}`).join(' '));
    polygon.classList.add(className);
    return polygon;
  }
}
