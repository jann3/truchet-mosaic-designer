export interface ToolbarHandle {
  element: HTMLElement;
  layersButton: HTMLButtonElement;
  inspectorButton: HTMLButtonElement;
}

function createToggleButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toolbar__button';
  button.textContent = label;
  button.setAttribute('aria-pressed', 'true');
  return button;
}

export function createToolbar(): ToolbarHandle {
  const element = document.createElement('header');
  element.className = 'toolbar';
  element.setAttribute('role', 'banner');

  const brand = document.createElement('span');
  brand.className = 'toolbar__brand';
  brand.textContent = 'Truchet Mosaic Designer';

  const spacer = document.createElement('div');
  spacer.className = 'toolbar__spacer';

  const panelGroup = document.createElement('div');
  panelGroup.className = 'toolbar__group';
  panelGroup.setAttribute('role', 'group');
  panelGroup.setAttribute('aria-label', 'Toggle panels');

  const layersButton = createToggleButton('Layers');
  const inspectorButton = createToggleButton('Inspector');

  panelGroup.append(layersButton, inspectorButton);
  element.append(brand, spacer, panelGroup);

  return { element, layersButton, inspectorButton };
}
