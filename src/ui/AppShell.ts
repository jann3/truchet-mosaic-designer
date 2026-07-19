import type { DocumentStore } from '../document/DocumentStore';
import { createToolbar } from './Toolbar';
import { ResizablePanel } from './ResizablePanel';
import { createLayersPanelContent } from './LayersPanel';
import { createInspectorPanelContent } from './InspectorPanel';
import { createCanvasArea } from './CanvasArea';

const PANEL_MIN_WIDTH = 160;
const PANEL_MAX_WIDTH = 448;
const PANEL_INITIAL_WIDTH = 280;

export function createAppShell(store: DocumentStore): HTMLElement {
  const shell = document.createElement('div');
  shell.className = 'app-shell';

  const layersPanel = new ResizablePanel({
    id: 'layers',
    title: 'Layers',
    side: 'left',
    cssVar: '--layers-col-width',
    shell,
    min: PANEL_MIN_WIDTH,
    max: PANEL_MAX_WIDTH,
    initial: PANEL_INITIAL_WIDTH,
    content: createLayersPanelContent(),
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
    content: createInspectorPanelContent(),
  });

  const canvasArea = createCanvasArea(store);
  const toolbar = createToolbar();

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

  shell.append(toolbar.element, layersPanel.element, canvasArea, inspectorPanel.element);

  return shell;
}
