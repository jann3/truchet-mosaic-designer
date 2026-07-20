import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import type { SelectedLayerStore } from '../edit/SelectedLayerStore';
import type { Asset, BlendMode, Layer, LayerFill, LayerGroup, Selection } from '../document/types';
import {
  createLayer,
  deleteLayer,
  duplicateLayer,
  moveLayer,
  renameLayer,
  setLayerBlendMode,
  setLayerFill,
  setLayerOpacity,
  setLayerSelection,
  setLayerVisibility,
} from '../document/layersCrud';
import {
  createGroup,
  deleteGroup,
  renameGroup,
  setGroupOpacity,
  setGroupVisibility,
  toggleGroupCollapsed,
  ungroupLayer,
} from '../document/groupsCrud';
import { addImageAsset } from '../document/assetsCrud';
import { computeImageFillGeometry } from '../render/imageFillGeometry';

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'difference', label: 'Difference' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
];

function defaultFillFor(type: LayerFill['type']): LayerFill {
  if (type === 'solid') return { type: 'solid', color: '#4f8cff' };
  if (type === 'gradient') {
    return {
      type: 'gradient',
      angle: 180,
      stops: [
        { offset: 0, color: '#4f8cff' },
        { offset: 1, color: '#ffffff' },
      ],
    };
  }
  return {
    type: 'image',
    assetId: '',
    position: { x: 0.5, y: 0.5 },
    scale: 1,
    rotation: 0,
    crop: { x: 0, y: 0, width: 1, height: 1 },
  };
}

function readImageFile(file: File): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const src = reader.result as string;
      const image = new Image();
      image.onerror = () => reject(new Error('Could not decode image'));
      image.onload = () => resolve({ src, width: image.naturalWidth, height: image.naturalHeight });
      image.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Commits a continuous control (range, color picker, number field) to the
 * document on `change` — fired once when the gesture completes (slider
 * release, picker close, blur) rather than on every intermediate `input`
 * tick. The panel re-renders on every document change, which would tear
 * down an `input`-driven control mid-drag and drop focus; committing once
 * per gesture avoids that while still recording exactly one undo step.
 */
function bindCommittedInput(input: HTMLInputElement, history: HistoryManager, onCommit: () => void): void {
  input.addEventListener('change', () => {
    history.record();
    onCommit();
  });
}

