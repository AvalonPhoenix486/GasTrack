/** Camada DOM: so exibe o modelo da tela e repassa os eventos. Sem regra de negocio. */
import type { HistoryRow, Screen, ForecastUnavailable, HistorySort, StatsView } from './screen.ts';
import { SORT_LABELS, sortRows } from './screen.ts';
import type { ForecastView } from '../ui/forecast/index.ts';
import { THEME_LABELS } from './preferences.ts';
import type { ThemePreference } from './preferences.ts';

export type Tab = 'home' | 'history' | 'stats' | 'forecast';
export type Sheet =
  | { readonly kind: 'start' }
  | { readonly kind: 'finish' }
  | { readonly kind: 'edit'; readonly id: string }
  | { readonly kind: 'delete'; readonly id: string }
  | null;

export interface UiState {
  readonly tab: Tab;
  readonly sheet: Sheet;
  readonly sort: HistorySort;
  readonly theme: ThemePreference;
}

export interface Handlers {
  onTab(tab: Tab): void;
  onOpenSheet(sheet: Exclude<Sheet, null>): void;
  onCloseSheet(): void;
  onStart(startDate: string): void;
  onFinish(endDate: string): void;
  /** `endDate` so e informado ao editar ciclo encerrado. */
  onSaveEdit(id: string, startDate: string, endDate: string | undefined): void;
  onConfirmDelete(id: string): void;
  onSort(sort: HistorySort): void;
  onTheme(): void;
}

const TABS: readonly { readonly id: Tab; readonly label: string; readonly icon: string }[] = [
  { id: 'home', label: 'Início', icon: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { id: 'history', label: 'Histórico', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2' },
  { id: 'stats', label: 'Estatísticas', icon: 'M5 20V11M12 20V4M19 20v-6' },
  { id: 'forecast', label: 'Previsão', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z' },
];

let handlers: Handlers | null = null;
let renderedSheetKey: string | null = null;
let sheetOpener: HTMLElement | null = null;
let toastTimer: number | undefined;

// ---------- helpers de DOM ----------
type Kid = Node | string | null | false | undefined;
type Attrs = Record<string, string | boolean | undefined>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === false) continue;
    if (name === 'class') node.className = String(value);
    else node.setAttribute(name, value === true ? '' : value);
  }
  for (const kid of kids) {
    if (kid === null || kid === false || kid === undefined) continue;
    node.append(kid);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

/** Botijao estilizado e generico (ilustracao decorativa do estado vazio). */
function cylinder(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 80');
  svg.setAttribute('width', '72');
  svg.setAttribute('height', '90');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'cylinder');
  const parts: [string, Record<string, string>][] = [
    ['rect', { x: '14', y: '22', width: '36', height: '50', rx: '10' }],
    ['rect', { x: '24', y: '8', width: '16', height: '12', rx: '3' }],
    ['path', { d: 'M20 4h24', 'stroke-width': '4', 'stroke-linecap': 'round' }],
    ['path', { d: 'M14 40h36M14 54h36', 'stroke-width': '2', opacity: '.5' }],
  ];
  for (const [tag, attrs] of parts) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`Elemento #${id} ausente em index.html`);
  return found as T;
}

function button(label: string, className: string, onClick: () => void, ariaLabel?: string): HTMLButtonElement {
  const b = h('button', { type: 'button', class: className, 'aria-label': ariaLabel }, label);
  b.addEventListener('click', onClick);
  return b;
}

// ---------- ligacao e feedback ----------
export function bind(h2: Handlers): void {
  handlers = h2;
  el('theme-button').addEventListener('click', () => h2.onTheme());
}

function setBox(id: string, message: string | null): void {
  const box = el(id);
  box.textContent = message ?? '';
  box.hidden = message === null;
}

export function showNotice(message: string | null): void {
  setBox('notice', message);
}

