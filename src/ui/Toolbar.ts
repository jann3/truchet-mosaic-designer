import type { HistoryManager } from '../edit/HistoryManager';
import type { EditorModeStore } from '../edit/EditorModeStore';

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

function createModeGroup(editorMode: EditorModeStore): HTMLElement {
  const group = document.createElement('div');
  group.className = 'toolbar__group';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Canvas tool');

  const editButton = createActionButton('Edit', 'Edit tool: click or drag to flip tile orientation');
  const selectButton = createActionButton('Select', 'Select tool: click or drag to build the active selection');

  const updateButtons = (): void => {
    const mode = editorMode.get();
    editButton.setAttribute('aria-pressed', String(mode === 'edit'));
    selectButton.setAttribute('aria-pressed', String(mode === 'select'));
  };
  updateButtons();
  editorMode.subscribe(updateButtons);

  editButton.addEventListener('click', () => editorMode.set('edit'));
  selectButton.addEventListener('click', () => editorMode.set('select'));

  group.append(editButton, selectButton);
  return group;
}

export function createToolbar(history: HistoryManager, editorMode: EditorModeStore): ToolbarHandle {
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

  const modeGroup = createModeGroup(editorMode);

  const spacer = document.createElement('div');
  spacer.className = 'toolbar__spacer';

  const panelGroup = document.createElement('div');
  panelGroup.className = 'toolbar__group';
  panelGroup.setAttribute('role', 'group');
  panelGroup.setAttribute('aria-label', 'Toggle panels');

  const layersButton = createToggleButton('Layers');
  const inspectorButton = createToggleButton('Inspector');

  panelGroup.append(layersButton, inspectorButton);
  element.append(brand, historyGroup, modeGroup, spacer, panelGroup);

  return { element, layersButton, inspectorButton, undoButton, redoButton };
}
