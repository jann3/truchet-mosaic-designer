import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import type { SelectedLayerStore } from '../edit/SelectedLayerStore';
import type { Asset, BlendMode, Layer, LayerFill, Selection } from '../document/types';
import {
  createLayer,
  deleteLayer,
  renameLayer,
  setLayerBlendMode,
  setLayerFill,
  setLayerOpacity,
  setLayerSelection,
  setLayerVisibility,
} from '../document/layersCrud';
import { addImageAsset } from '../document/assetsCrud';

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

  const render = (): void => {
    root.replaceChildren();
    const doc = store.get();
    root.appendChild(renderHeader());
    root.appendChild(renderList(doc.layers, doc.selections, doc.assets));
  };

  function renderHeader(): HTMLElement {
    const headerRow = document.createElement('div');
    headerRow.className = 'layers__header-row';

    const heading = document.createElement('h3');
    heading.className = 'layers__heading';
    heading.textContent = 'Layers';

    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = 'layers__new';
    newButton.textContent = '+ New';
    newButton.addEventListener('click', () => {
      const name = `Layer ${store.get().layers.length + 1}`;
      history.record();
      store.update((doc) => createLayer(doc, name));
    });

    headerRow.append(heading, newButton);
    return headerRow;
  }

  function renderList(layers: Layer[], selections: Selection[], assets: Asset[]): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'layers__list';

    if (layers.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'layers__empty';
      empty.textContent = 'No layers yet.';
      list.appendChild(empty);
      return list;
    }

    // Topmost layer (last in document order — painted last, so on top) is shown first.
    for (const layer of [...layers].reverse()) {
      list.appendChild(renderItem(layer, selections, assets));
    }
    return list;
  }

  function renderItem(layer: Layer, selections: Selection[], assets: Asset[]): HTMLElement {
    const item = document.createElement('li');
    item.className = 'layers__item';
    item.classList.toggle('layers__item--active', layer.id === selectedLayer.get());

    const row = document.createElement('div');
    row.className = 'layers__item-row';
    row.addEventListener('click', () => {
      selectedLayer.set(selectedLayer.get() === layer.id ? null : layer.id);
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

    row.append(visibilityButton, nameButton, deleteButton);
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

    const range = document.createElement('input');
    range.type = 'range';
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

    const select = document.createElement('select');
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

    const select = document.createElement('select');
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

    const select = document.createElement('select');
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

    const color = document.createElement('input');
    color.type = 'color';
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
    const angle = document.createElement('input');
    angle.type = 'number';
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
    const colorsLabel = document.createElement('label');
    colorsLabel.className = 'layers__setting-label';
    colorsLabel.textContent = 'Colours';
    const startColor = document.createElement('input');
    startColor.type = 'color';
    startColor.className = 'layers__setting-color';
    startColor.value = fill.stops[0]?.color ?? '#4f8cff';
    const endColor = document.createElement('input');
    endColor.type = 'color';
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

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
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
    const posX = numberInput(fill.position.x, 0, 1, 0.01);
    const posY = numberInput(fill.position.y, 0, 1, 0.01);
    positionRow.append(posX, posY);
    wrapper.appendChild(positionRow);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'layers__setting-row';
    scaleRow.append(labelSpan('Scale'));
    const scaleInput = numberInput(fill.scale, 0.05, 10, 0.05);
    scaleRow.append(scaleInput);
    wrapper.appendChild(scaleRow);

    const rotationRow = document.createElement('div');
    rotationRow.className = 'layers__setting-row';
    rotationRow.append(labelSpan('Rotation'));
    const rotationInput = numberInput(fill.rotation, -360, 360, 1);
    rotationRow.append(rotationInput);
    wrapper.appendChild(rotationRow);

    const cropPosRow = document.createElement('div');
    cropPosRow.className = 'layers__setting-row';
    cropPosRow.append(labelSpan('Crop XY'));
    const cropX = numberInput(crop.x, 0, 1, 0.01);
    const cropY = numberInput(crop.y, 0, 1, 0.01);
    cropPosRow.append(cropX, cropY);
    wrapper.appendChild(cropPosRow);

    const cropSizeRow = document.createElement('div');
    cropSizeRow.className = 'layers__setting-row';
    cropSizeRow.append(labelSpan('Crop WH'));
    const cropWidth = numberInput(crop.width, 0.01, 1, 0.01);
    const cropHeight = numberInput(crop.height, 0.01, 1, 0.01);
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

  function labelSpan(text: string): HTMLElement {
    const label = document.createElement('label');
    label.className = 'layers__setting-label';
    label.textContent = text;
    return label;
  }

  function numberInput(value: number, min: number, max: number, step: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'layers__setting-number';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);
    return input;
  }

  store.subscribe(render);
  selectedLayer.subscribe(render);
  render();

  return root;
}