/** Erro de uma acao: aparece DENTRO do painel aberto, junto do formulario. */
export function showError(message: string | null): void {
  const box = document.getElementById('sheet-error');
  if (box === null) {
    // Sem painel aberto: nao pode ficar silencioso.
    if (message !== null) showToast(message, 'error');
    return;
  }
  box.textContent = message ?? '';
  box.hidden = message === null;
  if (message !== null && typeof box.scrollIntoView === 'function') box.scrollIntoView({ block: 'nearest' });
}

export function showToast(message: string, kind: 'success' | 'error' = 'success'): void {
  const toast = el('toast');
  toast.textContent = message;
  toast.dataset['kind'] = kind;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4000);
}

/** Enquanto uma acao roda: desabilita os botoes e sinaliza aria-busy. */
export function setBusy(busy: boolean): void {
  el('app').setAttribute('aria-busy', String(busy));
  for (const b of document.querySelectorAll<HTMLButtonElement>('#app button, #sheet-root button')) b.disabled = busy;
}

// ---------- blocos de previsao ----------
function disclaimer(): HTMLElement {
  return h('p', { class: 'hint' }, 'A previsão é uma estimativa estatística, não uma garantia.');
}

function forecastCard(f: ForecastView | ForecastUnavailable, full: boolean): HTMLElement {
  const card = h('section', { class: 'card forecast', 'data-kind': f.kind, 'aria-labelledby': full ? 'forecast-full-title' : 'forecast-title' });
  const titleId = full ? 'forecast-full-title' : 'forecast-title';
  switch (f.kind) {
    case 'ok':
      card.append(
        h('h2', { class: 'eyebrow', id: titleId }, f.title),
        h('p', { class: 'forecast-central' }, f.centralDate),
        h('p', { class: 'forecast-window' }, f.windowLine),
      );
      if (full) {
        for (const line of f.variabilityLines) card.append(h('p', { class: 'forecast-variability muted' }, line));
      }
      card.append(h('p', { class: 'forecast-basis muted' }, f.basisLine));
      if (full) {
        const details = h('details', { class: 'details', open: true }, h('summary', null, f.detailsTitle));
        const list = h('dl', { class: 'detail-list' });
        for (const row of f.details) list.append(h('div', null, h('dt', null, row.label), h('dd', null, row.value)));
        details.append(list);
        card.append(details);
      }
      break;
    case 'insufficient-data':
      card.append(
        h('h2', { class: 'eyebrow', id: titleId }, f.title),
        h('p', { class: 'forecast-message' }, f.message),
        h('p', { class: 'muted' }, f.historyLine),
        h('p', { class: 'muted' }, f.requiredLine),
      );
      break;
    case 'no-open-cycle':
      card.append(
        h('h2', { class: 'eyebrow', id: titleId }, f.title),
        h('p', { class: 'forecast-message' }, f.message),
        h('p', { class: 'muted' }, f.basisLine),
      );
      break;
    case 'unavailable':
      card.append(h('h2', { class: 'eyebrow', id: titleId }, 'Próxima mudança'), h('p', { class: 'forecast-message' }, f.message));
      break;
  }
  card.append(disclaimer());
  return card;
}

// ---------- abas ----------
function cycleActions(row: HistoryRow): HTMLElement {
  const label = `ciclo de ${row.startText} a ${row.endText}`;
  return h(
    'div', { class: 'actions' },
    button('Editar', 'secondary', () => handlers?.onOpenSheet({ kind: 'edit', id: row.id }), `Editar ${label}`),
    button('Excluir', 'danger-outline', () => handlers?.onOpenSheet({ kind: 'delete', id: row.id }), `Excluir ${label}`),
  );
}

