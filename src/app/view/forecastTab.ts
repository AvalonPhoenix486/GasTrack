/** Tela Previsão: proxima troca estimada, datas, duracao, base de calculo e orientacoes. */
import type { Screen } from '../screen.ts';
import type { ViewContext } from './context.ts';
import { h, icon } from './dom.ts';
import type { IconName } from './dom.ts';
import { forecastCard, pageHeader, progressBar } from './parts.ts';

const ROW_ICONS: readonly IconName[] = ['calendar', 'calendar', 'hourglass', 'checkCircle'];

export function forecastView(ctx: ViewContext, screen: Screen): HTMLElement {
  const { m } = ctx;
  const page = screen.forecastPage;
  const root = h('div', { class: 'view' }, pageHeader(m.forecast.title, null, m.common.back));

  if (page.hero !== null) {
    root.append(h('section', { class: `card forecast-hero${page.tone === 'attention' ? ' attention' : ''}`, 'aria-labelledby': 'forecast-hero-title' },
      h('span', { class: 'hero-clock' }, icon('hourglass', 30)),
      h('div', { class: 'forecast-hero-text' },
        h('h2', { class: 'eyebrow', id: 'forecast-hero-title' }, m.forecast.heroTitle),
        h('p', { class: 'forecast-big' }, page.hero.big),
        h('p', { class: 'muted' }, page.hero.approx)),
      page.progress === null ? null : h('div', { class: 'forecast-progress' }, h('p', { class: 'muted' }, m.forecast.progress), progressBar(page.progress, m))));
  }
  if (page.collecting !== null) {
    const fill = h('span', { class: 'progress-fill' });
    fill.style.width = `${Math.min(100, page.collecting.pct)}%`;
    root.append(h('section', { class: 'card', 'aria-label': page.collecting.text },
      h('p', { class: 'section-title' }, page.collecting.text),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.min(100, page.collecting.pct), 'aria-label': page.collecting.text }, fill),
      h('p', { class: 'muted' }, m.forecast.collectingHint)));
  }
  if (page.rows.length > 0) {
    const list = h('div', { class: 'info-list' });
    page.rows.forEach((r, i) => list.append(h('div', { class: 'info-row' },
      h('span', { class: 'info-icon' }, icon(ROW_ICONS[i] ?? 'info', 20)),
      h('div', { class: 'info-text' }, h('span', { class: 'muted' }, r.label), h('strong', null, r.value)))));
    root.append(h('section', { class: 'card', 'aria-labelledby': 'fd-title' }, h('h2', { class: 'section-title', id: 'fd-title' }, m.forecast.detailsTitle), list));
  }
  root.append(forecastCard(screen.forecast, true, m));
  root.append(h('section', { class: 'tip-card' }, icon('bulb', 22), h('div', null, h('strong', null, m.forecast.tipTitle), h('p', null, m.forecast.tip))));
  return root;
}
