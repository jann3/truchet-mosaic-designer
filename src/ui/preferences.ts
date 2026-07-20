const STORAGE_KEY = 'truchet-mosaic-designer:high-contrast';

function readStoredPreference(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return null;
  } catch {
    return null;
  }
}

function applyTheme(enabled: boolean): void {
  document.documentElement.dataset.theme = enabled ? 'high-contrast' : 'normal';
}

/**
 * Applies the user's saved high-contrast choice at startup. Leaves
 * `data-theme` unset when they've never chosen one, so the OS-level
 * `prefers-contrast` media query (handled purely in CSS) stays in charge.
 */
export function initHighContrastPreference(): void {
  const stored = readStoredPreference();
  if (stored !== null) applyTheme(stored);
}

export function isHighContrastEnabled(): boolean {
  return document.documentElement.dataset.theme === 'high-contrast';
}

/** Flips high-contrast mode and persists the choice; returns the new state. */
export function toggleHighContrast(): boolean {
  const next = !isHighContrastEnabled();
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
    // Best-effort, same as autosave — a full quota shouldn't block the toggle.
  }
  return next;
}
