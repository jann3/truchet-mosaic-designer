export type PanelSide = 'left' | 'right';

export interface ResizablePanelOptions {
  id: string;
  title: string;
  side: PanelSide;
  /** CSS custom property on `shell` that controls this panel's grid column width. */
  cssVar: string;
  shell: HTMLElement;
  min: number;
  max: number;
  initial: number;
  content: HTMLElement;
}

const KEYBOARD_STEP = 16;

/**
 * A panel that can be resized by dragging (or arrow keys on) an edge handle,
 * and collapsed entirely. Width is communicated to the surrounding grid via
 * a CSS custom property on `shell` rather than the panel's own inline width,
 * so the app-shell's CSS grid columns stay the single source of layout truth.
 */
export class ResizablePanel {
  readonly element: HTMLElement;

  private collapsed = false;
  private widthPx: number;
  private readonly shell: HTMLElement;
  private readonly cssVar: string;
  private readonly min: number;
  private readonly max: number;
  private readonly handle: HTMLElement;
  private readonly side: PanelSide;

  private dragStartX = 0;
  private dragStartWidth = 0;
  private activePointerId: number | null = null;

  constructor(options: ResizablePanelOptions) {
    this.shell = options.shell;
    this.cssVar = options.cssVar;
    this.min = options.min;
    this.max = options.max;
    this.widthPx = options.initial;
    this.side = options.side;

    this.element = document.createElement('aside');
    this.element.className = `panel panel--${options.id}`;
    this.element.dataset.panel = options.id;
    this.element.setAttribute('aria-label', `${options.title} panel`);

    const header = document.createElement('div');
    header.className = 'panel__header';
    header.textContent = options.title;

    const body = document.createElement('div');
    body.className = 'panel__body';
    body.appendChild(options.content);

    this.handle = document.createElement('div');
    this.handle.className = 'panel__resize-handle';
    this.handle.setAttribute('role', 'separator');
    this.handle.setAttribute('aria-orientation', 'vertical');
    this.handle.setAttribute('aria-label', `Resize ${options.title} panel`);
    this.handle.tabIndex = 0;

    if (options.side === 'right') {
      this.element.append(this.handle, header, body);
    } else {
      this.element.append(header, body, this.handle);
    }

    this.shell.style.setProperty(this.cssVar, `${this.widthPx}px`);

    this.handle.addEventListener('pointerdown', this.onPointerDown);
    this.handle.addEventListener('keydown', this.onKeyDown);
  }

  get isCollapsed(): boolean {
    return this.collapsed;
  }

  setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    if (collapsed) {
      this.shell.style.removeProperty(this.cssVar);
    } else {
      this.shell.style.setProperty(this.cssVar, `${this.widthPx}px`);
    }
  }

  /** Flips collapsed state and returns the new value. */
  toggleCollapsed(): boolean {
    this.setCollapsed(!this.collapsed);
    return this.collapsed;
  }

  destroy(): void {
    this.handle.removeEventListener('pointerdown', this.onPointerDown);
    this.handle.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }

  private clamp(value: number): number {
    return Math.min(this.max, Math.max(this.min, value));
  }

  private applyWidth(next: number): void {
    this.widthPx = this.clamp(next);
    this.shell.style.setProperty(this.cssVar, `${this.widthPx}px`);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.collapsed) return;
    event.preventDefault();
    this.dragStartX = event.clientX;
    this.dragStartWidth = this.widthPx;
    this.activePointerId = event.pointerId;
    this.handle.setPointerCapture(event.pointerId);
    this.handle.setAttribute('data-active', 'true');
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.activePointerId === null) return;
    const delta = event.clientX - this.dragStartX;
    const signedDelta = this.side === 'left' ? delta : -delta;
    this.applyWidth(this.dragStartWidth + signedDelta);
  };

  private onPointerUp = (): void => {
    if (this.activePointerId !== null) {
      this.handle.releasePointerCapture(this.activePointerId);
    }
    this.activePointerId = null;
    this.handle.removeAttribute('data-active');
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.collapsed) return;
    const growKey = this.side === 'left' ? 'ArrowRight' : 'ArrowLeft';
    const shrinkKey = this.side === 'left' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === growKey) {
      event.preventDefault();
      this.applyWidth(this.widthPx + KEYBOARD_STEP);
    } else if (event.key === shrinkKey) {
      event.preventDefault();
      this.applyWidth(this.widthPx - KEYBOARD_STEP);
    }
  };
}
