export type EditorMode = 'edit' | 'select';

type Listener = (mode: EditorMode) => void;

/** Which canvas tool is active: 'edit' (flip/paint tiles) or 'select' (build a named Selection). */
export class EditorModeStore {
  private mode: EditorMode = 'edit';
  private readonly listeners = new Set<Listener>();

  get(): EditorMode {
    return this.mode;
  }

  set(mode: EditorMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    for (const listener of this.listeners) {
      listener(mode);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
