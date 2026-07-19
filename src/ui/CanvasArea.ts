import type { DocumentStore } from '../document/DocumentStore';
import { TruchetRenderer } from '../render/TruchetRenderer';

export function createCanvasArea(store: DocumentStore): HTMLElement {
  const element = document.createElement('main');
  element.className = 'canvas-area';
  element.setAttribute('aria-label', 'Canvas');

  const viewport = document.createElement('div');
  viewport.className = 'canvas-area__viewport';

  new TruchetRenderer(viewport, store);

  element.appendChild(viewport);
  return element;
}
