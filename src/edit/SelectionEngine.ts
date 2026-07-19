export interface SelectionState {
  hoveredTriangleId: string | null;
  selectedTriangleIds: ReadonlySet<string>;
}

type Listener = (state: SelectionState) => void;

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

function setsAreEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) {
    if (!b.has(id)) return false;
  }
  return true;
}

/**
 * Ephemeral triangle-level hover/selection state for the grid editor. Distinct
 * from the reusable, named `Selection`s introduced in Phase 6 — this is just
 * "what's currently highlighted while editing" and is never persisted.
 */
export class SelectionEngine {
  private hoveredTriangleId: string | null = null;
  private selectedTriangleIds: ReadonlySet<string> = EMPTY_SELECTION;
  private readonly listeners = new Set<Listener>();

  getState(): SelectionState {
    return { hoveredTriangleId: this.hoveredTriangleId, selectedTriangleIds: this.selectedTriangleIds };
  }

  setHovered(triangleId: string | null): void {
    if (triangleId === this.hoveredTriangleId) return;
    this.hoveredTriangleId = triangleId;
    this.notify();
  }

  /** Replaces the selection with a single triangle. */
  select(triangleId: string): void {
    this.selectedTriangleIds = new Set([triangleId]);
    this.notify();
  }

  /** Replaces the whole selection — used to mirror an active named Selection's contents. */
  setSelected(triangleIds: Iterable<string>): void {
    const next = new Set(triangleIds);
    if (setsAreEqual(next, this.selectedTriangleIds)) return;
    this.selectedTriangleIds = next;
    this.notify();
  }

  /** Adds/removes `triangleId` from the selection, keeping the rest — for shift-click. */
  toggle(triangleId: string): void {
    const next = new Set(this.selectedTriangleIds);
    if (next.has(triangleId)) {
      next.delete(triangleId);
    } else {
      next.add(triangleId);
    }
    this.selectedTriangleIds = next;
    this.notify();
  }

  clear(): void {
    if (this.selectedTriangleIds.size === 0) return;
    this.selectedTriangleIds = EMPTY_SELECTION;
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
