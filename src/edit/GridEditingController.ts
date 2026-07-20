import type { DocumentStore } from '../document/DocumentStore';
import type { TileOrientation, TruchetDocument } from '../document/types';
import { flipOrientation, setTileOrientation } from '../document/gridEditing';
import { toggleSelectionTriangle } from '../document/selectionsCrud';
import { getTriangleId, parseTriangleId, type TriangleHalf } from '../render/tileGeometry';
import { isTypingTarget } from '../utils/isTypingTarget';
import type { ActiveSelectionStore } from './ActiveSelectionStore';
import type { EditorModeStore } from './EditorModeStore';
import type { HistoryManager } from './HistoryManager';
import { SelectionEngine } from './SelectionEngine';

const DEFAULT_ORIENTATION: TileOrientation = 'black-top-right';

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
 * Wires pointer/keyboard interaction on the grid SVG to document edits. In
 * 'edit' mode (default, Phase 5): click a triangle to flip its tile, drag to
 * paint a run of tiles to the same orientation, shift-click to build an
 * ephemeral multi-selection. In 'select' mode (Phase 6): click/drag toggles
 * triangles into/out of the active named Selection instead.
 *
 * Phase 13 adds full keyboard operability via a roving tabindex: exactly one
 * triangle is tab-reachable at a time (arrow keys move it — a per-triangle
 * tab stop would make the grid impossible to tab past), with Enter/Space
 * mirroring a click and Delete/Backspace giving keyboard users a
 * deterministic "take this out" action (reset the tile / exclude the
 * triangle from the active selection) distinct from Enter's toggle.
 */
export class GridEditingController {
  private paintOrientation: TileOrientation | null = null;
  private selectPaintInclude: boolean | null = null;
  private readonly paintedTileIds = new Set<string>();
  private focusedTriangleId: string | null = null;

  private readonly svg: SVGSVGElement;
  private readonly store: DocumentStore;
  private readonly history: HistoryManager;
  private readonly selectionEngine: SelectionEngine;
  private readonly editorMode: EditorModeStore;
  private readonly activeSelection: ActiveSelectionStore;
  private readonly unsubscribeRoving: () => void;

  constructor(
    svg: SVGSVGElement,
    store: DocumentStore,
    history: HistoryManager,
    selectionEngine: SelectionEngine,
    editorMode: EditorModeStore,
    activeSelection: ActiveSelectionStore,
  ) {
    this.svg = svg;
    this.store = store;
    this.history = history;
    this.selectionEngine = selectionEngine;
    this.editorMode = editorMode;
    this.activeSelection = activeSelection;

    this.svg.addEventListener('pointerdown', this.handlePointerDown);
    this.svg.addEventListener('pointermove', this.handleHoverMove);
    this.svg.addEventListener('pointerleave', this.handlePointerLeave);
    this.svg.addEventListener('keydown', this.handleGridKeyDown);
    window.addEventListener('keydown', this.handleKeyDown);

    // Re-applied after every document change: `TruchetRenderer` rebuilds
    // every triangle element on every render, so the roving tabindex would
    // otherwise vanish (leaving the grid with no tab stop at all) the moment
    // anything in the document changes. Registered after `TruchetRenderer`'s
    // own subscription (constructed first in `CanvasArea`), so the DOM it
    // queries already reflects the new document.
    this.unsubscribeRoving = this.store.subscribe(() => this.applyRovingTabIndex());
    this.applyRovingTabIndex();
  }

  destroy(): void {
    this.svg.removeEventListener('pointerdown', this.handlePointerDown);
    this.svg.removeEventListener('pointermove', this.handleHoverMove);
    this.svg.removeEventListener('pointerleave', this.handlePointerLeave);
    this.svg.removeEventListener('keydown', this.handleGridKeyDown);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('pointermove', this.handleDragMove);
    window.removeEventListener('pointerup', this.handleDragEnd);
    this.unsubscribeRoving();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const target = triangleTargetFromElement(event.target as Element | null);
    if (!target) return;

    // SVG shapes aren't in the browser's default "click-focusable" set, so
    // without this the browser's own post-dispatch focus handling clobbers
    // our `.focus()` call below back to <body>.
    event.preventDefault();

    // Keeps keyboard navigation picking up from wherever the pointer last
    // interacted. `:focus-visible` only shows a ring for keyboard-triggered
    // focus, so this is invisible to mouse users.
    this.focusTriangle(target.triangleId);

    if (this.editorMode.get() === 'select') {
      this.startSelectDrag(target);
      return;
    }

    if (event.shiftKey) {
      this.selectionEngine.toggle(target.triangleId);
      return;
    }
    this.startPaintDrag(target);
  };