function historyItem(row: HistoryRow): HTMLElement {
  return h(
    'li', { class: 'history-row', 'data-id': row.id },
    h('div', { class: 'history-main' },
      h('div', { class: 'history-dates' },
        h('span', { class: 'history-start' }, row.startText),
        h('span', { class: 'history-arrow', 'aria-hidden': 'true' }, ' → '),
        h('span', { class: 'history-end' }, row.endText)),
      h('strong', { class: 'history-duration' }, row.durationText)),
    cycleActions(row),
  );
}

function openCycleCard(screen: Screen): HTMLElement {
  const open = screen.openCycle;
  if (open === null) throw new Error('openCycleCard sem ciclo aberto');
  const label = `ciclo em andamento desde ${open.startText}`;
  return h(
    'section', { class: 'card hero', 'aria-labelledby': 'hero-title' },
    h('h2', { class: 'eyebrow', id: 'hero-title' }, 'Ciclo atual'),
    open.daysValue === null
      ? h('p', { class: 'hero-note' }, open.note ?? '')
      : h('p', { class: 'hero-days' }, h('span', { class: 'hero-number' }, open.daysValue), ' ', h('span', { class: 'hero-unit' }, open.daysUnit)),
    h('p', { class: 'hero-since' }, h('span', { class: 'muted' }, 'Em andamento desde'), h('strong', null, open.startText)),
    h('div', { class: 'actions' },
      button('Encerrar ciclo', 'primary', () => handlers?.onOpenSheet({ kind: 'finish' })),
      button('Editar início', 'secondary', () => handlers?.onOpenSheet({ kind: 'edit', id: open.id }), `Editar ${label}`),
      button('Excluir', 'danger-outline', () => handlers?.onOpenSheet({ kind: 'delete', id: open.id }), `Excluir ${label}`)),
  );
}

function emptyCycleCard(): HTMLElement {
  return h(
    'section', { class: 'card hero hero-empty', 'aria-labelledby': 'hero-title' },
    cylinder(),
    h('h2', { class: 'eyebrow', id: 'hero-title' }, 'Ciclo atual'),
    h('p', { class: 'hero-empty-text' }, 'Nenhum ciclo em andamento.'),
    h('p', { class: 'muted' }, 'Registre o dia em que você começou a usar um novo botijão para acompanhar a duração.'),
    h('div', { class: 'actions' }, button('Iniciar ciclo', 'primary', () => handlers?.onOpenSheet({ kind: 'start' }))),
  );
}

function homeView(screen: Screen): HTMLElement {
  const root = h('div', { class: 'view' });
  root.append(screen.openCycle === null ? emptyCycleCard() : openCycleCard(screen));
  root.append(forecastCard(screen.forecast, false));

  if (screen.stats.kind === 'ok') {
    const typical = screen.stats.cards[0];
    root.append(h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('span', { class: 'muted' }, 'Duração típica (mediana)'), h('strong', null, typical?.value ?? '—')),
      h('div', { class: 'kpi' }, h('span', { class: 'muted' }, 'Ciclos encerrados'), h('strong', null, String(screen.closedCount)))));
  }

  const recent = h('section', { class: 'card', 'aria-labelledby': 'recent-title' }, h('h2', { class: 'section-title', id: 'recent-title' }, 'Últimos ciclos'));
  if (screen.historyRows.length === 0) {
    recent.append(h('p', { class: 'muted' }, screen.emptyHistoryText));
  } else {
    const list = h('ul', { class: 'recent-list' });
    for (const row of screen.historyRows.slice(0, 3)) {
      list.append(h('li', null, h('span', null, `${row.startText} → ${row.endText}`), h('strong', null, row.durationText)));
    }
    recent.append(list, button('Ver histórico completo', 'link', () => handlers?.onTab('history')));
  }
  root.append(recent);
  return root;
}

