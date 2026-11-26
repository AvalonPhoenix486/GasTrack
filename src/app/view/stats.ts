/** Tela Estatísticas: indicadores, grafico de duracao por ciclo, registros. */
import type { Screen } from '../screen.ts';
import type { ViewContext } from './context.ts';
import { h } from './dom.ts';
import { emptyState, pageHeader } from './parts.ts';

export function statsView(ctx: ViewContext, screen: Screen): HTMLElement {
  const { m } = ctx;
  const stats = screen.stats;
  const root = h('div', { class: 'view' }, pageHeader(m.stats.title, null, m.common.back));
  if (stats.kind === 'empty') {
    root.append(emptyState(null, m.stats.emptyTitle, stats.message, null));
    return root;
  }
  const grid = h('dl', { class: 'stat-grid' });
  for (const c of stats.cards) grid.append(h('div', { class: 'stat' }, h('dt', null, c.label), h('dd', null, c.value)));
  root.append(h('section', { class: 'card', 'aria-label': m.stats.summary }, grid, h('p', { class: 'muted' }, stats.basisLine)));

  const chart = h('section', { class: 'card', 'aria-labelledby': 'chart-title' }, h('h2', { class: 'section-title', id: 'chart-title' }, m.stats.chartTitle));
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

  const records = h('dl', { class: 'detail-list' });
  for (const r of stats.records) records.append(h('div', null, h('dt', null, r.label), h('dd', null, r.value)));
  root.append(h('section', { class: 'card', 'aria-labelledby': 'records-title' }, h('h2', { class: 'section-title', id: 'records-title' }, m.stats.recordsTitle), records));

  if (stats.caution !== null) root.append(h('p', { class: 'banner banner-info' }, stats.caution));
  return root;
}
