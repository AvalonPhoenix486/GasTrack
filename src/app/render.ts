/** Camada DOM: so exibe o modelo da tela e repassa os eventos. Sem regra de negocio. */
import type { Screen } from './screen.ts';

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Elemento #${id} ausente em index.html`);
  return found as T;
}

function text(tag: string, value: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className !== undefined) node.className = className;
  return node;
}

function button(label: string, className: string, ariaLabel?: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.className = className;
  if (ariaLabel !== undefined) b.setAttribute('aria-label', ariaLabel);
  return b;
}

export interface UiState {
  readonly editingId: string | null;
  readonly deletingId: string | null;
}

export interface Handlers {
  onStart(startDate: string): void;
  onFinish(endDate: string): void;
  onEdit(id: string): void;
  /** `endDate` so e informado ao editar ciclo encerrado. */
  onSaveEdit(id: string, startDate: string, endDate: string | undefined): void;
  onCancelEdit(): void;
  onAskDelete(id: string): void;
  onConfirmDelete(id: string): void;
  onCancelDelete(): void;
}

let handlers: Handlers | null = null;

export function bind(h: Handlers): void {
  handlers = h;
  el<HTMLFormElement>('start-form').addEventListener('submit', (e) => {
    e.preventDefault();
    h.onStart(el<HTMLInputElement>('start-date').value);
  });
  el<HTMLFormElement>('end-form').addEventListener('submit', (e) => {
    e.preventDefault();
    h.onFinish(el<HTMLInputElement>('end-date').value);
  });
}

function setBox(id: string, message: string | null): void {
  const box = el(id);
  box.textContent = message ?? '';
  box.hidden = message === null;
}

/** Erro visivel; rola ate ele para nao passar despercebido em telas pequenas. */
export function showMessage(message: string | null): void {
  setBox('message', message);
  if (message !== null) {
    const box = el('message');
    if (typeof box.scrollIntoView === 'function') box.scrollIntoView({ block: 'nearest' });
  }
}

export function showSuccess(message: string | null): void {
  setBox('success', message);
}

export function showNotice(message: string | null): void {
  setBox('notice', message);
}

/** Enquanto uma acao roda: desabilita os botoes e sinaliza aria-busy. */
export function setBusy(busy: boolean): void {
  el('app').setAttribute('aria-busy', String(busy));
  for (const b of document.querySelectorAll<HTMLButtonElement>('#app button')) b.disabled = busy;
}

function editor(id: string, startDate: string, endDate: string | null, label: string): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'edit-form';
  form.setAttribute('aria-label', `Editar ${label}`);
  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.required = true;
  startInput.id = `edit-start-${id}`;
  startInput.value = startDate;
  const startLabel = text('label', 'Início');
  startLabel.setAttribute('for', startInput.id);
  form.append(startLabel, startInput);
  let endInput: HTMLInputElement | null = null;
  if (endDate !== null) {
    endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.required = true;
    endInput.id = `edit-end-${id}`;
    endInput.value = endDate;
    const endLabel = text('label', 'Fim');
    endLabel.setAttribute('for', endInput.id);
    form.append(endLabel, endInput);
  }
  const save = document.createElement('button');
  save.type = 'submit';
  save.textContent = 'Salvar';
  save.className = 'primary';
  const cancel = button('Cancelar', 'secondary');
  cancel.addEventListener('click', () => handlers?.onCancelEdit());
  form.append(save, cancel);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handlers?.onSaveEdit(id, startInput.value, endInput === null ? undefined : endInput.value);
  });
  queueMicrotask(() => startInput.focus());
  return form;
}

function deletePrompt(id: string, label: string, open: boolean): HTMLElement {
  const box = document.createElement('div');
  box.className = 'confirm';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', `Confirmar exclusão de ${label}`);
  box.append(text('p', open ? 'Excluir o ciclo em andamento? Esta ação não pode ser desfeita.' : 'Excluir este ciclo? Esta ação não pode ser desfeita.'));
  const confirm = button('Confirmar exclusão', 'danger');
  confirm.addEventListener('click', () => handlers?.onConfirmDelete(id));
  const cancel = button('Cancelar', 'secondary');
  cancel.addEventListener('click', () => handlers?.onCancelDelete());
  box.append(confirm, cancel);
  queueMicrotask(() => cancel.focus());
  return box;
}

function actions(id: string, label: string, ui: UiState, startDate: string, endDate: string | null): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'actions';
  if (ui.deletingId === id) {
    wrap.append(deletePrompt(id, label, endDate === null));
  } else if (ui.editingId === id) {
    wrap.append(editor(id, startDate, endDate, label));
  } else {
    const edit = button('Editar', 'secondary', `Editar ${label}`);
    edit.addEventListener('click', () => handlers?.onEdit(id));
    const del = button('Excluir', 'danger-outline', `Excluir ${label}`);
    del.addEventListener('click', () => handlers?.onAskDelete(id));
    wrap.append(edit, del);
  }
  return wrap;
}

export function render(screen: Screen, ui: UiState): void {
  el('current-status').textContent = screen.currentText;

  el('start-form').hidden = screen.hasOpenCycle;
  el('end-form').hidden = !screen.hasOpenCycle;
  el<HTMLInputElement>('start-date').value = screen.defaultStartDate;
  el<HTMLInputElement>('end-date').value = screen.defaultEndDate;

  const openBox = el('open-actions');
  openBox.replaceChildren();
  if (screen.openCycle !== null) {
    const { id, startDate, startText } = screen.openCycle;
    openBox.append(actions(id, `ciclo em andamento desde ${startText}`, ui, startDate, null));
  }

  const list = el('history-list');
  list.replaceChildren();
  el('history-empty').textContent = screen.emptyHistoryText;
  el('history-empty').hidden = screen.historyRows.length > 0;
  for (const row of screen.historyRows) {
    const li = document.createElement('li');
    li.className = 'history-row';
    li.dataset['id'] = row.id;
    const dates = document.createElement('div');
    dates.className = 'history-dates';
    dates.append(
      text('span', row.startText, 'history-start'),
      text('span', ' → ', 'history-arrow'),
      text('span', row.endText, 'history-end'),
    );
    li.append(dates, text('strong', row.durationText, 'history-duration'));
    li.append(actions(row.id, `ciclo de ${row.startText} a ${row.endText}`, ui, row.startDate, row.endDate));
    list.append(li);
  }

  const card = el('forecast');
  card.replaceChildren();
  const f = screen.forecast;
  card.dataset['kind'] = f.kind;
  switch (f.kind) {
    case 'insufficient-data':
      card.append(text('h2', f.title), text('p', f.message, 'forecast-message'), text('p', f.historyLine), text('p', f.requiredLine));
      break;
    case 'no-open-cycle':
      card.append(text('h2', f.title), text('p', f.message, 'forecast-message'), text('p', f.basisLine));
      break;
    case 'ok': {
      card.append(text('h2', f.title), text('p', f.centralDate, 'forecast-central'), text('p', f.windowLine, 'forecast-window'));
      for (const line of f.variabilityLines) card.append(text('p', line, 'forecast-variability'));
      card.append(text('p', f.basisLine, 'forecast-basis'));
      const details = document.createElement('details');
      details.append(text('summary', f.detailsTitle));
      for (const row of f.details) details.append(text('p', `${row.label}: ${row.value}`));
      card.append(details);
      break;
    }
    case 'unavailable':
      card.append(text('h2', 'Próxima mudança'), text('p', f.message, 'forecast-message'));
      break;
  }
}
