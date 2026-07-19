import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import type { EditorModeStore } from '../edit/EditorModeStore';
import type { ActiveSelectionStore } from '../edit/ActiveSelectionStore';
import { createGridConfigPanel } from './GridConfigPanel';
import { createSelectionsPanel } from './SelectionsPanel';

export function createInspectorPanelContent(
  store: DocumentStore,
  history: HistoryManager,
  editorMode: EditorModeStore,
  activeSelection: ActiveSelectionStore,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'inspector-panel';
  wrapper.appendChild(createGridConfigPanel(store, history));
  wrapper.appendChild(createSelectionsPanel(store, history, editorMode, activeSelection));
  return wrapper;
}
