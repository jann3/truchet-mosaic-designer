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

  shell.append(toolbar.element, layersPanel.element, canvasArea, inspectorPanel.element, exportDialog.element);

  return shell;
}
