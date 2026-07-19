type Listener = (activeId: string | null) => void;

/** Which named `Selection` (by id) the Selections panel and select-mode canvas edits target. */
export class ActiveSelectionStore {
  private activeId: string | null = null;
  private readonly listeners = new Set<Listener>();

  get(): string | null {
    return this.activeId;
  }

  set(id: string | null): void {
    if (id === this.activeId) return;
    this.activeId = id;
    for (const listener of this.listeners) {
      listener(id);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
