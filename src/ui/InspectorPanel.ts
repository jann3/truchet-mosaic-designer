import type { DocumentStore } from '../document/DocumentStore';
import { createGridConfigPanel } from './GridConfigPanel';

export function createInspectorPanelContent(store: DocumentStore): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'inspector-panel';
  wrapper.appendChild(createGridConfigPanel(store));
  return wrapper;
}