  private startPaintDrag(target: TriangleTarget): void {
    const tile = this.findTile(target.tileId);
    if (!tile) return;

    this.history.record();
    this.paintOrientation = flipOrientation(tile.orientation);
    this.paintedTileIds.clear();
    this.paintedTileIds.add(target.tileId);
    this.applyPaint(target.tileId);
    this.selectionEngine.select(target.triangleId);
    // `applyPaint` above rebuilds every triangle element, blowing away the
    // DOM focus `handlePointerDown` just set — re-focus the (now-recreated)
    // element it landed on.
    this.focusTriangle(target.triangleId);

    window.addEventListener('pointermove', this.handleDragMove);
    window.addEventListener('pointerup', this.handleDragEnd, { once: true });
  }

  private startSelectDrag(target: TriangleTarget): void {
    const activeId = this.activeSelection.get();
    if (!activeId) return;
    const selection = this.store.get().selections.find((s) => s.id === activeId);
    if (!selection) return;

    this.history.record();
    this.selectPaintInclude = !selection.triangleIds.includes(target.triangleId);
    this.paintedTileIds.clear();
    this.paintedTileIds.add(target.tileId);
    this.applySelectPaint(activeId, target.triangleId);
    this.focusTriangle(target.triangleId);

    window.addEventListener('pointermove', this.handleDragMove);
    window.addEventListener('pointerup', this.handleDragEnd, { once: true });
  }

  private handleDragMove = (event: PointerEvent): void => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const target = triangleTargetFromElement(element);
    if (!target) return;

    if (this.selectPaintInclude !== null) {
      const activeId = this.activeSelection.get();
      if (!activeId || this.paintedTileIds.has(target.tileId)) return;
      this.paintedTileIds.add(target.tileId);
      this.applySelectPaint(activeId, target.triangleId);
      this.focusTriangle(target.triangleId);
      return;
    }

