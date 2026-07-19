import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import type { EditorModeStore } from '../edit/EditorModeStore';
import type { ActiveSelectionStore } from '../edit/ActiveSelectionStore';
import { SelectionEngine } from '../edit/SelectionEngine';
import { GridEditingController } from '../edit/GridEditingController';
import { TruchetRenderer } from '../render/TruchetRenderer';

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
): HTMLElement {
  const element = document.createElement('main');
  element.className = 'canvas-area';
  element.setAttribute('aria-label', 'Canvas');

  const viewport = document.createElement('div');
  viewport.className = 'canvas-area__viewport';

  const selectionEngine = new SelectionEngine();
  const renderer = new TruchetRenderer(viewport, store, selectionEngine);
  new GridEditingController(renderer.svg, store, history, selectionEngine, editorMode, activeSelection);
  bindActiveSelectionHighlight(store, editorMode, activeSelection, selectionEngine);

  element.appendChild(viewport);
  return element;
}
