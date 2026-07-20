import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import type { EditorModeStore } from '../edit/EditorModeStore';
import type { ActiveSelectionStore } from '../edit/ActiveSelectionStore';
import type { SelectedLayerStore } from '../edit/SelectedLayerStore';
import { SelectionEngine } from '../edit/SelectionEngine';
import { GridEditingController } from '../edit/GridEditingController';
import { ImageOverlayController } from '../edit/ImageOverlayController';
import { TruchetRenderer, GRID_INSTRUCTIONS_ID } from '../render/TruchetRenderer';

/** Mirrors the active named Selection's contents onto the canvas highlight while in select mode. */
function bindActiveSelectionHighlight(
  store: DocumentStore,
  editorMode: EditorModeStore,
  activeSelection: ActiveSelectionStore,
  selectionEngine: SelectionEngine,
): void {
  const sync = (): void => {
    if (editorMode.get() !== 'select') return;
    const activeId = activeSelection.get();
    const selection = activeId ? store.get().selections.find((s) => s.id === activeId) : null;
    selectionEngine.setSelected(selection ? selection.triangleIds : []);
  };

  store.subscribe(sync);
  activeSelection.subscribe(sync);
  editorMode.subscribe((mode) => {
    if (mode === 'edit') {
      selectionEngine.clear();
    } else {
      sync();
    }
  });
}

export function createCanvasArea(
  store: DocumentStore,
  history: HistoryManager,
  editorMode: EditorModeStore,
  activeSelection: ActiveSelectionStore,
  selectedLayer: SelectedLayerStore,
): HTMLElement {
  const element = document.createElement('main');
  element.className = 'canvas-area';
  element.setAttribute('aria-label', 'Canvas');

  const viewport = document.createElement('div');
  viewport.className = 'canvas-area__viewport';

  const instructions = document.createElement('p');
  instructions.id = GRID_INSTRUCTIONS_ID;
  instructions.className = 'visually-hidden';
  instructions.textContent =
    'Use the arrow keys to move between triangles. Press Enter or Space to flip the focused tile, or toggle it in the active selection while in select mode. Press Delete or Backspace to reset the tile, or remove it from the active selection. Press Escape to clear the temporary selection.';

  const selectionEngine = new SelectionEngine();
  const renderer = new TruchetRenderer(viewport, store, selectionEngine);
  new GridEditingController(renderer.svg, store, history, selectionEngine, editorMode, activeSelection);
  new ImageOverlayController(renderer.svg, store, history, selectedLayer);
  bindActiveSelectionHighlight(store, editorMode, activeSelection, selectionEngine);

  element.append(instructions, viewport);
  return element;
}