function historyView(screen: Screen, ui: UiState): HTMLElement {
  const root = h('div', { class: 'view' });
  root.append(h('h2', { class: 'page-title', id: 'page-title' }, 'Histórico'));
  if (screen.openCycle !== null) {
    const open = screen.openCycle;
    const label = `ciclo em andamento desde ${open.startText}`;
    root.append(h('section', { class: 'card card-open', 'aria-label': 'Ciclo em andamento' },
      h('span', { class: 'badge' }, 'Em andamento'),
      h('p', { class: 'history-dates' }, `Desde ${open.startText}`),
      open.daysValue === null ? null : h('strong', { class: 'history-duration' }, `${open.daysValue} ${open.daysUnit}`),
      h('div', { class: 'actions' },
        button('Editar', 'secondary', () => handlers?.onOpenSheet({ kind: 'edit', id: open.id }), `Editar ${label}`),
        button('Excluir', 'danger-outline', () => handlers?.onOpenSheet({ kind: 'delete', id: open.id }), `Excluir ${label}`))));
  }
  if (screen.historyRows.length === 0) {
    root.append(h('section', { class: 'card empty' }, h('p', { class: 'hero-empty-text' }, screen.emptyHistoryText),
      h('p', { class: 'muted' }, 'Quando você encerrar um ciclo, ele aparece aqui com a duração em dias.'),
      screen.openCycle === null ? h('div', { class: 'actions' }, button('Iniciar ciclo', 'primary', () => handlers?.onOpenSheet({ kind: 'start' }))) : null));
    return root;
  }
  const select = h('select', { id: 'sort-select' });
  for (const key of Object.keys(SORT_LABELS) as HistorySort[]) {
    const option = h('option', { value: key }, SORT_LABELS[key]);
    if (key === ui.sort) option.selected = true;
    select.append(option);
  }
  select.addEventListener('change', () => handlers?.onSort(select.value as HistorySort));
  root.append(h('div', { class: 'toolbar' },
    h('p', { class: 'muted', id: 'history-count' }, `${screen.closedCount} ${screen.closedCount === 1 ? 'ciclo encerrado' : 'ciclos encerrados'}`),
    h('label', { class: 'sort', for: 'sort-select' }, h('span', null, 'Ordenar'), select)));
  const list = h('ol', { class: 'history-list', id: 'history-list' });
  for (const row of sortRows(screen.historyRows, ui.sort)) list.append(historyItem(row));
  root.append(list);
  return root;
}

function statsView(stats: StatsView): HTMLElement {
  const root = h('div', { class: 'view' }, h('h2', { class: 'page-title', id: 'page-title' }, 'Estatísticas'));
  if (stats.kind === 'empty') {
    root.append(h('section', { class: 'card empty' }, h('p', { class: 'hero-empty-text' }, 'Sem dados ainda'), h('p', { class: 'muted' }, stats.message)));
    return root;
  }
  const grid = h('dl', { class: 'stat-grid' });
  for (const c of stats.cards) grid.append(h('div', { class: 'stat' }, h('dt', null, c.label), h('dd', null, c.value)));
  root.append(h('section', { class: 'card', 'aria-label': 'Resumo das durações' }, grid, h('p', { class: 'muted' }, stats.basisLine)));

  const chart = h('section', { class: 'card', 'aria-labelledby': 'chart-title' }, h('h2', { class: 'section-title', id: 'chart-title' }, 'Duração de cada ciclo'));
  const bars = h('ul', { class: 'bars' });
  for (const b of stats.bars) {
    const fill = h('span', { class: 'bar-fill' });
    fill.style.width = `${b.widthPct}%`;
    const tick = h('span', { class: 'median-tick', 'aria-hidden': 'true' });
    tick.style.left = `${stats.medianPct}%`;
    bars.append(h('li', { class: 'bar-row', 'data-id': b.id },
      h('span', { class: 'bar-label' }, b.label),
      h('span', { class: 'bar-track' }, fill, tick),
      h('span', { class: 'bar-value' }, b.valueText)));
  }
  chart.append(bars, h('p', { class: 'muted chart-legend' }, h('span', { class: 'legend-dot', 'aria-hidden': 'true' }), stats.medianLabel));
  root.append(chart);
  if (stats.caution !== null) root.append(h('p', { class: 'banner banner-info' }, stats.caution));
  return root;
}

