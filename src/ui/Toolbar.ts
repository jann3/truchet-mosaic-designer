import type { HistoryManager } from '../edit/HistoryManager';

export interface ToolbarHandle {
  element: HTMLElement;
  layersButton: HTMLButtonElement;
  inspectorButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
}

function createToggleButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toolbar__button';
  button.textContent = label;
  button.setAttribute('aria-pressed', 'true');
  return button;
}

function createActionButton(label: string, ariaLabel: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toolbar__button';
  button.textContent = label;
  button.title = ariaLabel;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

export function createToolbar(history: HistoryManager): ToolbarHandle {
  const element = document.createElement('header');
  element.className = 'toolbar';
  element.setAttribute('role', 'banner');

  const brand = document.createElement('span');
  brand.className = 'toolbar__brand';
  brand.textContent = 'Truchet Mosaic Designer';

  const historyGroup = document.createElement('div');
  historyGroup.className = 'toolbar__group';
  historyGroup.setAttribute('role', 'group');
  historyGroup.setAttribute('aria-label', 'Undo history');

  const undoButton = createActionButton('↶', 'Undo');
  const redoButton = createActionButton('↷', 'Redo');

  const updateHistoryButtons = (): void => {
    undoButton.disabled = !history.canUndo;
    redoButton.disabled = !history.canRedo;
  };
  updateHistoryButtons();
  history.subscribe(updateHistoryButtons);

  undoButton.addEventListener('click', () => history.undo());
  redoButton.addEventListener('click', () => history.redo());

  historyGroup.append(undoButton, redoButton);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar__spacer';

  const panelGroup = document.createElement('div');
  panelGroup.className = 'toolbar__group';
  panelGroup.setAttribute('role', 'group');
  panelGroup.setAttribute('aria-label', 'Toggle panels');

  const layersButton = createToggleButton('Layers');
  const inspectorButton = createToggleButton('Inspector');

  panelGroup.append(layersButton, inspectorButton);
  element.append(brand, historyGroup, spacer, panelGroup);

  return { element, layersButton, inspectorButton, undoButton, redoButton };
}
