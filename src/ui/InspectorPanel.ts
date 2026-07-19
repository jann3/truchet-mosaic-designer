export function createInspectorPanelContent(): HTMLElement {
  const placeholder = document.createElement('p');
  placeholder.textContent = 'Selection and layer properties will appear here (Phase 4 onward).';
  return placeholder;
}