function forecastView(screen: Screen): HTMLElement {
  return h('div', { class: 'view' }, h('h2', { class: 'page-title', id: 'page-title' }, 'Previsão'), forecastCard(screen.forecast, true));
}

function renderTabs(ui: UiState): void {
  const nav = el('tabs');
  nav.replaceChildren();
  for (const t of TABS) {
    const active = t.id === ui.tab;
    const b = h('button', { type: 'button', class: active ? 'tab active' : 'tab', 'aria-current': active ? 'page' : undefined },
      icon(t.icon), h('span', null, t.label));
    b.addEventListener('click', () => handlers?.onTab(t.id));
    nav.append(b);
  }
}

// ---------- paineis (bottom sheets) ----------
function dateField(id: string, label: string, value: string): [HTMLElement, HTMLInputElement] {
  const input = h('input', { id, type: 'date', required: true });
  input.value = value;
  return [h('div', { class: 'field' }, h('label', { for: id }, label), input), input];
}

function sheetContent(sheet: Exclude<Sheet, null>, screen: Screen): { title: string; body: HTMLElement; focus: () => void } | null {
  const cancel = () => button('Cancelar', 'secondary', () => handlers?.onCloseSheet());
  switch (sheet.kind) {
    case 'start': {
      const [field, input] = dateField('sheet-date', 'Data de início', screen.defaultStartDate);
      const form = h('form', { class: 'sheet-form' }, field, h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, 'Iniciar ciclo'), cancel()));
      form.addEventListener('submit', (e) => { e.preventDefault(); handlers?.onStart(input.value); });
      return { title: 'Iniciar ciclo', body: h('div', null, h('p', { class: 'muted' }, 'Informe o dia em que o novo botijão começou a ser usado.'), form), focus: () => input.focus() };
    }
    case 'finish': {
      const [field, input] = dateField('sheet-date', 'Data de encerramento', screen.defaultEndDate);
      const form = h('form', { class: 'sheet-form' }, field, h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, 'Encerrar ciclo'), cancel()));
      form.addEventListener('submit', (e) => { e.preventDefault(); handlers?.onFinish(input.value); });
      return { title: 'Encerrar ciclo', body: h('div', null, h('p', { class: 'muted' }, 'Informe o dia em que o gás acabou.'), form), focus: () => input.focus() };
    }
    case 'edit': {
      const isOpen = screen.openCycle?.id === sheet.id;
      const row = screen.historyRows.find((r) => r.id === sheet.id);
      if (!isOpen && row === undefined) return null;
      const [startField, startInput] = dateField('edit-start', 'Início', isOpen ? (screen.openCycle?.startDate ?? '') : (row?.startDate ?? ''));
      const [endField, endInput] = isOpen ? [null, null] : dateField('edit-end', 'Fim', row?.endDate ?? '');
      const form = h('form', { class: 'sheet-form' }, startField, endField, h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, 'Salvar'), cancel()));
      form.addEventListener('submit', (e) => { e.preventDefault(); handlers?.onSaveEdit(sheet.id, startInput.value, endInput === null ? undefined : endInput.value); });
      return { title: 'Editar ciclo', body: form, focus: () => startInput.focus() };
    }
    case 'delete': {
      const isOpen = screen.openCycle?.id === sheet.id;
      const row = screen.historyRows.find((r) => r.id === sheet.id);
      if (!isOpen && row === undefined) return null;
      const what = isOpen ? `o ciclo em andamento desde ${screen.openCycle?.startText ?? ''}` : `o ciclo de ${row?.startText ?? ''} a ${row?.endText ?? ''}`;
      const cancelButton = cancel();
      const body = h('div', null,
        h('p', null, `Excluir ${what}? Esta ação não pode ser desfeita.`),
        h('div', { class: 'actions' }, button('Confirmar exclusão', 'danger', () => handlers?.onConfirmDelete(sheet.id)), cancelButton));
      return { title: 'Excluir ciclo?', body, focus: () => cancelButton.focus() };
    }
  }
}

