/** Tela Histórico: filtro por ano, ordenacao, linhas expansiveis com detalhes, edicao e exclusao. */
import { sortRows, filterRows } from '../screen.ts';
import type { HistoryRow, HistorySort, Screen } from '../screen.ts';
import type { ViewContext } from './context.ts';
import { button, h, icon } from './dom.ts';
import { choiceGroup, emptyState, pageHeader } from './parts.ts';
import type { UiState } from './types.ts';

function rowItem(ctx: ViewContext, row: HistoryRow, expanded: boolean): HTMLElement {
  const { m, handlers } = ctx;
  const label = m.history.closedRow(row.startText, row.endText);
  const detailId = `detail-${row.id}`;
  const head = h('button', { type: 'button', class: 'history-head', 'aria-expanded': String(expanded), 'aria-controls': detailId, 'aria-label': m.history.expand(label) },
    h('span', { class: 'check-badge' }, icon('check', 16)),
    h('span', { class: 'history-main' },
      h('span', { class: 'history-dates' }, h('span', { class: 'history-start' }, row.startText), h('span', { class: 'history-arrow', 'aria-hidden': 'true' }, ' → '), h('span', { class: 'history-end' }, row.endText))),
    h('strong', { class: 'plus-days history-duration' }, m.history.plusDays(row.durationText)),
    h('span', { class: expanded ? 'chev open' : 'chev', 'aria-hidden': 'true' }, icon('chevronDown', 18)));
  head.addEventListener('click', () => handlers.onToggleExpand(row.id));

  const list = h('dl', { class: 'detail-list' },
    h('div', null, h('dt', null, m.history.startLabel), h('dd', null, row.startText)),
    h('div', null, h('dt', null, m.history.endLabel), h('dd', null, row.endText)),
    h('div', null, h('dt', null, m.history.totalLabel), h('dd', null, row.durationText)),
    row.calendarText === null ? null : h('div', null, h('dt', null, m.history.calendarLabel), h('dd', null, row.calendarText)));
  const detail = h('div', { class: 'history-detail', id: detailId, hidden: !expanded }, list,
    h('div', { class: 'actions' },
      button(m.common.edit, 'secondary', () => handlers.onOpenSheet({ kind: 'edit', id: row.id }), m.history.editAria(label)),
      button(m.common.delete, 'danger-outline', () => handlers.onOpenSheet({ kind: 'delete', id: row.id }), m.history.deleteAria(label))));
  return h('li', { class: expanded ? 'history-row expanded' : 'history-row', 'data-id': row.id }, head, detail);
}

export function historyView(ctx: ViewContext, screen: Screen, ui: UiState): HTMLElement {
  const { m, handlers } = ctx;
  const root = h('div', { class: 'view' }, pageHeader(m.history.title, null, m.common.back));

  if (screen.openCycle !== null) {
    const open = screen.openCycle;
    const label = m.history.openRow(open.startText);
    root.append(h('section', { class: 'card card-open', 'aria-label': m.history.inProgress },
      h('span', { class: 'badge' }, m.history.inProgress),
      h('p', { class: 'history-dates' }, m.history.since(open.startText)),
      open.daysValue === null ? null : h('strong', { class: 'history-duration' }, `${open.daysValue} ${open.daysUnit}`),
      h('div', { class: 'actions' },
        button(m.common.edit, 'secondary', () => handlers.onOpenSheet({ kind: 'edit', id: open.id }), m.history.editAria(label)),
        button(m.common.delete, 'danger-outline', () => handlers.onOpenSheet({ kind: 'delete', id: open.id }), m.history.deleteAria(label)))));
  }

  if (screen.historyRows.length === 0) {
    root.append(emptyState(null, screen.emptyHistoryText, m.history.emptyHint,
      screen.openCycle === null ? button(m.home.startCycle, 'primary', () => handlers.onOpenSheet({ kind: 'start' })) : null));
    root.append(h('p', { class: 'local-note' }, icon('info', 18), m.history.localNote));
    return root;
  }

  // O filtro por ano so aparece quando ha mais de um ano; um ano que sumiu (ex.: apos excluir) volta a "todos".
  const year = ui.yearFilter !== 'all' && screen.years.includes(ui.yearFilter) ? ui.yearFilter : 'all';
  const visible = sortRows(filterRows(screen.historyRows, year), ui.sort);

  if (screen.years.length > 1) {
    root.append(choiceGroup(m.history.filterLabel, [{ value: 'all', label: m.history.filterAll }, ...screen.years.map((y) => ({ value: y, label: y }))], year, (v) => handlers.onYear(v), 'segmented'));
  }
  const select = h('select', { id: 'sort-select' });
  for (const key of Object.keys(m.history.sort) as HistorySort[]) {
    const option = h('option', { value: key }, m.history.sort[key]);
    if (key === ui.sort) option.selected = true;
    select.append(option);
  }
  select.addEventListener('change', () => handlers.onSort(select.value as HistorySort));
  root.append(h('div', { class: 'toolbar' },
    h('p', { class: 'muted', id: 'history-count' }, m.history.count(visible.length)),
    h('label', { class: 'sort', for: 'sort-select' }, h('span', null, m.history.sortLabel), select)));

  const list = h('ol', { class: 'history-list', id: 'history-list' });
  for (const row of visible) list.append(rowItem(ctx, row, ui.expandedId === row.id));
  root.append(list, h('p', { class: 'local-note' }, icon('info', 18), m.history.localNote));
  return root;
}
