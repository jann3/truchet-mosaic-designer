import type { TruchetDocument } from './types';
import { createDocument } from './createDocument';

type Listener = (document: TruchetDocument) => void;

/**
 * Single source of truth for the active document. Holds the model in memory
 * and notifies subscribers on change; later phases (editing, undo/redo,
 * rendering) all read and write through here rather than touching a
 * document object directly.
 */
export class DocumentStore {
  private document: TruchetDocument;
  private readonly listeners = new Set<Listener>();

  constructor(initial: TruchetDocument = createDocument()) {
    this.document = initial;
  }

  get(): TruchetDocument {
    return this.document;
  }

  /** Replaces the document with the result of `recipe`, then notifies subscribers. */
  update(recipe: (current: TruchetDocument) => TruchetDocument): void {
    this.document = recipe(this.document);
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.document);
    }
  }
}