function sheetKey(sheet: Sheet): string | null {
  return sheet === null ? null : JSON.stringify(sheet);
}

function trapFocus(root: HTMLElement, e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.preventDefault(); handlers?.onCloseSheet(); return; }
  if (e.key !== 'Tab') return;
  const items = [...root.querySelectorAll<HTMLElement>('button, input, select, [href]')].filter((n) => !n.hasAttribute('disabled'));
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) return;
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function renderSheet(ui: UiState, screen: Screen): void {
  const root = el('sheet-root');
  const key = sheetKey(ui.sheet);
  if (key === renderedSheetKey) return; // mantem o painel (e o que o usuario digitou) como esta
  const hadSheet = renderedSheetKey !== null;
  renderedSheetKey = key;
  root.replaceChildren();
  const inert = ['topbar', 'view', 'tabs'];
  const content = ui.sheet === null ? null : sheetContent(ui.sheet, screen);
  document.body.classList.toggle('sheet-open', content !== null);
  for (const id of inert) {
    const n = el(id);
    if (content !== null) n.setAttribute('aria-hidden', 'true'); else n.removeAttribute('aria-hidden');
  }
  if (content === null) {
    if (hadSheet) {
      // devolve o foco a quem abriu, ou ao conteudo principal
      if (sheetOpener !== null && document.contains(sheetOpener)) sheetOpener.focus({ preventScroll: true }); else el('view').focus({ preventScroll: true });
      sheetOpener = null;
    }
    return;
  }
  if (!hadSheet && document.activeElement instanceof HTMLElement) sheetOpener = document.activeElement;
  const dialog = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
    h('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    h('h2', { id: 'sheet-title' }, content.title),
    h('p', { id: 'sheet-error', class: 'banner banner-error', role: 'alert', hidden: true }),
    content.body);
  const backdrop = h('div', { class: 'sheet-backdrop' }, dialog);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) handlers?.onCloseSheet(); });
  dialog.addEventListener('keydown', (e) => trapFocus(dialog, e));
  root.append(backdrop);
  content.focus();
}

// ---------- entrada principal ----------
export function render(screen: Screen, ui: UiState): void {
  document.documentElement.dataset['theme'] = ui.theme === 'system' ? '' : ui.theme;
  if (ui.theme === 'system') delete document.documentElement.dataset['theme'];
  const themeButton = el('theme-button');
  themeButton.setAttribute('aria-label', `Tema: ${THEME_LABELS[ui.theme]}. Tocar para alternar.`);
  themeButton.setAttribute('title', `Tema: ${THEME_LABELS[ui.theme]}`);
  themeButton.replaceChildren(icon('M12 3a9 9 0 1 0 0 18V3z'));

  renderTabs(ui);
  const view = el('view');
  const scrollTop = window.scrollY;
  switch (ui.tab) {
    case 'home': view.replaceChildren(homeView(screen)); break;
    case 'history': view.replaceChildren(historyView(screen, ui)); break;
    case 'stats': view.replaceChildren(statsView(screen.stats)); break;
    case 'forecast': view.replaceChildren(forecastView(screen)); break;
  }
  window.scrollTo(0, scrollTop);
  renderSheet(ui, screen);
}

/** Troca de aba: volta ao topo e leva o foco ao conteudo. */
export function focusView(): void {
  window.scrollTo(0, 0);
  el('view').focus({ preventScroll: true });
}

/** Chama `callback` quando o app volta a ficar visivel (ex.: WebView retomado em outro dia). */
export function onBecameVisible(callback: () => void): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') callback();
  });
}
