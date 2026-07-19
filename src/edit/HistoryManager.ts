import type { DocumentStore } from '../document/DocumentStore';
import type { TruchetDocument } from '../document/types';

type Listener = () => void;

/**
 * Linear undo/redo over `DocumentStore` snapshots. Callers must call
 * `record()` immediately before the `store.update()` call(s) they want
 * undoable — grouping several updates (e.g. a whole paint drag) under one
 * `record()` makes them undo as a single step.
 */
export class HistoryManager {
  private readonly store: DocumentStore;
  private undoStack: TruchetDocument[] = [];
  private redoStack: TruchetDocument[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(store: DocumentStore) {
    this.store = store;
  }

  record(): void {
    this.undoStack.push(this.store.get());
    this.redoStack = [];
    this.notify();
  }

  undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(this.store.get());
    this.store.update(() => previous);
    this.notify();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.store.get());
    this.store.update(() => next);
    this.notify();
  }

  /** Clears undo/redo history without touching the document — for loading a new/opened project, where the prior document's edits shouldn't be reachable via undo. */
  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
