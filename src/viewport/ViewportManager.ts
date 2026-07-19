export type Breakpoint =
  | 'desktop-landscape'
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'mobile-portrait';

export type ViewportListener = (breakpoint: Breakpoint) => void;

const DESKTOP_MIN_WIDTH = 1024;
const TABLET_MIN_WIDTH = 600;

/**
 * Tracks which of the four supported breakpoints the viewport currently
 * falls into and mirrors it onto `data-breakpoint` so CSS can react without
 * duplicating the width/orientation thresholds in a media query.
 */
export class ViewportManager {
  private current: Breakpoint;
  private readonly listeners = new Set<ViewportListener>();
  private readonly mediaQueries: MediaQueryList[];
  private readonly root: HTMLElement;

  constructor(root: HTMLElement = document.documentElement) {
    this.root = root;
    this.current = this.computeBreakpoint();

    this.mediaQueries = [
      window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`),
      window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH}px)`),
      window.matchMedia('(orientation: portrait)'),
    ];
    this.mediaQueries.forEach((mql) => mql.addEventListener('change', this.handleChange));
    window.addEventListener('resize', this.handleChange);

    this.applyToDom();
  }

  get breakpoint(): Breakpoint {
    return this.current;
  }

  /** Calls `listener` immediately with the current breakpoint, then on every change. Returns an unsubscribe function. */
  subscribe(listener: ViewportListener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.mediaQueries.forEach((mql) => mql.removeEventListener('change', this.handleChange));
    window.removeEventListener('resize', this.handleChange);
    this.listeners.clear();
  }

  private handleChange = (): void => {
    const next = this.computeBreakpoint();
    if (next === this.current) return;
    this.current = next;
    this.applyToDom();
    this.listeners.forEach((listener) => listener(next));
  };

  private computeBreakpoint(): Breakpoint {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;

    if (width >= DESKTOP_MIN_WIDTH) {
      return 'desktop-landscape';
    }
    if (width >= TABLET_MIN_WIDTH) {
      return isPortrait ? 'tablet-portrait' : 'tablet-landscape';
    }
    return 'mobile-portrait';
  }

  private applyToDom(): void {
    this.root.dataset.breakpoint = this.current;
  }
}
