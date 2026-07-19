import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import { createGridConfigPanel } from './GridConfigPanel';

export function createInspectorPanelContent(store: DocumentStore, history: HistoryManager): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'inspector-panel';
  wrapper.appendChild(createGridConfigPanel(store, history));
  return wrapper;
}
