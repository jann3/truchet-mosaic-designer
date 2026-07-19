import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import { GRID_PATTERNS, generatePatternedGrid, type GridPattern } from '../document/patternGenerators';

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 64;

function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return MIN_DIMENSION;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(value)));
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

function createNumberField(
  id: string,
  labelText: string,
  initial: number,
  onChange: (value: number) => void,
): { element: HTMLElement; input: HTMLInputElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid-config__field';

  const label = document.createElement('label');
  label.className = 'grid-config__label';
  label.htmlFor = id;
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.className = 'grid-config__number';
  input.min = String(MIN_DIMENSION);
  input.max = String(MAX_DIMENSION);
  input.value = String(initial);
  input.addEventListener('input', () => {
    onChange(clampDimension(input.valueAsNumber));
  });

  wrapper.append(label, input);
  return { element: wrapper, input };
}

/**
 * Grid setup UI (Phase 4): columns/rows plus a pattern generator. Only touches
 * `grid` on the document via `generatePatternedGrid`, leaving everything else
 * (layers, selections, assets) untouched.
 */
export function createGridConfigPanel(store: DocumentStore, history: HistoryManager): HTMLElement {
  const initialGrid = store.get().grid;

  const state = {
    columns: initialGrid.columns,
    rows: initialGrid.rows,
    pattern: 'uniform' as GridPattern,
    seed: randomSeed(),
  };

  const form = document.createElement('form');
  form.className = 'grid-config';

  const heading = document.createElement('h3');
  heading.className = 'grid-config__heading';
  heading.textContent = 'Grid';
  form.appendChild(heading);

  const columnsField = createNumberField('grid-config-columns', 'Columns', state.columns, (value) => {
    state.columns = value;
  });
  const rowsField = createNumberField('grid-config-rows', 'Rows', state.rows, (value) => {
    state.rows = value;
  });
  form.append(columnsField.element, rowsField.element);

  const patternFieldset = document.createElement('fieldset');
  patternFieldset.className = 'grid-config__fieldset';

  const patternLegend = document.createElement('legend');
  patternLegend.className = 'grid-config__legend';
  patternLegend.textContent = 'Pattern';
  patternFieldset.appendChild(patternLegend);

  const seedField = document.createElement('div');
  seedField.className = 'grid-config__seed-field';
  seedField.hidden = state.pattern !== 'random';

  const seedLabel = document.createElement('label');
  seedLabel.className = 'grid-config__label';
  seedLabel.htmlFor = 'grid-config-seed';
  seedLabel.textContent = 'Seed';

  const seedInput = document.createElement('input');
  seedInput.type = 'number';
  seedInput.id = 'grid-config-seed';
  seedInput.className = 'grid-config__number';
  seedInput.value = String(state.seed);
  seedInput.addEventListener('input', () => {
    if (Number.isFinite(seedInput.valueAsNumber)) {
      state.seed = seedInput.valueAsNumber;
    }
  });

  const seedRandomizeButton = document.createElement('button');
  seedRandomizeButton.type = 'button';
  seedRandomizeButton.className = 'grid-config__seed-randomize';
  seedRandomizeButton.textContent = '\u{1F3B2}';
  seedRandomizeButton.title = 'Randomize seed';
  seedRandomizeButton.setAttribute('aria-label', 'Randomize seed');
  seedRandomizeButton.addEventListener('click', () => {
    state.seed = randomSeed();
    seedInput.value = String(state.seed);
  });

  seedField.append(seedLabel, seedInput, seedRandomizeButton);

  for (const option of GRID_PATTERNS) {
    const optionLabel = document.createElement('label');
    optionLabel.className = 'grid-config__radio';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'grid-config-pattern';
    radio.value = option.value;
    radio.checked = option.value === state.pattern;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      state.pattern = option.value;
      seedField.hidden = state.pattern !== 'random';
    });

    optionLabel.append(radio, document.createTextNode(option.label));
    patternFieldset.appendChild(optionLabel);
  }

  patternFieldset.appendChild(seedField);
  form.appendChild(patternFieldset);

  const generateButton = document.createElement('button');
  generateButton.type = 'submit';
  generateButton.className = 'grid-config__generate';
  generateButton.textContent = 'Generate';
  form.appendChild(generateButton);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    history.record();
    store.update((doc) => ({
      ...doc,
      grid: generatePatternedGrid(state.columns, state.rows, state.pattern, state.seed),
    }));
  });

  return form;
}
