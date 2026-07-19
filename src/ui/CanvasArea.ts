import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import { SelectionEngine } from '../edit/SelectionEngine';
import { GridEditingController } from '../edit/GridEditingController';
import { TruchetRenderer } from '../render/TruchetRenderer';

export function createCanvasArea(store: DocumentStore, history: HistoryManager): HTMLElement {
  const element = document.createElement('main');
  element.className = 'canvas-area';
  element.setAttribute('aria-label', 'Canvas');

  const viewport = document.createElement('div');
  viewport.className = 'canvas-area__viewport';

  const selectionEngine = new SelectionEngine();
  const renderer = new TruchetRenderer(viewport, store, selectionEngine);
  new GridEditingController(renderer.svg, store, history, selectionEngine);

  element.appendChild(viewport);
  return element;
}
