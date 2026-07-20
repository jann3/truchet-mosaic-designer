import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import { EditorModeStore } from '../edit/EditorModeStore';
import { ActiveSelectionStore } from '../edit/ActiveSelectionStore';
import { SelectedLayerStore } from '../edit/SelectedLayerStore';
import { createToolbar } from './Toolbar';
import { ResizablePanel } from './ResizablePanel';
import { createLayersPanelContent } from './LayersPanel';
import { createInspectorPanelContent } from './InspectorPanel';
import { createCanvasArea } from './CanvasArea';
import { createExportDialog } from './ExportDialog';
import { createConfirmDialog } from './ConfirmDialog';
import { createShortcutsDialog } from './ShortcutsDialog';
import { ProjectController } from '../project/ProjectController';
import { GlobalShortcuts } from '../edit/GlobalShortcuts';
import { initHighContrastPreference, isHighContrastEnabled, toggleHighContrast } from './preferences';

const PANEL_MIN_WIDTH = 160;
const PANEL_MAX_WIDTH = 448;
const PANEL_INITIAL_WIDTH = 280;

export function createAppShell(store: DocumentStore, history: HistoryManager): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const editorMode = new EditorModeStore();
  const activeSelection = new ActiveSelectionStore();
  const selectedLayer = new SelectedLayerStore();

  const layersPanel = new ResizablePanel({
    id: 'layers',
    title: 'Layers',
    side: 'left',
    cssVar: '--layers-col-width',
    shell,
    min: PANEL_MIN_WIDTH,
    max: PANEL_MAX_WIDTH,
    initial: PANEL_INITIAL_WIDTH,
    content: createLayersPanelContent(store, history, selectedLayer),
  });

  const inspectorPanel = new ResizablePanel({
    id: 'inspector',
    title: 'Inspector',
    side: 'right',
    cssVar: '--inspector-col-width',
    shell,
    min: PANEL_MIN_WIDTH,
    max: PANEL_MAX_WIDTH,
    initial: PANEL_INITIAL_WIDTH,
    content: createInspectorPanelContent(store, history, editorMode, activeSelection),
  });

  const canvasArea = createCanvasArea(store, history, editorMode, activeSelection, selectedLayer);
  const toolbar = createToolbar(history, editorMode);

  toolbar.layersButton.addEventListener('click', () => {
    const collapsed = layersPanel.toggleCollapsed();
    shell.dataset.layersCollapsed = String(collapsed);
    toolbar.layersButton.setAttribute('aria-pressed', String(!collapsed));
  });

  toolbar.inspectorButton.addEventListener('click', () => {
    const collapsed = inspectorPanel.toggleCollapsed();
    shell.dataset.inspectorCollapsed = String(collapsed);
    toolbar.inspectorButton.setAttribute('aria-pressed', String(!collapsed));
  });

  const exportDialog = createExportDialog(store);
  toolbar.exportButton.addEventListener('click', () => exportDialog.open());

  const project = new ProjectController(store, history);
  const confirmDialog = createConfirmDialog();

  const updateProjectStatus = (): void => {
    const doc = store.get();
    toolbar.projectStatus.textContent = project.dirty ? `${doc.name} •` : doc.name;
    toolbar.projectStatus.title = project.dirty ? 'Unsaved changes' : 'All changes saved';
  };
  updateProjectStatus();
  store.subscribe(updateProjectStatus);
  project.subscribe(updateProjectStatus);

  toolbar.newButton.addEventListener('click', async () => {
    if (project.dirty) {
      const proceed = await confirmDialog.confirm({
        title: 'Start new project?',
        message: 'This discards your unsaved changes. This cannot be undone.',
        confirmLabel: 'Discard & start new',
      });
      if (!proceed) return;
    }
    project.newProject();
  });

  toolbar.saveButton.addEventListener('click', () => project.save());

  toolbar.openButton.addEventListener('click', () => toolbar.openFileInput.click());
  toolbar.openFileInput.addEventListener('change', async () => {
    const file = toolbar.openFileInput.files?.[0];
    toolbar.openFileInput.value = '';
    if (!file) return;

    if (project.dirty) {
      const proceed = await confirmDialog.confirm({
        title: 'Open project?',
        message: `Opening "${file.name}" discards your unsaved changes. This cannot be undone.`,
        confirmLabel: 'Discard & open',
      });
      if (!proceed) return;
    }

    try {
      await project.load(file);
    } catch (error) {
      await confirmDialog.confirm({
        title: 'Could not open project',
        message: error instanceof Error ? error.message : 'That file is not a valid Truchet project.',
        confirmLabel: 'OK',
        cancelLabel: null,
      });
    }
  });

  const recovery = project.pendingRecovery;
  if (recovery) {
    void confirmDialog
      .confirm({
        title: 'Restore autosaved project?',
        message: `Found unsaved work autosaved on ${new Date(recovery.savedAt).toLocaleString()}. Restore it, or discard and start fresh?`,
        confirmLabel: 'Restore',
        cancelLabel: 'Discard',
      })
      .then((restore) => {
        if (restore) project.restorePendingRecovery();
        else project.dismissPendingRecovery();
      });
  }

  const shortcutsDialog = createShortcutsDialog();
  toolbar.helpButton.addEventListener('click', () => shortcutsDialog.open());

  new GlobalShortcuts({
    save: toolbar.saveButton,
    open: toolbar.openButton,
    newProject: toolbar.newButton,
    help: toolbar.helpButton,
  });

  initHighContrastPreference();
  toolbar.contrastButton.setAttribute('aria-pressed', String(isHighContrastEnabled()));
  toolbar.contrastButton.addEventListener('click', () => {
    toolbar.contrastButton.setAttribute('aria-pressed', String(toggleHighContrast()));
  });

  shell.append(
    toolbar.element,
    layersPanel.element,
    canvasArea,
    inspectorPanel.element,
    exportDialog.element,
    confirmDialog.element,
    shortcutsDialog.element,
  );

  return shell;
}
