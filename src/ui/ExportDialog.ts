import type { DocumentStore } from '../document/DocumentStore';
import type { ExportSettings } from '../document/types';
import { canExportVector, exportRaster, exportVectorSvg, type RasterFormat } from '../export/exportDocument';

export interface ExportDialogHandle {
  element: HTMLElement;
  open: () => void;
}

const RESOLUTIONS = [1000, 2000, 4000];

const FORMAT_OPTIONS: { value: ExportSettings['format']; label: string }[] = [
  { value: 'svg', label: 'SVG (vector)' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
];

/**
 * Export settings (`TruchetDocument.exportSettings`) are stored on the
 * document — so they round-trip with Phase 12 save/load — but changing them
 * isn't a creative edit, so unlike every other document mutation in this app
 * these commits deliberately skip `history.record()`: nobody expects Ctrl+Z
 * to step back through export-dropdown fiddling.
 */
function patchExportSettings(store: DocumentStore, patch: Partial<ExportSettings>): void {
  store.update((doc) => ({ ...doc, exportSettings: { ...doc.exportSettings, ...patch } }));
}

export function createExportDialog(store: DocumentStore): ExportDialogHandle {
  const backdrop = document.createElement('div');
  backdrop.className = 'export-dialog-backdrop';
  backdrop.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'export-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Export');
  backdrop.appendChild(dialog);

  const close = (): void => {
    backdrop.hidden = true;
  };

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) close();
  });

  /** Falls back to 'png' when the stored format is 'svg' but no longer valid, without writing that fallback back to the document — only an actual format change (or export) should touch `exportSettings`. */
  function effectiveFormat(doc: Parameters<typeof canExportVector>[0]): ExportSettings['format'] {
    const { format } = doc.exportSettings;
    return format === 'svg' && !canExportVector(doc) ? 'png' : format;
  }

  const render = (): void => {
    dialog.replaceChildren();
    const doc = store.get();
    const settings = doc.exportSettings;
    const vectorAvailable = canExportVector(doc);
    const format = effectiveFormat(doc);

    const header = document.createElement('div');
    header.className = 'export-dialog__header';
    const heading = document.createElement('h2');
    heading.className = 'export-dialog__heading';
    heading.textContent = 'Export';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'export-dialog__close';
    closeButton.textContent = '\u{2715}';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.addEventListener('click', close);
    header.append(heading, closeButton);
    dialog.appendChild(header);

    const body = document.createElement('div');
    body.className = 'export-dialog__body';

    body.appendChild(renderFormatField(format, vectorAvailable));
    if (format !== 'svg') {
      body.appendChild(renderResolutionField(settings.resolution));
    }
    body.appendChild(
      renderCheckboxField(
        'export-transparent',
        'Transparent background',
        settings.transparentBackground,
        format === 'jpg',
        (checked) => patchExportSettings(store, { transparentBackground: checked }),
      ),
    );
    body.appendChild(
      renderCheckboxField('export-grid-lines', 'Include grid lines', settings.includeGridLines, false, (checked) =>
        patchExportSettings(store, { includeGridLines: checked }),
      ),
    );
    dialog.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'export-dialog__footer';
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'export-dialog__export';
    exportButton.textContent = 'Export';
    exportButton.addEventListener('click', () => runExport(exportButton));
    footer.appendChild(exportButton);
    dialog.appendChild(footer);
  };

  function renderFormatField(format: ExportSettings['format'], vectorAvailable: boolean): HTMLElement {
    const field = document.createElement('div');
    field.className = 'export-dialog__field';
    const label = document.createElement('label');
    label.className = 'export-dialog__label';
    label.htmlFor = 'export-format';
    label.textContent = 'Format';

    const select = document.createElement('select');
    select.id = 'export-format';
    select.className = 'export-dialog__select';
    for (const option of FORMAT_OPTIONS) {
      const optionEl = document.createElement('option');
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      optionEl.selected = option.value === format;
      optionEl.disabled = option.value === 'svg' && !vectorAvailable;
      select.appendChild(optionEl);
    }
    select.title = vectorAvailable
      ? ''
      : 'SVG export is unavailable while the document has an image-fill layer';
    select.addEventListener('change', () => {
      patchExportSettings(store, { format: select.value as ExportSettings['format'] });
    });

    field.append(label, select);
    return field;
  }

  function renderResolutionField(resolution: number): HTMLElement {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'export-dialog__fieldset';
    const legend = document.createElement('legend');
    legend.className = 'export-dialog__label';
    legend.textContent = 'Resolution';
    fieldset.appendChild(legend);

    const row = document.createElement('div');
    row.className = 'export-dialog__resolution-row';
    for (const value of RESOLUTIONS) {
      const optionLabel = document.createElement('label');
      optionLabel.className = 'export-dialog__radio';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'export-resolution';
      radio.value = String(value);
      radio.checked = value === resolution;
      radio.addEventListener('change', () => {
        if (radio.checked) patchExportSettings(store, { resolution: value });
      });
      optionLabel.append(radio, document.createTextNode(`${value}px`));
      row.appendChild(optionLabel);
    }
    fieldset.appendChild(row);
    return fieldset;
  }

  function renderCheckboxField(
    id: string,
    labelText: string,
    checked: boolean,
    disabled: boolean,
    onChange: (checked: boolean) => void,
  ): HTMLElement {
    const field = document.createElement('div');
    field.className = 'export-dialog__checkbox-field';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = id;
    checkbox.checked = disabled ? false : checked;
    checkbox.disabled = disabled;
    checkbox.addEventListener('change', () => onChange(checkbox.checked));

    const label = document.createElement('label');
    label.htmlFor = id;
    label.className = 'export-dialog__label';
    label.textContent = labelText;

    field.append(checkbox, label);
    return field;
  }

  function runExport(button: HTMLButtonElement): void {
    const doc = store.get();
    const settings = doc.exportSettings;
    const format = effectiveFormat(doc);
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Exporting…';

    const finish = (): void => {
      button.disabled = false;
      button.textContent = originalLabel;
    };

    if (format === 'svg') {
      exportVectorSvg(doc, {
        transparentBackground: settings.transparentBackground,
        includeGridLines: settings.includeGridLines,
      });
      finish();
      close();
      return;
    }

    exportRaster(doc, {
      format: format as RasterFormat,
      resolution: settings.resolution,
      transparentBackground: settings.transparentBackground,
      includeGridLines: settings.includeGridLines,
    })
      .then(() => {
        finish();
        close();
      })
      .catch(() => {
        finish();
      });
  }

  store.subscribe(render);
  render();

  return {
    element: backdrop,
    open: () => {
      backdrop.hidden = false;
    },
  };
}
