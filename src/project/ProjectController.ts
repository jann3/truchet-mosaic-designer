import type { DocumentStore } from '../document/DocumentStore';
import type { HistoryManager } from '../edit/HistoryManager';
import type { TruchetDocument } from '../document/types';
import { createDocument } from '../document/createDocument';
import { downloadProjectFile, readProjectFile } from './projectFile';
import { clearAutosave, readAutosave, writeAutosave, type AutosaveEntry } from './autosave';

type Listener = () => void;

const AUTOSAVE_DEBOUNCE_MS = 1000;

/**
 * Tracks unsaved-changes state and owns new/save/load/autosave for the
 * active document. Autosaving is unconditional — it mirrors whatever the
 * `DocumentStore` currently holds to `localStorage` a moment after every
 * change, independent of whether the user has ever explicitly saved — so a
 * crashed tab or accidental close never loses work outright, only the
 * seconds since the last edit.
 */
export class ProjectController {
  private readonly store: DocumentStore;
  private readonly history: HistoryManager;
  private dirtyFlag = false;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingRecoveryEntry: AutosaveEntry | null;
  private readonly listeners = new Set<Listener>();

  constructor(store: DocumentStore, history: HistoryManager) {
    this.store = store;
    this.history = history;
    this.pendingRecoveryEntry = readAutosave();
    this.store.subscribe(() => this.handleDocumentChange());
  }

  get dirty(): boolean {
    return this.dirtyFlag;
  }

  /** A document autosaved in a previous session that was never explicitly saved or discarded — offered once at startup. */
  get pendingRecovery(): AutosaveEntry | null {
    return this.pendingRecoveryEntry;
  }

  restorePendingRecovery(): void {
    const entry = this.pendingRecoveryEntry;
    if (!entry) return;
    this.pendingRecoveryEntry = null;
    this.replaceDocument(entry.document, { dirty: true });
  }

  dismissPendingRecovery(): void {
    this.pendingRecoveryEntry = null;
    clearAutosave();
    this.notify();
  }

  newProject(): void {
    this.pendingRecoveryEntry = null;
    clearAutosave();
    this.replaceDocument(createDocument(), { dirty: false });
  }

  save(): void {
    downloadProjectFile(this.store.get());
    clearAutosave();
    this.dirtyFlag = false;
    this.notify();
  }

  async load(file: File): Promise<void> {
    const doc = await readProjectFile(file);
    this.pendingRecoveryEntry = null;
    clearAutosave();
    this.replaceDocument(doc, { dirty: false });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private replaceDocument(doc: TruchetDocument, opts: { dirty: boolean }): void {
    this.history.reset();
    this.store.update(() => doc);
    this.dirtyFlag = opts.dirty;
    this.notify();
  }

  private handleDocumentChange(): void {
    this.dirtyFlag = true;
    if (this.autosaveTimer !== null) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      writeAutosave(this.store.get());
    }, AUTOSAVE_DEBOUNCE_MS);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
