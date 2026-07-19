type Listener = (layerId: string | null) => void;

/** Which layer (by id) is selected for on-canvas transform handles (Phase 8 image interaction). */
export class SelectedLayerStore {
  private layerId: string | null = null;
  private readonly listeners = new Set<Listener>();

  get(): string | null {
    return this.layerId;
  }

  set(id: string | null): void {
    if (id === this.layerId) return;
    this.layerId = id;
    for (const listener of this.listeners) {
      listener(id);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