    if (this.paintOrientation === null || this.paintedTileIds.has(target.tileId)) return;
    this.paintedTileIds.add(target.tileId);
    this.applyPaint(target.tileId);
    this.focusTriangle(target.triangleId);
  };

  private handleDragEnd = (): void => {
    this.paintOrientation = null;
    this.selectPaintInclude = null;
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
    if (isTypingTarget(event)) return;

    if (event.key === 'Escape') {
      if (this.editorMode.get() === 'edit') this.selectionEngine.clear();
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

  /** Arrow/Enter/Space/Delete handling for the focused triangle — scoped to the grid SVG so it never steals keys from other controls. */
  private handleGridKeyDown = (event: KeyboardEvent): void => {
    const target = triangleTargetFromElement(event.target as Element | null);
    if (!target) return;
    const half = parseTriangleId(target.triangleId).half;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        if (half === 'a') this.focusTriangle(getTriangleId(target.tileId, 'b'));
        else this.moveFocus(target, 0, 1, 'a');
        return;
      case 'ArrowLeft':
        event.preventDefault();
        if (half === 'b') this.focusTriangle(getTriangleId(target.tileId, 'a'));
        else this.moveFocus(target, 0, -1, 'b');
        return;
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(target, 1, 0, half);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(target, -1, 0, half);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.activateTarget(target, event.shiftKey);
        return;
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.deleteTarget(target);
        return;
    }
  };

  private moveFocus(target: TriangleTarget, rowDelta: number, columnDelta: number, half: TriangleHalf): void {
    const tile = this.findTile(target.tileId);
    if (!tile) return;
    const grid = this.store.get().grid;
    const row = Math.min(grid.rows - 1, Math.max(0, tile.row + rowDelta));
    const column = Math.min(grid.columns - 1, Math.max(0, tile.column + columnDelta));
    const destination = grid.tiles.find((candidate) => candidate.row === row && candidate.column === column);
    if (!destination) return;
    this.focusTriangle(getTriangleId(destination.id, half));
  }

  /** Enter/Space: flip the tile (edit mode), toggle it in the active selection (select mode), or — with Shift, in edit mode — toggle it in the ephemeral multi-selection, mirroring shift-click. */
  private activateTarget(target: TriangleTarget, additive: boolean): void {
    if (this.editorMode.get() === 'select') {
      this.toggleSelectTriangle(target.triangleId);
    } else if (additive) {
      this.selectionEngine.toggle(target.triangleId);
    } else {
      this.flipTile(target);
    }
    this.focusTriangle(target.triangleId);
  }

  /** Delete/Backspace: reset the tile to its default orientation (edit mode), or explicitly exclude the triangle from the active selection (select mode) — deterministic, unlike Enter's toggle. */
  private deleteTarget(target: TriangleTarget): void {
    if (this.editorMode.get() === 'select') {
      const activeId = this.activeSelection.get();
      if (!activeId) return;
      this.history.record();
      this.store.update((doc) => toggleSelectionTriangle(doc, activeId, target.triangleId, false));
    } else {
      this.history.record();
      this.store.update((doc) => ({
        ...doc,
        grid: setTileOrientation(doc.grid, target.tileId, DEFAULT_ORIENTATION),
      }));
    }
    this.focusTriangle(target.triangleId);
  }

  private flipTile(target: TriangleTarget): void {
    const tile = this.findTile(target.tileId);
    if (!tile) return;
    this.history.record();
    const orientation = flipOrientation(tile.orientation);
    this.store.update((doc) => ({ ...doc, grid: setTileOrientation(doc.grid, target.tileId, orientation) }));
    this.selectionEngine.select(target.triangleId);
  }

  private toggleSelectTriangle(triangleId: string): void {
    const activeId = this.activeSelection.get();
    if (!activeId) return;
    const selection = this.store.get().selections.find((s) => s.id === activeId);
    if (!selection) return;
    const include = !selection.triangleIds.includes(triangleId);
    this.history.record();
    this.store.update((doc) => toggleSelectionTriangle(doc, activeId, triangleId, include));
  }

  /** Moves the roving tabindex to `triangleId` and gives it real DOM focus — used for both arrow-key navigation and to restore focus after an edit rebuilds the grid's DOM. */
  private focusTriangle(triangleId: string): void {
    this.focusedTriangleId = triangleId;
    this.applyRovingTabIndex();
    this.findTriangleElement(triangleId)?.focus();
  }

  /** Keeps exactly one triangle in the tab order, falling back to the grid's first triangle if the previously-focused one no longer exists (e.g. after a resize). */
  private applyRovingTabIndex(): void {
    const doc = this.store.get();
    if (!this.focusedTriangleId || !this.tileExists(this.focusedTriangleId, doc)) {
      const firstTile = doc.grid.tiles[0];
      this.focusedTriangleId = firstTile ? getTriangleId(firstTile.id, 'a') : null;
    }
    const previous = this.svg.querySelector<SVGElement>('[tabindex="0"]');
    if (previous) previous.tabIndex = -1;
    const current = this.focusedTriangleId ? this.findTriangleElement(this.focusedTriangleId) : null;
    if (current) current.tabIndex = 0;
  }

  private tileExists(triangleId: string, doc: TruchetDocument): boolean {
    const { tileId } = parseTriangleId(triangleId);
    return doc.grid.tiles.some((tile) => tile.id === tileId);
  }

  private findTriangleElement(triangleId: string): SVGElement | null {
    const { tileId, half } = parseTriangleId(triangleId);
    return this.svg.querySelector<SVGElement>(`[data-tile-id="${tileId}"][data-half="${half}"]`);
  }

  private applyPaint(tileId: string): void {
    if (this.paintOrientation === null) return;
    const orientation = this.paintOrientation;
    this.store.update((doc) => ({ ...doc, grid: setTileOrientation(doc.grid, tileId, orientation) }));
  }

  private applySelectPaint(selectionId: string, triangleId: string): void {
    if (this.selectPaintInclude === null) return;
    const include = this.selectPaintInclude;
    this.store.update((doc) => toggleSelectionTriangle(doc, selectionId, triangleId, include));
  }

  private findTile(tileId: string) {
    return this.store.get().grid.tiles.find((tile) => tile.id === tileId);
  }
}
