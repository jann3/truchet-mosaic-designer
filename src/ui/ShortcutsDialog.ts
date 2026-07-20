export interface ShortcutsDialogHandle {
  element: HTMLElement;
  open: () => void;
}

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Arrow keys', description: 'Move focus between triangles on the grid' },
  { keys: 'Enter / Space', description: 'Flip the focused tile, or toggle it in the active selection' },
  { keys: 'Shift + Enter / Shift + click', description: 'Add or remove a triangle from the temporary multi-selection' },
  { keys: 'Delete / Backspace', description: 'Reset the focused tile, or remove it from the active selection' },
  { keys: 'Escape', description: 'Clear the temporary multi-selection' },
  { keys: 'Ctrl/Cmd + Z', description: 'Undo' },
  { keys: 'Ctrl/Cmd + Shift + Z, or Ctrl/Cmd + Y', description: 'Redo' },
  { keys: 'Ctrl/Cmd + S', description: 'Save the project' },
  { keys: 'Ctrl/Cmd + O', description: 'Open a project' },
  { keys: 'Ctrl/Cmd + N', description: 'Start a new project' },
  { keys: '?', description: 'Show this shortcuts list' },
];

/** Static reference dialog listing every keyboard shortcut — opened from the toolbar's Help button or the '?' key. */
export function createShortcutsDialog(): ShortcutsDialogHandle {
  const backdrop = document.createElement('div');
  backdrop.className = 'shortcuts-dialog-backdrop';
  backdrop.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'shortcuts-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Keyboard shortcuts');
  backdrop.appendChild(dialog);

  const close = (): void => {
    backdrop.hidden = true;
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) close();
  });

  const header = document.createElement('div');
  header.className = 'shortcuts-dialog__header';

  const heading = document.createElement('h2');
  heading.className = 'shortcuts-dialog__heading';
  heading.textContent = 'Keyboard shortcuts';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'shortcuts-dialog__close';
  closeButton.textContent = '\u{2715}';
  closeButton.setAttribute('aria-label', 'Close');
  closeButton.addEventListener('click', close);

  header.append(heading, closeButton);

  const list = document.createElement('dl');
  list.className = 'shortcuts-dialog__list';
  for (const item of SHORTCUTS) {
    const term = document.createElement('dt');
    term.className = 'shortcuts-dialog__keys';
    term.textContent = item.keys;

    const description = document.createElement('dd');
    description.className = 'shortcuts-dialog__description';
    description.textContent = item.description;

    list.append(term, description);
  }

  dialog.append(header, list);

  return {
    element: backdrop,
    open: () => {
      backdrop.hidden = false;
      closeButton.focus();
    },
  };
}
