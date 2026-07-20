import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import type { EditorModeStore } from '../edit/EditorModeStore';
import type { ActiveSelectionStore } from '../edit/ActiveSelectionStore';
import type { Selection } from '../document/types';
import {
  createSelection,
  deleteSelection,
  duplicateSelection,
  renameSelection,
  setSelectionTriangles,
} from '../document/selectionsCrud';
import {
  invertSelection,
  selectAll,
  selectByColumn,
  selectByHalf,
  selectByOrientation,
  selectByRow,
} from '../document/selectionOperations';

/** Selects a named Selection for editing and switches the canvas into select mode. */
function activate(activeSelection: ActiveSelectionStore, editorMode: EditorModeStore, id: string): void {
  activeSelection.set(id);
  editorMode.set('select');
}

export function createSelectionsPanel(
  store: DocumentStore,
  history: HistoryManager,
  editorMode: EditorModeStore,
  activeSelection: ActiveSelectionStore,
): HTMLElement {
  const root = document.createElement('div');
  root.className = 'selections';

  // Announces the active selection's triangle count to screen readers
  // whenever it changes — the visible count badge next to each list item has
  // no equivalent for someone who can't see the list update live. Appended
  // once and never removed by `body.replaceChildren()` below: tearing a live
  // region out of the DOM and back in on every render can make some
  // screen readers stop treating it as "live".
  const liveRegion = document.createElement('p');
  liveRegion.className = 'selections__live-region visually-hidden';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  root.appendChild(liveRegion);

  const body = document.createElement('div');
  body.className = 'selections__body';
  root.appendChild(body);

  const render = (): void => {
    body.replaceChildren();
    const document_ = store.get();
    const activeId = activeSelection.get();
    const activeSel = document_.selections.find((s) => s.id === activeId) ?? null;
    const totalTriangles = document_.grid.rows * document_.grid.columns * 2;

    liveRegion.textContent = activeSel
      ? `${activeSel.name}: ${activeSel.triangleIds.length} of ${totalTriangles} triangles selected.`
      : 'No selection active.';

    body.appendChild(renderHeader());
    body.appendChild(renderList(document_.selections, activeId));
    body.appendChild(renderTools(activeSel));
  };

  function renderHeader(): HTMLElement {
    const headerRow = document.createElement('div');
    headerRow.className = 'selections__header-row';

    const heading = document.createElement('h3');
    heading.className = 'selections__heading';
    heading.textContent = 'Selections';

    const newButton = document.createElement('button');
    newButton.type = 'button';
    newButton.className = 'selections__new';
    newButton.textContent = '+ New';
    newButton.addEventListener('click', () => {
      const name = `Selection ${store.get().selections.length + 1}`;
      history.record();
      let newId = '';
      store.update((doc) => {
        const next = createSelection(doc, name);
        newId = next.selections[next.selections.length - 1].id;
        return next;
      });
      activate(activeSelection, editorMode, newId);
    });

    headerRow.append(heading, newButton);
    return headerRow;
  }

  function renderList(selections: Selection[], activeId: string | null): HTMLElement {
    const list = document.createElement('ul');
    list.className = 'selections__list';

    if (selections.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'selections__empty';
      empty.textContent = 'No selections yet.';
      list.appendChild(empty);
      return list;
    }

    for (const selection of selections) {
      list.appendChild(renderItem(selection, selection.id === activeId));
    }
    return list;
  }

  function renderItem(selection: Selection, isActive: boolean): HTMLElement {
    const item = document.createElement('li');
    item.className = 'selections__item';
    item.classList.toggle('selections__item--active', isActive);

    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'selections__item-name';
    nameButton.textContent = selection.name;
    nameButton.setAttribute('aria-current', String(isActive));
    nameButton.addEventListener('click', () => activate(activeSelection, editorMode, selection.id));

    const count = document.createElement('span');
    count.className = 'selections__item-count';
    count.textContent = String(selection.triangleIds.length);
    count.setAttribute('aria-label', `${selection.triangleIds.length} triangles`);

    const renameButton = document.createElement('button');
    renameButton.type = 'button';
    renameButton.className = 'selections__item-action';
    renameButton.title = 'Rename';
    renameButton.setAttribute('aria-label', 'Rename selection');
    renameButton.textContent = '✎';
    renameButton.addEventListener('click', () => startRename(item, selection));

    const duplicateButton = document.createElement('button');
    duplicateButton.type = 'button';
    duplicateButton.className = 'selections__item-action';
    duplicateButton.title = 'Duplicate';
    duplicateButton.setAttribute('aria-label', 'Duplicate selection');
    duplicateButton.textContent = '⧉';
    duplicateButton.addEventListener('click', () => {
      history.record();
      store.update((doc) => duplicateSelection(doc, selection.id));
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'selections__item-action';
    deleteButton.title = 'Delete';
    deleteButton.setAttribute('aria-label', 'Delete selection');
    deleteButton.textContent = '✕';
    deleteButton.addEventListener('click', () => {
      history.record();
      store.update((doc) => deleteSelection(doc, selection.id));
      if (activeSelection.get() === selection.id) activeSelection.set(null);
    });

    item.append(nameButton, count, renameButton, duplicateButton, deleteButton);
    return item;
  }

  function startRename(item: HTMLElement, selection: Selection): void {
    const nameButton = item.querySelector<HTMLButtonElement>('.selections__item-name');
    if (!nameButton) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'selections__item-rename';
    input.value = selection.name;

    const commit = (): void => {
      const name = input.value.trim();
      if (name && name !== selection.name) {
        history.record();
        store.update((doc) => renameSelection(doc, selection.id, name));
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

  function renderTools(activeSel: Selection | null): HTMLElement {
    const tools = document.createElement('div');
    tools.className = 'selections__tools';

    const heading = document.createElement('h4');
    heading.className = 'selections__tools-heading';
    heading.textContent = 'Tools';
    tools.appendChild(heading);

    if (!activeSel) {
      const hint = document.createElement('p');
      hint.className = 'selections__tools-hint';
      hint.textContent = 'Select or create a selection to edit it.';
      tools.appendChild(hint);
      return tools;
    }

    const apply = (compute: (grid: ReturnType<DocumentStore['get']>['grid']) => string[]): void => {
      history.record();
      store.update((doc) => setSelectionTriangles(doc, activeSel.id, compute(doc.grid)));
    };

    const wholeGridRow = document.createElement('div');
    wholeGridRow.className = 'selections__tools-row';
    wholeGridRow.append(
      createToolButton('Select All', () => apply((grid) => selectAll(grid))),
      createToolButton('Invert', () => apply((grid) => invertSelection(grid, activeSel.triangleIds))),
    );

    const colourRow = document.createElement('div');
    colourRow.className = 'selections__tools-row';
    colourRow.append(
      createLabel('Colour'),
      createToolButton('Black', () => apply((grid) => selectByHalf(grid, 'a'))),
      createToolButton('White', () => apply((grid) => selectByHalf(grid, 'b'))),
    );

    const orientationRow = document.createElement('div');
    orientationRow.className = 'selections__tools-row';
    orientationRow.append(
      createLabel('Orientation'),
      createToolButton('╲', () => apply((grid) => selectByOrientation(grid, 'tl-br')), 'Diagonal top-left to bottom-right'),
      createToolButton('╱', () => apply((grid) => selectByOrientation(grid, 'tr-bl')), 'Diagonal top-right to bottom-left'),
    );

    const grid = store.get().grid;
    const rowRow = createIndexToolRow('Row', grid.rows - 1, (index) => apply((g) => selectByRow(g, index)));
    const columnRow = createIndexToolRow('Column', grid.columns - 1, (index) =>
      apply((g) => selectByColumn(g, index)),
    );

    tools.append(wholeGridRow, colourRow, orientationRow, rowRow, columnRow);
    return tools;
  }

  function createToolButton(label: string, onClick: () => void, ariaLabel?: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'selections__tool-button';
    button.textContent = label;
    if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
    button.addEventListener('click', onClick);
    return button;
  }

  function createLabel(text: string): HTMLElement {
    const label = document.createElement('span');
    label.className = 'selections__tool-label';
    label.textContent = text;
    return label;
  }

  function createIndexToolRow(label: string, max: number, onSelect: (index: number) => void): HTMLElement {
    const row = document.createElement('div');
    row.className = 'selections__tools-row';

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'selections__tool-number';
    input.min = '0';
    input.max = String(Math.max(0, max));
    input.value = '0';
    input.setAttribute('aria-label', `${label} index`);

    const button = createToolButton(`Select ${label}`, () => {
      const index = Math.min(Math.max(0, Math.round(input.valueAsNumber || 0)), max);
      onSelect(index);
    });

    row.append(createLabel(label), input, button);
    return row;
  }

  store.subscribe(render);
  activeSelection.subscribe(render);
  render();

  return root;
}
