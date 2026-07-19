import type { DocumentStore } from '../document/DocumentStore';
import type { TileOrientation } from '../document/types';
import { flipOrientation, setTileOrientation } from '../document/gridEditing';
import { getTriangleId, type TriangleHalf } from '../render/tileGeometry';
import type { HistoryManager } from './HistoryManager';
import { SelectionEngine } from './SelectionEngine';

interface TriangleTarget {
  tileId: string;
  triangleId: string;
}

function triangleTargetFromElement(element: Element | null): TriangleTarget | null {
  if (!(element instanceof SVGElement)) return null;
  const tileId = element.dataset.tileId;
  const half = element.dataset.half as TriangleHalf | undefined;
  if (!tileId || (half !== 'a' && half !== 'b')) return null;
  return { tileId, triangleId: getTriangleId(tileId, half) };
}

/**
 * Wires pointer/keyboard interaction on the grid SVG to document edits:
 * click a triangle to flip its tile, drag to paint a run of tiles to the
 * same orientation, shift-click to build a multi-triangle selection.
 */
export class GridEditingController {
  private paintOrientation: TileOrientation | null = null;
  private readonly paintedTileIds = new Set<string>();

  private readonly svg: SVGSVGElement;
  private readonly store: DocumentStore;
  private readonly history: HistoryManager;
  private readonly selectionEngine: SelectionEngine;

  constructor(svg: SVGSVGElement, store: DocumentStore, history: HistoryManager, selectionEngine: SelectionEngine) {
    this.svg = svg;
    this.store = store;
    this.history = history;
    this.selectionEngine = selectionEngine;

    this.svg.addEventListener('pointerdown', this.handlePointerDown);
    this.svg.addEventListener('pointermove', this.handleHoverMove);
    this.svg.addEventListener('pointerleave', this.handlePointerLeave);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy(): void {
    this.svg.removeEventListener('pointerdown', this.handlePointerDown);
    this.svg.removeEventListener('pointermove', this.handleHoverMove);
    this.svg.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('pointermove', this.handleDragMove);
    window.removeEventListener('pointerup', this.handleDragEnd);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const target = triangleTargetFromElement(event.target as Element | null);
    if (!target) return;

    if (event.shiftKey) {
      this.selectionEngine.toggle(target.triangleId);
      return;
    }

    const tile = this.findTile(target.tileId);
    if (!tile) return;

    this.history.record();
    this.paintOrientation = flipOrientation(tile.orientation);
    this.paintedTileIds.clear();
    this.paintedTileIds.add(target.tileId);
    this.applyPaint(target.tileId);
    this.selectionEngine.select(target.triangleId);

    window.addEventListener('pointermove', this.handleDragMove);
    window.addEventListener('pointerup', this.handleDragEnd, { once: true });
  };

  private handleDragMove = (event: PointerEvent): void => {
    if (this.paintOrientation === null) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const target = triangleTargetFromElement(element);
    if (!target || this.paintedTileIds.has(target.tileId)) return;
    this.paintedTileIds.add(target.tileId);
    this.applyPaint(target.tileId);
  };

  private handleDragEnd = (): void => {
    this.paintOrientation = null;
    this.paintedTileIds.clear();
    window.removeEventListener('pointermove', this.handleDragMove);
  };

  private handleHoverMove = (event: PointerEvent): void => {
    const target = triangleTargetFromElement(event.target as Element | null);
    this.selectionEngine.setHovered(target ? target.triangleId : null);
  };

  private handlePointerLeave = (): void => {
    this.selectionEngine.setHovered(null);
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (event.key === 'Escape') {
      this.selectionEngine.clear();
      return;
    }

    const key = event.key.toLowerCase();
    const withModifier = event.ctrlKey || event.metaKey;
    if (withModifier && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.history.undo();
    } else if (withModifier && ((key === 'z' && event.shiftKey) || key === 'y')) {
      event.preventDefault();
      this.history.redo();
    }
  };

  private applyPaint(tileId: string): void {
    if (this.paintOrientation === null) return;
    const orientation = this.paintOrientation;
    this.store.update((doc) => ({ ...doc, grid: setTileOrientation(doc.grid, tileId, orientation) }));
  }

  private findTile(tileId: string) {
    return this.store.get().grid.tiles.find((tile) => tile.id === tileId);
  }
}
