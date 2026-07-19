export function createCanvasArea(): HTMLElement {
  const element = document.createElement('main');
  element.className = 'canvas-area';
  element.setAttribute('aria-label', 'Canvas');

  const viewport = document.createElement('div');
  viewport.className = 'canvas-area__viewport';
  viewport.textContent = 'Canvas — grid rendering arrives in Phase 3';

  element.appendChild(viewport);
  return element;
}
