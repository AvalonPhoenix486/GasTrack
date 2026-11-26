/** Paineis (bottom sheets): formularios e confirmacoes. */
import type { Screen } from '../screen.ts';
import type { ViewContext } from './context.ts';
import { button, h } from './dom.ts';
import type { Extras, Sheet } from './types.ts';

export interface SheetContent {
  readonly title: string;
  readonly body: HTMLElement;
  readonly focus: () => void;
}

function dateField(id: string, label: string, value: string): [HTMLElement, HTMLInputElement] {
  const input = h('input', { id, type: 'date', required: true });
  input.value = value;
  return [h('div', { class: 'field' }, h('label', { for: id }, label), input), input];
}

/** Caixa de confirmacao explicita: o botao so e habilitado depois de marcar. */
function acknowledge(id: string, text: string, confirm: HTMLButtonElement): HTMLElement {
  const box = h('input', { id, type: 'checkbox' });
  confirm.disabled = true;
  box.addEventListener('change', () => { confirm.disabled = !box.checked; });
  return h('label', { class: 'check-field', for: id }, box, h('span', null, text));
}

export function sheetContent(ctx: ViewContext, sheet: Exclude<Sheet, null>, screen: Screen, extras: Extras): SheetContent | null {
  const { m, handlers } = ctx;
  const t = m.sheets;
  const cancel = () => button(m.common.cancel, 'secondary', () => handlers.onCloseSheet());
  const submit = (label: string) => h('button', { type: 'submit', class: 'primary' }, label);

  switch (sheet.kind) {
    case 'start': {
      const [field, input] = dateField('sheet-date', t.startDate, screen.defaultStartDate);
      const form = h('form', { class: 'sheet-form' }, field, h('div', { class: 'actions' }, submit(t.startTitle), cancel()));
      form.addEventListener('submit', (e) => { e.preventDefault(); handlers.onStart(input.value); });
      return { title: t.startTitle, body: h('div', null, h('p', { class: 'muted' }, t.startHint), form), focus: () => input.focus({ preventScroll: true }) };
    }
    case 'finish': {
      const [field, input] = dateField('sheet-date', t.finishDate, screen.defaultEndDate);
      const form = h('form', { class: 'sheet-form' }, field, h('div', { class: 'actions' }, submit(t.finishTitle), cancel()));
      form.addEventListener('submit', (e) => { e.preventDefault(); handlers.onFinish(input.value); });
      return { title: t.finishTitle, body: h('div', null, h('p', { class: 'muted' }, t.finishHint), form), focus: () => input.focus({ preventScroll: true }) };
    }
    case 'change': {
      if (screen.openCycle === null) return null;
      const [field, input] = dateField('sheet-date', t.changeDate, screen.defaultEndDate);
      const form = h('form', { class: 'sheet-form' }, field, h('div', { class: 'actions' }, submit(t.changeTitle), cancel()));
      form.addEventListener('submit', (e) => { e.preventDefault(); handlers.onChange(input.value); });
      return { title: t.changeTitle, body: h('div', null, h('p', { class: 'muted' }, t.changeHint), form), focus: () => input.focus({ preventScroll: true }) };
    }
    case 'edit': {
      const isOpen = screen.openCycle?.id === sheet.id;
      const row = screen.historyRows.find((r) => r.id === sheet.id);
      if (!isOpen && row === undefined) return null;
      const [startField, startInput] = dateField('edit-start', t.editStart, isOpen ? (screen.openCycle?.startDate ?? '') : (row?.startDate ?? ''));
      const [endField, endInput] = isOpen ? [null, null] : dateField('edit-end', t.editEnd, row?.endDate ?? '');
      const form = h('form', { class: 'sheet-form' }, startField, endField, h('div', { class: 'actions' }, submit(m.common.save), cancel()));
      form.addEventListener('submit', (e) => { e.preventDefault(); handlers.onSaveEdit(sheet.id, startInput.value, endInput === null ? undefined : endInput.value); });
      return { title: t.editTitle, body: form, focus: () => startInput.focus({ preventScroll: true }) };
    }
    case 'delete': {
      const isOpen = screen.openCycle?.id === sheet.id;
      const row = screen.historyRows.find((r) => r.id === sheet.id);
      if (!isOpen && row === undefined) return null;
      const text = isOpen ? t.deleteOpen(screen.openCycle?.startText ?? '') : t.deleteClosed(row?.startText ?? '', row?.endText ?? '');
      const cancelButton = cancel();
      const body = h('div', null, h('p', null, text),
        h('div', { class: 'actions' }, button(t.confirmDelete, 'danger', () => handlers.onConfirmDelete(sheet.id)), cancelButton));
      return { title: t.deleteTitle, body, focus: () => cancelButton.focus({ preventScroll: true }) };
    }
    case 'clear': {
      const confirm = button(t.clearConfirm, 'danger', () => handlers.onConfirmClear());
      const ack = acknowledge('clear-ack', t.clearAck, confirm);
      const cancelButton = cancel();
      const body = h('div', { class: 'sheet-form' }, h('p', null, t.clearText(extras.storedCount)), ack, h('div', { class: 'actions' }, confirm, cancelButton));
      return { title: t.clearTitle, body, focus: () => cancelButton.focus({ preventScroll: true }) };
    }
    case 'import': {
      const confirm = button(t.importConfirm, 'danger', () => handlers.onConfirmImport());
      const ack = acknowledge('import-ack', t.importAck, confirm);
      const cancelButton = cancel();
      const body = h('div', { class: 'sheet-form' }, h('p', null, t.importText(extras.pendingImportCount, extras.storedCount)), ack, h('div', { class: 'actions' }, confirm, cancelButton));
      return { title: t.importTitle, body, focus: () => cancelButton.focus({ preventScroll: true }) };
    }
  }
}
