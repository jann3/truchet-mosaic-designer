export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Pass null to hide the cancel button entirely — turns this into a plain acknowledgement dialog. */
  cancelLabel?: string | null;
}

export interface ConfirmDialogHandle {
  element: HTMLElement;
  /** Resolves true if the user confirmed, false on cancel/backdrop-click/Escape. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

/**
 * Single reusable modal for destructive-action confirmations and simple
 * alerts, styled like `ExportDialog`. Kept as a native-dialog-free component
 * (rather than `window.confirm`/`alert`) so behavior stays consistent and
 * testable across the app.
 */
export function createConfirmDialog(): ConfirmDialogHandle {
  const backdrop = document.createElement('div');
  backdrop.className = 'confirm-dialog-backdrop';
  backdrop.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  backdrop.appendChild(dialog);

  const heading = document.createElement('h2');
  heading.className = 'confirm-dialog__heading';

  const message = document.createElement('p');
  message.className = 'confirm-dialog__message';

  const footer = document.createElement('div');
  footer.className = 'confirm-dialog__footer';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'confirm-dialog__cancel';

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'confirm-dialog__confirm';

  footer.append(cancelButton, confirmButton);
  dialog.append(heading, message, footer);

  let resolveCurrent: ((result: boolean) => void) | null = null;

  const close = (result: boolean): void => {
    backdrop.hidden = true;
    const resolve = resolveCurrent;
    resolveCurrent = null;
    resolve?.(result);
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) close(false);
  });
  cancelButton.addEventListener('click', () => close(false));
  confirmButton.addEventListener('click', () => close(true));

  return {
    element: backdrop,
    confirm: ({ title, message: body, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) => {
      heading.textContent = title;
      message.textContent = body;
      cancelButton.hidden = cancelLabel === null;
      if (cancelLabel !== null) cancelButton.textContent = cancelLabel;
      confirmButton.textContent = confirmLabel;
      backdrop.hidden = false;
      confirmButton.focus();
      return new Promise<boolean>((resolve) => {
        resolveCurrent = resolve;
      });
    },
  };
}
