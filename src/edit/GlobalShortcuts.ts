import { isTypingTarget } from '../utils/isTypingTarget';

export interface GlobalShortcutsTargets {
  save: HTMLButtonElement;
  open: HTMLButtonElement;
  newProject: HTMLButtonElement;
  help: HTMLButtonElement;
}

/**
 * App-level keyboard shortcuts (save/open/new/help) — deliberately just
 * simulates clicks on the existing toolbar buttons rather than duplicating
 * their logic, so e.g. Ctrl+N still goes through the toolbar's own
 * dirty-document confirmation flow.
 */
export class GlobalShortcuts {
  private readonly targets: GlobalShortcutsTargets;

  constructor(targets: GlobalShortcutsTargets) {
    this.targets = targets;
    window.addEventListener('keydown', this.handleKeyDown);
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const withModifier = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();

    if (withModifier && key === 's') {
      event.preventDefault();
      this.targets.save.click();
      return;
    }
    if (withModifier && key === 'o') {
      event.preventDefault();
      this.targets.open.click();
      return;
    }
    if (withModifier && key === 'n') {
      event.preventDefault();
      this.targets.newProject.click();
      return;
    }
    if (!withModifier && !isTypingTarget(event) && (event.key === '?' || (event.shiftKey && event.key === '/'))) {
      event.preventDefault();
      this.targets.help.click();
    }
  };
}
