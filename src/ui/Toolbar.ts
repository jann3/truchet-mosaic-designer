import type { HistoryManager } from '../edit/HistoryManager';
import type { EditorModeStore } from '../edit/EditorModeStore';

export interface ToolbarHandle {
  element: HTMLElement;
  layersButton: HTMLButtonElement;
  inspectorButton: HTMLButtonElement;
  undoButton: HTMLButtonElement;
  redoButton: HTMLButtonElement;
  exportButton: HTMLButtonElement;
  newButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  openButton: HTMLButtonElement;
  openFileInput: HTMLInputElement;
  projectStatus: HTMLElement;
  contrastButton: HTMLButtonElement;
  helpButton: HTMLButtonElement;
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

function createFileGroup(): {
  group: HTMLElement;
  newButton: HTMLButtonElement;
  saveButton: HTMLButtonElement;
  openButton: HTMLButtonElement;
  openFileInput: HTMLInputElement;
} {
  const group = document.createElement('div');
  group.className = 'toolbar__group';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Project file');

  const newButton = createActionButton('New', 'Start a new, empty project');
  const saveButton = createActionButton('Save', 'Save the project to a .truchet file');
  const openButton = createActionButton('Open', 'Open a .truchet project file');

  const openFileInput = document.createElement('input');
  openFileInput.type = 'file';
  openFileInput.accept = '.truchet';
  openFileInput.hidden = true;

  group.append(newButton, saveButton, openButton, openFileInput);
  return { group, newButton, saveButton, openButton, openFileInput };
}

function createA11yGroup(): { group: HTMLElement; contrastButton: HTMLButtonElement; helpButton: HTMLButtonElement } {
  const group = document.createElement('div');
  group.className = 'toolbar__group';
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Accessibility');

  const contrastButton = createActionButton('Contrast', 'Toggle high-contrast mode');
  contrastButton.setAttribute('aria-pressed', 'false');

  const helpButton = createActionButton('?', 'Keyboard shortcuts');

  group.append(contrastButton, helpButton);
  return { group, contrastButton, helpButton };
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

  const projectStatus = document.createElement('span');
  projectStatus.className = 'toolbar__project-status';
  projectStatus.setAttribute('aria-live', 'polite');

  const { group: fileGroup, newButton, saveButton, openButton, openFileInput } = createFileGroup();

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

  const exportButton = createActionButton('Export', 'Export the design as an image or SVG');

  const { group: a11yGroup, contrastButton, helpButton } = createA11yGroup();

  element.append(
    brand,
    projectStatus,
    fileGroup,
    historyGroup,
    modeGroup,
    spacer,
    exportButton,
    a11yGroup,
    panelGroup,
  );

  return {
    element,
    layersButton,
    inspectorButton,
    undoButton,
    redoButton,
    exportButton,
    newButton,
    saveButton,
    openButton,
    openFileInput,
    projectStatus,
    contrastButton,
    helpButton,
  };
}