export function createLayersPanelContent(
  store: DocumentStore,
  history: HistoryManager,
  selectedLayer: SelectedLayerStore,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'layers';

  /** Layers checked for the next "Group" action — ephemeral UI state, not part of the document. */
  const groupCandidates = new Set<string>();

  const render = (): void => {
    root.replaceChildren();
    const doc = store.get();
    root.appendChild(renderHeader());
    root.appendChild(renderList(doc.layers, doc.groups, doc.selections, doc.assets));
  };

  function renderHeader(): HTMLElement {
    const headerRow = document.createElement('div');
    headerRow.className = 'layers__header-row';

    const heading = document.createElement('h3');
    heading.className = 'layers__heading';
    heading.textContent = 'Layers';

    const groupButton = document.createElement('button');
    groupButton.type = 'button';
    groupButton.className = 'layers__new';
    groupButton.textContent = 'Group';
    groupButton.title = 'Group checked layers';
    groupButton.disabled = groupCandidates.size < 2;
    groupButton.addEventListener('click', () => {
      if (groupCandidates.size < 2) return;
      const ids = [...groupCandidates];
      groupCandidates.clear();
      history.record();
      store.update((doc) => createGroup(doc, `Group ${doc.groups.length + 1}`, ids));
    });

    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = 'layers__new';
    newButton.textContent = '+ New';
    newButton.addEventListener('click', () => {
      const name = `Layer ${store.get().layers.length + 1}`;
      history.record();
      store.update((doc) => createLayer(doc, name));
    });

    headerRow.append(heading, groupButton, newButton);
    return headerRow;
  }

  function renderList(layers: Layer[], groups: LayerGroup[], selections: Selection[], assets: Asset[]): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'layers__list';

    if (layers.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'layers__empty';
      empty.textContent = 'No layers yet.';
      list.appendChild(empty);
      return list;
    }

    const groupById = new Map(groups.map((group) => [group.id, group]));
    const renderedGroups = new Set<string>();

    // Topmost layer (last in document order — painted last, so on top) is shown first.
    for (const layer of [...layers].reverse()) {
      const group = layer.groupId ? groupById.get(layer.groupId) : undefined;
      if (!group) {
        list.appendChild(renderItem(layer, layers, selections, assets));
        continue;
      }
      if (renderedGroups.has(group.id)) continue;
      renderedGroups.add(group.id);

      const members = [...layers].reverse().filter((candidate) => candidate.groupId === group.id);
      list.appendChild(renderGroupBlock(group, members, layers, selections, assets));
    }
    return list;
  }

  function renderGroupBlock(
    group: LayerGroup,
    members: Layer[],
    allLayers: Layer[],
    selections: Selection[],
    assets: Asset[],
  ): HTMLElement {
    const item = document.createElement('li');
    item.className = 'layers__group';

    const header = document.createElement('div');
    header.className = 'layers__group-header';

    const collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'layers__item-action';
    collapseButton.title = group.collapsed ? 'Expand group' : 'Collapse group';
    collapseButton.setAttribute('aria-label', collapseButton.title);
    collapseButton.textContent = group.collapsed ? '\u{25B8}' : '\u{25BE}';
    collapseButton.addEventListener('click', () => {
      history.record();
      store.update((doc) => toggleGroupCollapsed(doc, group.id));
    });

    const visibilityButton = document.createElement('button');
    visibilityButton.type = 'button';
    visibilityButton.className = 'layers__item-action';
    visibilityButton.title = group.visible ? 'Hide group' : 'Show group';
    visibilityButton.setAttribute('aria-label', visibilityButton.title);
    visibilityButton.setAttribute('aria-pressed', String(group.visible));
    visibilityButton.textContent = group.visible ? '\u{1F441}' : '\u{2014}';
    visibilityButton.addEventListener('click', () => {
      history.record();
      store.update((doc) => setGroupVisibility(doc, group.id, !group.visible));
    });

    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'layers__item-name';
    nameButton.textContent = `${group.name} (${members.length})`;
    nameButton.title = 'Click to rename';
    nameButton.addEventListener('click', () => startGroupRename(item, group));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'layers__item-action';
    deleteButton.title = 'Ungroup';
    deleteButton.setAttribute('aria-label', 'Ungroup');
    deleteButton.textContent = '\u{2715}';
    deleteButton.addEventListener('click', () => {
      history.record();
      store.update((doc) => deleteGroup(doc, group.id));
    });

    header.append(collapseButton, visibilityButton, nameButton, deleteButton);
    item.appendChild(header);

    const opacityRow = document.createElement('div');
    opacityRow.className = 'layers__setting-row layers__group-opacity';
    const opacityLabel = document.createElement('label');
    opacityLabel.className = 'layers__setting-label';
    opacityLabel.textContent = 'Opacity';
    opacityLabel.htmlFor = `group-opacity-${group.id}`;
    const opacityRange = document.createElement('input');
    opacityRange.type = 'range';
    opacityRange.id = `group-opacity-${group.id}`;
    opacityRange.className = 'layers__setting-range';
    opacityRange.min = '0';
    opacityRange.max = '100';
    opacityRange.value = String(Math.round(group.opacity * 100));
    const opacityValue = document.createElement('span');
    opacityValue.className = 'layers__setting-value';
    opacityValue.textContent = `${opacityRange.value}%`;
    opacityRange.addEventListener('input', () => {
      opacityValue.textContent = `${opacityRange.value}%`;
    });
    bindCommittedInput(opacityRange, history, () => {
      store.update((doc) => setGroupOpacity(doc, group.id, Number(opacityRange.value) / 100));
    });
    opacityRow.append(opacityLabel, opacityRange, opacityValue);
    item.appendChild(opacityRow);

    if (!group.collapsed) {
      const memberList = document.createElement('ul');
      memberList.className = 'layers__group-members';
      for (const member of members) {
        memberList.appendChild(renderItem(member, allLayers, selections, assets));
      }
      item.appendChild(memberList);
    }

    return item;
  }

  function startGroupRename(item: HTMLElement, group: LayerGroup): void {
    const nameButton = item.querySelector<HTMLButtonElement>('.layers__item-name');
    if (!nameButton) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layers__item-rename';
    input.value = group.name;

    const commit = (): void => {
      const name = input.value.trim();
      if (name && name !== group.name) {
        history.record();
        store.update((doc) => renameGroup(doc, group.id, name));
      } else {
        render();
      }
    };

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') input.blur();
      if (event.key === 'Escape') render();
    });
    input.addEventListener('blur', commit, { once: true });

    nameButton.replaceWith(input);
    input.focus();
    input.select();
  }

  function renderItem(layer: Layer, allLayers: Layer[], selections: Selection[], assets: Asset[]): HTMLElement {
    const isActive = layer.id === selectedLayer.get();
    const item = document.createElement('li');
    item.className = 'layers__item';
    item.classList.toggle('layers__item--active', isActive);

    const row = document.createElement('div');
    row.className = 'layers__item-row';
    row.dataset.layerId = layer.id;
    // Not a native <button> because it hosts several nested action buttons
    // (visibility, move, duplicate, delete) — role/tabIndex/keydown make the
    // "select this layer" gesture itself keyboard-operable, matching the
    // existing click-anywhere-on-the-row behaviour.
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.setAttribute('aria-pressed', String(isActive));
    row.setAttribute(
      'aria-label',
      `${layer.name}, ${layer.visible ? 'visible' : 'hidden'}${isActive ? ', selected' : ''}`,
    );
    row.addEventListener('click', () => {
      selectedLayer.set(selectedLayer.get() === layer.id ? null : layer.id);
    });
    row.addEventListener('keydown', (event) => {
      if (event.target !== row) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectedLayer.set(selectedLayer.get() === layer.id ? null : layer.id);
        // `render()` rebuilds the whole list on every selection change,
        // destroying `row` — refocus the freshly-created element standing
        // in for the same layer so keyboard navigation isn't dropped back
        // to <body>.
        root.querySelector<HTMLElement>(`[data-layer-id="${layer.id}"]`)?.focus();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        history.record();
        store.update((doc) => deleteLayer(doc, layer.id));
        if (selectedLayer.get() === layer.id) selectedLayer.set(null);
      }
    });

    const groupCheckbox = document.createElement('input');
    groupCheckbox.type = 'checkbox';
    groupCheckbox.className = 'layers__item-checkbox';
    groupCheckbox.title = 'Select for grouping';
    groupCheckbox.setAttribute('aria-label', 'Select for grouping');
    groupCheckbox.checked = groupCandidates.has(layer.id);
    groupCheckbox.addEventListener('click', (event) => event.stopPropagation());
    groupCheckbox.addEventListener('change', () => {
      if (groupCheckbox.checked) groupCandidates.add(layer.id);
      else groupCandidates.delete(layer.id);
      render();
    });

    const visibilityButton = document.createElement('button');
    visibilityButton.type = 'button';
    visibilityButton.className = 'layers__item-action';
    visibilityButton.title = layer.visible ? 'Hide layer' : 'Show layer';
    visibilityButton.setAttribute('aria-label', layer.visible ? 'Hide layer' : 'Show layer');
    visibilityButton.setAttribute('aria-pressed', String(layer.visible));
    visibilityButton.textContent = layer.visible ? '\u{1F441}' : '\u{2014}';
    visibilityButton.addEventListener('click', (event) => {
      event.stopPropagation();
      history.record();
      store.update((doc) => setLayerVisibility(doc, layer.id, !layer.visible));
    });

    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'layers__item-name';
    nameButton.textContent = layer.name;
    nameButton.title = 'Click to rename';
    nameButton.addEventListener('click', () => startRename(item, layer));

    const moveUpButton = document.createElement('button');
    moveUpButton.type = 'button';
    moveUpButton.className = 'layers__item-action';
    moveUpButton.title = 'Move up';
    moveUpButton.setAttribute('aria-label', 'Move layer up');
    moveUpButton.textContent = '\u{2191}';
    moveUpButton.disabled = allLayers[allLayers.length - 1]?.id === layer.id;
    moveUpButton.addEventListener('click', (event) => {
      event.stopPropagation();
      history.record();
      store.update((doc) => moveLayer(doc, layer.id, 'up'));
    });

    const moveDownButton = document.createElement('button');
    moveDownButton.type = 'button';
    moveDownButton.className = 'layers__item-action';
    moveDownButton.title = 'Move down';
    moveDownButton.setAttribute('aria-label', 'Move layer down');
    moveDownButton.textContent = '\u{2193}';
    moveDownButton.disabled = allLayers[0]?.id === layer.id;
    moveDownButton.addEventListener('click', (event) => {
      event.stopPropagation();
      history.record();
      store.update((doc) => moveLayer(doc, layer.id, 'down'));
    });

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'layers__item-action';
    duplicateButton.title = 'Duplicate';
    duplicateButton.setAttribute('aria-label', 'Duplicate layer');
    duplicateButton.textContent = '\u{29C9}';
    duplicateButton.addEventListener('click', (event) => {
      event.stopPropagation();
      history.record();
      store.update((doc) => duplicateLayer(doc, layer.id));
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'layers__item-action';
    deleteButton.title = 'Delete';
    deleteButton.setAttribute('aria-label', 'Delete layer');
    deleteButton.textContent = '\u{2715}';
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      history.record();
      store.update((doc) => deleteLayer(doc, layer.id));
      if (selectedLayer.get() === layer.id) selectedLayer.set(null);
    });

    row.append(groupCheckbox, visibilityButton, nameButton, moveUpButton, moveDownButton, duplicateButton);

    if (layer.groupId) {
      const ungroupButton = document.createElement('button');
      ungroupButton.type = 'button';
      ungroupButton.className = 'layers__item-action';
      ungroupButton.title = 'Remove from group';
      ungroupButton.setAttribute('aria-label', 'Remove from group');
      ungroupButton.textContent = '\u{2923}';
      ungroupButton.addEventListener('click', (event) => {
        event.stopPropagation();
        history.record();
        store.update((doc) => ungroupLayer(doc, layer.id));
      });
      row.appendChild(ungroupButton);
    }

    row.appendChild(deleteButton);
    item.appendChild(row);
    item.appendChild(renderSettings(layer, selections, assets));
    return item;
  }

  function startRename(item: HTMLElement, layer: Layer): void {
    const nameButton = item.querySelector<HTMLButtonElement>('.layers__item-name');
    if (!nameButton) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layers__item-rename';
    input.value = layer.name;

    const commit = (): void => {
      const name = input.value.trim();
      if (name && name !== layer.name) {
        history.record();
        store.update((doc) => renameLayer(doc, layer.id, name));
      } else {
        render();
      }
    };

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') input.blur();
      if (event.key === 'Escape') render();
    });
    input.addEventListener('blur', commit, { once: true });

    nameButton.replaceWith(input);
    input.focus();
    input.select();
  }

  function renderSettings(layer: Layer, selections: Selection[], assets: Asset[]): HTMLElement {
    const settings = document.createElement('div');
    settings.className = 'layers__settings';

    settings.appendChild(renderOpacityRow(layer));
    settings.appendChild(renderBlendModeRow(layer));
    settings.appendChild(renderSelectionRow(layer, selections));
    settings.appendChild(renderFillTypeRow(layer));
    settings.appendChild(renderFillControls(layer, assets));

    return settings;
  }

  function renderOpacityRow(layer: Layer): HTMLElement {
    const row = document.createElement('div');
    row.className = 'layers__setting-row';

    const label = document.createElement('label');
    label.className = 'layers__setting-label';
    label.textContent = 'Opacity';
    label.htmlFor = `layer-opacity-${layer.id}`;

    const range = document.createElement('input');
    range.type = 'range';
    range.id = `layer-opacity-${layer.id}`;
    range.className = 'layers__setting-range';
    range.min = '0';
    range.max = '100';
    range.value = String(Math.round(layer.opacity * 100));

    const value = document.createElement('span');
    value.className = 'layers__setting-value';
    value.textContent = `${range.value}%`;

    // Update the visible percentage on every tick, but only touch the
    // document (and re-render the panel) once the drag/keypress commits.
    range.addEventListener('input', () => {
      value.textContent = `${range.value}%`;
    });
    bindCommittedInput(range, history, () => {
      store.update((doc) => setLayerOpacity(doc, layer.id, Number(range.value) / 100));
    });

    row.append(label, range, value);
    return row;
  }

  function renderBlendModeRow(layer: Layer): HTMLElement {
    const row = document.createElement('div');
    row.className = 'layers__setting-row';

    const label = document.createElement('label');
    label.className = 'layers__setting-label';
    label.textContent = 'Blend';
    label.htmlFor = `layer-blend-${layer.id}`;

    const select = document.createElement('select');
    select.id = `layer-blend-${layer.id}`;
    select.className = 'layers__setting-select';
    for (const mode of BLEND_MODES) {
      const option = document.createElement('option');
      option.value = mode.value;
      option.textContent = mode.label;
      option.selected = mode.value === layer.blendMode;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      history.record();
      store.update((doc) => setLayerBlendMode(doc, layer.id, select.value as BlendMode));
    });

    row.append(label, select);
    return row;
  }

  function renderSelectionRow(layer: Layer, selections: Selection[]): HTMLElement {
    const row = document.createElement('div');
    row.className = 'layers__setting-row';

    const label = document.createElement('label');
    label.className = 'layers__setting-label';
    label.textContent = 'Selection';
    label.htmlFor = `layer-selection-${layer.id}`;

    const select = document.createElement('select');
    select.id = `layer-selection-${layer.id}`;
    select.className = 'layers__setting-select';

    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = selections.length === 0 ? 'No selections yet' : 'None';
    noneOption.selected = layer.selectionId === null;
    select.appendChild(noneOption);

    for (const selection of selections) {
      const option = document.createElement('option');
      option.value = selection.id;
      option.textContent = selection.name;
      option.selected = selection.id === layer.selectionId;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      history.record();
      store.update((doc) => setLayerSelection(doc, layer.id, select.value || null));
    });

    row.append(label, select);
    return row;
  }

  function renderFillTypeRow(layer: Layer): HTMLElement {
    const row = document.createElement('div');
    row.className = 'layers__setting-row';

    const label = document.createElement('label');
    label.className = 'layers__setting-label';
    label.textContent = 'Fill';
    label.htmlFor = `layer-fill-${layer.id}`;

    const select = document.createElement('select');
    select.id = `layer-fill-${layer.id}`;
    select.className = 'layers__setting-select';
    for (const type of ['solid', 'gradient', 'image'] as const) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type[0].toUpperCase() + type.slice(1);
      option.selected = type === layer.fill.type;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      history.record();
      const type = select.value as LayerFill['type'];
      store.update((doc) => setLayerFill(doc, layer.id, defaultFillFor(type)));
    });

    row.append(label, select);
    return row;
  }

  function renderFillControls(layer: Layer, assets: Asset[]): HTMLElement {
    if (layer.fill.type === 'solid') return renderSolidFillControls(layer, layer.fill);
    if (layer.fill.type === 'gradient') return renderGradientFillControls(layer, layer.fill);
    return renderImageFillControls(layer, layer.fill, assets);
  }

  function renderSolidFillControls(layer: Layer, fill: Extract<LayerFill, { type: 'solid' }>): HTMLElement {
    const row = document.createElement('div');
    row.className = 'layers__setting-row';

    const label = document.createElement('label');
    label.className = 'layers__setting-label';
    label.textContent = 'Colour';
    label.htmlFor = `layer-color-${layer.id}`;

    const color = document.createElement('input');
    color.type = 'color';
    color.id = `layer-color-${layer.id}`;
    color.className = 'layers__setting-color';
    color.value = fill.color;
    bindCommittedInput(color, history, () => {
      store.update((doc) => setLayerFill(doc, layer.id, { type: 'solid', color: color.value }));
    });

    row.append(label, color);
    return row;
  }

  function renderGradientFillControls(layer: Layer, fill: Extract<LayerFill, { type: 'gradient' }>): HTMLElement {
    const wrapper = document.createElement('div');

    const angleRow = document.createElement('div');
    angleRow.className = 'layers__setting-row';
    const angleLabel = document.createElement('label');
    angleLabel.className = 'layers__setting-label';
    angleLabel.textContent = 'Angle';
    angleLabel.htmlFor = `layer-angle-${layer.id}`;
    const angle = document.createElement('input');
    angle.type = 'number';
    angle.id = `layer-angle-${layer.id}`;
    angle.className = 'layers__setting-number';
    angle.min = '0';
    angle.max = '360';
    angle.value = String(fill.angle);
    const commitGradient = (): void => {
      store.update((doc) =>
        setLayerFill(doc, layer.id, {
          type: 'gradient',
          angle: Math.min(360, Math.max(0, angle.valueAsNumber || 0)),
          stops: [
            { offset: 0, color: startColor.value },
            { offset: 1, color: endColor.value },
          ],
        }),
      );
    };
    bindCommittedInput(angle, history, commitGradient);
    angleRow.append(angleLabel, angle);

    const colorsRow = document.createElement('div');
    colorsRow.className = 'layers__setting-row';
    // A <span>, not a <label>: it names two swatches at once, which `for`
    // can't express — each swatch gets its own `aria-label` below instead.
    const colorsLabel = document.createElement('span');
    colorsLabel.className = 'layers__setting-label';
    colorsLabel.textContent = 'Colours';
    const startColor = document.createElement('input');
    startColor.type = 'color';
    startColor.className = 'layers__setting-color';
    startColor.setAttribute('aria-label', 'Gradient start colour');
    startColor.value = fill.stops[0]?.color ?? '#4f8cff';
    const endColor = document.createElement('input');
    endColor.type = 'color';
    endColor.setAttribute('aria-label', 'Gradient end colour');
    endColor.className = 'layers__setting-color';
    endColor.value = fill.stops[fill.stops.length - 1]?.color ?? '#ffffff';
    bindCommittedInput(startColor, history, commitGradient);
    bindCommittedInput(endColor, history, commitGradient);
    colorsRow.append(colorsLabel, startColor, endColor);

    wrapper.append(angleRow, colorsRow);
    return wrapper;
  }

  function renderImageFillControls(
    layer: Layer,
    fill: Extract<LayerFill, { type: 'image' }>,
    assets: Asset[],
  ): HTMLElement {
    const wrapper = document.createElement('div');
    const asset = assets.find((a) => a.id === fill.assetId) ?? null;

    const uploadRow = document.createElement('div');
    uploadRow.className = 'layers__setting-row';
    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'layers__setting-label';
    uploadLabel.textContent = 'Image';
    uploadLabel.htmlFor = `layer-image-${layer.id}`;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = `layer-image-${layer.id}`;
    fileInput.accept = 'image/*';
    fileInput.className = 'layers__setting-file';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      readImageFile(file)
        .then(({ src, width, height }) => {
          history.record();
          store.update((doc) => {
            const { document: withAsset, assetId } = addImageAsset(doc, file.name, src, width, height);
            return setLayerFill(withAsset, layer.id, { ...fill, assetId });
          });
        })
        .catch(() => {
          // Unreadable/undecodable file — silently ignore, nothing was changed.
        });
    });

    uploadRow.append(uploadLabel, fileInput);
    wrapper.appendChild(uploadRow);

    if (!asset) {
      const hint = document.createElement('p');
      hint.className = 'layers__setting-hint';
      hint.textContent = 'Upload an image to fill this layer.';
      wrapper.appendChild(hint);
      return wrapper;
    }

    const nameRow = document.createElement('div');
    nameRow.className = 'layers__setting-row';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'layers__setting-value';
    nameLabel.textContent = asset.name;
    nameRow.append(nameLabel);
    wrapper.appendChild(nameRow);

    const crop = fill.crop;

    const commitTransform = (
      position: { x: number; y: number },
      scale: number,
      rotation: number,
      cropRect: { x: number; y: number; width: number; height: number },
    ): void => {
      store.update((doc) =>
        setLayerFill(doc, layer.id, { type: 'image', assetId: asset.id, position, scale, rotation, crop: cropRect }),
      );
    };

    const positionRow = document.createElement('div');
    positionRow.className = 'layers__setting-row';
    positionRow.append(labelSpan('Position'));
    const posX = numberInput(fill.position.x, 0, 1, 0.01, 'Position X');
    const posY = numberInput(fill.position.y, 0, 1, 0.01, 'Position Y');
    positionRow.append(posX, posY);
    wrapper.appendChild(positionRow);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'layers__setting-row';
    scaleRow.append(labelSpan('Scale'));
    const scaleInput = numberInput(fill.scale, 0.05, 10, 0.05, 'Scale');
    scaleRow.append(scaleInput);
    wrapper.appendChild(scaleRow);

    const rotationRow = document.createElement('div');
    rotationRow.className = 'layers__setting-row';
    rotationRow.append(labelSpan('Rotation'));
    const rotationInput = numberInput(fill.rotation, -360, 360, 1, 'Rotation');
    rotationRow.append(rotationInput);
    wrapper.appendChild(rotationRow);

    const alignRow = document.createElement('div');
    alignRow.className = 'layers__setting-row';
    alignRow.append(labelSpan('Align'));
    const alignButtons = document.createElement('div');
    alignButtons.className = 'layers__align-buttons';

    const applyAlign = (partial: { x?: number; y?: number }): void => {
      history.record();
      store.update((doc) =>
        setLayerFill(doc, layer.id, {
          type: 'image',
          assetId: asset.id,
          position: { x: partial.x ?? fill.position.x, y: partial.y ?? fill.position.y },
          scale: fill.scale,
          rotation: fill.rotation,
          crop: fill.crop,
        }),
      );
    };

    const alignEdgeX = (edge: 'start' | 'end'): number => {
      const doc = store.get();
      const geometry = computeImageFillGeometry(fill, asset, doc.grid);
      const half = geometry.displayWidth / 2;
      return edge === 'start' ? half / doc.grid.columns : (doc.grid.columns - half) / doc.grid.columns;
    };

    const alignEdgeY = (edge: 'start' | 'end'): number => {
      const doc = store.get();
      const geometry = computeImageFillGeometry(fill, asset, doc.grid);
      const half = geometry.displayHeight / 2;
      return edge === 'start' ? half / doc.grid.rows : (doc.grid.rows - half) / doc.grid.rows;
    };

    const alignSpecs: { label: string; title: string; onClick: () => void }[] = [
      { label: '\u{21E4}', title: 'Align left', onClick: () => applyAlign({ x: alignEdgeX('start') }) },
      { label: '\u{2194}', title: 'Center horizontally', onClick: () => applyAlign({ x: 0.5 }) },
      { label: '\u{21E5}', title: 'Align right', onClick: () => applyAlign({ x: alignEdgeX('end') }) },
      { label: '\u{21E1}', title: 'Align top', onClick: () => applyAlign({ y: alignEdgeY('start') }) },
      { label: '\u{2195}', title: 'Center vertically', onClick: () => applyAlign({ y: 0.5 }) },
      { label: '\u{21E3}', title: 'Align bottom', onClick: () => applyAlign({ y: alignEdgeY('end') }) },
    ];
    for (const spec of alignSpecs) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'layers__align-button';
      button.textContent = spec.label;
      button.title = spec.title;
      button.setAttribute('aria-label', spec.title);
      button.addEventListener('click', spec.onClick);
      alignButtons.appendChild(button);
    }
    alignRow.appendChild(alignButtons);
    wrapper.appendChild(alignRow);

    const cropPosRow = document.createElement('div');
    cropPosRow.className = 'layers__setting-row';
    cropPosRow.append(labelSpan('Crop XY'));
    const cropX = numberInput(crop.x, 0, 1, 0.01, 'Crop X');
    const cropY = numberInput(crop.y, 0, 1, 0.01, 'Crop Y');
    cropPosRow.append(cropX, cropY);
    wrapper.appendChild(cropPosRow);

    const cropSizeRow = document.createElement('div');
    cropSizeRow.className = 'layers__setting-row';
    cropSizeRow.append(labelSpan('Crop WH'));
    const cropWidth = numberInput(crop.width, 0.01, 1, 0.01, 'Crop width');
    const cropHeight = numberInput(crop.height, 0.01, 1, 0.01, 'Crop height');
    cropSizeRow.append(cropWidth, cropHeight);
    wrapper.appendChild(cropSizeRow);

    const apply = (): void => {
      commitTransform(
        { x: posX.valueAsNumber || 0, y: posY.valueAsNumber || 0 },
        scaleInput.valueAsNumber || 1,
        rotationInput.valueAsNumber || 0,
        {
          x: clamp01(cropX.valueAsNumber || 0),
          y: clamp01(cropY.valueAsNumber || 0),
          width: clampCropSize(cropWidth.valueAsNumber),
          height: clampCropSize(cropHeight.valueAsNumber),
        },
      );
    };
    bindCommittedInput(posX, history, apply);
    bindCommittedInput(posY, history, apply);
    bindCommittedInput(scaleInput, history, apply);
    bindCommittedInput(rotationInput, history, apply);
    bindCommittedInput(cropX, history, apply);
    bindCommittedInput(cropY, history, apply);
    bindCommittedInput(cropWidth, history, apply);
    bindCommittedInput(cropHeight, history, apply);

    return wrapper;
  }

  function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value || 0));
  }

  function clampCropSize(value: number): number {
    return Math.min(1, Math.max(0.01, value || 0.01));
  }

  /** A plain visual label — used where one heading names two adjacent inputs (e.g. Position X/Y), so it can't be a `<label for>`; each input gets its own `aria-label` instead. */
  function labelSpan(text: string): HTMLElement {
    const label = document.createElement('span');
    label.className = 'layers__setting-label';
    label.textContent = text;
    return label;
  }

  function numberInput(value: number, min: number, max: number, step: number, ariaLabel: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'layers__setting-number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    input.setAttribute('aria-label', ariaLabel);
    return input;
  }

  store.subscribe(render);
  selectedLayer.subscribe(render);
  render();

  return root;
}
